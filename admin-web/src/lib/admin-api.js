const API_BASE_URL = import.meta.env.VITE_ADMIN_API_BASE_URL || "http://localhost:4002";

export function getAdminApiUrl(path = "") {
  return `${API_BASE_URL}${path}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }
  return data;
}

export async function adminLogin(payload) {
  return request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendAdminResetCode(payload) {
  return request("/api/admin/forgot-password/send-code", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resendAdminResetCode(payload) {
  return request("/api/admin/forgot-password/resend-code", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyAdminResetCode(payload) {
  return request("/api/admin/forgot-password/verify-code", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetAdminPassword(payload) {
  return request("/api/admin/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminDashboardSummary() {
  return request("/api/admin/dashboard/summary");
}

export async function fetchAdminAnalytics(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.range) {
    searchParams.set("range", params.range);
  }
  if (params.startDate) {
    searchParams.set("startDate", params.startDate);
  }
  if (params.endDate) {
    searchParams.set("endDate", params.endDate);
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return request(`/api/admin/analytics${suffix}`);
}

export async function fetchAdminRiskFlags() {
  return request("/api/admin/dashboard/risk-flags");
}

export async function fetchRiskTriggers() {
  return request("/api/admin/risk-triggers");
}

export async function createRiskTrigger(payload) {
  return request("/api/admin/risk-triggers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRiskTrigger(triggerId, payload) {
  return request(`/api/admin/risk-triggers/${triggerId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteRiskTrigger(triggerId, payload = {}) {
  return request(`/api/admin/risk-triggers/${triggerId}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminStudents(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.search) {
    searchParams.set("search", params.search);
  }
  if (params.program) {
    searchParams.set("program", params.program);
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return request(`/api/admin/students${suffix}`);
}

export async function fetchAdminStudentProfile(studentNumber) {
  return request(`/api/admin/students/${encodeURIComponent(studentNumber)}`);
}

export async function sendAdminStudentNotification(studentNumber, payload) {
  return request(`/api/admin/students/${encodeURIComponent(studentNumber)}/notify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminRoleAssignments() {
  return request("/api/admin/roles");
}

export async function fetchAdminSettings(email) {
  const params = new URLSearchParams();
  if (email) {
    params.set("email", email);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/admin/settings${suffix}`);
}

export async function updateAdminSettings(payload) {
  return request("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createAdminRoleMember(payload) {
  return request("/api/admin/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminRoleMember(memberId, payload) {
  return request(`/api/admin/roles/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminRoleMember(memberId) {
  return request(`/api/admin/roles/${memberId}`, {
    method: "DELETE",
  });
}

export async function fetchGoogleCalendarAuthUrl() {
  return request("/api/admin/appointments/google/auth-url");
}



export async function fetchAdminGoogleOAuthUrl() {
  return request("/api/admin/oauth/google/start");
}

export async function fetchAdminAppointmentsOverview(date, supportType = "GUIDANCE") {
  const params = new URLSearchParams();
  if (date) {
    params.set("date", date);
  }
  if (supportType) {
    params.set("supportType", supportType);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/appointments/admin/overview${suffix}`);
}

export async function fetchAdminNotifications(email) {
  const params = new URLSearchParams();
  if (email) {
    params.set("email", email);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/admin/notifications${suffix}`);
}

export async function markAdminNotificationRead(notificationId, email) {
  return request(`/api/admin/notifications/${notificationId}/read`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function markAllAdminNotificationsRead(email) {
  return request("/api/admin/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function updateAdminAvailability(payload) {
  return request("/api/appointments/admin/availability", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminDayAvailability(payload) {
  return request("/api/appointments/admin/availability/day", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAdminAppointment(payload) {
  return request("/api/appointments/book", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function bookAdminAppointment(payload) {
  return request("/api/appointments/book", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminAppointment(appointmentId, payload) {
  return request(`/api/appointments/admin/${appointmentId}/update`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmAdminAppointment(appointmentId, payload) {
  return request(`/api/appointments/admin/${appointmentId}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function declineAdminAppointment(appointmentId, payload) {
  return request(`/api/appointments/admin/${appointmentId}/decline`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelAdminAppointment(appointmentId, payload) {
  return request(`/api/appointments/admin/${appointmentId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminAppointment(appointmentId, actorEmail) {
  const params = new URLSearchParams();
  if (actorEmail) {
    params.set("actorEmail", actorEmail);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/appointments/admin/${appointmentId}${suffix}`, {
    method: "DELETE",
  });
}

export async function fetchAdminPeerCounselors() {
  return request("/api/appointments/admin/peer-counselors");
}

export async function createAdminPeerCounselor(payload) {
  return request("/api/appointments/admin/peer-counselors", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminPeerCounselor(peerCounselorId, payload) {
  return request(`/api/appointments/admin/peer-counselors/${peerCounselorId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminPeerCounselor(peerCounselorId, actorEmail) {
  const params = new URLSearchParams();
  if (actorEmail) {
    params.set("actorEmail", actorEmail);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/appointments/admin/peer-counselors/${peerCounselorId}${suffix}`, {
    method: "DELETE",
  });
}
