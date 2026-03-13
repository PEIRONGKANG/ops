import { useState } from "react";

const DEFAULT_GROUP_FORM = {
  batchId: "",
  name: "",
  sequence: "",
  handoverGroupId: "",
};

const DEFAULT_MEMBER_FORM = {
  groupId: "",
  studentUsername: "",
};

const DEFAULT_SCHEDULE_FORM = {
  batchId: "",
  teachingWeek: "",
  weekStartDate: "",
  primaryGroupId: "",
  secondaryGroupId: "",
  notes: "",
};

function trimText(value) {
  return String(value || "").trim();
}

export function SchedulingTab({
  courseBatches,
  groups,
  groupMembers,
  scheduleAssignments,
  students,
  onCreateGroup,
  onDeleteGroup,
  onCreateGroupMember,
  onDeleteGroupMember,
  onCreateScheduleAssignment,
  onDeleteScheduleAssignment,
}) {
  const [groupForm, setGroupForm] = useState(DEFAULT_GROUP_FORM);
  const [memberForm, setMemberForm] = useState(DEFAULT_MEMBER_FORM);
  const [scheduleForm, setScheduleForm] = useState(DEFAULT_SCHEDULE_FORM);

  const membersByGroupId = {};
  groupMembers.forEach((item) => {
    if (!membersByGroupId[item.groupId]) membersByGroupId[item.groupId] = [];
    membersByGroupId[item.groupId].push(item);
  });

  const groupsByBatchId = {};
  groups.forEach((item) => {
    if (!groupsByBatchId[item.batchId]) groupsByBatchId[item.batchId] = [];
    groupsByBatchId[item.batchId].push(item);
  });

  const availableGroupsForSchedule = groups.filter((item) => String(item.batchId) === String(scheduleForm.batchId));
  const availableGroupsForHandover = groups.filter((item) => String(item.batchId) === String(groupForm.batchId));

  const handleCreateGroup = async () => {
    await onCreateGroup({
      batchId: Number(groupForm.batchId),
      name: trimText(groupForm.name),
      sequence: Number(groupForm.sequence),
      handoverGroupId: groupForm.handoverGroupId ? Number(groupForm.handoverGroupId) : null,
    });
    setGroupForm(DEFAULT_GROUP_FORM);
  };

  const handleCreateGroupMember = async () => {
    await onCreateGroupMember({
      groupId: Number(memberForm.groupId),
      studentUsername: trimText(memberForm.studentUsername),
    });
    setMemberForm(DEFAULT_MEMBER_FORM);
  };

  const handleCreateSchedule = async () => {
    await onCreateScheduleAssignment({
      batchId: Number(scheduleForm.batchId),
      teachingWeek: trimText(scheduleForm.teachingWeek),
      weekStartDate: trimText(scheduleForm.weekStartDate),
      primaryGroupId: Number(scheduleForm.primaryGroupId),
      secondaryGroupId: scheduleForm.secondaryGroupId ? Number(scheduleForm.secondaryGroupId) : null,
      notes: trimText(scheduleForm.notes),
    });
    setScheduleForm(DEFAULT_SCHEDULE_FORM);
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <article className="soft-card">
          <p className="module-kicker">Group Setup</p>
          <h3 className="section-title mt-2">分组</h3>
          <div className="mt-5 grid gap-3">
            <select
              className="field-input"
              value={groupForm.batchId}
              onChange={(event) => setGroupForm((current) => ({ ...current, batchId: event.target.value, handoverGroupId: "" }))}
            >
              <option value="">选择课程批次</option>
              {courseBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="field-input"
                value={groupForm.name}
                onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="分组名称"
              />
              <input
                className="field-input"
                type="number"
                min="1"
                value={groupForm.sequence}
                onChange={(event) => setGroupForm((current) => ({ ...current, sequence: event.target.value }))}
                placeholder="轮值顺序"
              />
            </div>
            <select
              className="field-input"
              value={groupForm.handoverGroupId}
              onChange={(event) => setGroupForm((current) => ({ ...current, handoverGroupId: event.target.value }))}
            >
              <option value="">选择下一组</option>
              {availableGroupsForHandover.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5">
            <button className="btn-primary" type="button" onClick={handleCreateGroup}>
              新增分组
            </button>
          </div>
          <div className="mt-6 space-y-4">
            {courseBatches.map((batch) => (
              <div key={batch.id} className="rounded-[24px] border border-[#ddd5cc] bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#9b7f68]">批次</p>
                    <h4 className="mt-2 text-lg font-semibold text-[#171311]">{batch.name}</h4>
                  </div>
                  <span className="tag-pill">{(groupsByBatchId[batch.id] || []).length} 组</span>
                </div>
                <div className="mt-4 space-y-3">
                  {(groupsByBatchId[batch.id] || []).map((group) => (
                    <div key={group.id} className="rounded-[20px] border border-[#e4ddd6] bg-[#fbfaf8] px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <strong className="text-[#171311]">{group.name}</strong>
                          <p className="mt-1 text-sm text-[#685f58]">
                            顺序 {group.sequence} · 下一组 {group.handoverGroupName || "未设置"}
                          </p>
                        </div>
                        <button
                          className="rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                          type="button"
                          onClick={() => onDeleteGroup(group.id)}
                        >
                          删除
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(membersByGroupId[group.id] || []).map((member) => (
                          <span key={member.id} className="tag-pill !bg-[#f4e3d8] !text-[#7b593f]">
                            {member.studentName}（{member.studentUsername}）
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="soft-card">
          <p className="module-kicker">Member Binding</p>
          <h3 className="section-title mt-2">组员绑定</h3>
          <div className="mt-5 grid gap-3">
            <select
              className="field-input"
              value={memberForm.groupId}
              onChange={(event) => setMemberForm((current) => ({ ...current, groupId: event.target.value }))}
            >
              <option value="">选择分组</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.batchName} / {group.name}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={memberForm.studentUsername}
              onChange={(event) => setMemberForm((current) => ({ ...current, studentUsername: event.target.value }))}
            >
              <option value="">选择学生账号</option>
              {students.map((student) => (
                <option key={student.username} value={student.username}>
                  {student.displayName}（{student.username}）
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5">
            <button className="btn-primary" type="button" onClick={handleCreateGroupMember}>
              绑定组员
            </button>
          </div>
          <div className="mt-6 space-y-3">
            {groupMembers.map((member) => (
              <div key={member.id} className="rounded-[22px] border border-[#ddd5cc] bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong className="text-[#171311]">{member.studentName}</strong>
                    <p className="mt-1 text-sm text-[#685f58]">
                      {member.groupName} · {member.studentUsername}
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                    type="button"
                    onClick={() => onDeleteGroupMember(member.id)}
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
        <p className="module-kicker">Schedule Assignment</p>
        <h3 className="section-title mt-2">轮值排班</h3>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <select
            className="field-input"
            value={scheduleForm.batchId}
            onChange={(event) => setScheduleForm((current) => ({
              ...current,
              batchId: event.target.value,
              primaryGroupId: "",
              secondaryGroupId: "",
            }))}
          >
            <option value="">选择课程批次</option>
            {courseBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <input
            className="field-input"
            value={scheduleForm.teachingWeek}
            onChange={(event) => setScheduleForm((current) => ({ ...current, teachingWeek: event.target.value }))}
            placeholder="教学周次，如第15周"
          />
          <input
            className="field-input"
            type="date"
            value={scheduleForm.weekStartDate}
            onChange={(event) => setScheduleForm((current) => ({ ...current, weekStartDate: event.target.value }))}
          />
          <select
            className="field-input"
            value={scheduleForm.primaryGroupId}
            onChange={(event) => setScheduleForm((current) => ({ ...current, primaryGroupId: event.target.value }))}
          >
            <option value="">本周轮值组</option>
            {availableGroupsForSchedule.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <select
            className="field-input"
            value={scheduleForm.secondaryGroupId}
            onChange={(event) => setScheduleForm((current) => ({ ...current, secondaryGroupId: event.target.value }))}
          >
            <option value="">交接组（可选）</option>
            {availableGroupsForSchedule.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <input
            className="field-input"
            value={scheduleForm.notes}
            onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="备注"
          />
        </div>
        <div className="mt-5">
          <button className="btn-primary" type="button" onClick={handleCreateSchedule}>
            新增排班
          </button>
        </div>
        <div className="mt-6 space-y-3">
          {scheduleAssignments.map((assignment) => (
            <div key={assignment.id} className="rounded-[24px] border border-[#ddd5cc] bg-white px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#9b7f68]">{assignment.batchName}</p>
                  <h4 className="mt-2 text-lg font-semibold text-[#171311]">
                    {assignment.teachingWeek} · {assignment.weekStartDate || "未设置日期"}
                  </h4>
                  <p className="mt-2 text-sm text-[#685f58]">
                    本周轮值：{assignment.primaryGroupName}
                    {assignment.secondaryGroupName ? ` · 交接组：${assignment.secondaryGroupName}` : ""}
                  </p>
                  {assignment.notes ? (
                    <p className="mt-1 text-sm text-[#685f58]">备注：{assignment.notes}</p>
                  ) : null}
                </div>
                <button
                  className="rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                  type="button"
                  onClick={() => onDeleteScheduleAssignment(assignment.id)}
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
