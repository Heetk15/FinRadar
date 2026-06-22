"use client";

import { useState } from "react";
import { AnalyticsChart } from "@/components/AnalyticsChart";

export default function AnalyticsPage() {
	const [inputTicker, setInputTicker] = useState("TSLA");
	const [activeTicker, setActiveTicker] = useState("TSLA");

	function normalizeTicker(raw: string): string {
		const next = raw.trim().toUpperCase();
		if (!next || next === "ALL") {
			return "SPY";
		}
		return next;
	}

	function handleLoad() {
		setActiveTicker(normalizeTicker(inputTicker));
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			handleLoad();
		}
		if (e.key === "Escape") {
			setInputTicker("");
			setActiveTicker("SPY");
		}
	}

	return (
		<section className="space-y-4">
			<div className="border border-zinc-800 bg-zinc-950 p-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
						Ticker
					</span>
					<input
						suppressHydrationWarning
						value={inputTicker}
						onChange={(e) => setInputTicker(e.target.value)}
						onKeyDown={handleKeyDown}
						className="h-8 w-24 border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs uppercase tracking-wider text-zinc-200 outline-none focus:border-zinc-500"
						placeholder="SPY"
						maxLength={10}
					/>
					<button
						type="button"
						onClick={handleLoad}
						className="h-8 border border-zinc-700 bg-zinc-950 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
					>
						Load
					</button>
					<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
						Active: {activeTicker}
					</span>
				</div>
				<p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">
					Hint: Enter = Load, Esc = Clear, All maps to SPY
				</p>
			</div>

			<div className="grid gap-2 lg:grid-cols-3">
				<div className="border border-zinc-800 bg-zinc-950 px-3 py-2">
					<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">W. Market Tape</p>
					<p className="mt-2 font-mono text-[10px] leading-relaxed text-zinc-600">
						5-minute candlesticks sourced from Yahoo Finance for responsive, zero-key market context.
					</p>
				</div>
				<div className="border border-zinc-800 bg-zinc-950 px-3 py-2">
					<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">A. Panic Engine</p>
					<p className="mt-2 font-mono text-[10px] leading-relaxed text-zinc-600">
						FinBERT-derived panic bars are pinned to the lower panel. Scores above 80 are highlighted in red.
					</p>
				</div>
				<div className="border border-zinc-800 bg-zinc-950 px-3 py-2">
					<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">X. Signal Intel</p>
					<p className="mt-2 font-mono text-[10px] leading-relaxed text-zinc-600">
						Hover crosshair to inspect the exact headline that generated each historical panic datapoint.
					</p>
				</div>
			</div>

			<AnalyticsChart ticker={activeTicker} />
		</section>
	);
}
