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
  expiresInSeconds = 600,
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

  const expiryMinutes = Math.round(expiresInSeconds / 60);
  const expiryText = expiresInSeconds >= 60
    ? `${expiryMinutes} minute${expiryMinutes === 1 ? "" : "s"}`
    : `${expiresInSeconds} second${expiresInSeconds === 1 ? "" : "s"}`;
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
    <div style="margin:0;padding:24px 12px;background:#eef6ea;font-family:Arial,sans-serif;color:#203126;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d7e6d0;border-radius:18px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;background:linear-gradient(135deg,#386641 0%,#6a994e 100%);color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.88;">Bawat Tala Security</div>
            <div style="margin-top:8px;font-size:24px;line-height:1.3;font-weight:700;">${escapeHtml(heading)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#2b3d31;">Hi there,</p>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#2b3d31;">${escapeHtml(intro)}</p>
            <div style="margin:20px auto;max-width:340px;border:2px dashed #6a994e;border-radius:14px;background:#f6fbf3;padding:20px 24px;text-align:center;">
              <span style="font-size:40px;line-height:1;font-weight:700;letter-spacing:10px;color:#386641;font-family:monospace,Arial,sans-serif;">${escapeHtml(otp)}</span>
            </div>
            <div style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#f6fbf3;border:1px solid #dbead5;color:#2b3d31;font-size:14px;line-height:1.6;">
              This code will expire in <strong style="color:#386641;">${escapeHtml(expiryText)}</strong>.
            </div>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#5f7a5f;">${escapeHtml(ignoreText)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px;background:#f4faea;border-top:1px solid #d7e6d0;text-align:center;color:#5f7a5f;font-size:13px;line-height:1.6;">
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

async function sendPasswordResetCodeEmail({ to, code, expiresInSeconds = 600, context = "password reset" }) {
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
