import { useEffect, useMemo, useState } from "react";

import { api } from "../services/api.js";
import { MarkdownRenderer } from "./MarkdownRenderer.jsx";
import { InteractiveExercise } from "./InteractiveExercise.jsx";

function trim(value) {
  return String(value || "").trim();
}

function formatPercent(value) {
  const v = Number(value || 0);
  if (!Number.isFinite(v)) return "0%";
  return `${Math.max(0, Math.min(100, Math.round(v)))}%`;
}

export function TrainingTasksTab({ currentUser }) {
  const [tasks, setTasks] = useState([]);
  const [student, setStudent] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submissionsByTask = useMemo(() => {
    const map = new Map();
    submissions.forEach((s) => {
      const id = s?.task_id?.id || s?.task_id || s?.expand?.task_id?.id;
      if (!id) return;
      map.set(id, s);
    });
    return map;
  }, [submissions]);

  const completedCount = useMemo(() => {
    return submissions.filter((s) => s?.status === "completed" || s?.is_correct === true).length;
  }, [submissions]);

  const progress = useMemo(() => {
    const total = tasks.length || 0;
    const pct = total ? Math.round((completedCount / total) * 100) : 0;
    return { total, completed: completedCount, pct };
  }, [completedCount, tasks.length]);

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeTaskId) || null, [activeTaskId, tasks]);
  const activeSubmission = useMemo(() => (activeTask ? submissionsByTask.get(activeTask.id) : null), [activeTask, submissionsByTask]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setBusy(true);
      setStatus("");
      try {
        const [tasksResp, mineResp] = await Promise.all([
          api.listTrainingTasks({ publishedOnly: true }),
          api.myTrainingSubmissions(),
        ]);
        if (!mounted) return;
        const nextTasks = Array.isArray(tasksResp?.tasks) ? tasksResp.tasks : [];
        setTasks(nextTasks);
        setStudent(mineResp?.student || null);
        setSubmissions(Array.isArray(mineResp?.submissions) ? mineResp.submissions : []);
        if (!trim(activeTaskId) && nextTasks[0]) setActiveTaskId(nextTasks[0].id);
      } catch (error) {
        if (!mounted) return;
        setStatus(error.message || "加载失败。");
      } finally {
        if (mounted) setBusy(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitExercise = async (submittedAnswer) => {
    if (!activeTask) return null;
    const payload = { task_id: activeTask.id, submitted_answer: submittedAnswer };
    const res = await api.submitTraining(payload);
    // Refresh my submissions list so progress is updated.
    const mineResp = await api.myTrainingSubmissions();
    setStudent(mineResp?.student || null);
    setSubmissions(Array.isArray(mineResp?.submissions) ? mineResp.submissions : []);
    return res;
  };

  return (
    <section className="module-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="module-kicker">Training Tasks</p>
          <h2 className="section-title mt-2">我的实训任务</h2>
          <p className="status-line mt-3">{status || (busy ? "加载中…" : "选择任务后阅读指南并完成练习提交。")}</p>
        </div>
        <div className="soft-card w-full max-w-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <div className="font-semibold">{currentUser?.displayName || currentUser?.username}</div>
              <div className="text-xs text-slate-500">学号：{student?.student_no || currentUser?.username}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">实训进度</div>
              <div className="text-lg font-semibold text-slate-900">{formatPercent(student?.training_progress ?? progress.pct)}</div>
              <div className="text-xs text-slate-500">{progress.completed} / {progress.total} 已完成</div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${student?.training_progress ?? progress.pct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="soft-card">
          <div className="flex items-center justify-between gap-3">
            <div className="panel-title">任务列表</div>
            <span className="pill-chip">{tasks.length} 项</span>
          </div>
          <div className="mt-3 space-y-2">
            {tasks.length ? tasks.map((task) => {
              const done = submissionsByTask.get(task.id)?.status === "completed";
              return (
                <button
                  key={task.id}
                  type="button"
                  className={task.id === activeTaskId ? "status-line border-emerald-200 bg-emerald-50 text-emerald-900" : "status-line"}
                  onClick={() => setActiveTaskId(task.id)}
                >
                  <span className="font-semibold">{task.task_name || "未命名任务"}</span>
                  <span className={`ml-2 text-xs ${done ? "text-emerald-700" : "text-slate-500"}`}>{done ? "已完成" : "进行中"}</span>
                </button>
              );
            }) : (
              <div className="status-line">当前没有已发布任务。</div>
            )}
          </div>
        </aside>

        <div className="space-y-4">
          {activeTask ? (
            <div className="soft-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="module-kicker">{activeTask.module_code || "module"}</p>
                  <h3 className="section-title mt-2">{activeTask.task_name}</h3>
                </div>
                {activeSubmission ? (
                  <span className={`status-pill ${activeSubmission.status === "completed" ? "is-good" : "is-warn"}`}>
                    {activeSubmission.status === "completed" ? "已完成" : "已提交"}
                    {typeof activeSubmission.score === "number" ? ` · ${activeSubmission.score} 分` : ""}
                  </span>
                ) : (
                  <span className="status-pill">未提交</span>
                )}
              </div>

              <div className="mt-4">
                <MarkdownRenderer value={activeTask.markdown_content || ""} />
              </div>
            </div>
          ) : null}

          {activeTask?.interactive_exercise ? (
            <InteractiveExercise
              exercise={activeTask.interactive_exercise}
              onSubmit={submitExercise}
              disabled={busy}
            />
          ) : (
            <div className="soft-card">
              <h3 className="panel-title">实时练习</h3>
              <p className="status-line mt-2">该任务尚未配置练习题。</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

