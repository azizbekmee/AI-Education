import type { Question, SafeQuestion } from "@/types";

export function toSafe(q: Question): SafeQuestion {
  return { id: q.id, text: q.text, options: q.options, concept: q.concept };
}

export function toSafeAll(questions: Question[]): SafeQuestion[] {
  return questions.map(toSafe);
}

export function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
