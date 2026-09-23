const rateLimit = require("express-rate-limit");

function jsonRateLimitHandler(_req, res, _next, options) {
  res.status(options.statusCode).json({
    message: options.message?.message || "Too many requests. Please try again later.",
  });
}

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
  handler: jsonRateLimitHandler,
});

const authOtpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many verification emails requested. Please try again later." },
  handler: jsonRateLimitHandler,
});

const authOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many verification attempts. Please try again later." },
  handler: jsonRateLimitHandler,
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many admin login attempts. Please try again in 15 minutes." },
  handler: jsonRateLimitHandler,
});

module.exports = {
  authLoginLimiter,
  authOtpSendLimiter,
  authOtpVerifyLimiter,
  adminLoginLimiter,
};
