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
  Wand2,
  Save,
} from "lucide-react";
import Backdrop from "@/components/Backdrop";
import Header from "@/components/Header";
import MasteryRing from "@/components/MasteryRing";
import ActivityInput from "@/components/activities/ActivityInput";
import { MOODS, WORK_MODES } from "@/types";
import type {
  AnswerPayload,
  ReportData,
  SafeActivity,
  SafeExperience,
  StudentProfile,
} from "@/types";

type StartResponse = {
  needsInterest?: boolean;
  profile?: StudentProfile;
  sessionId?: number;
  experience?: SafeExperience;
  nextIndex?: number;
  doneCount?: number;
  mastery?: number;
  todayInterest?: string;
  resumed?: boolean;
};

type Msg = { id: number; kind: "ai" | "user" | "success" | "warn" | "reveal"; text: string };

type AnswerResponse = {
  correct: boolean;
  revealed?: boolean;
  message?: string | null;
  route?: string;
  activity?: SafeActivity;
  solution?: string;
  mastery: number;
  nextIndex: number | null;
  completed: boolean;
};

export default function AssignmentFlow({
  name,
  assignmentId,
  profile,
}: {
  name: string;
  assignmentId: number;
  profile: StudentProfile;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "interest" | "mood" | "mode" | "intro" | "chat" | "finish">("loading");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [experience, setExperience] = useState<SafeExperience | null>(null);
  const [todayInterest, setTodayInterest] = useState("");
  const [pendingInterest, setPendingInterest] = useState("");
  const [mood, setMood] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activity, setActivity] = useState<SafeActivity | null>(null);
  const [activityIndex, setActivityIndex] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [mastery, setMastery] = useState(0);
  const [awaiting, setAwaiting] = useState(false);
  const [attemptNo, setAttemptNo] = useState(1);
  const [report, setReport] = useState<(ReportData & { id: number }) | null>(null);
  const [customInterest, setCustomInterest] = useState("");
  const msgId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  const push = useCallback((kind: Msg["kind"], text: string) => {
    msgId.current += 1;
    setMessages((prev) => [...prev, { id: msgId.current, kind, text }]);
  }, []);

  const showActivity = useCallback(
    (a: SafeActivity, index: number) => {
      setActivity(a);
      setActivityIndex(index);
      push("ai", (a.title ? `${a.title}. ` : "") + a.prompt);
      scrollDown();
    },
    [push, scrollDown]
  );

  function hydrate(data: StartResponse) {
    if (!data.sessionId || !data.experience) return false;
    setSessionId(data.sessionId);
    setExperience(data.experience);
    setTodayInterest(data.todayInterest ?? "");
    setDoneCount(data.doneCount ?? 0);
    setMastery(data.mastery ?? 0);
    if (data.resumed && (data.doneCount ?? 0) > 0) {
      setPhase("chat");
      const a = data.experience.activities[data.nextIndex ?? 0];
      if (a) showActivity(a, data.nextIndex ?? 0);
    } else {
      setPhase("intro");
    }
    return true;
  }

  useEffect(() => {
    fetch("/api/assignments/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId }),
    })
      .then(async (res) => (res.ok ? ((await res.json()) as StartResponse) : null))
      .then((data) => {
        if (!data) {
          router.push("/student/dashboard");
          return;
        }
        if (data.needsInterest) {
          setPhase("interest");
        } else if (!hydrate(data)) {
          router.push("/student/dashboard");
        }
      })
      .catch(() => router.push("/student/dashboard"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  function chooseInterest(interest: string) {
    setPendingInterest(interest);
    setPhase("mood");
  }

  function chooseMood(m: string) {
    setMood(m);
    setPhase("mode");
  }

  async function beginWithInterest(interest: string, moodId: string, workMode: string) {
    setPhase("loading");
    try {
      const res = await fetch("/api/assignments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, todayInterest: interest, mood: moodId, workMode }),
      });
      const data = (await res.json()) as StartResponse;
      if (!res.ok || !hydrate(data)) {
        router.push("/student/dashboard");
        return;
      }
      setPhase("intro");
    } catch {
      router.push("/student/dashboard");
    }
  }

  function begin() {
    if (!experience) return;
    setPhase("chat");
    push("ai", experience.intro);
    const a = experience.activities[0];
    if (a) showActivity(a, 0);
  }

  async function finish() {
    setPhase("loading");
    try {
      const res = await fetch("/api/sessions/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
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

  async function answer(payload: AnswerPayload) {
    if (!activity || !sessionId || awaiting) return;
    setAwaiting(true);
    const display =
      payload.kind === "choice"
        ? (activity.options?.[payload.index ?? -1] ?? "")
        : payload.kind === "numeric"
          ? (payload.value ?? "")
          : payload.kind === "ordering"
            ? (payload.order ?? []).join(" → ")
            : (payload.text ?? "");
    push("user", display);
    scrollDown();

    try {
      const res = await fetch("/api/sessions/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, activityIndex, answer: payload }),
      });
      if (!res.ok) {
        router.push("/student/dashboard");
        return;
      }
      const data = (await res.json()) as AnswerResponse;
      setMastery(data.mastery);

      if (data.correct) {
        push("success", data.message || SUCCESS_LINES[(attemptNo + activityIndex) % SUCCESS_LINES.length]);
        setDoneCount((c) => c + 1);
        setAttemptNo(1);
        setActivity(null);
        if (data.completed || data.nextIndex === null) {
          await finish();
        } else {
          const next = experience!.activities[data.nextIndex];
          if (next) showActivity(next, data.nextIndex);
        }
      } else if (data.revealed) {
        push(
          "reveal",
          `Bu qadamda qiyinlashdik. To'g'ri yechim: ${data.solution}. Yaqinda shu tushunchaga yana qaytamiz!`
        );
        setDoneCount((c) => c + 1);
        setAttemptNo(1);
        setActivity(null);
        if (data.completed || data.nextIndex === null) {
          await finish();
        } else {
          const next = experience!.activities[data.nextIndex];
          if (next) showActivity(next, data.nextIndex);
        }
      } else {
        push("warn", data.message || "Keling, shu tushunchani boshqa usulda sinab ko'ramiz.");
        setAttemptNo((n) => n + 1);
        setActivity(null);
        if (data.activity) {
          const updated: SafeExperience = {
            ...experience!,
            activities: experience!.activities.map((a, i) => (i === activityIndex ? data.activity! : a)),
          };
          setExperience(updated);
          showActivity(data.activity, activityIndex);
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
          <Wand2 className="h-8 w-8 text-white" />
        </motion.div>
        <p className="mt-6 font-display text-lg font-semibold text-white">
          AI senga maxsus o&apos;rganish tajribasi loyihalashyapti...
        </p>
        <p className="mt-2 text-sm text-white/40">Ssenariy, qadamlar va qiziqarli vazifalar tayyorlanmoqda.</p>
      </div>
    );
  }

  /* ---- Step 0: today's interest ---- */
  if (phase === "interest") {
    return (
      <div className="relative flex min-h-screen flex-col">
        <Backdrop />
        <Header name={name} role="student" />
        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              animate={{ rotate: [0, 6, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-2xl shadow-violet-500/40"
            >
              <Sparkles className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="mt-6 font-display text-2xl font-bold text-white sm:text-3xl">
              Salom, {name}!
            </h1>
            <p className="mt-3 text-lg text-white/70">
              Bugun topshiriqni nimaga bog&apos;lab o&apos;rganishni xohlaysan?
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {profile.interests.map((i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => chooseInterest(i)}
                  className="chip border-white/10 bg-white/[0.04] px-4 py-2.5 text-white/80 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                >
                  {i}
                </motion.button>
              ))}
            </div>

            <div className="card mt-6 p-5">
              <p className="text-sm font-medium text-white/60">
                Yoki o&apos;z qiziqishingni yoz — istalgan narsa bo&apos;lishi mumkin:
              </p>
              <div className="mt-3 flex gap-2.5">
                <input
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && customInterest.trim() && chooseInterest(customInterest.trim())}
                  placeholder="Masalan: Men kosmosga qiziqaman..."
                  className="input-field flex-1"
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => customInterest.trim() && chooseInterest(customInterest.trim())}
                  disabled={!customInterest.trim()}
                  className="btn-gradient shrink-0 px-4 py-3"
                >
                  <ArrowRight className="h-4.5 w-4.5" />
                </motion.button>
              </div>
              <button
                onClick={() => chooseInterest("")}
                className="mt-4 text-sm text-white/40 transition hover:text-white/70"
              >
                Bugun farqi yo&apos;q — AI eng mosini tanlasin
              </button>
            </div>

            <button
              onClick={() => router.push("/student/dashboard")}
              className="mt-8 flex items-center justify-center gap-1.5 text-sm text-white/40 transition hover:text-white/70"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboardga qaytish
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ---- Step 1: mood ---- */
  if (phase === "mood") {
    return (
      <div className="relative flex min-h-screen flex-col">
        <Backdrop />
        <Header name={name} role="student" />
        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Bugun kayfiyating qanday, {name.split(" ")[0]}?
            </h1>
            <p className="mt-3 text-lg text-white/70">
              AI tajribani kayfiyatingga qarab moslashtiradi.
            </p>
            <div className="mt-6 grid gap-2.5">
              {MOODS.map((m) => (
                <motion.button
                  key={m.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => chooseMood(m.id)}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:border-violet-400/40 hover:bg-violet-500/10"
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="font-medium text-white/80">{m.label}</span>
                </motion.button>
              ))}
            </div>
            <button
              onClick={() => router.push("/student/dashboard")}
              className="mt-8 flex items-center justify-center gap-1.5 text-sm text-white/40 transition hover:text-white/70"
            >
              <ArrowLeft className="h-4 w-4" />
              Saqlash va chiqish
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ---- Step 2: work mode ---- */
  if (phase === "mode") {
    return (
      <div className="relative flex min-h-screen flex-col">
        <Backdrop />
        <Header name={name} role="student" />
        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Qaysi formatda ishlaysan?
            </h1>
            <p className="mt-3 text-lg text-white/70">
              O&apos;qituvchi topshirig&apos;idagi savollar shu formatda taqdim etiladi — savollar o&apos;zi o&apos;zgarmaydi.
            </p>
            <div className="mt-6 grid gap-2.5">
              {WORK_MODES.map((m) => (
                <motion.button
                  key={m.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => beginWithInterest(pendingInterest, mood, m.id)}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:border-violet-400/40 hover:bg-violet-500/10"
                >
                  <span className="text-3xl">{m.icon}</span>
                  <span>
                    <span className="block font-semibold text-white">{m.label}</span>
                    <span className="mt-0.5 block text-sm text-white/50">{m.desc}</span>
                  </span>
                </motion.button>
              ))}
            </div>
            <button
              onClick={() => router.push("/student/dashboard")}
              className="mt-8 flex items-center justify-center gap-1.5 text-sm text-white/40 transition hover:text-white/70"
            >
              <ArrowLeft className="h-4 w-4" />
              Saqlash va chiqish
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ---- Finish ---- */
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
            <p className="mt-2 text-white/50">
              {experience?.icon} {experience?.title}
            </p>
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
            <p className="text-sm text-white/40">
              Sening o&apos;rganish tajribang haqidagi tahlil o&apos;qituvchingga yuborildi.
            </p>
            <button onClick={() => router.push("/student/dashboard")} className="btn-gradient mt-4 w-full">
              Dashboardga qaytish
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ---- Intro ---- */
  if (phase === "intro" && experience) {
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
              className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-2xl shadow-violet-500/40 text-4xl"
            >
              {experience.icon}
            </motion.div>

            <span className="chip mt-6 border-violet-400/30 bg-violet-500/10 text-violet-200">
              <Wand2 className="h-3.5 w-3.5" />
              {experience.typeLabel}
            </span>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">
              {experience.title}
            </h1>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-white/70">{experience.intro}</p>
            {todayInterest && (
              <p className="mt-3 text-sm text-cyan-200/70">
                Bugungi tanloving: <b>{todayInterest}</b> — tajriba aynan shunga moslashtirildi.
              </p>
            )}

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              whileTap={{ scale: 0.97 }}
              onClick={begin}
              className="btn-gradient mt-8 w-full text-lg"
            >
              Kettik!
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

  /* ---- Chat / activity flow ---- */
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

      <div className="relative z-10 mx-auto w-full max-w-2xl px-6">
        <div className="card px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg font-bold text-white">
                {Math.min(doneCount + 1, experience?.activities.length ?? 5)} / {experience?.activities.length ?? 5}-qadam
              </p>
              {/* O'quv yo'li: har bir qadam — joriy/bajarilgan/kutilmoqda */}
              <div className="mt-2 flex items-center gap-1.5">
                {(experience?.activities ?? []).map((a, i) => (
                  <span
                    key={a.id}
                    title={a.concept}
                    className={`h-2 w-6 rounded-full ${
                      i < doneCount
                        ? "bg-emerald-400"
                        : i === doneCount
                          ? "bg-gradient-to-r from-violet-500 to-cyan-400"
                          : "bg-white/15"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
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
              <button
                onClick={() => router.push("/student/dashboard")}
                title="Davolini keyinroq aynan shu yerda boshlaysan"
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition hover:border-amber-400/40 hover:text-amber-200"
              >
                <Save className="h-3.5 w-3.5" />
                Saqlash va chiqish
              </button>
            </div>
          </div>
        </div>
      </div>

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
                className={`max-w-[85%] whitespace-pre-line rounded-2xl border px-4 py-3 leading-relaxed ${bubbleStyle[m.kind]}`}
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

        <AnimatePresence mode="wait">
          {activity && !awaiting && (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="mt-5"
            >
              <ActivityInput activity={activity} disabled={awaiting} onAnswer={answer} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const SUCCESS_LINES = [
  "Zo'r! Aynan shunday.",
  "To'g'ri! Rivojlanib borasan.",
  "Barakalla, juda yaxshi!",
];
