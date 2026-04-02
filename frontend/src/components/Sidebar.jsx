export function Sidebar({
  currentUser,
  roleLabel,
  sessionInfo,
  canViewAllScopes,
  studentUsers,
  activeScopeUser,
  weekStart,
  weekEnd,
  teachingWeekOptions,
  teachingWeek,
  groupHint,
  memberA,
  memberB,
  nextGroup,
  hasWeek,
  canSaveGroup,
  canExportReport,
  busy,
  onScopeChange,
  onWeekStartChange,
  onLoadWeek,
  onLogout,
  onTeachingWeekChange,
  onGroupChange,
  onSaveGroup,
  onExportWord,
  onPreviewReport,
  statusMessage,
  statusError,
  editable,
}) {
  return (
    <aside className="panel-card sidebar-shell no-print h-fit">
      <div className="sidebar-hero">
        <p className="panel-eyebrow">Current Session</p>
        <h3>当前状态</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="tag-pill">
            {currentUser ? `${currentUser.displayName} (${currentUser.username})` : "未登录"}
          </span>
          <span className="tag-pill">{roleLabel || "角色未识别"}</span>
        </div>
        <p className="status-line mt-4 border-white/10 bg-white/8 text-white/82">{sessionInfo}</p>
      </div>

      <div className="sidebar-section">
        {canViewAllScopes ? (
          <div>
            <label className="field-label">查看学员数据</label>
            <select className="field-input" value={activeScopeUser} onChange={(event) => onScopeChange(event.target.value)} disabled={busy || !studentUsers.length}>
              {studentUsers.map((user) => (
                <option key={user.username} value={user.username}>
                  {`${user.displayName}（${user.username}）`}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={`grid gap-3 ${canViewAllScopes ? "mt-4" : ""}`}>
          <div>
            <label className="field-label">轮值开始（周三）</label>
            <input className="field-input" type="date" value={weekStart} onChange={(event) => onWeekStartChange(event.target.value)} disabled={busy} />
          </div>
          <div>
            <label className="field-label">轮值结束</label>
            <input className="field-input" value={weekEnd} readOnly />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" type="button" onClick={onLoadWeek} disabled={busy}>
            加载/创建本周
          </button>
          <button className="btn-secondary" type="button" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </div>

      <div className="sidebar-section space-y-3">
        <div>
          <p className="panel-eyebrow">Weekly Group</p>
          <h3 className="panel-title mt-2">分组信息</h3>
        </div>
        <div>
          <label className="field-label">教学周次（按轮值表）</label>
          <select className="field-input" value={teachingWeek} onChange={(event) => onTeachingWeekChange(event.target.value)} disabled={busy || !editable || !hasWeek}>
            {teachingWeekOptions.map((item) => (
              <option key={item.value || "manual"} value={item.value}>
                {item.text}
              </option>
            ))}
          </select>
        </div>
        <p className="status-line">{groupHint}</p>

        <div>
          <label className="field-label">本周学员 A</label>
          <input className="field-input" value={memberA} onChange={(event) => onGroupChange("memberA", event.target.value)} placeholder="姓名或账号" readOnly={!editable || !hasWeek} />
        </div>

        <div>
          <label className="field-label">本周学员 B</label>
          <input className="field-input" value={memberB} onChange={(event) => onGroupChange("memberB", event.target.value)} placeholder="姓名或账号" readOnly={!editable || !hasWeek} />
        </div>

        <div>
          <label className="field-label">下一组交接人（周三）</label>
          <input className="field-input" value={nextGroup} onChange={(event) => onGroupChange("nextGroup", event.target.value)} placeholder="下一位同学" readOnly={!editable || !hasWeek} />
        </div>

        <button className="btn-good w-full" type="button" onClick={onSaveGroup} disabled={busy || !canSaveGroup}>
          保存分组
        </button>
      </div>

      <div className="sidebar-section">
        <p className="panel-eyebrow">Reports</p>
        <h3 className="panel-title mt-2">导出与预览</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" type="button" onClick={onExportWord} disabled={busy || !canExportReport}>
            导出周报 Word
          </button>
          <button className="btn-secondary" type="button" onClick={onPreviewReport} disabled={busy || !canExportReport}>
            预览/打印周报
          </button>
        </div>
      </div>

      <p className={`status-line mt-4 ${statusError ? "border-rose-200 bg-rose-50 text-rose-700" : ""}`}>
        {statusMessage}
      </p>
    </aside>
  );
}
