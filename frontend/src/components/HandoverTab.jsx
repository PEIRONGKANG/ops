import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

function InheritedDrinkCard({ drink, index }) {
  return (
    <article className="rounded-[24px] border border-[#ddd5cc] bg-white px-4 py-4">
      <p className="module-kicker">继承饮品 {index + 1}</p>
      <h3 className="panel-title mt-2">{drink.name || "未命名饮品"}</h3>
      <div className="mt-3 space-y-2 text-sm text-[#685f58]">
        <p><strong className="text-[#171311]">类型：</strong>{drink.type || "-"}</p>
        <p><strong className="text-[#171311]">创意来源：</strong>{drink.inspiration || "-"}</p>
        <p><strong className="text-[#171311]">原料清单：</strong>{drink.ingredients || "-"}</p>
        <p><strong className="text-[#171311]">配方比例：</strong>{drink.ratio || "-"}</p>
        <p><strong className="text-[#171311]">制作步骤：</strong>{drink.steps || "-"}</p>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <ImagePreviewGrid images={drink.productImages} />
        <ImagePreviewGrid images={drink.posterImages} />
      </div>
    </article>
  );
}

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
        <p className="module-kicker">Handover & Continuity</p>
        <h2 className="section-title mt-2">交接传承</h2>
      </div>

      <article className="soft-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="field-label">上一组可继承内容</p>
            <p className="mt-2 text-sm text-[#685f58]">
              {data.inheritedFrom?.groupName
                ? `${data.inheritedFrom.groupName} · ${data.inheritedFrom.weekStartDate} · ${data.inheritedFrom.studentName || "未记录组员"}`
                : "未找到上一组可继承的创意饮品数据。"}
            </p>
          </div>
          <span className="tag-pill">{data.confirmation?.status || "待确认"}</span>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {data.inheritedDrinks?.length ? (
            data.inheritedDrinks.map((drink, index) => (
              <InheritedDrinkCard key={drink.id || index} drink={drink} index={index} />
            ))
          ) : (
            <p className="status-line xl:col-span-2">上一组数据尚未形成可继承配方，当前仅保留交接说明与确认区。</p>
          )}
        </div>
      </article>

      <article className="soft-card">
        <label className="field-label">交接说明</label>
        <textarea
          className="field-textarea"
          value={data.summary}
          onChange={(event) => onFieldChange("summary", event.target.value)}
          placeholder="交接重点、遗留问题、下一组提醒"
          readOnly={!editable}
        />
      </article>

      <article className="soft-card">
        <label className="field-label">交接对象</label>
        <input
          className="field-input"
          value={data.nextGroup}
          onChange={(event) => onFieldChange("nextGroup", event.target.value)}
          placeholder="下一组同学或小组"
          readOnly={!editable}
        />
        <p className="status-line mt-3">
          确认人：{data.confirmation?.by || "-"} {data.confirmation?.time ? `· ${data.confirmation.time}` : ""}
        </p>
      </article>

      <article className="soft-card">
        <label className="field-label">交接现场图片</label>
        <div className="mt-3 flex flex-wrap gap-3">
          <FilePickerButton buttonText="上传交接图片" disabled={!editable} onSelect={onAddImages} />
          <button className="btn-primary" type="button" onClick={onApprove} disabled={approveDisabled}>
            经理确认交接
          </button>
        </div>
        <ImagePreviewGrid images={data.photos} />
      </article>

      <p className="status-line">{statusText}</p>

      <button className="btn-good" type="button" onClick={onSave} disabled={!editable}>
        保存交接记录
      </button>
    </section>
  );
}
