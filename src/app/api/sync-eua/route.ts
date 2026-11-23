import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ updated: false, error: 'Missing Supabase env vars' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let liveEuaEur: number | null = null;
    let source = 'fallback';

    // 1. Primary: Yahoo Finance EU Carbon Permits / ICE EUA Futures proxy (CO2.L / CFI2Z26.NYM)
    const tickers = ['CO2.L', 'CFI2Z26.NYM'];
    for (const ticker of tickers) {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store',
          }
        );
        if (res.ok) {
          const json = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          const price = Number(meta?.regularMarketPrice);
          const currency = String(meta?.currency || '').toUpperCase();

          if (price > 10 && price < 300) {
            if (currency === 'EUR') {
              liveEuaEur = Number(price.toFixed(2));
              source = ticker;
              break;
            } else if (currency === 'USD') {
              // Convert USD to EUR using live EURUSD=X
              const fxRes = await fetch(
                'https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d',
                { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
              );
              const fxJson = await fxRes.json();
              const eurUsd = Number(fxJson?.chart?.result?.[0]?.meta?.regularMarketPrice) || 1.08;
              liveEuaEur = Number((price / eurUsd).toFixed(2));
              source = `${ticker} (FX adjusted)`;
              break;
            }
          }
        }
      } catch {
        // Continue to next source
      }
    }

    // 2. Fallback: Read current cached price from Supabase so timestamp refreshes cleanly
    const { data: existing } = await supabase
      .from('market_rates')
      .select('price')
      .eq('indicator_name', 'EU Carbon Permits')
      .maybeSingle();

    const finalPrice = liveEuaEur ?? (existing?.price ? Number(existing.price) : 84.85);

    const { error: upsertErr } = await supabase
      .from('market_rates')
      .upsert(
        {
          indicator_name: 'EU Carbon Permits',
          price: finalPrice,
          unit: 'EUR/tCO2',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'indicator_name' }
      );

    if (upsertErr) {
      return NextResponse.json({ updated: false, error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      updated: true,
      price: finalPrice,
      source,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { updated: false, error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
