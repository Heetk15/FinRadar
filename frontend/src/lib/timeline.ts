export type TimelineOption = "24H" | "1W" | "1M" | "1Y" | "ALL";

export const TIMELINE_OPTIONS: TimelineOption[] = ["24H", "1W", "1M", "1Y", "ALL"];

export const TIMELINE_MS: Record<Exclude<TimelineOption, "ALL">, number> = {
  "24H": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};