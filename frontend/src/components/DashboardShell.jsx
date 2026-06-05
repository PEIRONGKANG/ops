import { LoginPanel } from "./LoginPanel";
import { TabNav } from "./TabNav";
import { TeacherNoticeBoard } from "./TeacherNoticeBoard";

const NAV_ICON_MAP = {
  prototype_overview: "⌂",
  prototype_attendance: "◷",
  prototype_inventory: "▦",
  prototype_finance: "¥",
  prototype_students: "◎",
  job_assignments: "▣",
  my_history: "◴",
  leader_dashboard: "⌂",
  supervisor_dashboard: "◎",
  manager_dashboard: "◉",
  training_tasks: "◷",
  training_progress: "↗",
  completion_matrix: "▦",
  trainee_guide: "☰",
  semester_management: "◌",
  accounts: "☷",
  creative: "✦",
  daily: "▣",
  handover: "⇄",
  reflection: "✓",
};

function DashboardStats({ items }) {
  return (
    <>
      {items.map((item) => (
        <article key={item.label} className={`ops-stat-card ${item.tone ? `tone-${item.tone}` : ""}`}>
          <div className="ops-stat-head">
            <p>{item.label}</p>
            <span className="ops-stat-icon" aria-hidden="true" />
          </div>
          <strong>{item.value}</strong>
          <small>{item.meta}</small>
        </article>
      ))}
    </>
  );
}

function PrototypeSidebar({ tabItems, activeTab, onTabChange, sidebarProps }) {
  const currentUser = sidebarProps?.currentUser;
  const roleLabel = sidebarProps?.roleLabel || "角色未识别";
  const displayName = currentUser?.displayName || currentUser?.username || "未登录";

  return (
    <aside className="prototype-sidebar no-print" aria-label="主导航">
      <div className="prototype-brand">
        <span className="prototype-brand-mark">训</span>
        <div>
          <strong>综合实训</strong>
          <small>学生工作状态中心</small>
        </div>
      </div>

      <nav className="prototype-nav">
        {tabItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeTab === item.key ? "prototype-nav-item active" : "prototype-nav-item"}
            onClick={() => onTabChange(item.key)}
            aria-current={activeTab === item.key ? "page" : undefined}
          >
            <span>{NAV_ICON_MAP[item.key] || "•"}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="prototype-sidebar-card prototype-sidebar-controls">
        <small>当前会话</small>
        <strong>{displayName}</strong>
        <span>{roleLabel}</span>

        <div className="prototype-control-group">
          <label>教学周次</label>
          <select
            value={sidebarProps?.teachingWeek || ""}
            onChange={(event) => sidebarProps?.onTeachingWeekChange?.(event.target.value)}
            disabled={sidebarProps?.busy}
          >
            {(sidebarProps?.teachingWeekOptions || []).map((item) => (
              <option key={item.value || "manual"} value={item.value}>{item.text}</option>
            ))}
          </select>
        </div>

        {sidebarProps?.canViewAllScopes ? (
          <div className="prototype-control-group">
            <label>查看学生</label>
            <select
              value={sidebarProps?.activeScopeUser || ""}
              onChange={(event) => sidebarProps?.onScopeChange?.(event.target.value)}
              disabled={sidebarProps?.busy || !(sidebarProps?.studentUsers || []).length}
            >
              {(sidebarProps?.studentUsers || []).map((user) => (
                <option key={user.username} value={user.username}>{`${user.displayName || user.username}（${user.username}）`}</option>
              ))}
            </select>
          </div>
        ) : null}

        {sidebarProps?.groupedStudentUsers?.length ? (
          <div className="prototype-group-chips">
            {sidebarProps.groupedStudentUsers.map((user) => (
              <button
                key={user.username}
                type="button"
                className={sidebarProps.activeScopeUser === user.username ? "is-active" : ""}
                onClick={() => sidebarProps?.onScopeChange?.(user.username)}
                disabled={sidebarProps?.busy}
              >
                <span>{user.groupLabel}</span>
                <strong>{user.displayName}</strong>
              </button>
            ))}
          </div>
        ) : null}

        <p className="prototype-sidebar-hint">{sidebarProps?.groupHint || sidebarProps?.sessionInfo}</p>
        <button type="button" className="prototype-logout" onClick={sidebarProps?.onLogout}>退出登录</button>
      </div>
    </aside>
  );
}

