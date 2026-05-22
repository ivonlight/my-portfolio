// api/prices.js — 使用 yahoo-finance2 套件，繞過 Cookie/CORS 問題
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  const symbols = [
    // 持倉
    'BRK-B','NVDA','PLTR','QQQ','TSLA','TSM',
    '0050.TW','2330.TW','009816.TW','00981A.TWO','00988A.TWO',
    '2454.TW','3135.TW','5292.TW','8033.TW',
    // AI族群
    'MSFT','GOOGL','META','AMZN','AMD','ARM','SMCI','MRVL','ALAB','ANET',
    // AI電力
    'CEG','VST','GEV','ETN',
    // 機器人/太空
    'TER','RKLB','LUNR',
    // 台股觀察
    '2379.TW','2308.TW','3034.TW','6669.TW','2382.TW','3231.TW',
    '2357.TW','4938.TW','6415.TW','2317.TW','3324.TW','2377.TW',
    '3711.TW','6239.TW','3264.TW','6257.TW',
    '2049.TW','2395.TW','1503.TW','2314.TW',
  ];

  const results = {};
  const errors = [];

  // 用 yahoo-finance2 批次查詢，自動處理 cookie
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await yahooFinance.quote(symbol, {}, { validateResult: false });
        results[symbol] = {
          price: quote.regularMarketPrice ?? quote.previousClose ?? null,
          change: quote.regularMarketChangePercent ?? 0,
          currency: quote.currency,
          marketState: quote.marketState,
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
