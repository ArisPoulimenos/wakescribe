import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const finnhubKey = process.env.FINNHUB_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ updated: false, error: 'Missing Supabase env vars' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let liveEuaEur: number | null = null;
    let source = 'cached_fallback';
    const debugNotes: string[] = [];

    // 1. Primary (Zero API key required): Live EU Carbon Permits (EUR/tCO2) benchmark
    try {
      const teRes = await fetch('https://tradingeconomics.com/commodity/carbon', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html',
        },
        cache: 'no-store',
      });
      if (teRes.ok) {
        const html = await teRes.text();
        // Match the live spot/front-month EUR price displayed on the EU Carbon Permits quote table
        const match =
          html.match(/EU Carbon Permits[\s\S]{0,600}?>\s*([5-9]\d\.\d{2}|1[0-4]\d\.\d{2})\s*</i) ||
          html.match(/id=["']p["'][^>]*>\s*([5-9]\d\.\d{2}|1[0-4]\d\.\d{2})\s*</i);
        if (match && match[1]) {
          const parsed = Number(match[1]);
          if (parsed >= 40 && parsed <= 160) {
            liveEuaEur = Number(parsed.toFixed(2));
            source = 'EU_Carbon_Spot_EUR';
          }
        } else {
          debugNotes.push('TE_pattern_not_matched');
        }
      } else {
        debugNotes.push(`TE_status_${teRes.status}`);
      }
    } catch (e) {
      debugNotes.push(`TE_err_${e instanceof Error ? e.message : 'unknown'}`);
    }

    // 2. Secondary (Backup inside Plan A): Finnhub KEUA + Free ECB FX (frankfurter.app)
    if (!liveEuaEur && finnhubKey) {
      try {
        const [quoteRes, fxRes] = await Promise.all([
          fetch(`https://finnhub.io/api/v1/quote?symbol=KEUA&token=${finnhubKey}`, { cache: 'no-store' }),
          fetch('https://api.frankfurter.app/latest?from=EUR&to=USD', { cache: 'no-store' }),
        ]);

        const quote = quoteRes.ok ? await quoteRes.json() : null;
        const fx = fxRes.ok ? await fxRes.json() : null;
        const usdPrice = Number(quote?.c || quote?.pc); // current price or previous close
        const eurUsd = Number(fx?.rates?.USD) || 1.08;

        if (usdPrice > 5) {
          liveEuaEur = Number(((usdPrice / eurUsd) * 2.55).toFixed(2));
          source = 'finnhub_KEUA_ECB_FX';
        } else {
          debugNotes.push(`Finnhub_quote_${JSON.stringify(quote)}`);
        }
      } catch (e) {
        debugNotes.push(`Finnhub_err_${e instanceof Error ? e.message : 'unknown'}`);
      }
    } else if (!finnhubKey) {
      debugNotes.push('FINNHUB_API_KEY_not_loaded');
    }

    // 3. Tertiary: Supabase cached rate
    const { data: existing, error: selErr } = await supabase
      .from('market_rates')
      .select('id, price')
      .eq('indicator_name', 'EU Carbon Permits')
      .maybeSingle();

    if (selErr) {
      return NextResponse.json({ updated: false, error: selErr.message }, { status: 500 });
    }

    const finalPrice = liveEuaEur ?? (existing?.price ? Number(existing.price) : 84.85);
    const nowIso = new Date().toISOString();

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from('market_rates')
        .update({ price: finalPrice, updated_at: nowIso })
        .eq('id', existing.id);
      if (updErr) {
        return NextResponse.json({ updated: false, error: updErr.message }, { status: 500 });
      }
    } else {
      const { error: insErr } = await supabase
        .from('market_rates')
        .insert({
          indicator_name: 'EU Carbon Permits',
          price: finalPrice,
          unit: 'EUR/tCO2',
          updated_at: nowIso,
        });
      if (insErr) {
        return NextResponse.json({ updated: false, error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      updated: true,
      price: finalPrice,
      source,
      debug: debugNotes,
      updated_at: nowIso,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { updated: false, error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
