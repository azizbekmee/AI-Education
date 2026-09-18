import type { Activity, StudentProfile } from "@/types";
import { callClaude, extractJson } from "@/lib/ai/claude";
import { ADAPT_SYSTEM, adaptUserPrompt } from "./prompts";
import { fallbackAdapt } from "./fallback";

export interface Adaptation {
  route: string;
  message: string;
  activity: Activity;
}

function coerceAdaptedActivity(raw: unknown, original: Activity, attemptNo: number): Activity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = coerce(r.kind, r);
  const prompt = String(r.prompt ?? "").trim();
  if (!prompt) return null;
  const act: Activity = {
    id: `adapt-${attemptNo}-${Date.now() % 100000}`,
    kind,
    concept: original.concept,
    prompt,
    title: r.title ? String(r.title) : undefined,
    solution: String(r.solution ?? "").trim() || original.solution,
  };

  if (kind === "choice") {
    if (!Array.isArray(r.options) || r.options.length < 2) return null;
    act.options = r.options.slice(0, 4).map(String);
    act.correctIndex =
      typeof r.correctIndex === "number" && r.correctIndex >= 0 && r.correctIndex < act.options.length
        ? r.correctIndex
        : 0;
    if (!act.solution) act.solution = act.options[act.correctIndex];
  } else if (kind === "numeric") {
    const accepted = Array.isArray(r.acceptedAnswers) && r.acceptedAnswers.length ? r.acceptedAnswers : [];
    if (!accepted.length && !act.solution) return null;
    act.acceptedAnswers = accepted.length ? accepted.map(String) : [act.solution];
  } else if (kind === "ordering") {
    if (!Array.isArray(r.items) || r.items.length < 2) return null;
    act.items = r.items.map(String);
    act.correctOrder =
      Array.isArray(r.correctOrder) && r.correctOrder.length === act.items.length
        ? r.correctOrder.map(String)
        : [...act.items];
    if (!act.solution) act.solution = act.correctOrder.join(" → ");
  } else if (kind === "free_response") {
    if (!act.solution) act.solution = original.solution;
  }

  return act;
}

function coerce(kind: unknown, raw: Record<string, unknown>): Activity["kind"] {
  if (typeof kind === "string" && ["choice", "numeric", "ordering", "free_response"].includes(kind)) {
    return kind as Activity["kind"];
  }
  if (Array.isArray(raw.options)) return "choice";
  if (Array.isArray(raw.items)) return "ordering";
  if (Array.isArray(raw.acceptedAnswers)) return "numeric";
  return "free_response";
}

/**
 * On a wrong answer: diagnose what the student misunderstood and re-teach the
 * same concept through a DIFFERENT cognitive route. AI-designed; falls back to
 * deterministic simpler sub-problems.
 */
export async function adaptToMistake(input: {
  profile: StudentProfile;
  experienceTypeLabel: string;
  original: Activity;
  wrongAnswer: string;
  attemptNo: number;
}): Promise<Adaptation> {
  const fb = fallbackAdapt(input.original, input.attemptNo);
  try {
    const raw = await callClaude(
      ADAPT_SYSTEM,
      adaptUserPrompt({
        name: input.profile.name,
        interests: input.profile.interests,
        activityJson: JSON.stringify({
          kind: input.original.kind,
          concept: input.original.concept,
          prompt: input.original.prompt,
          options: input.original.options,
          solution: input.original.solution,
        }),
        wrongAnswer: input.wrongAnswer,
        attemptNo: input.attemptNo,
        experienceTypeLabel: input.experienceTypeLabel,
      }),
      2500
    );
    const parsed = extractJson(raw) as { message?: string; route?: string; activity?: unknown };
    const activity = coerceAdaptedActivity(parsed.activity, input.original, input.attemptNo);
    if (!parsed.message || !activity) throw new Error("BAD_SHAPE");
    return { route: parsed.route || "boshqa yo'l", message: parsed.message, activity };
  } catch {
    return fb;
  }
}
