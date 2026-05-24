module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'NVDA';

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/',
  };

  const results = {};

  // Try v8 chart - has fiftyDayAverage etc in meta
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { headers }
    );
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    results.v8_chart = {
      status: r.status,
      fiftyDayAverage: meta?.fiftyDayAverage,
      twoHundredDayAverage: meta?.twoHundredDayAverage,
      fiftyTwoWeekHigh: meta?.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta?.fiftyTwoWeekLow,
      regularMarketPrice: meta?.regularMarketPrice,
      trailingPE: meta?.trailingPE,
      // show all meta keys
      allMetaKeys: meta ? Object.keys(meta) : [],
    };
  } catch(e) { results.v8_chart = { error: e.message }; }

  // Try v7 quote
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}&fields=fiftyDayAverage,twoHundredDayAverage,trailingPE,forwardPE,priceToBook,fiftyTwoWeekHigh,fiftyTwoWeekLow`,
      { headers }
    );
    const d = await r.json();
    const q = d?.quoteResponse?.result?.[0];
    results.v7_quote = {
      status: r.status,
      fiftyDayAverage: q?.fiftyDayAverage,
      twoHundredDayAverage: q?.twoHundredDayAverage,
      trailingPE: q?.trailingPE,
      forwardPE: q?.forwardPE,
      fiftyTwoWeekHigh: q?.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: q?.fiftyTwoWeekLow,
    };
  } catch(e) { results.v7_quote = { error: e.message }; }

  // Try v11 quoteSummary
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=summaryDetail,defaultKeyStatistics`,
      { headers }
    );
    const d = await r.json();
    const result = d?.quoteSummary?.result?.[0];
    results.v11_summary = {
      status: r.status,
      trailingPE: result?.summaryDetail?.trailingPE?.raw,
      forwardPE: result?.summaryDetail?.forwardPE?.raw,
      fiftyDayAverage: result?.summaryDetail?.fiftyDayAverage?.raw,
      twoHundredDayAverage: result?.summaryDetail?.twoHundredDayAverage?.raw,
      priceToBook: result?.defaultKeyStatistics?.priceToBook?.raw,
    };
  } catch(e) { results.v11_summary = { error: e.message }; }

  res.status(200).json(results);
};
