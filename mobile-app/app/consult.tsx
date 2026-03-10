import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";

type ConcernOption = {
  id: string;
  label: string;
};

type CounselorType = {
  id: string;
  label: string;
  subtitle: string;
};

type CounselorProfile = {
  id: string;
  name: string;
  role: string;
  focus: string;
  recommended?: boolean;
};

const TOTAL_STEPS = 4;
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const CONCERN_OPTIONS: ConcernOption[] = [
  { id: "academic", label: "Academic Stress" },
  { id: "anxiety", label: "Anxiety/ Stress" },
  { id: "relationships", label: "Relationships" },
  { id: "family", label: "Family Issues" },
  { id: "career", label: "Career Guidance" },
  { id: "financial", label: "Financial Concerns" },
  { id: "burnout", label: "Burnout/ Exhaustion" },
  { id: "bullying", label: "Bullying" },
];

const GENDER_PREFERENCE = ["No Preference", "Female Counselor", "Male Counselor"];

const COUNSELOR_TYPES: CounselorType[] = [
  {
    id: "professional",
    label: "Professional Counselor",
    subtitle: "Licensed counselors and guidance staff",
  },
  {
    id: "peer",
    label: "Peer Counselor",
    subtitle: "Fellow students trained in peer counseling",
  },
];

const COUNSELORS: CounselorProfile[] = [
  {
    id: "janice",
    name: "Ms. Janice Akim",
    role: "Peer Counselor",
    focus: "Academic Stress, Career Guidance",
    recommended: true,
  },
  {
    id: "joanna",
    name: "Ms. Joanna Mae",
    role: "Peer Counselor",
    focus: "Anxiety, Stress Management",
  },
  {
    id: "aseemo",
    name: "Mr. Aseemo",
    role: "Peer Counselor",
    focus: "Academic Stress, Career Guidance",
  },
];

const TIME_SLOTS = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM"];

const CALENDAR_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

