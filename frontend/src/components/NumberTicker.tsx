"use client";

import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface NumberTickerProps {
  value: number;
  fractionDigits?: number;
  className?: string;
}

/**
 * Subtle counter transition — linear-ish ease, no overshoot.
 */
export function NumberTicker({
  value,
  fractionDigits = 2,
  className,
}: NumberTickerProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const controls = animate(fromRef.current, value, {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <span className={className}>
      {Number.isFinite(display) ? display.toFixed(fractionDigits) : "—"}
    </span>
  );
}
