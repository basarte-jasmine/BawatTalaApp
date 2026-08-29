function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function looksLikePlaceholderSecret(value) {
  const text = String(value || "").trim().toLowerCase();
  return !text || text.includes("your_") || text.includes("placeholder") || text.includes("replace_me");
}

function isLikelyEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function formatOtp(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 4 ? digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim() : digits;
}

async function sendAuthCodeEmail({
  to,
  code,
  expiresInSeconds = 60,
  context = "verification",
  subject = "Your verification code",
  heading = "Verify Your Request",
  intro = "Use the verification code below to continue:",
  ignoreText = "If you did not request this, you can safely ignore this email.",
}) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(
    process.env.AUTH_EMAIL_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.APPOINTMENT_EMAIL_FROM ||
      "",
  ).trim();
  const recipient = String(to || "").trim();
  const otp = formatOtp(code);

  if (!recipient || !isLikelyEmailAddress(recipient)) {
    console.warn(`Auth email skipped for ${context}: invalid recipient.`);
    return { ok: false, skipped: true, reason: "invalid-recipient" };
  }
  if (!otp) {
    console.warn(`Auth email skipped for ${context}: missing OTP.`);
    return { ok: false, skipped: true, reason: "missing-otp" };
  }
  if (looksLikePlaceholderSecret(apiKey)) {
    console.warn(`Auth email skipped for ${context}: RESEND_API_KEY is missing or still a placeholder.`);
    return { ok: false, skipped: true, reason: "invalid-api-key" };
  }
  if (!from || !isLikelyEmailAddress(from)) {
    console.warn(`Auth email skipped for ${context}: invalid sender address.`);
    return { ok: false, skipped: true, reason: "invalid-sender" };
  }

  const expiryText = `${expiresInSeconds} second${expiresInSeconds === 1 ? "" : "s"}`;
  const text = [
    "Hi there,",
    "",
    intro,
    "",
    otp,
    "",
    `This code will expire in ${expiryText}.`,
    "",
    ignoreText,
    "",
    "This is an automated security message.",
    "© 2026 Bawat Tala. All rights reserved.",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:28px 24px;background:#4a90e2;color:#ffffff;text-align:center;">
            <div style="font-size:28px;line-height:1.25;font-weight:700;">${escapeHtml(heading)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 38px 34px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Hi there,</p>
            <p style="margin:0 0 26px;font-size:16px;line-height:1.6;">${escapeHtml(intro)}</p>
            <div style="margin:0 auto 28px;max-width:320px;border:2px dashed #4a90e2;border-radius:10px;padding:22px 24px;text-align:center;">
              <span style="font-size:42px;line-height:1;font-weight:700;letter-spacing:10px;color:#4a90e2;">${escapeHtml(otp)}</span>
            </div>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">This code will expire in <strong>${escapeHtml(expiryText)}</strong>.</p>
            <p style="margin:0;font-size:16px;line-height:1.6;color:#374151;">${escapeHtml(ignoreText)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 24px;background:#eeeeee;text-align:center;color:#6b7280;font-size:14px;line-height:1.6;">
            <div>This is an automated security message.</div>
            <div>© 2026 Bawat Tala. All rights reserved.</div>
          </td>
        </tr>
      </table>
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
        text,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `Auth email failed for ${context} to ${recipient}: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
      );
      return { ok: false, skipped: false, reason: "provider-error" };
    }

    return { ok: true };
  } catch (error) {
    console.error(`Failed to send auth email for ${context} to ${recipient}:`, error);
    return { ok: false, skipped: false, reason: "request-error" };
  }
}

async function sendPasswordResetCodeEmail({ to, code, expiresInSeconds = 60, context = "password reset" }) {
  return sendAuthCodeEmail({
    to,
    code,
    expiresInSeconds,
    context,
    subject: "Reset Your Password",
    heading: "Reset Your Password",
    intro: "We received a request to reset your password. Use the verification code below to continue:",
    ignoreText: "If you did not request a password reset, you can safely ignore this email.",
  });
}

module.exports = {
  sendAuthCodeEmail,
  sendPasswordResetCodeEmail,
};
