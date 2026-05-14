export function AccountsTab({
  users,
  currentUser,
  isTop,
  passwordForm,
  passwordViewPassphrase,
  passwordsUnlocked,
  newUserForm,
  editUserId,
  editForm,
  onPasswordChange,
  onPasswordViewPassphraseChange,
  onUnlockPasswords,
  onSubmitPassword,
  onNewUserChange,
  onCreateUser,
  onEditUserSelect,
  onEditFormChange,
  onSaveUserEdit,
  onDeleteUser,
  canDeleteSelected,
  deleteHint,
}) {
  const visibleUsers = isTop
    ? users
    : users.filter((user) => user.username === currentUser?.username);

  const canSubmitPassword = Boolean(passwordForm.newPassword.trim());
  const canCreateUser = Boolean(
    isTop
    && newUserForm.username.trim()
    && newUserForm.displayName.trim()
    && newUserForm.password.trim(),
  );
  const canSaveEdit = Boolean(
    isTop
    && editUserId
    && editForm.displayName.trim(),
  );

  return (
    <section className="module-shell">
      <div>
        <p className="module-kicker">Access & Identity Management</p>
        <h2 className="section-title mt-2">账号管理</h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="soft-card">
          <h3 className="panel-title">当前账号密码修改</h3>
          <label className="field-label">新密码</label>
          <input className="field-input" type="password" value={passwordForm.newPassword} onChange={(event) => onPasswordChange(event.target.value)} />
          <button className="btn-good mt-3" type="button" onClick={onSubmitPassword} disabled={!canSubmitPassword}>
            修改密码
          </button>
        </div>

        {isTop ? (
          <div className="soft-card">
            <h3 className="panel-title">P1 账号管理（最高权限）</h3>
            <div className="grid gap-3 xl:grid-cols-2">
              <div>
                <label className="field-label">新账号</label>
                <input className="field-input" value={newUserForm.username} onChange={(event) => onNewUserChange("username", event.target.value)} />
              </div>
              <div>
                <label className="field-label">姓名</label>
                <input className="field-input" value={newUserForm.displayName} onChange={(event) => onNewUserChange("displayName", event.target.value)} />
              </div>
              <div>
                <label className="field-label">初始密码</label>
                <input className="field-input" type="password" value={newUserForm.password} onChange={(event) => onNewUserChange("password", event.target.value)} />
              </div>
              <div>
                <label className="field-label">权限等级</label>
                <select className="field-input" value={newUserForm.level} onChange={(event) => onNewUserChange("level", event.target.value)}>
                  <option value="P3">P3 学生</option>
                  <option value="T1">T1 督导教师</option>
                  <option value="P2">P2 运营经理</option>
                  <option value="P1">P1 最高权限</option>
                </select>
              </div>
            </div>
            <button className="btn-primary mt-3" type="button" onClick={onCreateUser} disabled={!canCreateUser}>
              新增账号
            </button>
          </div>
        ) : null}
      </div>

      {isTop ? (
        <div className="soft-card">
          <h3 className="panel-title">密码查看口令</h3>
          <p className="status-line mt-2">账号密码默认隐藏。P1 输入口令后，仅在当前页面会话中显示明文密码。</p>
          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_auto]">
            <input
              className="field-input"
              type="password"
              value={passwordViewPassphrase}
              onChange={(event) => onPasswordViewPassphraseChange(event.target.value)}
              placeholder="请输入密码查看口令"
            />
            <button className="btn-secondary" type="button" onClick={onUnlockPasswords}>
              {passwordsUnlocked ? "重新验证口令" : "查看账号密码"}
            </button>
          </div>
          <p className="status-line mt-2">{passwordsUnlocked ? "密码已解锁显示。" : "未输入口令前，P1 也不能查看账号密码。"}</p>
        </div>
      ) : null}

      {isTop ? (
        <div className="soft-card">
          <h3 className="panel-title">修改已有账号（姓名 / 密码 / 权限）</h3>
          <label className="field-label">选择账号</label>
          <select className="field-input" value={editUserId} onChange={(event) => onEditUserSelect(event.target.value)}>
            {users.map((user) => (
              <option key={user.username} value={user.username}>
                {user.displayName}（{user.username}）
              </option>
            ))}
          </select>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <div>
              <label className="field-label">新姓名</label>
              <input className="field-input" value={editForm.displayName} onChange={(event) => onEditFormChange("displayName", event.target.value)} />
            </div>
            <div>
              <label className="field-label">新密码（留空不修改）</label>
              <input className="field-input" type="password" value={editForm.password} onChange={(event) => onEditFormChange("password", event.target.value)} placeholder="留空则保留原密码" />
            </div>
            <div>
              <label className="field-label">权限等级</label>
              <select className="field-input" value={editForm.level} onChange={(event) => onEditFormChange("level", event.target.value)}>
                <option value="P3">P3 学生</option>
                <option value="P2">P2 运营经理</option>
                <option value="T1">T1 督导教师</option>
                <option value="P1">P1 最高权限</option>
              </select>
            </div>
            <div>
              <label className="field-label">账号状态</label>
              <select className="field-input" value={editForm.isActive ? "active" : "inactive"} onChange={(event) => onEditFormChange("isActive", event.target.value === "active")}>
                <option value="active">启用</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <button className="btn-warn" type="button" onClick={onSaveUserEdit} disabled={!canSaveEdit}>
              保存账号修改
            </button>
            <button className="btn-secondary border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100" type="button" onClick={onDeleteUser} disabled={!canDeleteSelected}>
              删除账号
            </button>
          </div>

          <p className="status-line mt-3">{deleteHint}</p>
        </div>
      ) : null}

      <div className="soft-card">
        <h3 className="panel-title">{isTop ? "系统账号列表" : "当前账号信息"}</h3>
        <div className="space-y-2">
          {visibleUsers.map((user) => (
            <div key={user.username} className="status-line">
              {user.displayName}（{user.username}） - {user.level}
              {isTop
                ? `，状态：${user.isActive === false ? "停用" : "启用"}，密码：${passwordsUnlocked ? (user.password || "-") : "需输入口令查看"}，姓名更新时间：${user.nameUpdatedAt || "-"}，密码更新时间：${user.passwordUpdatedAt || "-"}`
                : `，角色：${user.level}`}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
