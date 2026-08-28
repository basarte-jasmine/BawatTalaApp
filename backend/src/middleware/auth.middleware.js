const { verifyStudentToken } = require("../services/auth-token.service");

function normalizeStudentNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function buildAdminSessionPayload(admin) {
  if (!admin) return null;
  const role = String(admin.role || "COUNSELOR").toUpperCase();
  return {
    id: admin.id,
    email: String(admin.email || "").trim().toLowerCase(),
    fullName: String(admin.fullName || admin.full_name || "").trim(),
    role,
    roleTitle: String(admin.roleTitle || admin.role_title || "").trim(),
    accessLevel: String(admin.accessLevel || admin.access_level || "").trim(),
    status: String(admin.status || "").trim(),
    specialties: Array.isArray(admin.specialties) ? admin.specialties : [],
    isActive: Boolean(admin.isActive ?? admin.is_active ?? true),
    profilePictureUrl: String(admin.profilePictureUrl || admin.profile_picture_url || "").trim(),
    updatedAt: admin.updatedAt || admin.updated_at || "",
  };
}

function requireAdminAuth(req, res, next) {
  const sessionAdmin = buildAdminSessionPayload(req.session?.admin);
  if (!sessionAdmin?.email || !sessionAdmin.isActive) {
    return res.status(401).json({ message: "Please sign in again." });
  }
  req.admin = sessionAdmin;
  next();
}

function getAuthenticatedStudent(req) {
  if (req.session?.student?.studentNumber) {
    return req.session.student;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const payload = verifyStudentToken(token);
    if (payload?.studentNumber) {
      return { studentNumber: payload.studentNumber };
    }
  }

  const customToken = req.headers["x-student-token"];
  if (customToken) {
    const payload = verifyStudentToken(customToken);
    if (payload?.studentNumber) {
      return { studentNumber: payload.studentNumber };
    }
  }

  return null;
}

function requireStudentAuth(req, res, next) {
  return requireStudentOnlyAuth(req, res, next);
}

function requireStudentOnlyAuth(req, res, next) {
  const student = getAuthenticatedStudent(req);
  if (!student?.studentNumber) {
    return res.status(401).json({ message: "Authentication required. Please sign in." });
  }

  const targetStudentNumber =
    req.params?.studentNumber ||
    req.query?.studentNumber ||
    req.body?.studentNumber;

  if (targetStudentNumber) {
    const targetNorm = normalizeStudentNumber(targetStudentNumber);
    const authNorm = normalizeStudentNumber(student.studentNumber);
    if (targetNorm && authNorm && targetNorm !== authNorm) {
      return res.status(403).json({ message: "Access denied." });
    }
  }

  req.student = student;
  next();
}

function resolveStudentNumber(req) {
  const fromAuth = req.student?.studentNumber || getAuthenticatedStudent(req)?.studentNumber;
  const fromQuery = req.query?.studentNumber;
  const fromBody = req.body?.studentNumber;
  const claimed = fromQuery || fromBody;
  if (
    claimed &&
    fromAuth &&
    String(normalizeStudentNumber(claimed)) !== String(normalizeStudentNumber(fromAuth))
  ) {
    const error = new Error("Access denied.");
    error.statusCode = 403;
    throw error;
  }
  return fromAuth;
}

module.exports = {
  buildAdminSessionPayload,
  requireAdminAuth,
  requireStudentAuth,
  requireStudentOnlyAuth,
  getAuthenticatedStudent,
  resolveStudentNumber,
};
