const express = require("express");
const { query } = require("../config/db");

const router = express.Router();

const MANILA_TIME_ZONE = "Asia/Manila";
const DEFAULT_SLOT_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED"];
const MOBILE_BOOKING_LEAD_DAYS = 2;
const APPOINTMENT_DECISION_WINDOW_HOURS = 24;
const APPOINTMENT_EXPIRY_CHECK_MS = 5 * 60 * 1000;
const CONCERN_OPTIONS = [
  "Academic Stress",
  "Anxiety / Stress",
  "Relationships",
  "Family Issues",
  "Career Guidance",
  "Financial Concerns",
  "Burnout / Exhaustion",
  "Bullying",
  "Others",
];
const BOOKING_SOURCES = new Set(["MOBILE_APP", "ADMIN_PANEL"]);

function getManilaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    isoDate: `${year}-${month}-${day}`,
  };
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function normalizeMonth(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function normalizeSlotTime(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

function normalizeDateValue(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return getManilaDateParts(value).isoDate;
  }

  const raw = String(value).trim();
  const exactMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactMatch) {
    return `${exactMatch[1]}-${exactMatch[2]}-${exactMatch[3]}`;
  }

  const prefixMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (prefixMatch) {
    return `${prefixMatch[1]}-${prefixMatch[2]}-${prefixMatch[3]}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return getManilaDateParts(parsed).isoDate;
}

function toDayOfWeek(isoDate) {
  const date = new Date(`${isoDate}T12:00:00+08:00`);
  return date.getUTCDay();
}

function toReadableTime(slotTime) {
  const [hourText = "00", minuteText = "00"] = String(slotTime || "00:00").split(":");
  const hourValue = Number(hourText);
  const suffix = hourValue >= 12 ? "PM" : "AM";
  const normalizedHour = hourValue % 12 || 12;
  return `${normalizedHour}:${minuteText} ${suffix}`;
}

function toRoleLabel(role) {
  return role === "HEAD_COUNSELOR" ? "Head Counselor" : "Counselor";
}

function normalizeConcern(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const match = CONCERN_OPTIONS.find((item) => item.toLowerCase() === raw);
  return match || "";
}

function formatDateLong(value) {
  if (!value) return "";
  let date;
  if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(`${value}T12:00:00+08:00`);
  }
  if (Number.isNaN(date?.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric",
  }).format(date);
}

function formatRelativeDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function addDaysToIsoDate(isoDate, days) {
  const anchor = new Date(`${isoDate}T12:00:00+08:00`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return getManilaDateParts(anchor).isoDate;
}

function getMinimumStudentBookingDate() {
  return addDaysToIsoDate(getManilaDateParts().isoDate, MOBILE_BOOKING_LEAD_DAYS);
}

function getDecisionDeadlineIso(createdAt) {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(created.getTime() + APPOINTMENT_DECISION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

function isActiveAppointmentStatus(status) {
  return ACTIVE_APPOINTMENT_STATUSES.includes(String(status || "").toUpperCase());
}

function isPendingAppointment(status) {
  return String(status || "").toUpperCase() === "PENDING";
}

function toStatusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING") return "Pending";
  if (normalized === "DECLINED") return "Declined";
  if (normalized === "CANCELLED") return "Cancelled";
  if (normalized === "COMPLETED") return "Completed";
  return "Confirmed";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function looksLikePlaceholderSecret(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized === "your_resend_api_key" ||
    normalized === "changeme" ||
    normalized === "replace_me" ||
    normalized.includes("your_") ||
    normalized.includes("example")
  );
}

function isLikelyEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function sendAppointmentEmail({ to, subject, intro, appointment, ctaText = "", context = "appointment update" }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(
    process.env.APPOINTMENT_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "",
  ).trim();
  const recipient = String(to || "").trim();
  const appointmentId = String(appointment?.id || "").trim();
  const logContext = appointmentId ? `${context} [appointment ${appointmentId}]` : context;

  if (!recipient) {
    console.warn(`Appointment email skipped for ${logContext}: missing recipient address.`);
    return { ok: false, skipped: true, reason: "missing-recipient" };
  }

  if (!isLikelyEmailAddress(recipient)) {
    console.warn(`Appointment email skipped for ${logContext}: invalid recipient address "${recipient}".`);
    return { ok: false, skipped: true, reason: "invalid-recipient" };
  }

  if (looksLikePlaceholderSecret(apiKey)) {
    console.warn(`Appointment email skipped for ${logContext}: RESEND_API_KEY is missing or still a placeholder.`);
    return { ok: false, skipped: true, reason: "invalid-api-key" };
  }

  if (!from) {
    console.warn(`Appointment email skipped for ${logContext}: missing sender address.`);
    return { ok: false, skipped: true, reason: "missing-sender" };
  }

  if (!isLikelyEmailAddress(from)) {
    console.warn(`Appointment email skipped for ${logContext}: invalid sender address "${from}".`);
    return { ok: false, skipped: true, reason: "invalid-sender" };
  }

  const lines = [
    intro,
    "",
    `Date: ${formatDateLong(appointment.appointment_date)}`,
    `Time: ${toReadableTime(appointment.slot_time)}`,
    `Concern: ${appointment.concern}`,
    `Counselor: ${appointment.counselor_name || appointment.counselor_full_name || "Guidance Counselor"}`,
    ctaText ? `Note: ${ctaText}` : "",
  ].filter(Boolean);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #243442; line-height: 1.6;">
      <p>${escapeHtml(intro)}</p>
      <div style="border: 1px solid #d8e7d1; background: #f6fbf3; border-radius: 12px; padding: 16px;">
        <p><strong>Date:</strong> ${escapeHtml(formatDateLong(appointment.appointment_date))}</p>
        <p><strong>Time:</strong> ${escapeHtml(toReadableTime(appointment.slot_time))}</p>
        <p><strong>Concern:</strong> ${escapeHtml(appointment.concern)}</p>
        <p><strong>Counselor:</strong> ${escapeHtml(appointment.counselor_name || appointment.counselor_full_name || "Guidance Counselor")}</p>
      </div>
      ${ctaText ? `<p>${escapeHtml(ctaText)}</p>` : ""}
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        text: lines.join("\n"),
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `Appointment email failed for ${logContext} to ${recipient}: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
      );
      return { ok: false, skipped: false, reason: "provider-error" };
    }
    return { ok: true };
  } catch (error) {
    console.error(`Failed to send appointment email for ${logContext} to ${recipient}:`, error);
    return { ok: false, skipped: false, reason: "request-error" };
  }
}

async function findAdminByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const result = await query(
    `
      select
        id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        coalesce(nullif(role, ''), 'COUNSELOR') as role
      from public.admin_accounts
      where lower(email) = $1
      limit 1
    `,
    [normalizedEmail],
  );

  return result.rows[0] || null;
}