export default function ConsultScreen() {
  const [step, setStep] = useState(1);
  const [selectedConcern, setSelectedConcern] = useState("anxiety");
  const [otherConcern, setOtherConcern] = useState("");
  const [selectedGender, setSelectedGender] = useState("No Preference");
  const [selectedCounselorType, setSelectedCounselorType] = useState("professional");
  const [selectedCounselor, setSelectedCounselor] = useState("janice");
  const [selectedDay, setSelectedDay] = useState(27);
  const [selectedTime, setSelectedTime] = useState("10:00 AM");

  const handleBack = () => {
    if (step > 1) {
      setStep((current) => current - 1);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS) {
      setStep((current) => current + 1);
      return;
    }
    router.replace("/home?consultConfirmed=1");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#3A434E" />
        </Pressable>

        <Text style={styles.topTitle}>Schedule Consultation</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.introText}>
          You don&apos;t have to navigate this alone. Choose the type of support that feels right for you today.
        </Text>

        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
            const stepIndex = index + 1;
            return (
              <View key={`step-${stepIndex}`} style={[styles.progressDot, stepIndex <= step && styles.progressDotActive]} />
            );
          })}
        </View>

        <View style={styles.stepCard}>
          {step === 1 ? (
            <>
              <Text style={styles.stepTitle}>What brings you here today?</Text>
              <Text style={styles.stepSubTitle}>
                Please select your primary concern to help us recommend the best counselor
              </Text>

              <View style={styles.concernGrid}>
                {CONCERN_OPTIONS.map((item) => {
                  const isSelected = item.id === selectedConcern;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.concernChip, isSelected && styles.concernChipActive]}
                      onPress={() => setSelectedConcern(item.id)}
                    >
                      <Text style={[styles.concernChipText, isSelected && styles.concernChipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                style={styles.otherInput}
                value={otherConcern}
                onChangeText={setOtherConcern}
                placeholder="Others: Please specify"
                placeholderTextColor="#596878"
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.stepTitle}>Counselor Preference</Text>
              <Text style={styles.stepSubTitle}>Who would you feel more comfortable talking with?</Text>

              <Text style={styles.sectionLabel}>Gender Preference</Text>
              {GENDER_PREFERENCE.map((item) => {
                const selected = selectedGender === item;
                return (
                  <Pressable
                    key={item}
                    style={[styles.preferenceCard, selected && styles.preferenceCardActive]}
                    onPress={() => setSelectedGender(item)}
                  >
                    <Text style={[styles.preferenceTitle, selected && styles.preferenceTitleActive]}>{item}</Text>
                  </Pressable>
                );
              })}

              <Text style={[styles.sectionLabel, styles.typeSectionLabel]}>Type of Counseling</Text>
              {COUNSELOR_TYPES.map((item) => {
                const selected = selectedCounselorType === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.preferenceCard, styles.typeCard, selected && styles.preferenceCardActive]}
                    onPress={() => setSelectedCounselorType(item.id)}
                  >
                    <Text style={[styles.preferenceTitle, selected && styles.preferenceTitleActive]}>{item.label}</Text>
                    <Text style={styles.typeSubText}>{item.subtitle}</Text>
                  </Pressable>
                );
              })}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.stepTitle}>Select your Counselor</Text>
              <Text style={styles.stepSubTitle}>
                Based on your preferences, we&apos;ve marked our recommendations
              </Text>

              <View style={styles.counselorList}>
                {COUNSELORS.map((item) => {
                  const selected = selectedCounselor === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.counselorCard,
                        item.recommended && styles.recommendedCounselorCard,
                        selected && styles.selectedCounselorCard,
                      ]}
                      onPress={() => setSelectedCounselor(item.id)}
                    >
                      {item.recommended ? <Text style={styles.recommendedText}>Recommended for you</Text> : null}
                      <View style={styles.counselorRow}>
                        <View style={styles.counselorAvatar} />

                        <View style={styles.counselorInfo}>
                          <Text style={styles.counselorName}>{item.name}</Text>
                          <Text style={styles.counselorRole}>{item.role}</Text>
                          <Text style={styles.counselorFocus}>{item.focus}</Text>
                        </View>

                        <Ionicons name="chevron-forward" size={21} color="#303841" />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={styles.stepTitle}>Choose Date & Time</Text>
              <Text style={styles.stepSubTitle}>Select your availability for on-site session at the Guidance Office</Text>

              <View style={styles.monthHeaderRow}>
                <Ionicons name="chevron-back" size={24} color="#3F4B58" />
                <Text style={styles.monthLabel}>February</Text>
                <Ionicons name="chevron-forward" size={24} color="#3F4B58" />
              </View>

              <View style={styles.weekHeaderRow}>
                {WEEKDAY_LABELS.map((day) => (
                  <Text key={day} style={styles.weekHeaderText}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {CALENDAR_DAYS.map((day) => {
                  const selected = selectedDay === day;
                  return (
                    <Pressable key={`day-${day}`} style={styles.dayCell} onPress={() => setSelectedDay(day)}>
                      <View style={[styles.dayBubble, selected && styles.dayBubbleActive]}>
                        <Text style={[styles.dayText, selected && styles.dayTextActive]}>{day}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.timeGrid}>
                {TIME_SLOTS.map((slot) => {
                  const selected = selectedTime === slot;
                  return (
                    <Pressable
                      key={slot}
                      style={[styles.timeChip, selected && styles.timeChipActive]}
                      onPress={() => setSelectedTime(slot)}
                    >
                      <Text style={[styles.timeChipText, selected && styles.timeChipTextActive]}>{slot}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.continueInlineWrap}>
          <Pressable style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>{step === TOTAL_STEPS ? "Confirm Appointment" : "Continue"}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <HomeBottomNav activeTab="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ECECEC",
  },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#D1D3D4",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#32465A",
    fontSize: 18 / 1.03,
    lineHeight: 23,
    fontWeight: "700",
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 0,
    paddingBottom: 116,
  },
  introText: {
    textAlign: "center",
    color: "#34485D",
    fontSize: 20 / 1.18,
    lineHeight: 32 / 1.18,
    marginHorizontal: 24,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: "row",
    alignSelf: "center",
    columnGap: 3,
    marginBottom: 14,
  },
  progressDot: {
    width: 30,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#262D33",
  },
  progressDotActive: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  stepCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderColor: "#C9CDCF",
    backgroundColor: "#F6F6F6",
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 22,
    minHeight: 470,
  },
  stepTitle: {
    color: "#34495E",
    fontSize: 34 / 2,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  stepSubTitle: {
    color: "#34495E",
    fontSize: 28 / 2,
    lineHeight: 20,
    marginBottom: 14,
  },
  concernGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginBottom: 10,
  },
  concernChip: {
    width: "48.5%",
    minHeight: 66,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C9CED2",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 12,
    shadowColor: "#777777",
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  concernChipActive: {
    borderColor: "#78C74A",
    backgroundColor: "#F2FAEE",
  },
  concernChipText: {
    color: "#33475C",
    fontSize: 17 / 1.08,
    lineHeight: 23,
    fontWeight: "600",
  },
  concernChipTextActive: {
    color: "#2E6F24",
    fontWeight: "700",
  },
  otherInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C9CED2",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    color: "#36495D",
    fontSize: 17 / 1.1,
  },
  sectionLabel: {
    color: "#35495D",
    fontSize: 31 / 2,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  typeSectionLabel: {
    marginTop: 16,
  },
  preferenceCard: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C9CED2",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 10,
    shadowColor: "#777777",
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  preferenceCardActive: {
    borderColor: "#79C84B",
    backgroundColor: "#F2FAEE",
  },
  preferenceTitle: {
    color: "#33475C",
    fontSize: 17 / 1.08,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  preferenceTitleActive: {
    color: "#2E6F24",
  },
  typeCard: {
    alignItems: "flex-start",
    paddingHorizontal: 14,
  },
  typeSubText: {
    color: "#44576B",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  counselorList: {
    rowGap: 12,
  },
  counselorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D0D4D6",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#777777",
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  recommendedCounselorCard: {
    borderColor: "#89D35D",
  },
  selectedCounselorCard: {
    borderColor: "#6DC23C",
    backgroundColor: "#F3FAEE",
  },
  recommendedText: {
    color: "#78C54A",
    fontSize: 15 / 1.08,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  counselorRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  counselorAvatar: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#D0D2D3",
  },
  counselorInfo: {
    flex: 1,
  },
  counselorName: {
    color: "#2F4156",
    fontSize: 17 / 1.03,
    lineHeight: 24,
    fontWeight: "700",
  },
  counselorRole: {
    color: "#89CFDB",
    fontSize: 14 / 1.1,
    lineHeight: 18,
    fontWeight: "600",
  },
  counselorFocus: {
    color: "#5A6B7A",
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  monthLabel: {
    color: "#36495D",
    fontSize: 34 / 2,
    lineHeight: 22,
    fontWeight: "700",
  },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    paddingHorizontal: 2,
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "#3D4F61",
    fontSize: 16 / 1.08,
    lineHeight: 20,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  dayBubble: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBubbleActive: {
    backgroundColor: "#70C943",
  },
  dayText: {
    color: "#4A5F4A",
    fontSize: 16 / 1.16,
    lineHeight: 18,
    fontWeight: "600",
  },
  dayTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  timeChip: {
    width: "32%",
    minHeight: 30,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#9CA4AA",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipActive: {
    borderColor: "#70C943",
    backgroundColor: "#F3FAEE",
  },
  timeChipText: {
    color: "#3A4D61",
    fontSize: 16 / 1.08,
    lineHeight: 20,
    fontWeight: "600",
  },
  timeChipTextActive: {
    color: "#2E6F24",
    fontWeight: "700",
  },
  continueInlineWrap: {
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 10,
  },
  continueButton: {
    height: 48,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6B6B6B",
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 20 / 1.08,
    lineHeight: 24,
    fontWeight: "700",
  },
});
