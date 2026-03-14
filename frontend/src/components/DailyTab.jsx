import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

function PhotoCard({ title, children, images, footerText = "" }) {
  return (
    <div className="soft-card">
      <h3 className="panel-title">{title}</h3>
      {children}
      <ImagePreviewGrid images={images} />
      {footerText ? <p className="status-line mt-3">{footerText}</p> : null}
    </div>
  );
}

function ReviewField({ label, value, onChange, readOnly, placeholder }) {
  return (
    <div className="mt-4">
      <label className="field-label">{label}</label>
      <textarea
        className="field-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </div>
  );
}

export function DailyTab({
  dailyDateOptions,
  currentDay,
  data,
  rawEditable,
  canUploadImages,
  canEditManagerReview,
  canSaveDaily,
  managerReviewStatus,
  managerSubmitDisabled,
  onDateChange,
  onFieldChange,
  onManagerReviewFieldChange,
  onAddImages,
  onSave,
  onSubmitManagerReview,
}) {
  const managerReadOnly = !canEditManagerReview;

  return (
    <section className="module-shell">
      <div className="content-grid">
        <div className="content-stack">
          <section className="soft-card">
            <h2 className="section-title">每日打卡与运营执行</h2>
            <p className="status-line mt-3">
              {canEditManagerReview
                ? "P2 可在 P3 已提交内容的基础上调整文字/时间信息，并填写确认说明后一次性提交。"
                : "P3 负责录入原始执行内容与上传照片，P2 确认后将作为当日最终记录。"}
            </p>

            <div className="grid gap-4 mt-4 xl:grid-cols-3">
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
                <input className="field-input" type="time" value={data.checkIn} onChange={(event) => onFieldChange("checkIn", event.target.value)} readOnly={!rawEditable} />
              </div>
              <div>
                <label className="field-label">签退时间</label>
                <input className="field-input" type="time" value={data.checkOut} onChange={(event) => onFieldChange("checkOut", event.target.value)} readOnly={!rawEditable} />
              </div>
            </div>

            <p className="status-line mt-4">{managerReviewStatus}</p>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <PhotoCard
              title="仪容仪表检查照片"
              images={data.grooming}
              footerText="仪容仪表仅供 P2 查看，不需要单独填写确认说明。"
            >
              {canUploadImages ? (
                <div className="guide-actions mt-4">
                  <FilePickerButton buttonText="添加照片" disabled={!rawEditable} onSelect={(files) => onAddImages("groom", files)} />
                </div>
              ) : null}
            </PhotoCard>

            <div className="soft-card">
              <h3 className="panel-title">出勤打卡确认</h3>
              <textarea
                className="field-textarea"
                value={data.attendanceNote}
                onChange={(event) => onFieldChange("attendanceNote", event.target.value)}
                placeholder="迟到早退说明、请假情况、导师签字信息"
                readOnly={!rawEditable}
              />
              <ReviewField
                label="P2 打卡确认说明"
                value={data.managerReview.attendance}
                onChange={(value) => onManagerReviewFieldChange("attendance", value)}
                readOnly={managerReadOnly}
                placeholder="确认签到/签退真实性，记录异常处理结果"
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PhotoCard title="上班前卫生（公区/吧台）" images={[...data.openingPublic, ...data.openingBar]}>
              {canUploadImages ? (
                <div className="guide-actions mt-4">
                  <FilePickerButton buttonText="添加公区照片" disabled={!rawEditable} onSelect={(files) => onAddImages("openingPublic", files)} />
                  <FilePickerButton buttonText="添加吧台照片" disabled={!rawEditable} onSelect={(files) => onAddImages("openingBar", files)} />
                </div>
              ) : null}
              <ReviewField
                label="P2 上班前卫生确认说明"
                value={data.managerReview.opening}
                onChange={(value) => onManagerReviewFieldChange("opening", value)}
                readOnly={managerReadOnly}
                placeholder="确认公区/吧台开档卫生情况"
              />
            </PhotoCard>

            <PhotoCard title="下班后卫生（公区/吧台）" images={[...data.closingPublic, ...data.closingBar]}>
              {canUploadImages ? (
                <div className="guide-actions mt-4">
                  <FilePickerButton buttonText="添加公区照片" disabled={!rawEditable} onSelect={(files) => onAddImages("closingPublic", files)} />
                  <FilePickerButton buttonText="添加吧台照片" disabled={!rawEditable} onSelect={(files) => onAddImages("closingBar", files)} />
                </div>
              ) : null}
              <ReviewField
                label="P2 下班后卫生确认说明"
                value={data.managerReview.closing}
                onChange={(value) => onManagerReviewFieldChange("closing", value)}
                readOnly={managerReadOnly}
                placeholder="确认公区/吧台收档卫生情况"
              />
            </PhotoCard>
          </div>

          <div className="soft-card">
            <h3 className="panel-title">财务与库存盘点（含损耗、库存照片）</h3>
            <div className="grid gap-4 xl:grid-cols-3">
              <div>
                <label className="field-label">营业额（元）</label>
                <input className="field-input" type="number" step="0.01" value={data.sales} onChange={(event) => onFieldChange("sales", event.target.value)} readOnly={!rawEditable} />
              </div>
              <div>
                <label className="field-label">采购成本（元）</label>
                <input className="field-input" type="number" step="0.01" value={data.cost} onChange={(event) => onFieldChange("cost", event.target.value)} readOnly={!rawEditable} />
              </div>
              <div>
                <label className="field-label">损耗金额（元）</label>
                <input className="field-input" type="number" step="0.01" value={data.lossAmount} onChange={(event) => onFieldChange("lossAmount", event.target.value)} readOnly={!rawEditable} />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2 mt-4">
              <div>
                <label className="field-label">损耗说明</label>
                <textarea className="field-textarea" value={data.lossDesc} onChange={(event) => onFieldChange("lossDesc", event.target.value)} placeholder="原因、品项、处置" readOnly={!rawEditable} />
              </div>
              <div>
                <label className="field-label">库存盘点说明</label>
                <textarea className="field-textarea" value={data.inventoryDesc} onChange={(event) => onFieldChange("inventoryDesc", event.target.value)} placeholder="关键库存余量、缺货预警" readOnly={!rawEditable} />
              </div>
            </div>

            {canUploadImages ? (
              <div className="guide-actions mt-4">
                <FilePickerButton buttonText="添加损耗照片" disabled={!rawEditable} onSelect={(files) => onAddImages("loss", files)} />
                <FilePickerButton buttonText="添加库存照片" disabled={!rawEditable} onSelect={(files) => onAddImages("inventory", files)} />
              </div>
            ) : null}

            <ImagePreviewGrid images={[...data.lossImgs, ...data.inventoryImgs]} />
            <ReviewField
              label="P2 财务与库存确认说明"
              value={data.managerReview.finance}
              onChange={(value) => onManagerReviewFieldChange("finance", value)}
              readOnly={managerReadOnly}
              placeholder="确认损耗、库存与财务数据"
            />
          </div>

          <div className="soft-card">
            <h3 className="panel-title">学生购买创意饮品货品签收</h3>
            <textarea className="field-textarea" value={data.receiptDesc} onChange={(event) => onFieldChange("receiptDesc", event.target.value)} placeholder="签收品项、数量、签收人、时间" readOnly={!rawEditable} />
            {canUploadImages ? (
              <div className="guide-actions mt-4">
                <FilePickerButton buttonText="添加签收照片" disabled={!rawEditable} onSelect={(files) => onAddImages("receipt", files)} />
              </div>
            ) : null}
            <ImagePreviewGrid images={data.receiptImgs} />
            <ReviewField
              label="P2 签收确认说明"
              value={data.managerReview.receipt}
              onChange={(value) => onManagerReviewFieldChange("receipt", value)}
              readOnly={managerReadOnly}
              placeholder="确认签收品项、数量与凭证"
            />
          </div>

          <div className="soft-card">
            <h3 className="panel-title">当日补充说明</h3>
            <textarea className="field-textarea" value={data.notes} onChange={(event) => onFieldChange("notes", event.target.value)} placeholder="客诉、异常、改进事项" readOnly={!rawEditable} />
            <ReviewField
              label="P2 当日补充确认说明"
              value={data.managerReview.notes}
              onChange={(value) => onManagerReviewFieldChange("notes", value)}
              readOnly={managerReadOnly}
              placeholder="确认异常、补充事项与当天最终结论"
            />
          </div>

          <div className="guide-actions">
            {canSaveDaily ? (
              <button className="btn-good" type="button" onClick={onSave} disabled={!rawEditable}>
                保存当日记录
              </button>
            ) : null}
            {canEditManagerReview ? (
              <button className="btn-primary" type="button" onClick={onSubmitManagerReview} disabled={managerSubmitDisabled}>
                提交 P2 确认
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
