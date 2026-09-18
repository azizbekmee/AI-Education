import type {
  AdaptiveResult,
  Question,
  ReportData,
  SessionSummary,
} from "@/types";

const clone = (q: Question): Question => JSON.parse(JSON.stringify(q));

const FALLBACK_QUESTIONS: Question[] = [
  {
    id: "fb-q1",
    text: "Futbol to'garagiga 12 nafar o'quvchi yozildi. Bundan 7 nafari sinfdoshlaring. To'garagga qo'shilgan boshqa sinflar o'quvchilari soni x bo'lsa, x + 7 = 12 tenglamasidan x nechaga teng?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    concept: "Bir bosqichli tenglamalar",
    contextTag: "futbol",
  },
  {
    id: "fb-q2",
    text: "Sevimli o'yiningda bitta jangovar o'yinchi darajasi 14 tanga turadi. Agar sen ikkita xuddi shunday o'yinchini x tanga eviga sotib olgan bo'lsang va 2x = 14 tenglamasi tuzilsa, x nechaga teng?",
    options: ["6", "8", "7", "9"],
    correctIndex: 2,
    concept: "Bir bosqichli tenglamalar",
    contextTag: "o'yinlar",
  },
  {
    id: "fb-q3",
    text: "Texnologiya to'garagida robot yig'ish uchun 3x - 6 = 12 tenglamasi berildi. Bu tenglamada x nechaga teng?",
    options: ["5", "7", "9", "6"],
    correctIndex: 3,
    concept: "Ikki bosqichli tenglamalar",
    contextTag: "texnologiya",
  },
  {
    id: "fb-q4",
    text: "Futbol maydonida mashg'ulot: birinchi mashq 2x + 5 daqiqa, ikkinchisi 3x - 8 daqiqa davom etdi va ikkalasi teng bo'ldi: 2x + 5 = 3x - 8. x nechaga teng?",
    options: ["11", "13", "15", "17"],
    correctIndex: 1,
    concept: "Ko'p bosqichli tenglamalar",
    contextTag: "futbol",
  },
  {
    id: "fb-q5",
    text: "O'yin turnirida har bir g'alaba uchun 30 ball olasan. Turnir boshida 45 ball jarima yig'ildi, oxirida jami 165 ball bo'ldi. G'alabalar soni x bo'lsa, 30x - 45 = 165 tenglamasidan x nechaga teng?",
    options: ["6", "7", "8", "9"],
    correctIndex: 1,
    concept: "So'zli masalalar",
    contextTag: "o'yinlar",
  },
];

const ADAPTIVE_BANK: Record<string, Question[]> = {
  "Bir bosqichli tenglamalar": [
    {
      id: "fb-a1",
      text: "O'yin do'konida qahramon uchun kiyim sotib olish uchun x - 3 = 9 tenglamasi berildi (3 tangang yetishmayapti). x nechaga teng?",
      options: ["10", "11", "12", "13"],
      correctIndex: 2,
      concept: "Bir bosqichli tenglamalar",
      contextTag: "o'yinlar",
    },
    {
      id: "fb-a2",
      text: "Futbol jamoangiz 12 ta gol urdi, ulardan x tasi jarima zarbasidan. Oddiy gollar 9 ta bo'lsa, x + 9 = 12 tenglamasidan x nechaga teng?",
      options: ["2", "3", "4", "5"],
      correctIndex: 1,
      concept: "Bir bosqichli tenglamalar",
      contextTag: "futbol",
    },
  ],
  "Ikki bosqichli tenglamalar": [
    {
      id: "fb-b1",
      text: "Klanning yangi o'yinchi skini 4x + 5 = 25 tanga turadi. x nechaga teng?",
      options: ["4", "5", "6", "7"],
      correctIndex: 1,
      concept: "Ikki bosqichli tenglamalar",
      contextTag: "o'yinlar",
    },
    {
      id: "fb-b2",
      text: "Stadion chiptasi 3x - 4 = 14 ming so'm. x nechaga teng?",
      options: ["5", "6", "7", "8"],
      correctIndex: 1,
      concept: "Ikki bosqichli tenglamalar",
      contextTag: "futbol",
    },
  ],
  "Ko'p bosqichli tenglamalar": [
    {
      id: "fb-c1",
      text: "Ikki jamoa mashq daqiqalari tenglashtirildi: 5x - 12 = 3x + 6. x nechaga teng?",
      options: ["8", "9", "10", "11"],
      correctIndex: 1,
      concept: "Ko'p bosqichli tenglamalar",
      contextTag: "futbol",
    },
    {
      id: "fb-c2",
      text: "O'yindagi ikki qahramonning kuchi tenglashtirilgan: 6x - 20 = 4x + 14. x nechaga teng?",
      options: ["15", "16", "17", "18"],
      correctIndex: 2,
      concept: "Ko'p bosqichli tenglamalar",
      contextTag: "o'yinlar",
    },
  ],
  "So'zli masalalar": [
    {
      id: "fb-d1",
      text: "Turnir har bir o'yin uchun 25 ball beradi. Boshlanishida 10 ball jarima bo'ldi, oxirida jami 140 ball to'pladi. O'ynagan o'yinlar soni x bo'lsa, 25x - 10 = 140 tenglamasidan x nechaga teng?",
      options: ["5", "6", "7", "8"],
      correctIndex: 1,
      concept: "So'zli masalalar",
      contextTag: "o'yinlar",
    },
    {
      id: "fb-d2",
      text: "Har bir mashg'ulot uchun 40 marta to'p urish kerak. Bugun 15 marta yetishib ketsa ham jami 185 marta urilgan bo'ldi: 40x + 15 = 185. Mashg'ulotlar soni x nechaga teng?",
      options: ["3", "4", "5", "6"],
      correctIndex: 2,
      concept: "So'zli masalalar",
      contextTag: "futbol",
    },
  ],
};