function PrototypeTaskFlow({ todoItems }) {
  return (
    <section className="prototype-panel prototype-wide prototype-task-panel">
      <div className="prototype-panel-head">
        <div>
          <p className="ops-kicker">今日进度</p>
          <h2>实训任务流</h2>
        </div>
        <div className="prototype-segmented" aria-label="任务过滤">
          <button type="button" className="active">全部</button>
          <button type="button">待跟进</button>
          <button type="button">已完成</button>
        </div>
      </div>

      <div className="prototype-timeline">
        {todoItems.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className="prototype-task-card"
            onClick={() => {
              if (typeof item.onClick === "function") {
                item.onClick();
                return;
              }
            }}
          >
            <span className="prototype-task-index">{index + 1}</span>
            <span className="prototype-task-copy">
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </span>
            <em className={`prototype-tag ${item.tone || "info"}`}>{item.tone === "emerald" ? "进行中" : item.tone === "indigo" ? "待确认" : "可处理"}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function PrototypeStatusPanel({ activityItems }) {
  return (
    <section className="prototype-panel prototype-status-panel">
      <div className="prototype-panel-head">
        <div>
          <p className="ops-kicker">班级状态</p>
          <h2>运行分布</h2>
        </div>
      </div>
      <div className="prototype-donut" aria-label="完成度概览">
        <span>82%</span>
      </div>
      <div className="prototype-legend">
        {activityItems.map((item, index) => (
          <span key={item.label}>
            <i className={index === 0 ? "purple" : index === 1 ? "blue" : "pink"} />
            {item.label}：{item.value}
          </span>
        ))}
      </div>
    </section>
  );
}

export function DashboardShell({
  loggedIn,
  dashboardDate,
  statusLabel,
  pageTitle,
  pageSubtitle,
  dashboardStats,
  noticeBoardProps,
  todoItems,
  activityItems,
  publicNavItems,
  tabItems,
  activeTab,
  activeTabLabel,
  onTabChange,
  sidebarProps,
  moduleContent,
  onLoadWeek,
  onPreviewReport,
  canPreviewReport,
  busy,
  loginProps,
}) {
  const isPrototypeTab = String(activeTab || "").startsWith("prototype_");

  if (!loggedIn) {
    return (
      <div className="ops-shell ops-shell-public">
        <main className="ops-public">
          <section className="ops-public-hero">
            <div className="ops-brand">
              <div className="ops-brand-mark" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="ops-brand-copy">
                <h1>OpsMaster</h1>
                <p>TRAINING BASE</p>
              </div>
            </div>

            <div className="ops-public-copy">
              <p className="ops-kicker">Operations Dashboard</p>
              <h2 className="ops-page-title">{pageTitle}</h2>
              <p className="ops-page-subtitle">{pageSubtitle}</p>
              <div className="ops-pill-row">
                {publicNavItems.map((item) => (
                  <span key={item} className="ops-pill">{item}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="ops-stat-grid">
            <DashboardStats items={dashboardStats} />
          </section>

          <section className="ops-public-command-strip" aria-label="快捷入口">
            <strong>快速进入：</strong>
            <button type="button" onClick={() => document.querySelector(".login-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}>账号登录</button>
            <button type="button" onClick={() => document.querySelector(".ops-public-grid")?.scrollIntoView({ behavior: "smooth", block: "start" })}>查看带教留言</button>
            <button type="button" onClick={() => document.querySelector(".login-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}>双人协同</button>
          </section>

          <section className="ops-public-grid">
            <TeacherNoticeBoard {...noticeBoardProps} loggedIn={false} />
            <LoginPanel {...loginProps} />
          </section>

          <footer className="ops-footer-legal no-print">
            <p>Copyright © 裴荣康 保留所有权利</p>
            <p>
              <a href="https://beian.miit.gov.cn/#/Integrated/index" target="_blank" rel="noreferrer">
                苏ICP备2026030758号-1
              </a>
            </p>
            <p>若在使用过程中遇到填报、系统故障等问题，欢迎及时联系反馈。</p>
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="ops-shell ops-shell-auth prototype-shell">
      <PrototypeSidebar
        tabItems={tabItems}
        activeTab={activeTab}
        onTabChange={onTabChange}
        sidebarProps={sidebarProps}
      />

      <main className="prototype-main">
        <header className="prototype-topbar">
          <div>
            <p className="ops-kicker">{dashboardDate}</p>
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
          <div className="prototype-top-actions no-print">
            <span className="ops-status-badge">{statusLabel}</span>
            <button className="btn-secondary" type="button" onClick={onPreviewReport} disabled={busy || !canPreviewReport}>导出日报</button>
            <button className="btn-primary" type="button" onClick={() => onTabChange("prototype_attendance")} disabled={busy}>今日签到</button>
          </div>
        </header>

        <section className="prototype-stat-strip" aria-label="关键状态">
          <DashboardStats items={dashboardStats} />
        </section>

        <section className="prototype-notice-line" aria-label="需要处理">
          <strong>需要处理：</strong>
          {todoItems.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => {
                if (typeof item.onClick === "function") item.onClick();
                else if (item.tab) onTabChange(item.tab);
              }}
            >
              {item.title}
            </button>
          ))}
        </section>

        {isPrototypeTab ? (
          <section className="prototype-linked-stage">
            {moduleContent}
          </section>
        ) : (
          <>
            <section className="prototype-work-grid">
              <PrototypeTaskFlow todoItems={todoItems} />
              <PrototypeStatusPanel activityItems={activityItems} />
            </section>

            <TeacherNoticeBoard {...noticeBoardProps} loggedIn />

            <section className="prototype-panel prototype-workbench">
              <div className="prototype-panel-head">
                <div>
                  <p className="ops-kicker">Workbench</p>
                  <h2>{activeTabLabel}</h2>
                </div>
                <div className="ops-action-row no-print">
                  <button className="btn-primary" type="button" onClick={onLoadWeek} disabled={busy}>加载/创建本周</button>
                  <button className="btn-secondary" type="button" onClick={onPreviewReport} disabled={busy || !canPreviewReport}>预览周报</button>
                </div>
              </div>

              <div className="ops-inline-tabs no-print">
                <TabNav items={tabItems} activeTab={activeTab} onChange={onTabChange} />
              </div>

              <div className="ops-workbench-body">
                {moduleContent}
              </div>
            </section>
          </>
        )}

        <footer className="ops-footer-legal no-print">
          <p>Copyright © 裴荣康 保留所有权利</p>
          <p>
            <a href="https://beian.miit.gov.cn/#/Integrated/index" target="_blank" rel="noreferrer">
              苏ICP备2026030758号-1
            </a>
          </p>
          <p>若在使用过程中遇到填报、系统故障等问题，欢迎及时联系反馈。</p>
        </footer>
      </main>
    </div>
  );
}
