import Anthropic from "@anthropic-ai/sdk";
import type {
  AdaptiveResult,
  Question,
  ReportData,
  SessionSummary,
  StudentProfile,
} from "@/types";
import { fallbackQuestions } from "./fallback";

export function isAiEnabled() {
  return Boolean(process.env.ANTHROPIC_AUTH_TOKEN);
}

function getClient() {
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!token) throw new Error("AI_NOT_CONFIGURED");
  return new Anthropic({
    authToken: token,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });
}

function getModel() {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

const LANGUAGE_RULE = `
MUHIM: Barcha matnlar (savollar, variantlar, tushuncha nomlari, xabarlar, feedback)
FAQAT O'ZBEK TILIDA, LOTIN YOZUVIDA bo'lishi kerak.`;

async function callClaude(system: string, user: string, maxTokens = 3500): Promise<string> {
  const client = getClient();
  const res = await client.messages.create({
    model: getModel(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("NO_JSON");
  return JSON.parse(text.slice(start, end + 1));
}

const AGENT_SYSTEM = `Sen shaxsiylashtirilgan ta'lim platformasi uchun AI o'qituvchi agentsan.
Vazifang — o'qituvchining topshirig'ini o'quvchining qiziqishlari va o'rganish usuliga moslashtirib,
sifatli test savollarini yaratish. Akademik maqsad HECH QACHON o'zgarmasligi kerak: savol
qiziqarli kontekstda bo'lishi mumkin, lekin matematik/mavzuiy jihatdan aynan topshiriqdagi
bilimni tekshirishi shart.
Faqat STRICT JSON qaytar. Markdown, izoh va qo'shimcha matn bo'lmasin.
${LANGUAGE_RULE}`;

export async function generateQuestions(
  profile: StudentProfile,
  assignmentTitle: string,
  assignmentContent: string
): Promise<Question[]> {
  const user = `O'qituvchi topshirig'i:
Sarlavha: ${assignmentTitle}
Mazmun: ${assignmentContent}

O'quvchi profili:
Ism: ${profile.name}
Qiziqishlari: ${profile.interests.join(", ")}
O'rganish usuli: ${profile.learningStyle}

Vazifa: aynan shu topshiriq mavzusini tekshiruvchi 5 ta test savoli yarat.
Har bir savolni o'quvchining qiziqishlari (futbol, o'yinlar va h.k.) bilan tabiiy
ravishda bog'la — lekin matematik mohiyat aynan topshiriqdagi mavzudan bo'lsin.
Savollar osondan qiyinga monot bo'lsin (1-oson, 5-eng qiyin).
To'g'ri javoblar turli pozitsiyalarda bo'lsin.

JSON format:
{"questions":[{"id":"q1","text":"...","options":["...","...","...","..."],"correctIndex":0,"concept":"Qisqa tushuncha nomi","contextTag":"futbol yoki o'yinlar yoki texnologiya yoki umumiy"}]}`;

  const raw = await callClaude(AGENT_SYSTEM, user);
  const parsed = extractJson(raw) as { questions?: Question[] };
  const questions = parsed.questions;
  if (!Array.isArray(questions) || questions.length < 5) throw new Error("BAD_SHAPE");
  for (const q of questions) {
    if (
      typeof q.text !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      typeof q.correctIndex !== "number" ||
      q.correctIndex < 0 ||
      q.correctIndex > 3
    ) {
      throw new Error("BAD_SHAPE");
    }
  }
  return questions.slice(0, 5);
}

export async function generateAdaptive(
  profile: StudentProfile,
  original: Question,
  chosenText: string,
  attemptNo: number
): Promise<AdaptiveResult> {
  const user = `O'quvchi ${original.text} savoliga noto'g'ri javob berdi.

Savol: ${original.text}
Variantlar: ${original.options.join(" | ")}
To'g'ri javob: ${original.options[original.correctIndex]}
O'quvchining javobi: ${chosenText}
Tushuncha: ${original.concept}
Urinish raqami: ${attemptNo}

O'quvchi profili: Ism ${profile.name}, qiziqishlari: ${profile.interests.join(", ")}, o'rganish usuli: ${profile.learningStyle}.

Vazifa:
1. "message" — 1-2 jumlalik iliq, rag'bant beruvchi o'zbekcha xabar. To'g'ri javobni OCHIQMA.
2. "question" — shu o'xshash yangi savol: bir xil tushuncha (${original.concept}), lekin
   boshqa yechish yo'li va boshqa kontekst bilan. Qiyinligi o'xshash bo'lsin.

JSON format:
{"message":"...","question":{"id":"a1","text":"...","options":["...","...","...","..."],"correctIndex":0,"concept":"${original.concept}","contextTag":"..."}}`;

  const raw = await callClaude(AGENT_SYSTEM, user, 1500);
  const parsed = extractJson(raw) as { message?: string; question?: Question };
  const q = parsed.question;
  if (!parsed.message || !q || !Array.isArray(q.options) || q.options.length !== 4) {
    throw new Error("BAD_SHAPE");
  }
  if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) {
    throw new Error("BAD_SHAPE");
  }
  return { message: parsed.message, question: q };
}

export async function generateReport(
  profile: StudentProfile,
  assignmentTitle: string,
  summaries: SessionSummary[],
  computedMastery: number
): Promise<ReportData> {
  const user = `Topshiriq: ${assignmentTitle}
O'quvchi: ${profile.name} (qiziqishlari: ${profile.interests.join(", ")}, o'rganish usuli: ${profile.learningStyle})

Savollar bo'yicha natijalar:
${summaries
  .map(
    (s) =>
      `- "${s.questionText}" | tushuncha: ${s.concept} | o'quvchi javobi: ${s.chosenText} | to'g'ri javob: ${s.correctText} | urinishlar: ${s.attempts} | ${s.solved ? "yechildi" : "yechilmadi"}`
  )
  .join("\n")}

Hisoblangan o'zlashtirish darajasi: ${computedMastery}%

Vazifa: yakuniy hisobot yarat.
- "strengths": 2-3 ta kuchli tomon (qisqa tushuncha nomlari)
- "weaknesses": 1-2 ta rivojlanishi kerak bo'lgan tomon
- "feedback": ${profile.name} ga murojaat qilingan (sen deb) 3-4 jumlalik iliq, aniq o'zbekcha fikr-mulohaza. To'g'ri javoblar soni va xatolar asosida konkret maslahat ber.
O'zlashtirish darajasi sifatida aynan ${computedMastery}% dan foydalan.

JSON format:
{"strengths":["..."],"weaknesses":["..."],"feedback":"..."}`;

  const raw = await callClaude(AGENT_SYSTEM, user, 1500);
  const parsed = extractJson(raw) as {
    strengths?: string[];
    weaknesses?: string[];
    feedback?: string;
  };
  if (!Array.isArray(parsed.strengths) || !Array.isArray(parsed.weaknesses) || !parsed.feedback) {
    throw new Error("BAD_SHAPE");
  }
  return {
    mastery: computedMastery,
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    feedback: parsed.feedback,
  };
}

/** Wrapper: try AI, fall back to deterministic demo data on any failure. */
export async function safeGenerateQuestions(
  profile: StudentProfile,
  title: string,
  content: string
): Promise<{ questions: Question[]; source: "ai" | "fallback" }> {
  try {
    const questions = await generateQuestions(profile, title, content);
    return { questions, source: "ai" };
  } catch {
    return { questions: fallbackQuestions(), source: "fallback" };
  }
}
