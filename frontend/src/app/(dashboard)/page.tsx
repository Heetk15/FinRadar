"use client";

import { Cpu } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FinRadarAnalytics } from "@/components/FinRadarAnalytics";
import { RawIntelFeed } from "@/components/RawIntelFeed";
import { SentimentMonitor } from "@/components/SentimentMonitor";
import { API_BASE, parseHistoryPayload, type HistoryRow } from "@/lib/api";
import { TIMELINE_MS, type TimelineOption } from "@/lib/timeline";

const FEED_POLL_MS = 60_000;

function byNewest(a: HistoryRow, b: HistoryRow): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

export default function DashboardPage() {
  const [panicScore, setPanicScore] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineOption>("24H");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`${API_BASE}/api/history?ticker=ALL`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setHistoryError(`HTTP ${res.status}`);
        setRows([]);
        return;
      }
      const payload: unknown = await res.json();
      setRows(parseHistoryPayload(payload));
      setLastRefreshAt(Date.now());
      setHistoryError(null);
    } catch {
      setHistoryError("UNAVAILABLE");
      setRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    const id = window.setInterval(() => void loadHistory(), FEED_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadHistory]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  const sortedRows = useMemo(() => {
    const clone = [...rows];
    clone.sort(byNewest);
    return clone;
  }, [rows]);

  const timelineFilteredHistory = useMemo(() => {
    if (timeline === "ALL") {
      return sortedRows;
    }
    const cutoff = nowTs - TIMELINE_MS[timeline];
    return sortedRows.filter((row) => {
      const ts = new Date(row.timestamp).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }, [nowTs, sortedRows, timeline]);

  const deduplicatedHistory = useMemo(() => {
    const seen = new Set<string>();
    const unique: HistoryRow[] = [];

    for (const row of timelineFilteredHistory) {
      const key = row.top_headline.trim().toLowerCase() || "no-headline";
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(row);
    }

    return unique;
  }, [timelineFilteredHistory]);

  const isFiniteScore = panicScore !== null && Number.isFinite(panicScore);
  const defcon = isFiniteScore && panicScore >= 80;

  return (
    <div className="relative flex h-[calc(100vh-6rem)] flex-col overflow-hidden">
      {defcon && (
        <div
          className="fixed left-0 right-0 top-0 z-50 h-[10px] bg-red-600"
          aria-hidden
        />
      )}

      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${defcon ? "pt-[10px]" : ""}`}>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <h1 className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-600">
            Macro terminal / Behavioral finance core
          </h1>
          <span className="flex items-center gap-2 font-mono text-[10px] text-zinc-600">
            <Cpu className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            CONTRARIAN ENGINE ONLINE
          </span>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-3">
          <div className="flex min-h-0 flex-col gap-3 lg:col-span-2 lg:grid lg:grid-rows-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-3">
            <div className="min-h-0">
              <SentimentMonitor
                onPanicScore={setPanicScore}
                timeline={timeline}
                history={deduplicatedHistory}
              />
            </div>
            <div className="min-h-0">
              <FinRadarAnalytics timeline={timeline} history={deduplicatedHistory} />
            </div>
          </div>
          <RawIntelFeed
            timeline={timeline}
            setTimeline={setTimeline}
            history={deduplicatedHistory}
            loading={historyLoading}
            error={historyError}
            lastRefreshAt={lastRefreshAt}
            nowTs={nowTs}
          />
        </div>
      </div>
    </div>
  );
}
