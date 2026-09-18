"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { AnswerPayload, SafeActivity } from "@/types";

/**
 * Extensible activity renderer registry: each ActivityKind gets its own input
 * widget. Unknown kinds degrade to the free-response widget, so new AI-designed
 * interaction formats don't break the frontend.
 */

interface Props {
  activity: SafeActivity;
  disabled: boolean;
  onAnswer: (payload: AnswerPayload) => void;
}

function ChoiceInput({ activity, disabled, onAnswer }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/30">Variantni tanla</p>
      {activity.options?.map((opt, i) => (
        <motion.button
          key={`${activity.id}-${i}`}
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }}
          whileHover={{ scale: 1.015, x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setSelected(i);
            onAnswer({ kind: "choice", index: i });
          }}
          disabled={disabled}
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
    </div>
  );
}

function NumericInput({ disabled, onAnswer }: Props) {
  const [value, setValue] = useState("");
  function submit() {
    if (!value.trim() || disabled) return;
    onAnswer({ kind: "numeric", value: value.trim() });
  }
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/30">Javobingni kiriting</p>
      <div className="flex gap-2.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Masalan: 7"
          disabled={disabled}
          className="input-field flex-1"
          inputMode="text"
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="btn-gradient shrink-0 px-5 py-3"
        >
          <ArrowRight className="h-4.5 w-4.5" />
        </motion.button>
      </div>
    </div>
  );
}

function OrderingInput({ activity, disabled, onAnswer }: Props) {
  const [order, setOrder] = useState<string[]>(activity.items ?? []);

  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/30">
        Bosqichlarni to&apos;g&apos;ri tartibga sol
      </p>
      <div className="space-y-2">
        {order.map((item, i) => (
          <div
            key={item}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-violet-200">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm text-white/80">{item}</span>
            <button
              onClick={() => move(i, -1)}
              disabled={disabled || i === 0}
              className="rounded-lg px-2 py-1 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
              aria-label="Yuqoriga"
            >
              ▲
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={disabled || i === order.length - 1}
              className="rounded-lg px-2 py-1 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
              aria-label="Pastga"
            >
              ▼
            </button>
          </div>
        ))}
      </div>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => onAnswer({ kind: "ordering", order })}
        disabled={disabled}
        className="btn-gradient w-full"
      >
        Tartibni yuborish
        <ArrowRight className="h-4.5 w-4.5" />
      </motion.button>
    </div>
  );
}

function FreeResponseInput({ activity, disabled, onAnswer }: Props) {
  const [text, setText] = useState("");
  function submit() {
    if (!text.trim() || disabled) return;
    onAnswer({ kind: "free", text: text.trim() });
  }
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/30">
        O&apos;z fikringni yozib yubor
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={activity.kind === "free_response" ? "Fikringni yozing..." : "Javobingni yozing..."}
        rows={4}
        disabled={disabled}
        className="input-field resize-none"
      />
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="btn-gradient w-full"
      >
        Yuborish
        <ArrowRight className="h-4.5 w-4.5" />
      </motion.button>
    </div>
  );
}

export default function ActivityInput(props: Props) {
  switch (props.activity.kind) {
    case "choice":
      return <ChoiceInput {...props} />;
    case "numeric":
      return <NumericInput {...props} />;
    case "ordering":
      return <OrderingInput {...props} />;
    case "free_response":
      return <FreeResponseInput {...props} />;
    default:
      return <FreeResponseInput {...props} />;
  }
}
