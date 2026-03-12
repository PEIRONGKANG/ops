export function ReflectionTab({
  data,
  statusText,
  editable,
  canApprove,
  approveDisabled,
  saveLabel,
  onFieldChange,
  onSave,
  onApprove,
}) {
  return (
    <section className="module-shell">
      <div className="content-grid">
        <div className="content-stack">
          <section className="soft-card">
            <h2 className="section-title">总结与反思（周结束）</h2>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="soft-card">
              <label className="field-label">学员 A 自评与收获</label>
              <textarea className="field-textarea" value={data.a} onChange={(event) => onFieldChange("a", event.target.value)} readOnly={!editable} />
            </div>

            <div className="soft-card">
              <label className="field-label">学员 B 自评与收获</label>
              <textarea className="field-textarea" value={data.b} onChange={(event) => onFieldChange("b", event.target.value)} readOnly={!editable} />
            </div>
          </div>

          <div className="soft-card">
            <label className="field-label">门店运营优化与建议方案（小组）</label>
            <textarea className="field-textarea" value={data.optPlan} onChange={(event) => onFieldChange("optPlan", event.target.value)} readOnly={!editable} />
          </div>

          <div className="soft-card">
            <label className="field-label">运营经理结语</label>
            <textarea className="field-textarea" value={data.managerComment} onChange={(event) => onFieldChange("managerComment", event.target.value)} readOnly={!canApprove} />
          </div>

          <div className="guide-actions">
            <button className="btn-good" type="button" onClick={onSave} disabled={!editable && !canApprove}>
              {saveLabel}
            </button>
            <button className="btn-primary" type="button" onClick={onApprove} disabled={approveDisabled}>
              经理最终确认
            </button>
          </div>
        </div>

        <aside className="content-stack">
          <section className="guide-card">
            <h3>状态</h3>
            <p>{statusText}</p>
          </section>
        </aside>
      </div>
    </section>
  );
}
