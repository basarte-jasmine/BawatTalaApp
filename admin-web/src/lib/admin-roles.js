export function isHeadCounselor(session) {
  return String(session?.role || "").toUpperCase() === "HEAD_COUNSELOR";
}

export function getAdminRoleLabel(session) {
  if (isHeadCounselor(session)) return "Super Admin";
  return session?.roleLabel || "School Counselor";
}
