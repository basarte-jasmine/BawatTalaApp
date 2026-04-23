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
  GENDER_OPTIONS,
  PROGRAM_OPTIONS,
} from "../lib/register-data";
import { useAuthSession } from "../lib/auth-session";
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

Effective Date: April 23, 2026
Last Updated: April 23, 2026

1. Purpose of the Service
Bawat Tala is a school-focused journaling, student support, and counseling platform. It may include registration, verification, journaling, Muni insights, counseling review workflows, and appointment scheduling.

2. Account Registration
You agree to provide truthful and complete information during registration, including your full name, student number, and other required details. You are responsible for keeping your account credentials confidential.

3. ID Upload and OCR Processing
When you upload a school ID image, the image may be sent to an OCR service so text such as your name, student number, and program can be extracted for verification and registration autofill.

4. Journal Privacy and Safety Review
Your full journal conversation is not routinely shown to admins or counselors. However, Bawat Tala may generate summaries, insights, concern labels, and risk flags from journal entries for student support workflows. If an entry is flagged by high-risk indicators, trigger words, or other safety signals, authorized counselors or admins may review the full conversation to assess whether counseling or safety follow-up is needed.

5. AI and Automated Processing
Journal text may be processed by Bawat Tala's configured AI or automated review tools to generate Muni replies, summaries, insights, and safety flags.

6. Email, Appointments, and Integrations
Bawat Tala may send verification, password reset, and appointment-related messages through configured service providers. Google Calendar data is only used when an authorized admin connects Google for scheduling features.

7. Acceptable Use
You agree not to use the service for impersonation, fraud, harassment, unlawful activity, or misuse of student or school-related data.

8. Service Availability and Security
We may update, modify, or temporarily suspend parts of the service for maintenance, security improvements, and feature updates. While we implement reasonable safeguards, no digital system can guarantee absolute uninterrupted operation.

9. Emergency Limitation
Bawat Tala is not an emergency hotline or substitute for urgent medical or mental health care.

10. Updates to Terms
These terms may be updated as needed. Continued use of the platform after updates constitutes acceptance of the revised terms.
`;

const PRIVACY_POLICY_CONTENT = `Bawat Tala Privacy Policy

Effective Date: April 23, 2026
Last Updated: April 23, 2026

This policy is aligned with the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules and regulations.

1. Personal Data We Collect
We may collect:
- Full name
- Student number
- Program/course
- Gender
- Address details
- Email address
- Birthdate
- Journal messages, summaries, insights, concern tags, and risk labels
- School ID image and OCR-extracted text
- Appointment and support-follow-up records

2. Where Your Data May Go
Your data may be stored or processed through:
- Bawat Tala database and authentication systems, including PostgreSQL and Supabase-backed services
- Supabase Auth or its configured email provider for OTP and password reset emails
- OCR.Space for school ID text extraction
- Google Gemini and/or Groq for Muni replies, summaries, insights, and safety flagging
- Resend or another configured email provider for appointment-related emails
- Google Calendar only when an authorized admin connects Google for scheduling

3. Why We Process Your Data
We process personal data to:
- Verify identity and student legitimacy
- Populate registration fields using OCR-extracted text
- Secure accounts through authentication and OTP flows
- Operate journaling, Muni insights, counseling support, and appointments
- Detect possible safety concerns, including trigger words or high-risk language
- Contact users for verification, security, appointments, and support follow-up

4. Journal Privacy and Counselor Access
Full journal conversations are private by default and are not routinely shown to admins or counselors. However, Bawat Tala may generate summaries, insights, concern tags, and risk labels for support workflows. Authorized counselors or admins may view the full conversation when an entry is flagged by high-risk indicators, trigger words, or other safety-review signals so they can assess whether counseling or welfare follow-up is needed.

5. Sharing and Retention
We do not sell personal data. We share data only with authorized support personnel and trusted service providers when needed to operate the platform. If a journal entry is identified as high-risk or under active safety review, Bawat Tala may retain that entry for counselor or admin review even if it is removed from the student's normal app view.

6. Data Protection Measures
We apply organizational and technical safeguards designed to protect personal data against unauthorized access, alteration, disclosure, or loss.

7. Your Rights as a Data Subject
Under RA 10173, you may have rights including access, correction, objection, and other applicable rights, subject to lawful limitations and verification procedures.

