import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";

const DEFAULT_FORM = {
  academic_year_start: "2025",
  academic_year_end: "2026",
  semester_number: "第二学期",
  season: "春季学期",
  first_week_start_date: "2026-03-04",
  weeks_count: "18",
  status: "active",
};

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("zh-CN");
}

export function SemesterManagementTab({ currentUser }) {
  const [data, setData] = useState({ semesters: [], teachingWeeks: [] });
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManage = currentUser?.level === "P1";
  const canView = ["P1", "T1"].includes(currentUser?.level);

  const activeSemester = useMemo(
    () => data.semesters.find((item) => item.status === "active") || data.semesters[0] || null,
    [data.semesters],
  );
  const activeWeeks = useMemo(
    () => data.teachingWeeks.filter((week) => week.semester_id === activeSemester?.id),
    [activeSemester, data.teachingWeeks],
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await api.listSemesters();
      setData({
        semesters: Array.isArray(resp?.semesters) ? resp.semesters : [],
        teachingWeeks: Array.isArray(resp?.teachingWeeks) ? resp.teachingWeeks : [],
      });
    } catch (err) {
      setError(err.message || "学期数据加载失败。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) load();
  }, [canView]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!canManage || saving) return;
    setSaving(true);
    setError("");
    try {
      await api.createSemester({
        academic_year_start: Number(form.academic_year_start),
        academic_year_end: Number(form.academic_year_end),
        semester_number: form.semester_number,
        season: form.season,
        first_week_start_date: form.first_week_start_date,
        weeks_count: Number(form.weeks_count || 18),
        status: form.status,
      });
      await load();
    } catch (err) {
      setError(err.message || "创建学期失败。");
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <section className="module-shell">
        <div className="soft-card">
          <p className="module-kicker">403</p>
          <h2 className="section-title mt-2">无权访问学期管理</h2>
          <p className="status-line mt-3">P2/P3 不能配置学期。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="module-shell">
      <div>
        <p className="module-kicker">Semester Management</p>
        <h2 className="section-title mt-2">学期管理</h2>
        <p className="status-line mt-3">当前学期与教学周来自 PocketBase Semesters / Teaching_Weeks。</p>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="soft-card">
          <h3 className="panel-title">当前学期</h3>
          {loading ? (
            <p className="status-line mt-3">正在加载...</p>
          ) : activeSemester ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="status-pill is-good">{activeSemester.display_name}</span>
                <span className="pill-chip">{activeSemester.status}</span>
              </div>
              <p className="status-line">第一周开始：{formatDate(activeSemester.first_week_start_date)}，周数：{activeSemester.weeks_count || activeWeeks.length}</p>
              <div className="max-h-80 overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">周次</th>
                      <th className="px-4 py-3">开始</th>
                      <th className="px-4 py-3">结束</th>
                      <th className="px-4 py-3">当前</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeWeeks.map((week) => (
                      <tr key={week.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">{week.display_name}</td>
                        <td className="px-4 py-3">{formatDate(week.start_date)}</td>
                        <td className="px-4 py-3">{formatDate(week.end_date)}</td>
                        <td className="px-4 py-3">{week.is_current ? "是" : "否"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="status-line mt-3">暂无学期数据，请由 P1 创建。</p>
          )}
        </div>

        <div className="soft-card">
          <h3 className="panel-title">创建新学期</h3>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">起始年份<input className="field-input mt-1" value={form.academic_year_start} disabled={!canManage} onChange={(e) => update("academic_year_start", e.target.value)} /></label>
              <label className="field-label">结束年份<input className="field-input mt-1" value={form.academic_year_end} disabled={!canManage} onChange={(e) => update("academic_year_end", e.target.value)} /></label>
            </div>
            <label className="field-label">学期序号<select className="field-input mt-1" value={form.semester_number} disabled={!canManage} onChange={(e) => update("semester_number", e.target.value)}><option>第一学期</option><option>第二学期</option><option>第三学期</option></select></label>
            <label className="field-label">季节学期<select className="field-input mt-1" value={form.season} disabled={!canManage} onChange={(e) => update("season", e.target.value)}><option>春季学期</option><option>秋季学期</option><option>夏季学期</option><option>冬季学期</option></select></label>
            <label className="field-label">第一周开始日期<input className="field-input mt-1" type="date" value={form.first_week_start_date} disabled={!canManage} onChange={(e) => update("first_week_start_date", e.target.value)} /></label>
            <label className="field-label">周数<input className="field-input mt-1" type="number" min="1" max="30" value={form.weeks_count} disabled={!canManage} onChange={(e) => update("weeks_count", e.target.value)} /></label>
            <label className="field-label">状态<select className="field-input mt-1" value={form.status} disabled={!canManage} onChange={(e) => update("status", e.target.value)}><option value="active">设为当前 active</option><option value="not_started">暂不启用</option></select></label>
            <button className="btn-primary" type="button" onClick={submit} disabled={!canManage || saving}>{saving ? "创建中..." : "创建学期并生成教学周"}</button>
            {!canManage ? <p className="status-line">T1 仅可查看；P2/P3 无配置权限。</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
