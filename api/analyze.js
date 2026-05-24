module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode } = req.body;
  const prompts = {
    portfolio: `你是投資組合分析師，請用繁體中文分析以下持倉：\n台股：0050+93.88%、台積電+36.5%、聯發科+20%、華懋-8.82%\n美股：NVDA+25.5%、TSLA+37.65%、BRK/B+1.15%、QQQ+25.1%\n分析：1)健康度 2)3個風險點 3)下一步行動`,
    buy: `請用繁體中文分析以下存股加碼時機：0050現價$97.3(均價$50.1)、台積電現價$2255(均價$1645)、BRK/B現價$480(均價$474)、QQQ現價$714(均價$571)。各說明是否合理加碼及建議價位。`,
    risk: `請用繁體中文列出以下組合風險：台積電三重曝險(0050+2330+TSM)、華懋-8.82%虧損44張、TSLA+37.65%未鎖利0.89股、NVDA均價$174.9共10.87股。給具體停損價位。`,
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompts[mode] || prompts.portfolio }],
      }),
    });
    const data = await response.json();
    res.status(200).json({ text: data.content?.[0]?.text || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
