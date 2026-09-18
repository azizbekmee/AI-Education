"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, LogOut } from "lucide-react";
import { motion } from "framer-motion";

export default function Header({ name, role }: { name: string; role: "teacher" | "student" }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
      <Link href={role === "teacher" ? "/teacher/dashboard" : "/student/dashboard"} className="group flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 transition-transform group-hover:scale-110">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </span>
        <span className="font-display text-lg font-bold tracking-tight text-white">
          EduMind <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">AI</span>
        </span>
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.06 }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 font-display text-sm font-bold text-white"
          >
            {name.charAt(0)}
          </motion.div>
          <span className="hidden text-sm font-medium text-white/70 sm:block">{name}</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={logout}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-white/25 hover:text-white"
          aria-label="Chiqish"
          title="Chiqish"
        >
          <LogOut className="h-4 w-4" />
        </motion.button>
      </div>
    </header>
  );
}
