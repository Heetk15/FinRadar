"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

function formatClock(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

const PLACEHOLDER = "--:--:--";

export function LiveClock() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [mounted]);

  if (!mounted) {
    return (
      <span className="tabular-nums text-zinc-600" suppressHydrationWarning>
        {PLACEHOLDER}
      </span>
    );
  }

  return (
    <motion.span
      key={Math.floor(now.getTime() / 1000)}
      initial={{ opacity: 0.92 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      className="tabular-nums text-zinc-300"
    >
      {formatClock(now)}
    </motion.span>
  );
}
