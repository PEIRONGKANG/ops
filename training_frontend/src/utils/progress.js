export function calcProgress({ tasks, submissions }) {
  const published = Array.isArray(tasks) ? tasks : [];
  const subs = Array.isArray(submissions) ? submissions : [];
  const total = published.length;
  if (!total) return { total: 0, completed: 0, percent: 0 };
  const completedTaskIds = new Set(
    subs
      .filter((s) => String(s.status) === "completed" || Boolean(s.is_correct))
      .map((s) => s.task_id),
  );
  const completed = published.filter((t) => completedTaskIds.has(t.id)).length;
  const percent = Math.round((completed / total) * 100);
  return { total, completed, percent };
}

