import { useState } from "react";

import { buildRankings } from "../lib/foundation";

const DEFAULT_COURSE_FORM = {
  batchId: "",
  groupId: "",
  studentUsername: "",
  managerScore: "",
  teacherScore: "",
  notes: "",
};

const DEFAULT_SHOWCASE_FORM = {
  batchId: "",
  groupId: "",
  studentUsername: "",
  judgeName: "",
  score: "",
  notes: "",
};

function trimText(value) {
  return String(value || "").trim();
}

function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

export function ScoringTab({
  courseBatches,
  groups,
  students,
  courseScores,
  showcaseScores,
  editable,
  onCreateCourseScore,
  onDeleteCourseScore,
  onCreateShowcaseScore,
  onDeleteShowcaseScore,
}) {
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [courseForm, setCourseForm] = useState(DEFAULT_COURSE_FORM);
  const [showcaseForm, setShowcaseForm] = useState(DEFAULT_SHOWCASE_FORM);

  const batchValue = selectedBatchId || String(courseBatches[0]?.id || "");
  const activeBatchId = Number(batchValue) || null;
  const filteredGroups = groups.filter((item) => !activeBatchId || item.batchId === activeBatchId);
  const filteredCourseScores = courseScores.filter((item) => !activeBatchId || item.batchId === activeBatchId);
  const filteredShowcaseScores = showcaseScores.filter((item) => !activeBatchId || item.batchId === activeBatchId);
  const rankings = buildRankings({
    foundation: {
      courseScores: filteredCourseScores,
      showcaseScores: filteredShowcaseScores,
    },
  });

  const handleBatchChange = (value) => {
    setSelectedBatchId(value);
    setCourseForm((current) => ({ ...current, batchId: value, groupId: "" }));
    setShowcaseForm((current) => ({ ...current, batchId: value, groupId: "" }));
  };

  const courseBatchId = courseForm.batchId || batchValue;
  const showcaseBatchId = showcaseForm.batchId || batchValue;

  const handleCreateCourseScore = async () => {
    await onCreateCourseScore({
      batchId: Number(courseBatchId),
      groupId: Number(courseForm.groupId),
      studentUsername: trimText(courseForm.studentUsername),
      managerScore: Number(courseForm.managerScore || 0),
      teacherScore: Number(courseForm.teacherScore || 0),
      notes: trimText(courseForm.notes),
    });
    setCourseForm((current) => ({
      ...DEFAULT_COURSE_FORM,
      batchId: current.batchId,
      groupId: current.groupId,
    }));
  };

  const handleCreateShowcaseScore = async () => {
    await onCreateShowcaseScore({
      batchId: Number(showcaseBatchId),
      groupId: Number(showcaseForm.groupId),
      studentUsername: trimText(showcaseForm.studentUsername),
      judgeName: trimText(showcaseForm.judgeName),
      score: Number(showcaseForm.score || 0),
      notes: trimText(showcaseForm.notes),
    });
    setShowcaseForm((current) => ({
      ...DEFAULT_SHOWCASE_FORM,
      batchId: current.batchId,
      groupId: current.groupId,
    }));
  };

  const courseLeader = rankings.courseRanking[0];
  const showcaseLeader = rankings.showcaseRanking[0];

  return (
    <section className="space-y-6">
      <article className="soft-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="module-kicker">Score Center</p>
            <h3 className="section-title mt-2">评分与排行</h3>
          </div>
          <select
            className="field-input min-w-[240px]"
            value={batchValue}
            onChange={(event) => handleBatchChange(event.target.value)}
          >
            <option value="">选择课程批次</option>
            {courseBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-[#ddd5cc] bg-white px-5 py-5">
            <p className="module-kicker">课程总评分榜首</p>
            <h4 className="mt-2 text-xl font-semibold text-[#171311]">
              {courseLeader ? `${courseLeader.studentName} · ${courseLeader.finalScore}` : "暂无评分"}
            </h4>
            <p className="status-line mt-3">
              {courseLeader ? `${courseLeader.groupName || "未分组"} · 经理 ${courseLeader.managerScore} / 教师 ${courseLeader.teacherScore}` : "录入课程评分后自动生成排行。"}
            </p>
          </div>
          <div className="rounded-[24px] border border-[#ddd5cc] bg-white px-5 py-5">
            <p className="module-kicker">展示赛榜首</p>
            <h4 className="mt-2 text-xl font-semibold text-[#171311]">
              {showcaseLeader ? `${showcaseLeader.studentName} · ${showcaseLeader.averageScore}` : "暂无评分"}
            </h4>
            <p className="status-line mt-3">
              {showcaseLeader ? `${showcaseLeader.groupName || "未分组"} · 共 ${showcaseLeader.scoreCount} 个评委分` : "录入展示赛评分后自动计算均分。"}
            </p>
          </div>
        </div>
      </article>

      {editable ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <article className="soft-card">
            <p className="module-kicker">Course Score</p>
            <h3 className="section-title mt-2">录入课程总评分</h3>
            <div className="mt-5 grid gap-3">
              <select
                className="field-input"
                value={courseForm.groupId}
                onChange={(event) => setCourseForm((current) => ({ ...current, groupId: event.target.value }))}
              >
                <option value="">选择小组</option>
                {filteredGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <select
                className="field-input"
                value={courseForm.studentUsername}
                onChange={(event) => setCourseForm((current) => ({ ...current, studentUsername: event.target.value }))}
              >
                <option value="">选择学员</option>
                {students.map((student) => (
                  <option key={student.username} value={student.username}>
                    {student.displayName}（{student.username}）
                  </option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  max="100"
                  value={courseForm.managerScore}
                  onChange={(event) => setCourseForm((current) => ({ ...current, managerScore: event.target.value }))}
                  placeholder="经理评分"
                />
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  max="100"
                  value={courseForm.teacherScore}
                  onChange={(event) => setCourseForm((current) => ({ ...current, teacherScore: event.target.value }))}
                  placeholder="教师评分"
                />
              </div>
              <textarea
                className="field-input min-h-[120px]"
                value={courseForm.notes}
                onChange={(event) => setCourseForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="评分说明"
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={handleCreateCourseScore}>
                保存课程评分
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setCourseForm({ ...DEFAULT_COURSE_FORM, batchId: courseBatchId })}
              >
                清空
              </button>
            </div>
          </article>

          <article className="soft-card">
            <p className="module-kicker">Showcase Score</p>
            <h3 className="section-title mt-2">录入展示赛评分</h3>
            <div className="mt-5 grid gap-3">
              <select
                className="field-input"
                value={showcaseForm.groupId}
                onChange={(event) => setShowcaseForm((current) => ({ ...current, groupId: event.target.value }))}
              >
                <option value="">选择小组</option>
                {filteredGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <select
                className="field-input"
                value={showcaseForm.studentUsername}
                onChange={(event) => setShowcaseForm((current) => ({ ...current, studentUsername: event.target.value }))}
              >
                <option value="">选择学员</option>
                {students.map((student) => (
                  <option key={student.username} value={student.username}>
                    {student.displayName}（{student.username}）
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                value={showcaseForm.judgeName}
                onChange={(event) => setShowcaseForm((current) => ({ ...current, judgeName: event.target.value }))}
                placeholder="评委名称"
              />
              <input
                className="field-input"
                type="number"
                min="0"
                max="100"
                value={showcaseForm.score}
                onChange={(event) => setShowcaseForm((current) => ({ ...current, score: event.target.value }))}
                placeholder="评分"
              />
              <textarea
                className="field-input min-h-[120px]"
                value={showcaseForm.notes}
                onChange={(event) => setShowcaseForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="评分说明"
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={handleCreateShowcaseScore}>
                保存展示赛评分
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setShowcaseForm({ ...DEFAULT_SHOWCASE_FORM, batchId: showcaseBatchId })}
              >
                清空
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="soft-card">
          <p className="module-kicker">Course Ranking</p>
          <h3 className="section-title mt-2">课程总评分排行</h3>
          <div className="mt-5 space-y-3">
            {rankings.courseRanking.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-[#ddd5cc] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#9b7f68]">#{item.rank} {item.groupName || "未分组"}</p>
                    <h4 className="mt-2 text-lg font-semibold text-[#171311]">{item.studentName}（{item.studentUsername}）</h4>
                    <p className="status-line mt-3">经理 {valueOrDash(item.managerScore)} / 教师 {valueOrDash(item.teacherScore)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#9b7f68]">总分</p>
                    <p className="mt-2 text-2xl font-semibold text-[#171311]">{valueOrDash(item.finalScore)}</p>
                    {editable ? (
                      <button
                        className="mt-4 rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                        type="button"
                        onClick={() => onDeleteCourseScore(item.id)}
                      >
                        删除
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="soft-card">
          <p className="module-kicker">Showcase Ranking</p>
          <h3 className="section-title mt-2">展示赛均分排行</h3>
          <div className="mt-5 space-y-3">
            {rankings.showcaseRanking.map((item) => (
              <div key={`${item.batchId}-${item.studentUsername}`} className="rounded-[24px] border border-[#ddd5cc] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#9b7f68]">#{item.rank} {item.groupName || "未分组"}</p>
                    <h4 className="mt-2 text-lg font-semibold text-[#171311]">{item.studentName}（{item.studentUsername}）</h4>
                    <p className="status-line mt-3">共 {item.scoreCount} 个评委分</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#9b7f68]">均分</p>
                    <p className="mt-2 text-2xl font-semibold text-[#171311]">{valueOrDash(item.averageScore)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {editable ? (
            <div className="mt-6 space-y-3">
              {filteredShowcaseScores.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-[#ddd5cc] bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#171311]">{item.studentName} · {item.judgeName}</p>
                      <p className="status-line mt-2">{item.groupName || "未分组"} · {valueOrDash(item.score)}</p>
                    </div>
                    <button
                      className="rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                      type="button"
                      onClick={() => onDeleteShowcaseScore(item.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
