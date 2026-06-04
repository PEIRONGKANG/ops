import { useEffect, useMemo, useState } from "react";

import { api } from "../services/api";

const SLOT_OPTIONS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

function todayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function endSlot(start) {
  const hour = Number(String(start || "").split(":")[0] || 0);
  return `${String(hour + 2).padStart(2, "0")}:00`;
}

function bySlot(assignments) {
  return Object.fromEntries((assignments || []).map((item) => [`${item.studentUsername}::${item.slotStart}`, item]));
}

function statusText(currentUser) {
  if (currentUser?.level === "P1") return "P1 可维护岗位名称，并可协助 P2 完成定岗。";
  if (currentUser?.level === "P2") return "P2 可按日期和 2 小时时段给 P3 学生定岗。";
  if (currentUser?.level === "T1") return "T1 可查看学生岗位安排。";
  return "你可以查看本人当天的岗位与时间段安排。";
}

export function JobAssignmentTab({ currentUser, studentUsers = [] }) {
  const [positions, setPositions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [workDate, setWorkDate] = useState(todayValue());
  const [studentUsername, setStudentUsername] = useState(studentUsers[0]?.username || "");
  const [slotStart, setSlotStart] = useState("08:00");
  const [positionId, setPositionId] = useState("");
  const [note, setNote] = useState("");
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionDesc, setNewPositionDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const canManagePositions = currentUser?.level === "P1";
  const canAssign = ["P1", "P2"].includes(currentUser?.level);
  const canViewAll = ["P1", "T1", "P2"].includes(currentUser?.level);
  const visibleStudents = canViewAll ? studentUsers : studentUsers.filter((user) => user.username === currentUser?.username);
  const assignmentMap = useMemo(() => bySlot(assignments), [assignments]);

  const loadData = async (date = workDate) => {
    setBusy(true);
    setError(false);
    try {
      const [positionResp, assignmentResp] = await Promise.all([
        api.listJobPositions(),
        api.listJobAssignments({ workDate: date }),
      ]);
      const nextPositions = positionResp?.positions || [];
      setPositions(nextPositions);
      setAssignments(assignmentResp?.assignments || []);
      if (!positionId && nextPositions[0]) setPositionId(nextPositions[0].id);
      setMessage("岗位安排已同步。");
    } catch (err) {
      setError(true);
      setMessage(err.message || "岗位数据加载失败。");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!studentUsername && studentUsers[0]?.username) setStudentUsername(studentUsers[0].username);
  }, [studentUsername, studentUsers]);

  useEffect(() => {
    loadData(workDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workDate]);

  const handleCreatePosition = async () => {
    if (!newPositionName.trim()) {
      setError(true);
      setMessage("请先填写岗位名称。");
      return;
    }
    setBusy(true);
    try {
      await api.createJobPosition({ name: newPositionName.trim(), description: newPositionDesc.trim(), isActive: true, sortOrder: positions.length + 1 });
      setNewPositionName("");
      setNewPositionDesc("");
      await loadData(workDate);
      setError(false);
      setMessage("岗位名称已新增。P2 可以用于定岗。");
    } catch (err) {
      setError(true);
      setMessage(err.message || "新增岗位失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePosition = async (position) => {
    setBusy(true);
    try {
      await api.updateJobPosition(position.id, { ...position, isActive: !position.isActive });
      await loadData(workDate);
      setError(false);
      setMessage(position.isActive ? "岗位已停用。" : "岗位已启用。");
    } catch (err) {
      setError(true);
      setMessage(err.message || "岗位状态修改失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!studentUsername || !positionId) {
      setError(true);
      setMessage("请选择学生和岗位。");
      return;
    }
    setBusy(true);
    try {
      await api.saveJobAssignment({ studentUsername, workDate, slotStart, positionId, note });
      await loadData(workDate);
      setError(false);
      setMessage(`已保存 ${slotStart}-${endSlot(slotStart)} 的岗位安排。`);
    } catch (err) {
      setError(true);
      setMessage(err.message || "保存定岗失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    if (!assignment?.id) return;
    setBusy(true);
    try {
      await api.deleteJobAssignment(assignment.id);
      await loadData(workDate);
      setError(false);
      setMessage("已清除该时段定岗。 ");
    } catch (err) {
      setError(true);
      setMessage(err.message || "清除定岗失败。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="module-shell job-assignment-shell">
      <div className="soft-card job-assignment-hero">
        <div>
          <p className="module-kicker">岗位定岗</p>
          <h2 className="section-title mt-2">P3 岗位与 2 小时时段安排</h2>
          <p className="status-line mt-3">{statusText(currentUser)}</p>
        </div>
        <div className="job-date-box">
          <label className="field-label">定岗日期</label>
          <input className="field-input" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
        </div>
      </div>

      {message ? <p className={error ? "status-line status-error" : "status-line"}>{message}</p> : null}

      {canManagePositions ? (
        <div className="soft-card job-position-manager">
          <div>
            <p className="module-kicker">P1 设置</p>
            <h3>岗位名称库</h3>
          </div>
          <div className="job-position-form">
            <input className="field-input" value={newPositionName} onChange={(event) => setNewPositionName(event.target.value)} placeholder="新增岗位名称，例如：物料补给" />
            <input className="field-input" value={newPositionDesc} onChange={(event) => setNewPositionDesc(event.target.value)} placeholder="岗位说明，可选" />
            <button className="btn-primary" type="button" onClick={handleCreatePosition} disabled={busy}>新增岗位</button>
          </div>
          <div className="job-position-list">
            {positions.map((position) => (
              <button key={position.id} type="button" className={position.isActive ? "job-position-chip" : "job-position-chip is-off"} onClick={() => handleTogglePosition(position)} disabled={busy}>
                <strong>{position.name}</strong>
                <span>{position.isActive ? "启用中" : "已停用"}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canAssign ? (
        <div className="soft-card job-assignment-form">
          <div>
            <p className="module-kicker">P2 每日定岗</p>
            <h3>选择学生、时段与岗位</h3>
          </div>
          <div className="job-form-grid">
            <label>
              <span>学生</span>
              <select className="field-input" value={studentUsername} onChange={(event) => setStudentUsername(event.target.value)}>
                {studentUsers.map((student) => <option key={student.username} value={student.username}>{student.displayName || student.username}（{student.username}）</option>)}
              </select>
            </label>
            <label>
              <span>2 小时时段</span>
              <select className="field-input" value={slotStart} onChange={(event) => setSlotStart(event.target.value)}>
                {SLOT_OPTIONS.map((slot) => <option key={slot} value={slot}>{slot}-{endSlot(slot)}</option>)}
              </select>
            </label>
            <label>
              <span>岗位</span>
              <select className="field-input" value={positionId} onChange={(event) => setPositionId(event.target.value)}>
                {positions.filter((position) => position.isActive).map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
              </select>
            </label>
            <label>
              <span>说明</span>
              <input className="field-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：14 点后重点补杯盖" />
            </label>
          </div>
          <button className="btn-primary" type="button" onClick={handleSaveAssignment} disabled={busy}>保存定岗</button>
        </div>
      ) : null}

      <div className="soft-card job-matrix-card">
        <div className="job-matrix-head">
          <div>
            <p className="module-kicker">当日安排</p>
            <h3>{canViewAll ? "学生 × 时段岗位矩阵" : "我的岗位安排"}</h3>
          </div>
          <button className="btn-secondary" type="button" onClick={() => loadData(workDate)} disabled={busy}>刷新</button>
        </div>

        <div className="job-matrix-scroll">
          <table className="job-matrix-table">
            <thead>
              <tr>
                <th>学生</th>
                {SLOT_OPTIONS.map((slot) => <th key={slot}>{slot}-{endSlot(slot)}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.username}>
                  <td><strong>{student.displayName || student.username}</strong><small>{student.username}</small></td>
                  {SLOT_OPTIONS.map((slot) => {
                    const assignment = assignmentMap[`${student.username}::${slot}`];
                    return (
                      <td key={slot}>
                        {assignment ? (
                          <div className="job-slot-card">
                            <strong>{assignment.positionName}</strong>
                            {assignment.note ? <span>{assignment.note}</span> : null}
                            {canAssign ? <button type="button" onClick={() => handleDeleteAssignment(assignment)} disabled={busy}>清除</button> : null}
                          </div>
                        ) : <span className="job-empty">未定岗</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
