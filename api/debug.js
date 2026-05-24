// api/debug.js — 查看單一股票的完整回傳資料
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'NVDA';

  try {
    const q = await yahooFinance.quote(symbol, {}, { validateResult: false });

    // 只回傳技術面和估值相關欄位
    res.status(200).json({
      symbol,
      price:            q.regularMarketPrice,
      fiftyDayAverage:  q.fiftyDayAverage,
      twoHundredDayAverage: q.twoHundredDayAverage,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
      fiftyTwoWeekLow:  q.fiftyTwoWeekLow,
      trailingPE:       q.trailingPE,
      forwardPE:        q.forwardPE,
      // 回傳所有可用的 key，方便查看
      allKeys: Object.keys(q).filter(k => q[k] !== null && q[k] !== undefined),
    });
  } catch(e) {
    res.status(500).json({ error: e.message, symbol });
  }
}
