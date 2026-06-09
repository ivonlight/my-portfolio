// api/prices.js — Yahoo Finance with crumb authentication
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');

  const symbols = [
    'BRK-B','NVDA','PLTR','QQQ','TSLA','FLKR','NOW',
    '0050.TW','2330.TW','009816.TW','00981A.TWO','00988A.TWO',
    '2454.TW','2363.TW','4956.TW','8104.TW','2327.TW','6719.TW','6683.TW','00631L.TW',
    '5292.TW','2301.TW',
    'LLY','GOOG','AMZN','AAPL','MRVL','META','MSFT','GLW','AVGO','ORCL','VRT','GEV',
    'TWD=X',
  ];

  const results = {};

  // Step 1: Get cookie + crumb
  let cookie = '', crumb = '';
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    const setCookie = cookieRes.headers.get('set-cookie') || '';
    const match = setCookie.match(/A3=[^;]+/);
    if (match) cookie = match[0];
    if (cookie) {
      const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie, 'Accept': '*/*' },
      });
      crumb = await crumbRes.text();
    }
  } catch(e) {}

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com',
    ...(cookie ? { 'Cookie': cookie } : {}),
  };

  // Step 2: Fetch basic price data for all symbols
  await Promise.all(symbols.map(async (symbol) => {
    try {
      const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d${crumbParam}`;
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
        price, w52High, w52Low, w52Position,
        change: meta.regularMarketChangePercent ?? 0,
        currency: meta.currency,
        marketState: meta.marketState,
        pe: null, targetPrice: null, targetUpside: null, analystCount: null,
      };
    } catch(e) {
      results[symbol] = { price: null, error: e.message };
    }
  }));

  // Step 3: Fetch analyst data (PE + target price) for stocks that have prices
  // Only for non-ETF, non-FX symbols
  const analystSymbols = symbols.filter(s =>
    results[s]?.price &&
    !s.includes('.TW') && !s.includes('.TWO') &&
    s !== 'TWD=X' &&
    !['QQQ','SPY','GLD','TLT','FLKR'].includes(s)
  );

  await Promise.all(analystSymbols.map(async (symbol) => {
    try {
      const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData,defaultKeyStatistics${crumbParam}`;
      const r = await fetch(url, { headers: baseHeaders });
      if (!r.ok) return;
      const data = await r.json();
      const fd = data?.quoteSummary?.result?.[0]?.financialData;
      const ks = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics;

      if (fd && results[symbol]) {
        const target = fd.targetMeanPrice?.raw ?? null;
        const price  = results[symbol].price;
        results[symbol].targetPrice   = target ? Math.round(target * 100) / 100 : null;
        results[symbol].targetUpside  = (target && price) ? Math.round((target - price) / price * 1000) / 10 : null;
        results[symbol].analystCount  = fd.numberOfAnalystOpinions?.raw ?? null;
        results[symbol].recommendation = fd.recommendationKey ?? null;
      }
      if (ks && results[symbol]) {
        results[symbol].pe     = ks.forwardPE?.raw ?? null;
        results[symbol].trailPE = ks.trailingPE?.raw ?? null;
      }
    } catch(e) {}
  }));

  // Also try Taiwan stocks for analyst data
  const twAnalystSymbols = [
    '2330.TW','2454.TW','2327.TW','2363.TW','009816.TW'
  ].filter(s => results[s]?.price);

  await Promise.all(twAnalystSymbols.map(async (symbol) => {
    try {
      const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData,defaultKeyStatistics${crumbParam}`;
      const r = await fetch(url, { headers: baseHeaders });
      if (!r.ok) return;
      const data = await r.json();
      const fd = data?.quoteSummary?.result?.[0]?.financialData;
      const ks = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
      if (fd && results[symbol]) {
        const target = fd.targetMeanPrice?.raw ?? null;
        const price  = results[symbol].price;
        results[symbol].targetPrice  = target ? Math.round(target * 100) / 100 : null;
        results[symbol].targetUpside = (target && price) ? Math.round((target - price) / price * 1000) / 10 : null;
        results[symbol].analystCount = fd.numberOfAnalystOpinions?.raw ?? null;
        results[symbol].recommendation = fd.recommendationKey ?? null;
      }
      if (ks && results[symbol]) {
        results[symbol].pe      = ks.forwardPE?.raw ?? null;
        results[symbol].trailPE = ks.trailingPE?.raw ?? null;
      }
    } catch(e) {}
  }));

  res.status(200).json({ prices: results, crumbOk: !!crumb });
};
