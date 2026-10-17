import { Ionicons } from "@expo/vector-icons";
import { isValidEmail } from "../lib/auth-validation";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { FormTextInput } from "../components/forms/FormTextInput";
import { OtpCodeInput } from "../components/forms/OtpCodeInput";
import { SelectField } from "../components/forms/SelectField";
import { IdCardCameraModal } from "../components/forms/IdCardCameraModal";
import { StepProgress } from "../components/forms/StepProgress";
import {
  registerProfile,
  scanSchoolId,
  sendOtp,
  verifyOtp,
} from "../lib/backend-api";
import { formatBirthdate, normalizeStudentNumber, toTitleCase } from "../lib/format";
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
  validateStudentBirthdate,
  isValidName,
  isValidStudentNumber,
  cleanAndValidateStreet,
} from "../lib/register-validation";

const TOTAL_STEPS = 5;
const OTP_LENGTH = 8;
const APP_MAX_WIDTH = 412;

function HeaderBackdrop({ width, height }: { width: number; height: number }) {
  const sceneWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);
  const headerHeight = Math.max(height, 160);
  const cx = sceneWidth * 0.88;
  const cy = -15;
  const rings: number[] = [];
  for (let r = 24; r <= 380; r += 16) {
    rings.push(r);
  }

  return (
    <Svg
      width={sceneWidth}
      height={headerHeight}
      style={StyleSheet.absoluteFillObject}
      viewBox={"0 0 " + sceneWidth + " " + headerHeight}
    >
      <Defs>
        <LinearGradient id="regHeaderGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5EBFA4" />
          <Stop offset="0.42" stopColor="#7CD49F" />
          <Stop offset="0.82" stopColor="#C8E8B6" />
          <Stop offset="1" stopColor="#FCE3A1" />
        </LinearGradient>
      </Defs>
      <Rect width={sceneWidth} height={headerHeight} fill="url(#regHeaderGradient)" />
      {rings.map((radius) => (
        <Circle
          key={radius}
          cx={cx}
          cy={cy}
          r={radius}
          stroke="rgba(255, 255, 255, 0.32)"
          strokeWidth={1}
          fill="none"
        />
      ))}
    </Svg>
  );
}

function GradientButtonBg() {
  return (
    <Svg
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFillObject}
    >
      <Defs>
        <LinearGradient id="regBtnGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#257A54" />
          <Stop offset="0.5" stopColor="#31966B" />
          <Stop offset="1" stopColor="#43B886" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#regBtnGrad)" />
    </Svg>
  );
}