8. Contact and Requests
For data privacy concerns, correction requests, or account-related concerns, contact the platform administrators through official support channels.
`;

export default function RegisterScreen() {
  const { setUser } = useAuthSession();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [program, setProgram] = useState("");
  const [gender, setGender] = useState("");
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
      Boolean(program) &&
      Boolean(gender)
    );
  }, [fullName, studentNumber, program, gender]);

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
      quality: 0.25,
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

    try {
      const scanResult = await scanSchoolId(asset.base64);

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
    } catch {
      setScanMessage(
        "Unable to reach OCR service. Check your internet/API URL and try again.",
      );
    } finally {
      setIsBusy(false);
    }
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
      gender: gender.trim(),
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

    const normalizedFullName = fullName
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    setUser({
      studentNumber: normalizeStudentNumber(studentNumber),
      fullName: normalizedFullName,
      firstName: normalizedFullName.split(" ")[0] || "User",
      email: email.trim().toLowerCase(),
    });
    router.replace("/studio");
  };

  const openCalendar = () => {
    if (Platform.OS === "web") {
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
          {step === 1 && (
            <>
              <Image
                source={require("../assets/images/BT_Logo.png")}
                style={styles.logo}
                contentFit="contain"
              />
              <Text style={styles.title}>Welcome!</Text>
              <Text style={styles.subtitle}>
                Create your account to start journaling{"\n"}and track your progress.
              </Text>
            </>
          )}
          <StepProgress
            total={TOTAL_STEPS}
            current={step}
            containerStyle={styles.progressRow}
          />

          {step === 1 && (
            <>
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
                  Your school ID photo is sent for OCR verification and autofill.
                  Journal conversations stay private by default, and only
                  flagged safety-review entries can be opened to authorized
                  counselors or admins.
                </Text>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.headerBody}>
                Does this look right?{"\n"}Review the details we found.
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
              <SelectField
                label="Gender"
                value={gender}
                options={GENDER_OPTIONS}
                onSelect={(value) => setGender(value)}
                labelStyle={styles.label}
              />
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.headerBody}>
                Where are you writing from?{"\n"}Add your address to help us tailor your experience.
              </Text>
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
                placeholder={`${FIXED_ADDRESS.city}, ${FIXED_ADDRESS.province}`}
                placeholderTextColor="#8D8D8D"
                labelStyle={styles.label}
                inputStyle={styles.input}
              />
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.headerBody}>
                Secure your journal. Add a few more details{"\n"}to keep your entries safe.
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
              {Platform.OS === "web" ? (
                <FormTextInput
                  label="Birthdate"
                  value={birthdate}
                  onChangeText={(value) => {
                    setBirthdate(value);
                    setPassword(value);
                    setErrorMessage("");
                  }}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor="#8D8D8D"
                  labelStyle={styles.label}
                  inputStyle={styles.input}
                />
              ) : (
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
              )}
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
                Verify your email to finish your account setup.
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
                    "Please select a gender.",
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingRight: 6,
  },
  formArea: {
    flex: 1,
    justifyContent: "flex-start",
    width: "100%",
    maxWidth: 320,
  },
  logo: {
    width: 64,
    height: 64,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    textAlign: "center",
    fontSize: 23,
    lineHeight: 30,
    color: "#111111",
    fontFamily: "Outfit",
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: "#1A1A1A",
    marginBottom: 12,
  },
  consentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: "#5C6570",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  consentBody: {
    color: "#4E4E4E",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#6E6E6E",
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: "#79C943",
    borderColor: "#79C943",
  },
  checkboxText: {
    flex: 1,
    color: "#222222",
    fontSize: 10,
    lineHeight: 14,
  },
  linkText: {
    color: "#2C7DB0",
    fontWeight: "600",
  },
  progressRow: {
    marginBottom: 20,
  },
  sectionTitle: {
    textAlign: "center",
    color: "#111111",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 18,
  },
  uploadWrap: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#98A0A6",
    borderRadius: 6,
    minHeight: 140,
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
    height: 104,
  },
  fileButton: {
    width: "100%",
    marginTop: 8,
    height: 30,
    borderTopWidth: 1,
    borderColor: "#7D8790",
    backgroundColor: "#E7EAEC",
    alignItems: "center",
    justifyContent: "center",
  },
  fileButtonText: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "600",
  },
  headerBody: {
    textAlign: "center",
    color: "#111111",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginBottom: 16,
  },
  label: {
    color: "#111111",
    fontSize: 12,
    marginBottom: 6,
  },
  otpLabel: {
    color: "#111111",
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    fontSize: 13,
    marginBottom: 10,
  },
  passwordInputWrap: {
    marginBottom: 10,
    minHeight: 38,
  },
  passwordInputText: {
    fontSize: 13,
    color: "#111111",
    paddingVertical: 8,
    textAlignVertical: "center",
  },
  helperText: {
    color: "#5A5A5A",
    fontSize: 10,
    marginTop: 2,
    marginBottom: 12,
    textAlign: "left",
  },
  errorText: {
    color: "#C31A1A",
    fontSize: 11,
    marginBottom: 10,
  },
  actionButton: {
    marginTop: 14,
  },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: "#EDF4E7",
  },
  secondaryButtonText: {
    color: "#476223",
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
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    shadowColor: "#919AA4",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
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
