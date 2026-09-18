import type { Experience } from "@/types";

/**
 * Gemini as optional secondary validator: checks that AI-designed activities
 * are academically valid. Returns null when no API key is set (skipped) or on
 * any failure — in that case the experience is used as-is.
 */
export async function validateExperience(experience: Experience): Promise<string[] | null> {
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
                  text: `Siz ta'lim tajribalari validatorisan. Har bir qadamni tekshir: to'g'ri javob haqiqatan to'g'rimi, faqat bitta aniq javob bormi, savol o'zbek tilida ravsanmi.
FAQAT quyidagi JSON formatini qaytar: {"invalidIds":["..."]}
Hammasi joyida bo'lsa: {"invalidIds":[]}

Qadamlar:
${experience.activities
  .map(
    (a) =>
      `id=${a.id} kind=${a.kind} savol=${a.prompt} to'g'ri javob=${a.solution}${a.options ? ` variantlar=${a.options.join(" | ")}` : ""}`
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
