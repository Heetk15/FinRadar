"use client";

import { useMemo } from "react";
import { type HistoryRow } from "@/lib/api";
import { TIMELINE_OPTIONS, type TimelineOption } from "@/lib/timeline";

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
    return "bg-red-900/30 text-red-400 border border-red-800/50";
  }
  if (score < 40) {
    return "bg-brand-accentDark/20 text-brand-accent border border-brand-accentDark/50";
  }
  return "bg-brand-panelDark/50 text-gray-300 border border-brand-panelDark";
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
        classes: "border-red-800/50 bg-red-900/20 text-red-400",
      };
    }
    if (timelinePanicScore !== null && timelinePanicScore <= 20) {
      return {
        text: "[!] SYSTEM ALERT: EXTREME GREED DETECTED. CONTRARIAN SELL SIGNAL GENERATED.",
        classes: "border-brand-accentDark/50 bg-brand-accentDark/20 text-brand-accent",
      };
    }
    return {
      text: "[i] SYSTEM STATUS: MARKET SENTIMENT NORMAL.",
      classes: "border-brand-panelDark bg-brand-panelDark/30 text-gray-400",
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
    <section className="flex h-full flex-col overflow-hidden bg-transparent">
      <div className="flex items-center justify-between border-b border-brand-panelDark px-5 py-4">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-gray-400">
          Raw Intel Feed
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
          LIVE / {timeline} / {refreshLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-brand-panelDark px-5 py-3">
        {TIMELINE_OPTIONS.map((option) => {
          const active = timeline === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setTimeline(option)}
              className={`rounded px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                active
                  ? "bg-gray-700 text-white"
                  : "bg-brand-panelDark/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className={`mx-5 mt-4 rounded border px-4 py-3 font-sans text-xs font-medium tracking-wide ${signalBanner.classes}`}>
        {signalBanner.text}
        {timelinePanicScore !== null && (
          <span className="ml-2 font-mono text-gray-300">[{timelinePanicScore.toFixed(1)}]</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`skeleton-${idx}`} className="animate-pulse rounded border border-brand-panelDark bg-brand-panelDark/20 p-4">
                <div className="mb-2 h-3 w-24 rounded bg-gray-700" />
                <div className="h-3 w-full rounded bg-gray-800" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded border border-red-900/60 bg-red-900/20 p-4 font-mono text-xs text-red-400">
            [{error}] RAW INTEL UNAVAILABLE
          </div>
        )}

        {!loading && !error && renderedRows.length === 0 && (
          <div className="rounded border border-brand-panelDark bg-brand-panelDark/30 p-4 font-sans text-sm text-gray-500">
            No records received.
          </div>
        )}

        {!loading && !error && renderedRows.length > 0 && (
          <ul className="space-y-3">
            {renderedRows.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-brand-panelDark bg-brand-panelDark/10 p-4 shadow-sm transition-colors hover:bg-brand-panelDark/30"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center rounded-sm px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wider ${badgeClasses(row.panic_score)}`}>
                    {row.panic_score.toFixed(1)}
                  </span>
                  <span className="font-mono text-[11px] text-gray-500">
                    {formatTimestamp(row.timestamp)}
                  </span>
                </div>
                <p className="font-sans text-sm leading-relaxed text-gray-200">
                  {row.top_headline.trim() || "NO HEADLINE"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
