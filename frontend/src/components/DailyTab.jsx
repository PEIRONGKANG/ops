import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

function StatusBlock({ title, managerStatus, studentStatus }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="status-line">{title}：{managerStatus}</p>
      <p className="status-line">P3回签：{studentStatus}</p>
    </div>
  );
}

function ReviewBox({
  label,
  noteValue,
  notePlaceholder,
  noteEditable,
  managerStatus,
  studentStatus,
  managerButtonLabel,
  managerButtonDisabled,
  studentButtonDisabled,
  showManagerButton,
  showStudentButton,
  onNoteChange,
  onManagerSubmit,
  onStudentConfirm,
}) {
  return (
    <div className="review-card">
      <label className="field-label">{label}</label>
      <textarea
        className="field-textarea"
        value={noteValue}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder={notePlaceholder}
        readOnly={!noteEditable}
      />
      <div className="mt-3 flex flex-wrap gap-3">
        {showManagerButton ? (
          <button className="btn-primary" type="button" onClick={onManagerSubmit} disabled={managerButtonDisabled}>
            {managerButtonLabel}
          </button>
        ) : null}
        {showStudentButton ? (
          <button className="btn-secondary" type="button" onClick={onStudentConfirm} disabled={studentButtonDisabled}>
            P3确认通过
          </button>
        ) : null}
      </div>
      <StatusBlock title="P2确认状态" managerStatus={managerStatus} studentStatus={studentStatus} />
    </div>
  );
}

function PhotoCard({
  title,
  images,
  children,
  reviewBox,
}) {
  return (
    <div className="soft-card">
      <h3 className="panel-title">{title}</h3>
      {children}
      <ImagePreviewGrid images={images} />
      {reviewBox}
    </div>
  );
}

