import { useState } from "react";

const DEFAULT_BATCH_FORM = {
  name: "",
  courseName: "门店创意饮品策划与运营实践",
  termId: "",
  classIds: [],
  startWeek: 1,
  endWeek: 18,
  exportTemplateVersion: "v1",
};

function trimText(value) {
  return String(value || "").trim();
}

export function CourseConfigTab({
  terms,
  classes,
  courseBatches,
  onCreateTerm,
  onDeleteTerm,
  onCreateClass,
  onDeleteClass,
  onCreateBatch,
  onDeleteBatch,
}) {
  const [termForm, setTermForm] = useState({ code: "", name: "" });
  const [classForm, setClassForm] = useState({ code: "", name: "" });
  const [batchForm, setBatchForm] = useState(DEFAULT_BATCH_FORM);

  const handleCreateTerm = async () => {
    await onCreateTerm({
      code: trimText(termForm.code),
      name: trimText(termForm.name),
    });
    setTermForm({ code: "", name: "" });
  };

  const handleCreateClass = async () => {
    await onCreateClass({
      code: trimText(classForm.code),
      name: trimText(classForm.name),
    });
    setClassForm({ code: "", name: "" });
  };

  const handleBatchClassToggle = (classId) => {
    setBatchForm((current) => {
      const exists = current.classIds.includes(classId);
      return {
        ...current,
        classIds: exists
          ? current.classIds.filter((item) => item !== classId)
          : current.classIds.concat(classId),
      };
    });
  };

  const handleCreateBatch = async () => {
    await onCreateBatch({
      name: trimText(batchForm.name),
      courseName: trimText(batchForm.courseName),
      termId: batchForm.termId ? Number(batchForm.termId) : null,
      classIds: batchForm.classIds,
      startWeek: Number(batchForm.startWeek) || 1,
      endWeek: Number(batchForm.endWeek) || 18,
      exportTemplateVersion: trimText(batchForm.exportTemplateVersion) || "v1",
    });
    setBatchForm(DEFAULT_BATCH_FORM);
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <article className="soft-card">
          <p className="module-kicker">Term Registry</p>
          <h3 className="section-title mt-2">学期</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <input
              className="field-input"
              value={termForm.code}
              onChange={(event) => setTermForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="学期编码"
            />
            <input
              className="field-input"
              value={termForm.name}
              onChange={(event) => setTermForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="学期名称"
            />
          </div>
          <div className="mt-4">
            <button className="btn-primary" type="button" onClick={handleCreateTerm}>
              新增学期
            </button>
          </div>
          <div className="mt-6 space-y-3">
            {terms.map((term) => (
              <div key={term.id} className="rounded-[24px] border border-[#ddd5cc] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#9b7f68]">{term.code}</p>
                    <h4 className="mt-2 text-lg font-semibold text-[#171311]">{term.name}</h4>
                  </div>
                  <button
                    className="rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                    type="button"
                    onClick={() => onDeleteTerm(term.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="soft-card">
          <p className="module-kicker">Class Registry</p>
          <h3 className="section-title mt-2">班级</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <input
              className="field-input"
              value={classForm.code}
              onChange={(event) => setClassForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="班级编码"
            />
            <input
              className="field-input"
              value={classForm.name}
              onChange={(event) => setClassForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="班级名称"
            />
          </div>
          <div className="mt-4">
            <button className="btn-primary" type="button" onClick={handleCreateClass}>
              新增班级
            </button>
          </div>
          <div className="mt-6 space-y-3">
            {classes.map((classItem) => (
              <div key={classItem.id} className="rounded-[24px] border border-[#ddd5cc] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#9b7f68]">{classItem.code}</p>
                    <h4 className="mt-2 text-lg font-semibold text-[#171311]">{classItem.name}</h4>
                  </div>
                  <button
                    className="rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                    type="button"
                    onClick={() => onDeleteClass(classItem.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="soft-card">
        <p className="module-kicker">Course Batch</p>
        <h3 className="section-title mt-2">课程批次</h3>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <input
            className="field-input"
            value={batchForm.name}
            onChange={(event) => setBatchForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="批次名称"
          />
          <input
            className="field-input"
            value={batchForm.courseName}
            onChange={(event) => setBatchForm((current) => ({ ...current, courseName: event.target.value }))}
            placeholder="课程名称"
          />
          <select
            className="field-input"
            value={batchForm.termId}
            onChange={(event) => setBatchForm((current) => ({ ...current, termId: event.target.value }))}
          >
            <option value="">选择学期</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
          <input
            className="field-input"
            value={batchForm.exportTemplateVersion}
            onChange={(event) => setBatchForm((current) => ({ ...current, exportTemplateVersion: event.target.value }))}
            placeholder="导出模板版本"
          />
          <input
            className="field-input"
            type="number"
            min="1"
            value={batchForm.startWeek}
            onChange={(event) => setBatchForm((current) => ({ ...current, startWeek: event.target.value }))}
            placeholder="起始周"
          />
          <input
            className="field-input"
            type="number"
            min="1"
            value={batchForm.endWeek}
            onChange={(event) => setBatchForm((current) => ({ ...current, endWeek: event.target.value }))}
            placeholder="结束周"
          />
        </div>

        <div className="mt-5">
          <p className="field-label">关联班级</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((classItem) => (
              <label key={classItem.id} className="flex items-center gap-3 rounded-[22px] border border-[#ddd5cc] bg-white px-4 py-3 text-sm text-[#171311]">
                <input
                  type="checkbox"
                  checked={batchForm.classIds.includes(classItem.id)}
                  onChange={() => handleBatchClassToggle(classItem.id)}
                />
                <span>{classItem.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <button className="btn-primary" type="button" onClick={handleCreateBatch}>
            新增课程批次
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {courseBatches.map((batch) => (
            <div key={batch.id} className="rounded-[26px] border border-[#ddd5cc] bg-white px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#9b7f68]">{batch.courseName}</p>
                  <h4 className="mt-2 text-xl font-semibold text-[#171311]">{batch.name}</h4>
                  <p className="mt-2 text-sm text-[#685f58]">
                    {batch.termName || "未关联学期"} · 第 {batch.startWeek} 周至第 {batch.endWeek} 周 · 模板 {batch.exportTemplateVersion}
                  </p>
                  <p className="mt-1 text-sm text-[#685f58]">
                    班级：{batch.classNames.length ? batch.classNames.join("、") : "未关联班级"}
                  </p>
                </div>
                <button
                  className="rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                  type="button"
                  onClick={() => onDeleteBatch(batch.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
