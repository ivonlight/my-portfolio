module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'NVDA';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  };
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail%2CdefaultKeyStatistics%2CfinancialData`;
    const r = await fetch(url, { headers });
    const d = await r.json();
    const result = d?.quoteSummary?.result?.[0];
    res.status(200).json({
      symbol,
      status: r.status,
      summaryDetail:       result?.summaryDetail       ?? null,
      defaultKeyStatistics:result?.defaultKeyStatistics ?? null,
      financialData:       result?.financialData        ?? null,
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
