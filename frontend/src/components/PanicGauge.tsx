"use client";

import { motion } from "framer-motion";

const MIN_ANGLE = -90;
const MAX_ANGLE = 90;

const RADIUS = 80;
const ARC_STROKE = 10;
const PADDING = ARC_STROKE * 2.4;

const CENTER_X = RADIUS + PADDING;
const CENTER_Y = RADIUS + PADDING;

const VIEW_WIDTH = CENTER_X * 2;
const VIEW_HEIGHT = CENTER_Y + ARC_STROKE * 3.8;

const MAJOR_TICK_COUNT = 5;
const MINOR_TICKS_PER_SEGMENT = 1;

const TICK_OUTER_RADIUS = RADIUS + ARC_STROKE * 0.35;
const MAJOR_TICK_INNER_RADIUS = RADIUS - ARC_STROKE * 1.15;
const MINOR_TICK_INNER_RADIUS = RADIUS - ARC_STROKE * 0.8;
const LABEL_RADIUS = RADIUS + ARC_STROKE * 1.45;
const NEEDLE_LENGTH = RADIUS - ARC_STROKE * 1.45;
const PIVOT_RADIUS = ARC_STROKE * 0.72;

interface PanicGaugeProps {
  value: number | null;
  min?: number;
  max?: number;
  className?: string;
}

type Point = {
  x: number;
  y: number;
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// Angle convention:
// -90 => left endpoint, 0 => top, +90 => right endpoint.
function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const theta = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(theta),
    y: cy + radius * Math.sin(theta),
  };
}

function valueToAngle(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) {
    return MIN_ANGLE;
  }
  const normalized = clamp((value - min) / span, 0, 1);
  return MIN_ANGLE + normalized * (MAX_ANGLE - MIN_ANGLE);
}

