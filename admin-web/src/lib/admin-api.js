const API_BASE_URL = import.meta.env.VITE_ADMIN_API_BASE_URL || "http://localhost:4001";

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

export async function fetchGoogleCalendarAuthUrl() {
  return request("/api/admin/appointments/google/auth-url");
}

export async function fetchGoogleCalendarEvents() {
  return request("/api/admin/appointments/events");
}

export async function fetchAdminGoogleOAuthUrl() {
  return request("/api/admin/oauth/google/start");
}
