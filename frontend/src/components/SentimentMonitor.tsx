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
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex h-full min-h-[250px] flex-col border bg-zinc-950 p-4 lg:min-h-0 ${edge}`}
    >
      <div className="mb-3 flex items-center gap-2 text-zinc-500">
        <Radio className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        <span className="text-xs uppercase tracking-[0.2em]">
          Live sentiment
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="mx-auto w-full max-w-xs">
          <PanicGauge value={panicScore} min={0} max={100} />
        </div>
        <p className={`text-center font-mono text-xs uppercase tracking-[0.24em] ${signal.classes}`}>
          {signal.text}
        </p>
        {loading && (
          <p className="font-mono text-xs uppercase tracking-wider text-zinc-600">
            Synchronizing feed...
          </p>
        )}
        {error && (
          <p className="font-mono text-xs text-zinc-600">[{error}]</p>
        )}
        <p className="w-full max-w-prose font-mono text-sm leading-relaxed text-zinc-400">
          {headline === "NO DATA" ? (
            <span className="text-zinc-600">NO DATA</span>
          ) : (
            headline
          )}
        </p>
      </div>

      <div
        className={`mt-4 flex items-center justify-between gap-2 border-t pt-3 text-zinc-600 ${edge}`}
      >
        <span className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-wider">
            Interval {POLL_MS / 1000}s
          </span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {timeline} / {history.length}
        </span>
      </div>
    </motion.section>
  );
}
