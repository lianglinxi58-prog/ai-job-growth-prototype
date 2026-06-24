import OpenAI from "openai";
import { randomUUID } from "node:crypto";

export const config = {
  maxDuration: 60
};

const DIMENSIONS = {
  targetClarity: "\u76ee\u6807\u6e05\u6670\u5ea6",
  skillMatch: "\u6280\u80fd\u5339\u914d\u5ea6",
  practiceCompleteness: "\u5b9e\u8df5\u7ecf\u5386\u5b8c\u6574\u5ea6",
  resumeExpression: "\u7b80\u5386\u8868\u8fbe\u57fa\u7840",
  actionReadiness: "\u6c42\u804c\u884c\u52a8\u51c6\u5907\u5ea6"
};

const AUDIT_DIRECTIONS = [
  "\u4f1a\u8ba1\u5e08\u4e8b\u52a1\u6240\u5ba1\u8ba1",
  "\u4f01\u4e1a\u5185\u5ba1/\u5185\u63a7",
  "\u8d22\u52a1\u5206\u6790",
  "\u98ce\u9669\u63a7\u5236"
];

function cleanText(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 2000);
}

function normalizeInput(body = {}) {
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  return {
    school: cleanText(body.school),
    grade: cleanText(body.grade),
    major: cleanText(body.major),
    targetRole: cleanText(body.targetRole),
    skills: cleanText(body.skills),
    experience: cleanText(body.experience),
    resumeUploaded: Boolean(body.resumeUploaded),
    concern: cleanText(body.concern)
  };
}

function clampScore(value, fallback = 60) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function asArray(value, fallback = [], limit) {
  const array = Array.isArray(value) ? value.filter(item => typeof item === "string" && item.trim()) : fallback;
  return typeof limit === "number" ? array.slice(0, limit) : array;
}

function normalizeTask(task = {}, index) {
  return {
    title: cleanText(task.title) || `\u672c\u6708\u6210\u957f\u4efb\u52a1 ${index + 1}`,
    goal: cleanText(task.goal) || "\u56f4\u7ed5\u76ee\u6807\u5c97\u4f4d\u8865\u9f50\u5173\u952e\u6c42\u804c\u8d44\u4ea7\u3002",
    standard: cleanText(task.standard) || "\u5b8c\u6210\u4e00\u4efd\u53ef\u5c55\u793a\u7684\u9636\u6bb5\u4ea7\u51fa\u3002",
    output: cleanText(task.output) || "\u9879\u76ee\u8bb0\u5f55\u3001\u7b80\u5386\u8868\u8fbe\u548c\u9762\u8bd5\u56de\u7b54\u7a3f\u3002"
  };
}

function isAuditFinanceProfile(profile) {
  const text = `${profile.targetRole} ${profile.major} ${profile.skills} ${profile.experience}`;
  return ["\u5ba1\u8ba1", "\u8d22\u52a1", "\u4f1a\u8ba1", "\u7a0e\u52a1", "\u8d22\u7a0e", "\u56db\u5927", "\u4e8b\u52a1\u6240", "\u5e95\u7a3f", "\u51fd\u8bc1", "\u76d8\u70b9", "\u5185\u63a7", "\u98ce\u63a7"].some(keyword => text.includes(keyword));
}

