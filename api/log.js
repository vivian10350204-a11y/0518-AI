// 檔案：api/log.js

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理 OPTIONS 預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: 'ok' });
  }

  // 只接受 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    // 讀取環境變數中的 GAS URL
    const gasUrl = process.env.GAS_URL;

    if (!gasUrl) {
      return res.status(500).json({
        status: 'error',
        message: 'GAS_URL environment variable not set'
      });
    }

    // Vercel 會自動解析 req.body 為 JSON
    // 將資料轉成 form-urlencoded 後轉送給 GAS
    const params = new URLSearchParams(req.body).toString();
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params,
      redirect: 'follow'
    });

    // GAS 可能會回傳純文字或 JSON
    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();
    if (contentType.includes('application/json')) {
      return res.status(200).json(JSON.parse(responseText));
    }

    return res.status(200).json({ status: 'ok', body: responseText });

  } catch (error) {
    console.error('Error forwarding to GAS:', error);
    return res.status(500).json({
      status: 'error',
      message: error.toString()
    });
  }
};