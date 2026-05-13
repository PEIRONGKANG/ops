import { useEffect, useMemo, useState } from "react";

import { api } from "../services/api.js";
import { hasDailyRecordPayload, hasImages, hasText } from "../lib/dailyState.js";

function trim(value) {
  return String(value || "").trim();
}

function hasApprovalStamp(approval) {
  return Boolean(trim(approval?.by) || trim(approval?.time) || trim(approval?.comment));
}

function statusPill(status) {
  switch (status) {
    case "done":
    case "p2_confirmed":
      return "status-pill is-good";
    case "pending":
    case "submitted":
    case "pending_p2":
      return "status-pill is-warn";
    case "draft":
      return "status-pill";
    case "t1_reviewed":
    case "pending_t1":
      return "status-pill bg-violet-50 text-violet-700 border-violet-200";
    case "returned":
    case "overdue":
    case "revision_required":
      return "status-pill bg-rose-50 text-rose-700 border-rose-200";
    case "empty":
    case "not_started":
      return "status-pill is-quiet";
    default:
      return "status-pill";
  }
}

const STATUS_LABELS = {
  empty: "未开始",
  not_started: "未开始",
  draft: "草稿中",
  submitted: "已提交",
  pending: "待 P2 确认",
  pending_p2: "待 P2 确认",
  done: "已完成",
  p2_confirmed: "P2 已确认",
  returned: "P2 已退回",
  pending_t1: "待 T1 督导",
  t1_reviewed: "T1 已评价",
  revision_required: "T1 要求整改",
  overdue: "超时未完成",
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "未开始";
}

function computeModuleStatus(week) {
  if (!week) {
    return { creative: "empty", daily: "empty", handover: "empty", reflection: "empty" };
  }

  const creativePayload = week.creative || {};
  const handoverPayload = week.handover || {};
  const reflectionPayload = week.reflection || {};
  const daily = week.daily || {};

  const creativeSubmitted = hasText(creativePayload.marketing, creativePayload.recipe, creativePayload.procurement) || hasImages(creativePayload.posters);
  const creativeApproved = hasApprovalStamp(creativePayload.approval);

  const dailySubmitted = Object.values(daily).some(hasDailyRecordPayload);
  const dailyApproved = Object.values(daily).some((record) => Object.values(record?.approvals || {}).some(hasApprovalStamp));

  const handoverSubmitted = hasText(handoverPayload.summary, handoverPayload.nextGroup) || hasImages(handoverPayload.photos);
  const handoverApproved = hasApprovalStamp(handoverPayload.approval);

  const reflectionSubmitted = hasText(reflectionPayload.a, reflectionPayload.b, reflectionPayload.optPlan, reflectionPayload.managerComment);
  const reflectionApproved = hasApprovalStamp(reflectionPayload.approval);

  const normalize = (submitted, approved) => {
    if (!submitted && !approved) return "empty";
    if (approved) return "done";
    return "pending";
  };

  return {
    creative: normalize(creativeSubmitted, creativeApproved),
    daily: normalize(dailySubmitted, dailyApproved),
    handover: normalize(handoverSubmitted, handoverApproved),
    reflection: normalize(reflectionSubmitted, reflectionApproved),
  };
}