async function writeAdminActivityLog({
  actionType,
  actorEmail = "",
  actorName = "",
  actorRole = "",
  description = "",
  entityType,
  metadata = {},
  title,
}) {
  await query(
    `
      insert into public.admin_activity_logs (
        actor_email,
        actor_name,
        actor_role,
        action_type,
        entity_type,
        title,
        description,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      actorEmail || null,
      actorName || null,
      actorRole || null,
      actionType,
      entityType,
      title,
      description,
      JSON.stringify(metadata || {}),
    ],
  );
}

async function createStudentNotification({
  studentNumber,
  kind,
  title,
  message,
  metadata = {},
}) {
  await query(
    `
      insert into public.student_notifications (
        student_number,
        kind,
        title,
        message,
        metadata
      )
      values ($1, $2, $3, $4, $5::jsonb)
    `,
    [studentNumber, kind, title, message, JSON.stringify(metadata || {})],
  );
}

async function findStudentProfileByStudentNumber(studentNumber) {
  const result = await query(
    `
      select
        student_number,
        coalesce(full_name, student_number) as full_name,
        coalesce(email, '') as email
      from public.student_profiles
      where student_number = $1
      limit 1
    `,
    [studentNumber],
  );

  return result.rows[0] || null;
}

async function ensureStudentHasNoActiveAppointmentOnDate({
  studentNumber,
  appointmentDate,
  excludeAppointmentId = "",
}) {
  const result = await query(
    `
      select id
      from public.counselor_appointments
      where student_number = $1
        and appointment_date = $2::date
        and status = any($3::text[])
        and ($4::uuid is null or id <> $4::uuid)
      limit 1
    `,
    [studentNumber, appointmentDate, ACTIVE_APPOINTMENT_STATUSES, excludeAppointmentId || null],
  );

  if (result.rowCount > 0) {
    throw new Error("This student already has an appointment request on that date.");
  }
}

function canManageCounselorDecision(actorAdmin, appointment) {
  if (!actorAdmin || !appointment) return false;
  return actorAdmin.role === "HEAD_COUNSELOR" || actorAdmin.id === appointment.counselor_id;
}

async function expirePendingAppointments() {
  const result = await query(
    `
      select
        ca.id,
        ca.student_number,
        ca.concern,
        ca.appointment_date,
        ca.slot_time,
        ca.created_at,
        ca.counselor_id,
        aa.email as counselor_email,
        coalesce(nullif(aa.full_name, ''), split_part(aa.email, '@', 1)) as counselor_name,
        coalesce(sp.full_name, ca.student_number) as student_name,
        coalesce(sp.email, '') as student_email
      from public.counselor_appointments ca
      join public.admin_accounts aa on aa.id = ca.counselor_id
      left join public.student_profiles sp on sp.student_number = ca.student_number
      where ca.status = 'PENDING'
        and ca.created_at <= now() - interval '24 hours'
    `,
  );

  if (result.rowCount === 0) {
    return 0;
  }

  const appointmentIds = result.rows.map((row) => row.id);
  await query(
    `
      update public.counselor_appointments
      set status = 'DECLINED', updated_at = now()
      where id = any($1::uuid[])
        and status = 'PENDING'
    `,
    [appointmentIds],
  );

  for (const row of result.rows) {
    await writeAdminActivityLog({
      actionType: "APPOINTMENT_AUTO_DECLINED",
      actorEmail: "system@bawattala.local",
      actorName: "System",
      actorRole: "System",
      entityType: "APPOINTMENT",
      title: `System auto-declined ${toReadableTime(row.slot_time)}`,
      description: `${row.student_name} was auto-declined for ${row.counselor_name} on ${formatDateLong(row.appointment_date)} after no response within 24 hours.`,
      metadata: {
        appointmentId: row.id,
        appointmentDate: normalizeDateValue(row.appointment_date),
        counselorId: row.counselor_id,
        counselorName: row.counselor_name,
        ownerCounselorId: row.counselor_id,
        slotTime: row.slot_time,
        studentNumber: row.student_number,
      },
    });

    await createStudentNotification({
      studentNumber: row.student_number,
      kind: "APPOINTMENT_AUTO_DECLINED",
      title: "Appointment request expired",
      message: `Your appointment request for ${formatDateLong(row.appointment_date)} at ${toReadableTime(row.slot_time)} was automatically declined because no counselor response was recorded within 24 hours.`,
      metadata: {
        appointmentId: row.id,
        counselorId: row.counselor_id,
        counselorName: row.counselor_name,
      },
    });

    await sendAppointmentEmail({
      to: row.student_email,
      subject: "Your counseling appointment request expired",
      intro: `Your appointment request with ${row.counselor_name} was automatically declined because it was not confirmed within 24 hours.`,
      appointment: row,
      ctaText: "Please open the app to request a new schedule.",
      context: "student expiry notification",
    });

    await sendAppointmentEmail({
      to: row.counselor_email,
      subject: "A pending counseling appointment was auto-declined",
      intro: `${row.student_name}'s pending appointment request was automatically declined after the 24-hour confirmation window expired.`,
      appointment: row,
      ctaText: "Open the admin scheduling panel if you want to offer the student a new slot.",
      context: "counselor expiry notification",
    });
  }

  return result.rowCount;
}

let pendingAppointmentExpiryWorker = null;

function startPendingAppointmentExpiryWorker() {
  if (pendingAppointmentExpiryWorker) {
    return pendingAppointmentExpiryWorker;
  }

  const run = async () => {
    try {
      await expirePendingAppointments();
    } catch (error) {
      console.error("Pending appointment expiry check failed:", error?.message || error);
    }
  };

  void run();
  pendingAppointmentExpiryWorker = setInterval(run, APPOINTMENT_EXPIRY_CHECK_MS);

  if (typeof pendingAppointmentExpiryWorker?.unref === "function") {
    pendingAppointmentExpiryWorker.unref();
  }

  return pendingAppointmentExpiryWorker;
}

async function loadAppointmentContext(appointmentId) {
  const appointment = await findAppointmentById(appointmentId);
  if (!appointment) return null;
  const student = await findStudentProfileByStudentNumber(appointment.student_number);
  return {
    appointment,
    student,
  };
}

async function notifyStudentAboutAppointment({
  appointment,
  student,
  title,
  message,
  kind,
  emailSubject,
  emailIntro,
  emailCta = "",
}) {
  await createStudentNotification({
    studentNumber: appointment.student_number,
    kind,
    title,
    message,
    metadata: {
      appointmentId: appointment.id,
      counselorId: appointment.counselor_id,
      counselorName: appointment.counselor_name,
    },
  });

  await sendAppointmentEmail({
    to: student?.email,
    subject: emailSubject,
    intro: emailIntro,
    appointment,
    ctaText: emailCta,
    context: `student notification (${kind})`,
  });
}

async function notifyCounselorAboutPendingAppointment({ appointment, student }) {
  await sendAppointmentEmail({
    to: appointment.counselor_email,
    subject: "New counseling appointment needs your response",
    intro: `${student?.full_name || appointment.student_number} requested a counseling session and needs your confirmation within 24 hours.`,
    appointment,
    ctaText: "Please open the admin scheduling panel to confirm, decline, or reschedule this request.",
    context: "counselor pending request notification",
  });
}

async function ensurePendingAppointmentStillOpen(appointment) {
  if (!isPendingAppointment(appointment?.status)) {
    return true;
  }

  const decisionDeadline = getDecisionDeadlineIso(appointment.created_at);
  if (decisionDeadline && decisionDeadline <= new Date().toISOString()) {
    await expirePendingAppointments();
    return false;
  }

  return true;
}

async function ensureStudentHasNoConfirmedAppointmentOnDate({
  studentNumber,
  appointmentDate,
  excludeAppointmentId = "",
}) {
  return ensureStudentHasNoActiveAppointmentOnDate({
    studentNumber,
    appointmentDate,
    excludeAppointmentId,
  });
}

async function findAppointmentById(appointmentId) {
  const result = await query(
    `
      select
        ca.id,
        ca.student_number,
        ca.counselor_id,
        ca.concern,
        ca.appointment_date,
        ca.slot_time,
        ca.status,
        ca.student_note,
        ca.counselor_gender_preference,
        ca.booking_source,
        ca.created_by_admin_email,
        ca.created_at,
        ca.updated_at,
        coalesce(sp.full_name, ca.student_number) as student_name,
        coalesce(sp.email, '') as student_email,
        coalesce(sp.program, '') as program,
        aa.email as counselor_email,
        coalesce(nullif(aa.full_name, ''), split_part(aa.email, '@', 1)) as counselor_name,
        coalesce(aa.role, 'COUNSELOR') as counselor_role,
        coalesce(aa.gender, 'Prefer not to say') as counselor_gender,
        coalesce(aa.profile_picture_url, '') as counselor_picture_url
      from public.counselor_appointments ca
      join public.admin_accounts aa on aa.id = ca.counselor_id
      left join public.student_profiles sp on sp.student_number = ca.student_number
      where ca.id = $1::uuid
      limit 1
    `,
    [appointmentId],
  );

  return result.rows[0] || null;
}

