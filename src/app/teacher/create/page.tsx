"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  LoaderCircle,
  Upload,
  FileText,
  X,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import Backdrop from "@/components/Backdrop";
import Header from "@/components/Header";

export default function CreateAssignmentPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [teacherName, setTeacherName] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.user || d.user.role !== "teacher") {
          router.push("/login");
          return;
        }
        setTeacherName(d.user.name);
        setChecking(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024) {
      setError("Fayl hajmi juda katta (maks. 100 KB). Matnni to'g'ridan-to'g'ri kiriting.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setContent(text);
      setFileName(file.name);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      setError("");
    };
    reader.readAsText(file);
  }

  async function save() {
    if (saving) return;
    if (title.trim().length < 2 || content.trim().length < 5) {
      setError("Sarlavha va topshiriq matnini to'liq kiriting.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), fileName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Saqlashda xatolik yuz berdi.");
        return;
      }
      setDone(true);
    } catch {
      setError("Server bilan bog'lanishda xatolik.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) return null;

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <Header name={teacherName} role="teacher" />
      <div className="relative z-10 mx-auto max-w-2xl px-6 pb-20 sm:px-10">
        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card mt-16 flex flex-col items-center p-10 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-2xl shadow-emerald-500/30"
            >
              <CheckCircle2 className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="mt-5 font-display text-2xl font-bold text-white">
              Topshiriq yaratildi!
            </h1>
            <p className="mt-2 max-w-sm text-white/50">
              AI endi har bir o&apos;quvchi uchun shu topshiriqni ularning qiziqishlari va
              o&apos;rganish usuliga moslashtirib tayyorlaydi.
            </p>
            <button onClick={() => router.push("/teacher/dashboard")} className="btn-gradient mt-8 w-full">
              Dashboardga qaytish
            </button>
          </motion.div>
        ) : (
          <>
            <button
              onClick={() => router.push("/teacher/dashboard")}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/40 transition hover:text-white/70"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboardga qaytish
            </button>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <span className="chip mt-4 border-violet-400/30 bg-violet-500/10 text-violet-300">
                <Sparkles className="h-3.5 w-3.5" />
                AI ushbu topshiriqni har bir o&apos;quvchiga moslashtiradi
              </span>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white">
                Yangi topshiriq yaratish
              </h1>
              <p className="mt-2 text-white/50">
                Topshiriq mavzusini yoki to&apos;liq matnini kiriting — qolganini AI bajarmoqda.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="card mt-6 space-y-5 p-7"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">
                  Topshiriq sarlavhasi
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masalan: Chiziqli tenglamalar"
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">
                  Topshiriq matni
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Mavzu yoki topshiriq mazmunini yozing. Masalan: Chiziqli tenglamalar — bir o'zgaruvchili tenglamalar, ko'chirlash amallari, so'zli masalalar..."
                  rows={7}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-white/70">
                  Yoki fayl yuklang <span className="text-white/30">(ixtiyoriy, .txt / .md)</span>
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.csv"
                  onChange={onFile}
                  className="hidden"
                />
                {fileName ? (
                  <div className="flex items-center justify-between rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-white">
                      <FileText className="h-4 w-4 text-violet-300" />
                      {fileName}
                    </span>
                    <button
                      onClick={() => {
                        setFileName(null);
                        setContent("");
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="text-white/40 transition hover:text-white"
                      aria-label="Faylni olib tashlash"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-white/40 transition hover:border-violet-400/40 hover:text-white/70"
                  >
                    <Upload className="h-6 w-6" />
                    <span className="text-sm">Faylni bu yerga tashlang yoki tanlang</span>
                  </motion.button>
                )}
              </div>

              {error && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={save}
                disabled={saving}
                className="btn-gradient w-full text-lg"
              >
                {saving ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Saqlanmoqda...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Topshiriqni yaratish
                  </>
                )}
              </motion.button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
