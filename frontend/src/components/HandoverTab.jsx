import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

export function HandoverTab({
  data,
  statusText,
  editable,
  approveDisabled,
  onFieldChange,
  onAddImages,
  onSave,
  onApprove,
}) {
  return (
    <section className="module-shell">
      <div className="content-grid">
        <div className="content-stack">
          <section className="soft-card">
            <h2 className="section-title">次周周三交接班</h2>
          </section>

          <div className="soft-card">
            <label className="field-label">交接说明</label>
            <textarea
              className="field-textarea"
              value={data.summary}
              onChange={(event) => onFieldChange("summary", event.target.value)}
              placeholder="本周运营情况、问题清单、下周提醒"
              readOnly={!editable}
            />
          </div>

          <div className="soft-card">
            <label className="field-label">交接对象（下一组同学）</label>
            <input
              className="field-input"
              value={data.nextGroup}
              onChange={(event) => onFieldChange("nextGroup", event.target.value)}
              placeholder="交接对象姓名或账号"
              readOnly={!editable}
            />
          </div>

          <div className="soft-card">
            <label className="field-label">交接现场照片（可多张）</label>
            <div className="guide-actions mt-4">
              <FilePickerButton buttonText="添加交接照片" disabled={!editable} onSelect={onAddImages} />
              <button className="btn-primary" type="button" onClick={onApprove} disabled={approveDisabled}>
                经理确认交接
              </button>
            </div>
            <ImagePreviewGrid images={data.photos} />
          </div>

          <button className="btn-good" type="button" onClick={onSave} disabled={!editable}>
            保存交接记录
          </button>
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
