import { useState } from "react";

import type { ProviderEventItem } from "../../api";

function formatEventDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function readProviderStatus(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }
  const direct = payload.provider_status ?? payload.last_webhook_status;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }
  const nested = payload.raw_payload ?? payload.last_webhook_payload;
  if (!nested || typeof nested !== "object") {
    return null;
  }
  const record = nested as Record<string, unknown>;
  if (typeof record.status === "string" && record.status.trim()) {
    return record.status;
  }
  const event = record.event;
  if (!event || typeof event !== "object") {
    return null;
  }
  const data = (event as Record<string, unknown>).data;
  if (!data || typeof data !== "object") {
    return null;
  }
  const status = (data as Record<string, unknown>).status;
  return typeof status === "string" && status.trim() ? status : null;
}

function readEffectiveStatus(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }
  const value = payload.effective_status;
  return typeof value === "string" && value.trim() ? value : null;
}

function eventPayloadForDisplay(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!payload) {
    return null;
  }
  const raw = payload.raw_payload ?? payload.last_webhook_payload;
  if (raw && typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return payload;
}

type ProviderEventRowProps = {
  event: ProviderEventItem;
  compact?: boolean;
};

export function ProviderEventRow({ event, compact = false }: ProviderEventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const providerStatus = readProviderStatus(event.payload_json);
  const effectiveStatus = readEffectiveStatus(event.payload_json);
  const displayPayload = eventPayloadForDisplay(event.payload_json);

  return (
    <article className={`tenant-card provider-event-row${compact ? " provider-event-row--compact" : ""}`}>
      <div className="provider-event-row__main">
        <strong>{event.event_type}</strong>
        <p className="provider-event-row__meta-line">
          {formatEventDateTime(event.created_at)}
          {event.source ? ` · ${event.source}` : null}
          {providerStatus ? ` · Crypto-Cash: ${providerStatus}` : null}
          {effectiveStatus && effectiveStatus !== providerStatus ? ` → ${effectiveStatus}` : null}
        </p>
        {!compact ? <p className="muted-text">Invoice: {event.invoice_id}</p> : null}
        {event.provider_event_id ? (
          <p className="muted-text provider-event-row__event-id">event_id: {event.provider_event_id}</p>
        ) : null}
      </div>
      <div className="tenant-meta provider-event-row__actions">
        <span>{event.status}</span>
        {displayPayload ? (
          <button className="ghost-button" onClick={() => setExpanded((value) => !value)} type="button">
            {expanded ? "Скрыть payload" : "Payload"}
          </button>
        ) : null}
      </div>
      {expanded && displayPayload ? (
        <pre className="json-box provider-event-row__payload">{JSON.stringify(displayPayload, null, 2)}</pre>
      ) : null}
    </article>
  );
}

type ProviderEventListProps = {
  events: ProviderEventItem[];
  compact?: boolean;
  emptyLabel?: string;
  className?: string;
};

export function ProviderEventList({
  events,
  compact = false,
  emptyLabel = "Событий пока нет.",
  className = "tenant-list compact-list",
}: ProviderEventListProps) {
  if (events.length === 0) {
    return <p className="muted-text">{emptyLabel}</p>;
  }
  return (
    <div className={className}>
      {events.map((event) => (
        <ProviderEventRow compact={compact} event={event} key={event.id} />
      ))}
    </div>
  );
}
