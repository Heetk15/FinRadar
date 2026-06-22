"use client";

import { Flame, LayoutGrid, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";

type ScreenerRow = {
  ticker: string;
  panic_score: number | null;
  latest_signal: string;
  timestamp: string;
};

type SortKey = "ticker" | "panic_score" | "timestamp";
type SortDirection = "asc" | "desc";

function parseScreenerPayload(data: unknown): ScreenerRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const rows: ScreenerRow[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const row = item as Record<string, unknown>;
    const tickerRaw = row.ticker;
    const scoreRaw = row.panic_score;
    const headlinesRaw = row.headlines;
    const topHeadlineRaw = row.top_headline;
    const timestampRaw = row.timestamp;

    if (typeof tickerRaw !== "string") {
      continue;
    }

    let latestSignal = "NO SIGNAL";
    if (Array.isArray(headlinesRaw) && typeof headlinesRaw[0] === "string") {
      latestSignal = headlinesRaw[0].trim() || "NO SIGNAL";
    } else if (typeof topHeadlineRaw === "string") {
      latestSignal = topHeadlineRaw.trim() || "NO SIGNAL";
    }

    rows.push({
      ticker: tickerRaw.toUpperCase(),
      panic_score:
        typeof scoreRaw === "number" && Number.isFinite(scoreRaw)
          ? scoreRaw
          : null,
      latest_signal: latestSignal,
      timestamp: typeof timestampRaw === "number"
        ? new Date(timestampRaw * 1000).toISOString()
        : typeof timestampRaw === "string"
          ? timestampRaw
          : "",
    });
  }

  return rows;
}

function tileTone(score: number | null): string {
  if (score === null) {
    return "bg-zinc-800";
  }
  if (score >= 60) {
    return "bg-red-900/50";
  }
  if (score <= 40) {
    return "bg-emerald-900/50";
  }
  return "bg-zinc-800";
}

function scoreTone(score: number | null): string {
  if (score === null) {
    return "text-zinc-400";
  }
  if (score >= 60) {
    return "text-red-300";
  }
  if (score <= 40) {
    return "text-emerald-300";
  }
  return "text-zinc-300";
}

function tileBorderTone(score: number | null): string {
  if (score === null) {
    return "border-zinc-700";
  }
  if (score >= 60) {
    return "border-red-700/70";
  }
  if (score <= 40) {
    return "border-emerald-700/70";
  }
  return "border-zinc-700";
}

function toTimestampMillis(value: string): number {
  const millis = Date.parse(value);
  if (Number.isNaN(millis)) {
    return 0;
  }
  return millis;
}

function sortIndicator(active: boolean, direction: SortDirection): string {
  if (!active) {
    return "<>";
  }
  return direction === "asc" ? "^" : "v";
}

function formatTime(value: string): string {
  if (!value) {
    return "NO TIME";
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return "NO TIME";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(dt);
}

export default function ScreenerPage() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("desc");
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/api/screener`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const payload: unknown = await res.json();
        if (!active) {
          return;
        }

        setRows(parseScreenerPayload(payload));
      } catch (err) {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "UNAVAILABLE";
        setError(message);
        setRows([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 60_000);

    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "panic_score") {
        const av = a.panic_score ?? Number.NEGATIVE_INFINITY;
        const bv = b.panic_score ?? Number.NEGATIVE_INFINITY;
        return sortDirection === "asc" ? av - bv : bv - av;
      }

      if (sortKey === "timestamp") {
        const av = toTimestampMillis(a.timestamp);
        const bv = toTimestampMillis(b.timestamp);
        return sortDirection === "asc" ? av - bv : bv - av;
      }

      const cmp = a.ticker.localeCompare(b.ticker);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortDirection, sortKey]);

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-zinc-500">
            <Flame className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            <h1 className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500">
              Market Screener / Sentiment Heatmap
            </h1>
          </div>
          <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            Live watchlist
          </span>
        </div>

        <p className="font-mono text-xs leading-relaxed text-zinc-500">
          AI panic ranking across tracked assets with headline-level signal context.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-4 flex items-center gap-2 text-zinc-500">
          <LayoutGrid className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            Heatmap
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={`tile-skeleton-${idx}`}
                className="animate-pulse border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="mb-3 h-5 w-14 bg-zinc-800" />
                <div className="h-4 w-20 bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="border border-zinc-800 bg-zinc-900/30 p-4 font-mono text-xs text-zinc-500">
            {error ? `[${error}] SCREENER FEED UNAVAILABLE` : "NO SCREENER DATA"}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {sortedRows.map((row) => (
              <div
                key={row.ticker}
                className={`border p-4 ${tileTone(row.panic_score)} ${tileBorderTone(row.panic_score)}`}
              >
                <p className={`font-mono text-lg font-semibold tracking-[0.12em] ${scoreTone(row.panic_score)}`}>
                  {row.ticker}
                </p>
                <p className={`mt-2 font-mono text-sm tabular-nums ${scoreTone(row.panic_score)}`}>
                  {row.panic_score === null ? "NO SCORE" : row.panic_score.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-4 flex items-center gap-2 text-zinc-500">
          <Table2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            Intel Table
          </h2>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div
                key={`row-skeleton-${idx}`}
                className="h-10 animate-pulse border border-zinc-800 bg-zinc-900/30"
              />
            ))}
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="border border-zinc-800 bg-zinc-900/30 p-4 font-mono text-xs text-zinc-500">
            NO INTEL ROWS AVAILABLE
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">TICKER</th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    <button
                      type="button"
                      onClick={() => toggleSort("panic_score")}
                      className="inline-flex items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      AI PANIC SCORE
                      <span className="font-mono text-[11px] text-zinc-400">
                        {sortIndicator(sortKey === "panic_score", sortDirection)}
                      </span>
                    </button>
                  </th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">LATEST SIGNAL</th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    <button
                      type="button"
                      onClick={() => toggleSort("timestamp")}
                      className="inline-flex items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      TIMESTAMP
                      <span className="font-mono text-[11px] text-zinc-400">
                        {sortIndicator(sortKey === "timestamp", sortDirection)}
                      </span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={`intel-${row.ticker}`} className="border-b border-zinc-900 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs font-semibold tracking-[0.08em] text-zinc-200">
                      {row.ticker}
                    </td>
                    <td className={`px-3 py-2 font-mono text-xs tabular-nums ${scoreTone(row.panic_score)}`}>
                      {row.panic_score === null ? "NO SCORE" : row.panic_score.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300">
                      {row.latest_signal}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                      {formatTime(row.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