function toAppointmentResponse(row) {
  return {
    id: row.id,
    studentNumber: row.student_number,
    studentName: row.student_name || row.student_number,
    concern: row.concern,
    appointmentDate: normalizeDateValue(row.appointment_date),
    appointmentDateLabel: formatDateLong(row.appointment_date),
    slotTime: row.slot_time,
    slotLabel: toReadableTime(row.slot_time),
    status: row.status,
    studentNote: row.student_note || "",
    counselorGenderPreference: row.counselor_gender_preference || "No Preference",
    bookingSource: row.booking_source || "MOBILE_APP",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decisionDueAt: getDecisionDeadlineIso(row.created_at),
    counselor: {
      id: row.counselor_id,
      fullName: row.counselor_name,
      role: toRoleLabel(row.counselor_role),
      gender: row.counselor_gender,
      pictureUrl: row.counselor_picture_url || "",
    },
  };
}

async function listCounselors() {
  const result = await query(
    `
      select
        id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        coalesce(nullif(role, ''), 'COUNSELOR') as role,
        coalesce(nullif(gender, ''), 'Prefer not to say') as gender,
        coalesce(profile_picture_url, '') as profile_picture_url,
        coalesce(specialties, '[]'::jsonb) as specialties
      from public.admin_accounts
      where is_active = true
        and coalesce(role, 'COUNSELOR') in ('HEAD_COUNSELOR', 'COUNSELOR')
      order by case when coalesce(role, 'COUNSELOR') = 'HEAD_COUNSELOR' then 0 else 1 end, full_name asc
    `,
  );

  return result.rows;
}

