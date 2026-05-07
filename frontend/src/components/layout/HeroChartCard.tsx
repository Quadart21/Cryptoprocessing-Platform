import { useEffect, useId, useMemo, useRef, useState } from "react";

import { formatDecimal } from "../../utils/format";

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 320;
const CHART_PADDING_X = 24;
const CHART_PADDING_Y = 18;

export type HeroChartPoint = {
  label: string;
  primary: number;
  secondary: number;
};

type HeroChartCardProps = {
  eyebrow: string;
  title: string;
  hint: string;
  primaryValue: string;
  secondaryValue: string;
  points?: HeroChartPoint[];
  primaryLegend?: string;
  secondaryLegend?: string;
  chartValueUnit?: string;
  footerLeft?: string;
  footerRight?: string;
};

const FALLBACK_POINTS: HeroChartPoint[] = [
  { label: "1", primary: 18, secondary: 12 },
  { label: "2", primary: 26, secondary: 16 },
  { label: "3", primary: 22, secondary: 18 },
  { label: "4", primary: 28, secondary: 19 },
  { label: "5", primary: 34, secondary: 24 },
  { label: "6", primary: 31, secondary: 23 },
  { label: "7", primary: 40, secondary: 30 },
];

export function HeroChartCard({
  eyebrow,
  title,
  hint,
  primaryValue,
  secondaryValue,
  points,
  primaryLegend = "Оборот",
  secondaryLegend = "К зачислению",
  chartValueUnit = "",
  footerLeft = "Динамика в реальном времени",
  footerRight = "Сводка по выбранному периоду",
}: HeroChartCardProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const sourcePoints = points && points.length > 0 ? points : FALLBACK_POINTS;
  const [activeIndex, setActiveIndex] = useState(Math.max(sourcePoints.length - 1, 0));

  useEffect(() => {
    setActiveIndex(Math.max(sourcePoints.length - 1, 0));
  }, [sourcePoints.length]);

  const chartData = useMemo(() => {
    const innerWidth = VIEWBOX_WIDTH - CHART_PADDING_X * 2;
    const innerHeight = VIEWBOX_HEIGHT - CHART_PADDING_Y * 2;
    const maxValue = Math.max(
      1,
      ...sourcePoints.map((point) => Math.max(point.primary, point.secondary)),
    );

    const normalizedPoints = sourcePoints.map((point, index) => {
      const x =
        sourcePoints.length === 1
          ? CHART_PADDING_X + innerWidth / 2
          : CHART_PADDING_X + (index / (sourcePoints.length - 1)) * innerWidth;
      const primaryY = CHART_PADDING_Y + (1 - point.primary / maxValue) * innerHeight;
      const secondaryY = CHART_PADDING_Y + (1 - point.secondary / maxValue) * innerHeight;
      return {
        ...point,
        x,
        primaryY,
        secondaryY,
      };
    });

    const linePrimary = normalizedPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.primaryY}`)
      .join(" ");
    const lineSecondary = normalizedPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.secondaryY}`)
      .join(" ");

    const bottom = CHART_PADDING_Y + innerHeight;
    const first = normalizedPoints[0];
    const last = normalizedPoints[normalizedPoints.length - 1];
    const areaPrimary = [
      `M ${first.x} ${bottom}`,
      ...normalizedPoints.map((point) => `L ${point.x} ${point.primaryY}`),
      `L ${last.x} ${bottom}`,
      "Z",
    ].join(" ");
    const areaSecondary = [
      `M ${first.x} ${bottom}`,
      ...normalizedPoints.map((point) => `L ${point.x} ${point.secondaryY}`),
      `L ${last.x} ${bottom}`,
      "Z",
    ].join(" ");

    return {
      normalizedPoints,
      linePrimary,
      lineSecondary,
      areaPrimary,
      areaSecondary,
      bottom,
    };
  }, [sourcePoints]);

  const safeIndex = Math.min(Math.max(activeIndex, 0), chartData.normalizedPoints.length - 1);
  const activePoint = chartData.normalizedPoints[safeIndex];
  const activeLeftPercent =
    chartData.normalizedPoints.length <= 1
      ? 50
      : (safeIndex / (chartData.normalizedPoints.length - 1)) * 100;
  const tooltipAlignClass =
    activeLeftPercent < 12
      ? "hero-chart-tooltip-left"
      : activeLeftPercent > 88
        ? "hero-chart-tooltip-right"
        : "";

  function selectPointByClientX(clientX: number) {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect || chartData.normalizedPoints.length <= 1) {
      return;
    }
    const ratio = (clientX - rect.left) / rect.width;
    const nextIndex = Math.round(ratio * (chartData.normalizedPoints.length - 1));
    const clampedIndex = Math.min(
      Math.max(nextIndex, 0),
      chartData.normalizedPoints.length - 1,
    );
    setActiveIndex(clampedIndex);
  }

  return (
    <article className="hero-panel hero-panel-wide">
      <div className="hero-panel-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="hero-panel-hint">{hint}</p>
        </div>
        <div className="hero-kpi-cluster">
          <div className="hero-kpi">
            <span>{primaryLegend}</span>
            <strong>{primaryValue}</strong>
          </div>
          <div className="hero-kpi">
            <span>{secondaryLegend}</span>
            <strong>{secondaryValue}</strong>
          </div>
        </div>
      </div>

      <div className="hero-chart" ref={chartRef}>
        <div className="hero-chart-grid" />
        <svg
          aria-label="График оборота и зачислений"
          className="hero-chart-svg"
          preserveAspectRatio="none"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        >
          <defs>
            <linearGradient id={`${gradientId}-primary-area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(51, 215, 255, 0.28)" />
              <stop offset="100%" stopColor="rgba(51, 215, 255, 0.02)" />
            </linearGradient>
            <linearGradient id={`${gradientId}-secondary-area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(138, 125, 255, 0.24)" />
              <stop offset="100%" stopColor="rgba(138, 125, 255, 0.02)" />
            </linearGradient>
          </defs>

          <path
            d={chartData.areaSecondary}
            fill={`url(#${gradientId}-secondary-area)`}
            opacity="0.7"
          />
          <path d={chartData.areaPrimary} fill={`url(#${gradientId}-primary-area)`} />

          <path className="hero-chart-path hero-chart-path-secondary" d={chartData.lineSecondary} />
          <path className="hero-chart-path hero-chart-path-primary" d={chartData.linePrimary} />

          {activePoint ? (
            <>
              <line
                className="hero-chart-crosshair"
                x1={activePoint.x}
                x2={activePoint.x}
                y1={CHART_PADDING_Y}
                y2={chartData.bottom}
              />
              <circle
                className="hero-chart-node hero-chart-node-secondary"
                cx={activePoint.x}
                cy={activePoint.secondaryY}
                r="5"
              />
              <circle
                className="hero-chart-node hero-chart-node-primary"
                cx={activePoint.x}
                cy={activePoint.primaryY}
                r="5.5"
              />
            </>
          ) : null}
        </svg>

        <div
          className="hero-chart-hitbox"
          onMouseMove={(event) => selectPointByClientX(event.clientX)}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            if (touch) {
              selectPointByClientX(touch.clientX);
            }
          }}
        />

        {activePoint ? (
          <div
            className={`hero-chart-tooltip ${tooltipAlignClass}`}
            style={{ left: `${activeLeftPercent}%` }}
          >
            <span>{activePoint.label}</span>
            <strong>{formatValue(activePoint.primary, chartValueUnit)}</strong>
            <em>{formatValue(activePoint.secondary, chartValueUnit)}</em>
          </div>
        ) : null}

        <div className="hero-chart-axis">
          {chartData.normalizedPoints.map((point, index) => {
            if (
              index !== 0 &&
              index !== chartData.normalizedPoints.length - 1 &&
              index % Math.max(1, Math.floor(chartData.normalizedPoints.length / 5)) !== 0
            ) {
              return null;
            }
            return (
              <span
                key={`${point.label}-${index}`}
                style={{ left: `${(point.x / VIEWBOX_WIDTH) * 100}%` }}
              >
                {point.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="hero-chart-footer">
        <span>{footerLeft}</span>
        <span>
          {primaryLegend} / {secondaryLegend}
        </span>
      </div>
      <p className="hero-chart-note">{footerRight}</p>
    </article>
  );
}

function formatValue(value: number, unit: string): string {
  const formatted = formatDecimal(value, { minFractionDigits: 2, maxFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}
