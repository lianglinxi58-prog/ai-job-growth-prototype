import OpenAI from "openai";

const D = {
  targetClarity: "\u76ee\u6807\u6e05\u6670\u5ea6",
  skillMatch: "\u6280\u80fd\u5339\u914d\u5ea6",
  practiceCompleteness: "\u5b9e\u8df5\u7ecf\u5386\u5b8c\u6574\u5ea6",
  resumeExpression: "\u7b80\u5386\u8868\u8fbe\u57fa\u7840",
  actionReadiness: "\u6c42\u804c\u884c\u52a8\u51c6\u5907\u5ea6"
};

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "score",
    "match",
    "diagnosis",
    "advantages",
    "weaknesses",
    "dimensions",
    "resumeSummary",
    "monthlyTasks",
    "resumeBullets",
    "interviewQuestions",
    "nextAction"
  ],
  properties: {
    score: { type: "integer" },
    match: { type: "integer" },
    diagnosis: { type: "string" },
    advantages: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    dimensions: {
      type: "object",
      additionalProperties: false,
      required: Object.values(D),
      properties: {
        [D.targetClarity]: { type: "integer" },
        [D.skillMatch]: { type: "integer" },
        [D.practiceCompleteness]: { type: "integer" },
        [D.resumeExpression]: { type: "integer" },
        [D.actionReadiness]: { type: "integer" }
      }
    },
    resumeSummary: { type: "string" },
    monthlyTasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "goal", "standard", "output"],
        properties: {
          title: { type: "string" },
          goal: { type: "string" },
          standard: { type: "string" },
          output: { type: "string" }
        }
      }
    },
    resumeBullets: { type: "array", items: { type: "string" } },
    interviewQuestions: { type: "array", items: { type: "string" } },
    nextAction: { type: "string" }
  }
};

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY environment variable is not configured" });
  }

  try {
    const profile = normalizeInput(req.body);
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions: [
        "You are an AI career growth coach for Chinese university students preparing for internships.",
        "Analyze only from the user's provided information. Do not invent experiences, data, awards, companies, or outcomes.",
        "If information is limited, explicitly reflect that limitation in the analysis.",
        "Understand the target role requirements beyond keyword matching.",
        "Do not promise offers or hiring outcomes.",
        "Return Chinese user-facing content.",
        "All scores must be integers from 0 to 100.",
        "Return exactly 3 advantages, 3 weaknesses, 3 monthlyTasks, 3 resumeBullets, and 5 interviewQuestions.",
        "Return JSON only. Do not return Markdown."
      ].join("\n"),
      input: `Generate a structured career readiness report from this profile:\n${JSON.stringify(profile, null, 2)}`,
      text: {
        format: {
          type: "json_schema",
          name: "career_report",
          strict: true,
          schema: reportSchema
        }
      }
    });

    const outputText = response.output_text;
    if (!outputText) {
      return res.status(502).json({ error: "AI response is empty" });
    }

    return res.status(200).json(JSON.parse(outputText));
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Analyze API failed"
    });
  }
}
