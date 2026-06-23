"use client";

import { motion } from "framer-motion";
import { Activity, Radio } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  type HistoryRow,
  parseFullSentimentPayload,
} from "@/lib/api";
import { type TimelineOption } from "@/lib/timeline";
import { PanicGauge } from "@/components/PanicGauge";

const POLL_MS = 60_000;

interface SentimentMonitorProps {
  onPanicScore?: (score: number | null) => void;
  timeline: TimelineOption;
  history: HistoryRow[];
}

export function SentimentMonitor({
  onPanicScore,
  timeline,
  history,
}: SentimentMonitorProps) {
  const [panicScore, setPanicScore] = useState<number | null>(null);
  const [headline, setHeadline] = useState<string>("NO DATA");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const signal = useMemo(() => {
    if (panicScore !== null && Number.isFinite(panicScore) && panicScore >= 60) {
      return {
        text: "CONTRARIAN BUY SIGNAL",
        classes: "text-red-300",
      };
    }
    if (panicScore !== null && Number.isFinite(panicScore) && panicScore <= 40) {
      return {
        text: "CONTRARIAN SELL SIGNAL",
        classes: "text-emerald-300",
      };
    }
    return {
      text: "MARKET NEUTRAL",
      classes: "text-zinc-400",
    };
  }, [panicScore]);

  const gaugeAlert = panicScore !== null && Number.isFinite(panicScore) && panicScore >= 60;
  const edge = gaugeAlert ? "border-red-600" : "border-zinc-800";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/sentiment`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setPanicScore(null);
        setHeadline("NO DATA");
        onPanicScore?.(null);
        return;
      }
      const json: unknown = await res.json();
      const full = parseFullSentimentPayload(json);
      setError(null);
      setPanicScore(full.panic_score);
      onPanicScore?.(full.panic_score);
      if (full.headlines.length > 0) {
        setHeadline(full.headlines[0]);
      } else {
        setHeadline("NO DATA");
      }
    } catch {
      setError("UNAVAILABLE");
      setPanicScore(null);
      setHeadline("NO DATA");
      onPanicScore?.(null);
    } finally {
      setLoading(false);
    }
  }, [onPanicScore]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="flex h-full min-h-[250px] flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-400">
          <Activity className="h-4 w-4 text-brand-accent" strokeWidth={1.5} aria-hidden />
          <span className="font-sans text-xs font-medium uppercase tracking-wider">
            Live Sentiment
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <div className="mx-auto w-full max-w-[200px]">
          <PanicGauge value={panicScore} min={0} max={100} />
        </div>
        <p className={`text-center font-sans text-sm font-semibold tracking-wide ${signal.classes}`}>
          {signal.text}
        </p>
        {loading && (
          <p className="font-sans text-xs uppercase tracking-wider text-gray-500 text-center">
            Synchronizing feed...
          </p>
        )}
        {error && (
          <p className="font-mono text-xs text-red-400 text-center">[{error}]</p>
        )}
        <p className="mx-auto w-full max-w-prose text-center font-sans text-sm leading-relaxed text-gray-300">
          {headline === "NO DATA" ? (
            <span className="text-gray-600">No headline data available.</span>
          ) : (
            headline
          )}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-brand-panelDark pt-4 text-gray-500">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider">
            Polling Interval: {POLL_MS / 1000}s
          </span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
          {timeline} / {history.length} events
        </span>
      </div>
    </div>
  );
}
