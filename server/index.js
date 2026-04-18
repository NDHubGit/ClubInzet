/**
 * @deprecated ClubInzet gebruikt Supabase + Next API (/api/tasks). Deze server is niet meer nodig voor de app.
 */
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

let users = [];

let tasks = [];

app.post("/users", (req, res) => {
  const { first_name, last_name, email, team, bond_number } = req.body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const user = {
    id: Date.now(),
    first_name,
    last_name,
    email,
    team: team || "",
    bond_number: bond_number || "",
  };

  users.push(user);
  res.json(user);
});

app.get("/leaderboard", (_req, res) => {
  const byUser = {};
  for (const t of tasks) {
    const uid = String(t.user_id);
    const mins = Number(t.duration_minutes);
    if (!Number.isFinite(mins)) continue;
    if (!byUser[uid]) byUser[uid] = 0;
    byUser[uid] += mins / 60;
  }
  const rows = Object.entries(byUser).map(([user_id, total]) => ({
    user_id,
    total_points: Math.round(total * 10) / 10,
  }));
  rows.sort((a, b) => b.total_points - a.total_points);
  res.json(rows);
});

app.get("/tasks", (req, res) => {
  const { user_id } = req.query;

  // Geen user_id: volledige lijst (o.a. voor /admin debug)
  if (!user_id) {
    return res.json(tasks);
  }

  const userTasks = tasks.filter((t) => String(t.user_id) === String(user_id));
  res.json(userTasks);
});

function taskDayKey(t) {
  if (t.created_at) return String(t.created_at).slice(0, 10);
  return "";
}

function taskTimeMs(t) {
  if (t.created_at) {
    const ms = new Date(t.created_at).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  if (typeof t.id === "number" && Number.isFinite(t.id)) return t.id;
  return 0;
}

app.post("/tasks", (req, res) => {
  console.log("POST /tasks", req.body);
  console.log("Incoming task user_id:", req.body.user_id);

  const task_type = req.body.task_type;
  const rawDm = Number(req.body.duration_minutes);
  const user_id = req.body.user_id;

  if (!task_type || user_id === undefined || user_id === null || user_id === "") {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!Number.isFinite(rawDm) || rawDm <= 0) {
    return res.status(400).json({ error: "duration_minutes must be positive" });
  }

  let duration_minutes = rawDm;
  const reasons = [];

  if (duration_minutes > 180) {
    duration_minutes = 180;
    reasons.push("duration_exceeds_limit");
  }

  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const twoMinAgo = now - 2 * 60 * 1000;

  const duplicate = tasks.some((t) => {
    if (String(t.user_id) !== String(user_id)) return false;
    if (String(t.task_type) !== String(task_type)) return false;
    if (Number(t.duration_minutes) !== Number(duration_minutes)) return false;
    return taskTimeMs(t) >= twoMinAgo;
  });
  if (duplicate) {
    return res.status(400).json({ error: "Duplicate task detected" });
  }

  const todays = tasks.filter(
    (t) => String(t.user_id) === String(user_id) && taskDayKey(t) === today
  );
  const totalToday = todays.reduce((s, t) => s + Number(t.duration_minutes || 0), 0);

  if (totalToday + duration_minutes > 300) {
    reasons.push("daily_limit_exceeded");
  }
  if (todays.length >= 10) {
    reasons.push("too_many_tasks");
  }
  if (Math.random() < 0.15) {
    reasons.push("random_check");
  }

  const flagged = reasons.length > 0;
  const flag_reason = flagged ? reasons.join(";") : null;
  const points = Math.round((duration_minutes / 60) * 10) / 10;
  const created_at = new Date().toISOString();

  const task = {
    id: Date.now(),
    user_id,
    task_type,
    duration_minutes,
    points,
    flagged,
    flag_reason,
    created_at,
  };

  tasks.push(task);

  res.json(task);
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log("✅ API running on http://127.0.0.1:" + PORT);
});
