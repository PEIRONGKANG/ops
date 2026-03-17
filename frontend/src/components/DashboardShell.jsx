import { LoginPanel } from "./LoginPanel";
import { Sidebar } from "./Sidebar";
import { TabNav } from "./TabNav";

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

export function DashboardShell({
  loggedIn,
  dashboardDate,
  statusLabel,
  pageTitle,
  pageSubtitle,
  dashboardStats,
  reminderItems,
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
  loginProps,
}) {
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

          <section className="ops-public-grid">
            <article className="ops-panel ops-reminder-panel">
              <div className="ops-panel-head">
                <div>
                  <p className="ops-kicker">Teacher Focus</p>
                  <h3>带教教师工作提醒</h3>
                </div>
                <span className="ops-chip">Teacher Focus</span>
              </div>
              <div className="ops-reminder-grid">
                {reminderItems.map((item) => (
                  <div key={item.label} className="ops-reminder-item">
                    <span className="ops-reminder-checkbox" />
                    <span>{item.label}</span>
                    {item.alert ? <i className="ops-reminder-alert" aria-hidden="true" /> : null}
                  </div>
                ))}
              </div>
            </article>

            <LoginPanel {...loginProps} />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="ops-shell ops-shell-auth">
      <aside className="ops-sidebar no-print">
        <div className="ops-sidebar-top">
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

          <TabNav items={tabItems} activeTab={activeTab} onChange={onTabChange} orientation="vertical" />
        </div>

        <div className="ops-sidebar-bottom">
          <Sidebar {...sidebarProps} />
        </div>
      </aside>

      <main className="ops-main">
        <div className="ops-main-inner">
          <header className="ops-page-header">
            <div>
              <h2 className="ops-page-title">{pageTitle}</h2>
              <p className="ops-page-date">{dashboardDate}</p>
              <p className="ops-page-subtitle">{pageSubtitle}</p>
            </div>
            <span className="ops-status-badge">{statusLabel}</span>
          </header>

          <section className="ops-stat-grid">
            <DashboardStats items={dashboardStats} />
          </section>

          <section className="ops-panel ops-reminder-panel">
            <div className="ops-panel-head">
              <div>
                <p className="ops-kicker">Teacher Focus</p>
                <h3>带教教师工作提醒</h3>
              </div>
              <span className="ops-chip">Teacher Focus</span>
            </div>
            <div className="ops-reminder-grid">
              {reminderItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="ops-reminder-item"
                  onClick={() => onTabChange(item.tab)}
                >
                  <span className="ops-reminder-checkbox" />
                  <span>{item.label}</span>
                  {item.alert ? <i className="ops-reminder-alert" aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </section>

          <section className="ops-content-grid">
            <article className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <p className="ops-kicker">To-do</p>
                  <h3>待办事项</h3>
                </div>
              </div>

              <div className="ops-todo-list">
                {todoItems.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="ops-todo-item"
                    onClick={() => {
                      if (typeof item.onClick === "function") {
                        item.onClick();
                        return;
                      }
                      if (item.tab) onTabChange(item.tab);
                    }}
                  >
                    <span className={`ops-todo-icon ${item.tone ? `tone-${item.tone}` : ""}`} />
                    <span className="ops-todo-copy">
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                    </span>
                  </button>
                ))}
              </div>
            </article>

            <article className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <p className="ops-kicker">Activity</p>
                  <h3>运营动态</h3>
                </div>
                <button className="ops-link-button" type="button" onClick={onLoadWeek}>
                  + 加载本周
                </button>
              </div>

              <div className="ops-activity-list">
                {activityItems.map((item) => (
                  <div key={item.label} className="ops-activity-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="ops-panel ops-workbench">
            <div className="ops-panel-head">
              <div>
                <p className="ops-kicker">Workbench</p>
                <h3>{activeTabLabel}</h3>
              </div>
              <div className="ops-action-row no-print">
                <button className="btn-primary" type="button" onClick={onLoadWeek}>
                  加载/创建本周
                </button>
                <button className="btn-secondary" type="button" onClick={onPreviewReport} disabled={!canPreviewReport}>
                  预览周报
                </button>
              </div>
            </div>

            <div className="ops-inline-tabs no-print">
              <TabNav items={tabItems} activeTab={activeTab} onChange={onTabChange} />
            </div>

            <div className="ops-workbench-body">
              {moduleContent}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
