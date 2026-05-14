import { FilePickerButton } from "./MediaBlocks";

function ReceiptSummary({ receipts }) {
  if (!receipts?.length) {
    return <p className="ops-notice-receipt-empty">暂未有人点击收到。</p>;
  }

  return (
    <div className="ops-notice-receipts">
      {receipts.slice(0, 8).map((receipt) => (
        <span key={`${receipt.username}-${receipt.receivedAt}`} className="ops-notice-receipt-chip">
          {receipt.displayName || receipt.username}
        </span>
      ))}
      {receipts.length > 8 ? (
        <span className="ops-notice-receipt-chip muted">+{receipts.length - 8}</span>
      ) : null}
    </div>
  );
}

function NoticeImages({ images }) {
  if (!images?.length) return null;

  return (
    <div className="ops-notice-image-grid">
      {images.map((src, index) => (
        <img
          key={`${src.slice(0, 24)}-${index}`}
          className="ops-notice-image"
          src={src}
          alt={`带教留言图片 ${index + 1}`}
        />
      ))}
    </div>
  );
}

function ComposerImages({ images, onRemove }) {
  if (!images?.length) {
    return <p className="ops-notice-hint">可上传多张图片，发布后登录前后都能查看。</p>;
  }

  return (
    <div className="ops-notice-image-grid composer">
      {images.map((src, index) => (
        <div key={`${src.slice(0, 24)}-${index}`} className="ops-notice-image-shell">
          <img className="ops-notice-image" src={src} alt={`待发布图片 ${index + 1}`} />
          <button
            className="ops-notice-remove"
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`移除第 ${index + 1} 张图片`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function NoticeCard({
  notice,
  loggedIn,
  canDelete,
  acknowledged,
  acknowledgementLabel,
  activeActionId,
  onAcknowledge,
  onDelete,
}) {
  const actionBusy = activeActionId === notice.id;

  return (
    <article className="ops-notice-card">
      <div className="ops-notice-card-head">
        <div>
          <h4>{notice.title || "带教留言"}</h4>
          <p className="ops-notice-meta">
            {notice.authorDisplayName || "带教教师"} 发布于 {notice.createdAt || "-"}
          </p>
        </div>
        <div className="ops-notice-actions">
          {loggedIn ? (
            <button
              className={`ops-notice-ack ${acknowledged ? "is-complete" : ""}`}
              type="button"
              onClick={() => onAcknowledge(notice.id)}
              disabled={acknowledged || actionBusy}
            >
              {acknowledged ? "已收到" : actionBusy ? "提交中..." : acknowledgementLabel}
            </button>
          ) : (
            <span className="ops-notice-public-tip">登录后可点击信息收到</span>
          )}
          {canDelete ? (
            <button
              className="ops-notice-delete"
              type="button"
              onClick={() => onDelete(notice.id)}
              disabled={actionBusy}
            >
              删除
            </button>
          ) : null}
        </div>
      </div>

      {notice.message ? <p className="ops-notice-message">{notice.message}</p> : null}
      <NoticeImages images={notice.images} />

      <div className="ops-notice-foot">
        <div>
          <strong>收到情况</strong>
          <ReceiptSummary receipts={notice.receipts} />
        </div>
        <span className="ops-notice-count">已确认 {notice.receipts?.length || 0} 人</span>
      </div>
    </article>
  );
}

export function TeacherNoticeBoard({
  loggedIn,
  notices,
  canCompose,
  composeForm,
  composePending,
  activeActionId,
  acknowledgedNoticeIds,
  acknowledgementLabel,
  onComposeFieldChange,
  onComposeImagesAdd,
  onComposeImageRemove,
  onComposeSubmit,
  onAcknowledge,
  onDeleteNotice,
}) {
  const handlePublish = async () => {
    const ok = await onComposeSubmit({
      title: composeForm.title || "",
      message: composeForm.message || "",
    });
    return ok;
  };

  return (
    <article className="ops-panel ops-reminder-panel ops-notice-panel">
      <div className="ops-panel-head">
        <div>
          <p className="ops-kicker">Teacher Bulletin</p>
          <h3>带教教师留言面板</h3>
        </div>
        <span className="ops-chip">Shared Board</span>
      </div>

      {canCompose ? (
        <section className="ops-notice-composer">
          <div className="ops-notice-composer-grid">
            <label className="ops-notice-field">
              <span>留言标题</span>
              <input
                className="field-input"
                value={composeForm.title}
                onChange={(event) => onComposeFieldChange?.("title", event.target.value)}
                placeholder="例如：本周迎检重点 / 饮品演示安排"
              />
            </label>

            <label className="ops-notice-field full">
              <span>留言内容</span>
              <textarea
                className="field-input ops-notice-textarea"
                value={composeForm.message}
                onChange={(event) => onComposeFieldChange?.("message", event.target.value)}
                placeholder="输入带教老师希望全体成员在登录前后都能看到的文字说明。"
              />
            </label>
          </div>

          <div className="ops-notice-toolbar">
            <FilePickerButton buttonText="上传图片" disabled={composePending} onSelect={onComposeImagesAdd} />
            <button
              className="btn-primary"
              type="button"
              onClick={handlePublish}
              disabled={composePending}
            >
              {composePending ? "发布中..." : "发布留言"}
            </button>
          </div>

          <ComposerImages images={composeForm.images} onRemove={onComposeImageRemove} />
        </section>
      ) : null}

      <div className="ops-notice-list">
        {notices.length ? (
          notices.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              loggedIn={loggedIn}
              canDelete={canCompose}
              acknowledged={acknowledgedNoticeIds.includes(notice.id)}
              acknowledgementLabel={acknowledgementLabel}
              activeActionId={activeActionId}
              onAcknowledge={onAcknowledge}
              onDelete={onDeleteNotice}
            />
          ))
        ) : (
          <div className="ops-notice-empty">
            <p>当前还没有带教留言。</p>
            <small>{canCompose ? "可先发布一条图文消息，登录前后都会展示在这里。" : "等待 P1 教师发布新的图文提醒。"}</small>
          </div>
        )}
      </div>
    </article>
  );
}
