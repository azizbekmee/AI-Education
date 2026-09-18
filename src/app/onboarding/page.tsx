"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  LoaderCircle,
  Trophy,
  Gamepad2,
  Cpu,
  Music,
  Palette,
  BookOpen,
  Check,
  ListChecks,
  BookOpenText,
  Wrench,
  BarChart3,
  Plus,
  X,
} from "lucide-react";
import Backdrop from "@/components/Backdrop";

const INTERESTS = [
  { name: "Futbol", icon: Trophy },
  { name: "O'yinlar", icon: Gamepad2 },
  { name: "Texnologiya", icon: Cpu },
  { name: "Musiqa", icon: Music },
  { name: "San'at", icon: Palette },
  { name: "Kitob o'qish", icon: BookOpen },
];

const STYLES = [
  { name: "Viktorina", icon: ListChecks, desc: "Tez savollar va variantlar orqali o'rganish" },
  { name: "Hikoyali o'qish", icon: BookOpenText, desc: "Qiziqarli hikoyalar ichida bilim olish" },
  { name: "Amaliy mashqlar", icon: Wrench, desc: "Qo'lda bajarib ko'rish orqali o'rganish" },
  { name: "Vizual diagrammalar", icon: BarChart3, desc: "Rasm, sxema va grafiklar orqali o'rganish" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [interests, setInterests] = useState<string[]>(["Futbol", "O'yinlar", "Texnologiya"]);
  const [style, setStyle] = useState("Viktorina");
  const [customInterest, setCustomInterest] = useState("");
  const [customStyle, setCustomStyle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.user || d.user.role !== "student") {
          router.push(d?.user?.role === "teacher" ? "/teacher/dashboard" : "/login");
          return;
        }
        setName(d.user.name);
        if (d.user.interests.length > 0) setInterests(d.user.interests);
        if (d.user.learningStyle) setStyle(d.user.learningStyle);
        setChecking(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  function toggleInterest(name: string) {
    setInterests((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  }

  function addCustomInterest() {
    const v = customInterest.trim();
    if (!v) return;
    if (!interests.includes(v)) setInterests((prev) => [...prev, v]);
    setCustomInterest("");
  }

  async function save() {
    if (loading) return;
    if (interests.length === 0) {
      setError("Kamida bitta qiziqishni tanlang.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests, learningStyle: style }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Saqlashda xatolik yuz berdi.");
        return;
      }
      router.push("/student/dashboard");
    } catch {
      setError("Server bilan bog'lanishda xatolik.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="chip border-violet-400/30 bg-violet-500/10 text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            AI o&apos;quv profili
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Xush kelibsiz, {name}!
          </h1>
          <p className="mt-3 text-white/50">
            AI sizga mos ta&apos;lim berishi uchun avval sizni tanishi kerak. Ikki oddiy qadam.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.6 }}
          className="card mt-8 p-7"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-white/40">
            1-qadam · Nimalar sizni qiziqtiradi?
          </p>
          <p className="mt-2 text-xs text-white/30">
            Bu faqat misollar — istalgan qiziqishingizni yozib qo&apos;shishingiz mumkin.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {INTERESTS.map(({ name, icon: Icon }) => {
              const active = interests.includes(name);
              return (
                <motion.button
                  key={name}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleInterest(name)}
                  className={`chip px-4 py-2.5 transition-all ${
                    active
                      ? "border-violet-400/50 bg-gradient-to-r from-violet-500/25 to-cyan-500/20 text-white shadow-lg shadow-violet-500/20"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25 hover:text-white/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {name}
                  {active && <Check className="h-3.5 w-3.5 text-cyan-300" />}
                </motion.button>
              );
            })}
            {interests
              .filter((i) => !INTERESTS.some((f) => f.name === i))
              .map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleInterest(i)}
                  className="chip border-violet-400/50 bg-gradient-to-r from-violet-500/25 to-cyan-500/20 px-4 py-2.5 text-white shadow-lg shadow-violet-500/20"
                >
                  {i}
                  <X className="h-3.5 w-3.5 text-cyan-300" />
                </button>
              ))}
          </div>
          <div className="mt-4 flex gap-2.5">
            <input
              type="text"
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomInterest()}
              placeholder="O'zingiz qiziqtirgan boshqa mavzuni yozing — masalan: avtomobillar, kosmos, arxitektura..."
              className="input-field flex-1"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={addCustomInterest}
              disabled={!customInterest.trim()}
              className="btn-gradient shrink-0 px-4 py-3"
            >
              <Plus className="h-4.5 w-4.5" />
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.6 }}
          className="card mt-5 p-7"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-white/40">
            2-qadam · Qanday o&apos;rganish usuli sizga yoqadi?
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {STYLES.map(({ name, icon: Icon, desc }) => {
              const active = style === name;
              return (
                <motion.button
                  key={name}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStyle(name)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                    active
                      ? "border-violet-400/50 bg-gradient-to-br from-violet-500/20 to-cyan-500/10 shadow-lg shadow-violet-500/15"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      active ? "bg-violet-500/30 text-violet-200" : "bg-white/5 text-white/40"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span>
                    <span className="block font-semibold text-white">{name}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/40">{desc}</span>
                  </span>
                  {active && <Check className="ml-auto h-4 w-4 shrink-0 text-cyan-300" />}
                </motion.button>
              );
            })}
          </div>
          <div className="mt-4">
            <p className="text-xs text-white/30">
              Yoki o&apos;z usulingizni yozing — masalan: &quot;mustaqil izlanmoqchiman&quot;,
              &quot;amalda sinab ko&apos;rishni xohlayman&quot;...
            </p>
            <div className="mt-2.5 flex gap-2.5">
              <input
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="O'z usulingizni yozing..."
                className="input-field flex-1"
              />
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => customStyle.trim() && setStyle(customStyle.trim())}
                disabled={!customStyle.trim()}
                className={`shrink-0 rounded-xl border px-4 text-sm font-medium transition ${
                  style && !STYLES.some((s) => s.name === style)
                    ? "border-violet-400/50 bg-violet-500/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-violet-400/40 hover:text-white"
                }`}
              >
                <Plus className="h-4.5 w-4.5" />
              </motion.button>
            </div>
            {style && !STYLES.some((s) => s.name === style) && (
              <p className="mt-2.5 flex items-center gap-1.5 text-sm text-violet-200">
                <Check className="h-4 w-4 text-cyan-300" />
                Tanlangan usul: {style}
              </p>
            )}
          </div>
        </motion.div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.98 }}
          onClick={save}
          disabled={loading}
          className="btn-gradient mt-8 w-full text-lg"
        >
          {loading ? (
            <>
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Profil saqlanmoqda...
            </>
          ) : (
            "Profilmni saqlash va davom etish"
          )}
        </motion.button>
      </div>
    </div>
  );
}