async function ensureDefaultAvailability(counselorId) {
  const values = [];
  const params = [];
  let paramIndex = 1;

  for (const dayOfWeek of [1, 2, 3, 4, 5]) {
    for (const slotTime of DEFAULT_SLOT_TIMES) {
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, true)`);
      params.push(counselorId, dayOfWeek, slotTime);
      paramIndex += 3;
    }
  }

  await query(
    `
      insert into public.counselor_availability (counselor_id, day_of_week, slot_time, is_enabled)
      values ${values.join(", ")}
      on conflict (counselor_id, day_of_week, slot_time)
      where override_date is null
      do nothing
    `,
    params,
  );
}

async function ensureAvailabilityTemplates() {
  const counselors = await listCounselors();
  for (const counselor of counselors) {
    await ensureDefaultAvailability(counselor.id);
  }
  return counselors;
}

async function getAvailabilityMap(counselorId) {
  const result = await query(
    `
      select day_of_week, slot_time, is_enabled
      from public.counselor_availability
      where counselor_id = $1
        and override_date is null
      order by day_of_week asc, slot_time asc
    `,
    [counselorId],
  );

  const map = new Map();
  for (const row of result.rows) {
    const key = `${row.day_of_week}:${row.slot_time}`;
    map.set(key, Boolean(row.is_enabled));
  }
  return map;
}

async function getAvailabilityOverrideMap(counselorId, startDate, endDate) {
  const result = await query(
    `
      select override_date, slot_time, is_enabled
      from public.counselor_availability
      where counselor_id = $1
        and override_date is not null
        and override_date between $2::date and $3::date
      order by override_date asc, slot_time asc
    `,
    [counselorId, startDate, endDate],
  );

  const map = new Map();
  for (const row of result.rows) {
    const key = `${normalizeDateValue(row.override_date)}:${row.slot_time}`;
    map.set(key, Boolean(row.is_enabled));
  }
  return map;
}

async function getStudentBookedDateSet(studentNumber, startDate, endDate, excludeAppointmentId = "") {
  if (!studentNumber) {
    return new Set();
  }

  const result = await query(
    `
      select distinct appointment_date
      from public.counselor_appointments
      where student_number = $1
        and appointment_date between $2::date and $3::date
        and status = any($4::text[])
        and ($5::uuid is null or id <> $5::uuid)
    `,
    [studentNumber, startDate, endDate, ACTIVE_APPOINTMENT_STATUSES, excludeAppointmentId || null],
  );

  return new Set(result.rows.map((row) => normalizeDateValue(row.appointment_date)));
}

async function isCounselorSlotEnabledForDate(counselorId, isoDate, slotTime) {
  await ensureDefaultAvailability(counselorId);
  const dayOfWeek = toDayOfWeek(isoDate);
  const result = await query(
    `
      select coalesce(
        (
          select cao.is_enabled
          from public.counselor_availability cao
          where cao.counselor_id = $1
            and cao.override_date = $2::date
            and cao.slot_time = $3
          limit 1
        ),
        (
          select ca.is_enabled
          from public.counselor_availability ca
          where ca.counselor_id = $1
            and ca.override_date is null
            and ca.day_of_week = $4
            and ca.slot_time = $3
          limit 1
        ),
        false
      ) as is_enabled
    `,
    [counselorId, isoDate, slotTime, dayOfWeek],
  );

  return Boolean(result.rows[0]?.is_enabled);
}

async function getBookedSlotMap(counselorId, startDate, endDate) {
  const result = await query(
    `
      select appointment_date, slot_time
      from public.counselor_appointments
      where counselor_id = $1
        and appointment_date >= $2::date
        and appointment_date <= $3::date
        and status = any($4::text[])
    `,
    [counselorId, startDate, endDate, ACTIVE_APPOINTMENT_STATUSES],
  );

  const booked = new Set();
  for (const row of result.rows) {
    const isoDate = normalizeDateValue(row.appointment_date);
    if (!isoDate) continue;
    booked.add(`${isoDate}:${row.slot_time}`);
  }
  return booked;
}

async function findCounselorById(counselorId) {
  const result = await query(
    `
      select
        id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        coalesce(nullif(role, ''), 'COUNSELOR') as role,
        coalesce(nullif(gender, ''), 'Prefer not to say') as gender,
        coalesce(profile_picture_url, '') as profile_picture_url,
        coalesce(specialties, '[]'::jsonb) as specialties
      from public.admin_accounts
      where id = $1
        and is_active = true
        and coalesce(role, 'COUNSELOR') in ('HEAD_COUNSELOR', 'COUNSELOR')
      limit 1
    `,
    [counselorId],
  );

  return result.rows[0] || null;
}

router.get("/counselors", async (_req, res) => {
  const counselors = await ensureAvailabilityTemplates();
  return res.json({
    counselors: counselors.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: toRoleLabel(row.role),
      gender: row.gender,
      pictureUrl: row.profile_picture_url || "",
      specialties: Array.isArray(row.specialties) ? row.specialties : [],
    })),
    concernOptions: CONCERN_OPTIONS,
    slotTimes: DEFAULT_SLOT_TIMES.map((item) => ({
      value: item,
      label: toReadableTime(item),
    })),
  });
});

router.get("/availability", async (req, res) => {
  await expirePendingAppointments();
  const counselorId = String(req.query.counselorId || "").trim();
  const month = normalizeMonth(req.query.month || "");
  const studentNumber = String(req.query.studentNumber || "").trim();
  if (!counselorId || !month) {
    return res.status(400).json({ message: "Counselor and month are required." });
  }

  const counselor = await findCounselorById(counselorId);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }

  await ensureDefaultAvailability(counselorId);
  const availabilityMap = await getAvailabilityMap(counselorId);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  const startIsoDate = `${yearText}-${monthText}-01`;
  const endIsoDate = `${yearText}-${monthText}-${String(lastDay).padStart(2, "0")}`;
  const overrideMap = await getAvailabilityOverrideMap(counselorId, startIsoDate, endIsoDate);
  const bookedSlots = await getBookedSlotMap(counselorId, startIsoDate, endIsoDate);
  const studentBookedDates = await getStudentBookedDateSet(studentNumber, startIsoDate, endIsoDate);
  const todayIsoDate = getManilaDateParts().isoDate;
  const minimumStudentBookingDate = studentNumber ? getMinimumStudentBookingDate() : todayIsoDate;

  const days = Array.from({ length: lastDay }, (_, index) => {
    const dayNumber = index + 1;
    const isoDate = `${yearText}-${monthText}-${String(dayNumber).padStart(2, "0")}`;
    const dayOfWeek = toDayOfWeek(isoDate);
    const studentHasAppointmentOnDate = studentBookedDates.has(isoDate);
    const slots = DEFAULT_SLOT_TIMES.map((slotTime) => {
      const weeklyKey = `${dayOfWeek}:${slotTime}`;
      const overrideKey = `${isoDate}:${slotTime}`;
      const enabled = overrideMap.has(overrideKey)
        ? overrideMap.get(overrideKey) === true
        : availabilityMap.get(weeklyKey) === true;
      const isPast = isoDate < todayIsoDate;
      const blockedByLeadTime = studentNumber ? isoDate < minimumStudentBookingDate : false;
      const booked = bookedSlots.has(`${isoDate}:${slotTime}`);
      return {
        time: slotTime,
        label: toReadableTime(slotTime),
        available: enabled && !booked && !isPast && !studentHasAppointmentOnDate && !blockedByLeadTime,
        booked,
        blockedByLeadTime,
        enabled,
      };
    });

    return {
      blockedByLeadTime: studentNumber ? isoDate < minimumStudentBookingDate : false,
      date: isoDate,
      dayNumber,
      dayOfWeek,
      dayLabel: DAY_LABELS[dayOfWeek],
      isPast: isoDate < todayIsoDate,
      blockedByStudentSchedule: studentHasAppointmentOnDate,
      availableSlots: slots.filter((slot) => slot.available),
      slots,
    };
  });

  return res.json({
    counselor: {
      id: counselor.id,
      fullName: counselor.full_name,
      role: toRoleLabel(counselor.role),
      gender: counselor.gender,
      pictureUrl: counselor.profile_picture_url || "",
    },
    month,
    days,
  });
});

router.post("/book", async (req, res) => {
  await expirePendingAppointments();
  const studentNumber = String(req.body.studentNumber || "").trim();
  const counselorId = String(req.body.counselorId || "").trim();
  const appointmentDate = normalizeDate(req.body.appointmentDate || "");
  const slotTime = normalizeSlotTime(req.body.slotTime || "");
  const concern = normalizeConcern(req.body.concern || "");
  const studentNote = String(req.body.studentNote || "").trim();
  const counselorGenderPreference = String(req.body.counselorGenderPreference || "No Preference").trim();
  const bookingSource = String(req.body.bookingSource || "MOBILE_APP").trim().toUpperCase();
  const actorEmail = String(req.body.actorEmail || "").trim().toLowerCase();

  if (!studentNumber || !counselorId || !appointmentDate || !slotTime || !concern) {
    return res.status(400).json({ message: "Student, counselor, concern, date, and time are required." });
  }
  if (!DEFAULT_SLOT_TIMES.includes(slotTime)) {
    return res.status(400).json({ message: "Invalid appointment time." });
  }
  if (!BOOKING_SOURCES.has(bookingSource)) {
    return res.status(400).json({ message: "Invalid booking source." });
  }

  const todayIsoDate = getManilaDateParts().isoDate;
  if (appointmentDate < todayIsoDate) {
    return res.status(400).json({ message: "You cannot book a past appointment date." });
  }
  if (bookingSource === "MOBILE_APP" && appointmentDate < getMinimumStudentBookingDate()) {
    return res.status(400).json({
      message: `Appointments must be booked at least ${MOBILE_BOOKING_LEAD_DAYS} days ahead so counselors have 24 hours to respond.`,
    });
  }

  const counselor = await findCounselorById(counselorId);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }

  await ensureDefaultAvailability(counselorId);
  const isEnabled = await isCounselorSlotEnabledForDate(counselorId, appointmentDate, slotTime);
  if (!isEnabled) {
    return res.status(409).json({ message: "That time slot is not available for this counselor." });
  }

  const conflictResult = await query(
    `
      select id
      from public.counselor_appointments
      where counselor_id = $1
        and appointment_date = $2::date
        and slot_time = $3
        and status = any($4::text[])
      limit 1
    `,
    [counselorId, appointmentDate, slotTime, ACTIVE_APPOINTMENT_STATUSES],
  );

  if (conflictResult.rowCount > 0) {
    return res.status(409).json({ message: "That time slot has already been booked." });
  }

  const actorAdmin = bookingSource === "ADMIN_PANEL" ? await findAdminByEmail(actorEmail) : null;

  try {
    await ensureStudentHasNoActiveAppointmentOnDate({
      studentNumber,
      appointmentDate,
    });
  } catch (error) {
    return res.status(409).json({ message: error.message || "This student already has an appointment on that date." });
  }

  const insertResult = await query(
    `
      insert into public.counselor_appointments (
        student_number,
        counselor_id,
        concern,
        appointment_date,
        slot_time,
        status,
        student_note,
        counselor_gender_preference,
        booking_source,
        created_by_admin_email
      )
      values ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10)
      returning id, student_number, concern, appointment_date, slot_time, status, student_note, counselor_gender_preference, booking_source, created_by_admin_email, created_at
    `,
    [
      studentNumber,
      counselorId,
      concern,
      appointmentDate,
      slotTime,
      bookingSource === "ADMIN_PANEL" ? "CONFIRMED" : "PENDING",
      studentNote || null,
      counselorGenderPreference || null,
      bookingSource,
      actorAdmin?.email || null,
    ],
  );

  const appointment = insertResult.rows[0];
  const fullAppointment = await findAppointmentById(appointment.id);
  const student = await findStudentProfileByStudentNumber(studentNumber);
  if (bookingSource === "ADMIN_PANEL") {
    await writeAdminActivityLog({
      actionType: "APPOINTMENT_CREATED",
      actorEmail: actorAdmin?.email || actorEmail,
      actorName: actorAdmin?.full_name || actorEmail || "Admin",
      actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
      entityType: "APPOINTMENT",
      title: `${actorAdmin?.full_name || actorEmail || "Admin"} created ${toReadableTime(appointment.slot_time)}`,
      description: `${studentNumber} scheduled with ${counselor.full_name} on ${formatDateLong(appointment.appointment_date)}`,
      metadata: {
        appointmentId: appointment.id,
        appointmentDate,
        actorAdminId: actorAdmin?.id || null,
        counselorId,
        counselorName: counselor.full_name,
        ownerCounselorId: actorAdmin?.id || counselorId,
        slotTime,
        studentNumber,
      },
    });
  }

  if (bookingSource === "ADMIN_PANEL" && fullAppointment) {
    await notifyStudentAboutAppointment({
      appointment: fullAppointment,
      student,
      kind: "APPOINTMENT_CONFIRMED",
      title: "Appointment confirmed",
      message: `Your session with ${counselor.full_name} is set for ${formatDateLong(appointment.appointment_date)} at ${toReadableTime(appointment.slot_time)}.`,
      emailSubject: "Your counseling appointment is confirmed",
      emailIntro: `Your counseling appointment with ${counselor.full_name} has been confirmed.`,
      emailCta: "Please arrive a few minutes early for your session.",
    });
  }

  if (bookingSource === "MOBILE_APP" && fullAppointment) {
    await notifyStudentAboutAppointment({
      appointment: fullAppointment,
      student,
      kind: "APPOINTMENT_PENDING",
      title: "Appointment request submitted",
      message: `Your request with ${counselor.full_name} for ${formatDateLong(appointment.appointment_date)} at ${toReadableTime(appointment.slot_time)} is pending counselor confirmation within 24 hours.`,
      emailSubject: "Your counseling appointment request is pending",
      emailIntro: `Your counseling appointment request with ${counselor.full_name} is waiting for counselor confirmation.`,
      emailCta: "You will receive another notification once the counselor confirms, declines, or reschedules it.",
    });
    await notifyCounselorAboutPendingAppointment({
      appointment: fullAppointment,
      student,
    });
  }

  return res.status(201).json({
    message: bookingSource === "ADMIN_PANEL" ? "Appointment confirmed." : "Appointment request submitted.",
    appointment: {
      id: appointment.id,
      studentNumber: appointment.student_number,
      concern: appointment.concern,
      appointmentDate: appointment.appointment_date,
      appointmentDateLabel: formatDateLong(appointment.appointment_date),
      slotTime: appointment.slot_time,
      slotLabel: toReadableTime(appointment.slot_time),
      status: appointment.status,
      studentNote: appointment.student_note || "",
      counselorGenderPreference: appointment.counselor_gender_preference || "No Preference",
      bookingSource: appointment.booking_source || bookingSource,
      counselor: {
        id: counselor.id,
        fullName: counselor.full_name,
        role: toRoleLabel(counselor.role),
        gender: counselor.gender,
        pictureUrl: counselor.profile_picture_url || "",
      },
      decisionDueAt: getDecisionDeadlineIso(appointment.created_at),
    },
  });
});

router.post("/admin/:appointmentId/update", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const studentNumber = String(req.body.studentNumber || "").trim();
  const counselorId = String(req.body.counselorId || "").trim();
  const appointmentDate = normalizeDate(req.body.appointmentDate || "");
  const slotTime = normalizeSlotTime(req.body.slotTime || "");
  const concern = normalizeConcern(req.body.concern || "");
  const studentNote = String(req.body.studentNote || "").trim();
  const counselorGenderPreference = String(req.body.counselorGenderPreference || "No Preference").trim();
  const actorEmail = String(req.body.actorEmail || "").trim().toLowerCase();

  if (!appointmentId || !studentNumber || !counselorId || !appointmentDate || !slotTime || !concern) {
    return res.status(400).json({ message: "Student, counselor, concern, date, and time are required." });
  }
  if (!DEFAULT_SLOT_TIMES.includes(slotTime)) {
    return res.status(400).json({ message: "Invalid appointment time." });
  }
  if (appointmentDate < getManilaDateParts().isoDate) {
    return res.status(400).json({ message: "You cannot move an appointment to a past date." });
  }

  const existingAppointment = await findAppointmentById(appointmentId);
  if (!existingAppointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }

  const counselor = await findCounselorById(counselorId);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }

  await ensureDefaultAvailability(counselorId);
  const isEnabled = await isCounselorSlotEnabledForDate(counselorId, appointmentDate, slotTime);
  if (!isEnabled) {
    return res.status(409).json({ message: "That time slot is not available for this counselor." });
  }

  const conflictResult = await query(
    `
      select id
      from public.counselor_appointments
      where counselor_id = $1
        and appointment_date = $2::date
        and slot_time = $3
        and status = any($5::text[])
        and id <> $4::uuid
      limit 1
    `,
    [counselorId, appointmentDate, slotTime, appointmentId, ACTIVE_APPOINTMENT_STATUSES],
  );

  if (conflictResult.rowCount > 0) {
    return res.status(409).json({ message: "That time slot has already been booked." });
  }

  try {
    await ensureStudentHasNoActiveAppointmentOnDate({
      studentNumber,
      appointmentDate,
      excludeAppointmentId: appointmentId,
    });
  } catch (error) {
    return res.status(409).json({ message: error.message || "This student already has an appointment on that date." });
  }

  const actorAdmin = await findAdminByEmail(actorEmail);
  const actorCanManageDecision = canManageCounselorDecision(actorAdmin, existingAppointment);
  const isRescheduledRequestState =
    isPendingAppointment(existingAppointment.status) ||
    String(existingAppointment.status || "").toUpperCase() === "DECLINED";
  const nextStatus = isRescheduledRequestState && actorCanManageDecision
    ? "CONFIRMED"
    : existingAppointment.status;
  const updateResult = await query(
    `
      update public.counselor_appointments
      set
        student_number = $2,
        counselor_id = $3,
        concern = $4,
        appointment_date = $5::date,
        slot_time = $6,
        status = $7,
        student_note = $8,
        counselor_gender_preference = $9,
        updated_at = now()
      where id = $1::uuid
      returning id
    `,
    [
      appointmentId,
      studentNumber,
      counselorId,
      concern,
      appointmentDate,
      slotTime,
      nextStatus,
      studentNote || null,
      counselorGenderPreference || null,
    ],
  );

  const updatedAppointment = updateResult.rows[0] ? await findAppointmentById(updateResult.rows[0].id) : null;
  if (!updatedAppointment) {
    return res.status(404).json({ message: "Appointment not found after update." });
  }

  const student = await findStudentProfileByStudentNumber(studentNumber);
  await writeAdminActivityLog({
    actionType: "APPOINTMENT_UPDATED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Admin",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || actorEmail || "Admin"} updated ${toReadableTime(updatedAppointment.slot_time)}`,
    description: `${studentNumber} rescheduled with ${counselor.full_name} on ${formatDateLong(updatedAppointment.appointment_date)}`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate,
      counselorId,
      counselorName: counselor.full_name,
      ownerCounselorId: actorAdmin?.id || counselorId,
      previousAppointmentDate: normalizeDateValue(existingAppointment.appointment_date),
      previousCounselorId: existingAppointment.counselor_id,
      previousSlotTime: existingAppointment.slot_time,
      slotTime,
      studentNumber,
    },
  });

  await notifyStudentAboutAppointment({
    appointment: updatedAppointment,
    student,
    kind: nextStatus === "CONFIRMED" && isRescheduledRequestState ? "APPOINTMENT_CONFIRMED" : "APPOINTMENT_UPDATED",
    title: nextStatus === "CONFIRMED" && isRescheduledRequestState ? "Appointment rescheduled and confirmed" : "Appointment updated",
    message:
      nextStatus === "CONFIRMED" && isRescheduledRequestState
        ? `Your counselor moved your session to ${formatDateLong(updatedAppointment.appointment_date)} at ${toReadableTime(updatedAppointment.slot_time)}. The new schedule is already confirmed.`
        : `Your session is now on ${formatDateLong(updatedAppointment.appointment_date)} at ${toReadableTime(updatedAppointment.slot_time)} with ${counselor.full_name}.`,
    emailSubject:
      nextStatus === "CONFIRMED" && isRescheduledRequestState
        ? "Your counseling appointment was rescheduled and confirmed"
        : "Your counseling appointment was updated",
    emailIntro:
      nextStatus === "CONFIRMED" && isRescheduledRequestState
        ? `${counselor.full_name} rescheduled your appointment and confirmed the new time.`
        : `${counselor.full_name} updated your counseling appointment.`,
    emailCta:
      nextStatus === "CONFIRMED" && isRescheduledRequestState
        ? "Please review the updated confirmed schedule in the app."
        : "Please review the new schedule details in the app.",
  });

  return res.json({
    message: "Appointment updated.",
    appointment: toAppointmentResponse(updatedAppointment),
  });
});

