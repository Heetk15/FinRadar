"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, Shield, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { LiveClock } from "@/components/LiveClock";

const NAV = [
  { href: "/", label: "Live monitor", Icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", Icon: Activity },
  { href: "/screener", label: "Screener", Icon: Table2 },
] as const;

export function CommandChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-[#f97316]" strokeWidth={1.5} />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-400">
              FinRadar / Intelligence
            </span>
          </div>

          <nav
            className="flex flex-wrap items-center gap-1 border border-zinc-800 bg-zinc-950 p-1"
            aria-label="Primary"
          >
            {NAV.map(({ href, label, Icon }) => {
              const isRoot = href === "/";
              const match =
                isRoot
                  ? pathname === "/" || pathname === ""
                  : pathname === href || pathname?.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    match
                      ? "border-[#f97316] text-[#f97316]"
                      : "border-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 font-mono text-xs text-zinc-400">
            <span className="uppercase tracking-wider text-emerald-500/90">
              SYSTEM: OPERATIONAL
            </span>
            <LiveClock />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
