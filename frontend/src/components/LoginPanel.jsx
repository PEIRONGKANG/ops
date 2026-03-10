export function LoginPanel({
  loginForm,
  loginMessage,
  loading,
  onChange,
  onSubmit,
}) {
  const canSubmit = Boolean(loginForm.username.trim() && loginForm.password.trim() && !loading);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && canSubmit) {
      onSubmit();
    }
  };

  return (
    <section className="panel-card" onKeyDown={handleKeyDown}>
      <h2 className="section-title">登录</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="field-label">账号一</label>
          <input
            className="field-input"
            value={loginForm.username}
            onChange={(event) => onChange("username", event.target.value)}
            placeholder="请输入账号，如：2401270101"
          />
        </div>
        <div>
          <label className="field-label">密码一</label>
          <input
            className="field-input"
            type="password"
            value={loginForm.password}
            onChange={(event) => onChange("password", event.target.value)}
            placeholder="请输入密码"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="field-label">账号二（可选）</label>
          <input
            className="field-input"
            value={loginForm.secondUsername}
            onChange={(event) => onChange("secondUsername", event.target.value)}
            placeholder="同组双人登录时填写第二个账号"
          />
        </div>
        <div>
          <label className="field-label">密码二（可选）</label>
          <input
            className="field-input"
            type="password"
            value={loginForm.secondPassword}
            onChange={(event) => onChange("secondPassword", event.target.value)}
            placeholder="与第二个账号配套填写"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn-primary" type="button" onClick={onSubmit} disabled={!canSubmit}>
          {loading ? "登录中..." : "登录系统"}
        </button>
      </div>

      <p className="status-line mt-4">
        {loginMessage || "学生可单人登录，也可同时登录同组 2 个账号；运营经理和 P1 账号仍使用单账号登录。"}
      </p>
    </section>
  );
}
