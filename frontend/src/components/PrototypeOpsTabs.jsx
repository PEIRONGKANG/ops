import { useEffect, useMemo, useState } from "react";

import { api } from "../services/api";

function todayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentSlotStart() {
  const hour = new Date().getHours();
  const normalized = Math.max(8, Math.min(18, Math.floor(hour / 2) * 2));
  return `${String(normalized).padStart(2, "0")}:00`;
}

function buildAssignedRoleMap(assignments = []) {
  const current = currentSlotStart();
  const map = {};
  assignments.forEach((assignment) => {
    if (!assignment?.studentUsername) return;
    if (!map[assignment.studentUsername] || assignment.slotStart === current) {
      map[assignment.studentUsername] = assignment.positionName || map[assignment.studentUsername];
    }
  });
  return map;
}

function statusClass(status, neutral = false) {
  if (["正常", "在岗", "已通过", "已完成"].includes(status)) return "normal";
  if (["迟到", "库存概况", "待跟进", "待票据"].includes(status)) return neutral ? "warning" : "risk";
  return "warning";
}

function Tag({ children, status = "info" }) {
  return <span className={`prototype-data-tag ${status}`}>{children}</span>;
}

function Panel({ eyebrow, title, actions, children, side }) {
  return (
    <section className={`prototype-data-panel ${side ? "with-side" : ""}`}>
      <div className="prototype-data-head">
        <div>
          <p className="ops-kicker">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {actions ? <div className="prototype-data-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function buildAttendanceRows(studentUsers, currentDayData, assignedRoles = {}) {
  const fallbackRoles = ["吧台主岗", "收银与财务", "库存盘点", "服务接待", "公区维护", "物料补给"];
  const rows = (studentUsers || []).slice(0, 8).map((student, index) => {
    const isCurrent = index === 0;
    const checkIn = isCurrent ? currentDayData?.checkIn : index === 2 ? "08:11" : index === 3 ? "请假" : "08:0" + (index % 5);
    const state = checkIn === "请假" ? "请假" : String(checkIn || "").match(/08:1[0-9]/) ? "迟到" : checkIn ? "正常" : "未签到";
    return {
      name: student.displayName || student.username,
      role: assignedRoles[student.username] || fallbackRoles[index % fallbackRoles.length],
      in: checkIn || "--",
      out: isCurrent ? currentDayData?.checkOut || "--" : "--",
      state,
      next: state === "迟到" ? "补充说明" : "查看记录",
    };
  });
  return rows.length ? rows : [
    { name: "周露", role: "吧台主岗", in: "08:02", out: "--", state: "正常", next: "查看记录" },
    { name: "吴睿", role: "收银与财务", in: "08:00", out: "--", state: "正常", next: "查看记录" },
    { name: "江丹丹", role: "库存盘点", in: "08:11", out: "--", state: "迟到", next: "补充说明" },
  ];
}

function buildInventoryRows(currentDayData) {
  const desc = currentDayData?.inventoryDesc || "";
  return [
    { item: "埃塞浅烘咖啡豆", location: "吧台 A-01", current: 3, safe: 8, unit: "袋", risk: true, note: desc },
    { item: "鲜奶 950ml", location: "冷藏柜 C-02", current: 9, safe: 20, unit: "瓶", risk: true, note: desc },
    { item: "一次性杯盖", location: "耗材柜 B-03", current: 120, safe: 200, unit: "个", risk: true, note: desc },
    { item: "抹茶粉", location: "吧台 A-04", current: 6, safe: 5, unit: "罐", risk: false, note: desc },
    { item: "糖浆泵头", location: "工具柜 T-01", current: 18, safe: 10, unit: "个", risk: false, note: desc },
  ];
}

function buildFinanceRows(currentDayData, studentUsers) {
  const ownerA = studentUsers?.[0]?.displayName || "周露";
  const ownerB = studentUsers?.[1]?.displayName || "吴睿";
  return [
    { id: "FIN-DAY-SALES", use: "今日营业额登记", owner: ownerA, amount: `¥ ${currentDayData?.sales || 0}`, status: currentDayData?.sales ? "已记录" : "待补充", next: "查看" },
    { id: "FIN-DAY-COST", use: "采购成本登记", owner: ownerB, amount: `¥ ${currentDayData?.cost || 0}`, status: currentDayData?.cost ? "已记录" : "待补充", next: "补充" },
    { id: "FIN-DAY-LOSS", use: "损耗事项登记", owner: ownerA, amount: `¥ ${currentDayData?.lossAmount || 0}`, status: currentDayData?.lossAmount ? "待 P2 审批" : "待票据", next: "审批" },
    { id: "FIN-RECEIPT", use: "签收与票据说明", owner: ownerB, amount: "--", status: currentDayData?.receiptDesc ? "已通过" : "待票据", next: "催补凭证" },
  ];
}

function buildStudentCards(studentUsers, assignedRoles = {}) {
  const roles = ["吧台主岗", "收银与财务", "库存盘点", "服务接待", "公区维护", "物料补给"];
  const progress = [92, 88, 73, 45, 84, 68, 76, 81];
  return (studentUsers || []).slice(0, 12).map((student, index) => ({
    name: student.displayName || student.username,
    role: assignedRoles[student.username] || roles[index % roles.length],
    progress: `${progress[index % progress.length]}%`,
    status: index % 5 === 2 ? "迟到" : index % 7 === 3 ? "请假" : "在岗",
    tags: index % 5 === 2 ? ["需说明", "低库存 3 项"] : ["签到正常", index % 3 === 0 ? "库存已确认" : "待审费用 1"],
  }));
}

export function PrototypeOpsTabs({
  activeTab,
  currentUserLevel,
  currentDayData,
  studentUsers,
  financeEditable = false,
  onFinanceFieldChange,
  onFinanceSave,
  onNavigate,
  onLoadWeek,
  onPreviewReport,
}) {
  const [taskFilter, setTaskFilter] = useState("all");
  const [attendanceQuery, setAttendanceQuery] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState("all");
  const [studentQuery, setStudentQuery] = useState("");
  const [jobAssignments, setJobAssignments] = useState([]);
  const [myWeeks, setMyWeeks] = useState([]);

  const isManagementRole = ["P1", "T1", "P2"].includes(currentUserLevel);
  const assignedRoles = useMemo(() => buildAssignedRoleMap(jobAssignments), [jobAssignments]);

  useEffect(() => {
    let cancelled = false;
    api.listJobAssignments({ workDate: todayValue() })
      .then((resp) => {
        if (!cancelled) setJobAssignments(resp?.assignments || []);
      })
      .catch(() => {
        if (!cancelled) setJobAssignments([]);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isManagementRole) {
      setMyWeeks([]);
      return undefined;
    }
    let cancelled = false;
    api.myWeekHistory()
      .then((resp) => {
        if (!cancelled) setMyWeeks(Array.isArray(resp?.weeks) ? resp.weeks.slice(0, 3) : []);
      })
      .catch(() => {
        if (!cancelled) setMyWeeks([]);
      });
    return () => { cancelled = true; };
  }, [isManagementRole]);
  const tasks = useMemo(() => [
    { step: 1, title: "学生签到并确认岗位", meta: isManagementRole ? "使用服务器时间完成签到/签退记录" : "使用服务器时间签到/签退，需补充说明时进入日常运营", status: currentDayData?.checkIn ? "done" : "pending", label: currentDayData?.checkIn ? "已完成" : "待跟进", tab: "daily" },
    { step: 2, title: "开店前卫生与设备检查", meta: "吧台、公区、制冰机照片上传后等待 P2 确认", status: "pending", label: "待确认", tab: "daily" },
    { step: 3, title: "库存盘点与物料记录", meta: currentDayData?.inventoryDesc || "咖啡豆、鲜奶、杯盖等物料记录与补货建议", status: "pending", label: "库存概况", tab: "prototype_inventory" },
    { step: 4, title: "营业收入与采购成本登记", meta: `营业额 ¥ ${currentDayData?.sales || 0}，采购成本 ¥ ${currentDayData?.cost || 0}`, status: currentDayData?.sales ? "done" : "info", label: "财务记录", tab: "prototype_finance" },
    { step: 5, title: "签退、交接与日报归档", meta: "18:00 后开放签退，交接对象最多选择 2 位学生", status: "pending", label: "未开始", tab: "handover" },
  ], [currentDayData, isManagementRole]);

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === "risk") return task.status === "pending" || task.status === "info";
    if (taskFilter === "done") return task.status === "done";
    return true;
  });

  const attendanceRows = buildAttendanceRows(studentUsers, currentDayData, assignedRoles).filter((row) => {
    const hit = `${row.name} ${row.role}`.includes(attendanceQuery.trim());
    const stateHit = attendanceFilter === "all" || row.state === attendanceFilter;
    return hit && stateHit;
  });

  const inventoryRows = buildInventoryRows(currentDayData).filter((row) => {
    const hit = `${row.item} ${row.location}`.includes(inventoryQuery.trim());
    const stateHit = inventoryFilter === "all" || (inventoryFilter === "risk" ? row.risk : !row.risk);
    return hit && stateHit;
  });

  const financeRows = buildFinanceRows(currentDayData, studentUsers);
  const studentCards = buildStudentCards(studentUsers, assignedRoles).filter((item) => `${item.name} ${item.role} ${item.status} ${item.tags.join(" ")}`.includes(studentQuery.trim()));

  if (activeTab === "prototype_attendance") {
    return (
      <Panel
        eyebrow="签到签退"
        title="今日考勤记录"
        actions={<><input className="prototype-search" value={attendanceQuery} onChange={(e) => setAttendanceQuery(e.target.value)} placeholder="搜索学生或岗位" /><select className="prototype-select" value={attendanceFilter} onChange={(e) => setAttendanceFilter(e.target.value)}><option value="all">全部状态</option><option value="正常">正常</option><option value="迟到">迟到</option><option value="请假">请假</option><option value="未签到">未签到</option></select></>}
      >
        <div className="prototype-table-wrap"><table className="prototype-table"><thead><tr><th>学生</th><th>岗位</th><th>签到</th><th>签退</th><th>状态</th><th>操作</th></tr></thead><tbody>{attendanceRows.map((row) => <tr key={`${row.name}-${row.role}`}><td><strong>{row.name}</strong></td><td>{row.role}</td><td>{row.in}</td><td>{row.out}</td><td><Tag status={statusClass(row.state, isManagementRole)}>{row.state}</Tag></td><td><button className="prototype-line-button" onClick={() => onNavigate?.("daily")}>{row.next}</button></td></tr>)}</tbody></table></div>
      </Panel>
    );
  }

  if (activeTab === "prototype_inventory") {
    return (
      <Panel
        eyebrow="库存管理"
        title="物料安全线"
        actions={<><input className="prototype-search" value={inventoryQuery} onChange={(e) => setInventoryQuery(e.target.value)} placeholder="搜索物料或仓位" /><select className="prototype-select" value={inventoryFilter} onChange={(e) => setInventoryFilter(e.target.value)}><option value="all">全部库存</option><option value="risk">仅看需补充</option><option value="normal">库存正常</option></select></>}
      >
        <div className="prototype-inventory-list">{inventoryRows.map((row) => { const percent = Math.min(100, Math.round((row.current / row.safe) * 100)); return <article key={row.item} className={`prototype-inventory-card ${row.risk && !isManagementRole ? "risk" : ""}`}><div><strong>{row.item}</strong><p>{row.location} · 安全线 {row.safe}{row.unit}</p></div><div className="prototype-stock-bar"><span style={{ width: `${percent}%` }} /></div><button className={`prototype-data-tag ${row.risk ? (isManagementRole ? "warning" : "risk") : "normal"}`} onClick={() => onNavigate?.("daily")}>{row.current}{row.unit}</button></article>; })}</div>
      </Panel>
    );
  }

  if (activeTab === "prototype_finance") {
    const financeFields = [
      { key: "sales", label: "今日营业额（元）", type: "number", placeholder: "例如 3286" },
      { key: "cost", label: "采购成本（元）", type: "number", placeholder: "例如 486" },
      { key: "lossAmount", label: "损耗金额（元）", type: "number", placeholder: "例如 126" },
    ];
    const usedBudget = Number(currentDayData?.cost || 0) + Number(currentDayData?.lossAmount || 0);
    const budgetTotal = 20000;
    const budgetPercent = Math.max(0, Math.min(100, Math.round((usedBudget / budgetTotal) * 100)));
    return (
      <div className="prototype-split-grid">
        <Panel
          eyebrow="财务管理"
          title="费用审批与流水"
          actions={<button className="btn-primary" type="button" onClick={onFinanceSave} disabled={!financeEditable}>保存财务记录</button>}
        >
          <div className="prototype-finance-form">
            {financeFields.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <input
                  className="prototype-search"
                  type={field.type}
                  step="0.01"
                  value={currentDayData?.[field.key] || ""}
                  onChange={(event) => onFinanceFieldChange?.(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  readOnly={!financeEditable}
                />
              </label>
            ))}
            <label className="prototype-finance-wide">
              <span>损耗说明</span>
              <textarea
                className="prototype-finance-textarea"
                value={currentDayData?.lossDesc || ""}
                onChange={(event) => onFinanceFieldChange?.("lossDesc", event.target.value)}
                placeholder="填写损耗品项、原因、数量和处置方式"
                readOnly={!financeEditable}
              />
            </label>
            <label className="prototype-finance-wide">
              <span>库存盘点说明</span>
              <textarea
                className="prototype-finance-textarea"
                value={currentDayData?.inventoryDesc || ""}
                onChange={(event) => onFinanceFieldChange?.("inventoryDesc", event.target.value)}
                placeholder="填写关键库存余量、缺货预警和补货建议"
                readOnly={!financeEditable}
              />
            </label>
            <label className="prototype-finance-wide">
              <span>签收与票据说明</span>
              <textarea
                className="prototype-finance-textarea"
                value={currentDayData?.receiptDesc || ""}
                onChange={(event) => onFinanceFieldChange?.("receiptDesc", event.target.value)}
                placeholder="填写签收品项、数量、签收人、票据或凭证说明"
                readOnly={!financeEditable}
              />
            </label>
          </div>
          <div className="prototype-table-wrap mt-4">
            <table className="prototype-table">
              <thead><tr><th>单号</th><th>用途</th><th>申请人</th><th>金额</th><th>状态</th><th>下一步</th></tr></thead>
              <tbody>{financeRows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.id}</strong></td><td>{row.use}</td><td>{row.owner}</td><td>{row.amount}</td><td><Tag status={statusClass(row.status, isManagementRole)}>{row.status}</Tag></td>
                  <td><button className="prototype-line-button" type="button" onClick={() => onNavigate?.("daily")}>{isManagementRole ? "去确认" : "去上传凭证"}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
        <Panel eyebrow="预算使用" title="本周额度" side>
          <div className="prototype-budget"><span style={{ width: `${budgetPercent}%` }} /></div>
          <p className="prototype-budget-text">已使用 ¥ {usedBudget.toLocaleString()} / ¥ {budgetTotal.toLocaleString()}</p>
          <p className="status-line mt-4">财务页现在可直接填写并保存。图片凭证仍在“日常运营”中上传，以便周报统一导出。</p>
        </Panel>
      </div>
    );
  }

  if (activeTab === "prototype_students") {
    return (
      <Panel eyebrow="学生状态" title="岗位与产出" actions={<input className="prototype-search" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="搜索姓名、岗位、状态" />}>
        <div className="prototype-student-grid">{studentCards.map((student) => <article key={`${student.name}-${student.role}`} className="prototype-student-card"><h3>{student.name}</h3><p>{student.role} · 完成度 {student.progress}</p><div>{[student.status, ...student.tags].map((tag) => <Tag key={tag} status={statusClass(tag, isManagementRole)}>{tag}</Tag>)}</div></article>)}</div>
      </Panel>
    );
  }

  return (
    <div className="prototype-split-grid">
      <Panel eyebrow="今日进度" title="实训任务流" actions={<div className="prototype-segmented"><button className={taskFilter === "all" ? "active" : ""} onClick={() => setTaskFilter("all")}>全部</button><button className={taskFilter === "risk" ? "active" : ""} onClick={() => setTaskFilter("risk")}>待跟进</button><button className={taskFilter === "done" ? "active" : ""} onClick={() => setTaskFilter("done")}>已完成</button></div>}>
        <div className="prototype-timeline">{filteredTasks.map((task) => <button key={task.title} type="button" className="prototype-task-card" onClick={() => onNavigate?.(task.tab)}><span className="prototype-task-index">{task.step}</span><span className="prototype-task-copy"><strong>{task.title}</strong><small>{task.meta}</small></span><em className={`prototype-tag ${task.status === "done" ? "emerald" : "indigo"}`}>{task.label}</em></button>)}</div>
      </Panel>
      <Panel eyebrow={isManagementRole ? "班级状态" : "个人实训档案"} title={isManagementRole ? "学生分布" : "我的进度入口"} side>
        {isManagementRole ? (
          <>
            <div className="prototype-donut"><span>82%</span></div>
            <div className="prototype-legend"><span><i className="purple" />在岗 42</span><span><i className="blue" />迟到 4</span><span><i className="pink" />请假 2</span></div>
            <div className="prototype-side-actions"><button className="prototype-line-button" onClick={onLoadWeek}>加载本周</button><button className="prototype-line-button" onClick={onPreviewReport}>导出日报</button></div>
          </>
        ) : (
          <div className="prototype-student-focus">
            <p>系统只显示本人实训周、签到记录、运营填写与教师反馈。</p>
            <div className="prototype-student-actions">
              <button type="button" className="prototype-line-button" onClick={() => onNavigate?.("my_history")}>查看历史记录</button>
              <button type="button" className="prototype-line-button" onClick={() => onNavigate?.("daily")}>填写今日运营</button>
              <button type="button" className="prototype-line-button" onClick={() => onNavigate?.("training_tasks")}>进入实训任务</button>
            </div>
            <div className="prototype-history-list">
              <strong>最近实训周</strong>
              {myWeeks.length ? myWeeks.map((week) => (
                <button key={week.startDate} type="button" onClick={() => onNavigate?.("my_history")}>
                  <span>{week.teachingWeek || "未标注周次"}</span>
                  <small>{week.startDate} 至 {week.endDate || "-"}</small>
                </button>
              )) : <small>暂无历史周记录，完成填写后会在这里出现。</small>}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
