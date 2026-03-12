import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

export function CreativeTab({
  data,
  approvalText,
  editable,
  approveDisabled,
  onFieldChange,
  onSave,
  onAddPoster,
  onClearPoster,
  onApprove,
}) {
  return (
    <section className="module-shell">
      <div className="content-grid">
        <div className="content-stack">
          <section className="soft-card">
            <h2 className="section-title">创意饮品策划提交（周三）</h2>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="soft-card">
              <label className="field-label">营销计划</label>
              <textarea
                className="field-textarea"
                value={data.marketing}
                onChange={(event) => onFieldChange("marketing", event.target.value)}
                placeholder="目标人群、推广渠道、售价策略、试饮安排"
                readOnly={!editable}
              />
            </div>

            <div className="soft-card">
              <label className="field-label">饮品配方与制作方法</label>
              <textarea
                className="field-textarea"
                value={data.recipe}
                onChange={(event) => onFieldChange("recipe", event.target.value)}
                placeholder="2 款饮品配方、克数、制作步骤、标准化要点"
                readOnly={!editable}
              />
            </div>
          </div>

          <div className="soft-card">
            <label className="field-label">特殊物料采购计划</label>
            <textarea
              className="field-textarea"
              value={data.procurement}
              onChange={(event) => onFieldChange("procurement", event.target.value)}
              placeholder="品名、规格、数量、预算、采购时间、验收人"
              readOnly={!editable}
            />
          </div>

          <div className="soft-card">
            <label className="field-label">创意饮品海报上传（可多张）</label>
            <div className="guide-actions mt-4">
              <FilePickerButton buttonText="添加海报图片" disabled={!editable} onSelect={onAddPoster} />
              <button className="btn-warn" type="button" onClick={onClearPoster} disabled={!editable || !data.posters.length}>
                清空海报图片
              </button>
            </div>
            <ImagePreviewGrid images={data.posters} />
          </div>
        </div>

        <aside className="content-stack">
          <section className="guide-card">
            <h3>状态</h3>
            <p>{approvalText}</p>
          </section>

          <section className="guide-card">
            <h3>操作</h3>
            <div className="guide-actions">
              <button className="btn-good" type="button" onClick={onSave} disabled={!editable}>
                保存本模块
              </button>
              <button className="btn-primary" type="button" onClick={onApprove} disabled={approveDisabled}>
                运营经理确认本模块
              </button>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
