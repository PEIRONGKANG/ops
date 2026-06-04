import { useState } from "react";

const ROLE_META = {
  P1: { label: "P1 领导", hint: "进入领导驾驶舱", tone: "purple" },
  T1: { label: "T1 督导", hint: "进入督导工作台", tone: "blue" },
  P2: { label: "P2 值班经理", hint: "进入值班经理工作台", tone: "cyan" },
  P3: { label: "P3 学生", hint: "进入我的实训任务", tone: "pink" },
};

function inferRole(username, users = []) {
  const value = String(username || "").trim();
  if (!value) return "";
  const matched = users.find((user) => String(user.username || "") === value);
  if (matched?.level) return matched.level;
  if (/^24\d{8}$/.test(value) || /^23\d{8}$/.test(value)) return "P3";
  if (/^t1/i.test(value)) return "T1";
  return "";
}

function roleClass(role, activeRole) {
  return `login-role-chip ${activeRole === role ? "is-active" : ""} tone-${ROLE_META[role].tone}`;
}

export function LoginPanel({
  loginForm,
  loginMessage,
  loading,
  users = [],
  onChange,
  onSubmit,
}) {
  const [coLoginOpen, setCoLoginOpen] = useState(Boolean(loginForm.secondUsername || loginForm.secondPassword));
  const canSubmit = Boolean(loginForm.username.trim() && loginForm.password.trim() && !loading);
  const activeRole = inferRole(loginForm.username, users);
  const matchedUser = users.find((user) => String(user.username || "") === String(loginForm.username || "").trim());
  const roleMeta = activeRole ? ROLE_META[activeRole] : null;

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && canSubmit) {
      onSubmit();
    }
  };

  const toggleCoLogin = () => {
    const nextOpen = !coLoginOpen;
    setCoLoginOpen(nextOpen);
    if (!nextOpen) {
      onChange("secondUsername", "");
      onChange("secondPassword", "");
    }
  };

  return (
    <section className="login-card login-card-enhanced no-print" onKeyDown={handleKeyDown}>
      <div className="login-card-glow" aria-hidden="true" />
      <div className="login-header-row">
        <div>
          <p className="panel-eyebrow">Member Sign In</p>
          <h2 className="section-title mt-3">登录系统</h2>
        </div>
        <span className={`login-live-badge ${loading ? "is-loading" : ""}`}>
          {loading ? "验证中" : "统一入口"}
        </span>
      </div>

      <p className="panel-lead">输入账号后自动识别身份，并进入对应的角色工作台。</p>

      <div className="login-role-row" aria-label="身份识别">
        {Object.keys(ROLE_META).map((role) => (
          <span key={role} className={roleClass(role, activeRole)}>
            {ROLE_META[role].label}
          </span>
        ))}
      </div>

      <div className="login-identity-preview">
        <span className="login-preview-dot" aria-hidden="true" />
        {roleMeta ? (
          <strong>
            已识别：{matchedUser?.displayName ? `${matchedUser.displayName} · ` : ""}{roleMeta.label}，{roleMeta.hint}
          </strong>
        ) : (
          <strong>输入账号后显示身份与进入页面。</strong>
        )}
      </div>

      <div className="login-field-grid">
        <div>
          <label className="field-label">账号</label>
          <input
            className="field-input login-input"
            value={loginForm.username}
            onChange={(event) => onChange("username", event.target.value)}
            placeholder="请输入账号，例如 122019 或 2401270101"
            autoComplete="username"
          />
        </div>
        <div>
          <label className="field-label">密码</label>
          <input
            className="field-input login-input"
            type="password"
            value={loginForm.password}
            onChange={(event) => onChange("password", event.target.value)}
            placeholder="请输入密码"
            autoComplete="current-password"
          />
        </div>
      </div>

      <button className="login-collab-toggle" type="button" onClick={toggleCoLogin}>
        <span>{coLoginOpen ? "收起同组协作登录" : "+ 添加同组协作登录"}</span>
        <small>仅 P3 学生需要双人同步周记录时使用</small>
      </button>

      {coLoginOpen ? (
        <div className="login-field-grid login-collab-fields">
          <div>
            <label className="field-label">同组账号</label>
            <input
              className="field-input login-input"
              value={loginForm.secondUsername}
              onChange={(event) => onChange("secondUsername", event.target.value)}
              placeholder="第二位同学账号"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="field-label">同组密码</label>
            <input
              className="field-input login-input"
              type="password"
              value={loginForm.secondPassword}
              onChange={(event) => onChange("secondPassword", event.target.value)}
              placeholder="第二位同学密码"
              autoComplete="off"
            />
          </div>
        </div>
      ) : null}

      <div className="login-action-row">
        <button className="btn-primary login-submit" type="button" onClick={onSubmit} disabled={!canSubmit}>
          {loading ? "正在验证账号..." : roleMeta ? `进入${roleMeta.label.replace(/^[A-Z0-9]+\s*/, "")}工作台` : "登录系统"}
        </button>
        <span className="login-security-note">加密传输 · 权限自动分流</span>
      </div>

      <p className={`status-line login-status ${loginMessage ? "is-error" : ""}`}>
        {loginMessage || (loading ? "正在验证账号并加载本周数据。" : "学生可单人登录，也可展开同组协作登录；P1、T1、P2 使用单账号登录。")}
      </p>
    </section>
  );
}
