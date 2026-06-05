function normalizeApiBase(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "/api";
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

const API_BASE = normalizeApiBase(import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_BASE);
const DEFAULT_TIMEOUT_MS = 60_000;
const AUTH_TOKEN_KEY = "ops_training_auth_token_v1";

let authToken = null;

export function loadAuthToken() {
  try {
    const value = localStorage.getItem(AUTH_TOKEN_KEY);
    authToken = value ? String(value) : null;
  } catch {
    authToken = null;
  }
  return authToken;
}

export function setAuthToken(token) {
  authToken = token ? String(token) : null;
  try {
    if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

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
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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
  logout() {
    return request("/logout", { method: "POST" });
  },
  listAccounts() {
    return request("/accounts");
  },
  unlockAccountPasswords(passphrase) {
    return request("/accounts/passwords/unlock", {
      method: "POST",
      body: JSON.stringify({ passphrase }),
    });
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
  listTrainingTasks(options = {}) {
    const params = new URLSearchParams();
    if (options.publishedOnly === false) params.set("published_only", "false");
    const query = params.toString();
    return request(`/training/tasks${query ? `?${query}` : ""}`);
  },
  myTrainingSubmissions() {
    return request("/training/my/submissions");
  },
  submitTraining(payload) {
    return request("/training/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  trainingProgress() {
    return request("/training/progress");
  },
  listSemesters() {
    return request("/semesters");
  },
  createSemester(payload) {
    return request("/semesters", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listOperationLogs(limit = 100) {
    return request(`/operation-logs?limit=${encodeURIComponent(limit)}`);
  },
  p1Dashboard() {
    return request("/dashboard/p1");
  },
  listJobPositions() {
    return request("/job-positions");
  },
  createJobPosition(position) {
    return request("/job-positions", {
      method: "POST",
      body: JSON.stringify(position),
    });
  },
  updateJobPosition(positionId, position) {
    return request(`/job-positions/${encodeURIComponent(positionId)}`, {
      method: "PUT",
      body: JSON.stringify(position),
    });
  },
  listJobAssignments(options = {}) {
    const params = new URLSearchParams();
    if (options.workDate) params.set("work_date", options.workDate);
    if (options.studentUsername) params.set("student_username", options.studentUsername);
    const query = params.toString();
    return request(`/job-assignments${query ? `?${query}` : ""}`);
  },
  saveJobAssignment(assignment) {
    return request("/job-assignments", {
      method: "PUT",
      body: JSON.stringify(assignment),
    });
  },
  deleteJobAssignment(assignmentId) {
    return request(`/job-assignments/${encodeURIComponent(assignmentId)}`, {
      method: "DELETE",
    });
  },
  myWeekHistory() {
    return request("/my-week-history");
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
