// api/prices.js — Vercel Serverless Function
// 從伺服器端抓 Yahoo Finance，避免 CORS 問題

export default async function handler(req, res) {
  // 允許跨來源請求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300'); // 快取 60 秒

  const symbols = [
    // 美股
    'BRK-B', 'NVDA', 'PLTR', 'QQQ', 'TSLA', 'TSM',
    // 台股（Yahoo Finance 格式加 .TW）
    '0050.TW', '2330.TW', '009816.TW', '00981A.TWO', '00988A.TWO',
    '2454.TW', '3135.TW', '5292.TW', '8033.TW',
    'MSFT','GOOGL','META','AMZN','AMD','ARM','SMCI','MRVL','ALAB','ANET',
    '2379.TW','2308.TW','3034.TW','6669.TW','2382.TW','3231.TW','2357.TW','4938.TW','6415.TW','2317.TW','3324.TW','2377.TW',
  // 新族群
  'CEG','VST','GEV','ETN','TER','RKLB','LUNR',
  '3711.TW','6239.TW','3264.TW','6257.TW',
  '2049.TW','2395.TW','1503.TW','2314.TW'
  ];

  const results = {};
  const errors = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) throw new Error('No meta data');

        // 優先用 regularMarketPrice，盤後用 postMarketPrice
        const price = meta.regularMarketPrice ?? meta.previousClose;
        const prev  = meta.previousClose ?? meta.chartPreviousClose;
        const change = prev ? ((price - prev) / prev * 100) : 0;

        results[symbol] = {
          price: Math.round(price * 100) / 100,
          change: Math.round(change * 100) / 100,
          currency: meta.currency,
          marketState: meta.marketState, // REGULAR / PRE / POST / CLOSED
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
}
