import { useEffect, useState } from "react";

import type { InvoiceItem, TransactionItem } from "../api";
import { formatMoneyAmount } from "../utils/format";

export type AnalyticsPeriod = "today" | "7d" | "30d" | "90d" | "all";

const PAGE_SIZE = 10;
const CHART_LIMIT = 28;

type UseClientAnalyticsParams = {
  transactions: TransactionItem[];
  /** Если передан — в оборот и KPI попадают только транзакции по инвойсам в статусе paid/confirmed. */
  invoices?: InvoiceItem[];
  currencyFallback: string;
};

export type ClientAnalyticsSummary = {
  turnover: string;
  net: string;
  fee: string;
  /** Net зачисление + комиссия платформы (platform_fee + turnover_fee) по оплаченным. */
  pureProfit: string;
  successRate: string;
  averageCheck: string;
  transactionCount: number;
  periodLabel: string;
};

type AnalyticsChartPoint = {
  label: string;
  primary: number;
  secondary: number;
};

type UseClientAnalyticsResult = {
  period: AnalyticsPeriod;
  setPeriod: (next: AnalyticsPeriod) => void;
  statusFilter: string;
  setStatusFilter: (next: string) => void;
  currencyFilter: string;
  setCurrencyFilter: (next: string) => void;
  searchTerm: string;
  setSearchTerm: (next: string) => void;
  page: number;
  setPage: (next: number) => void;
  totalPages: number;
  pageSize: number;
  statusOptions: string[];
  currencyOptions: string[];
  transactionsInPeriod: TransactionItem[];
  filteredTransactions: TransactionItem[];
  pagedTransactions: TransactionItem[];
  summary: ClientAnalyticsSummary;
  chartPoints: AnalyticsChartPoint[];
  chartCurrency: string;
};

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: "Сегодня",
  "7d": "7 дней",
  "30d": "30 дней",
  "90d": "90 дней",
  all: "Весь период",
};

function isPaidLikeInvoiceStatus(status: string): boolean {
  return status === "paid" || status === "confirmed";
}

function isPaidLikeTransactionStatus(status: string): boolean {
  return status === "paid" || status === "confirmed";
}

