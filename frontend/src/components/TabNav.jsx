export function TabNav({ items, activeTab, onChange }) {
  return (
    <nav className="tab-nav" aria-label="辅助导航">
      <div className="tab-nav-track">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeTab === item.key ? "tab-button active" : "tab-button"}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
