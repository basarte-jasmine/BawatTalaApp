import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { OtpCodeInput } from "../components/forms/OtpCodeInput";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";
import { forgotPasswordResendCode, forgotPasswordVerifyCode } from "../lib/backend-api";

const OTP_LENGTH = 8;
const OTP_EXPIRY_SECONDS = 60;

export default function ResetPasswordOtpScreen() {
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = String(params.studentId || "").trim();
  const [otpCode, setOtpCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(30);
  const [otpExpiresAt, setOtpExpiresAt] = useState(Date.now() + OTP_EXPIRY_SECONDS * 1000);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setErrorMessage("Missing student ID. Please confirm your account again.");
    }
  }, [studentId]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleVerifyCode = async () => {
    if (!studentId) return;
    if (otpCode.trim().length !== OTP_LENGTH) {
      setErrorMessage("Please enter the 8-digit OTP.");
      return;
    }
    if (Date.now() > otpExpiresAt) {
      setErrorMessage("The code has expired or is invalid. Please try again");
      return;
    }

    setErrorMessage("");
    setIsBusy(true);
    const result = await forgotPasswordVerifyCode(studentId, otpCode.trim());
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "The code has expired or is invalid. Please try again");
      return;
    }

    router.push({
      pathname: "/reset-password-new",
      params: { studentId },
    });
  };

  const handleResendCode = async () => {
    if (!studentId || resendSeconds > 0) return;

    setIsBusy(true);
    const result = await forgotPasswordResendCode(studentId);
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Failed to send reset code.");
      return;
    }

    setResendSeconds(30);
    setOtpExpiresAt(Date.now() + OTP_EXPIRY_SECONDS * 1000);
    setOtpCode("");
    setErrorMessage("");
  };

  return (
    <AuthCardLayout contentContainerStyle={styles.content} cardStyle={styles.card}>
      <Text style={styles.title}>Enter verification code</Text>
      <Text style={styles.subtitle}>
        Enter the reset code sent to your email.
      </Text>

      <Text style={styles.label}>Verification Code</Text>
      <OtpCodeInput
        length={OTP_LENGTH}
        value={otpCode}
        onChangeCode={setOtpCode}
        containerStyle={styles.otpRow}
      />

      <AppPrimaryButton
        label={isBusy ? "Verifying..." : "Verify Code"}
        onPress={handleVerifyCode}
        containerStyle={styles.actionButton}
      />

      <AppPrimaryButton
        label={resendSeconds > 0 ? `Send reset code in ${resendSeconds}s` : "Send reset code"}
        onPress={handleResendCode}
        disabled={resendSeconds > 0}
        containerStyle={[styles.resendButton, resendSeconds > 0 && styles.disabledButton]}
        labelStyle={styles.resendButtonText}
      />

      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

      <Pressable style={styles.linkButton} onPress={() => router.replace("/reset-password")}>
        <Text style={styles.linkText}>
          Go back to <Text style={styles.linkAccent}>confirm account</Text>
        </Text>
      </Pressable>
    </AuthCardLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "center",
  },
  card: {
    maxWidth: 320,
  },
  title: {
    textAlign: "center",
    color: "#111111",
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Fraunces-Regular",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    color: "#1A1A1A",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
  },
  label: {
    color: "#111111",
    fontSize: 14,
    marginBottom: 8,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  actionButton: {
    marginBottom: 12,
  },
  resendButton: {
    marginBottom: 12,
    backgroundColor: "#E4EDF5",
  },
  resendButtonText: {
    color: "#2D3F4E",
  },
  disabledButton: {
    opacity: 0.7,
  },
  errorText: {
    color: "#C31A1A",
    fontSize: 12,
    marginBottom: 12,
  },
  linkButton: {
    alignItems: "center",
  },
  linkText: {
    color: "#111111",
    fontSize: 13,
  },
  linkAccent: {
    color: "#2C7DB0",
  },
});
