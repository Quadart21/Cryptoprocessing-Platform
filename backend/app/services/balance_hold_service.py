from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.ledger_entry import LedgerEntry
from app.models.transaction import Transaction
from app.services.balance_service import BalanceService


class BalanceHoldService:
    AMOUNT_PRECISION = Decimal("0.00000001")
    FROZEN_CREDIT_ENTRY = "invoice.frozen_credit"
    AVAILABLE_CREDIT_ENTRY = "invoice.available_credit"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.balance_service = BalanceService(db)

    @classmethod
    def hold_duration(cls) -> timedelta:
        hours = max(int(settings.balance_hold_hours), 1)
        return timedelta(hours=hours)

    async def has_ledger_entry(self, transaction_id: str, entry_type: str) -> bool:
        return bool(
            await self.db.scalar(
                select(
                    exists().where(
                        LedgerEntry.transaction_id == transaction_id,
                        LedgerEntry.entry_type == entry_type,
                    )
                )
            )
        )

    async def resolve_net_bucket(self, transaction: Transaction) -> str:
        if await self.has_ledger_entry(transaction.id, self.AVAILABLE_CREDIT_ENTRY):
            return "available_amount"
        if await self.has_ledger_entry(transaction.id, self.FROZEN_CREDIT_ENTRY):
            return "frozen_amount"
        return "pending_amount"

    async def freeze_confirmed_settlement(
        self,
        invoice: Invoice,
        transaction: Transaction,
        balance,
    ) -> None:
        if await self.has_ledger_entry(transaction.id, self.FROZEN_CREDIT_ENTRY):
            return
        if await self.has_ledger_entry(transaction.id, self.AVAILABLE_CREDIT_ENTRY):
            return

        net_amount = Decimal(transaction.net_amount).quantize(self.AMOUNT_PRECISION)
        if net_amount <= 0:
            return

        now = datetime.now(timezone.utc)
        available_at = now + self.hold_duration()
        transaction.balance_available_at = available_at
        transaction.balance_released_at = None
        self.db.add(transaction)

        await self.balance_service.apply_bucket_delta(balance, "pending_amount", -net_amount)
        await self.balance_service.apply_bucket_delta(balance, "frozen_amount", net_amount)

        await self.balance_service.add_ledger_entry(
            tenant_id=invoice.tenant_id,
            currency=transaction.currency,
            amount=net_amount,
            direction="debit",
            balance_bucket="pending_amount",
            entry_type="invoice.pending_release",
            invoice_id=invoice.id,
            transaction_id=transaction.id,
            description="Списание суммы из pending после подтверждения оплаты.",
        )
        await self.balance_service.add_ledger_entry(
            tenant_id=invoice.tenant_id,
            currency=transaction.currency,
            amount=net_amount,
            direction="credit",
            balance_bucket="frozen_amount",
            entry_type=self.FROZEN_CREDIT_ENTRY,
            invoice_id=invoice.id,
            transaction_id=transaction.id,
            description="Заморозка средств на период удержания перед выводом.",
            metadata_json={"available_at": available_at.isoformat()},
        )

    async def release_matured_holds(self, tenant_id: str | None = None) -> int:
        now = datetime.now(timezone.utc)
        query = (
            select(Transaction)
            .where(
                Transaction.balance_available_at.is_not(None),
                Transaction.balance_available_at <= now,
                Transaction.balance_released_at.is_(None),
            )
            .order_by(Transaction.balance_available_at.asc())
        )
        if tenant_id is not None:
            query = query.where(Transaction.tenant_id == tenant_id)

        transactions = list((await self.db.scalars(query)).all())
        released_count = 0
        for transaction in transactions:
            if not await self.has_ledger_entry(transaction.id, self.FROZEN_CREDIT_ENTRY):
                continue
            if await self.has_ledger_entry(transaction.id, self.AVAILABLE_CREDIT_ENTRY):
                transaction.balance_released_at = now
                self.db.add(transaction)
                continue

            invoice = await self.db.scalar(select(Invoice).where(Invoice.id == transaction.invoice_id))
            if invoice is None:
                continue

            net_amount = Decimal(transaction.net_amount).quantize(self.AMOUNT_PRECISION)
            if net_amount <= 0:
                continue

            balance = await self.balance_service.get_or_create_balance(
                transaction.tenant_id,
                transaction.currency,
            )
            await self.balance_service.apply_bucket_delta(balance, "frozen_amount", -net_amount)
            await self.balance_service.apply_bucket_delta(balance, "available_amount", net_amount)

            await self.balance_service.add_ledger_entry(
                tenant_id=transaction.tenant_id,
                currency=transaction.currency,
                amount=net_amount,
                direction="debit",
                balance_bucket="frozen_amount",
                entry_type="invoice.frozen_release",
                invoice_id=invoice.id,
                transaction_id=transaction.id,
                description="Разморозка средств после периода удержания.",
            )
            await self.balance_service.add_ledger_entry(
                tenant_id=transaction.tenant_id,
                currency=transaction.currency,
                amount=net_amount,
                direction="credit",
                balance_bucket="available_amount",
                entry_type=self.AVAILABLE_CREDIT_ENTRY,
                invoice_id=invoice.id,
                transaction_id=transaction.id,
                description="Зачисление суммы в доступный баланс клиента.",
            )

            transaction.balance_released_at = now
            self.db.add(transaction)
            released_count += 1

        if released_count:
            await self.db.flush()
        return released_count

    async def list_active_holds(self, tenant_id: str) -> list[tuple[Transaction, Invoice]]:
        query = (
            select(Transaction, Invoice)
            .join(Invoice, Invoice.id == Transaction.invoice_id)
            .where(
                Transaction.tenant_id == tenant_id,
                Transaction.balance_available_at.is_not(None),
                Transaction.balance_released_at.is_(None),
            )
            .order_by(Transaction.balance_available_at.asc())
        )
        rows = (await self.db.execute(query)).all()
        active: list[tuple[Transaction, Invoice]] = []
        for transaction, invoice in rows:
            if not await self.has_ledger_entry(transaction.id, self.FROZEN_CREDIT_ENTRY):
                continue
            if await self.has_ledger_entry(transaction.id, self.AVAILABLE_CREDIT_ENTRY):
                continue
            active.append((transaction, invoice))
        return active
