import type {
  Activity,
  Experience,
  ReportData,
  SessionSummary,
  StudentProfile,
} from "@/types";
import { callClaude, extractJson } from "@/lib/ai/claude";
import {
  DESIGNER_SYSTEM,
  REPORT_SYSTEM,
  designerUserPrompt,
  reportUserPrompt,
} from "./prompts";
import { fallbackExperience, fallbackReport } from "./fallback";

export interface DesignInput {
  profile: StudentProfile;
  assignmentTitle: string;
  assignmentContent: string;
  todayInterest: string;
  workMode?: string;
  previousMastery: number | null;
  previousWeaknesses: string[];
}

const KINDS = ["choice", "numeric", "ordering", "free_response"] as const;
type Kind = (typeof KINDS)[number];

function coerceKind(k: unknown, raw: Record<string, unknown>): Kind {
  if (typeof k === "string" && (KINDS as readonly string[]).includes(k)) return k as Kind;
  if (Array.isArray(raw.options)) return "choice";
  if (Array.isArray(raw.items)) return "ordering";
  if (Array.isArray(raw.acceptedAnswers) || typeof raw.value !== "undefined") return "numeric";
  return "free_response";
}

function coerceActivity(raw: Record<string, unknown>, index: number): Activity | null {
  const kind = coerceKind(raw.kind, raw);
  const prompt = String(raw.prompt ?? "").trim();
  const concept = String(raw.concept ?? "").trim() || "Mavzu";
  const title = raw.title ? String(raw.title).trim() : undefined;
  const act: Activity = { id: `act-${index + 1}`, kind, concept, prompt, solution: String(raw.solution ?? "").trim() };
  if (title) act.title = title;

  if (kind === "choice") {
    if (!Array.isArray(raw.options) || raw.options.length < 2) return null;
    act.options = raw.options.slice(0, 4).map((o) => String(o));
    act.correctIndex =
      typeof raw.correctIndex === "number" &&
      Number.isInteger(raw.correctIndex) &&
      raw.correctIndex >= 0 &&
      raw.correctIndex < act.options.length
        ? raw.correctIndex
        : 0;
    if (!act.solution) act.solution = act.options[act.correctIndex];
  } else if (kind === "numeric") {
    const accepted = Array.isArray(raw.acceptedAnswers) && raw.acceptedAnswers.length
      ? raw.acceptedAnswers
      : typeof raw.answer !== "undefined"
        ? [String(raw.answer)]
        : [];
    if (accepted.length === 0 && !act.solution) return null;
    act.acceptedAnswers = accepted.length ? accepted.map(String) : [act.solution];
    if (!act.solution) act.solution = act.acceptedAnswers[0];
  } else if (kind === "ordering") {
    if (!Array.isArray(raw.items) || raw.items.length < 2) return null;
    act.items = raw.items.map((i) => String(i));
    act.correctOrder = Array.isArray(raw.correctOrder) && raw.correctOrder.length === act.items.length
      ? raw.correctOrder.map((i) => String(i))
      : [...act.items];
    if (!act.solution) act.solution = act.correctOrder.join(" → ");
  } else if (kind === "free_response") {
    if (!act.solution) act.solution = "Erkin javob — mohiyatiga qarab baholanadi.";
  }

  if (!act.prompt || !act.solution) return null;
  return act;
}

export function coerceExperience(raw: unknown, fallback: Experience): Experience | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.activities) || r.activities.length < 4) return null;

  const activities: Activity[] = [];
  r.activities.slice(0, 7).forEach((a, i) => {
    if (!a || typeof a !== "object") return;
    const act = coerceActivity(a as Record<string, unknown>, i);
    if (act) activities.push(act);
  });
  if (activities.length < 4) return null;

  return {
    id: `exp-${Date.now()}`,
    title: String(r.title ?? "").trim() || fallback.title,
    typeLabel: String(r.typeLabel ?? "").trim() || fallback.typeLabel,
    icon: String(r.icon ?? "✨").slice(0, 4) || "✨",
    intro: String(r.intro ?? "").trim() || fallback.intro,
    objective: String(r.objective ?? "").trim() || fallback.objective,
    activities,
  };
}

/** Design a personalized learning experience. Falls back to deterministic demo themes on any AI failure. */
export async function designExperience(input: DesignInput): Promise<{ experience: Experience; source: "ai" | "fallback" }> {
  const fb = fallbackExperience({
    name: input.profile.name,
    topicTitle: input.assignmentTitle,
    interests: input.profile.interests,
    todayInterest: input.todayInterest,
  });
  try {
    const raw = await callClaude(
      DESIGNER_SYSTEM,
      designerUserPrompt({
        assignmentTitle: input.assignmentTitle,
        assignmentContent: input.assignmentContent,
        name: input.profile.name,
        interests: input.profile.interests,
        learningStyle: input.profile.learningStyle,
        todayInterest: input.todayInterest,
        workMode: input.workMode,
        previousMastery: input.previousMastery,
        previousWeaknesses: input.previousWeaknesses,
      }),
      6000
    );
    const experience = coerceExperience(extractJson(raw), fb);
    if (!experience) throw new Error("BAD_SHAPE");
    return { experience, source: "ai" };
  } catch {
    return { experience: fb, source: "fallback" };
  }
}

export async function generateReport(input: {
  profile: StudentProfile;
  assignmentTitle: string;
  todayInterest: string;
  experienceTitle: string;
  experienceTypeLabel: string;
  summaries: SessionSummary[];
  mastery: number;
}): Promise<ReportData> {
  const fb = fallbackReport({
    name: input.profile.name,
    todayInterest: input.todayInterest,
    experienceTypeLabel: input.experienceTypeLabel,
    summaries: input.summaries,
  });
  try {
    const raw = await callClaude(
      REPORT_SYSTEM,
      reportUserPrompt({
        name: input.profile.name,
        assignmentTitle: input.assignmentTitle,
        interests: input.profile.interests,
        learningStyle: input.profile.learningStyle,
        todayInterest: input.todayInterest,
        experienceTitle: input.experienceTitle,
        experienceTypeLabel: input.experienceTypeLabel,
        summaries: input.summaries
          .map(
            (s) =>
              `- tushuncha: ${s.concept} | ko'rinish: ${s.kind} | urinishlar: ${s.attempts} | ${s.solved ? "yechilgan" : "yechilmagan"} | qo'llangan moslashuv yo'llari: ${s.routes.length ? s.routes.join(", ") : "yo'q"}`
          )
          .join("\n"),
        mastery: input.mastery,
      }),
      2000
    );
    const parsed = extractJson(raw) as {
      strengths?: string[];
      weaknesses?: string[];
      feedback?: string;
      insight?: string;
    };
    if (!Array.isArray(parsed.strengths) || !Array.isArray(parsed.weaknesses) || !parsed.feedback) {
      throw new Error("BAD_SHAPE");
    }
    return {
      mastery: input.mastery,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      feedback: parsed.feedback,
      insight: parsed.insight || fb.insight,
    };
  } catch {
    return fb;
  }
}
