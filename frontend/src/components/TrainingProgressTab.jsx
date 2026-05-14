import { useEffect, useMemo, useState } from "react";

import { api } from "../services/api.js";

function trim(value) {
  return String(value || "").trim();
}

function byNumber(a, b, dir) {
  const aa = Number(a || 0);
  const bb = Number(b || 0);
  return dir === "desc" ? bb - aa : aa - bb;
}

export function TrainingProgressTab() {
  const [data, setData] = useState({ tasks: [], students: [], submissions: [] });
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("student_no");
  const [sortDir, setSortDir] = useState("asc");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setBusy(true);
      setError("");
      try {
        const resp = await api.trainingProgress();
        if (!mounted) return;
        setData({
          tasks: Array.isArray(resp?.tasks) ? resp.tasks : [],
          students: Array.isArray(resp?.students) ? resp.students.filter((student) => (student?.role_code || "P3") === "P3") : [],
          submissions: Array.isArray(resp?.submissions) ? resp.submissions : [],
        });
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "加载失败。");
      } finally {
        if (mounted) setBusy(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = data.students.length;
    const avg = total ? Math.round(data.students.reduce((s, it) => s + Number(it.training_progress || 0), 0) / total) : 0;
    const done = data.students.filter((it) => Number(it.training_progress || 0) >= 100).length;
    const pending = data.submissions.filter((it) => it.status === "submitted").length;
    return { total, avg, done, pending };
  }, [data.students, data.submissions]);

  const taskCount = data.tasks.length;
  const submissionByStudent = useMemo(() => {
    const map = new Map();
    data.submissions.forEach((s) => {
      const sid = s?.student_id?.id || s?.student_id || s?.expand?.student_id?.id;
      if (!sid) return;
      const list = map.get(sid) || [];
      list.push(s);
      map.set(sid, list);
    });
    return map;
  }, [data.submissions]);

  const rows = useMemo(() => {
    const q = trim(query).toLowerCase();
    const filtered = data.students.filter((s) => {
      if (!q) return true;
      return String(s.name || "").toLowerCase().includes(q) || String(s.student_no || "").toLowerCase().includes(q);
    });

    const enriched = filtered.map((s) => {
      const subs = submissionByStudent.get(s.id) || [];
      const completed = subs.filter((x) => x.status === "completed" || x.is_correct === true).length;
      const scores = subs.map((x) => Number(x.score || 0)).filter((x) => Number.isFinite(x));
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const last = subs
        .map((x) => x.submitted_at || x.created)
        .map((x) => String(x || ""))
        .sort()
        .slice(-1)[0] || "";
      return {
        ...s,
        completedTasks: completed,
        totalTasks: taskCount,
        avgScore,
        lastSubmittedAt: last,
      };
    });

    const dir = sortDir;
    const key = sortKey;
    const sorted = [...enriched].sort((a, b) => {
      if (key === "progress") return byNumber(a.training_progress, b.training_progress, dir);
      if (key === "avgScore") return byNumber(a.avgScore, b.avgScore, dir);
      if (key === "last") return dir === "desc" ? String(b.lastSubmittedAt).localeCompare(String(a.lastSubmittedAt)) : String(a.lastSubmittedAt).localeCompare(String(b.lastSubmittedAt));
      return dir === "desc" ? String(b.student_no).localeCompare(String(a.student_no)) : String(a.student_no).localeCompare(String(b.student_no));
    });
    return sorted;
  }, [data.students, query, sortDir, sortKey, submissionByStudent, taskCount]);

  return (
    <section className="module-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="module-kicker">Training Progress</p>
          <h2 className="section-title mt-2">学生实训进度总览</h2>
          <p className="status-line mt-3">{error || (busy ? "加载中…" : "仅展示 P3 学生账号，支持按学号/进度/得分排序，搜索姓名或学号。")}</p>
        </div>
        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-4">
          <article className="ops-stat-card">
            <div className="ops-stat-head"><p>学生总数</p><span className="ops-stat-icon" aria-hidden="true" /></div>
            <strong>{stats.total}</strong>
            <small>Students</small>
          </article>
          <article className="ops-stat-card tone-good">
            <div className="ops-stat-head"><p>平均进度</p><span className="ops-stat-icon" aria-hidden="true" /></div>
            <strong>{stats.avg}%</strong>
            <small>Average</small>
          </article>
          <article className="ops-stat-card tone-quiet">
            <div className="ops-stat-head"><p>已完成</p><span className="ops-stat-icon" aria-hidden="true" /></div>
            <strong>{stats.done}</strong>
            <small>Completed</small>
          </article>
          <article className="ops-stat-card tone-warn">
            <div className="ops-stat-head"><p>待批阅/确认</p><span className="ops-stat-icon" aria-hidden="true" /></div>
            <strong>{stats.pending}</strong>
            <small>Pending</small>
          </article>
        </div>
      </div>

      <div className="soft-card mt-4 grid gap-3 lg:grid-cols-[1fr_10rem_10rem]">
        <div>
          <label className="field-label">搜索（姓名/学号）</label>
          <input className="field-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例如：2401280112 / 周露" />
        </div>
        <div>
          <label className="field-label">排序字段</label>
          <select className="field-input" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="student_no">学号</option>
            <option value="progress">进度</option>
            <option value="avgScore">平均得分</option>
            <option value="last">最近提交</option>
          </select>
        </div>
        <div>
          <label className="field-label">方向</label>
          <select className="field-input" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
        </div>
      </div>

      <div className="soft-card mt-4 overflow-x-auto">
        <table className="min-w-[70rem] w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">姓名</th>
              <th className="px-3 py-2 text-left font-semibold">学号</th>
              <th className="px-3 py-2 text-left font-semibold">班级</th>
              <th className="px-3 py-2 text-left font-semibold">小组</th>
              <th className="px-3 py-2 text-left font-semibold">进度</th>
              <th className="px-3 py-2 text-left font-semibold">完成任务</th>
              <th className="px-3 py-2 text-left font-semibold">平均得分</th>
              <th className="px-3 py-2 text-left font-semibold">最近提交</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-900 font-semibold">{s.name}</td>
                <td className="px-3 py-2 text-slate-700">{s.student_no}</td>
                <td className="px-3 py-2 text-slate-700">{s.class_name || "-"}</td>
                <td className="px-3 py-2 text-slate-700">{s.group_name || "-"}</td>
                <td className="px-3 py-2">
                  <span className={`status-pill ${Number(s.training_progress || 0) >= 100 ? "is-good" : "is-quiet"}`}>
                    {Number(s.training_progress || 0)}%
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{s.completedTasks} / {s.totalTasks}</td>
                <td className="px-3 py-2 text-slate-700">{s.avgScore}</td>
                <td className="px-3 py-2 text-slate-500">{s.lastSubmittedAt ? String(s.lastSubmittedAt).replace("T", " ").slice(0, 16) : "-"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">{busy ? "加载中…" : "暂无数据"}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
