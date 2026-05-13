function TabIcon({ tabKey }) {
  switch (tabKey) {
    case "training_tasks":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 6v6l4 2" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "training_progress":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 3v18h18" />
          <path d="m7 14 3-3 4 4 6-7" />
        </svg>
      );
    case "completion_matrix":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 3h18v18H3z" />
          <path d="M3 9h18" />
          <path d="M3 15h18" />
          <path d="M9 3v18" />
          <path d="M15 3v18" />
        </svg>
      );
    case "trainee_guide":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 17A2.5 2.5 0 0 0 4 14.5V5a2 2 0 0 1 2-2h14v14" />
        </svg>
      );
    case "creative":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v18" />
          <path d="M5 9h14" />
          <path d="M7 3h10v18H7z" />
        </svg>
      );
    case "daily":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 4V2" />
          <path d="M15 4V2" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "handover":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 3h5v5" />
          <path d="m21 3-7 7" />
          <path d="M8 21H3v-5" />
          <path d="m3 21 7-7" />
          <path d="M14 14 10 10" />
        </svg>
      );
    case "reflection":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 17A2.5 2.5 0 0 0 4 14.5V5a2 2 0 0 1 2-2h14v14" />
        </svg>
      );
    case "accounts":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

export function TabNav({ items, activeTab, onChange, orientation = "horizontal" }) {
  const navClassName = [
    "tab-nav",
    orientation === "vertical" ? "is-vertical" : "",
    orientation === "mobile" ? "is-mobile" : "",
  ].filter(Boolean).join(" ");

  return (
    <nav className={navClassName} aria-label="Module navigation">
      <div className="tab-nav-track">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeTab === item.key ? "tab-button active" : "tab-button"}
            onClick={() => onChange(item.key)}
            aria-current={activeTab === item.key ? "page" : undefined}
          >
            <span className="tab-icon">
              <TabIcon tabKey={item.key} />
            </span>
            <span className="tab-label">
            {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
