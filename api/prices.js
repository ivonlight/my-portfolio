// api/prices.js — Yahoo Finance with crumb authentication
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');

  const symbols = [
    'BRK-B','NVDA','PLTR','QQQ','TSLA','FLKR','NOW',
    '0050.TW','2330.TW','009816.TW','00981A.TWO','00988A.TWO',
    '2454.TW','2363.TW','4956.TW','8104.TW','2327.TW',
    'TWD=X',
  ];

  const results = {};

  // Step 1: Get cookie + crumb from Yahoo Finance
  let cookie = '';
  let crumb  = '';
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
      redirect: 'follow',
    });
    const setCookie = cookieRes.headers.get('set-cookie') || '';
    // Extract A3 cookie
    const match = setCookie.match(/A3=[^;]+/);
    if (match) cookie = match[0];

    // Step 2: Get crumb
    if (cookie) {
      const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': cookie,
          'Accept': '*/*',
        },
      });
      crumb = await crumbRes.text();
    }
  } catch(e) {
    console.error('Cookie/crumb error:', e.message);
  }

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com',
    ...(cookie ? { 'Cookie': cookie } : {}),
  };

  // Step 3: Fetch prices for all symbols
  await Promise.all(symbols.map(async (symbol) => {
    try {
      const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false${crumbParam}`;
      const r = await fetch(url, { headers: baseHeaders });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) throw new Error('No meta');

      const price = meta.regularMarketPrice ?? meta.previousClose ?? null;
      const w52High = meta.fiftyTwoWeekHigh ?? null;
      const w52Low  = meta.fiftyTwoWeekLow  ?? null;

      let w52Position = null;
      if (w52High && w52Low && w52High !== w52Low && price) {
        w52Position = Math.round((price - w52Low) / (w52High - w52Low) * 100);
      }

      results[symbol] = {
        price,
        change:      meta.regularMarketChangePercent ?? 0,
        currency:    meta.currency,
        marketState: meta.marketState,
        w52High, w52Low, w52Position,
        ma50: null, ma200: null, maSignal: null, techSignal: 'neutral',
        pe: null, fwPe: null, pb: null, roe: null,
      };
    } catch(e) {
      results[symbol] = { price: null, error: e.message };
    }
  }));

  // Check if we got any prices
  const gotPrices = Object.values(results).filter(r => r.price).length;

  // If crumb approach failed, try v6 quote endpoint as fallback
  if (gotPrices === 0) {
    try {
      const batchSymbols = symbols.join(',');
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(batchSymbols)}&fields=regularMarketPrice,regularMarketChangePercent,fiftyTwoWeekHigh,fiftyTwoWeekLow`;
      const r = await fetch(url, { headers: baseHeaders });
      if (r.ok) {
        const data = await r.json();
        const quotes = data?.quoteResponse?.result || [];
        quotes.forEach(q => {
          const price = q.regularMarketPrice;
          const w52High = q.fiftyTwoWeekHigh;
          const w52Low  = q.fiftyTwoWeekLow;
          let w52Position = null;
          if (w52High && w52Low && w52High !== w52Low && price) {
            w52Position = Math.round((price - w52Low) / (w52High - w52Low) * 100);
          }
          results[q.symbol] = {
            price, w52High, w52Low, w52Position,
            change: q.regularMarketChangePercent ?? 0,
            currency: q.currency, marketState: q.marketState,
            ma50: null, ma200: null, maSignal: null, techSignal: 'neutral',
            pe: null, fwPe: null, pb: null, roe: null,
          };
        });
      }
    } catch(e) {
      console.error('Fallback error:', e.message);
    }
  }

  res.status(200).json({ prices: results, crumbOk: !!crumb, gotPrices });
};
