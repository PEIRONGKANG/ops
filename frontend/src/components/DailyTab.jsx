import { PROCESS_ITEM_DEFINITIONS } from "../lib/core";
import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

function ProcessCard({ item, process, statusText, editable, disabled, onChange, onAddImages, onApprove }) {
  return (
    <article className="soft-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="module-kicker">{item.key}</p>
          <h3 className="panel-title mt-2">{item.title}</h3>
        </div>
        {item.requiresImages ? <span className="tag-pill !bg-[#f4e3d8] !text-[#7b593f]">强制图片</span> : null}
      </div>
      <p className="status-line mt-4">{item.guidance}</p>
      <textarea
        className="field-textarea mt-4"
        value={process.execution}
        onChange={(event) => onChange("execution", event.target.value)}
        placeholder="填写当日执行情况"
        readOnly={!editable}
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <FilePickerButton buttonText="上传图片" disabled={!editable} onSelect={onAddImages} />
        <button className="btn-primary" type="button" onClick={onApprove} disabled={disabled}>
          经理确认
        </button>
      </div>
      <ImagePreviewGrid images={process.images} />
      <p className="status-line mt-3">{statusText}</p>
    </article>
  );
}

export function DailyTab({
  dailyDateOptions,
  currentDay,
  data,
  approvals,
  editable,
  approveDisabled,
  onDateChange,
  onBasicChange,
  onProcessChange,
  onAddProcessImages,
  onAddGroomingImages,
  onReceiptChange,
  onAddReceiptImages,
  onReportChange,
  onSave,
  onApprove,
}) {
  return (
    <section className="module-shell">
      <div>
        <p className="module-kicker">Practice Phase</p>
        <h2 className="section-title mt-2">13-23 项过程管理</h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <article className="soft-card">
          <label className="field-label">日期</label>
          <select className="field-input" value={currentDay} onChange={(event) => onDateChange(event.target.value)}>
            {dailyDateOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </article>
        <article className="soft-card">
          <label className="field-label">签到时间</label>
          <input className="field-input" type="time" value={data.checkIn} onChange={(event) => onBasicChange("checkIn", event.target.value)} readOnly={!editable} />
          <button className="btn-primary mt-3" type="button" onClick={() => onApprove("checkIn")} disabled={approveDisabled.checkIn}>
            经理确认
          </button>
          <p className="status-line mt-3">{approvals.checkIn}</p>
        </article>
        <article className="soft-card">
          <label className="field-label">签退时间</label>
          <input className="field-input" type="time" value={data.checkOut} onChange={(event) => onBasicChange("checkOut", event.target.value)} readOnly={!editable} />
          <button className="btn-primary mt-3" type="button" onClick={() => onApprove("checkOut")} disabled={approveDisabled.checkOut}>
            经理确认
          </button>
          <p className="status-line mt-3">{approvals.checkOut}</p>
        </article>
        <article className="soft-card">
          <label className="field-label">仪容仪表</label>
          <div className="mt-3 flex flex-wrap gap-3">
            <FilePickerButton buttonText="上传图片" disabled={!editable} onSelect={onAddGroomingImages} />
            <button className="btn-primary" type="button" onClick={() => onApprove("grooming")} disabled={approveDisabled.grooming}>
              经理确认
            </button>
          </div>
          <ImagePreviewGrid images={data.grooming} />
          <p className="status-line mt-3">{approvals.grooming}</p>
        </article>
      </div>

      <article className="soft-card">
        <div className="grid gap-4 xl:grid-cols-2">
          <textarea
            className="field-textarea"
            value={data.attendanceNote}
            onChange={(event) => onBasicChange("attendanceNote", event.target.value)}
            placeholder="出勤说明、异常情况"
            readOnly={!editable}
          />
          <textarea
            className="field-textarea"
            value={data.exceptionNote}
            onChange={(event) => onBasicChange("exceptionNote", event.target.value)}
            placeholder="迟到/异常补充说明"
            readOnly={!editable}
          />
        </div>
      </article>

      <article className="soft-card">
        <h3 className="panel-title">经营统计补充</h3>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <input className="field-input" type="number" step="0.01" value={data.sales} onChange={(event) => onBasicChange("sales", event.target.value)} placeholder="营业额" readOnly={!editable} />
          <input className="field-input" type="number" step="0.01" value={data.cost} onChange={(event) => onBasicChange("cost", event.target.value)} placeholder="成本" readOnly={!editable} />
          <input className="field-input" type="number" step="0.01" value={data.lossAmount} onChange={(event) => onBasicChange("lossAmount", event.target.value)} placeholder="损耗金额" readOnly={!editable} />
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        {PROCESS_ITEM_DEFINITIONS.map((item) => (
          <ProcessCard
            key={item.key}
            item={item}
            process={data.processes[item.key]}
            statusText={approvals.processes[item.key]}
            editable={editable}
            disabled={approveDisabled.processes[item.key]}
            onChange={(field, value) => onProcessChange(item.key, field, value)}
            onAddImages={(files) => onAddProcessImages(item.key, files)}
            onApprove={() => onApprove(item.key)}
          />
        ))}
      </div>

      <article className="soft-card">
        <p className="module-kicker">23</p>
        <h3 className="section-title mt-2 !text-[1.8rem]">每日工作报表</h3>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <textarea className="field-textarea" value={data.dailyReport.summary} onChange={(event) => onReportChange("summary", event.target.value)} placeholder="当日工作概述" readOnly={!editable} />
          <textarea className="field-textarea" value={data.dailyReport.highlights} onChange={(event) => onReportChange("highlights", event.target.value)} placeholder="当日亮点" readOnly={!editable} />
          <textarea className="field-textarea" value={data.dailyReport.issues} onChange={(event) => onReportChange("issues", event.target.value)} placeholder="问题与异常" readOnly={!editable} />
          <textarea className="field-textarea" value={data.dailyReport.followUp} onChange={(event) => onReportChange("followUp", event.target.value)} placeholder="次日跟进" readOnly={!editable} />
        </div>
      </article>

      <article className="soft-card">
        <h3 className="panel-title">货品签收</h3>
        <textarea className="field-textarea" value={data.receiptDesc} onChange={(event) => onReceiptChange("receiptDesc", event.target.value)} placeholder="签收品项、数量、签收人、时间" readOnly={!editable} />
        <div className="mt-4 flex flex-wrap gap-3">
          <FilePickerButton buttonText="上传签收图片" disabled={!editable} onSelect={onAddReceiptImages} />
          <button className="btn-primary" type="button" onClick={() => onApprove("receipt")} disabled={approveDisabled.receipt}>
            经理确认
          </button>
        </div>
        <ImagePreviewGrid images={data.receiptImgs} />
        <p className="status-line mt-3">{approvals.receipt}</p>
      </article>

      <button className="btn-good" type="button" onClick={onSave} disabled={!editable}>
        保存当日记录
      </button>
    </section>
  );
}
