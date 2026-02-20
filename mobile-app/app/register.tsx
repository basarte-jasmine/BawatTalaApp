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
  TextInput,
  View,
} from "react-native";

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

  const renderProgress = () => (
    <View style={styles.progressRow}>
      {Array.from({ length: TOTAL_STEPS }, (_, index) => {
        const isActive = index + 1 === step;
        return <View key={`step-${index + 1}`} style={[styles.progressPill, isActive && styles.progressPillActive]} />;
      })}
    </View>
  );

  const renderStepOne = () => (
    <>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>Create your account to start journaling{"\n"}and track your progress.</Text>
      {renderProgress()}

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
      {renderProgress()}
      <Text style={styles.headerBody}>Does this look right?{"\n"}Review the details we found.</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

      <Text style={styles.label}>Student Number</Text>
      <TextInput style={styles.input} value={studentNumber} onChangeText={setStudentNumber} />

      <Text style={styles.label}>Program</Text>
      <View style={styles.inputWithIcon}>
        <TextInput
          style={styles.inputField}
          value={program}
          onChangeText={setProgram}
          placeholder=""
          placeholderTextColor="#8D8D8D"
        />
        <Ionicons name="chevron-down" size={20} color="#1D1D1D" />
      </View>
    </>
  );

  const renderStepThree = () => (
    <>
      {renderProgress()}
      <Text style={styles.headerBody}>
        Where are you writing from?{"\n"}Add your address to help us tailor your{"\n"}experience.
      </Text>

      <Text style={styles.label}>Barangay</Text>
      <View style={styles.inputWithIcon}>
        <TextInput style={styles.inputField} value={barangay} onChangeText={setBarangay} />
        <Ionicons name="chevron-down" size={20} color="#1D1D1D" />
      </View>

      <Text style={styles.label}>Street</Text>
      <TextInput style={styles.input} value={street} onChangeText={setStreet} />

      <Text style={styles.label}>House Number</Text>
      <TextInput style={styles.input} value={houseNumber} onChangeText={setHouseNumber} />
    </>
  );

  const renderStepFour = () => (
    <>
      {renderProgress()}
      <Text style={styles.headerBody}>Secure your journal Add a few more details{"\n"}to keep your entries safe.</Text>

      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="name@gmail.com"
        placeholderTextColor="#728274"
      />

      <Text style={styles.label}>Birthdate</Text>
      <TextInput
        style={styles.input}
        value={birthdate}
        onChangeText={setBirthdate}
        placeholder="MM/DD/YYYY"
        placeholderTextColor="#8D8D8D"
      />

      <Text style={styles.label}>Password</Text>
      <View style={styles.inputWithIcon}>
        <TextInput
          style={styles.inputField}
          value={birthdate}
          editable={false}
          selectTextOnFocus={false}
          placeholder="Auto-set from birthdate"
          placeholderTextColor="#8D8D8D"
        />
        <Ionicons name="lock-closed-outline" size={18} color="#1D1D1D" />
      </View>
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

        <Pressable style={styles.actionButton} onPress={handleContinue}>
          <Text style={styles.actionButtonText}>
            {step === 1 ? "Continue" : step === 4 ? "Finish Setup" : "Next"}
          </Text>
        </Pressable>
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
    flexDirection: "row",
    alignSelf: "center",
    gap: 3,
    marginBottom: 52,
  },
  progressPill: {
    width: 30,
    height: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#FFFFFF",
  },
  progressPillActive: {
    backgroundColor: "#111111",
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
    height: 44,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111111",
    marginBottom: 14,
  },
  inputWithIcon: {
    height: 44,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  inputField: {
    flex: 1,
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
    width: 290,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#7A9EBA",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5E7D95",
    shadowOpacity: 0.33,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    marginTop: 20,
    alignSelf: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
