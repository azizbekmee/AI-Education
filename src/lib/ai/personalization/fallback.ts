import type { Activity, Experience, ReportData, SessionSummary } from "@/types";

/**
 * Deterministic demo experiences — used when the AI is unavailable.
 * Multiple themed experiences chosen by the student's interest keywords;
 * the theme is only a demo context, the academic objective stays fixed.
 */

interface FallbackTheme {
  keys: string[];
  typeLabel: string;
  icon: string;
  intro: (name: string, topic: string, today: string) => string;
  ctx: { a1: string; a2: string; a3: string; a4: string; a5: string };
}

const THEMES: FallbackTheme[] = [
  {
    keys: ["futbol", "football", "soccer", "sport"],
    typeLabel: "Futbol klubi strategiya sessiyasi",
    icon: "⚽",
    intro: (name, topic) =>
      `Salom, ${name}! Bugun sen yirik futbol klubining taktik analitigisan. Klub rahbariyati ${topic} bo'yicha muhim hisob-kitoblarni sening zimangga yukladi. Har bir qaror jamoaning natijasiga ta'sir qiladi!`,
    ctx: {
      a1: "Mashg'ulot rejasida jamoa 12 ta mashq bajarishi kerak, ulardan 7 tasi allaqachon tugagan. Qolgan mashqlar soni x: x + 7 = 12. x nechaga teng?",
      a2: "Transfer byudjeti tenglamasi berildi: 2x = 14 (mln so'm). Yangi futbolchining narxi x nechaga teng?",
      a3: "Ikki mashq rejasi taqqoslanmoqda: birinchisi 2x + 5 daqiqa, ikkinchisi 3x - 8 daqiqa va ular teng: 2x + 5 = 3x - 8. x nechaga teng?",
      a4: "Yakuniy hisobotni rasmiylashtirish bosqichlarini to'g'ri tartibga sol.",
      a5: "Turnir analitikasi: har bir g'alaba 30 ball, boshida 45 ball jarima, oxirida jami 165 ball. Tenglama tuzib, yechimni tushuntirib ber.",
    },
  },
  {
    keys: ["kosmos", "space", "yulduz", "sayyora", "koinot", "raket"],
    typeLabel: "Kosmik missiya: navigator sifatida",
    icon: "🚀",
    intro: (name, topic) =>
      `Salom, ${name}! Bugun sen kosmik missiyaning navigatorisan. Markaziy boshqaruv ${topic} bo'yicha eng muhim navigatsiya hisoblarini senga topshirdi — xato qilsang, missiya yo'ldan chetlashadi!`,
    ctx: {
      a1: "Zond orbitada 520 km masofani bosib o'tishi kerak, 480 km allaqachon bosib o'tilgan. Qolgan masofa x: x + 480 = 520. x nechaga teng (km)?",
      a2: "Yonilg'i hisobi: bir modul 2x tonna yoqilg'i sarflaydi, jami sarf 14 tonna: 2x = 14. x nechaga teng?",
      a3: "Ikki orbita parametri tenglashtirildi: 2x + 5 = 3x - 8. Muvozanat nuqtasi x nechaga teng?",
      a4: "Borto tizimini tekshirish bosqichlarini to'g'ri tartibga sol.",
      a5: "Missiya yakuni: uchastka har galaktik yurish uchun 30 birlik energiya, boshlang'ich zaxiradan 45 birlik yo'qotildi, oxirida 165 birlik qoldi. Tenglama tuzib, hisobotni tushuntirib ber.",
    },
  },
  {
    keys: ["avtomobil", "avto", "mashina", "car", "motosikl", "transport"],
    typeLabel: "Dilerlik konfiguratsiya mashg'uloti",
    icon: "🚗",
    intro: (name, topic) =>
      `Salom, ${name}! Bugun sen avtomobil dilerligining yetakchi konsultantisisan. Mijozlar ${topic} bo'yicha aniq hisob kutmoqda — chegirma, qo'shimcha opsiya va yakuniy narx sening qo'lingda!`,
    ctx: {
      a1: "Bazaviy paket 9 mln so'm, mijoz 3 mln so'mlik chegirma kutmoqda. Chegirmadan keyingi narx x: x + 3 = 9 (mln so'm). x nechaga teng?",
      a2: "Ikki tomonlama xavfsizlik paketi 2x mln so'm, jami qo'shimcha to'lov 14 mln so'm: 2x = 14. x nechaga teng?",
      a3: "Ikki komplektatsiya narxi tenglashtirildi: 2x + 5 = 3x - 8 (mln so'm). Muvozanat narxi x nechaga teng?",
      a4: "Buyurtma rasmiylashtirish bosqichlarini to'g'ri tartibga sol.",
      a5: "Korporativ mijoz uchun har bir avtomobil 30 mln so'm, yetkazish 45 mln so'm, jami shartnoma 165 mln so'm. Tenglama tuzib, hisobni tushuntirib ber.",
    },
  },
  {
    keys: ["arxitektur", "bino", "qurilish", "dizayn", "loyiha"],
    typeLabel: "Arxitektural loyiha byurosi",
    icon: "🏛️",
    intro: (name, topic) =>
      `Salom, ${name}! Bugun sen arxitektural byurolarda kichik loyiha mutaxassisisan. Mijoz ${topic} bo'yicha loyiha hisoblarini kutmoqda — chizmadan yakuniy tarkibgacha hammasi sening qo'lingda!`,
    ctx: {
      a1: "Loyihada 12 ta xona loyihalashmoqda, 7 tasi tasdiqlangan. Qolgan xonalar x: x + 7 = 12. x nechaga teng?",
      a2: "Har bir blokda 2x kvartira bor, jami 14 kvartira: 2x = 14. x nechaga teng?",
      a3: "Ikki qanotning balandligi tenglashdi: 2x + 5 = 3x - 8 (metr). x nechaga teng?",
      a4: "Loyiha tasdiqlash bosqichlarini to'g'ri tartibga sol.",
      a5: "Byudjet: har bir bo'lim 30 mln so'm, rejalashtirishda 45 mln so'm tejaldi, oxirida jami 165 mln so'm sarflandi. Tenglama tuzib, tushuntirib ber.",
    },
  },
  {
    keys: ["anime", "manqa", "qahramon", "fantastik"],
    typeLabel: "Sehrlangan dunyo sarguzashti",
    icon: "⚔️",
    intro: (name, topic) =>
      `Salom, ${name}! Bugun sen anime uslubidagi sehrlangan dunyoning yosh tahlilchisisan. Akademiya ustozlari ${topic} bo'yicha maxsus sinovlarni tayyorladi — har bir to'g'ri javob kuchni oshiradi!`,
    ctx: {
      a1: "Qahramoning 12 ta jangovar xaraha ega, ulardan 7 tasi iste'mol bo'ldi. Qolgan kuchi x: x + 7 = 12. x nechaga teng?",
      a2: "Ikki barobar kuch kristali 2x birlik energiya beradi, jami 14 birlik: 2x = 14. x nechaga teng?",
      a3: "Ikki sehrgar kuchi tenglashdi: 2x + 5 = 3x - 8. x nechaga teng?",
      a4: "Sehrgarlik ritual bosqichlarini to'g'ri tartibga sol.",
      a5: "Turnir: har bir g'alaba 30 ball, boshida 45 ball yo'qotildi, oxirida 165 ball. Tenglama tuzib, yechimni tushuntirib ber.",
    },
  },
];

