export function TabNav({ items, activeTab, onChange }) {
  return (
    <div className="no-print flex flex-wrap gap-2">
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
  );
}
