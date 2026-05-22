// api/analyze.js — Vercel Serverless Function for AI analysis
// Proxies requests to Anthropic API server-side to avoid CORS

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, prompt } = req.body;

  const prompts = {
    portfolio: `你是一位專業的投資組合分析師。以下是用戶目前的持倉數據，請用繁體中文給出具體、簡潔的分析：

【台股持倉】
- 0050 元大台灣50：成本 $50.1，現價 $97.3，+93.88%，市值 $330,951
- 2330 台積電：成本 $1,645，現價 $2,255，+36.5%，市值 $139,349
- 2454 聯發科：成本 $3,205，現價 $3,860，+20%，市值 $7,696
- 5292 華懋：成本 $239.84，現價 $219.5，-8.82%，市值 $9,627
- 凌航(+6.97%)、雷虎(+4.18%)

【美股持倉（USD）】
- BRK/B：均價 $474.52，現價 $479.98（存股）
- QQQ：均價 $571.05，現價 $714.51，+25%（存股）
- NVDA：均價 $174.9，10.87股，現價 $219.51，+25.5%
- TSLA：均價 $303.57，0.89股，現價 $417.85，+37.65%
- PLTR：均價 $133.11，1股，現價 $137.42，+3.23%
- TSM：均價 $340.34，0.29股，現價 $407.15，+19.63%

【基金】安聯台灣科技(+8.07%)、路博邁台日雙星(-0.75%)

請針對：1)整體組合健康度 2)最需要關注的3個風險點 3)建議的下一步行動，各給出2-3句具體建議。格式清楚、不用廢話。`,

    buy: `你是一位專業投資顧問。用戶有以下存股標的，想知道現在是否是好的加碼時機：

- 0050 元大台灣50：均價 $50.1，現價 $97.3（+93.88%）
- 台積電 2330：均價 $1,645，現價 $2,255（+36.5%）
- BRK/B：均價 $474.52，現價 $479.98（+1.15%）
- QQQ：均價 $571.05，現價 $714.51（+25.1%）

請用繁體中文針對每一檔，說明：
1. 現在加碼是否合理（從估值、技術面角度）
2. 建議等到什麼價位再加碼
3. 如果現在就要買，應該用什麼策略（一次買/分批/等回調）

回答要具體、有數字，不要模糊帶過。`,

    risk: `你是一位風險管理顧問。以下投資組合有哪些需要立即關注的風險，請用繁體中文回答：

持倉重點：
- 台積電相關曝險：持有2330現股 + TSM ADR + 0050（內含台積電約35%），三重曝險
- TSLA +37.65% 未鎖利（0.89股）
- 華懋5292 -8.82% 持續虧損（44股）
- NVDA兩批成本差距已合併，均價 $174.9
- 基金路博邁台日雙星 -0.75%

請針對每個風險點說明：1)具體風險是什麼 2)建議立即做什麼 3)設什麼警示價位。格式要清楚，數字要具體。`
  };

  const finalPrompt = prompt || prompts[mode] || prompts.portfolio;

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
        messages: [{ role: 'user', content: finalPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    res.status(200).json({ text });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
