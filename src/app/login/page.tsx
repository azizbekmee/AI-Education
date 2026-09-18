"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, LoaderCircle, GraduationCap, UserRound } from "lucide-react";
import Backdrop from "@/components/Backdrop";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kirish amalga oshmadi. Qaytadan urinib ko'ring.");
        return;
      }
      router.push(data.profileCompleted ? (data.role === "teacher" ? "/teacher" : "/student") : "/onboarding");
    } catch {
      setError("Server bilan bog'lanishda xatolik. Qaytadan urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(kind: "teacher" | "student") {
    setEmail(kind === "teacher" ? "teacher@demo.com" : "student@demo.com");
    setPassword(kind === "teacher" ? "teacher123" : "student123");
    setError("");
  }

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      <Backdrop />

      {/* Hero panel */}
      <div className="relative z-10 flex flex-1 flex-col justify-between p-10 lg:p-16">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </span>
          <span className="font-display text-lg font-bold text-white">
            EduMind <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">AI</span>
          </span>
        </div>

        <div className="py-16 lg:py-0">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Har bir o&apos;quvchi uchun
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              shaxsiy AI ustoz
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="mt-6 max-w-md text-lg leading-relaxed text-white/50"
          >
            AI topshiriqlarni o&apos;quvchining qiziqishlari va o&apos;rganish usuliga
            moslashtiradi, xatolarda moslashuvchan savollar bilan yo&apos;l ko&apos;rsatadi
            va o&apos;qituvchiga hisobot tayyorlaydi.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-10 flex flex-wrap gap-3"
          >
            {["Shaxsiylashtirish", "Adaptive o'rganish", "AI hisobotlar"].map((t) => (
              <span key={t} className="chip border-white/10 bg-white/5 text-white/70">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                {t}
              </span>
            ))}
          </motion.div>
        </div>

        <p className="text-sm text-white/30">© 2026 EduMind AI · Hackathon demo</p>
      </div>

      {/* Login card */}
      <div className="relative z-10 flex items-center justify-center p-6 lg:w-[480px] lg:border-l lg:border-white/10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="card w-full max-w-sm p-8"
        >
          <h2 className="font-display text-2xl font-bold text-white">Tizimga kirish</h2>
          <p className="mt-1.5 text-sm text-white/40">O&apos;z hisobingizga kiring va davom eting.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="siz@email.com"
                  className="input-field pl-11"
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Parol</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parolni kiriting"
                  className="input-field pl-11"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="btn-gradient w-full"
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-4.5 w-4.5 animate-spin" />
                  Kirilmoqda...
                </>
              ) : (
                "Kirish"
              )}
            </motion.button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-3 text-xs uppercase tracking-wider text-white/30">Demo hisoblar</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fillDemo("teacher")}
                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left transition hover:border-violet-400/40 hover:bg-violet-500/10"
              >
                <GraduationCap className="h-5 w-5 shrink-0 text-violet-300" />
                <span>
                  <span className="block text-sm font-semibold text-white">O&apos;qituvchi</span>
                  <span className="block text-xs text-white/40">teacher@demo.com</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("student")}
                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
              >
                <UserRound className="h-5 w-5 shrink-0 text-cyan-300" />
                <span>
                  <span className="block text-sm font-semibold text-white">O&apos;quvchi</span>
                  <span className="block text-xs text-white/40">student@demo.com</span>
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
