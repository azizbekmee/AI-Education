"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Sparkles } from "lucide-react";

type Item = { id: number; title: string; body: string; read: number; created_at: string };

export default function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setUnread(data.unread);
      }
    }
  }

  async function markRead() {
    await fetch("/api/notifications", { method: "POST" });
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, read: 1 })));
  }

  return (
    <div className="relative" ref={ref}>
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-white/25 hover:text-white"
        aria-label="Bildirishnomalar"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1 text-[10px] font-bold text-white"
          >
            {unread}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="card absolute right-0 top-11 z-50 w-80 p-2 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-semibold text-white">Bildirishnomalar</p>
              {unread > 0 && (
                <button onClick={markRead} className="text-xs text-violet-300 hover:text-violet-200">
                  Barchasini o&apos;qilgan qilish
                </button>
              )}
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-white/40">
                  Hozircha bildirishnoma yo&apos;q.
                </p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2.5 rounded-2xl px-3 py-2.5 ${
                      item.read ? "opacity-50" : "bg-white/[0.04]"
                    }`}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/40 to-cyan-400/40">
                      <Sparkles className="h-3 w-3 text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-white/50">{item.body}</p>
                      <p className="mt-1 text-[10px] text-white/25">{item.created_at}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
