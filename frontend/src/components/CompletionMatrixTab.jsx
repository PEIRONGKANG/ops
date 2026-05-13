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
      return "status-pill is-good";
    case "pending":
      return "status-pill is-warn";
    case "empty":
      return "status-pill is-quiet";
    default:
      return "status-pill";
  }
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
        if (!mounted) return;

        const next = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value)
          .map(({ username, week }) => {
            const user = studentUsers.find((u) => u.username === username);
            const moduleStatus = computeModuleStatus(week);
            const total = Object.values(moduleStatus).filter((v) => v === "done").length;
            return {
              username,
              displayName: user?.displayName || username,
              moduleStatus,
              totalDone: total,
              teachingWeek: week?.teachingWeek || "",
              groupA: week?.members?.a || "",
              groupB: week?.members?.b || "",
              updatedAt: week?._updatedAt || "",
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
            <span className="status-pill is-warn">已提交/待确认</span>
            <span className="status-pill is-good">已完成/已确认</span>
          </div>
        </div>
      </div>

      <div className="soft-card mt-4 overflow-x-auto">
        <table className="min-w-[66rem] w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">姓名</th>
              <th className="px-3 py-2 text-left font-semibold">学号</th>
              <th className="px-3 py-2 text-left font-semibold">教学周</th>
              <th className="px-3 py-2 text-left font-semibold">创意策划</th>
              <th className="px-3 py-2 text-left font-semibold">日常运营</th>
              <th className="px-3 py-2 text-left font-semibold">班次交接</th>
              <th className="px-3 py-2 text-left font-semibold">总结复盘</th>
              <th className="px-3 py-2 text-left font-semibold">完成数</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((row) => (
              <tr key={row.username} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-900">{row.displayName}</td>
                <td className="px-3 py-2 text-slate-700">{row.username}</td>
                <td className="px-3 py-2 text-slate-500">{row.teachingWeek || "-"}</td>
                <td className="px-3 py-2"><span className={statusPill(row.moduleStatus.creative)}>{row.moduleStatus.creative === "done" ? "已完成" : row.moduleStatus.creative === "pending" ? "待确认" : "未开始"}</span></td>
                <td className="px-3 py-2"><span className={statusPill(row.moduleStatus.daily)}>{row.moduleStatus.daily === "done" ? "已完成" : row.moduleStatus.daily === "pending" ? "待确认" : "未开始"}</span></td>
                <td className="px-3 py-2"><span className={statusPill(row.moduleStatus.handover)}>{row.moduleStatus.handover === "done" ? "已完成" : row.moduleStatus.handover === "pending" ? "待确认" : "未开始"}</span></td>
                <td className="px-3 py-2"><span className={statusPill(row.moduleStatus.reflection)}>{row.moduleStatus.reflection === "done" ? "已完成" : row.moduleStatus.reflection === "pending" ? "待确认" : "未开始"}</span></td>
                <td className="px-3 py-2 text-slate-700">{row.totalDone} / 4</td>
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

