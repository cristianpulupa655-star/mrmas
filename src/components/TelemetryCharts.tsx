import React, {useState} from 'react';
import type {TelemetryPoint} from '../types/server';

interface SeriesConfig {
  key: keyof TelemetryPoint;
  label: string;
  unit: string;
  color: string;
  maxValue?: number;
}

interface TimeSeriesChartProps {
  title: string;
  subtitle: string;
  data: TelemetryPoint[];
  series: SeriesConfig[];
  thresholdValue?: number;
  thresholdLabel?: string;
  height?: number;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  subtitle,
  data,
  series,
  thresholdValue,
  thresholdLabel,
  height = 190,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 620;
  const padLeft = 42;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues: number[] = [];
  series.forEach((s) => {
    data.forEach((d) => {
      const v = Number(d[s.key]);
      if (!Number.isNaN(v)) allValues.push(v);
    });
  });
  if (thresholdValue !== undefined) allValues.push(thresholdValue);

  const configuredMax = series.find((s) => s.maxValue !== undefined)?.maxValue;
  const rawMax = Math.max(...allValues, 1);
  const yMax = configuredMax ? Math.max(configuredMax, rawMax) : Math.ceil(rawMax * 1.15);
  const yMin = 0;

  const getX = (idx: number) => {
    if (data.length <= 1) return padLeft;
    return padLeft + (idx / (data.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    return padTop + plotH - ((clamped - yMin) / (yMax - yMin || 1)) * plotH;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round((yMin + t * (yMax - yMin)) * 10) / 10);
  const hoveredPoint = hoverIdx !== null && data[hoverIdx] ? data[hoverIdx] : null;

  return (
    <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {series.map((s) => {
            const latest = hoveredPoint ? Number(hoveredPoint[s.key]) : data.length ? Number(data[data.length - 1][s.key]) : 0;
            return (
              <div key={String(s.key)} className="flex items-center gap-1.5 font-mono tabular-nums">
                <span className="inline-block w-2.5 h-0.5" style={{backgroundColor: s.color}} />
                <span className="text-slate-400">{s.label}:</span>
                <span className="text-slate-100 font-medium">
                  {latest}
                  {s.unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Horizontal grid lines */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="rgba(148, 163, 184, 0.1)"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono tabular-nums"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Threshold reference line */}
          {thresholdValue !== undefined && (
            <g>
              <line
                x1={padLeft}
                y1={getY(thresholdValue)}
                x2={width - padRight}
                y2={getY(thresholdValue)}
                stroke="#d97706"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity={0.75}
              />
              {thresholdLabel && (
                <text
                  x={width - padRight - 4}
                  y={getY(thresholdValue) - 5}
                  textAnchor="end"
                  className="fill-amber-400 text-[10px] font-mono"
                >
                  {thresholdLabel}
                </text>
              )}
            </g>
          )}

          {/* Series paths */}
          {series.map((s) => {
            if (data.length < 2) return null;
            const pathD = data
              .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(Number(d[s.key])).toFixed(1)}`)
              .join(' ');
            const areaD = `${pathD} L ${getX(data.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

            return (
              <g key={String(s.key)}>
                <path d={areaD} fill={s.color} fillOpacity={0.07} />
                <path d={pathD} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinejoin="round" />
              </g>
            );
          })}

          {/* X-axis timestamps */}
          {data.length > 0 &&
            [0, Math.floor(data.length / 2), data.length - 1].map((idx) => (
              <text
                key={idx}
                x={getX(idx)}
                y={height - 6}
                textAnchor={idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'}
                className="fill-slate-500 text-[10px] font-mono tabular-nums"
              >
                {data[idx]?.timestamp}
              </text>
            ))}

          {/* Hover vertical line & interactive overlay */}
          {hoverIdx !== null && data[hoverIdx] && (
            <g>
              <line
                x1={getX(hoverIdx)}
                y1={padTop}
                x2={getX(hoverIdx)}
                y2={padTop + plotH}
                stroke="rgba(226, 232, 240, 0.35)"
                strokeWidth="1"
              />
              {series.map((s) => (
                <circle
                  key={String(s.key)}
                  cx={getX(hoverIdx)}
                  cy={getY(Number(data[hoverIdx][s.key]))}
                  r="3.5"
                  fill={s.color}
                  stroke="#0b0f17"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          )}

          {/* Invisible hover columns */}
          {data.map((_, i) => {
            const colW = plotW / Math.max(1, data.length);
            return (
              <rect
                key={i}
                x={getX(i) - colW / 2}
                y={padTop}
                width={colW}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            );
          })}
        </svg>

        {hoveredPoint && (
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums border-t border-slate-800/70 pt-1.5">
            <span>Muestra: {hoveredPoint.timestamp}</span>
            <span>
              Chunks: {hoveredPoint.chunksLoaded} · Entidades: {hoveredPoint.entitiesCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
