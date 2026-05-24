// api/prices.js — 擴充版：現價 + 估值面 + 技術面（52週高低、均線位置）
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');

  const symbols = [
    // 持倉
    'BRK-B','NVDA','PLTR','QQQ','TSLA','TSM',
    '0050.TW','2330.TW','009816.TW','00981A.TWO','00988A.TWO',
    '2454.TW','3135.TW','5292.TW','8033.TW',
  ];

  const results = {};
  const errors = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        // quote() 抓現價 + 估值 + 52週高低
        const q = await yahooFinance.quote(symbol, {}, { validateResult: false });

        // quoteSummary() 抓更詳細的估值資料
        let summary = null;
        try {
          summary = await yahooFinance.quoteSummary(symbol, {
            modules: ['defaultKeyStatistics', 'summaryDetail', 'financialData'],
          }, { validateResult: false });
        } catch(e) {
          // quoteSummary 可能對部分台股不支援，失敗就跳過
        }

        const price = q.regularMarketPrice ?? q.previousClose ?? null;
        const w52High = q.fiftyTwoWeekHigh ?? null;
        const w52Low  = q.fiftyTwoWeekLow  ?? null;
        const ma50    = q.fiftyDayAverage  ?? null;
        const ma200   = q.twoHundredDayAverage ?? null;

        // 距離52週高低點的位置 (0%=最低, 100%=最高)
        let w52Position = null;
        if (w52High && w52Low && w52High !== w52Low && price) {
          w52Position = Math.round((price - w52Low) / (w52High - w52Low) * 100);
        }

        // 均線訊號
        let maSignal = null;
        if (price && ma50 && ma200) {
          if (price > ma50 && price > ma200 && ma50 > ma200) maSignal = 'strong_up';   // 多頭排列
          else if (price > ma50 && price > ma200)            maSignal = 'up';           // 價在均線上
          else if (price < ma50 && price < ma200)            maSignal = 'down';         // 價在均線下
          else                                               maSignal = 'mixed';        // 混合
        }

        // 估值資料
        const pe   = q.trailingPE ?? summary?.summaryDetail?.trailingPE ?? null;
        const fwPe = q.forwardPE  ?? summary?.summaryDetail?.forwardPE  ?? null;
        const pb   = summary?.defaultKeyStatistics?.priceToBook ?? null;
        const roe  = summary?.financialData?.returnOnEquity ?? null;

        // 技術面買進訊號
        let techSignal = 'neutral';
        if (w52Position !== null && ma50 && price) {
          if (w52Position <= 20 && price > ma50)        techSignal = 'buy';       // 近52週低點但站上月線
          else if (w52Position <= 35 && price > ma200)  techSignal = 'watch';     // 相對低位，站上年線
          else if (w52Position >= 85)                   techSignal = 'overbought';// 接近52週高點
          else if (price < ma50 && price < ma200)       techSignal = 'weak';      // 跌破均線
          else                                          techSignal = 'neutral';
        }

        results[symbol] = {
          // 現價
          price,
          change: q.regularMarketChangePercent ?? 0,
          currency: q.currency,
          marketState: q.marketState,
          // 52週
          w52High,
          w52Low,
          w52Position,  // 0-100，現價在52週高低之間的位置
          // 均線
          ma50,
          ma200,
          maSignal,     // strong_up / up / down / mixed / null
          techSignal,   // buy / watch / neutral / overbought / weak
          // 估值
          pe:   pe   ? Math.round(pe*10)/10   : null,
          fwPe: fwPe ? Math.round(fwPe*10)/10 : null,
          pb:   pb   ? Math.round(pb*100)/100  : null,
          roe:  roe  ? Math.round(roe*1000)/10 : null, // 轉換為%
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
