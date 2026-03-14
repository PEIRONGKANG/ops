const API_BASE = import.meta.env.VITE_API_BASE || "/api";
let actorUsername = "";
let sessionToken = "";

function buildHeaders(options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (!("Content-Type" in headers) && options.body) {
    headers["Content-Type"] = "application/json";
  }
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  } else if (actorUsername) {
    headers["X-Actor-Username"] = actorUsername;
  }
  return headers;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(options),
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
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  setActor(username) {
    actorUsername = username || "";
  },
  setSessionToken(token) {
    sessionToken = token || "";
  },
  clearSession() {
    sessionToken = "";
    actorUsername = "";
  },
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
  session() {
    return request("/session");
  },
  logout() {
    return request("/logout", {
      method: "POST",
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
  foundationBootstrap() {
    return request("/foundation/bootstrap");
  },
  createTerm(term) {
    return request("/terms", {
      method: "POST",
      body: JSON.stringify(term),
    });
  },
  deleteTerm(termId) {
    return request(`/terms/${termId}`, {
      method: "DELETE",
    });
  },
  createClassItem(classItem) {
    return request("/classes", {
      method: "POST",
      body: JSON.stringify(classItem),
    });
  },
  deleteClassItem(classId) {
    return request(`/classes/${classId}`, {
      method: "DELETE",
    });
  },
  createCourseBatch(courseBatch) {
    return request("/course-batches", {
      method: "POST",
      body: JSON.stringify(courseBatch),
    });
  },
  deleteCourseBatch(batchId) {
    return request(`/course-batches/${batchId}`, {
      method: "DELETE",
    });
  },
  createGroup(group) {
    return request("/groups", {
      method: "POST",
      body: JSON.stringify(group),
    });
  },
  deleteGroup(groupId) {
    return request(`/groups/${groupId}`, {
      method: "DELETE",
    });
  },
  createGroupMember(groupMember) {
    return request("/group-members", {
      method: "POST",
      body: JSON.stringify(groupMember),
    });
  },
  deleteGroupMember(memberId) {
    return request(`/group-members/${memberId}`, {
      method: "DELETE",
    });
  },
  createScheduleAssignment(scheduleAssignment) {
    return request("/schedule-assignments", {
      method: "POST",
      body: JSON.stringify(scheduleAssignment),
    });
  },
  deleteScheduleAssignment(assignmentId) {
    return request(`/schedule-assignments/${assignmentId}`, {
      method: "DELETE",
    });
  },
  createResource(resource) {
    return request("/resources", {
      method: "POST",
      body: JSON.stringify(resource),
    });
  },
  deleteResource(resourceId) {
    return request(`/resources/${resourceId}`, {
      method: "DELETE",
    });
  },
  createCertification(certification) {
    return request("/certifications", {
      method: "POST",
      body: JSON.stringify(certification),
    });
  },
  deleteCertification(certificationId) {
    return request(`/certifications/${certificationId}`, {
      method: "DELETE",
    });
  },
  createCourseScore(courseScore) {
    return request("/course-scores", {
      method: "POST",
      body: JSON.stringify(courseScore),
    });
  },
  deleteCourseScore(scoreId) {
    return request(`/course-scores/${scoreId}`, {
      method: "DELETE",
    });
  },
  createShowcaseScore(showcaseScore) {
    return request("/showcase-scores", {
      method: "POST",
      body: JSON.stringify(showcaseScore),
    });
  },
  deleteShowcaseScore(scoreId) {
    return request(`/showcase-scores/${scoreId}`, {
      method: "DELETE",
    });
  },
  submitWorkflow(payload) {
    return request("/workflows/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  approveWorkflow(payload) {
    return request("/workflows/approve", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  rejectWorkflow(payload) {
    return request("/workflows/reject", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  archiveWorkflow(payload) {
    return request("/workflows/archive", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