export function CompletionMatrixTab({ selectedWeekStart, users }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [detail, setDetail] = useState(null);

  const studentUsers = useMemo(() => {
    return (users || []).filter((u) => u.level === "P3").sort((a, b) => String(a.username).localeCompare(String(b.username)));
  }, [users]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setBusy(true);
      setError("");
      try {
        const startDate = selectedWeekStart;
        const scopesResp = await api.fetchWeekScopes(startDate);
        const scopes = Array.isArray(scopesResp?.scopes) ? scopesResp.scopes : [];
        const targets = scopes.length ? scopes : studentUsers.map((u) => u.username);

        const results = await Promise.allSettled(
          targets.map(async (username) => {
            const resp = await api.fetchWeek(username, startDate, { includeMedia: false });
            return { username, week: resp.week || null };
          }),
        );
        const progressResp = await api.trainingProgress().catch(() => ({ students: [], tasks: [], submissions: [] }));
        const progressMap = new Map((progressResp.students || []).map((item) => [item.student_no, item]));
        if (!mounted) return;

        const next = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value)
          .map(({ username, week }) => {
            const user = studentUsers.find((u) => u.username === username);
            const moduleStatus = computeModuleStatus(week);
            const total = Object.values(moduleStatus).filter((v) => v === "done").length;
            const studentProgress = progressMap.get(username);
            const trainingProgress = Number(studentProgress?.training_progress || 0);
            const expandedStatus = {
              ...moduleStatus,
              poster: moduleStatus.creative,
              p2: Object.values(moduleStatus).some((v) => v === "pending") ? "pending_p2" : (Object.values(moduleStatus).some((v) => v === "done") ? "p2_confirmed" : "not_started"),
              t1: "pending_t1",
              report: total >= 4 ? "done" : "not_started",
              training: trainingProgress >= 100 ? "done" : (trainingProgress > 0 ? "submitted" : "not_started"),
            };
            return {
              username,
              displayName: user?.displayName || username,
              className: studentProgress?.class_name || user?.className || "",
              groupName: studentProgress?.group_name || "",
              moduleStatus: expandedStatus,
              totalDone: total,
              teachingWeek: week?.teachingWeek || "",
              groupA: week?.members?.a || "",
              groupB: week?.members?.b || "",
              updatedAt: week?._updatedAt || "",
              trainingProgress,
              totalProgress: Math.round(((total / 4) * 60) + (trainingProgress * 0.4)),
            };
          })
          .sort((a, b) => String(a.username).localeCompare(String(b.username)));

        setRows(next);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "加载失败。");
      } finally {
        if (mounted) setBusy(false);
      }
    };

    if (selectedWeekStart) load();
    return () => {
      mounted = false;
    };
  }, [selectedWeekStart, studentUsers]);

  const filteredRows = useMemo(() => {
    const q = trim(query).toLowerCase();
    return rows.filter((row) => {
      if (q && !`${row.displayName} ${row.username}`.toLowerCase().includes(q)) return false;
      if (moduleFilter && row.moduleStatus[moduleFilter] === undefined) return false;
      const statuses = moduleFilter ? [row.moduleStatus[moduleFilter]] : Object.values(row.moduleStatus);
      if (statusFilter && !statuses.includes(statusFilter)) return false;
      if (quickFilter === "unfinished" && row.totalProgress >= 100) return false;
      if (quickFilter === "pending_p2" && !statuses.includes("pending_p2") && !statuses.includes("pending")) return false;
      if (quickFilter === "pending_t1" && !statuses.includes("pending_t1")) return false;
      if (quickFilter === "overdue" && !statuses.includes("overdue")) return false;
      if (quickFilter === "exportable" && row.moduleStatus.report !== "done") return false;
      return true;
    });
  }, [moduleFilter, query, quickFilter, rows, statusFilter]);

  const openDetail = (row, moduleKey, label) => {
    setDetail({
      title: `${row.displayName} · ${label}`,
      meta: `${row.username} · ${row.teachingWeek || selectedWeekStart}`,
      status: statusLabel(row.moduleStatus[moduleKey]),
      source: "当前状态由周报模块、P2 确认记录和训练任务提交聚合生成。详情页未单独实现时，先在此 Modal 展示来源。",
    });
  };

  const columns = [
    ["creative", "创意策划"],
    ["daily", "日常运营"],
    ["handover", "班次交接"],
    ["reflection", "总结复盘"],
    ["poster", "海报上传"],
    ["p2", "P2 确认"],
    ["t1", "T1 督导"],
    ["report", "周报导出"],
    ["training", "实训任务完成度"],
  ];

  return (
    <section className="module-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="module-kicker">Completion Matrix</p>
          <h2 className="section-title mt-2">学生 × 模块完成状态总览</h2>
          <p className="status-line mt-3">{error || (busy ? "加载中…" : `当前周次：${selectedWeekStart}`)}</p>
        </div>
        <div className="soft-card">
          <div className="text-sm text-slate-700 font-semibold">状态说明</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="status-pill is-quiet">未开始</span>
            <span className="status-pill">草稿中</span>
            <span className="status-pill is-warn">待确认</span>
            <span className="status-pill is-good">已完成/已确认</span>
            <span className="status-pill bg-violet-50 text-violet-700 border-violet-200">T1 督导</span>
            <span className="status-pill bg-rose-50 text-rose-700 border-rose-200">退回/超时/整改</span>
          </div>
        </div>
      </div>

      <div className="soft-card mt-4 grid gap-3 xl:grid-cols-5">
        <input className="field-input" placeholder="搜索姓名 / 学号" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="field-input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          <option value="">全部模块</option>
          {columns.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select className="field-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select className="field-input" value={quickFilter} onChange={(e) => setQuickFilter(e.target.value)}>
          <option value="">全部记录</option>
          <option value="unfinished">只看未完成</option>
          <option value="pending_p2">只看待 P2 确认</option>
          <option value="pending_t1">只看待 T1 督导</option>
          <option value="overdue">只看超时</option>
          <option value="exportable">只看可导出周报</option>
        </select>
        <div className="status-line flex items-center">结果：{filteredRows.length} / {rows.length}</div>
      </div>

      <div className="soft-card mt-4 overflow-x-auto">
        <table className="min-w-[100rem] w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">姓名</th>
              <th className="px-3 py-2 text-left font-semibold">学号</th>
              <th className="px-3 py-2 text-left font-semibold">班级</th>
              <th className="px-3 py-2 text-left font-semibold">小组</th>
              <th className="px-3 py-2 text-left font-semibold">教学周</th>
              {columns.map(([, label]) => <th key={label} className="px-3 py-2 text-left font-semibold">{label}</th>)}
              <th className="px-3 py-2 text-left font-semibold">总进度</th>
              <th className="px-3 py-2 text-left font-semibold">最近更新时间</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredRows.map((row) => (
              <tr key={row.username} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-900">{row.displayName}</td>
                <td className="px-3 py-2 text-slate-700">{row.username}</td>
                <td className="px-3 py-2 text-slate-500">{row.className || "-"}</td>
                <td className="px-3 py-2 text-slate-500">{row.groupName || "-"}</td>
                <td className="px-3 py-2 text-slate-500">{row.teachingWeek || "-"}</td>
                {columns.map(([key, label]) => (
                  <td key={key} className="px-3 py-2">
                    <button type="button" className={statusPill(row.moduleStatus[key])} onClick={() => openDetail(row, key, label)}>
                      {key === "training" ? `${row.trainingProgress}%` : statusLabel(row.moduleStatus[key])}
                    </button>
                  </td>
                ))}
                <td className="px-3 py-2 text-slate-700">{row.totalProgress}%</td>
                <td className="px-3 py-2 text-slate-500">{row.updatedAt || "-"}</td>
              </tr>
            ))}
            {!filteredRows.length ? (
              <tr><td colSpan={17} className="px-3 py-6 text-center text-slate-500">{busy ? "加载中…" : "暂无数据"}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setDetail(null)}>
          <div className="soft-card max-w-xl" onClick={(e) => e.stopPropagation()}>
            <p className="module-kicker">状态详情</p>
            <h3 className="panel-title mt-2">{detail.title}</h3>
            <p className="status-line mt-2">{detail.meta}</p>
            <span className="status-pill is-good mt-4">{detail.status}</span>
            <p className="status-line mt-4">{detail.source}</p>
            <button className="btn-secondary mt-4" type="button" onClick={() => setDetail(null)}>关闭</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