router.post("/admin/:appointmentId/confirm", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const actorEmail = String(req.body.actorEmail || "").trim().toLowerCase();

  if (!appointmentId || !actorEmail) {
    return res.status(400).json({ message: "Appointment id and actor email are required." });
  }

  const context = await loadAppointmentContext(appointmentId);
  if (!context?.appointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }

  const actorAdmin = await findAdminByEmail(actorEmail);
  if (!canManageCounselorDecision(actorAdmin, context.appointment)) {
    return res.status(403).json({ message: "Only the assigned counselor or head counselor can confirm this request." });
  }
  if (!(await ensurePendingAppointmentStillOpen(context.appointment))) {
    return res.status(409).json({ message: "This appointment request already expired and was auto-declined." });
  }
  if (!isPendingAppointment(context.appointment.status)) {
    return res.status(409).json({ message: "Only pending appointment requests can be confirmed." });
  }

  await query(
    `
      update public.counselor_appointments
      set status = 'CONFIRMED', updated_at = now()
      where id = $1::uuid
    `,
    [appointmentId],
  );

  const updatedAppointment = await findAppointmentById(appointmentId);
  await writeAdminActivityLog({
    actionType: "APPOINTMENT_CONFIRMED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Counselor",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || "Counselor"} confirmed ${toReadableTime(context.appointment.slot_time)}`,
    description: `${context.appointment.student_name} was confirmed with ${context.appointment.counselor_name} on ${formatDateLong(context.appointment.appointment_date)}`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate: normalizeDateValue(context.appointment.appointment_date),
      counselorId: context.appointment.counselor_id,
      counselorName: context.appointment.counselor_name,
      ownerCounselorId: context.appointment.counselor_id,
      slotTime: context.appointment.slot_time,
      studentNumber: context.appointment.student_number,
    },
  });

  if (updatedAppointment) {
    await notifyStudentAboutAppointment({
      appointment: updatedAppointment,
      student: context.student,
      kind: "APPOINTMENT_CONFIRMED",
      title: "Appointment confirmed",
      message: `Your session with ${updatedAppointment.counselor_name} is confirmed for ${formatDateLong(updatedAppointment.appointment_date)} at ${toReadableTime(updatedAppointment.slot_time)}.`,
      emailSubject: "Your counseling appointment is confirmed",
      emailIntro: `${updatedAppointment.counselor_name} confirmed your counseling appointment.`,
      emailCta: "Please arrive a few minutes early for your session.",
    });
  }

  return res.json({
    message: "Appointment confirmed.",
    appointment: updatedAppointment ? toAppointmentResponse(updatedAppointment) : null,
  });
});

router.post("/admin/:appointmentId/decline", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const actorEmail = String(req.body.actorEmail || "").trim().toLowerCase();

  if (!appointmentId || !actorEmail) {
    return res.status(400).json({ message: "Appointment id and actor email are required." });
  }

  const context = await loadAppointmentContext(appointmentId);
  if (!context?.appointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }

  const actorAdmin = await findAdminByEmail(actorEmail);
  if (!canManageCounselorDecision(actorAdmin, context.appointment)) {
    return res.status(403).json({ message: "Only the assigned counselor or head counselor can decline this request." });
  }
  if (!(await ensurePendingAppointmentStillOpen(context.appointment))) {
    return res.status(409).json({ message: "This appointment request already expired and was auto-declined." });
  }
  if (!isPendingAppointment(context.appointment.status)) {
    return res.status(409).json({ message: "Only pending appointment requests can be declined." });
  }

  await query(
    `
      update public.counselor_appointments
      set status = 'DECLINED', updated_at = now()
      where id = $1::uuid
    `,
    [appointmentId],
  );

  await writeAdminActivityLog({
    actionType: "APPOINTMENT_DECLINED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Counselor",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || "Counselor"} declined ${toReadableTime(context.appointment.slot_time)}`,
    description: `${context.appointment.student_name}'s request with ${context.appointment.counselor_name} on ${formatDateLong(context.appointment.appointment_date)} was declined.`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate: normalizeDateValue(context.appointment.appointment_date),
      counselorId: context.appointment.counselor_id,
      counselorName: context.appointment.counselor_name,
      ownerCounselorId: context.appointment.counselor_id,
      slotTime: context.appointment.slot_time,
      studentNumber: context.appointment.student_number,
    },
  });

  await notifyStudentAboutAppointment({
    appointment: context.appointment,
    student: context.student,
    kind: "APPOINTMENT_DECLINED",
    title: "Appointment declined",
    message: `Your appointment request for ${formatDateLong(context.appointment.appointment_date)} at ${toReadableTime(context.appointment.slot_time)} was declined. Your counselor can still offer a different time later.`,
    emailSubject: "Your counseling appointment request was declined",
    emailIntro: `${context.appointment.counselor_name} declined your counseling appointment request.`,
    emailCta: "Please open the app if you want to request a different schedule.",
  });

  return res.json({
    message: "Appointment declined.",
  });
});

