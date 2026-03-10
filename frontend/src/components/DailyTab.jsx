import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

function PhotoCard({ title, children, images, statusText }) {
  return (
    <div className="soft-card">
      <h3 className="panel-title">{title}</h3>
      {children}
      <ImagePreviewGrid images={images} />
      <p className="status-line mt-3">{statusText}</p>
    </div>
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
  onFieldChange,
  onAddImages,
  onSave,
  onApprove,
}) {
  return (
    <section className="space-y-4">
      <h2 className="section-title">每日打卡与运营执行</h2>
      <img src="/assets/hygiene-ai.svg" alt="AI卫生检查图" className="h-48 w-full rounded-[24px] border border-stone-300 object-cover" />

      <div className="grid gap-4 xl:grid-cols-3">
        <div>
          <label className="field-label">选择日期</label>
          <select className="field-input" value={currentDay} onChange={(event) => onDateChange(event.target.value)}>
            {dailyDateOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">签到时间</label>
          <input className="field-input" type="time" value={data.checkIn} onChange={(event) => onFieldChange("checkIn", event.target.value)} readOnly={!editable} />
        </div>
        <div>
          <label className="field-label">签退时间</label>
          <input className="field-input" type="time" value={data.checkOut} onChange={(event) => onFieldChange("checkOut", event.target.value)} readOnly={!editable} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PhotoCard title="仪容仪表检查照片" images={data.grooming} statusText={approvals.grooming}>
          <div className="mt-3 flex flex-wrap gap-3">
            <FilePickerButton buttonText="添加照片" disabled={!editable} onSelect={(files) => onAddImages("groom", files)} />
            <button className="btn-primary" type="button" onClick={() => onApprove("grooming")} disabled={approveDisabled.grooming}>
              经理确认
            </button>
          </div>
        </PhotoCard>

        <div className="soft-card">
          <h3 className="panel-title">出勤打卡确认</h3>
          <textarea
            className="field-textarea"
            value={data.attendanceNote}
            onChange={(event) => onFieldChange("attendanceNote", event.target.value)}
            placeholder="迟到早退说明、请假情况、导师签字信息"
            readOnly={!editable}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={() => onApprove("checkIn")} disabled={approveDisabled.checkIn}>
              运营经理确认签到
            </button>
            <button className="btn-primary" type="button" onClick={() => onApprove("checkOut")} disabled={approveDisabled.checkOut}>
              运营经理确认签退
            </button>
          </div>
          <p className="status-line mt-3">{approvals.checkIn}</p>
          <p className="status-line mt-3">{approvals.checkOut}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PhotoCard title="上班前卫生（公区/吧台）" images={[...data.openingPublic, ...data.openingBar]} statusText={approvals.opening}>
          <div className="mt-3 flex flex-wrap gap-3">
            <FilePickerButton buttonText="添加公区照片" disabled={!editable} onSelect={(files) => onAddImages("openingPublic", files)} />
            <FilePickerButton buttonText="添加吧台照片" disabled={!editable} onSelect={(files) => onAddImages("openingBar", files)} />
            <button className="btn-primary" type="button" onClick={() => onApprove("opening")} disabled={approveDisabled.opening}>
              经理确认
            </button>
          </div>
        </PhotoCard>

        <PhotoCard title="下班后卫生（公区/吧台）" images={[...data.closingPublic, ...data.closingBar]} statusText={approvals.closing}>
          <div className="mt-3 flex flex-wrap gap-3">
            <FilePickerButton buttonText="添加公区照片" disabled={!editable} onSelect={(files) => onAddImages("closingPublic", files)} />
            <FilePickerButton buttonText="添加吧台照片" disabled={!editable} onSelect={(files) => onAddImages("closingBar", files)} />
            <button className="btn-primary" type="button" onClick={() => onApprove("closing")} disabled={approveDisabled.closing}>
              经理确认
            </button>
          </div>
        </PhotoCard>
      </div>

      <div className="soft-card">
        <h3 className="panel-title">财务与库存盘点（含损耗、库存照片）</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <div>
            <label className="field-label">营业额（元）</label>
            <input className="field-input" type="number" step="0.01" value={data.sales} onChange={(event) => onFieldChange("sales", event.target.value)} readOnly={!editable} />
          </div>
          <div>
            <label className="field-label">采购成本（元）</label>
            <input className="field-input" type="number" step="0.01" value={data.cost} onChange={(event) => onFieldChange("cost", event.target.value)} readOnly={!editable} />
          </div>
          <div>
            <label className="field-label">损耗金额（元）</label>
            <input className="field-input" type="number" step="0.01" value={data.lossAmount} onChange={(event) => onFieldChange("lossAmount", event.target.value)} readOnly={!editable} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div>
            <label className="field-label">损耗说明</label>
            <textarea className="field-textarea" value={data.lossDesc} onChange={(event) => onFieldChange("lossDesc", event.target.value)} placeholder="原因、品项、处置" readOnly={!editable} />
          </div>
          <div>
            <label className="field-label">库存盘点说明</label>
            <textarea className="field-textarea" value={data.inventoryDesc} onChange={(event) => onFieldChange("inventoryDesc", event.target.value)} placeholder="关键库存余量、缺货预警" readOnly={!editable} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <FilePickerButton buttonText="添加损耗照片" disabled={!editable} onSelect={(files) => onAddImages("loss", files)} />
          <FilePickerButton buttonText="添加库存照片" disabled={!editable} onSelect={(files) => onAddImages("inventory", files)} />
          <button className="btn-primary" type="button" onClick={() => onApprove("finance")} disabled={approveDisabled.finance}>
            经理确认
          </button>
        </div>

        <ImagePreviewGrid images={[...data.lossImgs, ...data.inventoryImgs]} />
        <p className="status-line mt-3">{approvals.finance}</p>
      </div>

      <div className="soft-card">
        <h3 className="panel-title">学生购买创意饮品货品签收</h3>
        <textarea className="field-textarea" value={data.receiptDesc} onChange={(event) => onFieldChange("receiptDesc", event.target.value)} placeholder="签收品项、数量、签收人、时间" readOnly={!editable} />
        <div className="mt-3 flex flex-wrap gap-3">
          <FilePickerButton buttonText="添加签收照片" disabled={!editable} onSelect={(files) => onAddImages("receipt", files)} />
          <button className="btn-primary" type="button" onClick={() => onApprove("receipt")} disabled={approveDisabled.receipt}>
            经理确认
          </button>
        </div>
        <ImagePreviewGrid images={data.receiptImgs} />
        <p className="status-line mt-3">{approvals.receipt}</p>
      </div>

      <div>
        <label className="field-label">当日补充说明</label>
        <textarea className="field-textarea" value={data.notes} onChange={(event) => onFieldChange("notes", event.target.value)} placeholder="客诉、异常、改进事项" readOnly={!editable} />
      </div>

      <button className="btn-good" type="button" onClick={onSave} disabled={!editable}>
        保存当日记录
      </button>
    </section>
  );
}
