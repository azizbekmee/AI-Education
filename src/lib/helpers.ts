import type { Activity, AnswerPayload, Experience, SafeActivity, SafeExperience } from "@/types";

export function toSafeActivity(a: Activity): SafeActivity {
  return {
    id: a.id,
    kind: a.kind,
    concept: a.concept,
    prompt: a.prompt,
    title: a.title,
    options: a.options,
    items: a.items,
  };
}

export function toSafeExperience(e: Experience): SafeExperience {
  return {
    id: e.id,
    title: e.title,
    typeLabel: e.typeLabel,
    icon: e.icon,
    intro: e.intro,
    objective: e.objective,
    activities: (e.activities ?? []).map(toSafeActivity),
  };
}

export function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function answerText(activity: Activity, answer: AnswerPayload): string {
  switch (activity.kind) {
    case "choice":
      return activity.options?.[answer.index ?? -1] ?? "(javob tanlanmadi)";
    case "numeric":
      return (answer.value ?? "").trim() || "(javob kiritilmadi)";
    case "ordering":
      return (answer.order ?? []).join(" → ");
    default:
      return (answer.text ?? "").trim() || "(javob yozilmadi)";
  }
}
