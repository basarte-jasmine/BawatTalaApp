import { Platform } from "react-native";

function getDefaultApiBaseUrl() {
  return Platform.OS === "android"
    ? "http://10.0.2.2:4001"
    : "http://localhost:4001";
}

function normalizeApiBaseUrl(rawUrl: string) {
  if (
    Platform.OS === "android" &&
    (rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1"))
  ) {
    return rawUrl
      .replace("localhost", "10.0.2.2")
      .replace("127.0.0.1", "10.0.2.2");
  }
  return rawUrl;
}

const API_BASE_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? getDefaultApiBaseUrl(),
);

type ApiResult = {
  ok: boolean;
  message?: string;
};

async function post(path: string, payload: Record<string, string>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function sendOtp(email: string): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/send-otp", { email });
  return { ok: response.ok, message: data?.message };
}

export async function loginWithStudentId(
  studentNumber: string,
  password: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/login", {
    studentNumber,
    password,
  });
  return { ok: response.ok, message: data?.message };
}

export async function forgotPasswordSendCode(
  studentNumber: string,
  password: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/forgot-password/send-code", {
    studentNumber,
    password,
  });
  return { ok: response.ok, message: data?.message };
}

export async function forgotPasswordResendCode(
  studentNumber: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/forgot-password/resend-code", {
    studentNumber,
  });
  return { ok: response.ok, message: data?.message };
}

export async function forgotPasswordVerifyCode(
  studentNumber: string,
  token: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/forgot-password/verify-code", {
    studentNumber,
    token,
  });
  return { ok: response.ok, message: data?.message };
}

export async function forgotPasswordReset(
  studentNumber: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/forgot-password/reset", {
    studentNumber,
    newPassword,
    confirmPassword,
  });
  return { ok: response.ok, message: data?.message };
}

export async function verifyOtp(
  email: string,
  token: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/verify-otp", {
    email,
    token,
  });
  return { ok: response.ok, message: data?.message };
}

export async function registerProfile(payload: {
  fullName: string;
  studentNumber: string;
  program: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
  street: string;
  email: string;
  birthdate: string;
  password: string;
}): Promise<ApiResult> {
  const { response, data } = await post(
    "/api/auth/register-profile",
    payload as unknown as Record<string, string>,
  );
  return { ok: response.ok, message: data?.message };
}

export async function scanSchoolId(imageBase64: string): Promise<{
  ok: boolean;
  isValidId: boolean;
  ocrText: string;
  message?: string;
}> {
  const { response, data } = await post("/api/ocr/scan-id", { imageBase64 });
  return {
    ok: response.ok,
    isValidId: Boolean(data?.isValidId),
    ocrText: data?.ocrText ?? "",
    message: data?.message,
  };
}
