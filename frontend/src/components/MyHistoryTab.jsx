import { useEffect, useMemo, useState } from "react";

import { api } from "../services/api.js";
import { ImagePreviewGrid } from "./MediaBlocks.jsx";

const DAY_LABELS = ["周三", "周四", "周五", "周六", "周日", "周一", "周二", "次周三"];

function addDays(dateText, days) {
  const [year, month, day] = String(dateText || "").slice(0, 10).split("-").map((item) => Number(item));
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hasText(...values) {
  return values.some((value) => String(value || "").trim());
}

function approvalText(value) {
  if (!value) return "未确认";
  const parts = [value.by, value.time, value.comment].filter((item) => String(item || "").trim());
  return parts.length ? parts.join(" / ") : "未确认";
}

function Section({ title, children }) {
  return (
    <div className="history-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="history-field">
      <span>{label}</span>
      <strong>{String(value || "").trim() || "-"}</strong>
    </div>
  );
}

function ImageBlock({ title, images }) {
  const list = Array.isArray(images) ? images : [];
  return (
    <div className="history-images">
      <p>{title}</p>
      {list.length ? <ImagePreviewGrid images={list} /> : <span className="status-pill is-quiet">未上传</span>}
    </div>
  );
}

function dayStatus(record) {
  if (!record) return "当天无填写记录";
  if (hasText(record.checkIn, record.checkOut, record.attendanceNote, record.notes, record.sales, record.cost, record.lossAmount, record.lossDesc, record.inventoryDesc, record.receiptDesc)
    || [record.leaveImgs, record.grooming, record.openingPublic, record.openingBar, record.closingPublic, record.closingBar, record.lossImgs, record.inventoryImgs, record.receiptImgs].some((item) => Array.isArray(item) && item.length)) {
    return "当天有填写内容";
  }
  return "当天无填写记录";
}

export function MyHistoryTab({ currentUser }) {
  const [weeks, setWeeks] = useState([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api.myWeekHistory()
      .then((resp) => {
        if (!alive) return;
        const nextWeeks = Array.isArray(resp?.weeks) ? resp.weeks : [];
        setWeeks(nextWeeks);
        const firstWeek = nextWeeks[0];
        if (firstWeek) {
          setSelectedWeekStart(firstWeek.startDate);
          const dailyKeys = Object.keys(firstWeek.daily || {}).sort();
          setSelectedDay(dailyKeys[0] || firstWeek.startDate);
        }
      })
      .catch((err) => {
        if (alive) setError(err.message || "历史记录加载失败。");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const selectedWeek = useMemo(() => weeks.find((week) => week.startDate === selectedWeekStart) || weeks[0] || null, [selectedWeekStart, weeks]);
  const dayOptions = useMemo(() => {
    if (!selectedWeek?.startDate) return [];
    return Array.from({ length: 8 }, (_, index) => {
      const value = addDays(selectedWeek.startDate, index);
      return { value, label: `${value} ${DAY_LABELS[index]}`, record: selectedWeek.daily?.[value] || null };
    });
  }, [selectedWeek]);

  useEffect(() => {
    if (!selectedWeek) return;
    const dailyKeys = Object.keys(selectedWeek.daily || {}).sort();
    const fallback = dailyKeys[0] || selectedWeek.startDate;
    setSelectedDay((current) => dayOptions.some((item) => item.value === current) ? current : fallback);
  }, [dayOptions, selectedWeek]);

  const record = selectedWeek?.daily?.[selectedDay] || null;
  const managerNotes = record?.managerNotes || {};
  const approvals = record?.approvals || {};

  if (loading) {
    return <section className="soft-card"><p className="status-line">正在加载我的历史实训记录...</p></section>;
  }

  if (error) {
    return <section className="soft-card"><p className="module-kicker">History Error</p><h2 className="section-title mt-2">历史记录暂不可用</h2><p className="status-line mt-3">{error}</p></section>;
  }

  return (
    <section className="module-shell history-shell">
      <div className="soft-card history-hero">
        <div>
          <p className="module-kicker">My Training History</p>
          <h2 className="section-title mt-2">我的历史填写记录</h2>
          <p className="status-line mt-3">
            {currentUser?.displayName || currentUser?.username} 可查看本人过往实训周的签到时间和每日运营填写内容。
          </p>
        </div>
        <span className="status-pill is-good">仅本人可见</span>
      </div>

      {!weeks.length ? (
        <div className="soft-card">
          <p className="status-line">当前账号暂无历史周记录。如果你确认已完成填写，请联系 P1教学督查检查账号是否与历史记录绑定一致。</p>
        </div>
      ) : null}

      {weeks.length ? (
        <>
          <div className="soft-card history-selector-grid">
            <label>
              <span>选择实训周</span>
              <select className="field-input" value={selectedWeek?.startDate || ""} onChange={(event) => setSelectedWeekStart(event.target.value)}>
                {weeks.map((week) => (
                  <option key={week.startDate} value={week.startDate}>
                    {week.teachingWeek || "未标注周次"} · {week.startDate} 至 {week.endDate || addDays(week.startDate, 7)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>选择日期</span>
              <select className="field-input" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>
                {dayOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label} · {dayStatus(item.record)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="soft-card history-day-card">
            <div className="history-day-head">
              <div>
                <p className="module-kicker">{selectedWeek?.teachingWeek || "实训周"}</p>
                <h3>{selectedDay} 填写内容</h3>
              </div>
              <span className={record ? "status-pill is-good" : "status-pill is-quiet"}>{dayStatus(record)}</span>
            </div>

            <Section title="签到打卡">
              <div className="history-field-grid">
                <Field label="签到时间" value={record?.checkIn} />
                <Field label="签退时间" value={record?.checkOut} />
                <Field label="考勤/请假说明" value={record?.attendanceNote} />
              </div>
              <ImageBlock title="请假凭证" images={record?.leaveImgs} />
            </Section>

            <Section title="运营填写内容">
              <div className="history-field-grid">
                <Field label="当日备注" value={record?.notes} />
                <Field label="营业额" value={record?.sales} />
                <Field label="采购成本" value={record?.cost} />
                <Field label="损耗金额" value={record?.lossAmount} />
                <Field label="损耗说明" value={record?.lossDesc} />
                <Field label="库存说明" value={record?.inventoryDesc} />
                <Field label="货品签收说明" value={record?.receiptDesc} />
              </div>
              <div className="history-image-grid">
                <ImageBlock title="仪容仪表" images={record?.grooming} />
                <ImageBlock title="开店公区" images={record?.openingPublic} />
                <ImageBlock title="开店吧台" images={record?.openingBar} />
                <ImageBlock title="闭店公区" images={record?.closingPublic} />
                <ImageBlock title="闭店吧台" images={record?.closingBar} />
                <ImageBlock title="损耗图片" images={record?.lossImgs} />
                <ImageBlock title="库存图片" images={record?.inventoryImgs} />
                <ImageBlock title="货品签收图片" images={record?.receiptImgs} />
              </div>
            </Section>

            <Section title="P2 确认与回签">
              <div className="history-field-grid">
                <Field label="签到确认说明" value={managerNotes.checkIn} />
                <Field label="签退确认说明" value={managerNotes.checkOut} />
                <Field label="仪容确认说明" value={managerNotes.grooming} />
                <Field label="开店确认说明" value={managerNotes.opening} />
                <Field label="闭店确认说明" value={managerNotes.closing} />
                <Field label="财务库存确认说明" value={managerNotes.finance} />
                <Field label="签收确认说明" value={managerNotes.receipt} />
                <Field label="备注确认说明" value={managerNotes.notes} />
                <Field label="签到确认人/时间" value={approvalText(approvals.checkIn)} />
                <Field label="签退确认人/时间" value={approvalText(approvals.checkOut)} />
                <Field label="仪容确认人/时间" value={approvalText(approvals.grooming)} />
                <Field label="开店确认人/时间" value={approvalText(approvals.opening)} />
                <Field label="闭店确认人/时间" value={approvalText(approvals.closing)} />
                <Field label="财务库存确认人/时间" value={approvalText(approvals.finance)} />
                <Field label="签收确认人/时间" value={approvalText(approvals.receipt)} />
              </div>
            </Section>
          </div>
        </>
      ) : null}
    </section>
  );
}
