from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.services.statistics_exclusion_service import StatisticsExclusionService


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_tenant(self, tenant_id: str, project_id: str | None = None, limit: int = 50, offset: int = 0) -> list[Transaction]:
        stmt = select(Transaction).where(Transaction.tenant_id == tenant_id)
        if project_id is not None:
            stmt = stmt.where(Transaction.project_id == project_id)
        stmt = stmt.order_by(Transaction.created_at.desc()).limit(limit).offset(offset)
        return list((await self.db.scalars(stmt)).all())

    async def get_by_id(self, transaction_id: str) -> Transaction | None:
        return await self.db.get(Transaction, transaction_id)

    async def get_latest_for_invoice(self, invoice_id: str) -> Transaction | None:
        stmt = (
            select(Transaction)
            .where(Transaction.invoice_id == invoice_id)
            .order_by(Transaction.created_at.desc())
            .limit(1)
        )
        return await self.db.scalar(stmt)

    async def list_all(self, limit: int = 50, offset: int = 0) -> list[Transaction]:
        stmt = select(Transaction).order_by(Transaction.created_at.desc()).limit(limit).offset(offset)
        excluded = await StatisticsExclusionService(self.db).excluded_tenant_ids()
        if excluded:
            stmt = stmt.where(Transaction.tenant_id.not_in(excluded))
        return list((await self.db.scalars(stmt)).all())
