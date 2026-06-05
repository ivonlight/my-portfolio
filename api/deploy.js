// api/deploy.js — 把最新的 index.html 推到 GitHub
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'Missing html' });

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER   = process.env.GITHUB_OWNER || 'ivonlight';
  const REPO_NAME    = process.env.GITHUB_REPO  || 'my-portfolio';
  const FILE_PATH    = 'public/index.html';

  if (!GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not set in Vercel env' });

  try {
    const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const headers = {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'portfolio-dashboard',
    };

    // Step 1: Get current file SHA (required for update)
    const getRes = await fetch(apiBase, { headers });
    if (!getRes.ok) throw new Error(`GitHub GET failed: ${getRes.status}`);
    const fileData = await getRes.json();
    const sha = fileData.sha;

    // Step 2: Push updated file
    const content = Buffer.from(html, 'utf-8').toString('base64');
    const pushRes = await fetch(apiBase, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Dashboard update ${new Date().toLocaleString('zh-TW', {timeZone:'Asia/Taipei'})}`,
        content,
        sha,
      }),
    });

    if (!pushRes.ok) {
      const err = await pushRes.json();
      throw new Error(`GitHub PUT failed: ${pushRes.status} — ${JSON.stringify(err)}`);
    }

    const result = await pushRes.json();
    res.status(200).json({
      success: true,
      commit: result.commit?.sha?.slice(0,7),
      message: '已推送到 GitHub，Vercel 正在重新部署（約 30 秒）',
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
