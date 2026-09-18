import type { Question } from "@/types";

/**
 * Gemini as secondary validator: checks generated questions.
 * Returns null when no API key is set (validator skipped) or on any failure.
 */
export async function validateQuestions(questions: Question[]): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Siz ta'lim testlari validatorisan. Har bir savolni tekshir: to'g'ri javob matematik jihatdan haqiqatan to'g'rimi, faqat bitta to'g'ri variant bormi, savol o'zbek tilida ravsanmi.
FAQAT quyidagi JSON formatini qaytar:
{"invalidIds":["..."]}
Hammasi joyida bo'lsa: {"invalidIds":[]}

Savollar:
${questions
  .map(
    (q, i) =>
      `${i + 1}. id=${q.id} ${q.text} Variantlar: ${q.options.join(" | ")}. To'g'ri: ${q.options[q.correctIndex]}`
  )
  .join("\n")}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(text.slice(start, end + 1)) as { invalidIds?: string[] };
    return Array.isArray(parsed.invalidIds) ? parsed.invalidIds : [];
  } catch {
    return null;
  }
}
