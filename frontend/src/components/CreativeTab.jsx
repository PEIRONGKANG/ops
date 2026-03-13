import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

function ProcurementTotal({ items }) {
  const total = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  return <span className="tag-pill !bg-[#f4e3d8] !text-[#7b593f]">合计 {total.toFixed(2)} 元</span>;
}

export function CreativeTab({
  data,
  approvalText,
  editable,
  approveDisabled,
  onSurveyChange,
  onAddSurveyImages,
  onDrinkChange,
  onAddDrinkImages,
  onAddPoster,
  onClearPoster,
  onProcurementItemChange,
  onAddProcurementItem,
  onRemoveProcurementItem,
  onSave,
  onApprove,
}) {
  return (
    <section className="module-shell">
      <div>
        <p className="module-kicker">Preparation Phase</p>
        <h2 className="section-title mt-2">准备期提交</h2>
      </div>

      <article className="soft-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <label className="field-label">问卷设计与调研统计</label>
            <p className="mt-2 text-sm text-[#685f58]">录入问卷题目、样本量、结果摘要与分析结论。</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <textarea
            className="field-textarea"
            value={data.survey.questions}
            onChange={(event) => onSurveyChange("questions", event.target.value)}
            placeholder="问卷题目、选项、调研对象"
            readOnly={!editable}
          />
          <div className="space-y-4">
            <input
              className="field-input"
              value={data.survey.sampleSize}
              onChange={(event) => onSurveyChange("sampleSize", event.target.value)}
              placeholder="样本量"
              readOnly={!editable}
            />
            <textarea
              className="field-textarea"
              value={data.survey.resultSummary}
              onChange={(event) => onSurveyChange("resultSummary", event.target.value)}
              placeholder="调研结果摘要"
              readOnly={!editable}
            />
          </div>
        </div>
        <textarea
          className="field-textarea mt-4"
          value={data.survey.analysis}
          onChange={(event) => onSurveyChange("analysis", event.target.value)}
          placeholder="分析结论、产品机会点、目标人群判断"
          readOnly={!editable}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <FilePickerButton buttonText="上传调研截图" disabled={!editable} onSelect={onAddSurveyImages} />
        </div>
        <ImagePreviewGrid images={data.survey.resultImages} />
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.drinks.map((drink, index) => (
          <article key={drink.id || index} className="soft-card">
            <p className="module-kicker">Drink {index + 1}</p>
            <h3 className="panel-title mt-2">创意饮品 {index + 1}</h3>
            <div className="mt-4 grid gap-3">
              <input
                className="field-input"
                value={drink.name}
                onChange={(event) => onDrinkChange(index, "name", event.target.value)}
                placeholder="饮品名称"
                readOnly={!editable}
              />
              <input
                className="field-input"
                value={drink.type}
                onChange={(event) => onDrinkChange(index, "type", event.target.value)}
                placeholder="饮品类型"
                readOnly={!editable}
              />
              <textarea
                className="field-textarea"
                value={drink.inspiration}
                onChange={(event) => onDrinkChange(index, "inspiration", event.target.value)}
                placeholder="创意来源"
                readOnly={!editable}
              />
              <textarea
                className="field-textarea"
                value={drink.ingredients}
                onChange={(event) => onDrinkChange(index, "ingredients", event.target.value)}
                placeholder="原料清单"
                readOnly={!editable}
              />
              <textarea
                className="field-textarea"
                value={drink.ratio}
                onChange={(event) => onDrinkChange(index, "ratio", event.target.value)}
                placeholder="配方比例"
                readOnly={!editable}
              />
              <textarea
                className="field-textarea"
                value={drink.steps}
                onChange={(event) => onDrinkChange(index, "steps", event.target.value)}
                placeholder="制作步骤"
                readOnly={!editable}
              />
              <textarea
                className="field-textarea"
                value={drink.specialMaterials}
                onChange={(event) => onDrinkChange(index, "specialMaterials", event.target.value)}
                placeholder="特殊物料需求"
                readOnly={!editable}
              />
              <textarea
                className="field-textarea"
                value={drink.notes}
                onChange={(event) => onDrinkChange(index, "notes", event.target.value)}
                placeholder="备注"
                readOnly={!editable}
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div>
                <div className="flex flex-wrap gap-3">
                  <FilePickerButton
                    buttonText="上传成品图"
                    disabled={!editable}
                    onSelect={(files) => onAddDrinkImages(index, "productImages", files)}
                  />
                </div>
                <ImagePreviewGrid images={drink.productImages} />
              </div>
              <div>
                <div className="flex flex-wrap gap-3">
                  <FilePickerButton
                    buttonText="上传海报图"
                    disabled={!editable}
                    onSelect={(files) => onAddDrinkImages(index, "posterImages", files)}
                  />
                </div>
                <ImagePreviewGrid images={drink.posterImages} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <article className="soft-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label className="field-label">特殊物料清单</label>
            <p className="mt-2 text-sm text-[#685f58]">支持名称、规格、数量、单价和金额小计。</p>
          </div>
          <ProcurementTotal items={data.procurementItems} />
        </div>
        <div className="mt-4 space-y-3">
          {data.procurementItems.map((item, index) => (
            <div key={`item-${index}`} className="rounded-[24px] border border-[#ddd5cc] bg-white px-4 py-4">
              <div className="grid gap-3 xl:grid-cols-6">
                <input className="field-input" value={item.name} onChange={(event) => onProcurementItemChange(index, "name", event.target.value)} placeholder="名称" readOnly={!editable} />
                <input className="field-input" value={item.spec} onChange={(event) => onProcurementItemChange(index, "spec", event.target.value)} placeholder="规格" readOnly={!editable} />
                <input className="field-input" value={item.quantity} onChange={(event) => onProcurementItemChange(index, "quantity", event.target.value)} placeholder="数量" readOnly={!editable} />
                <input className="field-input" value={item.unitPrice} onChange={(event) => onProcurementItemChange(index, "unitPrice", event.target.value)} placeholder="单价" readOnly={!editable} />
                <input className="field-input" value={item.subtotal} onChange={(event) => onProcurementItemChange(index, "subtotal", event.target.value)} placeholder="金额小计" readOnly />
                <button className="btn-warn" type="button" onClick={() => onRemoveProcurementItem(index)} disabled={!editable}>
                  删除
                </button>
              </div>
              <textarea
                className="field-textarea mt-3"
                value={item.notes}
                onChange={(event) => onProcurementItemChange(index, "notes", event.target.value)}
                placeholder="备注"
                readOnly={!editable}
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button className="btn-secondary" type="button" onClick={onAddProcurementItem} disabled={!editable}>
            新增物料项
          </button>
        </div>
      </article>

      <article className="soft-card">
        <label className="field-label">电子海报</label>
        <div className="mt-3 flex flex-wrap gap-3">
          <FilePickerButton buttonText="上传海报" disabled={!editable} onSelect={onAddPoster} />
          <button className="btn-warn" type="button" onClick={onClearPoster} disabled={!editable || !data.posters.length}>
            清空海报
          </button>
        </div>
        <ImagePreviewGrid images={data.posters} />
      </article>

      <div className="flex flex-wrap gap-3">
        <button className="btn-good" type="button" onClick={onSave} disabled={!editable}>
          保存准备期
        </button>
        <button className="btn-primary" type="button" onClick={onApprove} disabled={approveDisabled}>
          运营经理确认
        </button>
      </div>

      <p className="status-line">{approvalText}</p>
    </section>
  );
}
