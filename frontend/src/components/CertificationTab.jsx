import { useState } from "react";

const DEFAULT_FORM = {
  batchId: "",
  groupId: "",
  studentUsername: "",
  roleName: "冰吧岗位",
  plannedDate: "",
  completedDate: "",
  result: "未开始",
  score: "",
  notes: "",
};

function trimText(value) {
  return String(value || "").trim();
}

export function CertificationTab({
  courseBatches,
  groups,
  students,
  certifications,
  editable,
  onCreateCertification,
  onDeleteCertification,
}) {
  const [form, setForm] = useState(DEFAULT_FORM);

  const batchValue = form.batchId || String(courseBatches[0]?.id || "");
  const activeBatchId = Number(batchValue) || null;
  const filteredGroups = groups.filter((item) => !activeBatchId || item.batchId === activeBatchId);
  const groupValue = filteredGroups.some((item) => String(item.id) === form.groupId)
    ? form.groupId
    : String(filteredGroups[0]?.id || "");
  const filteredCertifications = certifications.filter((item) => !activeBatchId || item.batchId === activeBatchId);

  const handleCreate = async () => {
    await onCreateCertification({
      batchId: Number(batchValue),
      groupId: Number(groupValue),
      studentUsername: trimText(form.studentUsername),
      roleName: trimText(form.roleName),
      plannedDate: trimText(form.plannedDate),
      completedDate: trimText(form.completedDate),
      result: trimText(form.result),
      score: trimText(form.score),
      notes: trimText(form.notes),
    });
    setForm((current) => ({
      ...DEFAULT_FORM,
      batchId: batchValue,
      roleName: current.roleName,
      result: "未开始",
    }));
  };

  const statusStats = {
    pending: filteredCertifications.filter((item) => item.result === "未开始").length,
    pass: filteredCertifications.filter((item) => item.result === "PASS").length,
    retake: filteredCertifications.filter((item) => item.result === "Retake").length,
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="soft-card">
          <p className="module-kicker">岗位认证</p>
          <h3 className="section-title mt-2">{statusStats.pass}</h3>
          <p className="status-line mt-3">已通过</p>
        </article>
        <article className="soft-card">
          <p className="module-kicker">待完成</p>
          <h3 className="section-title mt-2">{statusStats.pending}</h3>
          <p className="status-line mt-3">尚未完成认证</p>
        </article>
        <article className="soft-card">
          <p className="module-kicker">需重修</p>
          <h3 className="section-title mt-2">{statusStats.retake}</h3>
          <p className="status-line mt-3">待补考或复训</p>
        </article>
      </div>

      {editable ? (
        <article className="soft-card">
          <p className="module-kicker">Certification Entry</p>
          <h3 className="section-title mt-2">录入岗位认证</h3>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <select
              className="field-input"
              value={batchValue}
              onChange={(event) => setForm((current) => ({ ...current, batchId: event.target.value, groupId: "" }))}
            >
              <option value="">选择课程批次</option>
              {courseBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={groupValue}
              onChange={(event) => setForm((current) => ({ ...current, groupId: event.target.value }))}
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
              value={form.studentUsername}
              onChange={(event) => setForm((current) => ({ ...current, studentUsername: event.target.value }))}
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
              value={form.roleName}
              onChange={(event) => setForm((current) => ({ ...current, roleName: event.target.value }))}
              placeholder="岗位名称"
            />
            <input
              className="field-input"
              type="date"
              value={form.plannedDate}
              onChange={(event) => setForm((current) => ({ ...current, plannedDate: event.target.value }))}
            />
            <input
              className="field-input"
              type="date"
              value={form.completedDate}
              onChange={(event) => setForm((current) => ({ ...current, completedDate: event.target.value }))}
            />
            <select
              className="field-input"
              value={form.result}
              onChange={(event) => setForm((current) => ({ ...current, result: event.target.value }))}
            >
              <option value="未开始">未开始</option>
              <option value="PASS">PASS</option>
              <option value="Retake">Retake</option>
            </select>
            <input
              className="field-input"
              value={form.score}
              onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))}
              placeholder="认证得分"
            />
            <input
              className="field-input"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="备注"
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={handleCreate}>
              保存认证
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => setForm({ ...DEFAULT_FORM, batchId: batchValue, groupId: groupValue })}
            >
              清空
            </button>
          </div>
        </article>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredCertifications.map((item) => (
          <article key={item.id} className="soft-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="module-kicker">{item.batchName}</p>
                <h3 className="section-title mt-2 !text-[1.6rem]">{item.studentName} · {item.roleName}</h3>
              </div>
              {editable ? (
                <button
                  className="rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                  type="button"
                  onClick={() => onDeleteCertification(item.id)}
                >
                  删除
                </button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-[#ddd5cc] bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[#9b7f68]">结果</p>
                <p className="mt-2 text-base font-semibold text-[#171311]">{item.result || "未开始"}</p>
              </div>
              <div className="rounded-[20px] border border-[#ddd5cc] bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[#9b7f68]">得分</p>
                <p className="mt-2 text-base font-semibold text-[#171311]">{item.score || "-"}</p>
              </div>
            </div>
            <p className="status-line mt-4">
              {item.groupName || "未分组"} · 计划 {item.plannedDate || "-"} · 完成 {item.completedDate || "-"}
            </p>
            {item.notes ? <p className="status-line mt-3">{item.notes}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
