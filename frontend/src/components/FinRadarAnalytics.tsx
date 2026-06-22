"use client";

import { motion } from "framer-motion";
import { Mountain, Timer } from "lucide-react";
import { useMemo } from "react";
import { type HistoryRow } from "@/lib/api";
import { type TimelineOption } from "@/lib/timeline";

function formatPeakTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "NO DATA";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(d);
}

function peakFromRows(rows: HistoryRow[]): {
  score: number | null;
  headline: string;
  when: string;
} {
  if (rows.length === 0) {
    return { score: null, headline: "NO DATA", when: "NO DATA" };
  }
  let best = rows[0];
  for (const r of rows) {
    if (r.panic_score > best.panic_score) best = r;
  }
  return {
    score: best.panic_score,
    headline: best.top_headline.trim() || "NO DATA",
    when: formatPeakTimestamp(best.timestamp),
  };
}

interface DoomAnalyticsProps {
  timeline: TimelineOption;
  history: HistoryRow[];
}

export function DoomAnalytics({ timeline, history }: DoomAnalyticsProps) {
  const peak = useMemo(() => peakFromRows(history), [history]);
  const edge = peak.score !== null && peak.score >= 60 ? "border-red-600" : "border-zinc-800";

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      className={`flex h-full min-h-[210px] flex-col border bg-zinc-950 p-4 lg:min-h-0 ${edge}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2 text-zinc-500">
        <span className="flex items-center gap-2">
          <Mountain className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          <span className="text-xs uppercase tracking-[0.2em]">
            Historical max
          </span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {timeline}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          Peak panic
        </span>
        <div className="flex items-baseline gap-2">
          {peak.score !== null ? (
            <span className="font-mono text-3xl font-semibold tabular-nums text-[#f97316] sm:text-4xl">
              {peak.score.toFixed(2)}
            </span>
          ) : (
            <span className="font-mono text-3xl text-zinc-600 sm:text-4xl">
              NO DATA
            </span>
          )}
        </div>

        <p className="max-w-prose font-mono text-xs leading-relaxed text-zinc-400">
          {peak.headline === "NO DATA" ? (
            <span className="text-zinc-600">NO DATA</span>
          ) : (
            peak.headline
          )}
        </p>

        <div className="mt-1 flex items-start gap-2 text-zinc-500">
          <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          <span className="font-mono text-[11px] tabular-nums">
            {peak.when === "NO DATA" ? (
              <span className="text-zinc-600">NO DATA</span>
            ) : (
              peak.when
            )}
          </span>
        </div>
      </div>
    </motion.section>
  );
}
