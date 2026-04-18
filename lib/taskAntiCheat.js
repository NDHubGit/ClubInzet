/**
 * Server-side anti-cheat voor taak-insert (zelfde regels als oude Express-server).
 * @param {object} params
 * @param {string} params.task_type
 * @param {number} params.rawDm
 * @param {string} params.user_id
 * @param {object[]} params.existingTasks — taken van deze user (incl. created_at)
 */

function taskDayKey(t) {
  if (t.created_at) return String(t.created_at).slice(0, 10);
  return "";
}

function taskTimeMs(t) {
  if (t.created_at) {
    const ms = new Date(t.created_at).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

export function prepareTaskInsert({ task_type, rawDm, user_id, existingTasks }) {
  if (!task_type || user_id === undefined || user_id === null || user_id === "") {
    return { ok: false, error: "Missing fields" };
  }
  if (!Number.isFinite(rawDm) || rawDm <= 0) {
    return { ok: false, error: "duration_minutes must be positive" };
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

  const duplicate = (existingTasks || []).some((t) => {
    if (String(t.user_id) !== String(user_id)) return false;
    if (String(t.task_type) !== String(task_type)) return false;
    if (Number(t.duration_minutes) !== Number(duration_minutes)) return false;
    return taskTimeMs(t) >= twoMinAgo;
  });
  if (duplicate) {
    return { ok: false, error: "Duplicate task detected" };
  }

  const todays = (existingTasks || []).filter(
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

  return {
    ok: true,
    data: {
      user_id,
      task_type,
      duration_minutes,
      points,
      flagged,
      flag_reason,
      created_at,
    },
  };
}
