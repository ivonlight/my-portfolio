// api/prices.js — 不依賴任何套件，直接用 fetch 打 Yahoo Finance
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');

  const symbols = [
    'BRK-B','NVDA','PLTR','QQQ','TSLA','TSM',
    '0050.TW','2330.TW','009816.TW','00981A.TWO','00988A.TWO',
    '2454.TW','3135.TW','5292.TW','8033.TW',
  ];

  const results = {};
  const errors = [];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        // Yahoo Finance v8 chart API - most reliable
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
        const r = await fetch(url, { headers });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) throw new Error('No meta');

        const price = meta.regularMarketPrice ?? meta.previousClose ?? null;

        // 52週高低點從 v8 chart meta 取得（唯一可靠來源）
        const w52High = meta.fiftyTwoWeekHigh ?? null;
        const w52Low  = meta.fiftyTwoWeekLow  ?? null;
        const ma50    = null; // Yahoo Finance 已鎖定此欄位
        const ma200   = null;

        let w52Position = null;
        if (w52High && w52Low && w52High !== w52Low && price) {
          w52Position = Math.round((price - w52Low) / (w52High - w52Low) * 100);
        }

        let maSignal = null;
        if (price && ma50 && ma200) {
          if      (price > ma50 && price > ma200 && ma50 > ma200) maSignal = 'strong_up';
          else if (price > ma50 && price > ma200)                 maSignal = 'up';
          else if (price < ma50 && price < ma200)                 maSignal = 'down';
          else                                                    maSignal = 'mixed';
        }

        let techSignal = 'neutral';
        if (w52Position !== null && price) {
          if      (ma50 && w52Position <= 20 && price > ma50)  techSignal = 'buy';
          else if (ma200 && w52Position <= 35 && price > ma200) techSignal = 'watch';
          else if (w52Position >= 85)                           techSignal = 'overbought';
          else if (ma50 && ma200 && price < ma50 && price < ma200) techSignal = 'weak';
        }

        const pe = null, fwPe = null, pb = null, roe = null;

        results[symbol] = {
          price,
          change:      meta.regularMarketChangePercent ?? 0,
          currency:    meta.currency,
          marketState: meta.marketState,
          w52High, w52Low, w52Position,
          ma50, ma200, maSignal, techSignal,
          pe:   pe   ? Math.round(pe   * 10)   / 10  : null,
          fwPe: fwPe ? Math.round(fwPe * 10)   / 10  : null,
          pb:   pb   ? Math.round(pb   * 100)  / 100  : null,
          roe:  roe  ? Math.round(roe  * 1000) / 10   : null,
        };
      } catch (e) {
        errors.push({ symbol, error: e.message });
        results[symbol] = null;
      }
    })
  );

  res.status(200).json({
    updated: new Date().toISOString(),
    prices: results,
    errors,
  });
};
