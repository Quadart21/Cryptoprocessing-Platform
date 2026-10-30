import { useState } from "react";

import type { ProviderEventItem } from "../../api";
import {
  formatEventDateTime,
  formatEventRelative,
  providerEventOutcomeTone,
  providerEventSourceLabel,
  providerEventStatusLabel,
  providerEventStatusTone,
  providerEventTypeLabel,
  providerStatusShortLabel,
  truncateId,
  type EventTone,
} from "../../utils/providerEventLabels";

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

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function toneModifier(prefix: string, tone: EventTone): string {
  return `${prefix}--${tone}`;
}

type ProviderEventRowProps = {
  event: ProviderEventItem;
  compact?: boolean;
};

export function ProviderEventRow({ event, compact = false }: ProviderEventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const providerStatus = readProviderStatus(event.payload_json);
  const effectiveStatus = readEffectiveStatus(event.payload_json);
  const displayPayload = eventPayloadForDisplay(event.payload_json);
  const title = providerEventTypeLabel(event.event_type);
  const outcomeTone = providerEventOutcomeTone({
    status: event.status,
    eventType: event.event_type,
    providerStatus,
    effectiveStatus,
  });
  const statusTone = providerEventStatusTone(event.status);
  const absoluteTime = formatEventDateTime(event.created_at);
  const relativeTime = formatEventRelative(event.created_at);

  async function handleCopy(label: string, value: string) {
    const ok = await copyText(value);
    if (ok) {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    }
  }

  return (
    <article
      className={[
        "provider-event-card",
        toneModifier("provider-event-card", outcomeTone),
        compact ? "provider-event-card--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="provider-event-card__top">
        <div className="provider-event-card__main">
          <div className="provider-event-card__title-row">
            <strong className="provider-event-card__title">{title}</strong>
            <span className="provider-event-card__code" title={event.event_type}>
              {event.event_type}
            </span>
          </div>
          <p className="provider-event-card__meta">
            <time dateTime={event.created_at ?? undefined} title={absoluteTime}>
              {relativeTime || absoluteTime}
            </time>
            <span className="provider-event-card__dot" aria-hidden="true">
              ·
            </span>
            <span className={`provider-event-source ${toneModifier("provider-event-source", "info")}`}>
              {providerEventSourceLabel(event.source)}
            </span>
            {!compact && event.invoice_id ? (
              <>
                <span className="provider-event-card__dot" aria-hidden="true">
                  ·
                </span>
                <button
                  className="provider-event-card__id-btn"
                  onClick={() => void handleCopy("invoice", event.invoice_id)}
                  title={event.invoice_id}
                  type="button"
                >
                  Инвойс {truncateId(event.invoice_id)}
                  {copied === "invoice" ? " ✓" : ""}
                </button>
              </>
            ) : null}
          </p>
          {(providerStatus || effectiveStatus) && !compact ? (
            <p className="provider-event-card__status-line">
              {providerStatus ? (
                <span>
                  Crypto-Cash: <strong>{providerStatusShortLabel(providerStatus)}</strong>
                  <span className="provider-event-card__raw"> ({providerStatus})</span>
                </span>
              ) : null}
              {effectiveStatus && effectiveStatus !== providerStatus ? (
                <span>
                  {providerStatus ? " → " : null}
                  Платформа: <strong>{providerStatusShortLabel(effectiveStatus)}</strong>
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="provider-event-card__aside">
          <span className={`provider-event-pill ${toneModifier("provider-event-pill", statusTone)}`}>
            {providerEventStatusLabel(event.status)}
          </span>
          {displayPayload || event.provider_event_id ? (
            <button
              className="ghost-button provider-event-card__details-btn"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded ? "Скрыть" : "Детали"}
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="provider-event-card__details">
          <dl className="provider-event-card__facts">
            <div>
              <dt>Время</dt>
              <dd>{absoluteTime}</dd>
            </div>
            {event.invoice_id ? (
              <div>
                <dt>Инвойс</dt>
                <dd>
                  <button
                    className="provider-event-card__id-btn"
                    onClick={() => void handleCopy("invoice-full", event.invoice_id)}
                    type="button"
                  >
                    {event.invoice_id}
                    {copied === "invoice-full" ? " ✓" : ""}
                  </button>
                </dd>
              </div>
            ) : null}
            {event.provider_event_id ? (
              <div>
                <dt>ID события провайдера</dt>
                <dd>
                  <button
                    className="provider-event-card__id-btn"
                    onClick={() => void handleCopy("event", event.provider_event_id)}
                    type="button"
                  >
                    {event.provider_event_id}
                    {copied === "event" ? " ✓" : ""}
                  </button>
                </dd>
              </div>
            ) : null}
            {event.provider_name ? (
              <div>
                <dt>Провайдер</dt>
                <dd>{event.provider_name}</dd>
              </div>
            ) : null}
            {event.processed_at ? (
              <div>
                <dt>Обработано</dt>
                <dd>{formatEventDateTime(event.processed_at)}</dd>
              </div>
            ) : null}
          </dl>
          {displayPayload ? (
            <pre className="json-box provider-event-card__payload">{JSON.stringify(displayPayload, null, 2)}</pre>
          ) : null}
        </div>
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
  className = "provider-event-list",
}: ProviderEventListProps) {
  if (events.length === 0) {
    return (
      <div className="provider-event-empty">
        <p className="muted-text">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className={className}>
      {events.map((event) => (
        <ProviderEventRow compact={compact} event={event} key={event.id} />
      ))}
    </div>
  );
}