const DEFAULT_THEME: FallbackTheme = {
  keys: [],
  typeLabel: "Interaktiv sarguzasht tajribasi",
  icon: "🧭",
  intro: (name, topic) =>
    `Salom, ${name}! Bugun ${topic} mavzusini o'rganish uchun senga maxsus sarguzasht loyihaladim. Har bir qadam yangi kashfiyot — kettik!`,
  ctx: {
    a1: "Sarguzasht birinchi sinovi: x + 7 = 12 tenglamasi. x nechaga teng?",
    a2: "Ikkinchi sinov: 2x = 14 tenglamasi. x nechaga teng?",
    a3: "Eng qiyin sinov: 2x + 5 = 3x - 8 tenglamasi. x nechaga teng?",
    a4: "Yakuniy eshikni ochish uchun bosqichlarni to'g'ri tartibga sol.",
    a5: "So'zli masala: har bir qadam 30 ball, boshida 45 ball jarima, jami 165 ball. Tenglama tuzib, tushuntirib ber.",
  },
};

function pickTheme(todayInterest: string, interests: string[]): FallbackTheme {
  const haystack = `${todayInterest} ${interests.join(" ")}`.toLowerCase();
  for (const t of THEMES) {
    if (t.keys.some((k) => haystack.includes(k))) return t;
  }
  return DEFAULT_THEME;
}

