"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Upload,
  FileText,
  File as FileIcon,
  X,
  CheckCircle2,
  ArrowRight,
  LoaderCircle,
  CalendarDays,
  Users,
  BookOpen,
  Paperclip,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import type { OriginalAssignment } from "@/types";

interface ClassOption {
  id: number;
  name: string;
  grade: number;
}
interface TopicOption {
  id: number;
  name: string;
  grade: number;
}
interface UploadFile {
  name: string;
  size: number;
  type: string;
  /** base64 for binary files, raw text for text files */
  data: string | null;
  text: string | null;
}
interface ExtractionResult {
  ok: boolean;
  original?: OriginalAssignment;
  error?: string;
}

const TEXT_EXT = /\.(txt|md|csv)$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function readUpload(file: File): Promise<UploadFile> {
  if (file.type.startsWith("text/") || TEXT_EXT.test(file.name)) {
    const text = await file.text();
    return { name: file.name, size: file.size, type: file.type || "text/plain", data: text, text };
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Fayl o'qilmadi"));
    reader.readAsDataURL(file);
  });
  return {
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    data,
    text: null,
  };
}

export default function AssignmentWizard({
  classes,
  topics,
  subjectName,
  todayClassIds,
  initialClassId,
}: {
  classes: ClassOption[];
  topics: TopicOption[];
  subjectName: string;
  todayClassIds: number[];
  initialClassId: number | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(initialClassId ? 1 : 0);
  const [classId, setClassId] = useState<number | null>(initialClassId);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [deadline, setDeadline] = useState("");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [done, setDone] = useState<{ className: string; topicName: string; extractedByAi: boolean; questionCount: number } | null>(null);

  const selectedClass = classes.find((c) => c.id === classId) ?? null;
  const selectedTopic = topics.find((t) => t.id === topicId) ?? null;
  const gradeTopics = selectedClass ? topics.filter((t) => t.grade === selectedClass.grade) : [];

  function pickClass(id: number) {
    setClassId(id);
    setTopicId(null);
    setStep(1);
  }

  function pickTopic(id: number) {
    setTopicId(id);
    const t = topics.find((x) => x.id === id);
    if (t) setTitle(t.name);
    setStep(2);
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;
    setFileError("");
    const added: UploadFile[] = [];
    for (const f of list) {
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`«${f.name}» hajmi 10 MB dan katta.`);
        continue;
      }
      if (files.concat(added).some((x) => x.name === f.name && x.size === f.size)) continue;
      try {
        added.push(await readUpload(f));
      } catch {
        setFileError(`«${f.name}» faylini o'qib bo'lmadi.`);
      }
    }
    if (files.length + added.length > 10) {
      setFileError("Bitta topshiriqga ko'pi bilan 10 ta fayl yuklash mumkin.");
    } else if (added.length) {
      setFiles((prev) => prev.concat(added));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function runExtraction(cid: number, tid: number) {
    if (extracting) return;
    setExtracting(true);
    setExtraction(null);
    try {
      const res = await fetch("/api/assignments/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: cid, topicId: tid, note: note.trim(), files }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExtraction({ ok: false, error: data.error || "AI tahlilida xatolik yuz berdi." });
      } else {
        setExtraction(data);
      }
    } catch {
      setExtraction({ ok: false, error: "Server bilan bog'lanishda xatolik." });
    } finally {
      setExtracting(false);
    }
  }

  /** Step 2 → 3: entering the preview kicks off the AI extraction of the uploaded files */
  async function goToPreview() {
    if (!classId || !topicId || extracting) return;
    setStep(3);
    await runExtraction(classId, topicId);
  }

  async function submit() {
    if (saving || !classId || !topicId) return;
    if (title.trim().length < 2) {
      setSubmitError("Sarlavhani kiriting.");
      return;
    }
    if (files.length === 0) {
      setSubmitError("Kamida bitta topshiriq fayli yuklang.");
      return;
    }
    setSubmitError("");
    setSaving(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          topicId,
          title: title.trim(),
          note: note.trim(),
          deadline: deadline || null,
          files,
          original: extraction?.ok ? extraction.original : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Saqlashda xatolik yuz berdi.");
        return;
      }
      setDone({
        className: data.className ?? selectedClass?.name ?? "",
        topicName: data.topicName ?? selectedTopic?.name ?? "",
        extractedByAi: Boolean(data.extractedByAi),
        questionCount: Number(data.questionCount) || 0,
      });
    } catch {
      setSubmitError("Server bilan bog'lanishda xatolik.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card mt-10 flex flex-col items-center p-10 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-2xl shadow-emerald-500/30"
        >
          <CheckCircle2 className="h-8 w-8 text-white" />
        </motion.div>
        <h2 className="mt-5 font-display text-2xl font-bold text-white">Topshiriq yuborildi!</h2>
        <p className="mt-2 max-w-md text-white/50">
          {done.className} sinfiga «{done.topicName}» mavzusi bo&apos;yicha topshiriq
          saqlandi. Fayllaringiz asl nusxada saqlanadi — AI o&apos;quvchilarga aynan shu
          topshiriq asosida yordam beradi.
        </p>
        {done.extractedByAi ? (
          <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5 text-sm text-emerald-200">
            AI {done.questionCount} ta original savolni fayllardan so&apos;zma-so&apos;z
            ajratib, o&apos;zgarmas manba sifatida saqladi.
          </p>
        ) : (
          <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5 text-sm text-amber-200">
            Diqqat: AI savollarni ajrata olmadi — topshiriq fayllar matni asosida
            saqlandi. Dashboardda topshiriqni tanlab, «Qayta ajratish» bilan qayta
            urinib ko&apos;rishingiz mumkin.
          </p>
        )}
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
          <Link href="/teacher/dashboard" className="btn-gradient flex-1 text-center">
            Dashboardga qaytish
          </Link>
          <button
            onClick={() => {
              setDone(null);
              setStep(0);
              setClassId(null);
              setTopicId(null);
              setTitle("");
              setNote("");
              setDeadline("");
              setFiles([]);
              setExtraction(null);
            }}
            className="rounded-xl border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Yana topshiriq yuborish
          </button>
        </div>
      </motion.div>
    );
  }

  const stepTitles = ["Sinf tanlash", "Mavzu tanlash", "Fayllar va izoh", "Tekshirish"];
  const canProceedStep2 = title.trim().length >= 2 && files.length > 0;

  return (
    <div className="mt-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {stepTitles.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i < step
                  ? "bg-emerald-500/20 text-emerald-300"
                  : i === step
                    ? "bg-gradient-to-br from-violet-500 to-cyan-500 text-white"
                    : "bg-white/5 text-white/30"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span
              className={`hidden text-xs font-medium sm:block ${
                i === step ? "text-white" : "text-white/30"
              }`}
            >
              {label}
            </span>
            {i < stepTitles.length - 1 && <div className="h-px flex-1 bg-white/10" />}
          </div>
        ))}
      </div>

      {/* Step 0 — class */}
      {step === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-6 p-7"
        >
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
            <Users className="h-4 w-4 text-violet-300" />
            Qaysi sinfga yuborasiz?
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {classes.map((c) => {
              const isToday = todayClassIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => pickClass(c.id)}
                  className={`relative rounded-2xl border p-4 text-left transition ${
                    isToday
                      ? "border-violet-400/30 bg-violet-500/[0.08] hover:border-violet-400/60"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  {isToday && (
                    <span className="absolute right-2 top-2 rounded-full bg-violet-500/30 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                      Bugun
                    </span>
                  )}
                  <p className="font-display text-xl font-bold text-white">{c.name}</p>
                  <p className="mt-1 text-xs text-white/40">{c.grade}-sinf</p>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Step 1 — topic */}
      {step === 1 && selectedClass && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-6 p-7"
        >
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
              <BookOpen className="h-4 w-4 text-cyan-300" />
              {selectedClass.name} uchun mavzu
            </p>
            <button
              onClick={() => setStep(0)}
              className="text-xs text-white/40 transition hover:text-white"
            >
              Sinfni o&apos;zgartirish
            </button>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {gradeTopics.map((t) => (
              <button
                key={t.id}
                onClick={() => pickTopic(t.id)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left font-medium text-white/80 transition hover:border-cyan-400/40 hover:bg-cyan-500/[0.06] hover:text-white"
              >
                {t.name}
              </button>
            ))}
            {gradeTopics.length === 0 && (
              <p className="text-sm text-white/40">Bu sinf darajasiga mos mavzu topilmadi.</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Step 2 — files, note, deadline */}
      {step === 2 && selectedClass && selectedTopic && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-6 space-y-5 p-7"
        >
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
              <Paperclip className="h-4 w-4 text-amber-300" />
              Topshiriq fayllari
            </p>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-white/40 transition hover:text-white"
            >
              Mavzuni o&apos;zgartirish
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              Topshiriq sarlavhasi
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Chiziqli tenglamalar — mustaqil ish"
              className="input-field"
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv,.doc,.docx,.png,.jpg,.jpeg"
            onChange={onFiles}
            className="hidden"
          />
          {files.length === 0 ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-10 text-white/40 transition hover:border-violet-400/40 hover:text-white/70"
            >
              <Upload className="h-7 w-7" />
              <span className="text-sm font-medium">
                Topshiriq fayllarini tanlang (PDF, DOCX, matn, rasm)
              </span>
              <span className="text-xs">Bir vaqtda bir nechta fayl — maks. 10 MB</span>
            </motion.button>
          ) : (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${f.size}`}
                  className="flex items-center justify-between rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-2.5 text-sm text-white">
                    {/\.(pdf)$/i.test(f.name) ? (
                      <FileText className="h-4 w-4 shrink-0 text-red-300" />
                    ) : (
                      <FileIcon className="h-4 w-4 shrink-0 text-violet-300" />
                    )}
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-white/30">{formatSize(f.size)}</span>
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="ml-3 shrink-0 text-white/40 transition hover:text-white"
                    aria-label="Faylni olib tashlash"
                  >
                    <X />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/40 transition hover:border-violet-400/40 hover:text-white/70"
              >
                + Yana fayl qo&apos;shish
              </button>
            </div>
          )}
          {fileError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {fileError}
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              O&apos;qituvchi izohi <span className="text-white/30">(ixtiyoriy)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masalan: 1-4-masalalarni bajarish shart. Yechimni to'liq yozing."
              rows={3}
              className="input-field resize-none"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/70">
              <CalendarDays className="h-4 w-4 text-white/40" />
              Topshirish muddati <span className="text-white/30">(ixtiyoriy)</span>
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Orqaga
            </button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={goToPreview}
              disabled={!canProceedStep2}
              className="btn-gradient flex-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Davom etish — AI tahlili
              <ArrowRight className="h-4.5 w-4.5" />
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Step 3 — preview */}
      {step === 3 && selectedClass && selectedTopic && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-6 space-y-5 p-7"
        >
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Tekshirib yuborish
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-white/30">Sinf</p>
              <p className="mt-1 font-semibold text-white">{selectedClass.name}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-white/30">Fan</p>
              <p className="mt-1 font-semibold text-white">{subjectName}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-white/30">Mavzu</p>
              <p className="mt-1 font-semibold text-white">{selectedTopic.name}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-white/30">Muddat</p>
              <p className="mt-1 font-semibold text-white">{deadline || "Belgilanmagan"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wider text-white/30">Sarlavha</p>
            <p className="mt-1 font-semibold text-white">{title}</p>
            {note.trim() && (
              <>
                <p className="mt-4 text-xs uppercase tracking-wider text-white/30">Izoh</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-white/60">{note}</p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wider text-white/30">
              Fayllar ({files.length})
            </p>
            <ul className="mt-2 space-y-1.5">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 text-sm text-white/70">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                  {f.name}
                  <span className="text-xs text-white/30">{formatSize(f.size)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AI extraction panel */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/30">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              AI fayl tahlili — original topshiriq
            </p>

            {extracting && (
              <div className="mt-3 flex items-center gap-2.5 text-sm text-white/60">
                <LoaderCircle className="h-4 w-4 animate-spin text-violet-300" />
                AI fayllarning o&apos;zini o&apos;qib, savollar va talablarni so&apos;zma-so&apos;z
                ajratmoqda...
              </div>
            )}

            {!extracting && extraction?.ok && extraction.original && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <span className="chip border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {extraction.original.questions.length} ta savol ajratildi
                  </span>
                  {typeof extraction.original.wordCount === "number" && (
                    <span className="chip border-white/10 bg-white/5 text-white/60">
                      ~{extraction.original.wordCount} so&apos;z
                    </span>
                  )}
                  {extraction.original.expectedOutput && (
                    <span className="chip border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                      Kutilgan natija: {extraction.original.expectedOutput}
                    </span>
                  )}
                </div>
                {extraction.original.requirements.length > 0 && (
                  <>
                    <p className="mt-3 text-xs uppercase tracking-wider text-white/30">Talablar</p>
                    <ul className="mt-1.5 space-y-1">
                      {extraction.original.requirements.map((r) => (
                        <li key={r} className="text-sm text-white/60">• {r}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-3 text-xs uppercase tracking-wider text-white/30">
                  Original savollar (so&apos;zma-so&apos;z)
                </p>
                <ol className="mt-1.5 space-y-1">
                  {extraction.original.questions.map((q, i) => (
                    <li key={i} className="text-sm text-white/80">
                      {i + 1}. {q.text}
                    </li>
                  ))}
                </ol>
                {extraction.original.constraints && (
                  <p className="mt-3 text-sm text-white/50">Cheklovlar: {extraction.original.constraints}</p>
                )}
                <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5 text-xs leading-relaxed text-emerald-200/80">
                  Bu savollar o&apos;zgarmas manba (source of truth) sifatida saqlanadi —
                  AI o&apos;quvchiga aynan shu savollarni bajarishda yordam beradi, boshqa
                  savol ixtiro qilmaydi.
                </p>
              </div>
            )}

            {!extracting && extraction && !extraction.ok && (
              <div className="mt-3">
                <p className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {extraction.error}
                </p>
                <button
                  onClick={() => classId && topicId && runExtraction(classId, topicId)}
                  className="chip mt-3 border-violet-400/30 bg-violet-500/10 text-violet-200 transition hover:bg-violet-500/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Qayta urinish
                </button>
                <p className="mt-2 text-xs text-white/40">
                  Xohlasangiz, ajratishsiz ham yuborish mumkin — fayllar matni asl nusxada
                  saqlanadi.
                </p>
              </div>
            )}
          </div>

          {submitError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {submitError}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Orqaga
            </button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={submit}
              disabled={saving}
              className="btn-gradient flex-1"
            >
              {saving ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Yuborilmoqda...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Yuborish
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
