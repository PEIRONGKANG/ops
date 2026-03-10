const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

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
  fetchWeek(scopeUser, startDate) {
    return request(`/weeks/${encodeURIComponent(scopeUser)}/${encodeURIComponent(startDate)}`);
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
  saveWeekGroup(startDate, group) {
    return request(`/week-groups/${encodeURIComponent(startDate)}`, {
      method: "PUT",
      body: JSON.stringify({ group }),
    });
  },
};
