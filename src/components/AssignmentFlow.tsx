"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Trophy,
  ArrowRight,
  ArrowLeft,
  BrainCircuit,
} from "lucide-react";
import Backdrop from "@/components/Backdrop";
import Header from "@/components/Header";
import MasteryRing from "@/components/MasteryRing";
import type { ReportData, SafeQuestion, StudentProfile } from "@/types";

type StartData = {
  sessionId: number;
  assignment: { id: number; title: string };
  profile: StudentProfile;
  nextIndex: number;
  doneCount: number;
  mastery: number;
  resumed: boolean;
};

type Msg = { id: number; kind: "ai" | "user" | "success" | "warn" | "reveal"; text: string };

type AnswerResponse = {
  correct: boolean;
  revealed?: boolean;
  message?: string;
  question?: SafeQuestion;
  correctText?: string;
  mastery: number;
  nextIndex: number | null;
  completed: boolean;
};

const SUCCESS_LINES = [
  "Zo'r! Aynan shunday.",
  "To'g'ri! Rivojlanib borasan.",
  "Barakalla, juda yaxshi!",
];

const STYLE_INTRO: Record<string, string> = {
  Viktorina: "Sen viktorina orqali yaxshiroq o'rganishingni bilamiz.",
  "Hikoyali o'qish": "Sen hikoyalar orqali yaxshiroq o'rganishingni bilamiz.",
  "Amaliy mashqlar": "Sen amaliy mashqlar orqali yaxshiroq o'rganishingni bilamiz.",
  "Vizual diagrammalar": "Sen vizual materiallar orqali yaxshiroq o'rganishingni bilamiz.",
};

