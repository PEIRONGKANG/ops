import { useMemo, useState } from "react";
import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

const MAX_HANDOVER_STUDENTS = 2;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function formatStudentOption(student) {
  const name = normalizeText(student.displayName) || normalizeText(student.username);
  const no = normalizeText(student.username);
  return no && no !== name ? `${name}（${no}）` : name;
}

function splitHandoverTokens(value) {
  return normalizeText(value)
    .split(/[、,，;；\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveSelectedStudents(value, students) {
  const seen = new Set();
  return splitHandoverTokens(value)
    .map((token) => {
      const normalized = token.replace(/[（）()]/g, "");
      return students.find((student) => {
        const username = normalizeText(student.username);
        const displayName = normalizeText(student.displayName);
        const label = formatStudentOption(student);
        return (
          token === username
          || token === displayName
          || token === label
          || normalized === `${displayName}${username}`
          || normalized === `${username}${displayName}`
        );
      });
    })
    .filter((student) => {
      if (!student || seen.has(student.username)) return false;
      seen.add(student.username);
      return true;
    })
    .slice(0, MAX_HANDOVER_STUDENTS);
}

export function HandoverTab({
  data,
  statusText,
  editable,
  approveDisabled,
  onFieldChange,
  onAddImages,
  onSave,
  onApprove,
  studentUsers = [],
}) {
  const [query, setQuery] = useState("");
  const selectedStudents = useMemo(
    () => resolveSelectedStudents(data.nextGroup, studentUsers),
    [data.nextGroup, studentUsers],
  );
  const selectedUsernames = useMemo(
    () => new Set(selectedStudents.map((student) => student.username)),
    [selectedStudents],
  );
  const normalizedQuery = normalizeText(query).toLowerCase();
  const candidateStudents = useMemo(() => {
    if (!editable || selectedStudents.length >= MAX_HANDOVER_STUDENTS) return [];
    return studentUsers
      .filter((student) => !selectedUsernames.has(student.username))
      .filter((student) => {
        if (!normalizedQuery) return true;
        const haystack = [
          student.username,
          student.displayName,
          formatStudentOption(student),
        ].join(" ").toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [editable, normalizedQuery, selectedStudents.length, selectedUsernames, studentUsers]);
  const unresolvedText = selectedStudents.length ? "" : normalizeText(data.nextGroup);

  function commitStudents(nextStudents) {
    onFieldChange("nextGroup", nextStudents.map(formatStudentOption).join("、"));
  }

  function addStudent(student) {
    if (!editable || selectedStudents.length >= MAX_HANDOVER_STUDENTS) return;
    commitStudents([...selectedStudents, student].slice(0, MAX_HANDOVER_STUDENTS));
    setQuery("");
  }

  function removeStudent(username) {
    if (!editable) return;
    commitStudents(selectedStudents.filter((student) => student.username !== username));
  }

  return (
    <section className="module-shell">
      <div>
        <p className="module-kicker">Next Wednesday Transition</p>
        <h2 className="section-title mt-2">次周周三交接班</h2>
      </div>

      <div className="module-banner-strip">
        <div>
          <p className="module-kicker">Handover Continuity</p>
          <p className="mt-3 max-w-2xl text-sm leading-7">
            将本周运营情况、遗留问题、下一组提醒和现场交接凭证统一沉淀，保证轮值切换流畅且可追溯。
          </p>
        </div>
      </div>

      <div className="soft-card">
        <label className="field-label">交接说明</label>
        <textarea
          className="field-textarea"
          value={data.summary}
          onChange={(event) => onFieldChange("summary", event.target.value)}
          placeholder="本周运营情况、问题清单、下周提醒"
          readOnly={!editable}
        />
      </div>

      <div className="soft-card">
        <label className="field-label">交接对象（下一组同学）</label>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {selectedStudents.length ? (
              selectedStudents.map((student) => (
                <span key={student.username} className="tag-pill gap-2">
                  {formatStudentOption(student)}
                  {editable ? (
                    <button
                      className="text-slate-400 transition hover:text-rose-600"
                      type="button"
                      onClick={() => removeStudent(student.username)}
                      aria-label={`移除 ${formatStudentOption(student)}`}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))
            ) : (
              <span className="status-pill is-quiet">尚未选择交接对象</span>
            )}
          </div>

          {unresolvedText ? (
            <p className="status-line">
              当前原始记录：{unresolvedText}。请从下方学生名单中重新选择，保存后将转换为标准格式。
            </p>
          ) : null}

          <input
            className="field-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              selectedStudents.length >= MAX_HANDOVER_STUDENTS
                ? "最多选择 2 位同学"
                : "输入姓名或学号查询下一组同学"
            }
            readOnly={!editable || selectedStudents.length >= MAX_HANDOVER_STUDENTS}
          />

          {editable ? (
            <div className="flex flex-wrap gap-2">
              {candidateStudents.length ? (
                candidateStudents.map((student) => (
                  <button
                    key={student.username}
                    className="pill-chip transition hover:border-emerald-300 hover:bg-emerald-50"
                    type="button"
                    onClick={() => addStudent(student)}
                  >
                    {formatStudentOption(student)}
                  </button>
                ))
              ) : (
                <span className="status-pill is-quiet">
                  {selectedStudents.length >= MAX_HANDOVER_STUDENTS ? "已达到 2 位上限" : "未找到匹配学生"}
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="soft-card">
        <label className="field-label">交接现场照片（可多张）</label>
        <div className="mt-3 flex flex-wrap gap-3">
          <FilePickerButton buttonText="添加交接照片" disabled={!editable} onSelect={onAddImages} />
          <button className="btn-primary" type="button" onClick={onApprove} disabled={approveDisabled}>
            经理确认交接
          </button>
        </div>
        <ImagePreviewGrid images={data.photos} />
      </div>

      <p className="status-line">{statusText}</p>

      <button className="btn-good" type="button" onClick={onSave} disabled={!editable}>
        保存交接记录
      </button>
    </section>
  );
}
