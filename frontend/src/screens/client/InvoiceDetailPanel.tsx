import type { InvoiceItem } from "../../api";
import { formatDecimal } from "../../utils/format";
import { isStableCoinFiatPair } from "../../utils/invoiceAccounting";

type InvoiceDetailPanelProps = {
  selectedClientInvoiceDetail: InvoiceItem | null;
};

export function InvoiceDetailPanel({ selectedClientInvoiceDetail }: InvoiceDetailPanelProps) {
  return (
    <article className="panel panel-span-2">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Карточка платежа</p>
          <h2>Детали инвойса</h2>
        </div>
      </div>
      {selectedClientInvoiceDetail ? (
        <div className="detail-stack">
          <div className="detail-summary">
            <div className="detail-chip">
              <span>Статус</span>
              <strong>{selectedClientInvoiceDetail.status}</strong>
            </div>
            <div className="detail-chip">
              <span>Сумма к оплате</span>
              <strong>
                {formatDecimal(selectedClientInvoiceDetail.amount_crypto)}{" "}
                {selectedClientInvoiceDetail.crypto_currency}
              </strong>
            </div>
            {isStableCoinFiatPair(
              selectedClientInvoiceDetail.crypto_currency,
              selectedClientInvoiceDetail.fiat_currency,
            ) ? (
              <div className="detail-chip">
                <span>В валюте заказа</span>
                <strong>
                  {formatDecimal(selectedClientInvoiceDetail.amount_fiat)}{" "}
                  {selectedClientInvoiceDetail.fiat_currency}
                </strong>
              </div>
            ) : null}
            <div className="detail-chip">
              <span>Сеть</span>
              <strong>{selectedClientInvoiceDetail.network}</strong>
            </div>
          </div>
          <div className="result-box">
            <p>
              Order ID:{" "}
              <code className="inline-tech-value">{selectedClientInvoiceDetail.merchant_order_id}</code>
            </p>
            <p>
              Provider order:{" "}
              <code className="inline-tech-value">{selectedClientInvoiceDetail.provider_order_id}</code>
            </p>
            <p>
              Адрес оплаты:{" "}
              <code className="inline-tech-value">{selectedClientInvoiceDetail.payment_address}</code>
            </p>
            <p>
              Срок действия:{" "}
              <code className="inline-tech-value">{selectedClientInvoiceDetail.expires_at}</code>
            </p>
            <p>Создан: {selectedClientInvoiceDetail.created_at}</p>
            {selectedClientInvoiceDetail.qr_url ? (
              <p>
                QR URL:{" "}
                <a
                  className="text-link"
                  href={selectedClientInvoiceDetail.qr_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  открыть QR
                </a>
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="muted-text">Выберите инвойс, чтобы открыть его карточку.</p>
      )}
    </article>
  );
}