function angleToArcPath(startAngle: number, endAngle: number, radius: number): string {
  const start = polarToCartesian(CENTER_X, CENTER_Y, radius, startAngle);
  const end = polarToCartesian(CENTER_X, CENTER_Y, radius, endAngle);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

function valueColor(value: number | null, min: number, max: number): string {
  if (value === null || !Number.isFinite(value)) {
    return "rgb(161 161 170)";
  }
  const angle = valueToAngle(value, min, max);
  const ratio = (angle - MIN_ANGLE) / (MAX_ANGLE - MIN_ANGLE);
  if (ratio <= 0.4) return "rgb(52 211 153)";
  if (ratio <= 0.65) return "rgb(245 158 11)";
  return "rgb(248 113 113)";
}

export function PanicGauge({
  value,
  min = 0,
  max = 100,
  className = "",
}: PanicGaugeProps) {
  const safeValue = value !== null && Number.isFinite(value) ? value : min;
  const angle = valueToAngle(safeValue, min, max);
  const progressRatio = (angle - MIN_ANGLE) / (MAX_ANGLE - MIN_ANGLE);
  const semicircleLength = Math.PI * RADIUS;
  const progressDashoffset = semicircleLength * (1 - progressRatio);

  const backgroundArcPath = angleToArcPath(MIN_ANGLE, MAX_ANGLE, RADIUS);
  const needleRotation = angle;

  const displayScore =
    value !== null && Number.isFinite(value) ? value.toFixed(2) : "--";

  const needleColor = valueColor(value, min, max);

  const majorTicks = Array.from({ length: MAJOR_TICK_COUNT + 1 }, (_, idx) => {
    const t = idx / MAJOR_TICK_COUNT;
    const tickAngle = MIN_ANGLE + t * (MAX_ANGLE - MIN_ANGLE);
    const labelValue = min + (max - min) * t;
    const outer = polarToCartesian(CENTER_X, CENTER_Y, TICK_OUTER_RADIUS, tickAngle);
    const inner = polarToCartesian(CENTER_X, CENTER_Y, MAJOR_TICK_INNER_RADIUS, tickAngle);
    const label = polarToCartesian(CENTER_X, CENTER_Y, LABEL_RADIUS, tickAngle);
    return {
      key: `major-${idx}`,
      angle: tickAngle,
      labelValue,
      outer,
      inner,
      label,
    };
  });

  const minorTicks = Array.from({ length: MAJOR_TICK_COUNT }, (_, segmentIdx) => {
    const startT = segmentIdx / MAJOR_TICK_COUNT;
    const ticks = Array.from({ length: MINOR_TICKS_PER_SEGMENT }, (_, tIdx) => {
      const frac = (tIdx + 1) / (MINOR_TICKS_PER_SEGMENT + 1);
      const t = startT + frac * (1 / MAJOR_TICK_COUNT);
      const tickAngle = MIN_ANGLE + t * (MAX_ANGLE - MIN_ANGLE);
      const outer = polarToCartesian(CENTER_X, CENTER_Y, TICK_OUTER_RADIUS, tickAngle);
      const inner = polarToCartesian(CENTER_X, CENTER_Y, MINOR_TICK_INNER_RADIUS, tickAngle);
      return {
        key: `minor-${segmentIdx}-${tIdx}`,
        outer,
        inner,
      };
    });
    return ticks;
  }).flat();

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div className="relative border border-zinc-800 bg-zinc-950 p-4">
        <svg
          width="100%"
          height="auto"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="block max-w-[300px]"
          shapeRendering="geometricPrecision"
          aria-hidden
        >
          <defs>
            <linearGradient id="gauge-progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(52 211 153)" />
              <stop offset="55%" stopColor="rgb(250 204 21)" />
              <stop offset="100%" stopColor="rgb(248 113 113)" />
            </linearGradient>
            <radialGradient id="pivot-gradient" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="rgb(63 63 70)" />
              <stop offset="100%" stopColor="rgb(24 24 27)" />
            </radialGradient>
          </defs>

          <path
            d={backgroundArcPath}
            fill="transparent"
            stroke="rgb(39 39 42)"
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
          />

          <motion.path
            d={backgroundArcPath}
            fill="transparent"
            stroke="url(#gauge-progress-gradient)"
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
            strokeDasharray={semicircleLength}
            animate={{ strokeDashoffset: progressDashoffset }}
            strokeDashoffset={semicircleLength}
            initial={false}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />

          {minorTicks.map((tick) => {
            return (
              <line
                key={tick.key}
                x1={tick.outer.x}
                y1={tick.outer.y}
                x2={tick.inner.x}
                y2={tick.inner.y}
                stroke="rgb(82 82 91)"
                strokeWidth="1"
              />
            );
          })}

          {majorTicks.map((tick) => {
            const roundedLabel = Math.round(tick.labelValue);
            return (
              <g key={tick.key}>
                <line
                  x1={tick.outer.x}
                  y1={tick.outer.y}
                  x2={tick.inner.x}
                  y2={tick.inner.y}
                  stroke="rgb(113 113 122)"
                  strokeWidth="1.1"
                />
                <text
                  x={tick.label.x}
                  y={tick.label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgb(113 113 122)"
                  fontSize="9"
                  letterSpacing="0.08em"
                  fontFamily="ui-monospace, monospace"
                >
                  {roundedLabel}
                </text>
              </g>
            );
          })}

          <motion.line
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={CENTER_X}
            y2={CENTER_Y - NEEDLE_LENGTH}
            stroke={needleColor}
            strokeWidth="2.6"
            strokeLinecap="round"
            initial={false}
            animate={{ rotate: needleRotation }}
            transition={{ type: "spring", stiffness: 130, damping: 22, mass: 0.75 }}
            style={{ transformOrigin: `${CENTER_X}px ${CENTER_Y}px` }}
          />

          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={PIVOT_RADIUS}
            fill="url(#pivot-gradient)"
            stroke="rgb(63 63 70)"
            strokeWidth="1.2"
          />

          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={PIVOT_RADIUS * 0.4}
            fill="rgb(161 161 170)"
            opacity="0.85"
          />
        </svg>
      </div>
      <p className="mt-3 font-mono text-xs tabular-nums text-zinc-500">
        SCORE{" "}
        <span style={{ color: needleColor }}>
          {displayScore}
        </span>
      </p>
    </div>
  );
}
