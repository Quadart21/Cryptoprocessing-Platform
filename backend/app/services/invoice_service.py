from decimal import Decimal

import logging
from secrets import token_urlsafe

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.tenant import apply_db_security_context
from app.models.invoice import Invoice
from app.models.ledger_entry import LedgerEntry
from app.models.project import Project
from app.models.transaction import Transaction
from app.providers.base import ProviderCreateInvoiceRequest
from app.providers.crypto_cash import CryptoCashProviderError, _provider_item
from app.providers.crypto_cash_status import (
    extract_event_type,
    normalize_crypto_cash_status,
    platform_status_indicates_payment,
    resolve_crypto_cash_status,
)
from app.providers.factory import get_payment_provider
from app.schemas.invoice import InvoiceCreateRequest
from app.services.accounting_service import AccountingService
from app.services.balance_hold_service import BalanceHoldService
from app.services.balance_service import BalanceService
from app.services.api_usage_context import provider_usage_scope
from app.services.billing_policy_service import BillingPolicyService
from app.services.client_webhook_service import ClientWebhookService
from app.services.event_service import EventService
from app.services.exchange_rate_service import get_exchange_rate_service
from app.services.provider_settlement_rate import (
    apply_settlement_fields_to_stored,
    extract_settlement_rate_from_stored,
    gross_from_provider_rate,
    resolve_settlement_amount_crypto,
)
from app.services.invoice_confirmations import (
    apply_confirmations_to_stored_payload,
    confirmations_complete,
    parse_confirmation_count,
    read_stored_confirmations,
    resolve_provider_deal_finalized,
    seed_required_confirmations,
    snap_confirmations_to_required,
)
from app.services.invoice_lifecycle import (
    compute_invoice_expires_at,
    is_invoice_expired,
)
from app.services.payment_page_service import PaymentPageService
from app.services.rates_service import RatesService
from app.services.statistics_exclusion_service import StatisticsExclusionService

logger = logging.getLogger(__name__)


class InvoiceAmountOutOfRangeError(ValueError):
    def __init__(
        self,
        *,
        amount: Decimal,
        currency: str,
        network: str,
        min_amount: Decimal | None,
        max_amount: Decimal | None,
        amount_fiat: Decimal | None = None,
        fiat_currency: str | None = None,
    ) -> None:
        self.amount = amount
        self.currency = currency
        self.network = network
        self.min_amount = min_amount
        self.max_amount = max_amount
        self.amount_fiat = amount_fiat
        self.fiat_currency = fiat_currency

        bounds: list[str] = []
        if min_amount is not None:
            bounds.append(f"min {self._fmt(min_amount)} {currency}")
        if max_amount is not None:
            bounds.append(f"max {self._fmt(max_amount)} {currency}")
        bounds_text = ", ".join(bounds) if bounds else "лимиты не заданы"
        message = (
            f"Сумма {self._fmt(amount)} {currency} для {currency}/{network} "
            f"вне допустимого диапазона ({bounds_text})."
        )
        if amount_fiat is not None and fiat_currency:
            message += f" Запрошено ≈ {self._fmt(amount_fiat)} {fiat_currency}."
        super().__init__(message)

    def to_response_detail(self) -> dict[str, str | None]:
        return {
            "code": "amount_out_of_range",
            "message": str(self),
            "currency": self.currency,
            "network": self.network,
            "amount": self._fmt(self.amount),
            "amount_unit": self.currency,
            "amount_fiat": self._fmt(self.amount_fiat),
            "fiat_currency": self.fiat_currency,
            "min_amount": self._fmt(self.min_amount),
            "max_amount": self._fmt(self.max_amount),
        }

    @staticmethod
    def _fmt(value: Decimal | None) -> str | None:
        if value is None:
            return None
        return format(value.normalize(), "f")


