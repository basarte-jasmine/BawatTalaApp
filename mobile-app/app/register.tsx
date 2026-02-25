import { Ionicons } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
const TERMS_AND_CONDITIONS_CONTENT = `Bawat Tala Terms and Conditions

Effective Date: February 25, 2026

1. Purpose of the Service
Bawat Tala is a school-focused digital journaling and support platform. The registration process may request identity details to verify that each account belongs to a legitimate student user.

2. Account Registration
You agree to provide truthful and complete information during registration, including your full name, student number, and other required details. You are responsible for keeping your account credentials confidential.

3. ID Upload and OCR Processing
When you upload a school ID image, we process the image through Optical Character Recognition (OCR) to extract text-based details such as your name, student number, and program. Extracted data may be used to prefill registration fields for convenience and accuracy.

4. Acceptable Use
You agree not to use the service for impersonation, fraud, harassment, distribution of unlawful content, or misuse of school-related data.

5. Verification and Security
We may require additional verification, including OTP validation, to protect your account and maintain system integrity.

6. Service Availability
We may update, modify, or temporarily suspend parts of the service for maintenance, security improvements, and feature updates.

7. Limitation of Liability
The service is provided on an as-available basis. While we implement reasonable safeguards, no digital system can guarantee absolute uninterrupted operation.

8. Updates to Terms
These terms may be updated as needed. Continued use of the platform after updates constitutes acceptance of the revised terms.
`;

const PRIVACY_POLICY_CONTENT = `Bawat Tala Privacy Policy

Effective Date: February 25, 2026

This policy is aligned with the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules and regulations.

1. Personal Data We Collect
During registration and verification, we may collect:
- Full name
- Student number
- Program/course
- Address details
- Email address
- Birthdate
- School ID image (for OCR and verification)

2. Why We Process Your Data
We process personal data to:
- Verify identity and student legitimacy
- Populate registration fields using OCR-extracted text
- Secure accounts through authentication and OTP flows
- Enable platform features and support operations

3. How ID Images Are Used
Uploaded ID images are used only for verification and OCR extraction related to account setup and fraud prevention. We do not process your image for unrelated advertising or profiling purposes.

4. Data Protection Measures
We apply organizational and technical safeguards designed to protect personal data against unauthorized access, alteration, disclosure, or loss.

5. Data Sharing
Personal data is only shared with authorized personnel or service providers when necessary for legitimate operational, legal, or security purposes and subject to confidentiality safeguards.

6. Retention
Data is retained only for as long as reasonably necessary for verification, account administration, legal compliance, and legitimate platform operations.

7. Your Rights as a Data Subject
Under RA 10173, you may have rights including access, correction, objection, and other applicable rights, subject to lawful limitations and verification procedures.

8. Contact and Requests
For data privacy concerns, correction requests, or account-related concerns, contact the platform administrators through official support channels.
`;

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
  const [hasAcceptedScanTerms, setHasAcceptedScanTerms] = useState(false);
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [policyModalTitle, setPolicyModalTitle] = useState("");
  const [policyModalContent, setPolicyModalContent] = useState("");
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
    if (!hasAcceptedScanTerms) {
      setErrorMessage(
        "Please agree to the Terms and Data Privacy notice before scanning your ID.",
      );
      return;
    }

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

  const openPolicyModal = (type: "terms" | "privacy") => {
    if (type === "terms") {
      setPolicyModalTitle("Terms and Conditions");
      setPolicyModalContent(TERMS_AND_CONDITIONS_CONTENT);
    } else {
      setPolicyModalTitle("Privacy Policy");
      setPolicyModalContent(PRIVACY_POLICY_CONTENT);
    }
    setPolicyModalVisible(true);
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
              <View style={styles.consentCard}>
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => {
                    setHasAcceptedScanTerms((prev) => !prev);
                    setErrorMessage("");
                  }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      hasAcceptedScanTerms && styles.checkboxChecked,
                    ]}
                  >
                    {hasAcceptedScanTerms ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <Text style={styles.checkboxText}>
                    I understand and agree with the{" "}
                    <Text
                      style={styles.linkText}
                      onPress={() => openPolicyModal("terms")}
                    >
                      Terms and Conditions
                    </Text>{" "}
                    and{" "}
                    <Text
                      style={styles.linkText}
                      onPress={() => openPolicyModal("privacy")}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </Pressable>
                <Text style={styles.consentBody}>
                  Your school ID photo is processed for verification and OCR
                  autofill of registration details in accordance with RA 10173.
                </Text>
              </View>
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
                if (!hasAcceptedScanTerms) {
                  setErrorMessage(
                    "Please agree to the Terms and Data Privacy notice before continuing.",
                  );
                  return;
                }
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
      <Modal
        visible={policyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPolicyModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{policyModalTitle}</Text>
              <Pressable onPress={() => setPolicyModalVisible(false)}>
                <Ionicons name="close" size={20} color="#1F2A33" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalBodyText}>{policyModalContent}</Text>
            </ScrollView>
            <AppPrimaryButton
              label="Close"
              onPress={() => setPolicyModalVisible(false)}
              containerStyle={styles.modalCloseButton}
            />
          </View>
        </View>
      </Modal>
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
    marginBottom: 14,
  },
  consentCard: {
    borderWidth: 1,
    borderColor: "#D2DCE5",
    backgroundColor: "#F4F8FB",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  consentTitle: {
    color: "#1B2C3A",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  consentBody: {
    color: "#2F3F4C",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 10,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#6E8295",
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: "#5E7D98",
    borderColor: "#5E7D98",
  },
  checkboxText: {
    flex: 1,
    color: "#233442",
    fontSize: 11,
    lineHeight: 16,
  },
  linkText: {
    color: "#2C7DB0",
    textDecorationLine: "underline",
    fontWeight: "600",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "82%",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    color: "#1F2A33",
    fontSize: 14,
    fontWeight: "700",
  },
  modalBody: {
    borderWidth: 1,
    borderColor: "#D4DFE8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F8FBFD",
  },
  modalBodyText: {
    color: "#2F3F4C",
    fontSize: 11,
    lineHeight: 16,
    paddingBottom: 12,
  },
  modalCloseButton: {
    marginTop: 10,
  },
});
