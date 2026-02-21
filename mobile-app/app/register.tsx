import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
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
import { StepProgress } from "../components/forms/StepProgress";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";

const TOTAL_STEPS = 4;

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [program, setProgram] = useState("");
  const [barangay, setBarangay] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");

  const handleBack = () => {
    if (step === 1) {
      router.back();
      return;
    }

    setStep((prev) => prev - 1);
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS) {
      setStep((prev) => prev + 1);
      return;
    }

    router.replace("/home");
  };

  const renderStepOne = () => (
    <>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>Create your account to start journaling{"\n"}and track your progress.</Text>
      <StepProgress total={TOTAL_STEPS} current={step} containerStyle={styles.progressRow} />

      <Text style={styles.sectionTitle}>Upload a photo of your Student ID</Text>
      <View style={styles.uploadWrap}>
        <View style={styles.uploadInner}>
          <Ionicons name="image-outline" size={28} color="#1D1D1D" />
          <Pressable style={styles.fileButton}>
            <Text style={styles.fileButtonText}>Select File</Text>
          </Pressable>
        </View>
      </View>
    </>
  );

  const renderStepTwo = () => (
    <>
      <StepProgress total={TOTAL_STEPS} current={step} containerStyle={styles.progressRow} />
      <Text style={styles.headerBody}>Does this look right?{"\n"}Review the details we found.</Text>

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
        onChangeText={setStudentNumber}
        labelStyle={styles.label}
        inputStyle={styles.input}
      />

      <FormTextInput
        label="Program"
        value={program}
        onChangeText={setProgram}
        placeholder=""
        placeholderTextColor="#8D8D8D"
        labelStyle={styles.label}
        inputWrapStyle={styles.inputWithIcon}
        inputStyle={styles.inputField}
        rightAdornment={<Ionicons name="chevron-down" size={20} color="#1D1D1D" />}
      />
    </>
  );

  const renderStepThree = () => (
    <>
      <StepProgress total={TOTAL_STEPS} current={step} containerStyle={styles.progressRow} />
      <Text style={styles.headerBody}>
        Where are you writing from?{"\n"}Add your address to help us tailor your{"\n"}experience.
      </Text>

      <FormTextInput
        label="Barangay"
        value={barangay}
        onChangeText={setBarangay}
        labelStyle={styles.label}
        inputWrapStyle={styles.inputWithIcon}
        inputStyle={styles.inputField}
        rightAdornment={<Ionicons name="chevron-down" size={20} color="#1D1D1D" />}
      />

      <FormTextInput
        label="Street"
        value={street}
        onChangeText={setStreet}
        labelStyle={styles.label}
        inputStyle={styles.input}
      />

      <FormTextInput
        label="House Number"
        value={houseNumber}
        onChangeText={setHouseNumber}
        labelStyle={styles.label}
        inputStyle={styles.input}
      />
    </>
  );

  const renderStepFour = () => (
    <>
      <StepProgress total={TOTAL_STEPS} current={step} containerStyle={styles.progressRow} />
      <Text style={styles.headerBody}>Secure your journal Add a few more details{"\n"}to keep your entries safe.</Text>

      <FormTextInput
        label="Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="name@gmail.com"
        placeholderTextColor="#728274"
        labelStyle={styles.label}
        inputStyle={styles.input}
      />

      <FormTextInput
        label="Birthdate"
        value={birthdate}
        onChangeText={setBirthdate}
        placeholder="MM/DD/YYYY"
        placeholderTextColor="#8D8D8D"
        labelStyle={styles.label}
        inputStyle={styles.input}
      />

      <FormTextInput
        label="Password"
        value={birthdate}
        editable={false}
        selectTextOnFocus={false}
        placeholder="Auto-set from birthdate"
        placeholderTextColor="#8D8D8D"
        labelStyle={styles.label}
        inputWrapStyle={styles.inputWithIcon}
        inputStyle={styles.inputField}
        rightAdornment={<Ionicons name="lock-closed-outline" size={18} color="#1D1D1D" />}
      />
      <Text style={styles.helperText}>
        Password is set to your birthdate by default. You can change it later.
      </Text>
    </>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={34} color="#1C1C1C" />
        </Pressable>

        <View style={styles.formArea}>
          {step === 1 && renderStepOne()}
          {step === 2 && renderStepTwo()}
          {step === 3 && renderStepThree()}
          {step === 4 && renderStepFour()}
        </View>

        <AppPrimaryButton
          label={step === 1 ? "Continue" : step === 4 ? "Finish Setup" : "Next"}
          onPress={handleContinue}
          containerStyle={styles.actionButton}
        />
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
    paddingTop: 84,
    width: "100%",
    maxWidth: 320,
  },
  title: {
    textAlign: "center",
    fontSize: 56 / 2,
    lineHeight: 36,
    color: "#111111",
    fontFamily: "Fraunces-Regular",
    marginBottom: 10,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 21 / 2,
    lineHeight: 15,
    color: "#1A1A1A",
    marginBottom: 18,
  },
  progressRow: {
    marginBottom: 52,
  },
  sectionTitle: {
    textAlign: "center",
    color: "#111111",
    fontSize: 18 / 2,
    fontWeight: "600",
    marginBottom: 26,
  },
  uploadWrap: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#6A7F93",
    borderRadius: 6,
    minHeight: 96,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  uploadInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
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
    lineHeight: 24,
    fontWeight: "600",
    marginBottom: 30,
  },
  label: {
    color: "#111111",
    fontSize: 10,
    marginBottom: 6,
  },
  input: {
    paddingVertical: 10,
    marginBottom: 14,
  },
  inputWithIcon: {
    height: 44,
    marginBottom: 14,
  },
  inputField: {
    fontSize: 14,
    color: "#111111",
  },
  helperText: {
    color: "#4A4A4A",
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12,
  },
  actionButton: {
    marginTop: 20,
  },
});
