// api/prices.js — CommonJS 版本，解決 ERR_PACKAGE_PATH_NOT_EXPORTED 問題
const yahooFinance = require('yahoo-finance2').default;

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

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const q = await yahooFinance.quote(symbol, {}, { validateResult: false });

        let summary = null;
        try {
          summary = await yahooFinance.quoteSummary(symbol, {
            modules: ['defaultKeyStatistics', 'summaryDetail', 'financialData'],
          }, { validateResult: false });
        } catch(e) {}

        const price    = q.regularMarketPrice ?? q.previousClose ?? null;
        const w52High  = q.fiftyTwoWeekHigh ?? null;
        const w52Low   = q.fiftyTwoWeekLow  ?? null;
        const ma50     = q.fiftyDayAverage  ?? null;
        const ma200    = q.twoHundredDayAverage ?? null;

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

        const pe   = q.trailingPE ?? summary?.summaryDetail?.trailingPE ?? null;
        const fwPe = q.forwardPE  ?? summary?.summaryDetail?.forwardPE  ?? null;
        const pb   = summary?.defaultKeyStatistics?.priceToBook ?? null;
        const roe  = summary?.financialData?.returnOnEquity ?? null;

        let techSignal = 'neutral';
        if (w52Position !== null && ma50 && price) {
          if      (w52Position <= 20 && price > ma50)  techSignal = 'buy';
          else if (w52Position <= 35 && price > ma200) techSignal = 'watch';
          else if (w52Position >= 85)                  techSignal = 'overbought';
          else if (price < ma50 && price < ma200)      techSignal = 'weak';
        }

        results[symbol] = {
          price,
          change:      q.regularMarketChangePercent ?? 0,
          currency:    q.currency,
          marketState: q.marketState,
          w52High, w52Low, w52Position,
          ma50, ma200, maSignal, techSignal,
          pe:   pe   ? Math.round(pe   * 10)  / 10   : null,
          fwPe: fwPe ? Math.round(fwPe * 10)  / 10   : null,
          pb:   pb   ? Math.round(pb   * 100) / 100   : null,
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