router.post("/admin/:appointmentId/cancel", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const actorEmail = String(req.body.actorEmail || "").trim().toLowerCase();

  if (!appointmentId) {
    return res.status(400).json({ message: "Appointment id is required." });
  }

  const existingAppointment = await findAppointmentById(appointmentId);
  if (!existingAppointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }

  const actorAdmin = await findAdminByEmail(actorEmail);
  await query(
    `
      update public.counselor_appointments
      set status = 'CANCELLED', updated_at = now()
      where id = $1::uuid
    `,
    [appointmentId],
  );

  await writeAdminActivityLog({
    actionType: "APPOINTMENT_CANCELLED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Admin",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || actorEmail || "Admin"} cancelled ${toReadableTime(existingAppointment.slot_time)}`,
    description: `${existingAppointment.student_number} cancelled with ${existingAppointment.counselor_name} on ${formatDateLong(existingAppointment.appointment_date)}`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate: normalizeDateValue(existingAppointment.appointment_date),
      counselorId: existingAppointment.counselor_id,
      counselorName: existingAppointment.counselor_name,
      ownerCounselorId: actorAdmin?.id || existingAppointment.counselor_id,
      slotTime: existingAppointment.slot_time,
      studentNumber: existingAppointment.student_number,
    },
  });

  await createStudentNotification({
    studentNumber: existingAppointment.student_number,
    kind: "APPOINTMENT_CANCELLED",
    title: "Appointment cancelled",
    message: `Your session on ${formatDateLong(existingAppointment.appointment_date)} at ${toReadableTime(existingAppointment.slot_time)} has been cancelled.`,
    metadata: {
      appointmentId,
      counselorId: existingAppointment.counselor_id,
      counselorName: existingAppointment.counselor_name,
    },
  });

  return res.json({
    message: "Appointment cancelled.",
  });
});

router.delete("/admin/:appointmentId", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const actorEmail = String(req.query.actorEmail || "").trim().toLowerCase();

  if (!appointmentId) {
    return res.status(400).json({ message: "Appointment id is required." });
  }

  const existingAppointment = await findAppointmentById(appointmentId);
  if (!existingAppointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }

  const actorAdmin = await findAdminByEmail(actorEmail);
  await query(
    `
      delete from public.counselor_appointments
      where id = $1::uuid
    `,
    [appointmentId],
  );

  await writeAdminActivityLog({
    actionType: "APPOINTMENT_DELETED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Admin",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || actorEmail || "Admin"} deleted ${toReadableTime(existingAppointment.slot_time)}`,
    description: `${existingAppointment.student_number} removed from ${existingAppointment.counselor_name} on ${formatDateLong(existingAppointment.appointment_date)}`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate: normalizeDateValue(existingAppointment.appointment_date),
      counselorId: existingAppointment.counselor_id,
      counselorName: existingAppointment.counselor_name,
      ownerCounselorId: actorAdmin?.id || existingAppointment.counselor_id,
      slotTime: existingAppointment.slot_time,
      studentNumber: existingAppointment.student_number,
    },
  });

  await createStudentNotification({
    studentNumber: existingAppointment.student_number,
    kind: "APPOINTMENT_DELETED",
    title: "Appointment removed",
    message: `Your session on ${formatDateLong(existingAppointment.appointment_date)} at ${toReadableTime(existingAppointment.slot_time)} has been removed.`,
    metadata: {
      appointmentId,
      counselorId: existingAppointment.counselor_id,
      counselorName: existingAppointment.counselor_name,
    },
  });

  return res.json({
    message: "Appointment deleted.",
  });
});

router.get("/student", async (req, res) => {
  await expirePendingAppointments();
  const studentNumber = String(req.query.studentNumber || "").trim();
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

  const result = await query(
    `
      select
        ca.id,
        ca.concern,
        ca.appointment_date,
        ca.slot_time,
        ca.status,
        ca.student_note,
        ca.booking_source,
        ca.created_at,
        coalesce(nullif(aa.full_name, ''), split_part(aa.email, '@', 1)) as counselor_name,
        coalesce(aa.role, 'COUNSELOR') as counselor_role,
        coalesce(aa.gender, 'Prefer not to say') as counselor_gender,
        coalesce(aa.profile_picture_url, '') as counselor_picture_url
      from public.counselor_appointments ca
      join public.admin_accounts aa on aa.id = ca.counselor_id
      where ca.student_number = $1
      order by ca.appointment_date desc, ca.slot_time desc
      limit 12
    `,
    [studentNumber],
  );

  const appointments = result.rows.map((row) => ({
    id: row.id,
    concern: row.concern,
    appointmentDate: normalizeDateValue(row.appointment_date),
    appointmentDateLabel: formatDateLong(row.appointment_date),
    slotTime: row.slot_time,
    slotLabel: toReadableTime(row.slot_time),
    status: row.status,
    studentNote: row.student_note || "",
    bookingSource: row.booking_source || "MOBILE_APP",
    createdAt: row.created_at,
    decisionDueAt: getDecisionDeadlineIso(row.created_at),
    counselor: {
      fullName: row.counselor_name,
      role: toRoleLabel(row.counselor_role),
      gender: row.counselor_gender,
      pictureUrl: row.counselor_picture_url || "",
    },
  }));

  const upcomingAppointment =
    appointments
      .filter((item) => isActiveAppointmentStatus(item.status) && item.appointmentDate >= getManilaDateParts().isoDate)
      .sort((a, b) =>
        `${a.appointmentDate} ${a.slotTime}`.localeCompare(`${b.appointmentDate} ${b.slotTime}`),
      )[0] || null;

  return res.json({
    appointments,
    upcomingAppointment,
  });
});

