from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_earnings_withdrawal import PlatformEarningsWithdrawal
from app.models.user import User
from app.services.accounting_service import AccountingService


class PlatformEarningsService:
    CURRENCY = "USDT"

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def total_withdrawn(self) -> Decimal:
        total = await self.db.scalar(
            select(func.coalesce(func.sum(PlatformEarningsWithdrawal.amount), 0)).where(
                PlatformEarningsWithdrawal.currency == self.CURRENCY
            )
        )
        return Decimal(total or 0)

    async def list_withdrawals(self, *, limit: int = 100) -> list[dict]:
        rows = list(
            (
                await self.db.execute(
                    select(PlatformEarningsWithdrawal, User.email)
                    .outerjoin(User, User.id == PlatformEarningsWithdrawal.recorded_by_user_id)
                    .order_by(PlatformEarningsWithdrawal.withdrawn_at.desc())
                    .limit(limit)
                )
            ).all()
        )
        items: list[dict] = []
        for withdrawal, email in rows:
            items.append(
                {
                    "id": str(withdrawal.id),
                    "amount": withdrawal.amount,
                    "currency": withdrawal.currency,
                    "note": withdrawal.note,
                    "external_reference": withdrawal.external_reference,
                    "recorded_by_email": email,
                    "withdrawn_at": withdrawal.withdrawn_at,
                    "created_at": withdrawal.created_at,
                }
            )
        return items

    async def record_withdrawal(
        self,
        *,
        amount: Decimal,
        recorded_by_user_id: str,
        note: str | None = None,
        external_reference: str | None = None,
        withdrawn_at: datetime | None = None,
    ) -> PlatformEarningsWithdrawal:
        normalized_amount = Decimal(amount)
        if normalized_amount <= Decimal("0"):
            raise ValueError("Сумма вывода должна быть больше нуля.")

        summary = await AccountingService(self.db).build_summary(tenant_id=None)
        accrued = Decimal(summary.total_platform_revenue_amount)
        withdrawn_total = await self.total_withdrawn()
        outstanding = accrued - withdrawn_total
        if normalized_amount > outstanding:
            raise ValueError(
                f"Сумма превышает не выведенный остаток комиссии ({outstanding:.8f} {self.CURRENCY})."
            )

        entry = PlatformEarningsWithdrawal(
            amount=normalized_amount,
            currency=self.CURRENCY,
            note=(note or "").strip() or None,
            external_reference=(external_reference or "").strip() or None,
            recorded_by_user_id=recorded_by_user_id,
            withdrawn_at=withdrawn_at or datetime.now(timezone.utc),
        )
        self.db.add(entry)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(entry)
        AccountingService.invalidate_cache()
        return entry