function normalizeReport(raw = {}, profile) {
  const dimensions = raw.dimensions && typeof raw.dimensions === "object" ? raw.dimensions : {};
  const monthlyTasks = Array.isArray(raw.monthlyTasks) ? raw.monthlyTasks : [];
  const auditProfile = isAuditFinanceProfile(profile);

  const report = {
    score: clampScore(raw.score),
    match: clampScore(raw.match),
    diagnosis: cleanText(raw.diagnosis) || "\u5df2\u57fa\u4e8e\u5f53\u524d\u4fe1\u606f\u751f\u6210\u6c42\u804c\u529b\u8bca\u65ad\u3002",
    advantages: asArray(raw.advantages, [], 3),
    weaknesses: asArray(raw.weaknesses, [], 3),
    dimensions: {
      [DIMENSIONS.targetClarity]: clampScore(dimensions[DIMENSIONS.targetClarity]),
      [DIMENSIONS.skillMatch]: clampScore(dimensions[DIMENSIONS.skillMatch]),
      [DIMENSIONS.practiceCompleteness]: clampScore(dimensions[DIMENSIONS.practiceCompleteness]),
      [DIMENSIONS.resumeExpression]: clampScore(dimensions[DIMENSIONS.resumeExpression]),
      [DIMENSIONS.actionReadiness]: clampScore(dimensions[DIMENSIONS.actionReadiness])
    },
    resumeSummary: cleanText(raw.resumeSummary) || (profile.resumeUploaded
      ? "\u5df2\u7ed3\u5408\u7b80\u5386\u9644\u4ef6\u4e0e\u8868\u5355\u4fe1\u606f\u751f\u6210\u8bc4\u4f30\u3002"
      : "\u5f53\u524d\u8bc4\u4f30\u57fa\u4e8e\u8868\u5355\u4fe1\u606f\uff0c\u4e0a\u4f20\u7b80\u5386\u540e\u53ef\u8fdb\u4e00\u6b65\u63d0\u9ad8\u51c6\u786e\u6027\u3002"),
    suitableDirections: asArray(raw.suitableDirections, auditProfile ? AUDIT_DIRECTIONS : [], 4),
    monthlyTasks: monthlyTasks.slice(0, 3).map(normalizeTask),
    resumeBullets: asArray(raw.resumeBullets, [], 3),
    interviewQuestions: asArray(raw.interviewQuestions, [], 5),
    nextAction: cleanText(raw.nextAction) || "\u4f18\u5148\u8865\u9f50\u4e00\u6bb5\u53ef\u5199\u5165\u7b80\u5386\u7684\u9879\u76ee\u7ecf\u5386\u3002"
  };

  while (report.advantages.length < 3) report.advantages.push("\u5df2\u6709\u7ecf\u5386\u53ef\u8fdb\u4e00\u6b65\u68b3\u7406\u4e3a\u6c42\u804c\u7d20\u6750");
  while (report.weaknesses.length < 3) report.weaknesses.push("\u9700\u8981\u8865\u5145\u66f4\u5177\u4f53\u7684\u7ed3\u679c\u4e0e\u8bc1\u636e");
  while (report.monthlyTasks.length < 3) report.monthlyTasks.push(normalizeTask({}, report.monthlyTasks.length));
  while (report.resumeBullets.length < 3) report.resumeBullets.push("\u8bf7\u8865\u5145\u9879\u76ee\u80cc\u666f\u3001\u4e2a\u4eba\u884c\u52a8\u548c\u53ef\u91cf\u5316\u7ed3\u679c\uff0c\u5f62\u6210\u66f4\u5b8c\u6574\u7684\u7b80\u5386\u8868\u8fbe\u3002");
  while (report.interviewQuestions.length < 5) report.interviewQuestions.push("\u8fd9\u6bb5\u7ecf\u5386\u6700\u80fd\u8bc1\u660e\u4f60\u54ea\u9879\u5c97\u4f4d\u80fd\u529b\uff1f");
  if (auditProfile) report.suitableDirections = AUDIT_DIRECTIONS;
  while (report.suitableDirections.length < 4) report.suitableDirections.push("\u7b80\u5386\u8d44\u4ea7\u5efa\u8bbe");

  return report;
}

