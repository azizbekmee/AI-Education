import { callClaude, callClaudeWithFiles, extractJson, type AiFileBlock } from "@/lib/ai/claude";
import type { OriginalAssignment, OriginalQuestion } from "@/types";

export const EXTRACT_SYSTEM = `Sen o'qituvchi topshiriq fayllarini tahlil qiluvchi AJRATUVCHI (extractor)isan. Vazifang — fayllar mazmunidan TO'LIQ va O'ZGARTIRILSIZ ma'lumot chiqarish.

QAT'IY QOIDALAR:
1. Savollarni FAQAT faylda yozilganidek, SO'ZMA-SO'Z ko'chir. Savol matnini qayta yozma, soddalashtirma, tartibini o'zgartirma.
2. HECH QACHON yangi savol ixtiro qilma. Mavzu asosida o'zing savol yaratma. Faylda yo'q savolni qo'shma.
3. Faylda bir nechta fayl bo'lsa — hammasidagi savollarni birlashtirib, tartibini saqla.
4. Har bir savol uchun qisqa reference javob yech (answer) — bu o'quvchiga hech qachon ko'rsatilmaydi, faqat server tomonda tekshiruv uchun.
5. Talablar (requirements) — fayldagi ko'rsatmalar: "yechim bosqichlarini yozing", "kamida 200 so'z" kabi.
6. Cheklovlar (constraints) — cheklovlar: vaqt, hajm, ruxsat etilmagan vositalar.
7. expectedOutput — o'quvchi nima topshirishi kerak (masalan: "5 ta tenglamaning to'liq yechimi").
8. instruction — o'qituvchining ko'rsatmasi: fayldagi topshiriq mazmuni (masalan "barcha masalalarni ishlab chiqing"). Faylda yo'q bo'lsa bo'sh satr "".
9. wordCount — fayllardagi taxminiy so'zlar soni.

STRICT JSON qaytar. Markdown, izohlar va JSON tashqarisidagi har qanday matn taqiqlanadi.

JSON format:
{"title":"fayldagi topshiriq nomi","requirements":["..."],"questions":[{"text":"so'zma-so'z savol","answer":"qisqa to'g'ri javob","answerType":"numeric|short|free"}],"constraints":"...","wordCount":123,"expectedOutput":"...","instruction":"..."}`;

export interface ExtractInput {
  className: string;
  topicName: string;
  note: string;
  files: AiFileBlock[];
}

export interface ExtractResult {
  ok: boolean;
  original?: OriginalAssignment;
  /** Uzbek message shown to the teacher on failure */
  error?: string;
}

const ANSWER_TYPES = ["numeric", "short", "free"] as const;

function coerceOriginal(raw: unknown, fallbackRawText: string): OriginalAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rawQuestions = Array.isArray(r.questions) ? r.questions : [];
  const questions: OriginalQuestion[] = [];
  for (const q of rawQuestions) {
    if (!q || typeof q !== "object") continue;
    const qr = q as Record<string, unknown>;
    const text = String(qr.text ?? "").trim();
    if (!text) continue;
    const answerType = ANSWER_TYPES.includes(qr.answerType as (typeof ANSWER_TYPES)[number])
      ? (qr.answerType as OriginalQuestion["answerType"])
      : "short";
    questions.push({ text, answer: String(qr.answer ?? "").trim(), answerType });
  }
  const requirements = Array.isArray(r.requirements)
    ? r.requirements.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (questions.length === 0 && requirements.length === 0 && !fallbackRawText.trim()) {
    return null;
  }
  const wordCount = typeof r.wordCount === "number" && Number.isFinite(r.wordCount) ? Math.round(r.wordCount) : undefined;
  return {
    title: String(r.title ?? "").trim(),
    requirements,
    questions,
    constraints: String(r.constraints ?? "").trim(),
    rawText: fallbackRawText,
    extractedByAi: true,
    wordCount,
    expectedOutput: String(r.expectedOutput ?? "").trim(),
    instruction: String(r.instruction ?? "").trim(),
  };
}

/**
 * Extract the original assignment (verbatim questions, requirements, constraints,
 * metadata) from the uploaded files with AI. Never throws — a failure is returned
 * as { ok: false, error } so the assignment flow can always continue.
 */
export async function extractAssignment(input: ExtractInput): Promise<ExtractResult> {
  const fileSummary = input.files.map((f, i) => `${i + 1}. ${f.name}`).join("\n");
  const userPrompt = `O'quvchi sinfi: ${input.className}
Mavzu: ${input.topicName}
O'qituvchi izohi: ${input.note.trim() || "yo'q"}
Fayllar:
${fileSummary}

Yuqoridagi fayllarni tahlil qilib, original topshiriqni ajratib, STRICT JSON qaytar.`;

  const hasBinary = input.files.some((f) => f.kind !== "text");
  const textOnly = input.files.filter((f): f is Extract<AiFileBlock, { kind: "text" }> => f.kind === "text");
  const fallbackRawText = textOnly.map((f) => `— ${f.name} —\n${f.text}`).join("\n\n");

  // 1st attempt: send the files themselves (PDF/image blocks + text)
  if (hasBinary) {
    try {
      const raw = await callClaudeWithFiles(EXTRACT_SYSTEM, userPrompt, input.files);
      const original = coerceOriginal(extractJson(raw), fallbackRawText);
      if (original) return { ok: true, original };
    } catch {
      // fall through to the text-only retry below
    }
  }

  // 2nd attempt (or 1st for pure-text uploads): text contents only
  if (fallbackRawText.trim()) {
    try {
      const raw = await callClaude(EXTRACT_SYSTEM, `${fallbackRawText}\n\n${userPrompt}`);
      const original = coerceOriginal(extractJson(raw), fallbackRawText);
      if (original) return { ok: true, original };
    } catch {
      // fall through to the failure below
    }
  }

  return {
    ok: false,
    error:
      "AI fayl mazmunini ajrata olmadi. Faylda o'qib bo'lmaydigan yoki bo'sh kontent bo'lishi mumkin. Fayllarni tekshirib, «Qayta urinish» tugmasini bosing yoki topshiriqni matn fayli bilan qayta yuklang.",
  };
}
