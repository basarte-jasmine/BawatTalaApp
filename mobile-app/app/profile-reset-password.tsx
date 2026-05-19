import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PasswordField } from "../components/forms/PasswordField";
import {
  forgotPasswordResendCode,
  forgotPasswordReset,
  forgotPasswordVerifyCode,
  profilePasswordSendCode,
} from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";
import { isValidStudentId, normalizeStudentIdInput } from "../lib/auth-validation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 8;
const OTP_EXPIRY_SECONDS = 60;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

type Step = "account" | "code" | "password" | "done";
type ReturnSection = "personal-details" | "privacy-security";

function normalizeEmailInput(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCodeInput(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH);
}

function getReturnSection(value: string | undefined): ReturnSection | null {
  if (value === "personal-details" || value === "privacy-security") {
    return value;
  }
  return null;
}

function getPasswordStrength(value: string) {
  const checks = [
    value.length >= 8,
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z\d]/.test(value),
  ];
  const score = checks.filter(Boolean).length;

  if (!value) {
    return { label: "", color: "#DDE4EB", progress: 0 };
  }
  if (score >= 5) {
    return { label: "Strong", color: "#4E9B37", progress: "100%" as const };
  }
  if (score >= 3) {
    return { label: "Good", color: "#D89921", progress: "66%" as const };
  }
  return { label: "Weak", color: "#D24C59", progress: "33%" as const };
}