const ADAPTIVE_MESSAGES = [
  "Bu safar to'g'ri kelmadi. Keling, shu tushunchani boshqa usulda sinab ko'ramiz.",
  "Yaxshi urinish! Tushuncha deyarli o'zlashdi — yana bir savol bilan mustahkamlaymiz.",
  "Xavotir olma, bu oddiy xato. Shu tushunchani biroz boshqa ko'rinishda yana sinab ko'ramiz.",
];

export function fallbackQuestions(): Question[] {
  return FALLBACK_QUESTIONS.map(clone);
}

export function fallbackAdaptive(question: Question, attemptNo: number): AdaptiveResult {
  const bank = ADAPTIVE_BANK[question.concept] ?? ADAPTIVE_BANK["Bir bosqichli tenglamalar"];
  const next = clone(bank[(attemptNo - 1) % bank.length]);
  next.id = `${next.id}-v${attemptNo}-${Date.now() % 10000}`;
  return {
    message: ADAPTIVE_MESSAGES[(attemptNo - 1) % ADAPTIVE_MESSAGES.length],
    question: next,
  };
}

const CREDIT = [1, 0.7, 0.4];

export function computeMastery(results: { attempts: number; solved: boolean; done: boolean }[]): number {
  if (results.length === 0) return 0;
  const full = 100 / results.length;
  let sum = 0;
  for (const r of results) {
    if (!r.done) continue;
    if (r.solved) sum += full * (CREDIT[r.attempts - 1] ?? 0);
  }
  return Math.round(sum);
}

export function fallbackReport(summaries: SessionSummary[]): ReportData {
  const results = summaries.map((s) => ({
    attempts: s.attempts,
    solved: s.solved,
    done: true,
  }));
  const mastery = computeMastery(results);

  const strengths = summaries.filter((s) => s.solved && s.attempts === 1).map((s) => s.concept);
  const weaknesses = summaries.filter((s) => !s.solved || s.attempts > 1).map((s) => s.concept);

  return {
    mastery,
    strengths: [...new Set(strengths)].slice(0, 3),
    weaknesses: [...new Set(weaknesses)].slice(0, 2),
    feedback:
      mastery >= 80
        ? "Ajoyib natija! Asosiy tushunchalarni mustahkam o'zlashtirdding. Murakkab masalalarni davom ettirib, yangi mavzularga tayyorlan."
        : mastery >= 50
          ? "Yaxshi yo'lda ekansan! Bir necha tushuncha mustahkam o'zlashdi, qolganlarini qisqa mashqlar bilan mustahkamlaymiz. Har kuni 10 daqiqa mashq yetarli."
          : "Boshlanishi qiyin bo'ldi, ammo bu — o'rganishning normal qismi. Har bir savolni bosqichma-bosqich tahlil qilib, asosiy tushunchalardan qayta boshlaymiz.",
  };
}
