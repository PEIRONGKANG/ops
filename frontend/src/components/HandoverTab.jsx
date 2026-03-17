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
      <div>
        <p className="module-kicker">Next Wednesday Transition</p>
        <h2 className="section-title mt-2">次周周三交接班</h2>
      </div>

      <div className="module-banner-strip">
        <div>
          <p className="module-kicker">Handover Continuity</p>
          <p className="mt-3 max-w-2xl text-sm leading-7">
            将本周运营情况、遗留问题、下一组提醒和现场交接凭证统一沉淀，保证轮值切换流畅且可追溯。
          </p>
        </div>
      </div>

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
        <div className="mt-3 flex flex-wrap gap-3">
          <FilePickerButton buttonText="添加交接照片" disabled={!editable} onSelect={onAddImages} />
          <button className="btn-primary" type="button" onClick={onApprove} disabled={approveDisabled}>
            经理确认交接
          </button>
        </div>
        <ImagePreviewGrid images={data.photos} />
      </div>

      <p className="status-line">{statusText}</p>

      <button className="btn-good" type="button" onClick={onSave} disabled={!editable}>
        保存交接记录
      </button>
    </section>
  );
}