export default function ProfileResetPasswordScreen() {
  const { returnSection: returnSectionParam } = useLocalSearchParams<{ returnSection?: string }>();
  const { user } = useAuthSession();
  const returnSection = getReturnSection(returnSectionParam);
  const returnPath = returnSection ? `/profile-settings?section=${returnSection}` : "/profile";
  const returnLabel =
    returnSection === "privacy-security"
      ? "Back to Privacy & Security"
      : returnSection === "personal-details"
        ? "Back to Personal Details"
        : "Back to Profile";
  const [step, setStep] = useState<Step>("account");
  const [studentId, setStudentId] = useState("");
  const [verifiedStudentId, setVerifiedStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const passwordStrength = getPasswordStrength(newPassword);

  useEffect(() => {
    setStudentId((current) => current || user?.studentNumber || "");
    setEmail((current) => current || user?.email || "");
  }, [user?.email, user?.studentNumber]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleReturnToProfile = () => {
    router.replace(returnPath as never);
  };

  const handleBack = () => {
    if (step === "password") {
      setStep("code");
      setErrorMessage("");
      return;
    }
    if (step === "code") {
      setStep("account");
      setErrorMessage("");
      return;
    }
    if (returnSection) {
      handleReturnToProfile();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/profile");
  };

  const handleSendCode = async () => {
    const studentNumber = normalizeStudentIdInput(studentId);
    const emailValue = normalizeEmailInput(email);

    if (!studentNumber) {
      setErrorMessage("Student ID is required.");
      return;
    }
    if (!isValidStudentId(studentNumber)) {
      setErrorMessage("Enter Student ID in 23-2903 format.");
      return;
    }
    if (!emailValue) {
      setErrorMessage("Email is required.");
      return;
    }
    if (!EMAIL_PATTERN.test(emailValue)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsBusy(true);
    const result = await profilePasswordSendCode(studentNumber, emailValue);
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message || "Student ID and email do not match.");
      return;
    }

    setVerifiedStudentId(studentNumber);
    setEmail(emailValue);
    setOtpCode("");
    setOtpExpiresAt(Date.now() + OTP_EXPIRY_SECONDS * 1000);
    setResendSeconds(60);
    setSuccessMessage("Verification code sent to your email.");
    setStep("code");
  };

  const handleVerifyCode = async () => {
    if (!verifiedStudentId) {
      setErrorMessage("Please verify your account again.");
      setStep("account");
      return;
    }
    if (otpCode.length !== OTP_LENGTH) {
      setErrorMessage("Enter the 8-digit verification code.");
      return;
    }
    if (Date.now() > otpExpiresAt) {
      setErrorMessage("The code has expired. Send a new code and try again.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsBusy(true);
    const result = await forgotPasswordVerifyCode(verifiedStudentId, otpCode);
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message || "The code is invalid or expired.");
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setStep("password");
  };

  const handleResendCode = async () => {
    if (!verifiedStudentId || resendSeconds > 0) return;

    setErrorMessage("");
    setSuccessMessage("");
    setIsBusy(true);
    const result = await forgotPasswordResendCode(verifiedStudentId);
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message || "Failed to send reset code.");
      return;
    }

    setOtpCode("");
    setOtpExpiresAt(Date.now() + OTP_EXPIRY_SECONDS * 1000);
    setResendSeconds(60);
    setSuccessMessage("A new verification code was sent.");
  };

  const handleResetPassword = async () => {
    if (!verifiedStudentId) {
      setErrorMessage("Please verify your account again.");
      setStep("account");
      return;
    }
    if (!newPassword) {
      setErrorMessage("New password is required.");
      return;
    }
    if (!STRONG_PASSWORD_PATTERN.test(newPassword)) {
      setErrorMessage("Choose a stronger password.");
      return;
    }
    if (!confirmPassword) {
      setErrorMessage("Confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsBusy(true);
    const result = await forgotPasswordReset(verifiedStudentId, newPassword, confirmPassword);
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message || "Unable to reset password.");
      return;
    }

    setSuccessMessage("Password updated successfully.");
    setStep("done");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={30} color="#3D3F43" />
        </Pressable>
        <Text style={styles.topTitle}>Reset Password</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="key-outline" size={28} color="#5A8A36" />
            </View>
            <Text style={styles.heroTitle}>
              {step === "done" ? "Password Updated" : "Secure Account Reset"}
            </Text>
            <Text style={styles.heroBody}>
              {step === "account"
                ? "Enter your Student ID and account email. If they match, we'll send a verification code."
                : step === "code"
                  ? "Type the verification code sent to your email."
                  : step === "password"
                    ? "Create a strong password you have not used recently."
                    : "Your new password is ready to use the next time you sign in."}
            </Text>
          </View>

          <View style={styles.card}>
            {step === "account" ? (
              <>
                <FieldLabel label="Student ID" />
                <TextInput
                  value={studentId}
                  onChangeText={(value) => {
                    setStudentId(value.replace(/[^0-9-]/g, "").slice(0, 7));
                    if (errorMessage) setErrorMessage("");
                  }}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  maxLength={7}
                  placeholder="23-2903"
                  placeholderTextColor="#97A1AA"
                  style={styles.textInput}
                />

                <FieldLabel label="Email" />
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@example.com"
                  placeholderTextColor="#97A1AA"
                  style={styles.textInput}
                />

                <PrimaryAction label={isBusy ? "Checking..." : "Send Verification Code"} onPress={handleSendCode} />
              </>
            ) : null}

            {step === "code" ? (
              <>
                <Text style={styles.sectionTitle}>Verification Code</Text>
                <TextInput
                  value={otpCode}
                  onChangeText={(value) => {
                    setOtpCode(normalizeCodeInput(value));
                    if (errorMessage) setErrorMessage("");
                  }}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  placeholder="8-digit code"
                  placeholderTextColor="#97A1AA"
                  style={[styles.textInput, styles.codeInput]}
                />

                <PrimaryAction label={isBusy ? "Verifying..." : "Verify Code"} onPress={handleVerifyCode} />
                <Pressable
                  style={[styles.secondaryButton, resendSeconds > 0 && styles.disabledButton]}
                  disabled={resendSeconds > 0 || isBusy}
                  onPress={() => void handleResendCode()}
                >
                  <Text style={styles.secondaryText}>
                    {resendSeconds > 0 ? `Send new code in ${resendSeconds}s` : "Send New Code"}
                  </Text>
                </Pressable>
              </>
            ) : null}

            {step === "password" ? (
              <>
                <PasswordField
                  label="New Password"
                  value={newPassword}
                  onChangeText={(value) => {
                    setNewPassword(value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  showPassword={showNewPassword}
                  onToggleVisibility={() => setShowNewPassword((current) => !current)}
                  placeholder="Enter new password"
                  placeholderTextColor="#97A1AA"
                  containerStyle={styles.passwordField}
                  inputWrapStyle={styles.passwordWrap}
                  inputStyle={styles.passwordInput}
                />
                {!!newPassword && (
                  <View style={styles.passwordStrengthWrap}>
                    <View style={styles.passwordStrengthTrack}>
                      <View
                        style={[
                          styles.passwordStrengthFill,
                          { width: passwordStrength.progress, backgroundColor: passwordStrength.color },
                        ]}
                      />
                    </View>
                    <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                      {passwordStrength.label}
                    </Text>
                  </View>
                )}
                <PasswordField
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  showPassword={showConfirmPassword}
                  onToggleVisibility={() => setShowConfirmPassword((current) => !current)}
                  placeholder="Confirm new password"
                  placeholderTextColor="#97A1AA"
                  containerStyle={styles.passwordField}
                  inputWrapStyle={styles.passwordWrap}
                  inputStyle={styles.passwordInput}
                />
                <PrimaryAction label={isBusy ? "Updating..." : "Update Password"} onPress={handleResetPassword} />
              </>
            ) : null}

            {step === "done" ? (
              <>
                <View style={styles.doneIcon}>
                  <Ionicons name="checkmark" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.doneTitle}>Password updated successfully</Text>
                <Text style={styles.doneBody}>Your account password has been changed.</Text>
                <PrimaryAction label={returnLabel} onPress={handleReturnToProfile} />
              </>
            ) : null}

            {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
            {!!successMessage && <Text style={styles.successText}>{successMessage}</Text>}
            {step !== "done" ? (
              <Pressable style={styles.profileReturnLink} onPress={handleReturnToProfile}>
                <Text style={styles.profileReturnText}>{returnLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function PrimaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFC" },
  topBar: {
    height: 52,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#314258", fontSize: 17, lineHeight: 23, fontWeight: "700" },
  topBarSpacer: { width: 38, height: 38 },
  keyboardView: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 30 },
  hero: {
    borderRadius: 22,
    backgroundColor: "#F1F9EB",
    borderWidth: 1,
    borderColor: "#DDECCF",
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 14,
    alignItems: "center",
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DAEAC8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  heroTitle: {
    color: "#304558",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 5,
  },
  heroBody: {
    color: "#5A6B7A",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  card: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EEF4",
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  fieldLabel: {
    color: "#304558",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionTitle: {
    color: "#304558",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  textInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE4EB",
    backgroundColor: "#FAFCFD",
    paddingHorizontal: 12,
    fontSize: 15,
    lineHeight: 20,
    color: "#2D4053",
    marginBottom: 12,
  },
  codeInput: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, lineHeight: 20, fontWeight: "800" },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE4EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryText: { color: "#3D5569", fontSize: 15, lineHeight: 20, fontWeight: "800" },
  disabledButton: { opacity: 0.62 },
  passwordField: {
    marginBottom: 4,
  },
  passwordWrap: {
    minHeight: 48,
    borderRadius: 14,
    borderColor: "#DDE4EB",
    backgroundColor: "#FAFCFD",
    marginBottom: 10,
  },
  passwordInput: {
    color: "#2D4053",
    fontSize: 15,
  },
  passwordStrengthWrap: {
    marginTop: -4,
    marginBottom: 12,
  },
  passwordStrengthTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: "#E7EEF4",
    overflow: "hidden",
  },
  passwordStrengthFill: {
    height: "100%",
    borderRadius: 999,
  },
  passwordStrengthText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 5,
  },
  doneIcon: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  doneTitle: {
    color: "#304558",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  doneBody: {
    color: "#5A6B7A",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 14,
  },
  errorText: {
    color: "#D24C59",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  successText: {
    color: "#4E8334",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  profileReturnLink: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 2,
  },
  profileReturnText: {
    color: "#2E6D7A",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
});
