const API_BASE = import.meta.env?.VITE_API_BASE || "/api";
const DEFAULT_TIMEOUT_MS = 60_000;

export async function request(path, options = {}) {
  const {
    headers,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  const requestSignal = controller.signal;
  let didTimeout = false;
  let removeAbortListener = null;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(signal.reason);
    } else {
      const forwardAbort = () => controller.abort(signal.reason);
      signal.addEventListener("abort", forwardAbort, { once: true });
      removeAbortListener = () => signal.removeEventListener("abort", forwardAbort);
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      ...fetchOptions,
      signal: requestSignal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new Error("请求超时，请检查网络后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    removeAbortListener?.();
  }

  if (!response.ok) {
    let detail = "请求失败。";
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch {
      // Ignore JSON parse failures for non-JSON responses.
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  health() {
    return request("/health");
  },
  now() {
    return request("/now");
  },
  bootstrap() {
    return request("/bootstrap");
  },
  login(payload) {
    return request("/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listAccounts() {
    return request("/accounts");
  },
  listTeacherNotices() {
    return request("/teacher-notices");
  },
  createTeacherNotice(notice) {
    return request("/teacher-notices", {
      method: "POST",
      body: JSON.stringify(notice),
    });
  },
  deleteTeacherNotice(noticeId) {
    return request(`/teacher-notices/${encodeURIComponent(noticeId)}`, {
      method: "DELETE",
    });
  },
  acknowledgeTeacherNotice(noticeId, receipts) {
    return request(`/teacher-notices/${encodeURIComponent(noticeId)}/receipts`, {
      method: "POST",
      body: JSON.stringify({ receipts }),
    });
  },
  createAccount(user) {
    return request("/accounts", {
      method: "POST",
      body: JSON.stringify(user),
    });
  },
  updateAccount(username, user) {
    return request(`/accounts/${encodeURIComponent(username)}`, {
      method: "PUT",
      body: JSON.stringify(user),
    });
  },
  deleteAccount(username) {
    return request(`/accounts/${encodeURIComponent(username)}`, {
      method: "DELETE",
    });
  },
  fetchWeek(scopeUser, startDate, options = {}) {
    const params = new URLSearchParams();
    if (options.includeMedia === false) {
      params.set("include_media", "false");
    }
    const query = params.toString();
    return request(`/weeks/${encodeURIComponent(scopeUser)}/${encodeURIComponent(startDate)}${query ? `?${query}` : ""}`, {
      // Media-heavy payloads can be very large (tens of MB). Default to a longer timeout when explicitly requested.
      timeoutMs: options.includeMedia === true ? 180_000 : undefined,
    });
  },
  saveWeek(scopeUser, startDate, week) {
    return request(`/weeks/${encodeURIComponent(scopeUser)}/${encodeURIComponent(startDate)}`, {
      method: "PUT",
      body: JSON.stringify({ week }),
    });
  },
  fetchWeekGroup(startDate) {
    return request(`/week-groups/${encodeURIComponent(startDate)}`);
  },
  fetchWeekScopes(startDate) {
    return request(`/week-scopes/${encodeURIComponent(startDate)}`);
  },
  saveWeekGroup(startDate, group) {
    return request(`/week-groups/${encodeURIComponent(startDate)}`, {
      method: "PUT",
      body: JSON.stringify({ group }),
    });
  },
};
