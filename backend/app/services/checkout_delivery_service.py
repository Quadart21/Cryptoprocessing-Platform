from dataclasses import dataclass

CHECKOUT_DELIVERY_PAYMENT_PAGE = "payment_page"
CHECKOUT_DELIVERY_H2H = "h2h"
CHECKOUT_DELIVERY_BOTH = "both"

CHECKOUT_DELIVERY_CHOICES = frozenset(
    {
        CHECKOUT_DELIVERY_PAYMENT_PAGE,
        CHECKOUT_DELIVERY_H2H,
        CHECKOUT_DELIVERY_BOTH,
    }
)


@dataclass(frozen=True)
class CheckoutPaymentFields:
    payment_page_url: str | None
    payment_address: str | None
    qr_url: str | None
    checkout_delivery: str


class CheckoutDeliveryService:
    @staticmethod
    def normalize(mode: str | None) -> str:
        normalized = (mode or CHECKOUT_DELIVERY_PAYMENT_PAGE).strip().lower()
        if normalized == CHECKOUT_DELIVERY_BOTH:
            return CHECKOUT_DELIVERY_PAYMENT_PAGE
        if normalized not in CHECKOUT_DELIVERY_CHOICES:
            raise ValueError(
                "checkout_delivery должен быть одним из: payment_page, h2h, both."
            )
        return normalized

    @classmethod
    def apply(
        cls,
        mode: str | None,
        *,
        payment_page_url: str | None,
        payment_address: str,
        qr_url: str | None,
    ) -> CheckoutPaymentFields:
        delivery = cls.normalize(mode)
        if delivery == CHECKOUT_DELIVERY_PAYMENT_PAGE:
            return CheckoutPaymentFields(
                payment_page_url=payment_page_url,
                payment_address=None,
                qr_url=None,
                checkout_delivery=delivery,
            )
        if delivery == CHECKOUT_DELIVERY_H2H:
            return CheckoutPaymentFields(
                payment_page_url=None,
                payment_address=payment_address,
                qr_url=qr_url,
                checkout_delivery=delivery,
            )
        return CheckoutPaymentFields(
            payment_page_url=payment_page_url,
            payment_address=payment_address,
            qr_url=qr_url,
            checkout_delivery=delivery,
        )
