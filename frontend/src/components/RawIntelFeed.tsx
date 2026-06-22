"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { type HistoryRow } from "@/lib/api";
import { TIMELINE_OPTIONS, type TimelineOption } from "@/lib/timeline";

const listVariants = {
  show: {
    transition: {
      staggerChildren: 0.035,
    },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

function formatTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return "INVALID TIME";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(dt);
}

function badgeClasses(score: number): string {
  if (score > 60) {
    return "border-red-700/70 bg-red-950/50 text-red-300";
  }
  if (score < 40) {
    return "border-emerald-700/70 bg-emerald-950/40 text-emerald-300";
  }
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function byNewest(a: HistoryRow, b: HistoryRow): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

function byPanicDesc(a: HistoryRow, b: HistoryRow): number {
  return b.panic_score - a.panic_score;
}

interface RawIntelFeedProps {
  timeline: TimelineOption;
  setTimeline: (timeline: TimelineOption) => void;
  history: HistoryRow[];
  loading: boolean;
  error: string | null;
  lastRefreshAt: number | null;
  nowTs: number;
}

export function RawIntelFeed({
  timeline,
  setTimeline,
  history,
  loading,
  error,
  lastRefreshAt,
  nowTs,
}: RawIntelFeedProps) {
  const renderedRows = useMemo(() => {
    const clone = [...history];
    if (timeline === "24H") {
      clone.sort(byNewest);
    } else {
      clone.sort((a, b) => {
        const panicDiff = byPanicDesc(a, b);
        if (panicDiff !== 0) {
          return panicDiff;
        }
        return byNewest(a, b);
      });
    }
    return clone.slice(0, 10);
  }, [history, timeline]);

  const timelinePanicScore = useMemo(() => {
    if (history.length === 0) {
      return null;
    }
    const total = history.reduce((sum, row) => sum + row.panic_score, 0);
    return total / history.length;
  }, [history]);

  const signalBanner = useMemo(() => {
    if (timelinePanicScore !== null && timelinePanicScore >= 80) {
      return {
        text: "[!] SYSTEM ALERT: PEAK PANIC DETECTED. CONTRARIAN BUY SIGNAL GENERATED.",
        classes: "border-red-700 bg-red-950/60 text-red-300",
      };
    }
    if (timelinePanicScore !== null && timelinePanicScore <= 20) {
      return {
        text: "[!] SYSTEM ALERT: EXTREME GREED DETECTED. CONTRARIAN SELL SIGNAL GENERATED.",
        classes: "border-emerald-700 bg-emerald-950/40 text-emerald-300",
      };
    }
    return {
      text: "[i] SYSTEM STATUS: MARKET SENTIMENT NORMAL.",
      classes: "border-zinc-800 bg-zinc-900/40 text-zinc-400",
    };
  }, [timelinePanicScore]);

  const refreshLabel = useMemo(() => {
    if (loading && lastRefreshAt === null) {
      return "SYNCING";
    }
    if (lastRefreshAt === null) {
      return "NO SYNC";
    }
    const elapsedSeconds = Math.max(0, Math.floor((nowTs - lastRefreshAt) / 1000));
    if (elapsedSeconds < 60) {
      return `${elapsedSeconds}s AGO`;
    }
    const mins = Math.floor(elapsedSeconds / 60);
    return `${mins}m AGO`;
  }, [lastRefreshAt, loading, nowTs]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col overflow-hidden border border-zinc-800 bg-zinc-950"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          Raw Intel Feed
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          LIVE / {timeline} / {refreshLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        {TIMELINE_OPTIONS.map((option) => {
          const active = timeline === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setTimeline(option)}
              className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                active
                  ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                  : "border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className={`mx-4 mt-3 border px-3 py-2 font-mono text-[10px] uppercase tracking-wide ${signalBanner.classes}`}>
        {signalBanner.text}
        {timelinePanicScore !== null && (
          <span className="ml-2 text-zinc-200">[{timelinePanicScore.toFixed(1)}]</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`skeleton-${idx}`} className="animate-pulse border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="mb-2 h-3 w-24 bg-zinc-800" />
                <div className="h-3 w-full bg-zinc-800" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="border border-red-900/60 bg-red-950/40 p-3 font-mono text-xs text-red-300">
            [{error}] RAW INTEL UNAVAILABLE
          </div>
        )}

        {!loading && !error && renderedRows.length === 0 && (
          <div className="border border-zinc-800 bg-zinc-900/30 p-3 font-mono text-xs text-zinc-500">
            NO RECORDS RECEIVED
          </div>
        )}

        {!loading && !error && renderedRows.length > 0 && (
          <motion.ul
            initial="hidden"
            animate="show"
            variants={listVariants}
            className="space-y-3"
          >
            {renderedRows.map((row) => (
              <motion.li
                key={row.id}
                variants={rowVariants}
                className="border border-zinc-800 bg-zinc-900/30 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${badgeClasses(row.panic_score)}`}>
                    {row.panic_score.toFixed(1)}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {formatTimestamp(row.timestamp)}
                  </span>
                </div>
                <p className="font-mono text-xs leading-relaxed text-zinc-300">
                  {row.top_headline.trim() || "NO HEADLINE"}
                </p>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </motion.section>
  );
}
