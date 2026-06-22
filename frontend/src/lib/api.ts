// frontend/src/lib/api.ts

export const API_BASE = typeof window === "undefined"
  ? "http://backend:8000"
  : "http://127.0.0.1:8000";

export interface FullSentimentPayload {
  panic_score: number | null;
  headlines: string[];
}

export interface HistoryRow {
  id: number;
  panic_score: number;
  top_headline: string;
  ticker: string;
  timestamp: string;
}

// Helper to safely parse the live sentiment JSON
export function parseFullSentimentPayload(data: any): FullSentimentPayload {
  if (
    typeof data === "object" &&
    data !== null &&
    (typeof data.panic_score === "number" || data.panic_score === null) &&
    Array.isArray(data.headlines)
  ) {
    return data as FullSentimentPayload;
  }
  return { panic_score: null, headlines: [] };
}

// Helper to safely parse the PostgreSQL history array
export function parseHistoryPayload(data: any): HistoryRow[] {
  if (Array.isArray(data)) {
    const rows: HistoryRow[] = [];
    for (const item of data) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "number" &&
        typeof item.panic_score === "number" &&
        typeof item.top_headline === "string" &&
        typeof item.timestamp === "string"
      ) {
        rows.push({
          id: item.id,
          panic_score: item.panic_score,
          top_headline: item.top_headline,
          ticker: typeof item.ticker === "string" ? item.ticker : "ALL",
          timestamp: item.timestamp,
        });
      }
    }
    return rows;
  }
  return [];
}