router.get("/admin/overview", async (req, res) => {
  await expirePendingAppointments();
  const selectedDate = normalizeDate(req.query.date || "") || getManilaDateParts().isoDate;
  const monthKey = `${selectedDate.slice(0, 7)}`;
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${String(new Date(Number(selectedDate.slice(0, 4)), Number(selectedDate.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
  const counselors = await ensureAvailabilityTemplates();
  const availabilityRows = await query(
    `
      select counselor_id, day_of_week, slot_time, is_enabled
      from public.counselor_availability
      where override_date is null
      order by counselor_id asc, day_of_week asc, slot_time asc
    `,
  );
  const availabilityOverrideRows = await query(
    `
      select counselor_id, override_date, slot_time, is_enabled
      from public.counselor_availability
      where override_date between $1::date and $2::date
      order by counselor_id asc, override_date asc, slot_time asc
    `,
    [monthStart, monthEnd],
  );
  const appointmentRows = await query(
    `
      select
        ca.id,
        ca.student_number,
        ca.concern,
        ca.appointment_date,
        ca.slot_time,
        ca.status,
        ca.student_note,
        ca.counselor_gender_preference,
        ca.booking_source,
        ca.created_by_admin_email,
        coalesce(sp.full_name, ca.student_number) as student_name,
        coalesce(sp.program, '') as program,
        aa.id as counselor_id,
        coalesce(nullif(aa.full_name, ''), split_part(aa.email, '@', 1)) as counselor_name,
        coalesce(aa.role, 'COUNSELOR') as counselor_role,
        coalesce(nullif(creator.full_name, ''), split_part(creator.email, '@', 1), ca.created_by_admin_email, '') as created_by_admin_name,
        coalesce(creator.role, 'COUNSELOR') as created_by_admin_role,
        ca.created_at
      from public.counselor_appointments ca
      join public.admin_accounts aa on aa.id = ca.counselor_id
      left join public.student_profiles sp on sp.student_number = ca.student_number
      left join public.admin_accounts creator on lower(creator.email) = lower(ca.created_by_admin_email)
      where ca.appointment_date >= $1::date
        and ca.appointment_date <= $2::date
      order by ca.slot_time asc, student_name asc
    `,
    [monthStart, monthEnd],
  );
  const adminActivityRows = await query(
    `
      select
        id,
        actor_email,
        actor_name,
        actor_role,
        action_type,
        entity_type,
        title,
        description,
        metadata,
        created_at
      from public.admin_activity_logs
      order by created_at desc
      limit 40
    `,
  );

  const availability = counselors.map((counselor) => ({
    counselorId: counselor.id,
    slots: availabilityRows.rows
      .filter((row) => row.counselor_id === counselor.id)
      .map((row) => ({
        dayOfWeek: row.day_of_week,
        dayLabel: DAY_LABELS[row.day_of_week],
        slotTime: row.slot_time,
        slotLabel: toReadableTime(row.slot_time),
        isEnabled: Boolean(row.is_enabled),
      })),
  }));

  const normalizedAppointments = appointmentRows.rows.map((row) => ({
    id: row.id,
    studentNumber: row.student_number,
    studentName: row.student_name,
    program: row.program || "",
    concern: row.concern,
    appointmentDate: normalizeDateValue(row.appointment_date),
    appointmentDateLabel: formatDateLong(row.appointment_date),
    slotTime: row.slot_time,
    slotLabel: toReadableTime(row.slot_time),
    status: row.status,
    statusLabel: toStatusLabel(row.status),
    studentNote: row.student_note || "",
    counselorGenderPreference: row.counselor_gender_preference || "No Preference",
    bookingSource: row.booking_source || "MOBILE_APP",
    counselorId: row.counselor_id,
    counselorName: row.counselor_name,
    counselorRole: toRoleLabel(row.counselor_role),
    createdByAdminEmail: row.created_by_admin_email || "",
    createdByAdminName: row.created_by_admin_name || "",
    createdByAdminRole: toRoleLabel(row.created_by_admin_role),
    createdAt: row.created_at,
    decisionDueAt: getDecisionDeadlineIso(row.created_at),
  }));

  return res.json({
    selectedDate,
    month: monthKey,
    counselors: counselors.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: toRoleLabel(row.role),
      gender: row.gender,
      pictureUrl: row.profile_picture_url || "",
      specialties: Array.isArray(row.specialties) ? row.specialties : [],
    })),
    appointments: normalizedAppointments.filter((item) => item.appointmentDate === selectedDate),
    monthAppointments: normalizedAppointments,
    availability,
    availabilityOverrides: availabilityOverrideRows.rows.map((row) => ({
      counselorId: row.counselor_id,
      overrideDate: normalizeDateValue(row.override_date),
      slotTime: row.slot_time,
      slotLabel: toReadableTime(row.slot_time),
      isEnabled: Boolean(row.is_enabled),
    })),
    recentActivity: [
      ...adminActivityRows.rows.map((row) => ({
        id: `admin-activity-${row.id}`,
        kind: String(row.action_type || "").toLowerCase(),
        title: row.title,
        description: row.description,
        actorName: row.actor_name || row.actor_email || "Admin",
        actorRole: row.actor_role || "Admin",
        counselorId: row.metadata?.ownerCounselorId || row.metadata?.actorAdminId || row.metadata?.counselorId || null,
        createdAt: row.created_at,
      })),
      ...normalizedAppointments
        .filter((item) => item.bookingSource !== "ADMIN_PANEL")
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 12)
        .map((item) => ({
          id: `appointment-${item.id}`,
          kind: "mobile_booking",
          title:
            String(item.status || "").toUpperCase() === "PENDING"
              ? `${item.studentName} requested ${item.slotLabel}`
              : `${item.studentName} booked ${item.slotLabel}`,
          description:
            String(item.status || "").toUpperCase() === "PENDING"
              ? `${item.concern} with ${item.counselorName} on ${formatDateLong(item.appointmentDate)}. Response due within 24 hours.`
              : `${item.concern} with ${item.counselorName} on ${formatDateLong(item.appointmentDate)}`,
          actorName: item.studentName,
          actorRole: "Student",
          counselorId: item.counselorId,
          createdAt: item.createdAt,
        })),
    ]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 18)
      .map((item) => ({
        ...item,
        createdAtLabel: formatRelativeDateTime(item.createdAt),
      })),
    concernOptions: CONCERN_OPTIONS,
    slotTimes: DEFAULT_SLOT_TIMES.map((item) => ({
      value: item,
      label: toReadableTime(item),
    })),
  });
});

router.get("/notifications", async (req, res) => {
  const studentNumber = String(req.query.studentNumber || "").trim();
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

  const result = await query(
    `
      select id, kind, title, message, metadata, is_read, read_at, created_at
      from public.student_notifications
      where student_number = $1
        and deleted_at is null
      order by created_at desc
      limit 50
    `,
    [studentNumber],
  );

  return res.json({
    notifications: result.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      message: row.message,
      metadata: row.metadata || {},
      isRead: Boolean(row.is_read),
      readAt: row.read_at,
      createdAt: row.created_at,
      timeLabel: formatRelativeDateTime(row.created_at),
    })),
    unreadCount: result.rows.filter((row) => !row.is_read).length,
  });
});

router.post("/notifications/:notificationId/read", async (req, res) => {
  const notificationId = String(req.params.notificationId || "").trim();
  const studentNumber = String(req.body.studentNumber || "").trim();

  if (!notificationId || !studentNumber) {
    return res.status(400).json({ message: "Notification id and student number are required." });
  }

  await query(
    `
      update public.student_notifications
      set is_read = true, read_at = now()
      where id = $1::uuid
        and student_number = $2
    `,
    [notificationId, studentNumber],
  );

  return res.json({ message: "Notification marked as read." });
});

