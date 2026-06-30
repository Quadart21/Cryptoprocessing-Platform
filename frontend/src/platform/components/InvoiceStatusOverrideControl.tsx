import { useState } from "react";

import {
  PLATFORM_INVOICE_STATUSES,
  invoiceCompactPillClass,
  invoiceStatusLabelRu,
} from "../../utils/invoiceStatus";

type InvoiceStatusOverrideControlProps = {
  currentStatus: string;
  disabled?: boolean;
  onApply: (status: string) => void;
};

export function InvoiceStatusOverrideControl({
  currentStatus,
  disabled = false,
  onApply,
}: InvoiceStatusOverrideControlProps) {
  const normalizedCurrent = currentStatus.trim().toLowerCase();
  const [selectedStatus, setSelectedStatus] = useState(
    PLATFORM_INVOICE_STATUSES.includes(normalizedCurrent as (typeof PLATFORM_INVOICE_STATUSES)[number])
      ? normalizedCurrent
      : PLATFORM_INVOICE_STATUSES[0],
  );

  return (
    <div className="pw-status-override">
      <label className="pw-status-override__label">
        <span>Статус (superadmin)</span>
        <select
          className="pw-status-override__select"
          disabled={disabled}
          onChange={(event) => setSelectedStatus(event.target.value)}
          value={selectedStatus}
        >
          {PLATFORM_INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {invoiceStatusLabelRu(status)}
            </option>
          ))}
        </select>
      </label>
      <span className={invoiceCompactPillClass(currentStatus)}>{invoiceStatusLabelRu(currentStatus)}</span>
      <button
        className="primary-button"
        disabled={disabled || selectedStatus === normalizedCurrent}
        onClick={() => onApply(selectedStatus)}
        type="button"
      >
        Применить статус
      </button>
    </div>
  );
}