function buildPrompt(profile) {
  return `Please analyze this Chinese university student's career readiness profile and return only JSON.

User profile:
${JSON.stringify(profile, null, 2)}

Return this exact JSON structure, with Chinese user-facing content. Replace every type placeholder with a real value:
{
  "score": "integer from 0 to 100",
  "match": "integer from 0 to 100",
  "diagnosis": "",
  "advantages": ["", "", ""],
  "weaknesses": ["", "", ""],
  "dimensions": {
    "\u76ee\u6807\u6e05\u6670\u5ea6": "integer from 0 to 100",
    "\u6280\u80fd\u5339\u914d\u5ea6": "integer from 0 to 100",
    "\u5b9e\u8df5\u7ecf\u5386\u5b8c\u6574\u5ea6": "integer from 0 to 100",
    "\u7b80\u5386\u8868\u8fbe\u57fa\u7840": "integer from 0 to 100",
    "\u6c42\u804c\u884c\u52a8\u51c6\u5907\u5ea6": "integer from 0 to 100"
  },
  "resumeSummary": "",
  "suitableDirections": ["", "", "", ""],
  "monthlyTasks": [
    {
      "title": "",
      "goal": "",
      "standard": "",
      "output": ""
    }
  ],
  "resumeBullets": ["", "", ""],
  "interviewQuestions": ["", "", "", "", ""],
  "nextAction": ""
}

Rules:
- Do not invent unprovided experiences, data, awards, employers, or outcomes.
- If information is limited, say the judgment is based on limited information.
- Understand the target role requirements beyond keyword matching.
- Do not promise offers or hiring outcomes.
- Derive every score independently from the supplied profile. Never copy a placeholder as the score.
- For audit/accounting/finance roles, suitableDirections should include: \u4f1a\u8ba1\u5e08\u4e8b\u52a1\u6240\u5ba1\u8ba1, \u4f01\u4e1a\u5185\u5ba1/\u5185\u63a7, \u8d22\u52a1\u5206\u6790, \u98ce\u9669\u63a7\u5236.
- Return valid JSON only. No Markdown.`;
}

function parseModelJson(outputText) {
  const cleaned = outputText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new SyntaxError("AI response is not valid JSON");
  }
}

function safeErrorDetails(error, stage, requestId, startedAt) {
  return {
    event: "analyze_failed",
    requestId,
    stage,
    elapsedMs: Date.now() - startedAt,
    name: error?.name || "Error",
    type: error?.type || null,
    code: error?.code || null,
    status: Number(error?.status) || null
  };
}

export default async function handler(req, res) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  res.setHeader("X-Request-Id", requestId);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error({ event: "analyze_config_error", requestId, stage: "configuration", code: "missing_api_key" });
    return res.status(503).json({ error: "AI service is temporarily unavailable", requestId });
  }

  let stage = "input";
  try {
    const profile = normalizeInput(req.body);
    const hasMeaningfulInput = [profile.targetRole, profile.skills, profile.experience, profile.concern].some(Boolean);
    if (!hasMeaningfulInput) {
      return res.status(400).json({ error: "Please provide career information before analysis", requestId });
    }

    stage = "model_request";
    const client = new OpenAI({ apiKey, timeout: 25000, maxRetries: 1 });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            "You are an AI career growth coach for Chinese university students preparing for internships.",
            "You must return valid JSON only. Do not return Markdown, code fences, or explanations.",
            "All visible report content should be in Chinese."
          ].join(" ")
        },
        { role: "user", content: buildPrompt(profile) }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4
    });

    const outputText = completion.choices?.[0]?.message?.content;
    if (!outputText) {
      const emptyError = new Error("AI response is empty");
      emptyError.status = 502;
      throw emptyError;
    }

    stage = "model_parse";
    const parsed = parseModelJson(outputText);

    stage = "response_normalize";
    res.setHeader("X-Analysis-Source", "ai");
    return res.status(200).json({ ...normalizeReport(parsed, profile), source: "api", requestId });
  } catch (error) {
    console.error(safeErrorDetails(error, stage, requestId, startedAt));
    const upstreamStatus = Number(error?.status);
    const status = upstreamStatus === 429
      ? 429
      : (error?.name === "APIConnectionTimeoutError" || error?.code === "ETIMEDOUT" ? 504 : 502);
    return res.status(status).json({ error: "AI service is temporarily unavailable", requestId });
  }
}
