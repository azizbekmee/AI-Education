/* Seeds the demo database by importing db.ts (schema + seed run on import),
   then prints integrity stats and a per-class overview. */
import { db } from "../src/lib/db";

const count = (sql: string) => (db.prepare(sql).get() as { c: number }).c;

const counts = {
  teachers: count("SELECT COUNT(*) AS c FROM users WHERE role = 'teacher'"),
  students: count("SELECT COUNT(*) AS c FROM users WHERE role = 'student'"),
  classes: count("SELECT COUNT(*) AS c FROM classes"),
  subjects: count("SELECT COUNT(*) AS c FROM subjects"),
  topics: count("SELECT COUNT(*) AS c FROM topics"),
  timetable: count("SELECT COUNT(*) AS c FROM timetable"),
  assignments: count("SELECT COUNT(*) AS c FROM assignments"),
  assignment_files: count("SELECT COUNT(*) AS c FROM assignment_files"),
  sessions: count("SELECT COUNT(*) AS c FROM sessions"),
  reports: count("SELECT COUNT(*) AS c FROM reports"),
};
console.log(JSON.stringify(counts, null, 2));

const rows = db
  .prepare(
    `SELECT c.name,
       COUNT(DISTINCT u.id) AS students,
       ROUND(AVG(r.mastery)) AS avg_mastery,
       COUNT(DISTINCT a.id) AS assignments
     FROM classes c
     LEFT JOIN users u ON u.class_id = c.id AND u.role = 'student'
     LEFT JOIN assignments a ON a.class_id = c.id
     LEFT JOIN sessions s ON s.assignment_id = a.id AND s.student_id = u.id AND s.status = 'completed'
     LEFT JOIN reports r ON r.session_id = s.id
     GROUP BY c.id ORDER BY c.name`
  )
  .all() as { name: string; students: number; avg_mastery: number | null; assignments: number }[];

console.log("\nSinf     | O'quvchi | O'rt. o'zlashtirish | Topshiriqlar");
console.log("---------|----------|---------------------|-------------");
for (const r of rows) {
  console.log(
    `${r.name.padEnd(8)} | ${String(r.students).padEnd(8)} | ${r.avg_mastery === null ? "—" : `${r.avg_mastery}%`.padEnd(19)} | ${r.assignments}`
  );
}

const dupNames = count(
  `SELECT COUNT(*) AS c FROM (SELECT name FROM users WHERE role='student' GROUP BY name HAVING COUNT(*) > 1)`
);
const dupEmails = count(
  `SELECT COUNT(*) AS c FROM (SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1)`
);
console.log(`\nTakrorlangan ism-familiya: ${dupNames}, takrorlangan email: ${dupEmails}`);