function buildThemeActivities(theme: FallbackTheme): Activity[] {
  return [
    {
      id: "fb-1",
      kind: "choice",
      concept: "Bir bosqichli tenglamalar",
      title: "1-qadam: issiqlik mashgi",
      prompt: theme.ctx.a1,
      options: ["4", "5", "6", "7"],
      correctIndex: 1,
      solution: "x + 7 = 12 → x = 12 - 7 = 5",
    },
    {
      id: "fb-2",
      kind: "numeric",
      concept: "Bir bosqichli tenglamalar",
      title: "2-qadam: hisob majburiy",
      prompt: theme.ctx.a2,
      acceptedAnswers: ["7", "x = 7", "x=7"],
      solution: "2x = 14 → x = 14 : 2 = 7",
    },
    {
      id: "fb-3",
      kind: "choice",
      concept: "Ko'p bosqichli tenglamalar",
      title: "3-qadam: asosiy qaror",
      prompt: theme.ctx.a3,
      options: ["11", "13", "15", "17"],
      correctIndex: 1,
      solution: "2x + 5 = 3x - 8 → 5 + 8 = 3x - 2x → x = 13",
    },
    {
      id: "fb-4",
      kind: "ordering",
      concept: "Tenglamani yechish ketma-ketligi",
      title: "4-qadam: tartibni top",
      prompt: theme.ctx.a4,
      items: [
        "Tenglamani soddalashtirish",
        "x hadlarni bir tomonga, sonlarni boshqa tomonga ko'chirish",
        "Har ikki tomonni x ning koeffitsientiga bo'lish",
        "Javobni asl tenglamaga qo'yib tekshirish",
      ],
      correctOrder: [
        "Tenglamani soddalashtirish",
        "x hadlarni bir tomonga, sonlarni boshqa tomonga ko'chirish",
        "Har ikki tomonni x ning koeffitsientiga bo'lish",
        "Javobni asl tenglamaga qo'yib tekshirish",
      ],
      solution: "Soddalashtirish → ko'chirish → bo'lish → tekshirish",
    },
    {
      id: "fb-5",
      kind: "free_response",
      concept: "So'zli masalalar",
      title: "5-qadam: yakuniy vazifa",
      prompt: `${theme.ctx.a5} Qisqa (2-3 jumla) yozib yuboring.`,
      solution: "30x - 45 = 165 → 30x = 210 → x = 7",
    },
  ];
}

export function fallbackExperience(input: {
  name: string;
  topicTitle: string;
  interests: string[];
  todayInterest: string;
}): Experience {
  const theme = pickTheme(input.todayInterest, input.interests);
  const today = input.todayInterest || input.interests[0] || "";
  return {
    id: "fb-exp",
    title: input.topicTitle,
    typeLabel: theme.typeLabel,
    icon: theme.icon,
    intro: theme.intro(input.name, input.topicTitle, today),
    objective: input.topicTitle,
    activities: buildThemeActivities(theme),
  };
}

/* ---------- Adaptive fallback: simpler sub-problems on the same concept ---------- */

