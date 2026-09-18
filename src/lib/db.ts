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
`);

const userCount = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
if (userCount === 0) {
  const insertUser = db.prepare(
    "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)"
  );
  const teacherId = insertUser.run(
    "teacher@demo.com",
    "teacher123",
    "Nodira",
    "teacher"
  ).lastInsertRowid as number;
  const studentId = insertUser.run(
    "student@demo.com",
    "student123",
    "Alex",
    "student"
  ).lastInsertRowid as number;

  const assignmentId = db
    .prepare("INSERT INTO assignments (teacher_id, title, content) VALUES (?, ?, ?)")
    .run(
      teacherId,
      "Chiziqli tenglamalar",
      "Chiziqli tenglamalar mavzusi: bir o'zgaruvchili chiziqli tenglamalarni yechish (masalan, x + 7 = 12, 2x = 14), tenglama yechishda qavslar ochish va hadlarni qarama-qarshi tomonga ko'chirish, bir necha bosqichli tenglamalar (masalan, 2x + 5 = 3x - 8), hamda chiziqli tenglamalar yordamida so'zli masalalarni yechish."
    ).lastInsertRowid as number;

  db.prepare(
    `INSERT INTO reports (student_id, assignment_id, assignment_title, mastery, strengths, weaknesses, feedback)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    studentId,
    assignmentId,
    "Chiziqli tenglamalar",
    84,
    JSON.stringify(["Bir bosqichli tenglamalar", "Asosiy algebra", "So'zli masalalar"]),
    JSON.stringify(["Ko'p bosqichli tenglamalar"]),
    "Alex topshiriqni yaxshi bajardi! Bir bosqichli tenglamalar va so'zli masalalarda natijasi juda mustahkam. Ko'p bosqichli tenglamalarda qisqa mashqlar bilan tez rivojlanadi — bir necha kundan keyin yana shu mavzuda mashq qilishni tavsiya qilamiz."
  );

  db.prepare("INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)").run(
    teacherId,
    "Yangi o'quv hisoboti mavjud",
    "Alex «Chiziqli tenglamalar» topshiriqni yakunladi. O'zlashtirish: 84%."
  );
}
