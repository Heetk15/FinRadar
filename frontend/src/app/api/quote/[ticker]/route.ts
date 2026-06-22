import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  // 1. Extract and normalize the ticker
  const ticker = params.ticker === "ALL" || !params.ticker ? "SPY" : params.ticker.toUpperCase();
  
  try {
    // 2. Fetch data from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=5m&range=5d`;
    const res = await fetch(url, { 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://finance.yahoo.com",
        "Referer": "https://finance.yahoo.com/"
      }, 
      cache: "no-store" 
    });
    
    if (!res.ok) {
      throw new Error(`Yahoo Finance API failed with status: ${res.status}`);
    }
    
    const data = await res.json();
    
    // 3. Safely extract arrays from Yahoo's deeply nested JSON
    const result = data.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      return NextResponse.json([]); // Return empty if market data is missing
    }

    const times = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    // 4. Format the data for the charting library
    const formatted = times
      .map((t: number, i: number) => ({
        time: t, 
        open: quotes.open[i], 
        high: quotes.high[i], 
        low: quotes.low[i], 
        close: quotes.close[i]
      }))
      .filter((c: { open: number | null }) => c.open !== null && c.open !== undefined);
    
    // 5. Return the clean data
    return NextResponse.json(formatted);

  } catch (error) {
    console.error(`Quote API Error for ${ticker}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch market data" }, 
      { status: 500 }
    );
  }
}