export function DailyTab({
  dailyDateOptions,
  currentDay,
  data,
  approvals,
  studentConfirmations,
  editable,
  reviewerMode,
  studentReviewMode,
  managerSubmitDisabled,
  studentConfirmDisabled,
  onDateChange,
  onFieldChange,
  onManagerNoteChange,
  onAddImages,
  onSave,
  onManagerSubmit,
  onStudentConfirm,
}) {
  const showStudentSave = editable;

  return (
    <section className="module-shell">
      <div>
        <p className="module-kicker">Daily Operations & Execution</p>
        <h2 className="section-title mt-2">每日打卡与运营执行</h2>
      </div>
      <img src="/assets/hygiene-ai.svg" alt="AI卫生检查图" className="module-banner" />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="soft-card">
          <label className="field-label">选择日期</label>
          <select className="field-input" value={currentDay} onChange={(event) => onDateChange(event.target.value)}>
            {dailyDateOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="soft-card">
          <label className="field-label">签到时间</label>
          <input className="field-input" type="time" value={data.checkIn} onChange={(event) => onFieldChange("checkIn", event.target.value)} readOnly={!editable} />
        </div>
        <div className="soft-card">
          <label className="field-label">签退时间</label>
          <input className="field-input" type="time" value={data.checkOut} onChange={(event) => onFieldChange("checkOut", event.target.value)} readOnly={!editable} />
        </div>
      </div>

      <div className="soft-card">
        <h3 className="panel-title">学生打卡内容</h3>
        <textarea
          className="field-textarea"
          value={data.attendanceNote}
          onChange={(event) => onFieldChange("attendanceNote", event.target.value)}
          placeholder="迟到早退说明、请假情况、导师签字信息"
          readOnly={!editable}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <ReviewBox
            label="P2签到确认说明"
            noteValue={data.managerNotes.checkIn}
            notePlaceholder="填写签到真实性、考勤核验情况与确认意见"
            noteEditable={reviewerMode}
            managerStatus={approvals.checkIn}
            studentStatus={studentConfirmations.checkIn}
            managerButtonLabel="提交签到确认"
            managerButtonDisabled={managerSubmitDisabled.checkIn}
            studentButtonDisabled={studentConfirmDisabled.checkIn}
            showManagerButton={reviewerMode}
            showStudentButton={studentReviewMode}
            onNoteChange={(value) => onManagerNoteChange("checkIn", value)}
            onManagerSubmit={() => onManagerSubmit("checkIn")}
            onStudentConfirm={() => onStudentConfirm("checkIn")}
          />
          <ReviewBox
            label="P2签退确认说明"
            noteValue={data.managerNotes.checkOut}
            notePlaceholder="填写签退真实性、离岗情况与确认意见"
            noteEditable={reviewerMode}
            managerStatus={approvals.checkOut}
            studentStatus={studentConfirmations.checkOut}
            managerButtonLabel="提交签退确认"
            managerButtonDisabled={managerSubmitDisabled.checkOut}
            studentButtonDisabled={studentConfirmDisabled.checkOut}
            showManagerButton={reviewerMode}
            showStudentButton={studentReviewMode}
            onNoteChange={(value) => onManagerNoteChange("checkOut", value)}
            onManagerSubmit={() => onManagerSubmit("checkOut")}
            onStudentConfirm={() => onStudentConfirm("checkOut")}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PhotoCard
          title="仪容仪表检查照片"
          images={data.grooming}
          reviewBox={(
            <ReviewBox
              label="P2仪容仪表确认说明"
              noteValue={data.managerNotes.grooming}
              notePlaceholder="填写仪容仪表核验结果"
              noteEditable={reviewerMode}
              managerStatus={approvals.grooming}
              studentStatus={studentConfirmations.grooming}
              managerButtonLabel="提交仪容确认"
              managerButtonDisabled={managerSubmitDisabled.grooming}
              studentButtonDisabled={studentConfirmDisabled.grooming}
              showManagerButton={reviewerMode}
              showStudentButton={studentReviewMode}
              onNoteChange={(value) => onManagerNoteChange("grooming", value)}
              onManagerSubmit={() => onManagerSubmit("grooming")}
              onStudentConfirm={() => onStudentConfirm("grooming")}
            />
          )}
        >
          {editable ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <FilePickerButton buttonText="添加照片" disabled={!editable} onSelect={(files) => onAddImages("groom", files)} />
            </div>
          ) : null}
        </PhotoCard>

        <PhotoCard
          title="上班前卫生（公区/吧台）"
          images={[...data.openingPublic, ...data.openingBar]}
          reviewBox={(
            <ReviewBox
              label="P2上班前卫生确认说明"
              noteValue={data.managerNotes.opening}
              notePlaceholder="填写公区、吧台卫生核验结果与整改意见"
              noteEditable={reviewerMode}
              managerStatus={approvals.opening}
              studentStatus={studentConfirmations.opening}
              managerButtonLabel="提交开店卫生确认"
              managerButtonDisabled={managerSubmitDisabled.opening}
              studentButtonDisabled={studentConfirmDisabled.opening}
              showManagerButton={reviewerMode}
              showStudentButton={studentReviewMode}
              onNoteChange={(value) => onManagerNoteChange("opening", value)}
              onManagerSubmit={() => onManagerSubmit("opening")}
              onStudentConfirm={() => onStudentConfirm("opening")}
            />
          )}
        >
          {editable ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <FilePickerButton buttonText="添加公区照片" disabled={!editable} onSelect={(files) => onAddImages("openingPublic", files)} />
              <FilePickerButton buttonText="添加吧台照片" disabled={!editable} onSelect={(files) => onAddImages("openingBar", files)} />
            </div>
          ) : null}
        </PhotoCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PhotoCard
          title="下班后卫生（公区/吧台）"
          images={[...data.closingPublic, ...data.closingBar]}
          reviewBox={(
            <ReviewBox
              label="P2下班后卫生确认说明"
              noteValue={data.managerNotes.closing}
              notePlaceholder="填写闭店卫生核验结果与整改意见"
              noteEditable={reviewerMode}
              managerStatus={approvals.closing}
              studentStatus={studentConfirmations.closing}
              managerButtonLabel="提交闭店卫生确认"
              managerButtonDisabled={managerSubmitDisabled.closing}
              studentButtonDisabled={studentConfirmDisabled.closing}
              showManagerButton={reviewerMode}
              showStudentButton={studentReviewMode}
              onNoteChange={(value) => onManagerNoteChange("closing", value)}
              onManagerSubmit={() => onManagerSubmit("closing")}
              onStudentConfirm={() => onStudentConfirm("closing")}
            />
          )}
        >
          {editable ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <FilePickerButton buttonText="添加公区照片" disabled={!editable} onSelect={(files) => onAddImages("closingPublic", files)} />
              <FilePickerButton buttonText="添加吧台照片" disabled={!editable} onSelect={(files) => onAddImages("closingBar", files)} />
            </div>
          ) : null}
        </PhotoCard>

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

          {editable ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <FilePickerButton buttonText="添加损耗照片" disabled={!editable} onSelect={(files) => onAddImages("loss", files)} />
              <FilePickerButton buttonText="添加库存照片" disabled={!editable} onSelect={(files) => onAddImages("inventory", files)} />
            </div>
          ) : null}

          <ImagePreviewGrid images={[...data.lossImgs, ...data.inventoryImgs]} />

          <ReviewBox
            label="P2财务与库存确认说明"
            noteValue={data.managerNotes.finance}
            notePlaceholder="填写盘点结论、损耗核验结果与异常处理意见"
            noteEditable={reviewerMode}
            managerStatus={approvals.finance}
            studentStatus={studentConfirmations.finance}
            managerButtonLabel="提交财务库存确认"
            managerButtonDisabled={managerSubmitDisabled.finance}
            studentButtonDisabled={studentConfirmDisabled.finance}
            showManagerButton={reviewerMode}
            showStudentButton={studentReviewMode}
            onNoteChange={(value) => onManagerNoteChange("finance", value)}
            onManagerSubmit={() => onManagerSubmit("finance")}
            onStudentConfirm={() => onStudentConfirm("finance")}
          />
        </div>
      </div>

      <div className="soft-card">
        <h3 className="panel-title">学生购买创意饮品货品签收</h3>
        <textarea className="field-textarea" value={data.receiptDesc} onChange={(event) => onFieldChange("receiptDesc", event.target.value)} placeholder="签收品项、数量、签收人、时间" readOnly={!editable} />
        {editable ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <FilePickerButton buttonText="添加签收照片" disabled={!editable} onSelect={(files) => onAddImages("receipt", files)} />
          </div>
        ) : null}
        <ImagePreviewGrid images={data.receiptImgs} />
        <ReviewBox
          label="P2签收确认说明"
          noteValue={data.managerNotes.receipt}
          notePlaceholder="填写签收核验情况与确认意见"
          noteEditable={reviewerMode}
          managerStatus={approvals.receipt}
          studentStatus={studentConfirmations.receipt}
          managerButtonLabel="提交签收确认"
          managerButtonDisabled={managerSubmitDisabled.receipt}
          studentButtonDisabled={studentConfirmDisabled.receipt}
          showManagerButton={reviewerMode}
          showStudentButton={studentReviewMode}
          onNoteChange={(value) => onManagerNoteChange("receipt", value)}
          onManagerSubmit={() => onManagerSubmit("receipt")}
          onStudentConfirm={() => onStudentConfirm("receipt")}
        />
      </div>

      <div className="soft-card">
        <label className="field-label">当日补充说明</label>
        <textarea className="field-textarea" value={data.notes} onChange={(event) => onFieldChange("notes", event.target.value)} placeholder="客诉、异常、改进事项" readOnly={!editable} />
        <ReviewBox
          label="P2当日补充说明确认"
          noteValue={data.managerNotes.notes}
          notePlaceholder="填写对当日补充说明的核验意见"
          noteEditable={reviewerMode}
          managerStatus={approvals.notes || "待P2确认"}
          studentStatus={studentConfirmations.notes}
          managerButtonLabel="提交补充说明确认"
          managerButtonDisabled={managerSubmitDisabled.notes}
          studentButtonDisabled={studentConfirmDisabled.notes}
          showManagerButton={reviewerMode}
          showStudentButton={studentReviewMode}
          onNoteChange={(value) => onManagerNoteChange("notes", value)}
          onManagerSubmit={() => onManagerSubmit("notes")}
          onStudentConfirm={() => onStudentConfirm("notes")}
        />
      </div>

      {showStudentSave ? (
        <button className="btn-good" type="button" onClick={onSave} disabled={!editable}>
          保存当日记录
        </button>
      ) : null}
    </section>
  );
}
