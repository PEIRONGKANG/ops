import { useEffect, useState } from "react";
import { api } from "../services/api.js";

const SUMMARY_LABELS = [
  ["students_total", "学生总数"],
  ["overall_progress", "整体完成率", "%"],
  ["pending_p2_confirm", "待 P2 确认"],
  ["pending_t1_review", "待 T1 督导"],
  ["overdue_count", "超时未完成"],
  ["today_submissions", "今日提交数"],
  ["average_score", "平均得分"],
  ["risk_students", "风险学生数"],
];

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN");
}

export function LeaderDashboardTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.p1Dashboard()
      .then((resp) => {
        if (alive) setData(resp);
      })
      .catch((err) => {
        if (alive) setError(err.message || "领导驾驶舱加载失败。");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <section className="soft-card"><p className="status-line">正在加载领导驾驶舱...</p></section>;
  }

  if (error) {
    return <section className="soft-card"><p className="module-kicker">Dashboard Error</p><h2 className="section-title mt-2">领导驾驶舱暂不可用</h2><p className="status-line mt-3">{error}</p></section>;
  }

  const summary = data?.summary || {};
  const semester = data?.semester || {};

  return (
    <section className="module-shell">
      <div className="soft-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="module-kicker">Leader Dashboard</p>
            <h2 className="section-title mt-2">领导驾驶舱</h2>
            <p className="status-line mt-3">实训基地学期运行、学生进度与督导数据总览</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-pill is-good">{semester.display_name || "2025-2026 学年 第二学期（春季学期）"}</span>
            <span className="pill-chip">{semester.current_week || "当前教学周待接入"}</span>
            <span className="pill-chip">系统运行中</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_LABELS.map(([key, label, suffix]) => (
          <div key={key} className="soft-card">
            <p className="module-kicker">{label}</p>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{summary[key] ?? 0}{suffix || ""}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="soft-card overflow-hidden">
          <h3 className="panel-title">学生实训进度排行</h3>
          <div className="mt-4 overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-3">学生</th>
                  <th className="py-3">学号</th>
                  <th className="py-3">进度</th>
                  <th className="py-3">完成任务</th>
                  <th className="py-3">均分</th>
                  <th className="py-3">状态</th>
                </tr>
              </thead>
              <tbody>
                {(data.student_progress || []).map((student) => (
                  <tr key={student.student_no} className="border-t border-slate-100">
                    <td className="py-3 font-medium text-slate-900">{student.name}{student.risk ? <span className="ml-2 status-pill is-warn">风险</span> : null}</td>
                    <td className="py-3 text-slate-600">{student.student_no}</td>
                    <td className="py-3">{student.training_progress}%</td>
                    <td className="py-3">{student.completed_tasks}/{student.total_tasks}</td>
                    <td className="py-3">{student.average_score}</td>
                    <td className="py-3">{student.current_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="soft-card">
            <h3 className="panel-title">风险预警</h3>
            <div className="mt-4 space-y-2">
              {(data.risk_alerts || []).length ? data.risk_alerts.map((alert, index) => (
                <div key={`${alert.type}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="font-semibold text-amber-900">{alert.title}</div>
                  <div className="mt-1 text-sm text-amber-800">{alert.meta}</div>
                </div>
              )) : <p className="status-line">暂无风险预警。</p>}
            </div>
          </div>

          <div className="soft-card">
            <h3 className="panel-title">最新动态</h3>
            <div className="mt-4 space-y-3">
              {(data.recent_activities || []).length ? data.recent_activities.map((item, index) => (
                <div key={`${item.type}-${index}`} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="font-medium text-slate-900">{item.title}</div>
                  <div className="text-sm text-slate-500">{item.actor || "-"} · {item.target || "-"} · {formatTime(item.time)}</div>
                </div>
              )) : <p className="status-line">暂无动态。</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="soft-card">
          <h3 className="panel-title">P2 值班经理履职情况</h3>
          <div className="mt-4 space-y-2">
            {(data.p2_performance || []).map((item) => (
              <div key={item.username} className="status-line">{item.name}：待确认 {item.pending_confirm}，已确认 {item.confirmed}，状态 {item.status}</div>
            ))}
          </div>
        </div>
        <div className="soft-card">
          <h3 className="panel-title">T1 督导教师工作情况</h3>
          <div className="mt-4 space-y-2">
            {(data.t1_supervision || []).length ? (data.t1_supervision || []).map((item) => (
              <div key={item.username} className="status-line">{item.name}：已评价 {item.reviewed}，待评价 {item.pending}，负责范围 {item.scope}</div>
            )) : <p className="status-line">暂无 T1 督导数据，请先在账号管理中创建 T1 账号并初始化督导记录。</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
