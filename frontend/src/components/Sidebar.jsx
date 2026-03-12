import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faFileArrowDown,
  faMugHot,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

export function Sidebar({
  currentUser,
  roleLabel,
  sessionInfo,
  navSections,
  activePage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
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
    <>
      <button
        type="button"
        aria-label="关闭导航"
        className={mobileOpen ? "sidebar-backdrop open" : "sidebar-backdrop"}
        onClick={onCloseMobile}
      />

      <aside className={mobileOpen ? "shell-sidebar open" : "shell-sidebar"}>
        <div className="shell-sidebar-inner">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">
              <FontAwesomeIcon icon={faMugHot} />
            </div>
            <div>
              <h2>饮品运营</h2>
            </div>
          </div>

          <div className="sidebar-session">
            <p className="panel-eyebrow">{currentUser ? "当前账号" : "未登录"}</p>
            <div className="sidebar-session-head">
              <span className="tag-pill">{currentUser ? `${currentUser.displayName} (${currentUser.username})` : "未登录"}</span>
              <span className="tag-pill">{roleLabel || "访客"}</span>
            </div>
            <p className="status-line mt-3">{sessionInfo}</p>
          </div>

          <nav aria-label="主导航" className="shell-nav">
            {navSections.map((section) => (
              <section key={section.title} className="shell-nav-group">
                <p className="shell-nav-heading">{section.title}</p>
                <div className="shell-nav-list">
                  {section.items.map((item) => {
                    const active = activePage === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={active ? "shell-nav-item active" : "shell-nav-item"}
                        disabled={item.disabled}
                        onClick={() => {
                          if (item.disabled) return;
                          onNavigate(item.key);
                        }}
                      >
                        <span className="shell-nav-icon">
                          <FontAwesomeIcon icon={item.icon} />
                        </span>
                        <span className="shell-nav-copy">
                          <strong>{item.label}</strong>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          {currentUser ? (
            <>
              <section className="sidebar-panel">
                <div className="guide-card-head">
                  <FontAwesomeIcon icon={faUsers} />
                  <h3>周次与查看范围</h3>
                </div>

                {canViewAllScopes ? (
                  <div className="field-stack">
                    <label className="field-label">查看学员数据</label>
                    <select className="field-input" value={activeScopeUser} onChange={(event) => onScopeChange(event.target.value)} disabled={!studentUsers.length}>
                      {studentUsers.map((user) => (
                        <option key={user.username} value={user.username}>
                          {user.displayName}（{user.username}）
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="field-stack">
                  <label className="field-label">轮值起始日（周三）</label>
                  <input className="field-input" type="date" value={weekStart} onChange={(event) => onWeekStartChange(event.target.value)} />
                </div>

                <div className="field-stack">
                  <label className="field-label">轮值结束日</label>
                  <input className="field-input" value={weekEnd} readOnly />
                </div>

                <div className="guide-actions">
                  <button className="btn-primary" type="button" onClick={onLoadWeek}>
                    加载/创建本周
                  </button>
                  <button className="btn-secondary" type="button" onClick={onLogout}>
                    退出登录
                  </button>
                </div>
              </section>

              <section className="sidebar-panel">
                <div className="guide-card-head">
                  <FontAwesomeIcon icon={faBookOpen} />
                  <h3>分组信息</h3>
                </div>

                <div className="field-stack">
                  <label className="field-label">教学周次（按提供的分组名单）</label>
                  <select className="field-input" value={teachingWeek} onChange={(event) => onTeachingWeekChange(event.target.value)} disabled={!editable || !hasWeek}>
                    {teachingWeekOptions.map((item) => (
                      <option key={item.value || "manual"} value={item.value}>
                        {item.text}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="status-line">{groupHint}</p>

                <div className="field-stack">
                  <label className="field-label">本周学员 A</label>
                  <input className="field-input" value={memberA} onChange={(event) => onGroupChange("memberA", event.target.value)} placeholder="姓名或账号" readOnly={!editable || !hasWeek} />
                </div>

                <div className="field-stack">
                  <label className="field-label">本周学员 B</label>
                  <input className="field-input" value={memberB} onChange={(event) => onGroupChange("memberB", event.target.value)} placeholder="姓名或账号" readOnly={!editable || !hasWeek} />
                </div>

                <div className="field-stack">
                  <label className="field-label">下一组交接人（周三）</label>
                  <input className="field-input" value={nextGroup} onChange={(event) => onGroupChange("nextGroup", event.target.value)} placeholder="下一位同学" readOnly={!editable || !hasWeek} />
                </div>

                <button className="btn-good w-full" type="button" onClick={onSaveGroup} disabled={!canSaveGroup}>
                  保存分组
                </button>
              </section>

              <section className="sidebar-panel">
                <div className="guide-card-head">
                  <FontAwesomeIcon icon={faFileArrowDown} />
                  <h3>导出与状态</h3>
                </div>

                <div className="guide-actions">
                  <button className="btn-secondary" type="button" onClick={onPreviewReport} disabled={!canExportReport}>
                    预览/打印周报
                  </button>
                  <button className="btn-primary" type="button" onClick={onExportWord} disabled={!canExportReport}>
                    导出周报 Word
                  </button>
                </div>

                <p className={statusError ? "status-line status-line-error" : "status-line"}>
                  {statusMessage}
                </p>
              </section>
            </>
          ) : (
            <section className="sidebar-panel">
              <p className="status-line">请先登录后操作。</p>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