router.post("/notifications/read-all", async (req, res) => {
  const studentNumber = String(req.body.studentNumber || "").trim();
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

  await query(
    `
      update public.student_notifications
      set is_read = true, read_at = now()
      where student_number = $1
        and is_read = false
    `,
    [studentNumber],
  );

  return res.json({ message: "Notifications marked as read." });
});

router.delete("/notifications/:notificationId", async (req, res) => {
  const notificationId = String(req.params.notificationId || "").trim();
  const studentNumber = String(req.query.studentNumber || "").trim();

  if (!notificationId || !studentNumber) {
    return res.status(400).json({ message: "Notification id and student number are required." });
  }

  await query(
    `
      update public.student_notifications
      set deleted_at = now()
      where id = $1::uuid
        and student_number = $2
        and deleted_at is null
    `,
    [notificationId, studentNumber],
  );

  return res.json({ message: "Notification deleted." });
});

router.post("/admin/availability/day", async (req, res) => {
  await expirePendingAppointments();
  const counselorId = String(req.body.counselorId || "").trim();
  const targetDate = normalizeDate(req.body.targetDate || "");
  const dayOfWeek = Number(req.body.dayOfWeek);
  const isEnabled = Boolean(req.body.isEnabled);
  const actorEmail = String(req.body.actorEmail || "").trim().toLowerCase();

  if (!counselorId || !targetDate) {
    return res.status(400).json({ message: "Counselor and target date are required." });
  }

  const counselor = await findCounselorById(counselorId);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }

  const resolvedDayOfWeek = toDayOfWeek(targetDate);
  if (!Number.isNaN(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6 && dayOfWeek !== resolvedDayOfWeek) {
    return res.status(400).json({ message: "Target date does not match the selected weekday." });
  }

  const values = [];
  const params = [];
  let paramIndex = 1;
  for (const slotTime of DEFAULT_SLOT_TIMES) {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, now())`);
    params.push(counselorId, targetDate, slotTime, isEnabled);
    paramIndex += 4;
  }

  await query(
    `
      insert into public.counselor_availability (
        counselor_id,
        day_of_week,
        override_date,
        slot_time,
        is_enabled,
        updated_at
      )
      values ${values.map((value) => value.replace("($", "($").replace(", $", ", null, $")).join(", ")}
      on conflict (counselor_id, override_date, slot_time)
      where override_date is not null
      do update set is_enabled = excluded.is_enabled, updated_at = now()
    `,
    params,
  );

  const actorAdmin = await findAdminByEmail(actorEmail);
  let cancelledAppointmentsCount = 0;

  if (!isEnabled) {
    const appointmentsToCancel = await query(
      `
        select
          ca.id,
          ca.student_number,
          ca.appointment_date,
          ca.slot_time,
          coalesce(nullif(aa.full_name, ''), split_part(aa.email, '@', 1)) as counselor_name
        from public.counselor_appointments ca
        join public.admin_accounts aa on aa.id = ca.counselor_id
        where ca.counselor_id = $1::uuid
          and ca.status = any($3::text[])
          and ca.appointment_date = $2::date
      `,
      [counselorId, targetDate, ACTIVE_APPOINTMENT_STATUSES],
    );

    if (appointmentsToCancel.rowCount > 0) {
      const appointmentIds = appointmentsToCancel.rows.map((row) => row.id);
      await query(
        `
          update public.counselor_appointments
          set status = 'CANCELLED', updated_at = now()
          where id = any($1::uuid[])
        `,
        [appointmentIds],
      );

      cancelledAppointmentsCount = appointmentsToCancel.rowCount;

      for (const appointment of appointmentsToCancel.rows) {
        await createStudentNotification({
          studentNumber: appointment.student_number,
          kind: "APPOINTMENT_CANCELLED",
          title: "Appointment cancelled",
          message: `Your session on ${formatDateLong(appointment.appointment_date)} at ${toReadableTime(appointment.slot_time)} has been cancelled because ${counselor.full_name} is unavailable that day.`,
          metadata: {
            appointmentId: appointment.id,
            cancellationReason: "COUNSELOR_DAY_OFF",
            counselorId,
            counselorName: appointment.counselor_name,
            dayOfWeek: resolvedDayOfWeek,
            dayLabel: DAY_LABELS[resolvedDayOfWeek],
            targetDate,
          },
        });
      }
    }
  }

  await writeAdminActivityLog({
    actionType: "AVAILABILITY_DAY_UPDATED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || counselor.full_name,
    actorRole: toRoleLabel(actorAdmin?.role || counselor.role),
    entityType: "SCHEDULING",
    title: `${actorAdmin?.full_name || counselor.full_name} marked ${formatDateLong(targetDate)} as ${isEnabled ? "available" : "off"}`,
    description: isEnabled
      ? `${counselor.full_name} is now available for all slots on ${formatDateLong(targetDate)}.`
      : `${counselor.full_name} is now off for all slots on ${formatDateLong(targetDate)}. ${cancelledAppointmentsCount} appointment${cancelledAppointmentsCount === 1 ? "" : "s"} were cancelled.`,
    metadata: {
      counselorId,
      counselorName: counselor.full_name,
      dayOfWeek: resolvedDayOfWeek,
      targetDate,
      isEnabled,
      slotTimes: DEFAULT_SLOT_TIMES,
      cancelledAppointmentsCount,
      ownerCounselorId: actorAdmin?.id || counselorId,
    },
  });

  return res.json({
    message: isEnabled
      ? `Date is now available for ${formatDateLong(targetDate)}.`
      : `Date marked as off for ${formatDateLong(targetDate)}. ${cancelledAppointmentsCount} appointment${cancelledAppointmentsCount === 1 ? "" : "s"} cancelled.`,
    day: {
      counselorId,
      dayOfWeek: resolvedDayOfWeek,
      dayLabel: DAY_LABELS[resolvedDayOfWeek],
      targetDate,
      isEnabled,
    },
    cancelledAppointmentsCount,
  });
});

router.post("/admin/availability", async (req, res) => {
  const counselorId = String(req.body.counselorId || "").trim();
  const slotTime = normalizeSlotTime(req.body.slotTime || "");
  const dayOfWeek = Number(req.body.dayOfWeek);
  const isEnabled = Boolean(req.body.isEnabled);
  const actorEmail = String(req.body.actorEmail || "").trim().toLowerCase();

  if (!counselorId || !DEFAULT_SLOT_TIMES.includes(slotTime) || Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return res.status(400).json({ message: "Counselor, day, and slot time are required." });
  }

  const counselor = await findCounselorById(counselorId);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }

  await query(
    `
      insert into public.counselor_availability (counselor_id, day_of_week, slot_time, is_enabled, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (counselor_id, day_of_week, slot_time)
      where override_date is null
      do update set is_enabled = excluded.is_enabled, updated_at = now()
    `,
    [counselorId, dayOfWeek, slotTime, isEnabled],
  );

  const actorAdmin = await findAdminByEmail(actorEmail);
  await writeAdminActivityLog({
    actionType: "AVAILABILITY_UPDATED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || counselor.full_name,
    actorRole: toRoleLabel(actorAdmin?.role || counselor.role),
    entityType: "SCHEDULING",
    title: `${actorAdmin?.full_name || counselor.full_name} ${isEnabled ? "opened" : "closed"} ${toReadableTime(slotTime)}`,
    description: `${DAY_LABELS[dayOfWeek]} availability updated for ${counselor.full_name}`,
    metadata: {
      counselorId,
      counselorName: counselor.full_name,
      dayOfWeek,
      slotTime,
      isEnabled,
    },
  });

  return res.json({
    message: "Availability updated.",
    availability: {
      counselorId,
      dayOfWeek,
      dayLabel: DAY_LABELS[dayOfWeek],
      slotTime,
      slotLabel: toReadableTime(slotTime),
      isEnabled,
    },
  });
});

router.startPendingAppointmentExpiryWorker = startPendingAppointmentExpiryWorker;

module.exports = router;
