const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ status: "ok" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      status: "error",
      message: "OPENROUTER_API_KEY environment variable not set"
    });
  }

  try {
    const body = req.body || {};

    if (body.task === "answer") {
      return await evaluateAnswer(body, apiKey, res);
    }

    if (body.task === "summary") {
      return await evaluateSummary(body, apiKey, res);
    }

    return res.status(400).json({
      status: "error",
      message: "Unknown evaluation task"
    });
  } catch (error) {
    console.error("AI evaluation error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || String(error)
    });
  }
};

async function evaluateAnswer(body, apiKey, res) {
  const level = clampInteger(body.level, 1, 5);
  const prompt = [
    "你是一位國小融合教育課程的 AI 老師，正在評分學生的開放式同理心策略。",
    "",
    "請根據題目情境，評估學生回答是否具備：",
    "1. 安全意識：避免衝突擴大，必要時找老師協助。",
    "2. 同理與尊重：不嘲笑、不貼標籤、不把同學當麻煩。",
    "3. 具體行動：有可執行的協助方式，而不是只有抽象安慰。",
    "4. 低壓力支持：避免讓需要協助的同學成為焦點。",
    "5. 班級融合：能協助旁人理解、一起維持友善氛圍。",
    "",
    "第 4 題滿分 7 分，重點是情緒失控時先確保安全、降低刺激、找老師、同理陪伴、協助恢復現場。",
    "第 5 題滿分 7 分，重點是自然邀請、保護自尊、避免公開點名或強迫、協助小組接納。",
    "",
    "請只回傳 JSON，不要加上 Markdown。格式：",
    "{",
    '  "score": 0到7的整數,',
    '  "rating": "一句短稱號",',
    '  "feedback": "80到140字繁體中文回饋，先肯定可取之處，再給一個具體改進建議"',
    "}",
    "",
    `關卡：${level}`,
    `標題：${body.title || ""}`,
    `題目：${body.question || ""}`,
    `學生回答：${body.answer || ""}`
  ].join("\n");

  const result = await askOpenRouter(prompt, apiKey);
  return res.status(200).json({
    score: clampInteger(result.score, 0, 7),
    rating: String(result.rating || "AI同理策略回饋"),
    feedback: String(result.feedback || "你已完成回答。下次可以再補上更具體、安全且尊重的行動。")
  });
}

async function evaluateSummary(body, apiKey, res) {
  const currentScore = clampInteger(body.currentScore, 0, 20);
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const prompt = [
    "你是一位國小融合教育課程的 AI 老師，請根據學生五題表現產生最後總結。",
    "",
    "前三題是選擇題，各 2 分；第四、第五題是 AI 開放式評分，各 7 分；總分滿分 20 分。",
    `目前累計分數是 ${currentScore} / 20。請以目前累計分數為主要依據，不要任意大幅更動；除非作答紀錄明顯矛盾，總分最多只能調整 1 分。`,
    "",
    "請只回傳 JSON，不要加上 Markdown。格式：",
    "{",
    '  "totalScore": 0到20的整數,',
    '  "title": "一個適合學生表現的繁體中文稱號",',
    '  "finalAdvice": "120到180字繁體中文總結，包含整體優點、最需要加強的一點、以及未來在校園中可實踐的一個具體建議"',
    "}",
    "",
    "作答紀錄：",
    JSON.stringify(answers, null, 2)
  ].join("\n");

  const result = await askOpenRouter(prompt, apiKey);
  return res.status(200).json({
    totalScore: clampInteger(result.totalScore ?? currentScore, 0, 20),
    title: String(result.title || (currentScore >= 15 ? "特教融合領航大師" : "溫暖校園包容天使")),
    finalAdvice: String(result.finalAdvice || "你已完成所有關卡，請持續練習用安全、尊重、低壓力的方式支持同學。")
  });
}

async function askOpenRouter(prompt, apiKey) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": getSiteUrl(),
      "X-OpenRouter-Title": process.env.OPENROUTER_APP_NAME || "Empathy Explorer"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "你是一位溫柔、專業、適合國小學生的融合教育 AI 評量老師。所有回覆都必須是繁體中文 JSON。"
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `OpenRouter request failed: ${response.status}`;
    throw new Error(message);
  }

  const content = data.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Unable to parse AI JSON: ${content}`);
  }
}

function clampInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function getSiteUrl() {
  const siteUrl = process.env.OPENROUTER_SITE_URL || process.env.VERCEL_URL || "https://empathy-explorer.vercel.app";
  if (/^https?:\/\//i.test(siteUrl)) return siteUrl;
  return `https://${siteUrl}`;
}