export default function AssignmentFlow({
  name,
  assignmentId,
}: {
  name: string;
  assignmentId: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "intro" | "chat" | "finish">("loading");
  const [start, setStart] = useState<StartData | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState<SafeQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [total, setTotal] = useState(5);
  const [mastery, setMastery] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  const [attemptNo, setAttemptNo] = useState(1);
  const [report, setReport] = useState<(ReportData & { id: number }) | null>(null);
  const msgId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  const push = useCallback(
    (kind: Msg["kind"], text: string) => {
      msgId.current += 1;
      setMessages((prev) => [...prev, { id: msgId.current, kind, text }]);
    },
    []
  );

  const showQuestion = useCallback(
    (q: SafeQuestion, index: number) => {
      setQuestion(q);
      setQuestionIndex(index);
      setSelected(null);
      push("ai", q.text);
      scrollDown();
    },
    [push, scrollDown]
  );

  useEffect(() => {
    fetch("/api/assignments/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          router.push("/student/dashboard");
          return null;
        }
        return (await res.json()) as StartData & { questions: SafeQuestion[] };
      })
      .then((data) => {
        if (!data) return;
        setStart(data);
        setDoneCount(data.doneCount);
        setMastery(data.mastery);
        setTotal(data.questions.length);
        if (data.resumed && data.doneCount > 0) {
          setPhase("chat");
          const q = data.questions[data.nextIndex];
          if (q) showQuestion(q, data.nextIndex);
        } else {
          setPhase("intro");
        }
      })
      .catch(() => router.push("/student/dashboard"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  function begin() {
    if (!start) return;
    setPhase("chat");
    const q = (start as StartData & { questions: SafeQuestion[] }).questions[start.nextIndex];
    if (q) showQuestion(q, start.nextIndex);
  }

  async function finish() {
    setPhase("loading");
    try {
      const res = await fetch("/api/sessions/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: start!.sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setReport(data.report);
        setPhase("finish");
        return;
      }
    } catch {
      /* handled below */
    }
    router.push("/student/dashboard");
  }

  async function answer(optionIndex: number) {
    if (!question || !start || awaiting) return;
    setSelected(optionIndex);
    setAwaiting(true);
    push("user", question.options[optionIndex]);
    scrollDown();

    try {
      const res = await fetch("/api/sessions/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: start.sessionId,
          questionIndex,
          answerIndex: optionIndex,
        }),
      });
      if (!res.ok) {
        router.push("/student/dashboard");
        return;
      }
      const data = (await res.json()) as AnswerResponse;
      setMastery(data.mastery);

      if (data.correct) {
        push("success", SUCCESS_LINES[(attemptNo + questionIndex) % SUCCESS_LINES.length]);
        setDoneCount((c) => c + 1);
        setAttemptNo(1);
        setQuestion(null);
        if (data.completed) {
          await finish();
        } else {
          const next = (start as StartData & { questions: SafeQuestion[] }).questions[data.nextIndex!];
          if (next) showQuestion(next, data.nextIndex!);
        }
      } else if (data.revealed) {
        push(
          "reveal",
          `Bu savolda qiyinlashdik. To'g'ri javob: ${data.correctText}. Yaqinda shu mavzuga yana qaytamiz!`
        );
        setDoneCount((c) => c + 1);
        setAttemptNo(1);
        setQuestion(null);
        if (data.completed) {
          await finish();
        } else {
          const next = (start as StartData & { questions: SafeQuestion[] }).questions[data.nextIndex!];
          if (next) showQuestion(next, data.nextIndex!);
        }
      } else {
        push("warn", data.message ?? "Keling, shu tushunchani boshqa usulda sinab ko'ramiz.");
        setAttemptNo((n) => n + 1);
        setQuestion(null);
        if (data.question) {
          const updated = { ...(start as StartData & { questions: SafeQuestion[] }) };
          updated.questions = [...updated.questions];
          updated.questions[questionIndex] = data.question;
          setStart(updated);
          showQuestion(data.question, questionIndex);
        }
      }
    } catch {
      router.push("/student/dashboard");
    } finally {
      setAwaiting(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center">
        <Backdrop />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, rotate: [0, 8, -8, 0] }}
          transition={{ scale: { duration: 0.5 }, rotate: { repeat: Infinity, duration: 2.2, ease: "easeInOut" } }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-2xl shadow-violet-500/40"
        >
          <Sparkles className="h-8 w-8 text-white" />
        </motion.div>
        <p className="mt-6 font-display text-lg font-semibold text-white">
          AI senga mos topshiriq tayyorlayapti...
        </p>
        <p className="mt-2 text-sm text-white/40">Bir necha soniya kuting.</p>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="relative flex min-h-screen flex-col">
        <Backdrop />
        <Header name={name} role="student" />
        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              animate={{ rotate: [0, 6, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-2xl shadow-violet-500/40"
            >
              <Sparkles className="h-8 w-8 text-white" />
            </motion.div>

            <div className="mt-6 space-y-2.5">
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="font-display text-2xl font-bold text-white"
              >
                Salom, {start?.profile.name}!
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-white/60"
              >
                {STYLE_INTRO[start?.profile.learningStyle ?? "Viktorina"]}
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-white/60"
              >
                Bugungi topshiriq — «{start?.assignment.title}» sening qiziqishlaringga
                ({start?.profile.interests.join(", ")}) moslashtirildi.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="text-white/40"
              >
                Agar savol qiyin bo&apos;lsa, AI ustozing senga boshqa usulda yordam beradi.
                To&apos;g&apos;ri javobni hech qachon darhol bermaymiz — birga topamiz!
              </motion.p>
            </div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              whileTap={{ scale: 0.97 }}
              onClick={begin}
              className="btn-gradient mt-8 w-full text-lg"
            >
              Boshlash
              <ArrowRight className="h-5 w-5" />
            </motion.button>
            <button
              onClick={() => router.push("/student/dashboard")}
              className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-white/40 transition hover:text-white/70"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboardga qaytish
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (phase === "finish" && report) {
    return (
      <div className="relative min-h-screen">
        <Backdrop />
        <Header name={name} role="student" />
        <div className="relative z-10 mx-auto max-w-xl px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-2xl shadow-amber-500/30"
            >
              <Trophy className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="mt-5 font-display text-3xl font-bold text-white">
              O&apos;quv mashg&apos;uloti yakunlandi
            </h1>
            <p className="mt-2 text-white/50">{start?.assignment.title}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card mt-8 flex flex-col items-center gap-3 p-8"
          >
            <MasteryRing value={report.mastery} size={160} stroke={12} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <div className="card p-6">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Kuchli tomonlaring
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.strengths.map((s) => (
                  <span key={s} className="chip border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-300">
                <Lightbulb className="h-4 w-4" />
                Rivojlanish kerak bo&apos;lgan tomonlar
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.weaknesses.map((s) => (
                  <span key={s} className="chip border-amber-400/30 bg-amber-500/10 text-amber-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="card mt-4 border-violet-400/20 p-6"
          >
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-300">
              <BrainCircuit className="h-4 w-4" />
              AI fikr-mulohazasi
            </p>
            <p className="mt-3 leading-relaxed text-white/70">{report.feedback}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-white/40">Hisobot o&apos;qituvchingizga yuborildi.</p>
            <button onClick={() => router.push("/student/dashboard")} className="btn-gradient mt-4 w-full">
              Dashboardga qaytish
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // chat phase
  const bubbleStyle: Record<Msg["kind"], string> = {
    ai: "border-white/10 bg-white/[0.06] text-white/85",
    user: "ml-auto bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-transparent",
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    reveal: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <Backdrop />
      <Header name={name} role="student" />

      {/* Progress bar */}
      <div className="relative z-10 mx-auto w-full max-w-2xl px-6">
        <div className="card flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="font-display text-lg font-bold text-white">
              {Math.min(doneCount + 1, total)} / {total}-savol
            </p>
            <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                animate={{ width: `${(doneCount / total) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-white/40">O&apos;zlashtirish</p>
            <motion.p
              key={mastery}
              initial={{ scale: 1.3, color: "#22d3ee" }}
              animate={{ scale: 1, color: "#ffffff" }}
              className="font-display text-2xl font-bold"
            >
              {mastery}%
            </motion.p>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-6 pb-10">
        <div className="mt-5 space-y-3">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className={`flex ${m.kind === "user" ? "justify-end" : "items-start gap-2.5"}`}
            >
              {m.kind !== "user" && (
                <span
                  className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    m.kind === "ai"
                      ? "bg-gradient-to-br from-violet-500 to-cyan-400"
                      : m.kind === "success"
                        ? "bg-emerald-500/25"
                        : m.kind === "warn"
                          ? "bg-amber-500/25"
                          : "bg-cyan-500/25"
                  }`}
                >
                  {m.kind === "ai" ? (
                    <Sparkles className="h-4 w-4 text-white" />
                  ) : m.kind === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                  ) : m.kind === "warn" ? (
                    <XCircle className="h-4 w-4 text-amber-200" />
                  ) : (
                    <Lightbulb className="h-4 w-4 text-cyan-200" />
                  )}
                </span>
              )}
              <div
                className={`max-w-[85%] rounded-2xl border px-4 py-3 leading-relaxed ${bubbleStyle[m.kind]}`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}

          {awaiting && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <span className="text-sm text-white/50">AI tahlil qilmoqda</span>
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                  className="text-white/50"
                >
                  ...
                </motion.span>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Options */}
        <AnimatePresence mode="wait">
          {question && !awaiting && (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="mt-5 space-y-2.5"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-white/30">
                Javobingni tanla
              </p>
              {question.options.map((opt, i) => (
                <motion.button
                  key={`${question.id}-${i}`}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ scale: 1.015, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => answer(i)}
                  disabled={selected !== null}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left transition-colors ${
                    selected === i
                      ? "border-violet-400/50 bg-violet-500/15 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/80 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 font-display text-sm font-bold text-violet-200">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
