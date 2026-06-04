from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ledger_entry import LedgerEntry
from app.models.tenant_balance import TenantBalance


class BalanceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_balance(self, tenant_id: str, currency: str) -> TenantBalance:
        balance = await self.db.scalar(
            select(TenantBalance).where(
                TenantBalance.tenant_id == tenant_id,
                TenantBalance.currency == currency,
            )
        )
        if balance is None:
            normalized_currency = currency.upper()
            if normalized_currency == "USDT":
                legacy_balance = await self.db.scalar(
                    select(TenantBalance).where(
                        TenantBalance.tenant_id == tenant_id,
                        TenantBalance.currency == "USD",
                    )
                )
                if legacy_balance is not None:
                    balance = TenantBalance(
                        tenant_id=tenant_id,
                        currency=normalized_currency,
                        available_amount=Decimal(legacy_balance.available_amount),
                        pending_amount=Decimal(legacy_balance.pending_amount),
                        frozen_amount=Decimal(getattr(legacy_balance, "frozen_amount", 0) or 0),
                        locked_amount=Decimal(legacy_balance.locked_amount),
                        withdrawn_amount=Decimal(legacy_balance.withdrawn_amount),
                        provider_gross_amount=Decimal(legacy_balance.provider_gross_amount),
                        updated_balance_at=legacy_balance.updated_balance_at or datetime.now(timezone.utc),
                    )
                    self.db.add(balance)
                    await self.db.flush()
                    return balance

            balance = TenantBalance(
                tenant_id=tenant_id,
                currency=normalized_currency,
                available_amount=Decimal("0"),
                pending_amount=Decimal("0"),
                frozen_amount=Decimal("0"),
                locked_amount=Decimal("0"),
                withdrawn_amount=Decimal("0"),
                provider_gross_amount=Decimal("0"),
                updated_balance_at=datetime.now(timezone.utc),
            )
            self.db.add(balance)
            await self.db.flush()
        return balance

    async def apply_bucket_delta(
        self,
        balance: TenantBalance,
        bucket: str,
        delta: Decimal,
    ) -> TenantBalance:
        current_value = Decimal(getattr(balance, bucket))
        setattr(balance, bucket, current_value + delta)
        balance.updated_balance_at = datetime.now(timezone.utc)
        self.db.add(balance)
        await self.db.flush()
        return balance

    async def add_ledger_entry(
        self,
        tenant_id: str,
        currency: str,
        amount: Decimal,
        direction: str,
        balance_bucket: str,
        entry_type: str,
        invoice_id: str | None = None,
        transaction_id: str | None = None,
        payout_request_id: str | None = None,
        description: str | None = None,
        metadata_json: dict | None = None,
    ) -> LedgerEntry:
        entry = LedgerEntry(
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            transaction_id=transaction_id,
            payout_request_id=payout_request_id,
            currency=currency,
            amount=amount,
            direction=direction,
            balance_bucket=balance_bucket,
            entry_type=entry_type,
            description=description,
            metadata_json=metadata_json,
        )
        self.db.add(entry)
        await self.db.flush()
        return entry