export function fallbackAdapt(
  original: Activity,
  attemptNo: number
): { route: string; message: string; activity: Activity } {
  const messages = [
    "Bu safar to'g'ri kelmadi. Keling, shu tushunchani boshqa usulda — sodda qadamlarga bo'lib ko'ramiz.",
    "Yaxshi urinish! Tushuncha deyarli qo'lga kirdi — uni biroz boshqa ko'rinishda mustahkamlaymiz.",
    "Xavotir olma, bu oddiy xato. Shu tushunchani vizual qiyoslab yana sinab ko'ramiz.",
  ];
  const routes = ["sodda qadamga bo'lish", "qiyoslash va mustahkamlash", "vizual qiyoslash"];

  const base: Activity =
    attemptNo === 1
      ? {
          id: `fb-a-${attemptNo}-${Date.now() % 10000}`,
          kind: "choice",
          concept: original.concept,
          prompt: `Iltmiski tushunchani sodda shaklda: agar x + 3 = 10 bo'lsa, x nechaga teng? (Boshqa usul: bir tomondan ayirish)`,
          options: ["5", "6", "7", "8"],
          correctIndex: 2,
          solution: "x + 3 = 10 → x = 10 - 3 = 7",
        }
      : attemptNo === 2
        ? {
            id: `fb-a-${attemptNo}-${Date.now() % 10000}`,
            kind: "choice",
            concept: original.concept,
            prompt: `Yana bir qiyos: agar 2x = 16 bo'lsa, x nechaga teng? (Har ikki tomonni 2 ga bo'lish)`,
            options: ["6", "7", "8", "9"],
            correctIndex: 2,
            solution: "2x = 16 → x = 16 : 2 = 8",
          }
        : {
            id: `fb-a-${attemptNo}-${Date.now() % 10000}`,
            kind: "ordering",
            concept: original.concept,
            prompt: "Tenglamani yechish ketma-ketligini tartibga sol (yechish yo'lini vizual ko'rish):",
            items: ["Soddalashtirish", "Ko'chirish", "Bo'lish", "Tekshirish"],
            correctOrder: ["Soddalashtirish", "Ko'chirish", "Bo'lish", "Tekshirish"],
            solution: "Soddalashtirish → ko'chirish → bo'lish → tekshirish",
          };

  return {
    route: routes[(attemptNo - 1) % routes.length],
    message: messages[(attemptNo - 1) % messages.length],
    activity: base,
  };
}

/* ---------- Fallback report ---------- */

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

export function fallbackReport(input: {
  name: string;
  todayInterest: string;
  experienceTypeLabel: string;
  summaries: SessionSummary[];
}): ReportData {
  const { summaries } = input;
  const mastery = computeMastery(summaries.map((s) => ({ attempts: s.attempts, solved: s.solved, done: true })));

  const strengths = [...new Set(summaries.filter((s) => s.solved && s.attempts === 1).map((s) => s.concept))];
  const weaknesses = [...new Set(summaries.filter((s) => !s.solved || s.attempts > 1).map((s) => s.concept))];
  const retrySuccess = summaries.some((s) => s.solved && s.attempts > 1);

  const feedback =
    mastery >= 80
      ? "Ajoyib natija! Asosiy tushunchalarni mustahkam o'zlashtirding. Murakkab masalalarni davom ettirib, yangi mavzularga tayyorlan."
      : mastery >= 50
        ? "Yaxshi yo'lda ekansan! Bir necha tushuncha mustahkam o'zlashdi, qolganlarini qisqa mashqlar bilan mustahkamlash mumkin. Har kuni 10 daqiqa mashq yetarli."
        : "Boshlanishi qiyin bo'ldi, ammo bu — o'rganishning normal qismi. Har bir qadamni bosqichma-bosqich tahlil qilib, asosiy tushunchalardan qayta boshlaymiz.";

  const interest = input.todayInterest || "o'quvchining qiziqishlari";
  const insight = `AI ushbu topshiriqni ${input.name} uchun "${interest}" kontekstiga moslab, ${input.experienceTypeLabel} formatida loyihaladi. ${summaries.length} ta qadam bajarildi. ${
    retrySuccess
      ? "Birinchi urinishda xato qilingan qadamlar boshqa yondashuv bilan qayta berilgan va shundan keyin to'g'ri yechilgan."
      : "Qadamlarning aksariyati birinchi urinishda to'g'ri yechilgan."
  }`;

  return { mastery, strengths, weaknesses, feedback, insight };
}
