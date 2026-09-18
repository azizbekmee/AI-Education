import type { Activity, AnswerPayload } from "@/types";
import { callClaude, extractJson } from "@/lib/ai/claude";
import { GRADER_SYSTEM } from "./prompts";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/=/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numbersIn(s: string): number[] {
  return (s.replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function numericMatch(input: string, accepted: string[]): boolean {
  const normInput = normalize(input);
  for (const a of accepted) {
    if (normalize(a) === normInput) return true;
  }
  const inputNums = numbersIn(input);
  if (inputNums.length === 1) {
    for (const a of accepted) {
      const aNums = numbersIn(a);
      if (aNums.includes(inputNums[0])) return true;
    }
  }
  return false;
}

export function isCorrectAnswer(activity: Activity, answer: AnswerPayload): boolean | null {
  switch (activity.kind) {
    case "choice": {
      if (typeof answer.index !== "number" || !Number.isInteger(answer.index)) return null;
      return answer.index === activity.correctIndex;
    }
    case "numeric": {
      const v = (answer.value ?? "").trim();
      if (!v) return null;
      return numericMatch(v, activity.acceptedAnswers ?? [activity.solution]);
    }
    case "ordering": {
      const order = answer.order ?? [];
      const target = activity.correctOrder ?? [];
      if (order.length !== target.length) return false;
      return order.every((item, i) => item.trim() === target[i].trim());
    }
    case "free_response": {
      return null; // needs AI grading
    }
    default: {
      const t = (answer.text ?? "").trim();
      if (!t) return null;
      return null; // unknown kinds graded by AI
    }
  }
}

export function wrongAnswerText(activity: Activity, answer: AnswerPayload): string {
  switch (activity.kind) {
    case "choice":
      return activity.options?.[answer.index ?? -1] ?? "(tanhuv qilinmadi)";
    case "numeric":
      return answer.value ?? "";
    case "ordering":
      return (answer.order ?? []).join(" → ");
    default:
      return answer.text ?? "";
  }
}

/** AI grading of free responses; deterministic fallback accepts the answer. */
export async function judgeFreeResponse(
  activity: Activity,
  text: string
): Promise<{ correct: boolean; message: string; usedFallback: boolean }> {
  const fallback = { correct: true, message: "Javobing qabul qilindi — izohingni tahlil qilib chiqdim.", usedFallback: true };
  try {
    const raw = await callClaude(
      GRADER_SYSTEM,
      `Qadam: ${activity.prompt}
Kutilayotgan mohiyat (yechim): ${activity.solution}

O'quvchining javobi:
${text}`,
      400
    );
    const parsed = extractJson(raw) as { correct?: boolean; message?: string };
    if (typeof parsed.correct !== "boolean") throw new Error("BAD_SHAPE");
    return { correct: parsed.correct, message: parsed.message || "Fikr-mulohaza qabul qilindi.", usedFallback: false };
  } catch {
    return fallback;
  }
}