export function useClientAnalytics({
  transactions,
  invoices,
  currencyFallback,
}: UseClientAnalyticsParams): UseClientAnalyticsResult {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    setPage(1);
  }, [period, statusFilter, currencyFilter, searchTerm]);

  const sortedTransactions = [...transactions].sort((left, right) => {
    const leftDate = toDate(left.created_at)?.getTime() ?? 0;
    const rightDate = toDate(right.created_at)?.getTime() ?? 0;
    return rightDate - leftDate;
  });

  const periodStart = resolvePeriodStart(period);
  const transactionsInPeriod = sortedTransactions.filter((transaction) => {
    if (!periodStart) {
      return true;
    }
    const createdAt = toDate(transaction.created_at);
    return createdAt ? createdAt >= periodStart : false;
  });

  const statusOptions = uniqueValues(transactionsInPeriod.map((item) => item.status));
  const currencyOptions = uniqueValues(transactionsInPeriod.map((item) => item.currency));
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredTransactions = transactionsInPeriod.filter((transaction) => {
    if (statusFilter !== "all" && transaction.status !== statusFilter) {
      return false;
    }
    if (currencyFilter !== "all" && transaction.currency !== currencyFilter) {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    return (
      transaction.invoice_id.toLowerCase().includes(normalizedSearch) ||
      transaction.id.toLowerCase().includes(normalizedSearch)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const start = (Math.max(page, 1) - 1) * PAGE_SIZE;
  const pagedTransactions = filteredTransactions.slice(start, start + PAGE_SIZE);

  const paidInvoiceIds =
    invoices && invoices.length > 0
      ? new Set(invoices.filter((inv) => isPaidLikeInvoiceStatus(inv.status)).map((inv) => inv.id))
      : null;

  const transactionContributesToTurnover = (tx: TransactionItem) => {
    if (paidInvoiceIds && !paidInvoiceIds.has(tx.invoice_id)) {
      return false;
    }
    return isPaidLikeTransactionStatus(tx.status);
  };

  const chartCurrency = currencyFallback || transactionsInPeriod[0]?.currency || "USDT";
  const summary = buildSummary(transactionsInPeriod, period, chartCurrency, transactionContributesToTurnover);
  const chartPoints = buildChartPoints(transactionsInPeriod, period, transactionContributesToTurnover);

  return {
    period,
    setPeriod,
    statusFilter,
    setStatusFilter,
    currencyFilter,
    setCurrencyFilter,
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
    statusOptions,
    currencyOptions,
    transactionsInPeriod,
    filteredTransactions,
    pagedTransactions,
    summary,
    chartPoints,
    chartCurrency,
  };
}

function resolvePeriodStart(period: AnalyticsPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "today": {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    case "7d":
      return addDays(now, -7);
    case "30d":
      return addDays(now, -30);
    case "90d":
      return addDays(now, -90);
    case "all":
    default:
      return null;
  }
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toAmount(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAmount(value: number, currency: string): string {
  return formatMoneyAmount(value, currency, {
    minFractionDigits: 2,
    maxFractionDigits: 8,
  });
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("ru-RU");
}

function formatChartLabel(value: Date): string {
  return value.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildSummary(
  transactions: TransactionItem[],
  period: AnalyticsPeriod,
  currency: string,
  contributesToTurnover: (tx: TransactionItem) => boolean,
): ClientAnalyticsSummary {
  let turnover = 0;
  let net = 0;
  let fee = 0;
  let pureProfit = 0;
  let paidOrConfirmed = 0;

  for (const transaction of transactions) {
    if (!contributesToTurnover(transaction)) {
      continue;
    }
    turnover += toAmount(transaction.gross_amount);
    net += toAmount(transaction.net_amount);
    const totalFeeAmount = transaction.total_fee
      ? toAmount(transaction.total_fee)
      : toAmount(transaction.provider_fee ?? "0") +
        toAmount(transaction.platform_fee ?? "0") +
        toAmount(transaction.turnover_fee ?? "0");
    pureProfit += toAmount(transaction.net_amount);
    fee += totalFeeAmount;
    paidOrConfirmed += 1;
  }

  const transactionCount = transactions.length;
  const successRate = transactionCount ? (paidOrConfirmed / transactionCount) * 100 : 0;
  const averageCheck = paidOrConfirmed ? turnover / paidOrConfirmed : 0;

  const oldest = transactions[transactionCount - 1];
  const newest = transactions[0];
  const oldestDate = toDate(oldest?.created_at ?? null);
  const newestDate = toDate(newest?.created_at ?? null);
  const periodLabel =
    oldestDate && newestDate
      ? `${PERIOD_LABELS[period]}: ${formatDate(oldestDate)} - ${formatDate(newestDate)}`
      : `${PERIOD_LABELS[period]}: нет данных`;

  return {
    turnover: formatAmount(turnover, currency),
    net: formatAmount(net, currency),
    fee: formatAmount(fee, currency),
    pureProfit: formatAmount(pureProfit, currency),
    successRate: formatPercent(successRate),
    averageCheck: formatAmount(averageCheck, currency),
    transactionCount,
    periodLabel,
  };
}

function buildChartPoints(
  transactions: TransactionItem[],
  period: AnalyticsPeriod,
  contributesToTurnover: (tx: TransactionItem) => boolean,
): AnalyticsChartPoint[] {
  const paidTransactions = transactions.filter((tx) => contributesToTurnover(tx));

  if (paidTransactions.length === 0) {
    return [];
  }

  const buckets = new Map<
    string,
    {
      date: Date;
      primary: number;
      secondary: number;
    }
  >();

  for (const transaction of paidTransactions) {
    const createdAt = toDate(transaction.created_at);
    if (!createdAt) {
      continue;
    }
    const day = toDayStart(createdAt);
    const key = dayKey(day);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        date: day,
        primary: toAmount(transaction.gross_amount),
        secondary: toAmount(transaction.net_amount),
      });
      continue;
    }
    existing.primary += toAmount(transaction.gross_amount);
    existing.secondary += toAmount(transaction.net_amount);
  }

  let ordered = Array.from(buckets.values()).sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  );

  if (period !== "all") {
    const periodStart = resolvePeriodStart(period);
    if (periodStart) {
      const startDay = toDayStart(periodStart);
      const endDay = toDayStart(new Date());
      const filled: typeof ordered = [];
      let cursor = startDay;
      while (cursor.getTime() <= endDay.getTime()) {
        const key = dayKey(cursor);
        const item = buckets.get(key);
        filled.push(
          item ?? {
            date: new Date(cursor),
            primary: 0,
            secondary: 0,
          },
        );
        cursor = addDays(cursor, 1);
      }
      ordered = filled;
    }
  }

  let points = ordered.map((item) => ({
    label: formatChartLabel(item.date),
    primary: item.primary,
    secondary: item.secondary,
  }));

  if (points.length > CHART_LIMIT) {
    points = compressChartPoints(points, CHART_LIMIT);
  }

  return points;
}

function compressChartPoints(
  points: AnalyticsChartPoint[],
  limit: number,
): AnalyticsChartPoint[] {
  const chunkSize = Math.ceil(points.length / limit);
  const compressed: AnalyticsChartPoint[] = [];

  for (let index = 0; index < points.length; index += chunkSize) {
    const chunk = points.slice(index, index + chunkSize);
    compressed.push({
      label: chunk[chunk.length - 1].label,
      primary: chunk.reduce((sum, item) => sum + item.primary, 0),
      secondary: chunk.reduce((sum, item) => sum + item.secondary, 0),
    });
  }

  return compressed;
}
