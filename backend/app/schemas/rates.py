from pydantic import BaseModel


class RateNetworkResponse(BaseModel):
    network: str
    ticker: str | None = None
    min_deposit: str | None = None
    max_deposit: str | None = None
    min_withdraw: str | None = None
    max_withdraw: str | None = None
    network_fee: str | None = None
    availability: bool = True
    provider_availability: bool = True
    platform_enabled: bool = True
    client_available: bool = True
    availability_reason: str | None = None
    acquiring: bool = True
    withdrawal: bool = True
    memo_required: bool = False


class RateItemResponse(BaseModel):
    currency: str
    networks: list[RateNetworkResponse]


class RatesResponse(BaseModel):
    items: list[RateItemResponse]
