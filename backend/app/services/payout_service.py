from datetime import datetime, timezone
from decimal import Decimal
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.payout_request import PayoutRequest
from app.models.project import Project
from app.services.balance_service import BalanceService
from app.services.billing_policy_service import BillingPolicyService


class PayoutService:
    BALANCE_CURRENCY = "USDT"
    BALANCE_NETWORK = "TRC20"
    AMOUNT_PRECISION = Decimal("0.00000001")

    def __init__(self, db: Session):
        self.db = db
        self.balance_service = BalanceService(db)
        self.billing_service = BillingPolicyService(db)

    def create_request(
        self,
        *,
        tenant_id: str,
        requested_by_user_id: str | None,
        project_id: str | None,
        destination_address: str,
        amount: Decimal,
        note: str | None,
    ) -> PayoutRequest:
        self._ensure_payouts_enabled(tenant_id)
        self._validate_trc20_address(destination_address)
        self._validate_project_ownership(tenant_id, project_id)

        normalized_amount = self._normalize_amount(amount)
        balance = self.balance_service.get_or_create_balance(tenant_id, self.BALANCE_CURRENCY)
        available_amount = Decimal(balance.available_amount).quantize(self.AMOUNT_PRECISION)
        if normalized_amount > available_amount:
            raise ValueError(
                f"Недостаточно доступного баланса. Доступно: {available_amount} {self.BALANCE_CURRENCY}."
            )

        self.balance_service.apply_bucket_delta(balance, "available_amount", -normalized_amount)
        self.balance_service.apply_bucket_delta(balance, "locked_amount", normalized_amount)

        payout = PayoutRequest(
            tenant_id=tenant_id,
            project_id=project_id,
            requested_by_user_id=requested_by_user_id,
            destination_address=destination_address,
            network=self.BALANCE_NETWORK,
            currency=self.BALANCE_CURRENCY,
            amount_requested=normalized_amount,
            status="pending_review",
            review_comment=note,
        )
        self.db.add(payout)
        self.db.flush()

        self.balance_service.add_ledger_entry(
            tenant_id=tenant_id,
            currency=self.BALANCE_CURRENCY,
            amount=normalized_amount,
            direction="debit",
            balance_bucket="available_amount",
            entry_type="payout.request_lock",
            payout_request_id=payout.id,
            description="Блокировка суммы по запросу на вывод.",
        )
        self.balance_service.add_ledger_entry(
            tenant_id=tenant_id,
            currency=self.BALANCE_CURRENCY,
            amount=normalized_amount,
            direction="credit",
            balance_bucket="locked_amount",
            entry_type="payout.request_locked",
            payout_request_id=payout.id,
            description="Перевод суммы в locked до решения администратора.",
        )
        self.db.commit()
        self.db.refresh(payout)
        return payout

    def list_by_tenant(self, tenant_id: str) -> list[PayoutRequest]:
        stmt = (
            select(PayoutRequest)
            .where(PayoutRequest.tenant_id == tenant_id)
            .order_by(PayoutRequest.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def list_all(self, limit: int = 200) -> list[PayoutRequest]:
        stmt = select(PayoutRequest).order_by(PayoutRequest.created_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def review_request(
        self,
        *,
        payout_request_id: str,
        reviewer_user_id: str,
        action: str,
        review_comment: str | None,
        external_payout_id: str | None,
        amount_approved: Decimal | None,
    ) -> PayoutRequest:
        payout = self.db.get(PayoutRequest, payout_request_id)
        if payout is None:
            raise ValueError("Запрос на вывод не найден.")
        if payout.status != "pending_review":
            raise ValueError("Этот запрос уже обработан.")
        if action not in {"approve", "reject"}:
            raise ValueError("Некорректное действие по выводу.")

        requested = self._normalize_amount(Decimal(payout.amount_requested))
        approved = self._normalize_amount(amount_approved) if amount_approved is not None else requested
        balance = self.balance_service.get_or_create_balance(
            payout.tenant_id, self.BALANCE_CURRENCY
        )
        locked_amount = Decimal(balance.locked_amount).quantize(self.AMOUNT_PRECISION)
        if requested > locked_amount:
            raise ValueError("Недостаточно заблокированной суммы для обработки выплаты.")

        payout.reviewed_by_user_id = reviewer_user_id
        payout.review_comment = review_comment
        payout.external_payout_id = external_payout_id
        payout.processed_at = datetime.now(timezone.utc)

        if action == "approve":
            if approved <= Decimal("0"):
                raise ValueError("Сумма одобренного вывода должна быть больше нуля.")
            if approved > requested:
                raise ValueError("Сумма одобрения не может быть больше суммы запроса.")

            release_back = (requested - approved).quantize(self.AMOUNT_PRECISION)
            self.balance_service.apply_bucket_delta(balance, "locked_amount", -requested)
            if approved > 0:
                self.balance_service.apply_bucket_delta(balance, "withdrawn_amount", approved)
            if release_back > 0:
                self.balance_service.apply_bucket_delta(balance, "available_amount", release_back)

            self.balance_service.add_ledger_entry(
                tenant_id=payout.tenant_id,
                currency=self.BALANCE_CURRENCY,
                amount=requested,
                direction="debit",
                balance_bucket="locked_amount",
                entry_type="payout.approved_lock_release",
                payout_request_id=payout.id,
                description="Списание заблокированной суммы после одобрения выплаты.",
            )
            if approved > 0:
                self.balance_service.add_ledger_entry(
                    tenant_id=payout.tenant_id,
                    currency=self.BALANCE_CURRENCY,
                    amount=approved,
                    direction="credit",
                    balance_bucket="withdrawn_amount",
                    entry_type="payout.withdrawn",
                    payout_request_id=payout.id,
                    description="Вывод средств клиенту после одобрения.",
                    metadata_json={"external_payout_id": external_payout_id},
                )
            if release_back > 0:
                self.balance_service.add_ledger_entry(
                    tenant_id=payout.tenant_id,
                    currency=self.BALANCE_CURRENCY,
                    amount=release_back,
                    direction="credit",
                    balance_bucket="available_amount",
                    entry_type="payout.partial_release",
                    payout_request_id=payout.id,
                    description="Возврат неиспользованной части запроса в доступный баланс.",
                )

            payout.amount_approved = approved
            payout.status = "processed"
        else:
            self.balance_service.apply_bucket_delta(balance, "locked_amount", -requested)
            self.balance_service.apply_bucket_delta(balance, "available_amount", requested)
            self.balance_service.add_ledger_entry(
                tenant_id=payout.tenant_id,
                currency=self.BALANCE_CURRENCY,
                amount=requested,
                direction="debit",
                balance_bucket="locked_amount",
                entry_type="payout.rejected_lock_release",
                payout_request_id=payout.id,
                description="Снятие блокировки после отклонения запроса на вывод.",
            )
            self.balance_service.add_ledger_entry(
                tenant_id=payout.tenant_id,
                currency=self.BALANCE_CURRENCY,
                amount=requested,
                direction="credit",
                balance_bucket="available_amount",
                entry_type="payout.rejected_return",
                payout_request_id=payout.id,
                description="Возврат суммы в доступный баланс после отклонения запроса.",
            )
            payout.amount_approved = None
            payout.status = "rejected"

        self.db.add(payout)
        self.db.commit()
        self.db.refresh(payout)
        return payout

    def _ensure_payouts_enabled(self, tenant_id: str) -> None:
        settings = self.billing_service.get_platform_settings()
        if not settings.payouts_enabled:
            raise ValueError("Выводы временно отключены на уровне платформы.")

        policy = self.billing_service.get_or_create_tenant_policy(tenant_id)
        if not policy.payouts_enabled:
            raise ValueError("Для вашего аккаунта выводы отключены администратором.")

    def _validate_trc20_address(self, value: str) -> None:
        address = value.strip()
        if not re.fullmatch(r"T[1-9A-HJ-NP-Za-km-z]{25,45}", address):
            raise ValueError("Укажите корректный адрес USDT TRC20 (начинается с T).")

    def _validate_project_ownership(self, tenant_id: str, project_id: str | None) -> None:
        if project_id is None:
            return
        project = self.db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.tenant_id == tenant_id,
            )
        )
        if project is None:
            raise ValueError("Проект для вывода не найден или недоступен.")

    def _normalize_amount(self, amount: Decimal) -> Decimal:
        return Decimal(amount).quantize(self.AMOUNT_PRECISION)