class InvoiceService:
    AMOUNT_PRECISION = Decimal("0.00000001")
    SETTLEMENT_USDT_PRECISION = Decimal("0.0001")
    BALANCE_CURRENCY = "USDT"

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _build_invoice_snapshot(invoice: Invoice) -> Invoice:
        return Invoice(
            id=invoice.id,
            tenant_id=invoice.tenant_id,
            project_id=invoice.project_id,
            merchant_order_id=invoice.merchant_order_id,
            provider_order_id=invoice.provider_order_id,
            amount_fiat=invoice.amount_fiat,
            fiat_currency=invoice.fiat_currency,
            amount_crypto=invoice.amount_crypto,
            crypto_currency=invoice.crypto_currency,
            network=invoice.network,
            payment_address=invoice.payment_address,
            qr_url=invoice.qr_url,
            status=invoice.status,
            expires_at=invoice.expires_at,
            paid_at=invoice.paid_at,
            confirmed_at=invoice.confirmed_at,
            metadata_json=invoice.metadata_json,
            raw_provider_payload_json=invoice.raw_provider_payload_json,
            created_at=invoice.created_at,
            updated_at=invoice.updated_at,
        )

    async def create_invoice(self, tenant_id: str, payload: InvoiceCreateRequest) -> Invoice:
        project = await self.db.scalar(
            select(Project).where(
                Project.id == payload.project_id,
                Project.tenant_id == tenant_id,
            )
        )
        if project is None:
            raise ValueError("Проект не найден.")

        rates_service = RatesService(self.db)
        limits = await rates_service.get_client_payin_limits(
            currency=payload.crypto_currency,
            network=payload.network,
        )
        exchange_rate_markup = await BillingPolicyService(self.db).get_exchange_rate_markup_percent()
        amount_fiat = Decimal(payload.amount_fiat)
        estimated_crypto = await self._estimate_payin_crypto_amount(
            amount_fiat=amount_fiat,
            fiat_currency=payload.fiat_currency,
            crypto_currency=payload.crypto_currency,
            exchange_rate_markup=exchange_rate_markup,
        )
        self._assert_amount_within_payin_limits(
            amount=estimated_crypto,
            currency=limits.currency,
            network=limits.network,
            min_amount=limits.min_amount,
            max_amount=limits.max_amount,
            amount_fiat=amount_fiat,
            fiat_currency=payload.fiat_currency.upper(),
        )

        provider = get_payment_provider()
        with provider_usage_scope(tenant_id=tenant_id, project_id=payload.project_id):
            provider_response = provider.create_invoice(
                ProviderCreateInvoiceRequest(
                    merchant_order_id=payload.merchant_order_id,
                    amount_fiat=payload.amount_fiat,
                    fiat_currency=payload.fiat_currency.upper(),
                    crypto_currency=payload.crypto_currency.upper(),
                    network=payload.network.upper(),
                )
            )
        resolved_amount_crypto = provider_response.amount_crypto or estimated_crypto
        self._assert_amount_within_payin_limits(
            amount=resolved_amount_crypto,
            currency=limits.currency,
            network=limits.network,
            min_amount=limits.min_amount,
            max_amount=limits.max_amount,
            amount_fiat=amount_fiat,
            fiat_currency=payload.fiat_currency.upper(),
        )

        invoice = Invoice(
            tenant_id=tenant_id,
            project_id=project.id,
            merchant_order_id=payload.merchant_order_id,
            provider_order_id=provider_response.provider_order_id,
            amount_fiat=amount_fiat,
            fiat_currency=payload.fiat_currency.upper(),
            amount_crypto=resolved_amount_crypto,
            crypto_currency=provider_response.crypto_currency,
            network=provider_response.network,
            payment_address=provider_response.payment_address,
            qr_url=provider_response.qr_url,
            payment_token=token_urlsafe(PaymentPageService.TOKEN_BYTES),
            status="pending",
            expires_at=compute_invoice_expires_at(),
            metadata_json=payload.metadata,
            raw_provider_payload_json=provider_response.raw_payload,
        )
        stored_payload = dict(invoice.raw_provider_payload_json or {})
        apply_confirmations_to_stored_payload(stored_payload, provider_response.raw_payload)
        try:
            required_confirmations = await rates_service.get_network_confirmations_required(
                currency=provider_response.crypto_currency,
                network=provider_response.network,
            )
            seed_required_confirmations(stored_payload, required_confirmations)
        except ValueError:
            pass
        if stored_payload != (invoice.raw_provider_payload_json or {}):
            invoice.raw_provider_payload_json = stored_payload
        self.db.add(invoice)
        await self.db.flush()
        invoice_snapshot = self._build_invoice_snapshot(invoice)

        transaction = Transaction(
            tenant_id=tenant_id,
            project_id=project.id,
            invoice_id=invoice.id,
            gross_amount=Decimal("0"),
            provider_fee=Decimal("0"),
            platform_fee=Decimal("0"),
            turnover_fee=Decimal("0"),
            net_amount=Decimal("0"),
            currency=self.BALANCE_CURRENCY,
            status="pending",
        )
        self.db.add(transaction)
        await EventService(self.db).create_event(
            invoice_id=invoice.id,
            event_type="invoice.created",
            source="system",
            payload=provider_response.raw_payload,
        )
        await self.db.flush()
        invoice_id = invoice.id
        project_id = project.id
        try:
            await self.db.commit()
        except Exception:
            logger.exception(
                "Invoice DB commit failed after provider creation for tenant_id=%s project_id=%s merchant_order_id=%s provider_order_id=%s",
                tenant_id,
                project.id,
                payload.merchant_order_id,
                provider_response.provider_order_id,
            )
            await self.db.rollback()
            raise
        try:
            await apply_db_security_context(self.db)
            refreshed_invoice = await self.get_invoice(tenant_id, invoice_id, project_id=project_id)
            if refreshed_invoice is not None:
                invoice = refreshed_invoice
        except Exception:
            logger.exception(
                "Invoice created but post-commit refresh failed for invoice_id=%s tenant_id=%s",
                invoice_id,
                tenant_id,
            )
        try:
            AccountingService.invalidate_cache(tenant_id=tenant_id)
        except Exception:
            logger.exception(
                "Invoice created but accounting cache invalidation failed for invoice_id=%s tenant_id=%s",
                invoice_id,
                tenant_id,
            )
        refreshed_invoice = await self.get_invoice(tenant_id, invoice_id, project_id=project_id)
        if refreshed_invoice is not None:
            return refreshed_invoice
        logger.warning(
            "Invoice created and committed, but reread returned no row. Returning snapshot for invoice_id=%s tenant_id=%s project_id=%s",
            invoice_id,
            tenant_id,
            project_id,
        )
        return invoice_snapshot

    async def list_invoices(self, tenant_id: str, project_id: str | None = None, limit: int = 50, offset: int = 0) -> list[Invoice]:
        stmt = select(Invoice).where(Invoice.tenant_id == tenant_id)
        if project_id is not None:
            stmt = stmt.where(Invoice.project_id == project_id)
        stmt = stmt.order_by(Invoice.created_at.desc()).limit(limit).offset(offset)
        return list((await self.db.scalars(stmt)).all())

    async def list_all_invoices(self, limit: int = 50, offset: int = 0) -> list[Invoice]:
        stmt = select(Invoice).order_by(Invoice.created_at.desc()).limit(limit).offset(offset)
        excluded = await StatisticsExclusionService(self.db).excluded_tenant_ids()
        if excluded:
            stmt = stmt.where(Invoice.tenant_id.not_in(excluded))
        return list((await self.db.scalars(stmt)).all())

    async def get_invoice(
        self, tenant_id: str, invoice_id: str, project_id: str | None = None
    ) -> Invoice | None:
        stmt = select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
        if project_id is not None:
            stmt = stmt.where(Invoice.project_id == project_id)
        return await self.db.scalar(stmt)

    async def get_invoice_by_id(self, invoice_id: str) -> Invoice | None:
        return await self.db.scalar(select(Invoice).where(Invoice.id == invoice_id))

    async def get_balance(self, tenant_id: str, project_id: str | None = None) -> Decimal:
        paid_statuses = {"paid", "confirmed"}
        stmt = select(Transaction).where(Transaction.tenant_id == tenant_id)
        if project_id is not None:
            stmt = stmt.where(Transaction.project_id == project_id)
        transactions = list((await self.db.scalars(stmt)).all())
        total = Decimal("0")
        for transaction in transactions:
            if transaction.status in paid_statuses:
                total += Decimal(transaction.net_amount)
        return total

    async def list_invoices_by_tenant(self, tenant_id: str, limit: int = 50, offset: int = 0) -> list[Invoice]:
        stmt = (
            select(Invoice)
            .where(Invoice.tenant_id == tenant_id)
            .order_by(Invoice.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list((await self.db.scalars(stmt)).all())

    @staticmethod
    def _sync_invoice_crypto_from_provider_payload(
        invoice: Invoice,
        raw_payload: dict | None,
    ) -> None:
        if not raw_payload:
            return

        candidates: list[dict] = []
        event = raw_payload.get("event")
        if isinstance(event, dict):
            data = event.get("data")
            if isinstance(data, dict):
                candidates.append(data)

        item = _provider_item(raw_payload)
        if isinstance(item, dict):
            candidates.append(item)

        for candidate in candidates:
            for key in ("receivedAmount", "expectedAmount", "requestedAmount", "amount"):
                raw = candidate.get(key)
                if raw in (None, ""):
                    continue
                try:
                    invoice.amount_crypto = Decimal(str(raw).replace(",", ".")).quantize(
                        InvoiceService.AMOUNT_PRECISION,
                    )
                    return
                except Exception:
                    continue

    async def apply_provider_status(
        self,
        provider_order_id: str | None,
        provider_status: str,
        merchant_order_id: str | None = None,
        tx_hash: str | None = None,
        source: str = "webhook",
        raw_payload: dict | None = None,
        provider_event_id: str | None = None,
    ) -> Invoice:
        invoice = None
        if provider_order_id:
            invoice = await self.db.scalar(
                select(Invoice).where(Invoice.provider_order_id == provider_order_id)
            )
        if invoice is None and merchant_order_id:
            invoice = await self.db.scalar(
                select(Invoice).where(Invoice.merchant_order_id == merchant_order_id)
            )
        if invoice is None:
            raise ValueError("Инвойс по webhook-идентификаторам не найден.")

        transaction = await self.db.scalar(
            select(Transaction).where(Transaction.invoice_id == invoice.id)
        )
        if transaction is None:
            raise ValueError("Транзакция для инвойса не найдена.")

        event_service = EventService(self.db)
        if provider_event_id:
            existing_event = await event_service.get_event_by_provider_event_id(
                provider_event_id,
                provider_name="crypto-cash",
            )
            if existing_event is not None:
                ProviderWebhookLogService.log_incoming(
                    outcome="duplicate_ignored",
                    source=source,
                    provider_event_id=provider_event_id,
                    provider_order_id=provider_order_id,
                    merchant_order_id=merchant_order_id,
                    provider_status=provider_status,
                    invoice_id=str(invoice.id),
                    raw_payload=raw_payload,
                )
                refreshed = await self.get_invoice(invoice.tenant_id, str(invoice.id), project_id=None)
                return refreshed if refreshed is not None else invoice

        previous_status = invoice.status
        if source == "webhook" and raw_payload is not None:
            try:
                raw_normalized = resolve_crypto_cash_status(
                    status=provider_status or None,
                    event_type=extract_event_type(raw_payload),
                )
            except ValueError:
                raw_normalized = normalize_crypto_cash_status(provider_status)
        else:
            raw_normalized = normalize_crypto_cash_status(provider_status)

        if invoice.status in {"cancelled", "expired"} and raw_normalized in {
            "pending",
            "expired",
            "cancelled",
        }:
            refreshed = await self.get_invoice(invoice.tenant_id, str(invoice.id), project_id=None)
            return refreshed if refreshed is not None else invoice

        stored_payload = dict(invoice.raw_provider_payload_json or {})
        if tx_hash and stored_payload.get("tx_hash") != tx_hash:
            stored_payload["tx_hash"] = tx_hash
        if raw_payload is not None:
            if source == "sync":
                stored_payload["retrieve_response"] = raw_payload
            elif source == "webhook":
                stored_payload["last_webhook_payload"] = raw_payload
            else:
                stored_payload["last_webhook_payload"] = raw_payload
        if provider_status and stored_payload.get("last_webhook_status") != provider_status:
            stored_payload["last_webhook_status"] = provider_status
        apply_confirmations_to_stored_payload(stored_payload, raw_payload)
        apply_settlement_fields_to_stored(
            stored_payload,
            raw_payload,
            provider_status=provider_status,
        )
        try:
            if parse_confirmation_count(stored_payload.get("network_confirmations_required")) in (None, 0):
                required_confirmations = await RatesService(self.db).get_network_confirmations_required(
                    currency=invoice.crypto_currency,
                    network=invoice.network,
                )
                seed_required_confirmations(stored_payload, required_confirmations)
        except ValueError:
            pass

        provider_deal_finalized = resolve_provider_deal_finalized(
            stored_payload,
            raw_payload,
            source=source,
            provider_status_normalized=raw_normalized,
        )
        if provider_deal_finalized:
            snap_confirmations_to_required(stored_payload)

        effective_status = self._resolve_effective_status(
            raw_normalized,
            stored_payload,
            provider_deal_finalized=provider_deal_finalized,
        )

        if previous_status == effective_status and not self._provider_meta_changed(
            invoice,
            stored_payload=stored_payload,
            tx_hash=tx_hash,
            raw_payload=raw_payload,
            provider_status=provider_status,
        ):
            invoice.raw_provider_payload_json = stored_payload
            self.db.add(invoice)
            await self._persist_provider_callback(
                event_service,
                invoice_id=str(invoice.id),
                source=source,
                provider_order_id=provider_order_id,
                merchant_order_id=merchant_order_id,
                provider_event_id=provider_event_id,
                provider_status=provider_status,
                effective_status=effective_status,
                previous_status=previous_status,
                raw_payload=raw_payload,
                outcome="unchanged",
            )
            await self.db.commit()
            refreshed = await self.get_invoice(invoice.tenant_id, str(invoice.id), project_id=None)
            return refreshed if refreshed is not None else invoice

        invoice.status = effective_status

        self._sync_invoice_crypto_from_provider_payload(invoice, raw_payload)
        invoice.raw_provider_payload_json = stored_payload

        transaction.status = effective_status
        await self._apply_financial_state_transition(
            invoice=invoice,
            transaction=transaction,
            previous_status=previous_status,
            new_status=effective_status,
        )

        if effective_status in {"confirming", "confirmed"}:
            transaction.paid_at = invoice.paid_at = transaction.paid_at or invoice.paid_at
            if transaction.paid_at is None:
                from datetime import datetime, timezone

                now = datetime.now(timezone.utc)
                transaction.paid_at = now
                invoice.paid_at = now

        if effective_status == "confirmed":
            from datetime import datetime, timezone

            invoice.confirmed_at = invoice.confirmed_at or datetime.now(timezone.utc)

        await self._persist_provider_callback(
            event_service,
            invoice_id=str(invoice.id),
            source=source,
            provider_order_id=provider_order_id,
            merchant_order_id=merchant_order_id,
            provider_event_id=provider_event_id,
            provider_status=provider_status,
            effective_status=effective_status,
            previous_status=previous_status,
            raw_payload=raw_payload,
            outcome="status_updated",
        )
        await event_service.create_event(
            invoice_id=invoice.id,
            event_type=f"invoice.{effective_status}",
            source=source,
            payload=stored_payload,
            provider_event_id=None,
        )
        # Flush + refresh so all columns (created_at / updated_at) are loaded in the async session.
        # Without this, the instance can be expired after nested flushes — lazy-load then raises MissingGreenlet.
        await self.db.flush()
        await self.db.refresh(invoice)
        await self.db.refresh(transaction)
        project = await self.db.get(Project, invoice.project_id)
        await ClientWebhookService(event_service).deliver_invoice_update(
            project,
            invoice,
            transaction,
            event_name=f"invoice.{effective_status}",
        )
        tenant_id = invoice.tenant_id
        invoice_id = invoice.id
        project_id = invoice.project_id
        await self.db.flush()
        await self.db.refresh(invoice)
        invoice_snapshot = self._build_invoice_snapshot(invoice)
        self.db.add_all([invoice, transaction])
        try:
            await self.db.commit()
        except Exception:
            logger.exception(
                "Invoice status DB commit failed for invoice_id=%s tenant_id=%s project_id=%s status=%s",
                invoice_id,
                tenant_id,
                project_id,
                effective_status,
            )
            await self.db.rollback()
            raise
        try:
            await apply_db_security_context(self.db)
            refreshed_invoice = await self.get_invoice(tenant_id, invoice_id, project_id=project_id)
            if refreshed_invoice is not None:
                invoice = refreshed_invoice
        except Exception:
            logger.exception(
                "Invoice status updated but post-commit refresh failed for invoice_id=%s tenant_id=%s",
                invoice_id,
                tenant_id,
            )
        try:
            AccountingService.invalidate_cache(tenant_id=tenant_id)
        except Exception:
            logger.exception(
                "Invoice status updated but accounting cache invalidation failed for invoice_id=%s tenant_id=%s",
                invoice_id,
                tenant_id,
            )
        refreshed_invoice = await self.get_invoice(tenant_id, invoice_id, project_id=project_id)
        if refreshed_invoice is not None:
            return refreshed_invoice
        logger.warning(
            "Invoice status committed, but reread returned no row. Returning snapshot for invoice_id=%s tenant_id=%s project_id=%s",
            invoice_id,
            tenant_id,
            project_id,
        )
        return invoice_snapshot

    async def apply_invoice_status_by_id(
        self, invoice_id: str, provider_status: str, tx_hash: str | None = None
    ) -> Invoice:
        invoice = await self.get_invoice_by_id(invoice_id)
        if invoice is None:
            raise ValueError("Инвойс не найден.")
        return await self.apply_provider_status(
            invoice.provider_order_id,
            provider_status,
            tx_hash=tx_hash,
            source="manual",
        )

    async def ensure_invoice_payment_state(self, invoice: Invoice) -> Invoice:
        if invoice.status != "pending" or not is_invoice_expired(invoice):
            return invoice
        return await self._cancel_unpaid_invoice(invoice, source="expiry")

    async def sync_invoice_status(
        self,
        tenant_id: str,
        invoice_id: str,
        project_id: str | None = None,
    ) -> Invoice:
        invoice = await self.get_invoice(tenant_id, invoice_id, project_id=project_id)
        if invoice is None:
            raise ValueError("Инвойс не найден.")

        if invoice.status == "pending" and is_invoice_expired(invoice):
            return await self._sync_expired_pending(invoice)

        if invoice.status == "cancelled":
            return await self._sync_cancelled_for_late_payment(invoice)

        return await self._sync_with_provider(invoice)

    async def _sync_with_provider(self, invoice: Invoice) -> Invoice:
        provider_response = await self._fetch_provider_status(invoice)
        item = _provider_item(provider_response)
        provider_status = str(item.get("status") or invoice.status)
        provider_order_id = str(item.get("id") or invoice.provider_order_id)
        tx_hash = item.get("hash")
        return await self.apply_provider_status(
            provider_order_id=provider_order_id,
            merchant_order_id=invoice.merchant_order_id,
            provider_status=provider_status,
            tx_hash=str(tx_hash) if tx_hash else None,
            source="sync",
            raw_payload=provider_response,
        )

    async def _sync_expired_pending(self, invoice: Invoice) -> Invoice:
        provider_response = await self._fetch_provider_status(invoice)
        item = _provider_item(provider_response)
        provider_status = str(item.get("status") or "pending")
        try:
            raw_normalized = normalize_crypto_cash_status(provider_status)
        except ValueError:
            return await self._cancel_unpaid_invoice(invoice, source="expiry")

        if platform_status_indicates_payment(raw_normalized):
            provider_order_id = str(item.get("id") or invoice.provider_order_id)
            tx_hash = item.get("hash")
            return await self.apply_provider_status(
                provider_order_id=provider_order_id,
                merchant_order_id=invoice.merchant_order_id,
                provider_status=provider_status,
                tx_hash=str(tx_hash) if tx_hash else None,
                source="sync",
                raw_payload=provider_response,
            )
        return await self._cancel_unpaid_invoice(invoice, source="expiry")

    async def _sync_cancelled_for_late_payment(self, invoice: Invoice) -> Invoice:
        try:
            provider_response = await self._fetch_provider_status(invoice)
            item = _provider_item(provider_response)
            provider_status = str(item.get("status") or invoice.status)
            raw_normalized = normalize_crypto_cash_status(provider_status)
            if platform_status_indicates_payment(raw_normalized):
                provider_order_id = str(item.get("id") or invoice.provider_order_id)
                tx_hash = item.get("hash")
                return await self.apply_provider_status(
                    provider_order_id=provider_order_id,
                    merchant_order_id=invoice.merchant_order_id,
                    provider_status=provider_status,
                    tx_hash=str(tx_hash) if tx_hash else None,
                    source="sync",
                    raw_payload=provider_response,
                )
        except (CryptoCashProviderError, ValueError):
            pass
        refreshed = await self.get_invoice(invoice.tenant_id, str(invoice.id), project_id=invoice.project_id)
        return refreshed if refreshed is not None else invoice

    async def _fetch_provider_status(self, invoice: Invoice) -> dict:
        provider = get_payment_provider()
        with provider_usage_scope(tenant_id=invoice.tenant_id, project_id=invoice.project_id):
            return provider.get_invoice_status(invoice.merchant_order_id)

    async def _cancel_unpaid_invoice(self, invoice: Invoice, *, source: str = "expiry") -> Invoice:
        if invoice.status != "pending":
            refreshed = await self.get_invoice(invoice.tenant_id, str(invoice.id), project_id=invoice.project_id)
            return refreshed if refreshed is not None else invoice

        transaction = await self.db.scalar(
            select(Transaction).where(Transaction.invoice_id == invoice.id)
        )
        if transaction is None:
            raise ValueError("Транзакция для инвойса не найдена.")

        invoice.status = "cancelled"
        transaction.status = "cancelled"
        event_service = EventService(self.db)
        await event_service.create_event(
            invoice_id=invoice.id,
            event_type="invoice.cancelled",
            source=source,
            payload={
                "reason": "payment_ttl_exceeded",
                "expires_at": invoice.expires_at.isoformat(),
            },
        )
        self.db.add_all([invoice, transaction])
        await self.db.flush()
        project = await self.db.get(Project, invoice.project_id)
        await ClientWebhookService(event_service).deliver_invoice_update(
            project,
            invoice,
            transaction,
            event_name="invoice.cancelled",
        )
        tenant_id = invoice.tenant_id
        invoice_id = invoice.id
        project_id = invoice.project_id
        await self.db.commit()
        refreshed = await self.get_invoice(tenant_id, invoice_id, project_id=project_id)
        return refreshed if refreshed is not None else invoice

    async def _apply_financial_state_transition(
        self,
        invoice: Invoice,
        transaction: Transaction,
        previous_status: str,
        new_status: str,
    ) -> None:
        # Settlement and balance accrual only after full network confirmation.
        if new_status != "confirmed":
            return

        balance_service = BalanceService(self.db)
        balance = await balance_service.get_or_create_balance(invoice.tenant_id, self.BALANCE_CURRENCY)

        settlement_exists = await self.db.scalar(
            select(LedgerEntry.id)
            .where(
                LedgerEntry.invoice_id == invoice.id,
                LedgerEntry.entry_type == "invoice.gross_accrual",
            )
            .limit(1)
        )
        if settlement_exists is None:
            await self._apply_initial_settlement(invoice, transaction, balance_service, balance)
        await self._freeze_confirmed_settlement(invoice, transaction, balance_service, balance)

    async def resolve_accounting_gross_amount(
        self,
        *,
        amount_crypto: Decimal,
        crypto_currency: str,
        fiat_currency: str,
        exchange_rate_markup: Decimal | None = None,
    ) -> Decimal:
        """Convert crypto to fiat using the exchange rate at call time (settlement: markup=0, rate from cache/JSON)."""
        crypto_currency = crypto_currency.strip().upper()
        fiat_currency = fiat_currency.strip().upper()
        amount_crypto = Decimal(amount_crypto).quantize(self.AMOUNT_PRECISION)

        rate_service = get_exchange_rate_service()
        if (
            crypto_currency in rate_service.STABLECOIN_EQUIVALENTS
            and fiat_currency in rate_service.STABLECOIN_EQUIVALENTS
        ):
            return amount_crypto

        if exchange_rate_markup is None:
            exchange_rate_markup = await BillingPolicyService(self.db).get_exchange_rate_markup_percent()

        converted = await rate_service.convert_to_fiat(
            amount=amount_crypto,
            from_currency=crypto_currency,
            to_fiat=fiat_currency,
            markup_percent=exchange_rate_markup,
        )
        if converted is None:
            raise ValueError(
                f"Курс {crypto_currency}/{fiat_currency} недоступен. "
                "Обновите курсы в админке или задайте ручной курс."
            )
        return converted.quantize(self.AMOUNT_PRECISION)

    async def resolve_settlement_gross_amount(self, invoice: Invoice) -> Decimal:
        """Gross USDT for settlement: Crypto-Cash exchangeRate from Paid webhook, else platform cache."""
        stored_payload = invoice.raw_provider_payload_json or {}
        amount_crypto = resolve_settlement_amount_crypto(
            Decimal(invoice.amount_crypto),
            stored_payload,
        )
        crypto_currency = invoice.crypto_currency.strip().upper()

        rate_service = get_exchange_rate_service()
        if crypto_currency in rate_service.STABLECOIN_EQUIVALENTS:
            return amount_crypto.quantize(self.SETTLEMENT_USDT_PRECISION)

        provider_rate = extract_settlement_rate_from_stored(stored_payload)
        if provider_rate is not None:
            gross = gross_from_provider_rate(
                amount_crypto=amount_crypto,
                exchange_rate=provider_rate,
            )
            logger.info(
                "Settlement gross from Crypto-Cash exchangeRate invoice_id=%s rate=%s amount_crypto=%s gross=%s",
                invoice.id,
                provider_rate,
                amount_crypto,
                gross,
            )
            return gross

        raise ValueError(
            "Курс Crypto-Cash (exchangeRate) не найден в webhook/retrieve со статусом Paid. "
            "Выполните sync инвойса после оплаты или дождитесь webhook acquiring::completed."
        )

    async def _apply_initial_settlement(
        self,
        invoice: Invoice,
        transaction: Transaction,
        balance_service: BalanceService,
        balance,
    ) -> None:
        gross_amount = await self.resolve_settlement_gross_amount(invoice)

        provider_fee, platform_fee, turnover_fee, net_amount = await self._calculate_financials(
            tenant_id=invoice.tenant_id,
            gross_amount=gross_amount,
            fiat_currency=self.BALANCE_CURRENCY,
        )

        transaction.gross_amount = gross_amount
        transaction.provider_fee = provider_fee
        transaction.platform_fee = platform_fee
        transaction.turnover_fee = turnover_fee
        transaction.net_amount = net_amount

        await balance_service.apply_bucket_delta(balance, "provider_gross_amount", gross_amount)
        await balance_service.apply_bucket_delta(balance, "pending_amount", net_amount)

        provider_percent = await BillingPolicyService(self.db).get_provider_fee_percent()
        markup_percent = await BillingPolicyService(self.db).get_effective_markup_percent(invoice.tenant_id)

        await balance_service.add_ledger_entry(
            tenant_id=invoice.tenant_id,
            currency=self.BALANCE_CURRENCY,
            amount=gross_amount,
            direction="credit",
            balance_bucket="pending_amount",
            entry_type="invoice.gross_accrual",
            invoice_id=invoice.id,
            transaction_id=transaction.id,
            description="Начисление валовой суммы по инвойсу.",
        )
        await balance_service.add_ledger_entry(
            tenant_id=invoice.tenant_id,
            currency=self.BALANCE_CURRENCY,
            amount=provider_fee,
            direction="debit",
            balance_bucket="pending_amount",
            entry_type="invoice.provider_fee",
            invoice_id=invoice.id,
            transaction_id=transaction.id,
            description="Удержание комиссии Crypto-Cash.",
            metadata_json={"percent": str(provider_percent)},
        )
        await balance_service.add_ledger_entry(
            tenant_id=invoice.tenant_id,
            currency=self.BALANCE_CURRENCY,
            amount=platform_fee,
            direction="debit",
            balance_bucket="pending_amount",
            entry_type="invoice.platform_markup",
            invoice_id=invoice.id,
            transaction_id=transaction.id,
            description="Удержание наценки платформы.",
            metadata_json={"percent": str(markup_percent)},
        )
        if turnover_fee > Decimal("0"):
            await balance_service.add_ledger_entry(
                tenant_id=invoice.tenant_id,
                currency=self.BALANCE_CURRENCY,
                amount=turnover_fee,
                direction="debit",
                balance_bucket="pending_amount",
                entry_type="invoice.turnover_fee",
                invoice_id=invoice.id,
                transaction_id=transaction.id,
                description="Удержание комиссии платформы от оборота.",
                metadata_json={"percent": "0"},
            )

    async def _freeze_confirmed_settlement(
        self,
        invoice: Invoice,
        transaction: Transaction,
        balance_service: BalanceService,
        balance,
    ) -> None:
        hold_service = BalanceHoldService(self.db)
        await hold_service.freeze_confirmed_settlement(invoice, transaction, balance)

    async def _calculate_financials(
        self,
        tenant_id: str,
        gross_amount: Decimal,
        fiat_currency: str,
    ) -> tuple[Decimal, Decimal, Decimal, Decimal]:
        """Cascade: provider %/fix from gross, then platform % or fix from remainder."""
        billing_policy_service = BillingPolicyService(self.db)
        provider_fee_percent = await billing_policy_service.get_provider_fee_percent()
        markup_percent = await billing_policy_service.get_effective_markup_percent(tenant_id)
        provider_min_fee_usdt = await billing_policy_service.get_min_total_payment_fee_usdt()
        platform_min_fee_usdt = await billing_policy_service.get_platform_fee_min_usdt()

        gross = gross_amount.quantize(self.SETTLEMENT_USDT_PRECISION)
        provider_calc = self._calculate_settlement_percent_amount(gross, provider_fee_percent)
        provider_fixed = await self._resolve_fixed_fee_usdt(
            min_fee_usdt=provider_min_fee_usdt,
            fiat_currency=fiat_currency,
        )
        provider_used_fix = provider_calc < provider_fixed
        provider_fee = provider_fixed if provider_used_fix else provider_calc
        provider_fee = min(provider_fee, gross).quantize(self.SETTLEMENT_USDT_PRECISION)

        after_provider = (gross - provider_fee).quantize(self.SETTLEMENT_USDT_PRECISION)
        if after_provider < Decimal("0"):
            raise ValueError("Комиссия провайдера не может превышать gross.")

        if provider_used_fix:
            platform_fixed = await self._resolve_fixed_fee_usdt(
                min_fee_usdt=platform_min_fee_usdt,
                fiat_currency=fiat_currency,
            )
            platform_fee = min(platform_fixed, after_provider).quantize(self.SETTLEMENT_USDT_PRECISION)
        else:
            platform_fee = self._calculate_settlement_percent_amount(after_provider, markup_percent)

        turnover_fee = Decimal("0")
        net_amount = (after_provider - platform_fee).quantize(self.SETTLEMENT_USDT_PRECISION)
        if net_amount < Decimal("0"):
            raise ValueError("Чистая сумма клиента не может быть отрицательной.")
        return provider_fee, platform_fee, turnover_fee, net_amount

    async def _resolve_fixed_fee_usdt(
        self,
        *,
        min_fee_usdt: Decimal,
        fiat_currency: str,
    ) -> Decimal:
        if min_fee_usdt <= Decimal("0"):
            return Decimal("0")

        fc = (fiat_currency or self.BALANCE_CURRENCY).strip().upper()
        rate_svc = get_exchange_rate_service()
        if fc in rate_svc.STABLECOIN_EQUIVALENTS:
            return min_fee_usdt.quantize(self.SETTLEMENT_USDT_PRECISION)

        converted = await rate_svc.convert_from_fiat(min_fee_usdt, fc, "USDT", Decimal("0"))
        if converted is None:
            logger.warning("Skipping fixed fee conversion: cannot convert %s USDT to %s", min_fee_usdt, fc)
            return Decimal("0")
        return converted.quantize(self.SETTLEMENT_USDT_PRECISION)

    def _calculate_settlement_percent_amount(self, base_amount: Decimal, percent: Decimal) -> Decimal:
        return ((base_amount * percent) / Decimal("100")).quantize(self.SETTLEMENT_USDT_PRECISION)

    def _calculate_percent_amount(self, base_amount: Decimal, percent: Decimal) -> Decimal:
        return ((base_amount * percent) / Decimal("100")).quantize(self.AMOUNT_PRECISION)

    async def _estimate_payin_crypto_amount(
        self,
        *,
        amount_fiat: Decimal,
        fiat_currency: str,
        crypto_currency: str,
        exchange_rate_markup: Decimal | None = None,
    ) -> Decimal:
        crypto_currency = crypto_currency.strip().upper()
        fiat_currency = fiat_currency.strip().upper()
        amount_fiat = Decimal(amount_fiat).quantize(self.AMOUNT_PRECISION)

        if crypto_currency == fiat_currency:
            return amount_fiat

        rate_service = get_exchange_rate_service()
        if (
            crypto_currency in rate_service.STABLECOIN_EQUIVALENTS
            and fiat_currency in rate_service.STABLECOIN_EQUIVALENTS
        ):
            return amount_fiat

        if exchange_rate_markup is None:
            exchange_rate_markup = await BillingPolicyService(self.db).get_exchange_rate_markup_percent()

        estimated = await rate_service.convert_from_fiat(
            amount_fiat=amount_fiat,
            to_currency=crypto_currency,
            from_fiat=fiat_currency,
            markup_percent=exchange_rate_markup,
        )
        if estimated is None:
            raise ValueError(
                f"Курс {crypto_currency}/{fiat_currency} недоступен. "
                "Обновите курсы в админке или задайте ручной курс."
            )
        return estimated.quantize(self.AMOUNT_PRECISION)

    def _assert_amount_within_payin_limits(
        self,
        *,
        amount: Decimal,
        currency: str,
        network: str,
        min_amount: Decimal | None,
        max_amount: Decimal | None,
        amount_fiat: Decimal | None = None,
        fiat_currency: str | None = None,
    ) -> None:
        if min_amount is not None and amount < min_amount:
            raise InvoiceAmountOutOfRangeError(
                amount=amount,
                currency=currency,
                network=network,
                min_amount=min_amount,
                max_amount=max_amount,
                amount_fiat=amount_fiat,
                fiat_currency=fiat_currency,
            )
        if max_amount is not None and amount > max_amount:
            raise InvoiceAmountOutOfRangeError(
                amount=amount,
                currency=currency,
                network=network,
                min_amount=min_amount,
                max_amount=max_amount,
                amount_fiat=amount_fiat,
                fiat_currency=fiat_currency,
            )

    @staticmethod
    def _resolve_effective_status(
        raw_normalized: str,
        stored_payload: dict,
        *,
        provider_deal_finalized: bool = False,
    ) -> str:
        """Map provider paid-like statuses to confirming until block confirmations complete."""
        if raw_normalized in {"paid", "confirmed"}:
            if confirmations_complete(
                stored_payload,
                provider_deal_finalized=provider_deal_finalized,
            ):
                return "confirmed"
            return "confirming"
        return raw_normalized

    async def _persist_provider_callback(
        self,
        event_service: EventService,
        *,
        invoice_id: str,
        source: str,
        provider_order_id: str | None,
        merchant_order_id: str | None,
        provider_event_id: str | None,
        provider_status: str,
        effective_status: str,
        previous_status: str,
        raw_payload: dict | None,
        outcome: str,
    ) -> None:
        callback_payload = {
            "provider_status": provider_status,
            "effective_status": effective_status,
            "previous_status": previous_status,
            "raw_payload": raw_payload,
            "outcome": outcome,
        }
        ProviderWebhookLogService.log_incoming(
            outcome=outcome,
            source=source,
            provider_event_id=provider_event_id,
            provider_order_id=provider_order_id,
            merchant_order_id=merchant_order_id,
            provider_status=provider_status,
            effective_status=effective_status,
            previous_status=previous_status,
            invoice_id=invoice_id,
            raw_payload=raw_payload,
        )
        if source != "webhook":
            return
        await event_service.create_event(
            invoice_id=invoice_id,
            event_type="provider.webhook",
            source=source,
            payload=callback_payload,
            provider_event_id=provider_event_id,
        )
        await self.db.flush()

    @staticmethod
    def _provider_meta_changed(
        invoice: Invoice,
        *,
        stored_payload: dict,
        tx_hash: str | None,
        raw_payload: dict | None,
        provider_status: str | None,
    ) -> bool:
        old = dict(invoice.raw_provider_payload_json or {})
        if tx_hash and old.get("tx_hash") != tx_hash:
            return True
        if provider_status and old.get("last_webhook_status") != provider_status:
            return True
        if raw_payload is not None and old.get("last_webhook_payload") != raw_payload:
            return True
        for key in ("network_confirmations_actual", "network_confirmations_required"):
            if old.get(key) != stored_payload.get(key):
                return True
        return False

    def _has_misconverted_altcoin_settlement(
        self,
        invoice: Invoice,
        transaction: Transaction,
    ) -> bool:
        """Gross in USDT equals crypto units — classic DOGE-as-USDT bug."""
        rate_service = get_exchange_rate_service()
        crypto = invoice.crypto_currency.strip().upper()
        if crypto in rate_service.STABLECOIN_EQUIVALENTS:
            return False
        if transaction.currency.strip().upper() != self.BALANCE_CURRENCY:
            return False
        gross = Decimal(transaction.gross_amount).quantize(self.AMOUNT_PRECISION)
        amount_crypto = Decimal(invoice.amount_crypto).quantize(self.AMOUNT_PRECISION)
        if gross != amount_crypto:
            return False
        return transaction.status in {"paid", "confirmed"}

    async def repair_misconverted_settlement(self, invoice_id: str) -> Invoice:
        invoice = await self.get_invoice_by_id(invoice_id)
        if invoice is None:
            raise ValueError("Инвойс не найден.")
        transaction = await self.db.scalar(
            select(Transaction).where(Transaction.invoice_id == invoice.id)
        )
        if transaction is None:
            raise ValueError("Транзакция для инвойса не найдена.")
        if not self._has_misconverted_altcoin_settlement(invoice, transaction):
            raise ValueError("Перерасчёт для этого инвойса не требуется.")

        old_gross = Decimal(transaction.gross_amount)
        old_net = Decimal(transaction.net_amount)

        new_gross = await self.resolve_settlement_gross_amount(invoice)
        provider_fee, platform_fee, turnover_fee, new_net = await self._calculate_financials(
            tenant_id=invoice.tenant_id,
            gross_amount=new_gross,
            fiat_currency=self.BALANCE_CURRENCY,
        )

        gross_delta = new_gross - old_gross
        net_delta = new_net - old_net
        balance_service = BalanceService(self.db)
        balance = await balance_service.get_or_create_balance(invoice.tenant_id, self.BALANCE_CURRENCY)
        hold_service = BalanceHoldService(self.db)
        net_bucket = await hold_service.resolve_net_bucket(transaction)

        if gross_delta != 0:
            await balance_service.apply_bucket_delta(balance, "provider_gross_amount", gross_delta)
            await balance_service.add_ledger_entry(
                tenant_id=invoice.tenant_id,
                currency=self.BALANCE_CURRENCY,
                amount=abs(gross_delta),
                direction="credit" if gross_delta > 0 else "debit",
                balance_bucket="provider_gross_amount",
                entry_type="invoice.settlement_repair.gross",
                invoice_id=invoice.id,
                transaction_id=transaction.id,
                description="Корректировка валовой суммы после исправления конвертации altcoin→USDT.",
                metadata_json={"old_gross": str(old_gross), "new_gross": str(new_gross)},
            )
        if net_delta != 0:
            await balance_service.apply_bucket_delta(balance, net_bucket, net_delta)
            await balance_service.add_ledger_entry(
                tenant_id=invoice.tenant_id,
                currency=self.BALANCE_CURRENCY,
                amount=abs(net_delta),
                direction="credit" if net_delta > 0 else "debit",
                balance_bucket=net_bucket,
                entry_type="invoice.settlement_repair.net",
                invoice_id=invoice.id,
                transaction_id=transaction.id,
                description="Корректировка зачисления после исправления конвертации altcoin→USDT.",
                metadata_json={"old_net": str(old_net), "new_net": str(new_net)},
            )

        transaction.gross_amount = new_gross
        transaction.provider_fee = provider_fee
        transaction.platform_fee = platform_fee
        transaction.turnover_fee = turnover_fee
        transaction.net_amount = new_net
        self.db.add(transaction)

        if Decimal(invoice.amount_fiat) == old_gross:
            invoice.amount_fiat = new_gross
            invoice.fiat_currency = self.BALANCE_CURRENCY
            self.db.add(invoice)

        await self.db.commit()
        refreshed = await self.get_invoice_by_id(invoice_id)
        return refreshed if refreshed is not None else invoice

