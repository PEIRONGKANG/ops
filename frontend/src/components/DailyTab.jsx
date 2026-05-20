import { useEffect, useRef, useState } from "react";

import { api } from "../services/api.js";
import { assetUrl } from "../lib/assets";
import { FilePickerButton, ImagePreviewGrid } from "./MediaBlocks";

function formatClock(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function StatusBlock({ title, managerStatus, studentStatus }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="status-line">{title}{managerStatus}</p>
      <p className="status-line">P3 回签：{studentStatus}</p>
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
            P3 确认通过
          </button>
        ) : null}
      </div>
      <StatusBlock title="P2 确认状态：" managerStatus={managerStatus} studentStatus={studentStatus} />
    </div>
  );
}

function ImageSection({ title, images, onClear, showClearAction }) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="field-label !mb-0">{title}</p>
        {showClearAction && images.length ? (
          <button className="btn-warn" type="button" onClick={onClear}>
            删除图片
          </button>
        ) : null}
      </div>
      <ImagePreviewGrid images={images} />
    </div>
  );
}

function TextClearButton({ onClick, visible, label }) {
  if (!visible) return null;
  return (
    <button className="btn-warn" type="button" onClick={onClick}>
      {label}
    </button>
  );
}

export function DailyTab({
  dailyDateOptions,
  currentDay,
  currentUserLevel,
  data,
  approvals,
  studentConfirmations,
  editable,
  reviewerMode,
  studentReviewMode,
  canDeleteContent,
  managerSubmitDisabled,
  studentConfirmDisabled,
  onDateChange,
  onFieldChange,
  onClearField,
  onManagerNoteChange,
  onAddImages,
  onClearImages,
  onSave,
  onManagerSubmit,
  onStudentConfirm,
  onP3StampAttendance,
}) {
  const showStudentSave = editable;
  const showDeleteHint = editable && canDeleteContent;
  const isP3 = currentUserLevel === "P3";

  const [clockText, setClockText] = useState("");
  const offsetMsRef = useRef(0);

  useEffect(() => {
    if (!isP3) return;
    let mounted = true;
    let tickId = null;
    let resyncId = null;

    const syncClock = async () => {
      try {
        const { epochMs, iso } = await api.now();
        const serverMs = Number.isFinite(epochMs) ? epochMs : Date.parse(iso);
        if (!Number.isFinite(serverMs)) return;
        offsetMsRef.current = serverMs - Date.now();
      } catch {
        // Ignore sync failures; keep ticking with last known offset.
      }
    };

    const start = async () => {
      await syncClock();
      if (!mounted) return;
      const tick = () => {
        const now = new Date(Date.now() + offsetMsRef.current);
        setClockText(formatClock(now));
      };
      tick();
      tickId = setInterval(tick, 250);
      resyncId = setInterval(syncClock, 60_000);
    };

    start();
    return () => {
      mounted = false;
      if (tickId) clearInterval(tickId);
      if (resyncId) clearInterval(resyncId);
    };
  }, [isP3]);

  return (
    <section className="module-shell">
      <div>
        <p className="module-kicker">Daily Operations & Execution</p>
        <h2 className="section-title mt-2">每日打卡与运营执行</h2>
      </div>
      <img src={assetUrl("assets/hygiene-ai.svg")} alt="AI 卫生检查图" className="module-banner" />

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
        {isP3 ? (
          <>
            <div className="soft-card">
              <label className="field-label">当前时间（自动同步）</label>
              <div className="field-input flex items-center justify-between font-mono">
                <span>{clockText || "--:--:--"}</span>
                <span className="text-xs opacity-70">含秒</span>
              </div>
              <p className="status-line mt-3">P3 只能点击按钮完成签到/签退，系统将自动写入服务器时间。</p>
            </div>
            <div className="soft-card">
              <label className="field-label">签到 / 签退</label>
              <div className="mt-1 flex flex-wrap gap-3">
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => onP3StampAttendance?.("checkIn")}
                  disabled={!editable}
                >
                  签到
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => onP3StampAttendance?.("checkOut")}
                  disabled={!editable}
                >
                  签退
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <p className="status-line">已签到：{data.checkIn || "-"}</p>
                <p className="status-line">已签退：{data.checkOut || "-"}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="soft-card">
              <label className="field-label">签到时间</label>
              <input
                className="field-input"
                type="time"
                value={data.checkIn}
                onChange={(event) => onFieldChange("checkIn", event.target.value)}
                readOnly={!editable}
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <TextClearButton visible={showDeleteHint && Boolean(data.checkIn)} onClick={() => onClearField("checkIn")} label="清空签到时间" />
              </div>
            </div>
            <div className="soft-card">
              <label className="field-label">签退时间</label>
              <input
                className="field-input"
                type="time"
                value={data.checkOut}
                onChange={(event) => onFieldChange("checkOut", event.target.value)}
                readOnly={!editable}
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <TextClearButton visible={showDeleteHint && Boolean(data.checkOut)} onClick={() => onClearField("checkOut")} label="清空签退时间" />
              </div>
            </div>
          </>
        )}
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
        <div className="mt-3 flex flex-wrap gap-3">
          {editable ? (
            <FilePickerButton buttonText="上传请假条图片" disabled={!editable} onSelect={(files) => onAddImages("leave", files)} />
          ) : null}
          <TextClearButton visible={showDeleteHint && Boolean(data.attendanceNote)} onClick={() => onClearField("attendanceNote")} label="清空文字" />
          {showDeleteHint && data.leaveImgs.length ? (
            <button className="btn-warn" type="button" onClick={() => onClearImages("leave")}>
              删除请假条图片
            </button>
          ) : null}
        </div>
        <ImageSection
          title="请假条上传"
          images={data.leaveImgs}
          showClearAction={false}
        />
        {showDeleteHint ? (
          <p className="status-line mt-4">P3 修改或删除内容后，请点击“保存当日记录”，再重新提交给 P2 运营经理审核。</p>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-2">
          <ReviewBox
            label="P2 签到确认说明"
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
            label="P2 签退确认说明"
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
        <div className="soft-card">
          <h3 className="panel-title">仪容仪表检查照片</h3>
          {editable ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <FilePickerButton buttonText="添加照片" disabled={!editable} onSelect={(files) => onAddImages("groom", files)} />
              {showDeleteHint && data.grooming.length ? (
                <button className="btn-warn" type="button" onClick={() => onClearImages("groom")}>
                  删除图片
                </button>
              ) : null}
            </div>
          ) : null}
          <ImageSection title="已上传照片" images={data.grooming} showClearAction={false} />
          <ReviewBox
            label="P2 仪容仪表确认说明"
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
        </div>

        <div className="soft-card">
          <h3 className="panel-title">上班前卫生（公区 / 吧台）</h3>
          {editable ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <FilePickerButton buttonText="添加公区照片" disabled={!editable} onSelect={(files) => onAddImages("openingPublic", files)} />
              <FilePickerButton buttonText="添加吧台照片" disabled={!editable} onSelect={(files) => onAddImages("openingBar", files)} />
            </div>
          ) : null}
          <ImageSection
            title="公区照片"
            images={data.openingPublic}
            onClear={() => onClearImages("openingPublic")}
            showClearAction={showDeleteHint}
          />
          <ImageSection
            title="吧台照片"
            images={data.openingBar}
            onClear={() => onClearImages("openingBar")}
            showClearAction={showDeleteHint}
          />
          <ReviewBox
            label="P2 上班前卫生确认说明"
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
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="soft-card">
          <h3 className="panel-title">下班后卫生（公区 / 吧台）</h3>
          {editable ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <FilePickerButton buttonText="添加公区照片" disabled={!editable} onSelect={(files) => onAddImages("closingPublic", files)} />
              <FilePickerButton buttonText="添加吧台照片" disabled={!editable} onSelect={(files) => onAddImages("closingBar", files)} />
            </div>
          ) : null}
          <ImageSection
            title="公区照片"
            images={data.closingPublic}
            onClear={() => onClearImages("closingPublic")}
            showClearAction={showDeleteHint}
          />
          <ImageSection
            title="吧台照片"
            images={data.closingBar}
            onClear={() => onClearImages("closingBar")}
            showClearAction={showDeleteHint}
          />
          <ReviewBox
            label="P2 下班后卫生确认说明"
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
              <div className="mt-3 flex flex-wrap gap-3">
                <TextClearButton visible={showDeleteHint && Boolean(data.lossDesc)} onClick={() => onClearField("lossDesc")} label="清空损耗说明" />
              </div>
            </div>
            <div>
              <label className="field-label">库存盘点说明</label>
              <textarea className="field-textarea" value={data.inventoryDesc} onChange={(event) => onFieldChange("inventoryDesc", event.target.value)} placeholder="关键库存余量、缺货预警" readOnly={!editable} />
              <div className="mt-3 flex flex-wrap gap-3">
                <TextClearButton visible={showDeleteHint && Boolean(data.inventoryDesc)} onClick={() => onClearField("inventoryDesc")} label="清空库存说明" />
              </div>
            </div>
          </div>

          {editable ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <FilePickerButton buttonText="添加损耗照片" disabled={!editable} onSelect={(files) => onAddImages("loss", files)} />
              <FilePickerButton buttonText="添加库存照片" disabled={!editable} onSelect={(files) => onAddImages("inventory", files)} />
            </div>
          ) : null}

          <ImageSection
            title="损耗照片"
            images={data.lossImgs}
            onClear={() => onClearImages("loss")}
            showClearAction={showDeleteHint}
          />
          <ImageSection
            title="库存照片"
            images={data.inventoryImgs}
            onClear={() => onClearImages("inventory")}
            showClearAction={showDeleteHint}
          />

          <ReviewBox
            label="P2 财务与库存确认说明"
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
        <textarea
          className="field-textarea"
          value={data.receiptDesc}
          onChange={(event) => onFieldChange("receiptDesc", event.target.value)}
          placeholder="签收品项、数量、签收人、时间"
          readOnly={!editable}
        />
        <div className="mt-3 flex flex-wrap gap-3">
          {editable ? (
            <FilePickerButton buttonText="添加签收照片" disabled={!editable} onSelect={(files) => onAddImages("receipt", files)} />
          ) : null}
          <TextClearButton visible={showDeleteHint && Boolean(data.receiptDesc)} onClick={() => onClearField("receiptDesc")} label="清空文字" />
          {showDeleteHint && data.receiptImgs.length ? (
            <button className="btn-warn" type="button" onClick={() => onClearImages("receipt")}>
              删除图片
            </button>
          ) : null}
        </div>
        <ImageSection title="签收照片" images={data.receiptImgs} showClearAction={false} />
        <ReviewBox
          label="P2 签收确认说明"
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
        <div className="mt-3 flex flex-wrap gap-3">
          <TextClearButton visible={showDeleteHint && Boolean(data.notes)} onClick={() => onClearField("notes")} label="清空文字" />
        </div>
        <ReviewBox
          label="P2 当日补充说明确认"
          noteValue={data.managerNotes.notes}
          notePlaceholder="填写对当日补充说明的核验意见"
          noteEditable={reviewerMode}
          managerStatus={approvals.notes}
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
