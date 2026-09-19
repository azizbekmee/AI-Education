import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const globalForDb = globalThis as unknown as { __aeDb?: Database.Database };

export const db = globalForDb.__aeDb ?? new Database(path.join(dataDir, "app.db"));
globalForDb.__aeDb = db;

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('teacher','student')),
  interests TEXT NOT NULL DEFAULT '[]',
  learning_style TEXT NOT NULL DEFAULT '',
  profile_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')),
  questions TEXT NOT NULL DEFAULT '[]',
  results TEXT NOT NULL DEFAULT '[]',
  mastery REAL NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  student_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  assignment_title TEXT NOT NULL,
  mastery REAL NOT NULL,
  strengths TEXT NOT NULL,
  weaknesses TEXT NOT NULL,
  feedback TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* ---------- New school-structure tables ---------- */

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  grade INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  grade INTEGER NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(subject_id, grade, name)
);

CREATE TABLE IF NOT EXISTS teacher_class (
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  PRIMARY KEY (teacher_id, class_id)
);

CREATE TABLE IF NOT EXISTS teacher_subject (
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE TABLE IF NOT EXISTS teacher_topic (
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  PRIMARY KEY (teacher_id, topic_id)
);

CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 6),
  lesson_number INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  teacher_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS assignment_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'application/octet-stream',
  data TEXT,
  extracted_text TEXT NOT NULL DEFAULT ''
);
`);

// Schema additions for the personalization engine + new assignment model (safe on existing databases)
const addColumn = (table: string, column: string, definition: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    /* column already exists */
  }
};
addColumn("users", "class_id", "INTEGER REFERENCES classes(id)");
addColumn("users", "subject_id", "INTEGER REFERENCES subjects(id)");
addColumn("sessions", "today_interest", "TEXT NOT NULL DEFAULT ''");
addColumn("sessions", "mood", "TEXT NOT NULL DEFAULT ''");
addColumn("sessions", "work_mode", "TEXT NOT NULL DEFAULT ''");
addColumn("reports", "insight", "TEXT NOT NULL DEFAULT ''");
addColumn("reports", "topic_breakdown", "TEXT NOT NULL DEFAULT '[]'");
addColumn("assignments", "class_id", "INTEGER REFERENCES classes(id)");
addColumn("assignments", "subject_id", "INTEGER REFERENCES subjects(id)");
addColumn("assignments", "topic_id", "INTEGER REFERENCES topics(id)");
addColumn("assignments", "note", "TEXT NOT NULL DEFAULT ''");
addColumn("assignments", "original", "TEXT");
addColumn("assignments", "deadline", "TEXT");

/* ============================ SEED ============================ */

// Full demo school seed — idempotent: runs only when the demo teacher doesn't exist yet
const demoTeacherExists = db
  .prepare("SELECT 1 FROM users WHERE email = 'teacher.math@edumind.demo'")
  .get();

if (!demoTeacherExists) {
  const seedAll = db.transaction(() => {
    /* ---- subjects ---- */
    const SUBJECT_NAMES = ["Matematika", "Ona tili", "Ingliz tili", "Tarix", "Fizika", "Biologiya"];
    for (const name of SUBJECT_NAMES) {
      db.prepare("INSERT OR IGNORE INTO subjects (name) VALUES (?)").run(name);
    }
    const subjectRows = db
      .prepare(
        `SELECT id, name FROM subjects WHERE name IN (${SUBJECT_NAMES.map(() => "?").join(",")})`
      )
      .all(...SUBJECT_NAMES) as { id: number; name: string }[];
    const subject = subjectRows.find((s) => s.name === "Matematika")!;
    const subjectIdByName = new Map(subjectRows.map((s) => [s.name, s.id] as const));

    /* ---- 15 classes: grades 4-8, three parallel classes (A/B/D) per grade ---- */
    const CLASS_NAMES = [
      "4-A", "4-B", "4-D",
      "5-A", "5-B", "5-D",
      "6-A", "6-B", "6-D",
      "7-A", "7-B", "7-D",
      "8-A", "8-B", "8-D",
    ];
    const insertClass = db.prepare("INSERT OR IGNORE INTO classes (name, grade) VALUES (?, ?)");
    const classIds = new Map<string, number>();
    for (const name of CLASS_NAMES) {
      const grade = parseInt(name, 10);
      const id = insertClass.run(name, grade).lastInsertRowid as number;
      classIds.set(name, id);
    }

    /* ---- math topics per grade (4-8) ---- */
    const TOPICS_LOW = ["Qo'shish va ayirish", "Ko'paytirish va bo'lish", "Kasrlar", "Geometrik shakllar", "O'lchov birliklari"];
    const TOPICS_HIGH = [
      "Algebraik ifodalar", "Chiziqli tenglamalar", "Kasrlar", "Foizlar", "Nisbat va proporsiya",
      "Funksiyalar", "Tenglamalar sistemasi", "Geometriya", "Pifagor teoremasi",
    ];
    const insertTopic = db.prepare("INSERT OR IGNORE INTO topics (subject_id, grade, name) VALUES (?, ?, ?)");
    for (let grade = 4; grade <= 8; grade++) {
      const list = grade <= 4 ? TOPICS_LOW : TOPICS_HIGH;
      for (const t of list) insertTopic.run(subject.id, grade, t);
    }

    /* ---- demo teachers ---- */
    const insertTeacher = db.prepare(
      "INSERT INTO users (email, password, name, role, subject_id, profile_completed) VALUES (?, ?, ?, 'teacher', ?, 1)"
    );
    const teacherId = insertTeacher
      .run("teacher.math@edumind.demo", "Demo123!", "Nodira", subject.id).lastInsertRowid as number;

    // Extra teachers so the timetable never double-books anyone
    const OTHER_TEACHERS: { email: string; name: string; subject: string }[] = [
      { email: "teacher.math2@edumind.demo", name: "Dilshod Rajabov", subject: "Matematika" },
      { email: "teacher.math3@edumind.demo", name: "Oybek Xolmatov", subject: "Matematika" },
      { email: "teacher.ona1@edumind.demo", name: "Zuhra Yo'ldosheva", subject: "Ona tili" },
      { email: "teacher.ona2@edumind.demo", name: "Malika Nazarova", subject: "Ona tili" },
      { email: "teacher.ing1@edumind.demo", name: "Aziza Qodirova", subject: "Ingliz tili" },
      { email: "teacher.ing2@edumind.demo", name: "Elbek Sultonov", subject: "Ingliz tili" },
      { email: "teacher.tar1@edumind.demo", name: "Farrux Toshmatov", subject: "Tarix" },
      { email: "teacher.tar2@edumind.demo", name: "Gulbahor Eshonova", subject: "Tarix" },
      { email: "teacher.fiz1@edumind.demo", name: "Nigora Abdullayeva", subject: "Fizika" },
      { email: "teacher.fiz2@edumind.demo", name: "Bahodir Ergashev", subject: "Fizika" },
      { email: "teacher.bio1@edumind.demo", name: "Ravshan Qoraboyev", subject: "Biologiya" },
      { email: "teacher.bio2@edumind.demo", name: "Mohira Sobirova", subject: "Biologiya" },
      { email: "teacher.ona3@edumind.demo", name: "Shahzoda Ergasheva", subject: "Ona tili" },
      { email: "teacher.ing3@edumind.demo", name: "Ulug'bek Zaripov", subject: "Ingliz tili" },
      { email: "teacher.tar3@edumind.demo", name: "Doston Abdazov", subject: "Tarix" },
      { email: "teacher.fiz3@edumind.demo", name: "Kamron Yusupov", subject: "Fizika" },
      { email: "teacher.bio3@edumind.demo", name: "Zilola Xolmuminova", subject: "Biologiya" },
      { email: "teacher.ona4@edumind.demo", name: "Sevara Nazarova", subject: "Ona tili" },
      { email: "teacher.ing4@edumind.demo", name: "Jasur Ismoilov", subject: "Ingliz tili" },
      { email: "teacher.tar4@edumind.demo", name: "Kamila Tosheva", subject: "Tarix" },
      { email: "teacher.fiz4@edumind.demo", name: "Sanjar Nazarov", subject: "Fizika" },
      { email: "teacher.bio4@edumind.demo", name: "Gulchehra Qodirova", subject: "Biologiya" },
    ];
    const teacherIdsBySubject = new Map<string, number[]>();
    for (const t of OTHER_TEACHERS) {
      const id = insertTeacher
        .run(t.email, "Demo123!", t.name, subjectIdByName.get(t.subject)!)
        .lastInsertRowid as number;
      const list = teacherIdsBySubject.get(t.subject) ?? [];
      list.push(id);
      teacherIdsBySubject.set(t.subject, list);
    }

    // teacher → class/subject links: Nodira keeps roster visibility of all 15 classes,
    // every other teacher is linked only to the classes they actually teach
    const linkClass = db.prepare("INSERT OR IGNORE INTO teacher_class (teacher_id, class_id) VALUES (?, ?)");
    const linkSubject = db.prepare("INSERT OR IGNORE INTO teacher_subject (teacher_id, subject_id) VALUES (?, ?)");
    for (const id of classIds.values()) linkClass.run(teacherId, id);
    db.prepare("INSERT OR IGNORE INTO teacher_subject (teacher_id, subject_id) VALUES (?, ?)").run(teacherId, subject.id);
    const linkTopic = db.prepare("INSERT OR IGNORE INTO teacher_topic (teacher_id, topic_id) SELECT ?, id FROM topics WHERE subject_id = ?");
    linkTopic.run(teacherId, subject.id);

    // which teacher teaches which subject in which class (by CLASS_NAMES index)
    // Nodira → grades 6-7, Dilshod → grades 4-5, Oybek → grade 8
    const teacherFor = new Map<string, number>(); // `${classIndex}:${subjectName}` → teacher id
    for (let ci = 0; ci < CLASS_NAMES.length; ci++) {
      const grade = parseInt(CLASS_NAMES[ci], 10);
      const mathPair = teacherIdsBySubject.get("Matematika")!;
      teacherFor.set(
        `${ci}:Matematika`,
        grade >= 6 && grade <= 7 ? teacherId : grade <= 5 ? mathPair[0] : mathPair[1]
      );
      for (const sName of ["Ona tili", "Ingliz tili", "Tarix", "Fizika", "Biologiya"]) {
        const pair = teacherIdsBySubject.get(sName)!;
        teacherFor.set(`${ci}:${sName}`, pair[ci % pair.length]);
      }
    }
    const linked = new Set<string>();
    for (const [key, tid] of teacherFor) {
      const [, sName] = key.split(":");
      const classIdx = Number(key.split(":")[0]);
      const k = `${tid}:${classIdx}`;
      if (linked.has(k)) continue;
      linked.add(k);
      linkClass.run(tid, classIds.get(CLASS_NAMES[classIdx])!);
      linkSubject.run(tid, subjectIdByName.get(sName)!);
    }

    /* ---- timetable: 6 slots/day (45-min lessons, 5-min breaks), Mon-Sat, 5 lessons/day/class ---- */
    const LESSON_TIMES: Record<number, string> = {
      1: "08:00", 2: "08:50", 3: "09:40", 4: "10:30", 5: "11:20", 6: "12:10",
    };
    // Pinned anchor lessons for the demo teacher (guaranteed math for her assignment classes)
    type SlotLesson = { ci: number; sName: string; tid: number };
    const grid = new Map<string, Map<number, SlotLesson>>(); // `${day}:${lesson}` → classIndex → lesson
    const gridKey = (day: number, lesson: number) => `${day}:${lesson}`;
    const pinned: [number, number, string, string, number][] = [
      [1, 1, "6-A", "Matematika", teacherId], // Dushanba 08:00
      [1, 3, "7-B", "Matematika", teacherId], // Dushanba 09:40
      [2, 1, "6-B", "Matematika", teacherId], // Seshanba 08:00
      [2, 4, "6-D", "Matematika", teacherId], // Seshanba 10:30
      [4, 1, "7-A", "Matematika", teacherId], // Payshanba 08:00
      [6, 1, "6-A", "Matematika", teacherId], // Shanba (bugun) 08:00
    ];
    for (const [day, lesson, clsName, sName, tid] of pinned) {
      const ci = CLASS_NAMES.indexOf(clsName);
      const cell = grid.get(gridKey(day, lesson)) ?? new Map<number, SlotLesson>();
      cell.set(ci, { ci, sName, tid });
      grid.set(gridKey(day, lesson), cell);
    }

    // Fill the rest of the week: every class skips exactly one of the 6 daily slots
    // (so 5 lessons/day). Each class has its own deterministic shuffled subject order;
    // a subject is skipped when its teacher is already teaching another class at that
    // time — so no teacher or class is ever double-booked. A repair pass then swaps
    // subjects between classes to fill remaining gaps.
    const classSubjectOrder = CLASS_NAMES.map((_, ci) => {
      const order = SUBJECT_NAMES.map((sName, k) => ({ sName, h: (ci * 131 + k * 37 + (ci % 7) * 17) % 101 }));
      order.sort((a, b) => a.h - b.h);
      return order.map((o) => o.sName);
    });
    const slotTeacherUsed = (cell: Map<number, SlotLesson>, tid: number) =>
      [...cell.values()].some((l) => l.tid === tid);

    for (let day = 1; day <= 6; day++) {
      for (let lesson = 1; lesson <= 6; lesson++) {
        const key = gridKey(day, lesson);
        const cell = grid.get(key) ?? new Map<number, SlotLesson>();
        grid.set(key, cell);
        // rotate the class visiting order per slot so the same classes aren't always served last
        const offset = (day * 5 + lesson * 3) % CLASS_NAMES.length;
        for (let n = 0; n < CLASS_NAMES.length; n++) {
          const ci = (offset + n) % CLASS_NAMES.length;
          if ((ci * 2 + day * 3 + lesson) % 6 === 0) continue;
          if (cell.has(ci)) continue;
          const order = classSubjectOrder[ci];
          for (let k = 0; k < SUBJECT_NAMES.length; k++) {
            const sName = order[(k + day * 2 + lesson) % SUBJECT_NAMES.length];
            const tid = teacherFor.get(`${ci}:${sName}`)!;
            if (slotTeacherUsed(cell, tid)) continue;
            cell.set(ci, { ci, sName, tid });
            break;
          }
        }
        // repair: for a still-empty class, borrow the teacher's slot from another class
        // in the same cell by moving that class to a different subject
        for (let n = 0; n < CLASS_NAMES.length; n++) {
          const ci = (offset + n) % CLASS_NAMES.length;
          if ((ci * 2 + day * 3 + lesson) % 6 === 0) continue;
          if (cell.has(ci)) continue;
          let repaired = false;
          for (const sName of classSubjectOrder[ci]) {
            const tid = teacherFor.get(`${ci}:${sName}`)!;
            const occupant = [...cell.entries()].find(([, l]) => l.tid === tid);
            if (!occupant) continue;
            const [yi, yLesson] = occupant;
            const yOrder = classSubjectOrder[yi];
            for (const s2 of yOrder) {
              if (s2 === yLesson.sName || s2 === sName) continue;
              const t2 = teacherFor.get(`${yi}:${s2}`)!;
              if (slotTeacherUsed(cell, t2)) continue;
              cell.delete(yi);
              cell.set(yi, { ci: yi, sName: s2, tid: t2 });
              cell.set(ci, { ci, sName, tid });
              repaired = true;
              break;
            }
            if (repaired) break;
          }
        }
      }
    }

    const insertLesson = db.prepare(
      "INSERT INTO timetable (day_of_week, lesson_number, start_time, class_id, subject_id, teacher_id) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const [key, cell] of grid) {
      const [day, lesson] = key.split(":").map(Number);
      for (const l of cell.values()) {
        insertLesson.run(day, lesson, LESSON_TIMES[lesson], classIds.get(CLASS_NAMES[l.ci])!, subjectIdByName.get(l.sName)!, l.tid);
      }
    }

    // Integrity guard: a teacher or a class can never be in two places at once
    const teacherClash = db
      .prepare(
        `SELECT COUNT(*) AS c FROM timetable a JOIN timetable b
         ON a.teacher_id = b.teacher_id AND a.day_of_week = b.day_of_week
         AND a.lesson_number = b.lesson_number AND a.id < b.id`
      )
      .get() as { c: number };
    const classClash = db
      .prepare(
        `SELECT COUNT(*) AS c FROM timetable a JOIN timetable b
         ON a.class_id = b.class_id AND a.day_of_week = b.day_of_week
         AND a.lesson_number = b.lesson_number AND a.id < b.id`
      )
      .get() as { c: number };
    if (teacherClash.c || classClash.c) throw new Error("Timetable seed produced a scheduling conflict");

    /* ---- students: every class gets 25-40 students with varied sizes ---- */
    const insertStudent = db.prepare(
      "INSERT INTO users (email, password, name, role, class_id, interests, learning_style, profile_completed) VALUES (?, 'Demo123!', ?, 'student', ?, ?, ?, 1)"
    );
    const INTEREST_POOL = ["Futbol", "O'yinlar", "Texnologiya", "Musiqа", "Kitob o'qish", "Kosmos", "San'at", "Shaxmat", "Biologiya", "Rasm chizish"];
    const STYLE_POOL = ["Viktorina", "Hikoyali o'qish", "Amaliy mashqlar", "Vizual diagrammalar", "Mustaqil izlanish"];
    const CLASS_SIZES: Record<string, number> = {
      "4-A": 31, "4-B": 28, "4-D": 35, "5-A": 33, "5-B": 29, "5-D": 37,
      "6-A": 32, "6-B": 26, "6-D": 39, "7-A": 34, "7-B": 30, "7-D": 27,
      "8-A": 36, "8-B": 32, "8-D": 38,
    };
    const ci0 = (cls: string) => CLASS_NAMES.indexOf(cls);
    const students: { email: string; name: string; cls: string; interests: string[]; style: string }[] = [
      { email: "student.6a@edumind.demo", name: "Ali Valiyev", cls: "6-A", interests: ["Futbol", "O'yinlar", "Texnologiya"], style: "Viktorina" },
      { email: "dilnoza.6a@edumind.demo", name: "Dilnoza Rahimova", cls: "6-A", interests: ["Musiqа", "Kitob o'qish"], style: "Hikoyali o'qish" },
      { email: "jasur.6a@edumind.demo", name: "Jasur Karimov", cls: "6-A", interests: ["Kosmos", "Texnologiya"], style: "Amaliy mashqlar" },
      { email: "madina.6a@edumind.demo", name: "Madina Yo'ldosheva", cls: "6-A", interests: ["San'at", "Kitob o'qish"], style: "Vizual diagrammalar" },
      { email: "bekzod.6a@edumind.demo", name: "Bekzod Tursunov", cls: "6-A", interests: ["Futbol"], style: "Amaliy mashqlar" },
      { email: "gulnora.6a@edumind.demo", name: "Gulnora Sattorova", cls: "6-A", interests: ["Musiqa"], style: "Viktorina" },
      { email: "sardor.6a@edumind.demo", name: "Sardor Umarov", cls: "6-A", interests: ["Shaxmat", "O'yinlar"], style: "Viktorina" },
      { email: "kamola.6b@edumind.demo", name: "Kamola Ismoilova", cls: "6-B", interests: ["Kitob o'qish"], style: "Hikoyali o'qish" },
      { email: "aziz.6b@edumind.demo", name: "Aziz Rahmonov", cls: "6-B", interests: ["Futbol", "Musiqa"], style: "Amaliy mashqlar" },
      { email: "zarina.7a@edumind.demo", name: "Zarina Qodirova", cls: "7-A", interests: ["Biologiya", "Kitob o'qish"], style: "Vizual diagrammalar" },
      { email: "muhammadali.6a@edumind.demo", name: "Muhammadali Yusupov", cls: "6-A", interests: ["Futbol", "O'yinlar"], style: "Amaliy mashqlar" },
      { email: "nilufar.6a@edumind.demo", name: "Nilufar Hasanova", cls: "6-A", interests: ["Kitob o'qish", "Rasm chizish"], style: "Hikoyali o'qish" },
      { email: "doniyor.6a@edumind.demo", name: "Doniyor Ergashev", cls: "6-A", interests: ["Texnologiya", "Shaxmat"], style: "Mustaqil izlanish" },
      { email: "sevinch.6a@edumind.demo", name: "Sevinch Abdullayeva", cls: "6-A", interests: ["Musiqa", "San'at"], style: "Vizual diagrammalar" },
      { email: "ibrohim.6a@edumind.demo", name: "Ibrohim Nazarov", cls: "6-A", interests: ["Kosmos", "O'yinlar"], style: "Viktorina" },
      { email: "oysha.6a@edumind.demo", name: "Oysha Qodirova", cls: "6-A", interests: ["Rasm chizish", "Kitob o'qish"], style: "Hikoyali o'qish" },
      { email: "temur.6a@edumind.demo", name: "Temur Sattorov", cls: "6-A", interests: ["Futbol", "Shaxmat"], style: "Amaliy mashqlar" },
      { email: "lola.6a@edumind.demo", name: "Lola Rasulova", cls: "6-A", interests: ["Musiqa", "Biologiya"], style: "Viktorina" },
      { email: "umid.6a@edumind.demo", name: "Umid Xolmatov", cls: "6-A", interests: ["Texnologiya", "Kosmos"], style: "Mustaqil izlanish" },
      { email: "yasmina.6a@edumind.demo", name: "Yasmina Tosheva", cls: "6-A", interests: ["San'at", "Musiqа"], style: "Vizual diagrammalar" },
      { email: "shahnoza.6a@edumind.demo", name: "Shahnoza Aliyeva", cls: "6-A", interests: ["Kitob o'qish", "Shaxmat"], style: "Hikoyali o'qish" },
      { email: "doston.6a@edumind.demo", name: "Doston Abdullayev", cls: "6-A", interests: ["Futbol", "Texnologiya"], style: "Amaliy mashqlar" },
      { email: "gunel.6a@edumind.demo", name: "Gunel Yusupova", cls: "6-A", interests: ["Rasm chizish", "Biologiya"], style: "Vizual diagrammalar" },
    ];
    // Deterministic realistic name pool: large enough that first/generated pairs never repeat
    const FIRST_NAMES = [
      "Anvar", "Bobur", "Dilfuza", "Eldor", "Farzona", "G'ayrat", "Hilola", "Islom", "Kamron", "Laylo",
      "Murod", "Nigora", "Otabek", "Rustam", "Shahzod", "To'lqin", "Ulug'bek", "Yulduz", "Zafar", "Aziza",
      "Bahodir", "Charos", "E'zoza", "Firdavs", "Husniddin", "Ismoil", "Jonibek", "Kumush", "Laziz", "Nodirbek",
      "Parviz", "Ravshan", "Sunnat", "Umar", "Vohid", "Xadicha", "Yodgor", "Zuhra", "Alibek", "Bunyod",
      "Dilshoda", "Elzona", "Furqat", "Gulnoza", "Izzat", "Jaloliddin", "Kamoliddin", "Madina", "Nodira", "Oybek",
      "Sevara", "Shohruh", "Torabek", "Umida", "Xurshid", "Yigitali", "Zilola", "Abdulloh", "Behruz", "Dilnoza",
      "Elmurod", "Feruza", "Gulbahor", "Hojiakbar", "Ikbol", "Javohir", "Kamola", "Lola", "Muxlisa", "Nurbek",
      "Odina", "Pari Gul", "Rozia", "Sardor", "Timur", "Umid", "Xolmat", "Yasmina", "Zarina", "Alisher",
    ];
    const LAST_NAMES = [
      "Abdullayev", "Ergashev", "Yo'ldoshev", "Qodirov", "Rasulov", "Sattorov", "Tursunov", "Umarov", "Xolmatov", "Yusupov",
      "Nazarov", "Karimov", "Rahimov", "Ismoilov", "Hasanov", "Toshev", "Zaripov", "Sobirov", "Qoraboyev", "Rajabov",
      "Aliyev", "Sultonov", "Eshonov", "Toshmatov", "Xudoyberdiyev", "Norqulov", "Saidov", "Mamadaliev", "Avezov", "G'afurov",
      "Ibrohimov", "Yakubov", "Xolliyev", "Shermatov", "Jumayev", "Ortiqov", "Pardayev", "Sultonmurodov", "Tojiyev", "Uteniazov",
      "Fozilov", "Xoliqov", "Cho'yanov", "Sheraliyev", "Musaev", "Yodgorov", "Qosimov", "Ruzmetov",
    ];
    const usedNames = new Set(students.map((s) => s.name));
    let genIdx = 0;
    for (const clsName of CLASS_NAMES) {
      const target = CLASS_SIZES[clsName];
      const slug = clsName.toLowerCase().replace("-", "");
      const have = students.filter((s) => s.cls === clsName).length;
      for (let j = have; j < target; j++) {
        const fi = (genIdx * 7 + 3) % FIRST_NAMES.length;
        let li = (Math.floor(genIdx / FIRST_NAMES.length) * 5 + genIdx * 3) % LAST_NAMES.length;
        let name = `${FIRST_NAMES[fi]} ${LAST_NAMES[li]}`;
        while (usedNames.has(name)) {
          li = (li + 1) % LAST_NAMES.length;
          name = `${FIRST_NAMES[fi]} ${LAST_NAMES[li]}`;
        }
        usedNames.add(name);
        students.push({
          email: `s${genIdx + 1}.${slug}@edumind.demo`,
          name,
          cls: clsName,
          interests: [INTEREST_POOL[(genIdx * 3) % INTEREST_POOL.length], INTEREST_POOL[(genIdx * 3 + 5) % INTEREST_POOL.length]],
          style: STYLE_POOL[(genIdx * 2 + ci0(clsName)) % STYLE_POOL.length],
        });
        genIdx++;
      }
    }
    if (new Set(students.map((s) => s.name)).size !== students.length) {
      throw new Error("Seed xatosi: o'quvchi ism-familiyalari takrorlangan");
    }
    for (const s of students) {
      insertStudent.run(s.email, s.name, classIds.get(s.cls)!, JSON.stringify(s.interests), s.style);
    }

    /* ---- helper: build a minimal stored experience for seeded sessions ---- */
    const makeExperience = (title: string, topic: string) => ({
      id: "exp-seed",
      title,
      typeLabel: "Interaktiv o'quv sessiyasi",
      icon: "📚",
      intro: `${topic} mavzusidagi topshiriqni bosqichma-bosqich bajarib, o'zlashtirishni mustahkamlaysiz.`,
      objective: topic,
      activities: [
        { id: "a1", kind: "choice", concept: topic, prompt: "Birinchi savol — variantlardan to'g'risini tanlang.", options: ["A", "B", "C", "D"], solution: "To'g'ri variant" },
        { id: "a2", kind: "numeric", concept: topic, prompt: "Ikkinchi savol — javobni kiriting.", solution: "Javob" },
        { id: "a3", kind: "ordering", concept: topic, prompt: "Uchinchi savol — bosqichlarni tartibga soling.", items: ["1-bosqich", "2-bosqich", "3-bosqich"], correctOrder: ["1-bosqich", "2-bosqich", "3-bosqich"], solution: "1 → 2 → 3" },
        { id: "a4", kind: "free_response", concept: topic, prompt: "To'rtinchi savol — qisqa yozib tushuntiring.", solution: "Namuna javob" },
        { id: "a5", kind: "choice", concept: topic, prompt: "Beshinchi savol — variantlardan to'g'risini tanlang.", options: ["A", "B", "C", "D"], solution: "To'g'ri variant" },
      ],
    });

    /* ---- sample assignments (all by the demo teacher, math topics) ---- */
    const topicId = (grade: number, name: string) =>
      (db.prepare("SELECT id FROM topics WHERE subject_id = ? AND grade = ? AND name = ?").get(subject.id, grade, name) as { id: number } | undefined)?.id ?? null;

    const insertAssignment = db.prepare(
      `INSERT INTO assignments (teacher_id, class_id, subject_id, topic_id, title, content, note, original, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertFile = db.prepare(
      "INSERT INTO assignment_files (assignment_id, name, size, type, data, extracted_text) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const insertReport = db.prepare(
      `INSERT INTO reports (session_id, student_id, assignment_id, assignment_title, mastery, strengths, weaknesses, feedback, insight, topic_breakdown, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertNotification = db.prepare("INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)");

    const insertNotificationForTeacher = (tid: number, studentId: number, title: string, mastery: number) => {
      const name = (db.prepare("SELECT name FROM users WHERE id = ?").get(studentId) as { name: string }).name;
      insertNotification.run(tid, "Yangi o'quv hisoboti mavjud", `${name} «${title}» topshiriqni yakunladi. O'zlashtirish: ${mastery}%.`);
    };

    const eqContent =
      "Quyidagi tenglamalarni yeching va har bir yechim bosqichini yozing:\n" +
      "1. x + 5 = 10\n2. 2x = 14\n3. 3x - 4 = 11\n4. 2x + 5 = 3x - 8\n" +
      "5. So'zli masala: Bir yashikda 24 ta o'q kitob bor, bu boshqa yashikdagi kitoblardan 6 taga ko'p. Ikkinchi yashikda nechta kitob bor?";
    const eqOriginal = {
      title: "Chiziqli tenglamalar",
      requirements: ["Har bir tenglamani bosqichma-bosqich yeching", "Javobni tekshiring", "So'zli masalada tenglama tuzing"],
      questions: [
        { text: "x + 5 = 10", answer: "x = 5", answerType: "numeric" },
        { text: "2x = 14", answer: "x = 7", answerType: "numeric" },
        { text: "3x - 4 = 11", answer: "x = 5", answerType: "numeric" },
        { text: "2x + 5 = 3x - 8", answer: "x = 13", answerType: "numeric" },
        { text: "So'zli masala: 24 = x + 6", answer: "x = 18", answerType: "numeric" },
      ],
      constraints: "Barcha masalalar ishlanishi shart. Yechim bosqichlari yozilishi shart.",
      rawText: eqContent,
    };

    const a1 = insertAssignment.run(
      teacherId, classIds.get("6-A")!, subject.id, topicId(6, "Chiziqli tenglamalar"),
      "Chiziqli tenglamalar — mustaqil ish", eqContent,
      "2 ta fayldagi barcha masalalarni ishlab chiqing va har bir yechim bosqichini yozing.",
      JSON.stringify(eqOriginal), new Date(Date.now() + 5 * 86400000).toISOString()
    ).lastInsertRowid as number;
    insertFile.run(a1, "topshiriq.pdf", 184320, "application/pdf", null, eqContent);
    insertFile.run(a1, "misollar.pdf", 96256, "application/pdf", null, "Qo'shimcha misollar: x + 7 = 12; 4x = 20; 5x - 3 = 2x + 9");
    insertFile.run(a1, "worksheet.pdf", 71680, "application/pdf", null, "Ish varag'i: bo'sh yechish maydonlari bilan 5 ta masala");

    const frContent =
      "Kasrlar bilan ishlash:\n1. 2/5 va 3/10 kasrlarini taqqoslang.\n2. 1/4 + 2/4 = ?\n3. 3/8 + 1/4 = ? (umumiy maxraj toping)\n4. 7/12 - 1/3 = ?\n5. So'zli masala: Pitsaning 3/8 qismi Yes-Di, 1/4 qismi esa Ali tomonidan yeyildi. Qolgan qismi qancha?";
    const a2 = insertAssignment.run(
      teacherId, classIds.get("6-A")!, subject.id, topicId(6, "Kasrlar"),
      "Kasrlar — uy ishi", frContent,
      "Barcha masalalarni ishlab chiqing, umumiy maxrajni ko'rsating.",
      JSON.stringify({
        title: "Kasrlar",
        requirements: ["Umumiy maxrajni ko'rsating", "Javobni soddalashtiring"],
        questions: [
          { text: "2/5 va 3/10 ni taqqoslang", answer: "2/5 = 4/10 > 3/10", answerType: "short" },
          { text: "1/4 + 2/4 = ?", answer: "3/4", answerType: "short" },
          { text: "3/8 + 1/4 = ?", answer: "5/8", answerType: "short" },
          { text: "7/12 - 1/3 = ?", answer: "1/4", answerType: "short" },
        ],
        constraints: "Javoblar soddalashtirilgan ko'rinishda bo'lishi kerak.",
        rawText: frContent,
      }),
      new Date(Date.now() + 7 * 86400000).toISOString()
    ).lastInsertRowid as number;
    insertFile.run(a2, "kasrlar-mashqlari.pdf", 112640, "application/pdf", null, frContent);

    const pctContent =
      "Foizlar mavzusi:\n1. 60 ning 25% ini toping.\n2. 80 sonining 15% i nechaga teng?\n3. Bir futbolka 120 000 so'm, chegirma 20%. Yangi narx necha so'm?\n4. 45 soni 180 sonining necha foizi?\n5. Sinfdagi 28 o'quvchining 50% i qizlar. Qizlar sonini toping.";
    const a3 = insertAssignment.run(
      teacherId, classIds.get("6-A")!, subject.id, topicId(6, "Foizlar"),
      "Foizlar — amaliy topshiriq", pctContent,
      "Har bir masalani to'liq yechim bilan yozing.",
      JSON.stringify({
        title: "Foizlar",
        requirements: ["Yechim bosqichlarini yozing"],
        questions: [
          { text: "60 ning 25% i", answer: "15", answerType: "numeric" },
          { text: "80 ning 15% i", answer: "12", answerType: "numeric" },
          { text: "120 000 - 20% chegirma", answer: "96 000", answerType: "numeric" },
        ],
        constraints: "",
        rawText: pctContent,
      }),
      new Date(Date.now() + 3 * 86400000).toISOString()
    ).lastInsertRowid as number;
    insertFile.run(a3, "foizlar.pdf", 88576, "application/pdf", null, pctContent);

    const algContent =
      "Algebraik ifodalarni soddalashtiring:\n1. 3a + 5a = ?\n2. 7x - 2x + 4 = ?\n3. 2(x + 3) qavslarni oching.\n4. 5y - 2y + 3y = ?";
    const a4 = insertAssignment.run(
      teacherId, classIds.get("6-B")!, subject.id, topicId(6, "Algebraik ifodalar"),
      "Algebraik ifodalar — sinf ishi", algContent,
      "Barcha ifodalarni soddalashtirib, qavslarni ochish tartibini ko'rsating.",
      JSON.stringify({
        title: "Algebraik ifodalar",
        requirements: ["Qavslarni ochish tartibini ko'rsating"],
        questions: [
          { text: "3a + 5a", answer: "8a", answerType: "short" },
          { text: "7x - 2x + 4", answer: "5x + 4", answerType: "short" },
        ],
        constraints: "",
        rawText: algContent,
      }),
      new Date(Date.now() + 6 * 86400000).toISOString()
    ).lastInsertRowid as number;
    insertFile.run(a4, "algebra.pdf", 102400, "application/pdf", null, algContent);

    const linContent =
      "Chiziqli tenglamalar (7-sinf):\n1. 4x + 3 = 19\n2. 5x - 8 = 2x + 7\n3. 3(x - 2) = 12\n4. (x + 4)/2 = 6";
    const a5 = insertAssignment.run(
      teacherId, classIds.get("7-A")!, subject.id, topicId(7, "Chiziqli tenglamalar"),
      "Chiziqli tenglamalar — takrorlash", linContent,
      "Har bir tenglamani yeching va tekshirish qadamini yozing.",
      JSON.stringify({
        title: "Chiziqli tenglamalar",
        requirements: ["Tekshirish qadamini yozing"],
        questions: [
          { text: "4x + 3 = 10", answer: "x = 1.75", answerType: "numeric" },
          { text: "5x - 8 = 2x + 7", answer: "x = 5", answerType: "numeric" },
        ],
        constraints: "",
        rawText: linContent,
      }),
      new Date(Date.now() + 4 * 86400000).toISOString()
    ).lastInsertRowid as number;
    insertFile.run(a5, "chiziqli-tenglamalar.pdf", 131072, "application/pdf", null, linContent);

    const ratContent =
      "Nisbat va proporsiya:\n1. 12 va 18 sonlarining nisbatini soddalashtiring.\n2. 3:4 nisbatda 35 ta konfet qanday bo'linadi?\n3. 5 kg olma 40 000 so'm bo'lsa, 8 kg necha so'm? (proportsiya tuzing)\n4. Xaritada 1:1000 masshtab — 4 sm chiziq realda necha metr?";
    const a6 = insertAssignment.run(
      teacherId, classIds.get("6-A")!, subject.id, topicId(6, "Nisbat va proporsiya"),
      "Nisbat va proporsiya — amaliy mashq", ratContent,
      "Har bir masalada nisbat yoki proporsiyani yozib ko'rsating.",
      JSON.stringify({
        title: "Nisbat va proporsiya",
        requirements: ["Nisbatni soddalashtiring", "Proporsiya tuzib yeching"],
        questions: [
          { text: "12:18 ni soddalashtiring", answer: "2:3", answerType: "short" },
          { text: "3:4 nisbatda 35 ta konfet", answer: "15 va 20", answerType: "short" },
          { text: "5 kg — 40 000 so'm, 8 kg — ?", answer: "64 000 so'm", answerType: "numeric" },
        ],
        constraints: "",
        rawText: ratContent,
      }),
      new Date(Date.now() + 8 * 86400000).toISOString()
    ).lastInsertRowid as number;
    insertFile.run(a6, "nisbat-proporsiya.pdf", 98304, "application/pdf", null, ratContent);

    const pct6bContent =
      "Foizlar (6-B sinf ishi):\n1. 200 ning 30% i nechaga teng?\n2. Kitob 90 000 so'm, chegirma 10%. Yangi narx?\n3. 36 soni 144 sonining necha foizi?\n4. Sinfdagi 24 o'quvchining 25% i shaxmat to'garagiga boradi. Nechta o'quvchi?";
    const a7 = insertAssignment.run(
      teacherId, classIds.get("6-B")!, subject.id, topicId(6, "Foizlar"),
      "Foizlar — 6-B sinf ishi", pct6bContent,
      "Barcha masalalarni yechim bilan bajaring.",
      JSON.stringify({
        title: "Foizlar — 6-B",
        requirements: ["Yechim bosqichlarini yozing"],
        questions: [
          { text: "200 ning 30% i", answer: "60", answerType: "numeric" },
          { text: "90 000 - 10% chegirma", answer: "81 000", answerType: "numeric" },
          { text: "36 soni 144 ning necha foizi", answer: "25%", answerType: "short" },
        ],
        constraints: "",
        rawText: pct6bContent,
      }),
      new Date(Date.now() + 5 * 86400000).toISOString()
    ).lastInsertRowid as number;
    insertFile.run(a7, "foizlar-6b.pdf", 90112, "application/pdf", null, pct6bContent);

    const lin7bContent =
      "Chiziqli tenglamalar (7-B sinf):\n1. 6x + 2 = 26\n2. 3x - 7 = 2x + 5\n3. 2(x + 5) = 22\n4. x/3 + 4 = 10";
    const a8 = insertAssignment.run(
      teacherId, classIds.get("7-B")!, subject.id, topicId(7, "Chiziqli tenglamalar"),
      "Chiziqli tenglamalar — 7-B mustaqil ish", lin7bContent,
      "Har bir tenglamani bosqichma-bosqich yeching.",
      JSON.stringify({
        title: "Chiziqli tenglamalar — 7-B",
        requirements: ["Har bir yechim bosqichini yozing"],
        questions: [
          { text: "6x + 2 = 26", answer: "x = 4", answerType: "numeric" },
          { text: "3x - 7 = 2x + 5", answer: "x = 12", answerType: "numeric" },
          { text: "2(x + 5) = 22", answer: "x = 6", answerType: "numeric" },
        ],
        constraints: "",
        rawText: lin7bContent,
      }),
      new Date(Date.now() + 6 * 86400000).toISOString()
    ).lastInsertRowid as number;
    insertFile.run(a8, "chiziqli-7b.pdf", 86016, "application/pdf", null, lin7bContent);

    /* ---- class → assignment registry (chronological order drives mastery progression) ---- */
    const byClass = new Map<string, { id: number; title: string; topic: string }[]>();
    const pushAsg = (cls: string, id: number, title: string, topic: string) => {
      const list = byClass.get(cls) ?? [];
      list.push({ id, title, topic });
      byClass.set(cls, list);
    };
    pushAsg("6-A", a1, "Chiziqli tenglamalar — mustaqil ish", "Chiziqli tenglamalar");
    pushAsg("6-A", a2, "Kasrlar — uy ishi", "Kasrlar");
    pushAsg("6-A", a3, "Foizlar — amaliy topshiriq", "Foizlar");
    pushAsg("6-A", a6, "Nisbat va proporsiya — amaliy mashq", "Nisbat va proporsiya");
    pushAsg("6-B", a4, "Algebraik ifodalar — sinf ishi", "Algebraik ifodalar");
    pushAsg("6-B", a7, "Foizlar — 6-B sinf ishi", "Foizlar");
    pushAsg("7-A", a5, "Chiziqli tenglamalar — takrorlash", "Chiziqli tenglamalar");
    pushAsg("7-B", a8, "Chiziqli tenglamalar — 7-B mustaqil ish", "Chiziqli tenglamalar");

    /* ---- grade-appropriate assignments for every remaining class ----
       Each class's math teacher (per teacherFor) authors them; the original
       JSON stays the immutable source of truth, exactly like a1-a8. */
    const TOPIC_BANK: Record<string, { content: string; questions: { text: string; answer: string; answerType: string }[]; requirements: string[] }> = {
      "Qo'shish va ayirish": {
        content: "Oddiy arifmetik amallar:\n1. 24 + 18 = ?\n2. 52 - 27 = ?\n3. 36 + 47 - 19 = ?\n4. So'zli masala: Do'konda 45 kg shakar bor edi, 18 kg sotildi. Qancha qoldi?",
        questions: [
          { text: "24 + 18", answer: "42", answerType: "numeric" },
          { text: "52 - 27", answer: "25", answerType: "numeric" },
          { text: "36 + 47 - 19", answer: "64", answerType: "numeric" },
          { text: "45 kg dan 18 kg sotildi", answer: "27 kg", answerType: "numeric" },
        ],
        requirements: ["Amallar tartibini yozing", "So'zli masalani yechib ko'rsating"],
      },
      "Ko'paytirish va bo'lish": {
        content: "Ko'paytirish va bo'lish:\n1. 7 × 8 = ?\n2. 12 × 6 = ?\n3. 84 : 7 = ?\n4. 96 : 12 = ?\n5. So'zli masala: 1 karobkada 9 ta qalam bor, 6 karobkada nechta qalam bor?",
        questions: [
          { text: "7 × 8", answer: "56", answerType: "numeric" },
          { text: "12 × 6", answer: "72", answerType: "numeric" },
          { text: "84 : 7", answer: "12", answerType: "numeric" },
          { text: "6 karobkada qalam soni", answer: "54", answerType: "numeric" },
        ],
        requirements: ["Amallarni ustun ko'rinishida bajaring"],
      },
      "Kasrlar": {
        content: "Kasrlar bilan ishlash:\n1. 2/5 va 3/10 kasrlarini taqqoslang.\n2. 1/4 + 2/4 = ?\n3. 3/8 + 1/4 = ? (umumiy maxraj toping)\n4. 7/12 - 1/3 = ?",
        questions: [
          { text: "2/5 va 3/10 ni taqqoslang", answer: "2/5 > 3/10", answerType: "short" },
          { text: "1/4 + 2/4", answer: "3/4", answerType: "short" },
          { text: "3/8 + 1/4", answer: "5/8", answerType: "short" },
          { text: "7/12 - 1/3", answer: "1/4", answerType: "short" },
        ],
        requirements: ["Umumiy maxrajni ko'rsating", "Javobni soddalashtiring"],
      },
      "Chiziqli tenglamalar": {
        content: "Chiziqli tenglamalarni yeching:\n1. x + 7 = 12\n2. 3x = 21\n3. 2x - 5 = 9\n4. 4x + 3 = 2x + 11",
        questions: [
          { text: "x + 7 = 12", answer: "x = 5", answerType: "numeric" },
          { text: "3x = 21", answer: "x = 7", answerType: "numeric" },
          { text: "2x - 5 = 9", answer: "x = 7", answerType: "numeric" },
          { text: "4x + 3 = 2x + 11", answer: "x = 4", answerType: "numeric" },
        ],
        requirements: ["Har bir tenglamani bosqichma-bosqich yeching", "Javobni tekshiring"],
      },
      "Foizlar": {
        content: "Foizlar mavzusi:\n1. 80 ning 25% ini toping.\n2. 200 sonining 10% i nechaga teng?\n3. Bir sumka 150 000 so'm, chegirma 20%. Yangi narx necha so'm?\n4. 30 soni 120 sonining necha foizi?",
        questions: [
          { text: "80 ning 25% i", answer: "20", answerType: "numeric" },
          { text: "200 ning 10% i", answer: "20", answerType: "numeric" },
          { text: "150 000 - 20% chegirma", answer: "120 000", answerType: "numeric" },
          { text: "30 soni 120 ning necha foizi", answer: "25%", answerType: "short" },
        ],
        requirements: ["Yechim bosqichlarini yozing"],
      },
      "Algebraik ifodalar": {
        content: "Algebraik ifodalarni soddalashtiring:\n1. 4a + 3a = ?\n2. 9x - 4x + 2 = ?\n3. 3(y + 2) qavslarni oching.\n4. 7m - 3m + m = ?",
        questions: [
          { text: "4a + 3a", answer: "7a", answerType: "short" },
          { text: "9x - 4x + 2", answer: "5x + 2", answerType: "short" },
          { text: "3(y + 2)", answer: "3y + 6", answerType: "short" },
          { text: "7m - 3m + m", answer: "5m", answerType: "short" },
        ],
        requirements: ["O'xshash hadlarni birlashtiring", "Qavslarni ochish tartibini ko'rsating"],
      },
      "Nisbat va proporsiya": {
        content: "Nisbat va proporsiya:\n1. 15 va 20 sonlarining nisbatini soddalashtiring.\n2. 2:3 nisbatda 40 ta daftar qanday bo'linadi?\n3. 4 kg guruch 28 000 so'm bo'lsa, 7 kg necha so'm? (proporsiya tuzing)\n4. Xaritada 1:500 masshtab — 6 sm chiziq realda necha metr?",
        questions: [
          { text: "15:20 ni soddalashtiring", answer: "3:4", answerType: "short" },
          { text: "2:3 nisbatda 40 ta daftar", answer: "16 va 24", answerType: "short" },
          { text: "4 kg — 28 000 so'm, 7 kg — ?", answer: "49 000 so'm", answerType: "numeric" },
        ],
        requirements: ["Nisbatni soddalashtiring", "Proporsiya tuzib yeching"],
      },
      "Tenglamalar sistemasi": {
        content: "Tenglamalar sistemasi (8-sinf):\n1. x + y = 10, x - y = 2 sistemasini yeching.\n2. 2x + y = 11, y = 3 bo'lsa, x = ?\n3. 3x + 2y = 16, x = 2 bo'lsa, y = ?",
        questions: [
          { text: "x + y = 10, x - y = 2", answer: "x = 6, y = 4", answerType: "short" },
          { text: "2x + y = 11, y = 3", answer: "x = 4", answerType: "numeric" },
          { text: "3x + 2y = 16, x = 2", answer: "y = 5", answerType: "numeric" },
        ],
        requirements: ["Qo'shish yoki almashtirish usulini ko'rsating", "Javobni sistemaga qo'yib tekshiring"],
      },
      "Funksiyalar": {
        content: "Funksiyalar (8-sinf):\n1. y = 2x + 3 funksiyada x = 4 bo'lsa, y = ?\n2. y = x - 5 grafigi Oy o'qini qayerda kesadi?\n3. y = 3x - 1 funksiyada y = 8 bo'lsa, x = ?\n4. y = -x + 7 funksiya o'suvchimi yoki kamayuvchi?",
        questions: [
          { text: "y = 2x + 3, x = 4", answer: "y = 11", answerType: "numeric" },
          { text: "y = x - 5 Oy o'qini qayerda kesadi", answer: "(0; -5)", answerType: "short" },
          { text: "y = 3x - 1, y = 8", answer: "x = 3", answerType: "numeric" },
        ],
        requirements: ["Hisoblash jadvalini tuzing", "Grafik mantiqini tushuntiring"],
      },
      "O'lchov birliklari": {
        content: "O'lchov birliklari:\n1. 3 m necha sm?\n2. 2 kg 500 g necha gram?\n3. 1 soat 40 minut necha minut?\n4. 5 km 300 m necha metr?",
        questions: [
          { text: "3 m = ? sm", answer: "300 sm", answerType: "numeric" },
          { text: "2 kg 500 g = ? g", answer: "2500 g", answerType: "numeric" },
          { text: "1 soat 40 minut = ? minut", answer: "100 minut", answerType: "numeric" },
        ],
        requirements: ["Birliklarni to'g'ri yozing"],
      },
    };
    const NEW_ASSIGNMENTS: { cls: string; topic: string; title: string; suffix: string; days: number }[] = [
      { cls: "4-A", topic: "Qo'shish va ayirish", title: "Qo'shish va ayirish — sinf ishi", suffix: "sinf ishi", days: 4 },
      { cls: "4-A", topic: "Kasrlar", title: "Kasrga kirish — uy ishi", suffix: "uy ishi", days: 6 },
      { cls: "4-A", topic: "Ko'paytirish va bo'lish", title: "Ko'paytirish va bo'lish — mustaqil ish", suffix: "mustaqil ish", days: 5 },
      { cls: "4-B", topic: "Qo'shish va ayirish", title: "Qo'shish va ayirish — uy ishi", suffix: "uy ishi", days: 3 },
      { cls: "4-B", topic: "Kasrlar", title: "Kasrga kirish — sinf ishi", suffix: "sinf ishi", days: 6 },
      { cls: "4-B", topic: "Ko'paytirish va bo'lish", title: "Ko'paytirish va bo'lish — amaliy mashq", suffix: "amaliy mashq", days: 4 },
      { cls: "4-D", topic: "Qo'shish va ayirish", title: "Qo'shish va ayirish — mustaqil ish", suffix: "mustaqil ish", days: 5 },
      { cls: "4-D", topic: "Kasrlar", title: "Kasrga kirish — amaliy mashq", suffix: "amaliy mashq", days: 7 },
      { cls: "4-D", topic: "O'lchov birliklari", title: "O'lchov birliklari — sinf ishi", suffix: "sinf ishi", days: 4 },
      { cls: "5-A", topic: "Kasrlar", title: "Kasrlar — uy ishi", suffix: "uy ishi", days: 5 },
      { cls: "5-A", topic: "Foizlar", title: "Foizga kirish — sinf ishi", suffix: "sinf ishi", days: 3 },
      { cls: "5-A", topic: "Algebraik ifodalar", title: "Algebraik ifodalar — mustaqil ish", suffix: "mustaqil ish", days: 6 },
      { cls: "5-B", topic: "Kasrlar", title: "Kasrlar — sinf ishi", suffix: "sinf ishi", days: 4 },
      { cls: "5-B", topic: "Foizlar", title: "Foizga kirish — uy ishi", suffix: "uy ishi", days: 6 },
      { cls: "5-B", topic: "Algebraik ifodalar", title: "Algebraik ifodalar — amaliy mashq", suffix: "amaliy mashq", days: 3 },
      { cls: "5-D", topic: "Kasrlar", title: "Kasrlar — amaliy mashq", suffix: "amaliy mashq", days: 5 },
      { cls: "5-D", topic: "Foizlar", title: "Foizga kirish — mustaqil ish", suffix: "mustaqil ish", days: 4 },
      { cls: "5-D", topic: "Algebraik ifodalar", title: "Algebraik ifodalar — uy ishi", suffix: "uy ishi", days: 7 },
      { cls: "6-D", topic: "Chiziqli tenglamalar", title: "Chiziqli tenglamalar — uy ishi", suffix: "uy ishi", days: 4 },
      { cls: "6-D", topic: "Kasrlar", title: "Kasrlar — sinf ishi", suffix: "sinf ishi", days: 6 },
      { cls: "6-D", topic: "Nisbat va proporsiya", title: "Nisbat va proporsiya — amaliy mashq", suffix: "amaliy mashq", days: 3 },
      { cls: "7-D", topic: "Algebraik ifodalar", title: "Algebraik ifodalar — sinf ishi", suffix: "sinf ishi", days: 5 },
      { cls: "7-D", topic: "Nisbat va proporsiya", title: "Nisbat va proporsiya — mustaqil ish", suffix: "mustaqil ish", days: 4 },
      { cls: "8-A", topic: "Tenglamalar sistemasi", title: "Tenglamalar sistemasi — sinf ishi", suffix: "sinf ishi", days: 5 },
      { cls: "8-A", topic: "Funksiyalar", title: "Funksiyalar — uy ishi", suffix: "uy ishi", days: 6 },
      { cls: "8-B", topic: "Funksiyalar", title: "Funksiyalar — mustaqil ish", suffix: "mustaqil ish", days: 4 },
      { cls: "8-B", topic: "Algebraik ifodalar", title: "Algebraik ifodalar — sinf ishi", suffix: "sinf ishi", days: 5 },
      { cls: "8-D", topic: "Tenglamalar sistemasi", title: "Tenglamalar sistemasi — amaliy mashq", suffix: "amaliy mashq", days: 3 },
      { cls: "8-D", topic: "Algebraik ifodalar", title: "Algebraik ifodalar — uy ishi", suffix: "uy ishi", days: 6 },
      { cls: "6-B", topic: "Nisbat va proporsiya", title: "Nisbat va proporsiya — 6-B uy ishi", suffix: "uy ishi", days: 4 },
      { cls: "7-A", topic: "Algebraik ifodalar", title: "Algebraik ifodalar — 7-A sinf ishi", suffix: "sinf ishi", days: 5 },
      { cls: "7-B", topic: "Nisbat va proporsiya", title: "Nisbat va proporsiya — 7-B uy ishi", suffix: "uy ishi", days: 6 },
      { cls: "8-A", topic: "Algebraik ifodalar", title: "Algebraik ifodalar — 8-A mustaqil ish", suffix: "mustaqil ish", days: 4 },
    ];
    for (const na of NEW_ASSIGNMENTS) {
      const grade = parseInt(na.cls, 10);
      const bank = TOPIC_BANK[na.topic];
      const content = `«${na.topic}» mavzusi (${na.cls} ${na.suffix}):\n${bank.content}`;
      const original = {
        title: `${na.topic} — ${na.cls}`,
        requirements: bank.requirements,
        questions: bank.questions,
        constraints: "Barcha masalalar bajarilishi shart. Yechim bosqichlari yozilishi shart.",
        rawText: content,
      };
      const aid = insertAssignment.run(
        teacherFor.get(`${ci0(na.cls)}:Matematika`)!, classIds.get(na.cls)!, subject.id, topicId(grade, na.topic),
        na.title, content,
        "Barcha masalalarni bosqichma-bosqich yechib chiqing.",
        JSON.stringify(original),
        new Date(Date.now() + na.days * 86400000).toISOString()
      ).lastInsertRowid as number;
      insertFile.run(aid, `${na.topic.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.pdf`, 102400, "application/pdf", null, content);
      pushAsg(na.cls, aid, na.title, na.topic);
    }
    for (const clsName of CLASS_NAMES) {
      if (!byClass.has(clsName)) throw new Error(`Seed xatosi: ${clsName} uchun topshiriq yo'q`);
    }

    /* ---- completed sessions + reports with different performance levels ---- */
    // [studentEmail, assignmentId, mastery, hints, attempts profile, strengths, weaknesses, feedback, insight]
    const emails = students.map((s) => s.email);
    const findStudent = (email: string) =>
      (db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number }).id;

    const persona = (
      studentEmail: string,
      assignmentId: number,
      assignmentTitle: string,
      topic: string,
      mastery: number,
      opts: { hints: number; practice: number; attempts: number; feedback: string; insight: string; strengths: string[]; weaknesses: string[]; daysAgo?: number; mood?: string; workMode?: string; notify?: boolean }
    ) => {
      const sid = findStudent(studentEmail);
      const solvedCount = Math.round((mastery / 100) * 5);
      const hintCount = Math.round((opts.hints / 5) * 5);
      const results = Array.from({ length: 5 }, (_, i) => ({
        attempts: i === 0 ? opts.attempts : 1,
        solved: i < solvedCount,
        done: true,
        stage: 0,
        ladder: [],
        hintsUsed: i < hintCount ? 2 : 0,
        practiceDone: i < opts.practice ? 2 : 0,
        practiceSolved: i < opts.practice ? 2 : 0,
        routes: [],
        revealed: false,
      }));
      const sessionId = db
        .prepare(
          `INSERT INTO sessions (assignment_id, student_id, status, questions, results, mastery, mood, work_mode, started_at, finished_at)
           VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))`
        )
        .run(
          assignmentId, sid, JSON.stringify([makeExperience(assignmentTitle, topic)]),
          JSON.stringify(results), mastery, opts.mood ?? "ok", opts.workMode ?? "quiz",
          `-${opts.daysAgo ?? 3} days`, `-${opts.daysAgo ?? 3} days`
        ).lastInsertRowid as number;
      insertReport.run(
        sessionId, sid, assignmentId, assignmentTitle, mastery,
        JSON.stringify(opts.strengths), JSON.stringify(opts.weaknesses),
        opts.feedback, opts.insight,
        JSON.stringify([{ topic, mastery }]),
        new Date(Date.now() - (opts.daysAgo ?? 3) * 86400000).toISOString()
      );
      if (opts.notify !== false) insertNotificationForTeacher(teacherId, sid, assignmentTitle, mastery);
    };

    // Dilnoza — kuchli (92%)
    persona(emails[1], a1, "Chiziqli tenglamalar — mustaqil ish", "Chiziqli tenglamalar", 92, {
      hints: 1, practice: 0, attempts: 1,
      strengths: ["Bir bosqichli tenglamalar", "Tekshirish qadami"],
      weaknesses: [],
      feedback: "Dilnoza barcha masalalarni birinchi urinishda to'g'ri yechdi va yechim bosqichlarini aniq yozdi.",
      insight: "Dilnoza topshiriqni yuqori darajada o'zlashtirdi — qo'shimcha yordam talab qilinmadi.",
    });
    // Jasur — o'rtacha-yuqori (81%)
    persona(emails[2], a1, "Chiziqli tenglamalar — mustaqil ish", "Chiziqli tenglamalar", 81, {
      hints: 2, practice: 1, attempts: 2,
      strengths: ["Bir bosqichli tenglamalar", "So'zli masalalar"],
      weaknesses: ["Ko'p bosqichli tenglamalar"],
      feedback: "Jasur asosiy masalalarni yaxshi yechdi, faqat ko'p bosqichli tenglamada bir marta hint ishlatdi.",
      insight: "Jasur ko'p bosqichli tenglamada yo'naltiruvchi savoldan keyin to'g'ri javobga keldi.",
    });
    // Madina — o'rtacha (70%)
    persona(emails[3], a2, "Kasrlar — uy ishi", "Kasrlar", 70, {
      hints: 3, practice: 2, attempts: 2,
      strengths: ["Bir xil maxrajli kasrlar"],
      weaknesses: ["Turli maxrajli kasrlar", "Umumiy maxraj topish"],
      feedback: "Madina bir xil maxrajli kasrlarni yaxshi bajardi. Turli maxrajli kasrlarda umumiy maxraj topish bosqichida 2 marta yordam kerak bo'ldi. Qo'shimcha mashqlarda bu qadamni yaxshiroq bajardi.",
      insight: "Madina kasrlar mavzusida umumiy maxraj bosqichida qiynaldi, qo'shimcha mashqlardan keyin yaxshilandi.",
    });
    // Bekzod — qiynalayotgan (52%)
    persona(emails[4], a2, "Kasrlar — uy ishi", "Kasrlar", 52, {
      hints: 5, practice: 3, attempts: 3,
      strengths: ["Kasrlarni taqqoslash"],
      weaknesses: ["Umumiy maxraj topish", "Kasrlarni ayirish"],
      feedback: "Bekzod kasrlarni taqqoslashni bajardi, lekin turli maxrajli kasrlarda yig'indini hisoblashda ko'p yordam kerak bo'ldi. Qo'shimcha mashqlar berildi.",
      insight: "Bekzod kasrlar mavzusida 5 marta hint ishlatdi, 3 ta qo'shimcha mashq bajardi — qayta takrorlash tavsiya etiladi.",
    });
    // Gulnora — ko'p hint ishlatadigan (64%)
    persona(emails[5], a1, "Chiziqli tenglamalar — mustaqil ish", "Chiziqli tenglamalar", 64, {
      hints: 6, practice: 2, attempts: 2,
      strengths: ["Tenglamani soddalashtirish"],
      weaknesses: ["Noma'lumni ajratish", "So'zli masalalar"],
      feedback: "Gulnora soddalashtirishni yaxshi biladi, lekin noma'lumni ajratish bosqichida har masalada hint ishlatdi. So'zli masalada tenglama tuzish qiyin bo'ldi.",
      insight: "Gulnora har bir masalada yordam so'radi — noma'lumni ajratish bosqichi mustahkamlanishi kerak.",
    });
    // Sardor — yaxshilangan: birinchi natija past, ikkinchisi yuqori
    persona(emails[6], a2, "Kasrlar — uy ishi", "Kasrlar", 58, {
      hints: 4, practice: 2, attempts: 2,
      strengths: ["Kasr tushunchasi"],
      weaknesses: ["Umumiy maxraj", "Ayirish amali"],
      feedback: "Birinchi urinishda umumiy maxraj topishda qiynalddi, lekin qo'shimcha mashqlardan keyin yaxshilandi.",
      insight: "Sardor birinchi topshiriqda 58% ko'rsatdi — remediationdan keyin progress kutilmoqda.",
    });
    persona(emails[6], a3, "Foizlar — amaliy topshiriq", "Foizlar", 83, {
      hints: 1, practice: 1, attempts: 1,
      strengths: ["Foizni son topish", "Chegirma masalalari"],
      weaknesses: [],
      feedback: "Sardor foizlar mavzusida sezilarli yaxshilanish ko'rsatdi — oldingi natijasidan 25% yuqori.",
      insight: "Sardor remediationdan keyin sezilarli yaxshilandi (58% → 83%) — moslashuvchan yordam samarali bo'ldi.",
    });
    // 6-B va 7-A uchun bitta natija har biriga
    persona(emails[7], a4, "Algebraik ifodalar — sinf ishi", "Algebraik ifodalar", 76, {
      hints: 2, practice: 1, attempts: 1,
      strengths: ["O'xshash hadlarni qo'shish"],
      weaknesses: ["Qavslarni ochish"],
      feedback: "Kamola o'xshash hadlarni yaxshi qo'shdi, qavslarni ochishda bir marta yordam kerak bo'ldi.",
      insight: "Kamola qavslarni ochish bosqichida yo'naltiruvchi savol bilan tuzatdi.",
    });
    persona(emails[8], a4, "Algebraik ifodalar — sinf ishi", "Algebraik ifodalar", 45, {
      hints: 4, practice: 2, attempts: 3,
      strengths: [],
      weaknesses: ["O'xshash hadlar", "Qavslarni ochish"],
      feedback: "Aziz algebraik ifodalarni soddalashtirishda jiddiy qiynaldi, ko'p qo'shimcha mashq bajarildi.",
      insight: "Aziz algebraik ifodalar mavzusida qo'shimcha dars kerak — 45% natija.",
    });
    persona(emails[9], a5, "Chiziqli tenglamalar — takrorlash", "Chiziqli tenglamalar", 88, {
      hints: 1, practice: 0, attempts: 1,
      strengths: ["Ko'p bosqichli tenglamalar", "Tekshirish"],
      weaknesses: [],
      feedback: "Zarina chiziqli tenglamalarni mustahkam o'zlashtirgan, deyarli barchasi birinchi urinishda.",
      insight: "Zarina mavzuni yuqori darajada o'zlashtirdi.",
    });

    // Ali — bitta bajarmagan (a1, session yo'q), bitta davom ettirilayotgan (a2), ikkita bajarilgan
    persona(emails[0], a3, "Foizlar — amaliy topshiriq", "Foizlar", 78, {
      hints: 2, practice: 1, attempts: 2, daysAgo: 5,
      strengths: ["Foizni son topish", "Chegirma masalalari"],
      weaknesses: ["Foizni topish masalalari"],
      feedback: "Ali foizlar mavzusini yaxshi bajarib, o'zlashtirishni mustahkamladi.",
      insight: "Ali foizlarni o'rtacha darajada o'zlashtirdi — futbol kontekstli masalalarda faolroq bo'ldi.",
    });
    persona(emails[0], a6, "Nisbat va proporsiya — amaliy mashq", "Nisbat va proporsiya", 84, {
      hints: 1, practice: 1, attempts: 1, daysAgo: 1,
      strengths: ["Nisbatni soddalashtirish", "Proporsiya tuzish"],
      weaknesses: [],
      feedback: "Ali nisbat va proporsiyada oldingi natijasidan yuqori ko'rsatdi — 84%!",
      insight: "Ali foizlardan (78%) nisbat va proporsiyaga o'tib yaxshilandi (84%) — progress ijobiy.",
    });

    /* ---- deterministic generator: coherent sessions/reports for every student ----
       Mastery is derived from the student's tier (strong/middle/help), a class effect,
       a per-(class, topic) offset and a trend across the class's assignments — never
       random. Session results (solved/hints/practice/attempts) are derived from the
       same mastery, so analytics always match the underlying answer data. */
    const insertActive = db.prepare(
      `INSERT INTO sessions (assignment_id, student_id, status, questions, results, mastery, today_interest, mood, work_mode, started_at)
       VALUES (?, ?, 'active', ?, ?, 0, ?, ?, ?, datetime('now', '-1 day'))`
    );
    const activeResults = (exp: ReturnType<typeof makeExperience>) =>
      JSON.stringify(exp.activities.map(() => ({ attempts: 0, solved: false, done: false, stage: 0, ladder: [], hintsUsed: 0, practiceDone: 0, practiceSolved: 0, routes: [], revealed: false })));

    const hash = (n: number) => {
      let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
      x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
      return Math.abs(x ^ (x >>> 16));
    };
    // class effects make class averages differ naturally (computed from student data)
    const CLASS_EFFECT: Record<string, number> = {
      "4-A": 3, "4-B": -6, "4-D": 7, "5-A": -3, "5-B": -8, "5-D": 6,
      "6-A": 4, "6-B": -6, "6-D": -6, "7-A": 8, "7-B": 3, "7-D": -7,
      "8-A": 5, "8-B": -8, "8-D": 0,
    };
    const STYLE_WORKMODE: Record<string, string> = {
      Viktorina: "quiz", "Amaliy mashqlar": "test", "Hikoyali o'qish": "quiz",
      "Vizual diagrammalar": "puzzle", "Mustaqil izlanish": "puzzle",
    };
    const MOOD_POOL = ["great", "good", "ok", "ok", "tired", "struggling"];
    const MISTAKE_POOL = [
      "Arifmetik hisoblash xatolari", "Qavs va ishoralar xatosi",
      "Tushunchani to'liq anglamaganlik", "Bosqichlar tartibini adashtirish",
      "Ehtiyotsizlik xatolari",
    ];
    const curated = new Set([
      "student.6a@edumind.demo", "dilnoza.6a@edumind.demo", "jasur.6a@edumind.demo",
      "madina.6a@edumind.demo", "bekzod.6a@edumind.demo", "gulnora.6a@edumind.demo",
      "sardor.6a@edumind.demo", "kamola.6b@edumind.demo", "aziz.6b@edumind.demo",
      "zarina.7a@edumind.demo",
    ]);
    let genSessions = 0;
    for (const clsName of CLASS_NAMES) {
      const asgs = byClass.get(clsName)!;
      const classStudents = students.filter((s) => s.cls === clsName);
      const ci = ci0(clsName);
      classStudents.forEach((st, p) => {
        if (curated.has(st.email)) return;
        const r = p / classStudents.length;
        const tier = r < 0.18 ? "strong" : r < 0.74 ? "middle" : "help";
        const h = hash(p * 1013 + ci * 77 + 5);
        const base = tier === "strong" ? 84 + (h % 12) : tier === "middle" ? 60 + (h % 22) : 38 + (h % 20);
        const trend = tier === "strong" ? 2 + (h % 4) : tier === "middle" ? [3, -2, 1, -4][hash(h + 1) % 4]! : [6, -3, 0][hash(h + 1) % 3]!;
        let completedCount = tier === "strong"
          ? asgs.length - (hash(h + 2) % 2)
          : tier === "middle"
            ? Math.max(1, asgs.length - (hash(h + 2) % 3))
            : hash(h + 2) % 3;
        if (completedCount > asgs.length) completedCount = asgs.length;
        const workMode = STYLE_WORKMODE[st.style] ?? "quiz";
        const mood = MOOD_POOL[hash(h + 7) % MOOD_POOL.length]!;
        let prevMastery: number | null = null;
        for (let k = 0; k < asgs.length; k++) {
          const asg = asgs[k]!;
          if (k < completedCount) {
            const topicOff = ((ci * 31 + k * 17) % 15) - 7;
            const noise = (hash(h + 10 + k) % 7) - 3;
            const m = Math.min(98, Math.max(12, Math.round(base + CLASS_EFFECT[clsName]! + trend * k + topicOff + noise)));
            const daysAgo = Math.max(1, 22 - k * 4 - (hash(h + 20 + k) % 3));
            const first = st.name.split(" ")[0];
            const hintOpt = m >= 85 ? 0 : m >= 70 ? 2 : m >= 50 ? 4 : 6;
            const practiceOpt = m >= 80 ? 0 : m >= 60 ? 1 : m >= 45 ? 2 : 3;
            const attemptOpt = m >= 80 ? 1 : m >= 55 ? 2 : 3;
            let strengths: string[];
            let weaknesses: string[];
            if (tier === "strong") {
              strengths = [`«${asg.topic}» mavzusini chuqur tushunadi`, "Masalalarni mustaqil yechadi"];
              weaknesses = m >= 90 ? [] : ["Ehtiyotsizlik xatolari"];
            } else if (tier === "middle") {
              strengths = ["Asosiy qoidalarni biladi", "Bir bosqichli masalalarni yechadi"];
              weaknesses = [`Ko'p bosqichli «${asg.topic}» masalalari`, MISTAKE_POOL[hash(h + 50 + k) % MISTAKE_POOL.length]!];
            } else {
              strengths = [`«${asg.topic}» asosiy tushunchasi`, "Qo'shimcha mashqlarda faol"];
              weaknesses = [MISTAKE_POOL[hash(h + 50 + k) % MISTAKE_POOL.length]!, MISTAKE_POOL[hash(h + 60 + k) % MISTAKE_POOL.length]!];
            }
            const feedback = tier === "strong"
              ? `${first} «${asg.topic}» topshirig'ini ${m}% darajada bajardi — masalalarni asosan birinchi urinishda yechdi.`
              : tier === "middle"
                ? `${first} asosiy masalalarni bajardi, ayrim joylarda yo'naltiruvchi yordam kerak bo'ldi (${hintOpt} ta hint).`
                : `${first} mavzuda qiynalmoqda — ${practiceOpt * 2} ta qo'shimcha mashq bajarildi, mavzuni qayta takrorlash tavsiya etiladi.`;
            let insight: string;
            if (prevMastery === null) {
              insight = `${first} ${asg.topic} bo'yicha birinchi natijani ko'rsatdi (${m}%).`;
            } else if (m > prevMastery + 3) {
              insight = `${first} oldingi natijasidan yaxshilandi (${prevMastery}% → ${m}%) — ijobiy dinamika.`;
            } else if (m < prevMastery - 3) {
              insight = `${first} natijasi pasaydi (${prevMastery}% → ${m}%) — e'tibor talab qiladi.`;
            } else {
              insight = `${first} natijasi barqaror (${prevMastery}% → ${m}%).`;
            }
            genSessions++;
            persona(st.email, asg.id, asg.title, asg.topic, m, {
              hints: hintOpt, practice: practiceOpt, attempts: attemptOpt,
              feedback, insight, strengths, weaknesses, daysAgo,
              mood, workMode,
              // Nodira (6-7 sinflar) faqat ayrim sessiyalar uchun xabarnoma oladi — bell toshmasin
              notify: ci >= 6 && ci <= 11 && genSessions % 25 === 0,
            });
            prevMastery = m;
          } else if (k === completedCount && hash(h + 40 + k) % 10 < 4) {
            const exp = makeExperience(asg.title, asg.topic);
            insertActive.run(asg.id, findStudent(st.email), JSON.stringify([exp]), activeResults(exp), st.interests[0], mood, workMode);
          }
        }
      });
    }

    // Bir nechta bajarmagan topshiriq holati: Ali uchun a1 hali ochiq (session yo'q), a2 faol sessiya
    const alisExp = makeExperience("Kasrlar — uy ishi", "Kasrlar");
    insertActive.run(a2, findStudent(emails[0]), JSON.stringify([alisExp]), activeResults(alisExp), "Futbol", "great", "test");
    // Aziz (6-B) a7 da davom ettirilmoqda
    const azizExp = makeExperience("Foizlar — 6-B sinf ishi", "Foizlar");
    insertActive.run(a7, findStudent(emails[8]), JSON.stringify([azizExp]), activeResults(azizExp), "Futbol", "good", "test");

    // O'qituvchiga xabarnoma
    db.prepare("INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)").run(
      teacherId,
      "Sinflaringiz faolligi",
      "Sinflaringiz bo'yicha topshiriq sessiyalari yakunlandi. O'zlashtirish bo'limidan tahlilni ko'ring."
    );

    /* ---- seed integrity assertions ---- */
    const assert = (ok: boolean, msg: string) => {
      if (!ok) throw new Error(`Seed assertion failed: ${msg}`);
    };
    const countOf = (sql: string, ...params: (string | number)[]) =>
      (db.prepare(sql).get(...params) as { c: number }).c;
    assert(countOf("SELECT COUNT(*) AS c FROM classes") === 15, "15 ta sinf bo'lishi kerak");
    assert(countOf("SELECT COUNT(*) AS c FROM users WHERE role = 'teacher'") > 0, "o'qituvchilar bo'lishi kerak");
    for (const clsName of CLASS_NAMES) {
      const cid = classIds.get(clsName)!;
      const studentCount = countOf("SELECT COUNT(*) AS c FROM users WHERE role = 'student' AND class_id = ?", cid);
      assert(studentCount >= 25 && studentCount <= 40, `${clsName} da ${studentCount} o'quvchi — 25..40 oralig'ida bo'lishi kerak`);
      assert(
        countOf("SELECT COUNT(*) AS c FROM sessions s JOIN assignments a ON s.assignment_id = a.id WHERE a.class_id = ?", cid) > 0,
        `${clsName} da sessiyalar bo'lishi kerak`
      );
      assert(countOf("SELECT COUNT(*) AS c FROM assignments WHERE class_id = ?", cid) > 0, `${clsName} da topshiriqlar bo'lishi kerak`);
    }
  });

  seedAll();
}