const TERMS_AND_CONDITIONS_CONTENT = `Bawat Tala Terms and Conditions

Effective Date: April 23, 2026
Last Updated: April 23, 2026

1. Purpose of the Service
Bawat Tala is a school-focused journaling, student support, and counseling platform. It may include registration, verification, journaling, Muni summaries, counseling review workflows, and appointment scheduling.

2. Account Registration
You agree to provide truthful and complete information during registration, including your full name, student number, and other required details. You are responsible for keeping your account credentials confidential.

3. ID Upload and OCR Processing
When you upload a school ID image, the image may be sent to an OCR service so text such as your name, student number, and program can be extracted for verification and registration autofill.

4. Journal Privacy and Safety Review
Your full journal conversation is not routinely shown to admins or counselors. However, Bawat Tala may generate summaries, summary notes, concern labels, and risk flags from journal entries for student support workflows. If an entry is flagged by high-risk indicators, trigger words, or other safety signals, authorized counselors or admins may review the full conversation to assess whether counseling or safety follow-up is needed.

5. AI and Automated Processing
Journal text may be processed by Bawat Tala's configured AI or automated review tools to generate Muni replies, summaries, summary notes, and safety flags. Muni is artificial intelligence, not a psychometrician, therapist, counselor, diagnosis, clinical assessment, or emergency service.

6. Email, Appointments, and Integrations
Bawat Tala may send verification, password reset, and appointment-related messages through configured service providers. Google Calendar data is only used when an authorized admin connects Google for scheduling features.

7. Acceptable Use
You agree not to use the service for impersonation, fraud, harassment, unlawful activity, or misuse of student or school-related data.

8. Service Availability and Security
We may update, modify, or temporarily suspend parts of the service for maintenance, security improvements, and feature updates. While we implement reasonable safeguards, no digital system can guarantee absolute uninterrupted operation.

9. Emergency Limitation
Bawat Tala is not an emergency hotline or substitute for urgent medical or mental health care. Do not rely too much on Muni for serious or urgent concerns.

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
- Journal messages, summaries, summary notes, concern tags, and risk labels
- School ID image and OCR-extracted text
- Appointment and support-follow-up records

2. Where Your Data May Go
Your data may be stored or processed through:
- Bawat Tala database and authentication systems, including PostgreSQL and Supabase-backed services
- Supabase Auth or its configured email provider for OTP and password reset emails
- OCR.Space for school ID text extraction
- Google Gemini and/or Groq for Muni replies, summaries, summary notes, and safety flagging
- Resend or another configured email provider for appointment-related emails
- Google Calendar only when an authorized admin connects Google for scheduling

Muni is artificial intelligence and is not a psychometrician, therapist, counselor, diagnosis, clinical assessment, or emergency service.

3. Why We Process Your Data
We process personal data to:
- Verify identity and student legitimacy
- Populate registration fields using OCR-extracted text
- Secure accounts through authentication and OTP flows
- Operate journaling, Muni summaries, counseling support, and appointments
- Detect possible safety concerns, including trigger words or high-risk language
- Contact users for verification, security, appointments, and support follow-up

4. Journal Privacy and Counselor Access
Full journal conversations are private by default and are not routinely shown to admins or counselors. However, Bawat Tala may generate summaries, summary notes, concern tags, and risk labels for support workflows. Authorized counselors or admins may view the full conversation when an entry is flagged by high-risk indicators, trigger words, or other safety-review signals so they can assess whether counseling or welfare follow-up is needed.

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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [program, setProgram] = useState("");
  const [gender, setGender] = useState("");
  const [barangay, setBarangay] = useState("");
  const [street, setStreet] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [scanPreviewUri, setScanPreviewUri] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [hasValidIdScan, setHasValidIdScan] = useState(false);
  const [compressedIdPicture, setCompressedIdPicture] = useState("");
  const [hasAcceptedScanTerms, setHasAcceptedScanTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [policyModalTitle, setPolicyModalTitle] = useState("");
  const [policyModalContent, setPolicyModalContent] = useState("");
  const [hasScrolledPolicyToEnd, setHasScrolledPolicyToEnd] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const isCompactHeight = height > 0 && height < 720;
  const isNarrowWidth = width > 0 && width < 360;
  const headerHeight = isCompactHeight ? 160 : 190;

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
    return Boolean(barangay) && !cleanAndValidateStreet(
      street,
      barangay,
      FIXED_ADDRESS.city,
      FIXED_ADDRESS.province,
      FIXED_ADDRESS.region,
    ).error;
  }, [barangay, street]);

  const canProceedStepFour = useMemo(() => {
    const passwordValue = String(password || "").trim();
    const birthdateValue = String(birthdate || "").trim();
    return (
      isValidEmail(email) &&
      isValidBirthdate(birthdateValue) &&
      Boolean(passwordValue) &&
      passwordValue === birthdateValue
    );
  }, [email, birthdate, password]);

  const handleBack = () => {
    setErrorMessage("");
    if (step === 1) {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace("/login");
      return;
    }
    setStep((prev) => prev - 1);
  };

  const processAndValidateIdImage = async (asset: {
    base64: string;
    uri: string;
    width?: number;
    height?: number;
  }) => {
    setScanPreviewUri(asset.uri);
    setScanMessage("");
    setErrorMessage("");
    setIsBusy(true);

    try {
      const isLikely = await isLikelySchoolId(asset.uri);
      if (!isLikely) {
        setScanMessage(
          "Image does not appear to be a school ID. Please ensure the full ID card is clearly visible.",
        );
        return;
      }

      const ImageManipulator = await import("expo-image-manipulator");
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 900 } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      setCompressedIdPicture(manipulated.base64 ? "data:image/jpeg;base64," + manipulated.base64 : "");

      const scanResult = await scanSchoolId(manipulated.base64 || asset.base64);
      if (!scanResult.ok || !scanResult.ocrText) {
        setScanMessage(
          scanResult.message || "Could not read ID card. Please ensure text is clear and readable.",
        );
        return;
      }

      const ocrRawText = scanResult.ocrText.trim();
      if (!ocrRawText) {
        setScanMessage(
          "No text detected on the scanned ID. The details cannot be empty. Please upload or scan a clear photo of your school ID.",
        );
        return;
      }

      const parsed = parseIdText(scanResult.ocrText);
      const extractedName = parsed.fullName ? parsed.fullName.trim() : "";
      const extractedStudentNumber = parsed.studentNumber ? normalizeStudentNumber(parsed.studentNumber) : "";
      const extractedProgram = parsed.program ? parsed.program.trim() : "";

      if (!extractedName && !extractedStudentNumber && !extractedProgram) {
        setScanMessage(
          "No details could be extracted from your school ID. The details cannot be empty. Please upload or scan a clearer photo of your school ID.",
        );
        return;
      }

      if (!extractedName || !extractedStudentNumber || !extractedProgram) {
        const missing = [];
        if (!extractedName) missing.push("Full Name");
        if (!extractedStudentNumber) missing.push("Student Number");
        if (!extractedProgram) missing.push("Program");
        setScanMessage(
          "Could not extract " + missing.join(", ") + " from the ID. The details cannot be empty. Please upload a clearer photo of your school ID.",
        );
        return;
      }

      setFullName(extractedName);
      setStudentNumber(extractedStudentNumber);
      setProgram(extractedProgram);
      setScanMessage("ID scanned successfully. Proceed to continue.");
      setHasValidIdScan(true);
    } catch {
      setScanMessage(
        "Unable to reach OCR service. Please check your internet connection and try again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartCameraScan = () => {
    setErrorMessage("");
    setConsentError(false);
    setCameraModalVisible(true);
  };

  const handleUploadFile = async () => {
    setErrorMessage("");
    setConsentError(false);

    const ImagePicker = await import("expo-image-picker");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage("Photo permission is required to select your ID from files.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setScanMessage("Could not read selected image data.");
      return;
    }

    await processAndValidateIdImage({
      base64: asset.base64,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    });
  };

  const handleCameraCapture = async (captured: {
    base64: string;
    uri: string;
    width?: number;
    height?: number;
  }) => {
    setCameraModalVisible(false);
    await processAndValidateIdImage(captured);
  };

  const handleSendOtp = async () => {
    setErrorMessage("");
    if (!isValidEmail(email)) {
      setErrorMessage("Enter a valid email like name@email.com.");
      return;
    }
    const birthdateCheck = validateStudentBirthdate(birthdate);
    if (!birthdateCheck.isValid) {
      setErrorMessage(birthdateCheck.error || "Please enter a valid birthdate.");
      return;
    }
    if (!String(password || "").trim() || String(password || "").trim() !== String(birthdate || "").trim()) {
      setErrorMessage("Password must match your birthdate for registration.");
      return;
    }
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

    setResendSeconds(result.resendAfterSeconds ?? 60);
    setOtpCode("");
    setStep(5);
  };

  const handleVerifyAndFinish = async () => {
    setErrorMessage("");
    if (otpCode.trim().length !== OTP_LENGTH) {
      setErrorMessage("Please enter the 8-digit OTP.");
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
        setErrorMessage("The code is invalid. Please check the latest email code and try again.");
      } else {
        setErrorMessage(verifyResult.message ?? "OTP verification failed.");
      }
      return;
    }

    const saveResult = await registerProfile({
      fullName: toTitleCase(fullName),
      studentNumber: normalizeStudentNumber(studentNumber),
      program: program.trim(),
      gender: gender.trim(),
      region: FIXED_ADDRESS.region,
      province: FIXED_ADDRESS.province,
      city: FIXED_ADDRESS.city,
      barangay: barangay.trim(),
      street: cleanAndValidateStreet(
        street,
        barangay,
        FIXED_ADDRESS.city,
        FIXED_ADDRESS.province,
        FIXED_ADDRESS.region,
      ).cleaned || street.trim(),
      email: email.trim().toLowerCase(),
      birthdate: birthdate,
      password: password.trim(),
      nickname: nickname.trim() || undefined,
      idPicture: hasValidIdScan && compressedIdPicture ? compressedIdPicture : undefined,
    });
    setIsBusy(false);

    if (!saveResult.ok) {
      setErrorMessage(saveResult.message ?? "Unable to save profile.");
      return;
    }

    const normalizedFullName = toTitleCase(fullName);

    setUser({
      studentNumber: normalizeStudentNumber(studentNumber),
      fullName: normalizedFullName,
      firstName: nickname.trim() || normalizedFullName.split(" ")[0] || "User",
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
    setHasScrolledPolicyToEnd(false);
    if (type === "terms") {
      setPolicyModalTitle("Terms and Conditions");
      setPolicyModalContent(TERMS_AND_CONDITIONS_CONTENT);
    } else {
      setPolicyModalTitle("Privacy Policy");
      setPolicyModalContent(PRIVACY_POLICY_CONTENT);
    }
    setPolicyModalVisible(true);
  };

  const handlePolicyScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;
    if (isAtEnd) {
      setHasScrolledPolicyToEnd(true);
    }
  };

  const frameWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Top Graphic Header (matching login.tsx) */}
      <View style={[styles.headerContainer, { width: frameWidth, height: headerHeight }]}>
        <HeaderBackdrop width={frameWidth} height={headerHeight} />
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color="#18362B" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>

      {/* White Bottom Sheet Overlapping Header */}
      <View style={styles.sheetCard}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isNarrowWidth && styles.scrollContentNarrow,
            { paddingBottom: Math.max(insets.bottom + 20, 36) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step Progress Pills */}
          <StepProgress
            total={TOTAL_STEPS}
            current={step}
            containerStyle={styles.progressRow}
          />

          {/* Form Content Area */}
          <View style={styles.formArea}>
            {step === 1 && (
              <>
                <View style={[styles.titleArea, isCompactHeight && styles.titleAreaCompact]}>
                  <View style={[styles.logoBadge, isCompactHeight && styles.logoBadgeCompact]}>
                    <Image
                      source={require("../assets/images/Logo_BT.png")}
                      style={[styles.logoImage, isCompactHeight && styles.logoImageCompact]}
                      contentFit="contain"
                    />
                  </View>
                  <Text style={[styles.title, isCompactHeight && styles.titleCompact]}>Create Your Account</Text>
                  <Text style={styles.subtitle}>
                    Review our terms and verify your school ID to begin.
                  </Text>
                </View>

                {/* ID Upload Box */}
                <View style={styles.uploadWrap}>
                  <View style={styles.uploadInner}>
                    {scanPreviewUri ? (
                      <View style={styles.previewContainer}>
                        <Image
                          source={scanPreviewUri}
                          style={styles.preview}
                          contentFit="cover"
                        />
                        {hasValidIdScan ? (
                          <View style={styles.previewBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                            <Text style={styles.previewBadgeText}>ID Verified</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.uploadPlaceholderWrap}>
                        <View style={styles.uploadIconCircle}>
                          <Ionicons name="id-card-outline" size={26} color="#2D7D5A" />
                        </View>
                        <Text style={styles.uploadPlaceholderTitle}>
                          Upload or Scan School ID
                        </Text>
                        <Text style={styles.uploadPlaceholderText}>
                          Ensure your full ID card is clear and readable
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.uploadButtonsRow}>
                    <Pressable
                      style={styles.scanOptionBtnCamera}
                      onPress={handleStartCameraScan}
                      disabled={isBusy}
                    >
                      <Ionicons name="camera-outline" size={17} color="#FFFFFF" />
                      <Text style={styles.scanOptionBtnCameraText}>
                        {isBusy ? "Processing..." : "Scan with Camera"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.scanOptionBtnUpload}
                      onPress={handleUploadFile}
                      disabled={isBusy}
                    >
                      <Ionicons name="cloud-upload-outline" size={17} color="#334155" />
                      <Text style={styles.scanOptionBtnUploadText}>Upload File</Text>
                    </Pressable>
                  </View>
                </View>

                {!!scanMessage && (
                  <Text style={styles.helperNoticeText}>{scanMessage}</Text>
                )}

                {/* Consent Checkbox Card */}
                <View style={[styles.consentCard, consentError && styles.consentCardError]}>
                  <Pressable
                    style={styles.checkboxRow}
                    onPress={() => {
                      setHasAcceptedScanTerms((prev) => !prev);
                      setConsentError(false);
                      setErrorMessage("");
                    }}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        hasAcceptedScanTerms && styles.checkboxChecked,
                        consentError && styles.checkboxError,
                      ]}
                    >
                      {hasAcceptedScanTerms ? (
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <Text style={styles.checkboxText}>
                      I agree with the{" "}
                      <Text
                        style={styles.linkText}
                        onPress={() => openPolicyModal("terms")}
                      >
                        Terms & Conditions
                      </Text>{" "}
                      and{" "}
                      <Text
                        style={styles.linkText}
                        onPress={() => openPolicyModal("privacy")}
                      >
                        Privacy Policy
                      </Text>
                      .<Text style={styles.requiredAsterisk}> *</Text>
                    </Text>
                  </Pressable>
                  <Text style={styles.consentBody}>
                    Your school ID photo is processed for student verification and autofill. Journal entries stay private by default.
                  </Text>
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <View style={styles.stepHeader}>
                  <Text style={styles.title}>Review Details</Text>
                  <Text style={styles.subtitle}>
                    Scanned details are locked for student verification.
                  </Text>
                </View>

                <FormTextInput
                  label="Full Name"
                  required={true}
                  value={fullName}
                  editable={false}
                  labelStyle={styles.label}
                  inputStyle={[styles.input, styles.disabledInput]}
                />
                <FormTextInput
                  label="Student Number"
                  required={true}
                  value={studentNumber}
                  editable={false}
                  placeholder="23-2903"
                  placeholderTextColor="#9CA3AF"
                  labelStyle={styles.label}
                  inputStyle={[styles.input, styles.disabledInput]}
                />
                <SelectField
                  label="Program"
                  required={true}
                  value={program}
                  options={PROGRAM_OPTIONS}
                  onSelect={(value) => setProgram(value)}
                  disabled={true}
                  labelStyle={styles.label}
                  triggerStyle={[styles.input, styles.disabledInput]}
                />
                <SelectField
                  label="Gender"
                  required={true}
                  value={gender}
                  options={GENDER_OPTIONS}
                  onSelect={(value) => setGender(value)}
                  labelStyle={styles.label}
                  triggerStyle={styles.input}
                />
              </>
            )}

            {step === 3 && (
              <>
                <View style={styles.stepHeader}>
                  <Text style={styles.title}>Where Are You From?</Text>
                  <Text style={styles.subtitle}>
                    Add your address details to complete your student profile.
                  </Text>
                </View>

                <SelectField
                  label="Barangay"
                  required={true}
                  value={barangay}
                  options={BARANGAY_OPTIONS}
                  onSelect={(value) => setBarangay(value)}
                  labelStyle={styles.label}
                  triggerStyle={styles.input}
                />
                <FormTextInput
                  label="Street Address"
                  required={true}
                  value={street}
                  onChangeText={setStreet}
                  placeholder="Enter street, house or bldg no."
                  placeholderTextColor="#9CA3AF"
                  labelStyle={styles.label}
                  inputStyle={styles.input}
                />
              </>
            )}

            {step === 4 && (
              <>
                <View style={styles.stepHeader}>
                  <Text style={styles.title}>Account Security</Text>
                  <Text style={styles.subtitle}>
                    Enter your email and credentials to keep your entries safe.
                  </Text>
                </View>

                <FormTextInput
                  label="Email Address"
                  required={true}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="name@email.com"
                  placeholderTextColor="#9CA3AF"
                  labelStyle={styles.label}
                  inputStyle={styles.input}
                />
                <FormTextInput
                  label="Nickname (Optional)"
                  value={nickname}
                  onChangeText={(value) => {
                    const cleaned = value.replace(/\s+/g, "").slice(0, 15);
                    setNickname(cleaned);
                  }}
                  autoCapitalize="words"
                  placeholder="e.g. Alex"
                  placeholderTextColor="#9CA3AF"
                  maxLength={15}
                  labelStyle={styles.label}
                  inputStyle={styles.input}
                />

                {Platform.OS === "web" ? (
                  <FormTextInput
                    label="Birthdate"
                    required={true}
                    value={birthdate}
                    onChangeText={(value) => {
                      setBirthdate(value);
                      setPassword(value);
                      setErrorMessage("");
                    }}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor="#9CA3AF"
                    labelStyle={styles.label}
                    inputStyle={styles.input}
                  />
                ) : (
                  <Pressable onPress={openCalendar}>
                    <View pointerEvents="none">
                      <FormTextInput
                        label="Birthdate"
                        required={true}
                        value={birthdate}
                        editable={false}
                        showSoftInputOnFocus={false}
                        placeholder="MM/DD/YYYY"
                        placeholderTextColor="#9CA3AF"
                        labelStyle={styles.label}
                        inputStyle={styles.input}
                      />
                    </View>
                  </Pressable>
                )}

                <FormTextInput
                  label="Password"
                  required={true}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor="#9CA3AF"
                  labelStyle={styles.label}
                  inputWrapStyle={styles.passwordInputWrap}
                  inputStyle={styles.passwordInputText}
                  rightAdornment={
                    <Pressable
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={19}
                        color="#9CA3AF"
                      />
                    </Pressable>
                  }
                />
                <Text style={styles.passwordNoteText}>
                  Password auto-fills from your birthdate.
                </Text>
              </>
            )}

            {step === 5 && (
              <>
                <View style={styles.stepHeader}>
                  <Text style={styles.title}>Verify Your Email</Text>
                  <Text style={styles.subtitle}>
                    We sent an 8-digit verification code to {email}.
                  </Text>
                </View>

                <Text style={styles.otpLabel}>Verification Code<Text style={styles.requiredAsterisk}> *</Text></Text>
                <OtpCodeInput
                  length={OTP_LENGTH}
                  value={otpCode}
                  onChangeCode={setOtpCode}
                  boxStyle={[styles.otpBox, isNarrowWidth && styles.otpBoxNarrow]}
                />

                <Pressable
                  onPress={() => {
                    if (resendSeconds === 0) handleSendOtp();
                  }}
                  disabled={resendSeconds > 0}
                  style={[styles.resendBtn, resendSeconds > 0 && styles.resendBtnDisabled]}
                >
                  <Text style={styles.resendBtnText}>
                    {resendSeconds > 0 ? "Resend code in " + resendSeconds + "s" : "Resend Verification Code"}
                  </Text>
                </Pressable>

                <View style={styles.warningCard}>
                  <Ionicons name="information-circle-outline" size={20} color="#0D7A57" style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={styles.warningText}>
                    Personal details (Name, Student Number, Program, Address, Birthdate) are locked after verification to protect your student records.
                  </Text>
                </View>
              </>
            )}

            {/* Error Message */}
            {!!errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 7 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Primary Action Button */}
            <Pressable
              style={[
                styles.actionBtn,
                step === 1 && isBusy && styles.actionBtnDisabled,
              ]}
              disabled={step === 1 && isBusy}
              onPress={() => {
                if (step === 1 && isBusy) return;
                if (step === 1) {
                  if (!hasValidIdScan) {
                    setErrorMessage("Please scan or upload a valid school ID before continuing.");
                    return;
                  }
                  if (!hasAcceptedScanTerms) {
                    setConsentError(true);
                    setErrorMessage("Please check the box to agree to the Terms and Conditions and Privacy Policy before continuing.");
                    return;
                  }
                  setConsentError(false);
                  setErrorMessage("");
                  setStep(2);
                  return;
                }
                if (step === 2) {
                  if (!canProceedStepTwo) {
                    setErrorMessage("Please review all details before continuing.");
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
                  return;
                }
                if (step === 5) {
                  handleVerifyAndFinish();
                }
              }}
              accessibilityRole="button"
            >
              <GradientButtonBg />
              {isBusy ? (
                <View style={styles.btnInner}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>Processing...</Text>
                </View>
              ) : (
                <Text style={styles.actionBtnText}>
                  {step === 1 ? "Continue" : step === 4 ? "Send Email Verification" : step === 5 ? "Finish Setup" : "Next"}
                </Text>
              )}
            </Pressable>

            {/* Bottom Login Link (Step 1) */}
            {step === 1 && (
              <View style={styles.loginWrap}>
                <Text style={styles.loginPrompt}>
                  Already have an account?{" "}
                  <Text
                    style={styles.loginLink}
                    onPress={() => router.push("/login")}
                  >
                    Log In
                  </Text>
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* ID Card Camera Modal */}
      <IdCardCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onCapture={handleCameraCapture}
      />

      {/* Policy Modal */}
      <Modal
        visible={policyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View style={styles.modalIconWrap}>
                  <Ionicons
                    name={policyModalTitle.includes("Privacy") ? "shield-checkmark-outline" : "document-text-outline"}
                    size={20}
                    color="#2D7D5A"
                  />
                </View>
                <Text style={styles.modalTitle}>{policyModalTitle}</Text>
              </View>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              onScroll={handlePolicyScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
              <PolicyDocument content={policyModalContent} />
            </ScrollView>

            <Text style={styles.policyReadHint}>
              {hasScrolledPolicyToEnd ? "Thanks for reviewing the full notice." : "Scroll to the end to continue."}
            </Text>

            <Pressable
              onPress={() => setPolicyModalVisible(false)}
              disabled={!hasScrolledPolicyToEnd}
              style={[
                styles.modalGotItBtn,
                !hasScrolledPolicyToEnd && styles.modalGotItBtnDisabled,
              ]}
            >
              <Text style={styles.modalGotItBtnText}>
                {hasScrolledPolicyToEnd ? "Got it" : "Scroll to Finish"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function PolicyDocument({ content }: { content: string }) {
  return (
    <>
      {content
        .trim()
        .split("\n")
        .map((line, index) => {
          const text = line.trim();

          if (!text) {
            return <View key={"space-" + index} style={styles.policySpacer} />;
          }

          if (index === 0) {
            return (
              <Text key={text + "-" + index} style={styles.policyDocumentTitle}>
                {text}
              </Text>
            );
          }

          if (text.startsWith("Effective Date:") || text.startsWith("Last Updated:")) {
            return (
              <Text key={text + "-" + index} style={styles.policyMetaText}>
                {text}
              </Text>
            );
          }

          if (/^\d+\./.test(text)) {
            return (
              <Text key={text + "-" + index} style={styles.policySectionTitle}>
                {text}
              </Text>
            );
          }

          if (text.startsWith("- ")) {
            return (
              <View key={text + "-" + index} style={styles.policyBulletRow}>
                <View style={styles.policyBulletDot} />
                <Text style={styles.policyBulletText}>{text.slice(2)}</Text>
              </View>
            );
          }

          return (
            <Text key={text + "-" + index} style={styles.policyParagraph}>
              {text}
            </Text>
          );
        })}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#5EBFA4",
  },
  headerContainer: {
    alignSelf: "center",
    overflow: "hidden",
  },
  headerSafeArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 10,
  },
  backText: {
    fontFamily: "Outfit-Medium",
    fontSize: 15,
    color: "#18362B",
    marginLeft: 3,
  },
  sheetCard: {
    flex: 1,
    marginTop: -32,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: "hidden",
    shadowColor: "#1B3A2E",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    justifyContent: "flex-start",
  },
  scrollContentNarrow: {
    paddingHorizontal: 16,
  },
  progressRow: {
    alignSelf: "center",
    marginBottom: 20,
  },
  formArea: {
    width: "100%",
    maxWidth: 350,
    alignSelf: "center",
  },
  titleArea: {
    alignItems: "center",
    marginBottom: 22,
  },
  titleAreaCompact: {
    marginBottom: 14,
  },
  stepHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E1F2E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#2D7D5A",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  logoBadgeCompact: {
    width: 54,
    height: 54,
    borderRadius: 16,
    marginBottom: 8,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  logoImageCompact: {
    width: 36,
    height: 36,
  },
  title: {
    fontFamily: "Outfit-Bold",
    fontSize: 25,
    lineHeight: 31,
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  titleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: "Outfit",
    fontSize: 13.5,
    lineHeight: 19,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 8,
  },
  uploadWrap: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#A7D7C5",
    borderRadius: 16,
    backgroundColor: "#F8FAF8",
    minHeight: 146,
    justifyContent: "flex-end",
    overflow: "hidden",
    marginBottom: 12,
  },
  uploadInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  previewContainer: {
    width: "100%",
    height: 114,
    position: "relative",
  },
  preview: {
    width: "100%",
    height: 114,
  },
  previewBadge: {
    position: "absolute",
    bottom: 6,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  previewBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    color: "#15803D",
  },
  uploadPlaceholderWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    rowGap: 4,
  },
  uploadIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EAF6EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  uploadPlaceholderTitle: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13.5,
    color: "#1F382E",
  },
  uploadPlaceholderText: {
    fontFamily: "Outfit",
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  uploadButtonsRow: {
    flexDirection: "row",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  scanOptionBtnCamera: {
    flex: 1,
    height: 44,
    backgroundColor: "#2D7D5A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
  },
  scanOptionBtnCameraText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
  scanOptionBtnUpload: {
    flex: 1,
    height: 44,
    backgroundColor: "#F1F5F9",
    borderLeftWidth: 1,
    borderLeftColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
  },
  scanOptionBtnUploadText: {
    color: "#334155",
    fontSize: 13,
    fontFamily: "Outfit-SemiBold",
  },
  helperNoticeText: {
    fontFamily: "Outfit-Medium",
    fontSize: 12,
    color: "#2D7D5A",
    marginBottom: 10,
    textAlign: "center",
  },
  consentCard: {
    backgroundColor: "#F4FAF6",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D5EBE0",
    padding: 14,
    marginBottom: 16,
  },
  consentCardError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 9,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#9CA3AF",
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: "#2D7D5A",
    borderColor: "#2D7D5A",
  },
  checkboxError: {
    borderColor: "#DC2626",
  },
  checkboxText: {
    flex: 1,
    fontFamily: "Outfit",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#243442",
  },
  linkText: {
    color: "#2D7D5A",
    fontFamily: "Outfit-Bold",
  },
  requiredAsterisk: {
    color: "#DC2626",
    fontWeight: "700",
  },
  consentBody: {
    fontFamily: "Outfit",
    color: "#5B7368",
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
  },
  label: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    fontFamily: "Outfit",
    fontSize: 14,
    color: "#111827",
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    marginBottom: 14,
    justifyContent: "center",
  },
  disabledInput: {
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
    borderColor: "#E5E7EB",
  },
  passwordInputWrap: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInputText: {
    flex: 1,
    fontFamily: "Outfit",
    fontSize: 14,
    color: "#111827",
    paddingVertical: 0,
    outlineWidth: 0,
  },
  passwordNoteText: {
    fontFamily: "Outfit",
    fontSize: 11.5,
    color: "#6B7280",
    marginBottom: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  otpLabel: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13,
    color: "#374151",
    marginBottom: 10,
    textAlign: "center",
  },
  otpBox: {
    borderRadius: 10,
    borderColor: "#CBD5E1",
    borderWidth: 1.2,
    height: 44,
    width: 34,
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    color: "#111827",
  },
  otpBoxNarrow: {
    width: 28,
    height: 40,
    fontSize: 14,
  },
  resendBtn: {
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  resendBtnDisabled: {
    opacity: 0.6,
  },
  resendBtnText: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13,
    color: "#2D7D5A",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    fontFamily: "Outfit",
    fontSize: 12,
    lineHeight: 17,
    color: "#166534",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: "Outfit-Medium",
    fontSize: 12.5,
    lineHeight: 17,
    color: "#B91C1C",
  },
  actionBtn: {
    height: 50,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#20724F",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginTop: 8,
  },
  actionBtnDisabled: {
    opacity: 0.65,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    fontFamily: "Outfit-Bold",
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  loginWrap: {
    alignItems: "center",
    marginTop: 22,
  },
  loginPrompt: {
    fontFamily: "Outfit",
    fontSize: 13,
    color: "#6B7280",
  },
  loginLink: {
    fontFamily: "Outfit-Bold",
    color: "#2D7D5A",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "86%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECE1",
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EAF6EE",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    color: "#111827",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
  },
  modalBody: {
    borderRadius: 16,
    backgroundColor: "#F9FAF8",
    borderWidth: 1,
    borderColor: "#E5EBE1",
    maxHeight: 420,
  },
  modalBodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  policyReadHint: {
    fontFamily: "Outfit",
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginVertical: 10,
  },
  modalGotItBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2D7D5A",
    alignItems: "center",
    justifyContent: "center",
  },
  modalGotItBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },
  modalGotItBtnText: {
    fontFamily: "Outfit-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  policyDocumentTitle: {
    color: "#111827",
    fontSize: 17,
    lineHeight: 23,
    fontFamily: "Outfit-Bold",
    marginBottom: 8,
  },
  policyMetaText: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Outfit",
    marginBottom: 12,
  },
  policySectionTitle: {
    color: "#1F382E",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Bold",
    marginTop: 10,
    marginBottom: 4,
  },
  policyBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  policyBulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#2D7D5A",
    marginTop: 6,
    marginRight: 8,
  },
  policyBulletText: {
    flex: 1,
    color: "#374151",
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: "Outfit",
  },
  policyParagraph: {
    color: "#374151",
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: "Outfit",
    marginBottom: 8,
  },
  policySpacer: {
    height: 8,
  },
});

