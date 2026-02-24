import { Ionicons } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FormTextInput } from "../components/forms/FormTextInput";
import { OtpCodeInput } from "../components/forms/OtpCodeInput";
import { SelectField } from "../components/forms/SelectField";
import { StepProgress } from "../components/forms/StepProgress";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";
import {
  registerProfile,
  scanSchoolId,
  sendOtp,
  verifyOtp,
} from "../lib/backend-api";
import { formatBirthdate, normalizeStudentNumber } from "../lib/format";
import { parseIdText } from "../lib/ocr-parse";
import {
  BARANGAY_OPTIONS,
  FIXED_ADDRESS,
  PROGRAM_OPTIONS,
} from "../lib/register-data";
import {
  isLikelySchoolId,
  isValidBirthdate,
  isValidName,
  isValidStudentNumber,
} from "../lib/register-validation";

const TOTAL_STEPS = 5;
const OTP_LENGTH = 8;
const OTP_EXPIRY_SECONDS = 60;

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [program, setProgram] = useState("");
  const [barangay, setBarangay] = useState("");
  const [street, setStreet] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [scanPreviewUri, setScanPreviewUri] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [hasValidIdScan, setHasValidIdScan] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const canProceedStepTwo = useMemo(() => {
    return (
      isValidName(fullName) &&
      isValidStudentNumber(studentNumber) &&
      Boolean(program)
    );
  }, [fullName, studentNumber, program]);

  const canProceedStepThree = useMemo(() => {
    return Boolean(barangay) && Boolean(street.trim());
  }, [barangay, street]);

  const canProceedStepFour = useMemo(() => {
    return (
      email.includes("@") && isValidBirthdate(birthdate) && Boolean(password)
    );
  }, [email, birthdate, password]);

  const handleBack = () => {
    setErrorMessage("");
    if (step === 1) {
      router.back();
      return;
    }
    setStep((prev) => prev - 1);
  };

  const handleScanId = async () => {
    setErrorMessage("");
    const ImagePicker = await import("expo-image-picker");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage("Photo permission is required to scan your ID.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setScanPreviewUri(asset.uri);
    setScanMessage("Scanning...");
    setHasValidIdScan(false);
    setIsBusy(true);

    if (!asset.base64) {
      setIsBusy(false);
      setScanMessage("Could not read selected image data.");
      return;
    }

    const scanResult = await scanSchoolId(asset.base64);
    setIsBusy(false);

    if (!scanResult.ok) {
      setScanMessage(
        scanResult.message ?? "OCR scan failed. Please try again.",
      );
      return;
    }

    if (
      !scanResult.isValidId ||
      !scanResult.ocrText ||
      !isLikelySchoolId(scanResult.ocrText)
    ) {
      setScanMessage(
        "Uploaded image does not appear to be a valid school ID. Please try again using a clearer image or different ID.",
      );
      return;
    }

    const parsed = parseIdText(scanResult.ocrText);
    if (parsed.fullName) setFullName(parsed.fullName);
    if (parsed.studentNumber)
      setStudentNumber(normalizeStudentNumber(parsed.studentNumber));
    if (parsed.program) setProgram(parsed.program);
    setScanMessage("ID scanned successfully. Proceed to continue.");
    setHasValidIdScan(true);
  };

  const handleSendOtp = async () => {
    setErrorMessage("");
    if (!canProceedStepFour) {
      setErrorMessage(
        "Please complete all required fields before sending OTP.",
      );
      return;
    }

    setIsBusy(true);
    const result = await sendOtp(email.trim().toLowerCase());
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Failed to send OTP.");
      return;
    }

    setResendSeconds(30);
    setOtpExpiresAt(Date.now() + OTP_EXPIRY_SECONDS * 1000);
    setOtpCode("");
    setStep(5);
  };

  const handleVerifyAndFinish = async () => {
    setErrorMessage("");
    if (otpCode.trim().length !== OTP_LENGTH) {
      setErrorMessage("Please enter the 8-digit OTP.");
      return;
    }
    if (otpExpiresAt && Date.now() > otpExpiresAt) {
      setErrorMessage("The code has expired or is invalid. Please try again.");
      return;
    }

    setIsBusy(true);
    const verifyResult = await verifyOtp(
      email.trim().toLowerCase(),
      otpCode.trim(),
    );
    if (!verifyResult.ok) {
      setIsBusy(false);
      const message = (verifyResult.message ?? "").toLowerCase();
      if (message.includes("expired") || message.includes("invalid")) {
        setErrorMessage("The code has expired or is invalid. Please try again.");
      } else {
        setErrorMessage(verifyResult.message ?? "OTP verification failed.");
      }
      return;
    }

    const saveResult = await registerProfile({
      fullName: fullName.trim(),
      studentNumber: normalizeStudentNumber(studentNumber),
      program: program.trim(),
      region: FIXED_ADDRESS.region,
      province: FIXED_ADDRESS.province,
      city: FIXED_ADDRESS.city,
      barangay: barangay.trim(),
      street: street.trim(),
      email: email.trim().toLowerCase(),
      birthdate: birthdate,
      password: password.trim(),
    });
    setIsBusy(false);

    if (!saveResult.ok) {
      setErrorMessage(saveResult.message ?? "Unable to save profile.");
      return;
    }

    router.replace("/home");
  };

  const openCalendar = () => {
    if (Platform.OS === "web") {
      setErrorMessage(
        "Calendar picker is available on mobile. Enter birthdate on device build.",
      );
      return;
    }

    if (!DateTimePickerAndroid?.open) {
      setErrorMessage("Calendar is unavailable on this device right now.");
      return;
    }

    DateTimePickerAndroid.open({
      mode: "date",
      value: new Date(),
      onChange: (_event, selectedDate) => {
        if (!selectedDate) return;
        const formatted = formatBirthdate(selectedDate);
        setBirthdate(formatted);
        setPassword(formatted);
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={34} color="#1C1C1C" />
        </Pressable>

        <View style={styles.formArea}>
          <StepProgress
            total={TOTAL_STEPS}
            current={step}
            containerStyle={styles.progressRow}
          />

          {step === 1 && (
            <>
              <Text style={styles.title}>Welcome!</Text>
              <Text style={styles.subtitle}>
                Create your account to start journaling{"\n"}and track your
                progress.
              </Text>
              <Text style={styles.sectionTitle}>Upload your school ID</Text>

              <Pressable style={styles.uploadWrap} onPress={handleScanId}>
                <View style={styles.uploadInner}>
                  {scanPreviewUri ? (
                    <Image
                      source={scanPreviewUri}
                      style={styles.preview}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="image-outline" size={28} color="#1D1D1D" />
                  )}
                </View>
                <View style={styles.fileButton}>
                  <Text style={styles.fileButtonText}>
                    {isBusy ? "Scanning..." : "Select File"}
                  </Text>
                </View>
              </Pressable>
              {!!scanMessage && (
                <Text style={styles.helperText}>{scanMessage}</Text>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.headerBody}>
                Review the extracted details from your ID.
              </Text>
              <FormTextInput
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                labelStyle={styles.label}
                inputStyle={styles.input}
              />
              <FormTextInput
                label="Student Number"
                value={studentNumber}
                onChangeText={(value) =>
                  setStudentNumber(normalizeStudentNumber(value))
                }
                placeholder="23-2903"
                placeholderTextColor="#8D8D8D"
                labelStyle={styles.label}
                inputStyle={styles.input}
              />
              <SelectField
                label="Program"
                value={program}
                options={PROGRAM_OPTIONS}
                onSelect={(value) => setProgram(value)}
                labelStyle={styles.label}
              />
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.headerBody}>Address details</Text>
              <SelectField
                label="Region"
                value={FIXED_ADDRESS.region}
                options={[FIXED_ADDRESS.region]}
                onSelect={() => undefined}
                disabled
                labelStyle={styles.label}
              />
              <SelectField
                label="Province"
                value={FIXED_ADDRESS.province}
                options={[FIXED_ADDRESS.province]}
                onSelect={() => undefined}
                disabled
                labelStyle={styles.label}
              />
              <SelectField
                label="City"
                value={FIXED_ADDRESS.city}
                options={[FIXED_ADDRESS.city]}
                onSelect={() => undefined}
                disabled
                labelStyle={styles.label}
              />
              <SelectField
                label="Barangay"
                value={barangay}
                options={BARANGAY_OPTIONS}
                onSelect={(value) => setBarangay(value)}
                labelStyle={styles.label}
              />
              <FormTextInput
                label="Street"
                value={street}
                onChangeText={setStreet}
                labelStyle={styles.label}
                inputStyle={styles.input}
              />
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.headerBody}>
                Set up your account security.
              </Text>
              <FormTextInput
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="name@email.com"
                placeholderTextColor="#728274"
                labelStyle={styles.label}
                inputStyle={styles.input}
              />
              <Pressable onPress={openCalendar}>
                <View pointerEvents="none">
                  <FormTextInput
                    label="Birthdate"
                    value={birthdate}
                    editable={false}
                    showSoftInputOnFocus={false}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor="#8D8D8D"
                    labelStyle={styles.label}
                    inputStyle={styles.input}
                  />
                </View>
              </Pressable>
              <FormTextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="#8D8D8D"
                labelStyle={styles.label}
                inputWrapStyle={styles.passwordInputWrap}
                inputStyle={styles.passwordInputText}
                rightAdornment={
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((prev) => !prev)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={18}
                      color="#1D1D1D"
                    />
                  </Pressable>
                }
              />
              <Text style={styles.helperText}>
                Password auto-fills from your birthdate.
              </Text>
            </>
          )}

          {step === 5 && (
            <>
              <Text style={styles.headerBody}>
                Enter the OTP sent to your email.
              </Text>
              <Text style={styles.otpLabel}>Verification Code</Text>
              <OtpCodeInput
                length={OTP_LENGTH}
                value={otpCode}
                onChangeCode={setOtpCode}
              />

              <AppPrimaryButton
                label={
                  resendSeconds > 0
                    ? `Resend in ${resendSeconds}s`
                    : "Resend Code"
                }
                onPress={() => {
                  if (resendSeconds === 0) handleSendOtp();
                }}
                containerStyle={[
                  styles.secondaryButton,
                  resendSeconds > 0 && styles.disabledButton,
                ]}
                labelStyle={styles.secondaryButtonText}
              />
            </>
          )}

          {!!errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>

        {step < 5 ? (
          <AppPrimaryButton
            label={
              step === 1
                ? "Continue"
                : step === 4
                  ? "Send Email Verification"
                  : "Next"
            }
            disabled={step === 1 && isBusy}
            containerStyle={[
              styles.actionButton,
              step === 1 && isBusy ? styles.disabledButton : undefined,
            ]}
            onPress={() => {
              if (step === 1 && isBusy) {
                return;
              }
              if (step === 1) {
                if (!hasValidIdScan) {
                  setErrorMessage(
                    "Please scan a valid school ID before continuing.",
                  );
                  return;
                }
                setErrorMessage("");
                setStep(2);
                return;
              }
              if (step === 2) {
                if (!canProceedStepTwo) {
                  setErrorMessage(
                    "Please enter a valid name, student number, and program.",
                  );
                  return;
                }
                setErrorMessage("");
                setStep(3);
                return;
              }
              if (step === 3) {
                if (!canProceedStepThree) {
                  setErrorMessage("Please complete your barangay and street.");
                  return;
                }
                setErrorMessage("");
                setStep(4);
                return;
              }
              if (step === 4) {
                handleSendOtp();
              }
            }}
          />
        ) : (
          <AppPrimaryButton
            label="Finish Setup"
            onPress={handleVerifyAndFinish}
            containerStyle={styles.actionButton}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 26,
    alignItems: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 18,
    paddingRight: 6,
  },
  formArea: {
    flex: 1,
    justifyContent: "flex-start",
    width: "100%",
    maxWidth: 320,
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    lineHeight: 36,
    color: "#111111",
    fontFamily: "Fraunces-Regular",
    marginBottom: 10,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
    color: "#1A1A1A",
    marginBottom: 18,
  },
  progressRow: {
    marginBottom: 32,
  },
  sectionTitle: {
    textAlign: "center",
    color: "#111111",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
  uploadWrap: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#6A7F93",
    borderRadius: 6,
    minHeight: 180,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  uploadInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
  },
  preview: {
    width: "100%",
    height: 140,
  },
  fileButton: {
    width: "100%",
    marginTop: 12,
    height: 28,
    borderTopWidth: 1,
    borderColor: "#5B6A78",
    backgroundColor: "#D9DEE3",
    alignItems: "center",
    justifyContent: "center",
  },
  fileButtonText: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "600",
  },
  headerBody: {
    textAlign: "center",
    color: "#111111",
    fontSize: 12,
    lineHeight: 20,
    fontWeight: "600",
    marginBottom: 18,
  },
  label: {
    color: "#111111",
    fontSize: 10,
    marginBottom: 6,
  },
  otpLabel: {
    color: "#111111",
    fontSize: 10,
    marginBottom: 8,
  },
  input: {
    paddingVertical: 10,
    marginBottom: 14,
  },
  passwordInputWrap: {
    marginBottom: 14,
    height: 44,
  },
  passwordInputText: {
    fontSize: 14,
    color: "#111111",
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  helperText: {
    color: "#4A4A4A",
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  errorText: {
    color: "#C31A1A",
    fontSize: 12,
    marginBottom: 8,
  },
  actionButton: {
    marginTop: 20,
  },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: "#E4EDF5",
  },
  secondaryButtonText: {
    color: "#2D3F4E",
  },
  disabledButton: {
    opacity: 0.7,
  },
  eyeButton: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
