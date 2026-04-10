from decimal import Decimal

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.tenant import apply_db_security_context
from app.models.invoice import Invoice
from app.models.project import Project
from app.models.transaction import Transaction
from app.providers.base import ProviderCreateInvoiceRequest
from app.providers.factory import get_payment_provider
from app.schemas.invoice import InvoiceCreateRequest
from app.services.accounting_service import AccountingService
from app.services.balance_service import BalanceService
from app.services.billing_policy_service import BillingPolicyService
from app.services.client_webhook_service import ClientWebhookService
from app.services.event_service import EventService
from app.services.exchange_rate_service import get_exchange_rate_service
from app.services.rates_service import RatesService

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
    ) -> None:
        self.amount = amount
        self.currency = currency
        self.network = network
        self.min_amount = min_amount
        self.max_amount = max_amount

        bounds: list[str] = []
        if min_amount is not None:
            bounds.append(f"min {self._fmt(min_amount)}")
        if max_amount is not None:
            bounds.append(f"max {self._fmt(max_amount)}")
        bounds_text = ", ".join(bounds) if bounds else "лимиты не заданы"
        message = (
            f"Сумма {self._fmt(amount)} для {currency}/{network} вне допустимого диапазона ({bounds_text})."
        )
        super().__init__(message)

    def to_response_detail(self) -> dict[str, str | None]:
        return {
            "code": "amount_out_of_range",
            "message": str(self),
            "currency": self.currency,
            "network": self.network,
            "amount": self._fmt(self.amount),
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
    BALANCE_CURRENCY = "USDT"

    def __init__(self, db: Session):
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

    def create_invoice(self, tenant_id: str, payload: InvoiceCreateRequest) -> Invoice:
        project = self.db.scalar(
            select(Project).where(
                Project.id == payload.project_id,
                Project.tenant_id == tenant_id,
            )
        )
        if project is None:
            raise ValueError("Проект не найден.")

        rates_service = RatesService(self.db)
        limits = rates_service.get_client_payin_limits(
            currency=payload.crypto_currency,
            network=payload.network,
        )
        self._assert_amount_within_payin_limits(
            amount=Decimal(payload.amount_fiat),
            currency=limits.currency,
            network=limits.network,
            min_amount=limits.min_amount,
            max_amount=limits.max_amount,
        )

        provider = get_payment_provider()
        provider_response = provider.create_invoice(
            ProviderCreateInvoiceRequest(
                merchant_order_id=payload.merchant_order_id,
                amount_fiat=payload.amount_fiat,
                fiat_currency=payload.fiat_currency.upper(),
                crypto_currency=payload.crypto_currency.upper(),
                network=payload.network.upper(),
            )
        )
        exchange_rate_markup = BillingPolicyService(self.db).get_exchange_rate_markup_percent()
        resolved_amount_crypto = provider_response.amount_crypto or Decimal(payload.amount_fiat)
        accounting_amount_fiat = get_exchange_rate_service().convert_to_fiat(
            amount=resolved_amount_crypto,
            from_currency=provider_response.crypto_currency,
            to_fiat=payload.fiat_currency.upper(),
            markup_percent=exchange_rate_markup,
        )
        resolved_amount_fiat = accounting_amount_fiat or Decimal(payload.amount_fiat)

        invoice = Invoice(
            tenant_id=tenant_id,
            project_id=project.id,
            merchant_order_id=payload.merchant_order_id,
            provider_order_id=provider_response.provider_order_id,
            amount_fiat=resolved_amount_fiat,
            fiat_currency=payload.fiat_currency.upper(),
            amount_crypto=resolved_amount_crypto,
            crypto_currency=provider_response.crypto_currency,
            network=provider_response.network,
            payment_address=provider_response.payment_address,
            qr_url=provider_response.qr_url,
            status="pending",
            expires_at=provider_response.expires_at,
            metadata_json=payload.metadata,
            raw_provider_payload_json=provider_response.raw_payload,
        )
        self.db.add(invoice)
        self.db.flush()
        invoice_snapshot = self._build_invoice_snapshot(invoice)

        transaction = Transaction(
            tenant_id=tenant_id,
            project_id=project.id,
            invoice_id=invoice.id,
            gross_amount=resolved_amount_fiat,
            provider_fee=Decimal("0"),
            platform_fee=Decimal("0"),
            turnover_fee=Decimal("0"),
            net_amount=resolved_amount_fiat,
            currency=self.BALANCE_CURRENCY,
            status="pending",
        )
        self.db.add(transaction)
        EventService(self.db).create_event(
            invoice_id=invoice.id,
            event_type="invoice.created",
            source="system",
            payload=provider_response.raw_payload,
        )
        self.db.flush()
        invoice_id = invoice.id
        project_id = project.id
        try:
            self.db.commit()
        except Exception:
            logger.exception(
                "Invoice DB commit failed after provider creation for tenant_id=%s project_id=%s merchant_order_id=%s provider_order_id=%s",
                tenant_id,
                project.id,
                payload.merchant_order_id,
                provider_response.provider_order_id,
            )
            self.db.rollback()
            raise
        try:
            apply_db_security_context(self.db)
            refreshed_invoice = self.get_invoice(tenant_id, invoice_id, project_id=project_id)
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
        refreshed_invoice = self.get_invoice(tenant_id, invoice_id, project_id=project_id)
        if refreshed_invoice is not None:
            return refreshed_invoice
        logger.warning(
            "Invoice created and committed, but reread returned no row. Returning snapshot for invoice_id=%s tenant_id=%s project_id=%s",
            invoice_id,
            tenant_id,
            project_id,
        )
        return invoice_snapshot

    def list_invoices(self, tenant_id: str, project_id: str | None = None, limit: int = 50, offset: int = 0) -> list[Invoice]:
        stmt = select(Invoice).where(Invoice.tenant_id == tenant_id)
        if project_id is not None:
            stmt = stmt.where(Invoice.project_id == project_id)
        stmt = stmt.order_by(Invoice.created_at.desc()).limit(limit).offset(offset)
        return list(self.db.scalars(stmt).all())

    def list_all_invoices(self, limit: int = 50, offset: int = 0) -> list[Invoice]:
        stmt = select(Invoice).order_by(Invoice.created_at.desc()).limit(limit).offset(offset)
        return list(self.db.scalars(stmt).all())

    def get_invoice(
        self, tenant_id: str, invoice_id: str, project_id: str | None = None
    ) -> Invoice | None:
        stmt = select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
        if project_id is not None:
            stmt = stmt.where(Invoice.project_id == project_id)
        return self.db.scalar(stmt)

    def get_invoice_by_id(self, invoice_id: str) -> Invoice | None:
        return self.db.scalar(select(Invoice).where(Invoice.id == invoice_id))

    def get_balance(self, tenant_id: str, project_id: str | None = None) -> Decimal:
        paid_statuses = {"paid", "confirmed"}
        stmt = select(Transaction).where(Transaction.tenant_id == tenant_id)
        if project_id is not None:
            stmt = stmt.where(Transaction.project_id == project_id)
        transactions = list(self.db.scalars(stmt).all())
        total = Decimal("0")
        for transaction in transactions:
            if transaction.status in paid_statuses:
                total += Decimal(transaction.net_amount)
        return total

    def list_invoices_by_tenant(self, tenant_id: str, limit: int = 50, offset: int = 0) -> list[Invoice]:
        stmt = (
            select(Invoice)
            .where(Invoice.tenant_id == tenant_id)
            .order_by(Invoice.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt).all())

    def apply_provider_status(
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
            invoice = self.db.scalar(
                select(Invoice).where(Invoice.provider_order_id == provider_order_id)
            )
        if invoice is None and merchant_order_id:
            invoice = self.db.scalar(
                select(Invoice).where(Invoice.merchant_order_id == merchant_order_id)
            )
        if invoice is None:
            raise ValueError("Инвойс по webhook-идентификаторам не найден.")

        transaction = self.db.scalar(
            select(Transaction).where(Transaction.invoice_id == invoice.id)
        )
        if transaction is None:
            raise ValueError("Транзакция для инвойса не найдена.")

        previous_status = invoice.status
        normalized_status = self._normalize_provider_status(provider_status)
        invoice.status = normalized_status

        stored_payload = dict(invoice.raw_provider_payload_json or {})
        stored_payload["last_webhook_status"] = provider_status
        if tx_hash:
            stored_payload["tx_hash"] = tx_hash
        if raw_payload:
            stored_payload["last_webhook_payload"] = raw_payload
        invoice.raw_provider_payload_json = stored_payload

        transaction.status = normalized_status
        self._apply_financial_state_transition(
            invoice=invoice,
            transaction=transaction,
            previous_status=previous_status,
            new_status=normalized_status,
        )

        if normalized_status in {"paid", "confirmed"}:
            transaction.paid_at = invoice.paid_at = transaction.paid_at or invoice.paid_at
            if transaction.paid_at is None:
                from datetime import datetime, timezone

                now = datetime.now(timezone.utc)
                transaction.paid_at = now
                invoice.paid_at = now

        if normalized_status == "confirmed":
            from datetime import datetime, timezone

            invoice.confirmed_at = invoice.confirmed_at or datetime.now(timezone.utc)

        event_service = EventService(self.db)
        event_service.create_event(
            invoice_id=invoice.id,
            event_type=f"invoice.{normalized_status}",
            source=source,
            payload=stored_payload,
            provider_event_id=provider_event_id,
        )
        project = self.db.get(Project, invoice.project_id)
        ClientWebhookService(event_service).deliver_invoice_update(
            project,
            invoice,
            transaction,
            event_name=f"invoice.{normalized_status}",
        )
        tenant_id = invoice.tenant_id
        invoice_id = invoice.id
        project_id = invoice.project_id
        invoice_snapshot = self._build_invoice_snapshot(invoice)
        self.db.add_all([invoice, transaction])
        try:
            self.db.commit()
        except Exception:
            logger.exception(
                "Invoice status DB commit failed for invoice_id=%s tenant_id=%s project_id=%s status=%s",
                invoice_id,
                tenant_id,
                project_id,
                normalized_status,
            )
            self.db.rollback()
            raise
        try:
            apply_db_security_context(self.db)
            refreshed_invoice = self.get_invoice(tenant_id, invoice_id, project_id=project_id)
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
        refreshed_invoice = self.get_invoice(tenant_id, invoice_id, project_id=project_id)
        if refreshed_invoice is not None:
            return refreshed_invoice
        logger.warning(
            "Invoice status committed, but reread returned no row. Returning snapshot for invoice_id=%s tenant_id=%s project_id=%s",
            invoice_id,
            tenant_id,
            project_id,
        )
        return invoice_snapshot

    def apply_invoice_status_by_id(
        self, invoice_id: str, provider_status: str, tx_hash: str | None = None
    ) -> Invoice:
        invoice = self.get_invoice_by_id(invoice_id)
        if invoice is None:
            raise ValueError("Инвойс не найден.")
        return self.apply_provider_status(
            invoice.provider_order_id,
            provider_status,
            tx_hash=tx_hash,
            source="manual",
        )

    def sync_invoice_status(
        self,
        tenant_id: str,
        invoice_id: str,
        project_id: str | None = None,
    ) -> Invoice:
        invoice = self.get_invoice(tenant_id, invoice_id, project_id=project_id)
        if invoice is None:
            raise ValueError("Инвойс не найден.")

        provider = get_payment_provider()
        provider_response = provider.get_invoice_status(invoice.merchant_order_id)
        item = provider_response.get("data", {}).get("item", {})
        provider_status = str(item.get("status") or invoice.status)
        provider_order_id = str(item.get("id") or invoice.provider_order_id)
        tx_hash = item.get("hash")
        return self.apply_provider_status(
            provider_order_id=provider_order_id,
            merchant_order_id=invoice.merchant_order_id,
            provider_status=provider_status,
            tx_hash=str(tx_hash) if tx_hash else None,
            source="sync",
            raw_payload=provider_response,
        )

    def _apply_financial_state_transition(
        self,
        invoice: Invoice,
        transaction: Transaction,
        previous_status: str,
        new_status: str,
    ) -> None:
        paid_like_statuses = {"paid", "confirmed"}
        if previous_status == new_status:
            return

        balance_service = BalanceService(self.db)
        balance = balance_service.get_or_create_balance(invoice.tenant_id, self.BALANCE_CURRENCY)

        if previous_status not in paid_like_statuses and new_status in paid_like_statuses:
            self._apply_initial_settlement(invoice, transaction, balance_service, balance)

        if previous_status == "paid" and new_status == "confirmed":
            self._release_pending_to_available(invoice, transaction, balance_service, balance)
        elif previous_status not in paid_like_statuses and new_status == "confirmed":
            self._release_pending_to_available(invoice, transaction, balance_service, balance)

    def _apply_initial_settlement(
        self,
        invoice: Invoice,
        transaction: Transaction,
        balance_service: BalanceService,
        balance,
    ) -> None:
        gross_amount = Decimal(invoice.amount_fiat).quantize(self.AMOUNT_PRECISION)
        provider_fee, platform_fee, turnover_fee, net_amount = self._calculate_financials(
            tenant_id=invoice.tenant_id,
            gross_amount=gross_amount,
        )

        transaction.gross_amount = gross_amount
        transaction.provider_fee = provider_fee
        transaction.platform_fee = platform_fee
        transaction.turnover_fee = turnover_fee
        transaction.net_amount = net_amount

        balance_service.apply_bucket_delta(balance, "provider_gross_amount", gross_amount)
        balance_service.apply_bucket_delta(balance, "pending_amount", net_amount)

        provider_percent = BillingPolicyService(self.db).get_provider_fee_percent()
        markup_percent = BillingPolicyService(self.db).get_effective_markup_percent(invoice.tenant_id)
        turnover_percent = BillingPolicyService(self.db).get_effective_turnover_fee_percent(
            invoice.tenant_id
        )

        balance_service.add_ledger_entry(
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
        balance_service.add_ledger_entry(
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
        balance_service.add_ledger_entry(
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
        balance_service.add_ledger_entry(
            tenant_id=invoice.tenant_id,
            currency=self.BALANCE_CURRENCY,
            amount=turnover_fee,
            direction="debit",
            balance_bucket="pending_amount",
            entry_type="invoice.turnover_fee",
            invoice_id=invoice.id,
            transaction_id=transaction.id,
            description="Удержание комиссии платформы от оборота.",
            metadata_json={"percent": str(turnover_percent)},
        )

    def _release_pending_to_available(
        self,
        invoice: Invoice,
        transaction: Transaction,
        balance_service: BalanceService,
        balance,
    ) -> None:
        net_amount = Decimal(transaction.net_amount).quantize(self.AMOUNT_PRECISION)
        if net_amount <= 0:
            return

        balance_service.apply_bucket_delta(balance, "pending_amount", -net_amount)
        balance_service.apply_bucket_delta(balance, "available_amount", net_amount)

        balance_service.add_ledger_entry(
            tenant_id=invoice.tenant_id,
            currency=self.BALANCE_CURRENCY,
            amount=net_amount,
            direction="debit",
            balance_bucket="pending_amount",
            entry_type="invoice.pending_release",
            invoice_id=invoice.id,
            transaction_id=transaction.id,
            description="Списание суммы из pending после подтверждения.",
        )
        balance_service.add_ledger_entry(
            tenant_id=invoice.tenant_id,
            currency=self.BALANCE_CURRENCY,
            amount=net_amount,
            direction="credit",
            balance_bucket="available_amount",
            entry_type="invoice.available_credit",
            invoice_id=invoice.id,
            transaction_id=transaction.id,
            description="Зачисление суммы в доступный баланс клиента.",
        )

    def _calculate_financials(
        self,
        tenant_id: str,
        gross_amount: Decimal,
    ) -> tuple[Decimal, Decimal, Decimal, Decimal]:
        billing_policy_service = BillingPolicyService(self.db)
        provider_fee_percent = billing_policy_service.get_provider_fee_percent()
        markup_percent = billing_policy_service.get_effective_markup_percent(tenant_id)
        turnover_fee_percent = billing_policy_service.get_effective_turnover_fee_percent(tenant_id)

        # Sequential fee overlay:
        # provider fee -> platform markup -> turnover fee.
        provider_fee = self._calculate_percent_amount(gross_amount, provider_fee_percent)
        after_provider = (gross_amount - provider_fee).quantize(self.AMOUNT_PRECISION)

        platform_fee = self._calculate_percent_amount(after_provider, markup_percent)
        after_platform = (after_provider - platform_fee).quantize(self.AMOUNT_PRECISION)

        turnover_fee = self._calculate_percent_amount(after_platform, turnover_fee_percent)
        net_amount = (after_platform - turnover_fee).quantize(self.AMOUNT_PRECISION)
        if net_amount < Decimal("0"):
            raise ValueError("Чистая сумма клиента не может быть отрицательной.")
        return provider_fee, platform_fee, turnover_fee, net_amount

    def _calculate_percent_amount(self, base_amount: Decimal, percent: Decimal) -> Decimal:
        return ((base_amount * percent) / Decimal("100")).quantize(self.AMOUNT_PRECISION)

    def _assert_amount_within_payin_limits(
        self,
        *,
        amount: Decimal,
        currency: str,
        network: str,
        min_amount: Decimal | None,
        max_amount: Decimal | None,
    ) -> None:
        if min_amount is not None and amount < min_amount:
            raise InvoiceAmountOutOfRangeError(
                amount=amount,
                currency=currency,
                network=network,
                min_amount=min_amount,
                max_amount=max_amount,
            )
        if max_amount is not None and amount > max_amount:
            raise InvoiceAmountOutOfRangeError(
                amount=amount,
                currency=currency,
                network=network,
                min_amount=min_amount,
                max_amount=max_amount,
            )

    @staticmethod
    def _normalize_provider_status(provider_status: str) -> str:
        normalized = provider_status.strip().lower()
        status_map = {
            "pending": "pending",
            "queued": "pending",
            "new": "pending",
            "waiting": "paid",
            "paid": "paid",
            "underpaid": "failed",
            "overpaid": "paid",
            "confirmed": "confirmed",
            "confirming": "paid",
            "expired": "expired",
            "cancelled": "failed",
            "canceled": "failed",
            "currencymismatch": "failed",
            "canceledbutpaid": "paid",
            "canceledbutoverpaid": "paid",
            "canceledbutunderpaid": "failed",
            "failed": "failed",
            "declined": "failed",
            "completed": "confirmed",
            "deposit_received": "paid",
        }
        if normalized not in status_map:
            raise ValueError("Неизвестный статус провайдера.")
        return status_map[normalized]

