const yahooFinance = require('yahoo-finance2').default;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'NVDA';
  try {
    const q = await yahooFinance.quote(symbol, {}, { validateResult: false });
    res.status(200).json({
      symbol,
      price:               q.regularMarketPrice,
      fiftyDayAverage:     q.fiftyDayAverage,
      twoHundredDayAverage:q.twoHundredDayAverage,
      fiftyTwoWeekHigh:    q.fiftyTwoWeekHigh,
      fiftyTwoWeekLow:     q.fiftyTwoWeekLow,
      trailingPE:          q.trailingPE,
      forwardPE:           q.forwardPE,
    });
  } catch(e) {
    res.status(500).json({ error: e.message, symbol });
  }
};
