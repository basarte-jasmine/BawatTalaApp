import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import {
  bookCounselorAppointment,
  fetchAppointmentAvailability,
  fetchAppointmentCounselors,
} from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";

type CounselorCard = {
  email: string;
  fullName: string;
  gender: string;
  id: string;
  pictureUrl: string;
  role: string;
  specialties: string[];
};

type AvailabilityDay = {
  availableSlots: { available: boolean; booked: boolean; enabled: boolean; label: string; time: string }[];
  blockedByStudentSchedule?: boolean;
  date: string;
  dayLabel: string;
  dayNumber: number;
  dayOfWeek: number;
  isPast: boolean;
  slots: { available: boolean; booked: boolean; enabled: boolean; label: string; time: string }[];
};

const TOTAL_STEPS = 4;
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DEFAULT_CONCERNS = [
  "Academic Stress",
  "Anxiety / Stress",
  "Relationships",
  "Family Issues",
  "Career Guidance",
  "Financial Concerns",
  "Burnout / Exhaustion",
  "Bullying",
  "Others",
];
const GENDER_PREFERENCE = ["No Preference", "Female Counselor", "Male Counselor"];
const STEP_LABELS = ["Concern", "Preference", "Counselor", "Date & Time"];

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthTitle(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function buildCalendarCells(date: Date) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function getDayFromAvailability(days: AvailabilityDay[], dayNumber: number | null) {
  if (!dayNumber) return null;
  return days.find((item) => item.dayNumber === dayNumber) || null;
}

function formatSelectedDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00+08:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric",
  });
}

export default function ConsultScreen() {
  const { user } = useAuthSession();
  const [step, setStep] = useState(1);
  const [concerns, setConcerns] = useState<string[]>(DEFAULT_CONCERNS);
  const [selectedConcern, setSelectedConcern] = useState("Anxiety / Stress");
  const [otherConcern, setOtherConcern] = useState("");
  const [selectedGender, setSelectedGender] = useState("No Preference");
  const [selectedCounselorType, setSelectedCounselorType] = useState("professional");
  const [counselors, setCounselors] = useState<CounselorCard[]>([]);
  const [loadingCounselors, setLoadingCounselors] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCounselor, setSelectedCounselor] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [availableDays, setAvailableDays] = useState<AvailabilityDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [studentNote, setStudentNote] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCounselors() {
      try {
        setLoadingCounselors(true);
        const result = await fetchAppointmentCounselors();
        if (!isMounted) return;
        if (!result.ok) {
          setErrorMessage(result.message || "Failed to load counselors.");
          return;
        }

        const fetchedCounselors = Array.isArray(result.counselors) ? result.counselors : [];
        setCounselors(fetchedCounselors);
        if (Array.isArray(result.concernOptions) && result.concernOptions.length > 0) {
          setConcerns(result.concernOptions);
          setSelectedConcern((current) =>
            result.concernOptions!.includes(current) ? current : result.concernOptions![0],
          );
        }
        setSelectedCounselor((current) => current || fetchedCounselors[0]?.id || "");
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Failed to load counselors.");
      } finally {
        if (isMounted) {
          setLoadingCounselors(false);
        }
      }
    }

    void loadCounselors();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCounselors = useMemo(() => {
    if (selectedGender === "Female Counselor") {
      return counselors.filter((item) => item.gender === "Female");
    }
    if (selectedGender === "Male Counselor") {
      return counselors.filter((item) => item.gender === "Male");
    }
    return counselors;
  }, [counselors, selectedGender]);

  useEffect(() => {
    if (!filteredCounselors.some((item) => item.id === selectedCounselor)) {
      setSelectedCounselor(filteredCounselors[0]?.id || "");
    }
  }, [filteredCounselors, selectedCounselor]);

  useEffect(() => {
    let isMounted = true;
    if (!selectedCounselor) {
      setAvailableDays([]);
      setSelectedDay(null);
      setSelectedTime("");
      return;
    }

    async function loadAvailability() {
      try {
        setLoadingAvailability(true);
        const result = await fetchAppointmentAvailability(selectedCounselor, toMonthKey(selectedMonth), user?.studentNumber);
        if (!isMounted) return;
        if (!result.ok) {
          setErrorMessage(result.message || "Failed to load availability.");
          setAvailableDays([]);
          return;
        }

        const days = Array.isArray(result.days) ? result.days : [];
        setAvailableDays(days);
        const nextAvailableDay = days.find((item) => item.availableSlots.length > 0);
        let resolvedSelectedDay: number | null = null;
        setSelectedDay((current) => {
          const nextDay =
            current && days.some((item) => item.dayNumber === current && item.availableSlots.length > 0)
              ? current
              : nextAvailableDay?.dayNumber || null;
          resolvedSelectedDay = nextDay;
          return nextDay;
        });
        setSelectedTime((current) => {
          if (!current) return "";
          const selectedDayData = days.find((item) => item.dayNumber === resolvedSelectedDay);
          if (!selectedDayData?.availableSlots.some((slot) => slot.time === current)) {
            return "";
          }
          return current;
        });
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Failed to load availability.");
        setAvailableDays([]);
      } finally {
        if (isMounted) {
          setLoadingAvailability(false);
        }
      }
    }

    void loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [selectedCounselor, selectedMonth, user?.studentNumber]);

  const selectedDayAvailability = useMemo(
    () => getDayFromAvailability(availableDays, selectedDay),
    [availableDays, selectedDay],
  );
  const availableTimeSlots = useMemo(
    () => selectedDayAvailability?.availableSlots ?? [],
    [selectedDayAvailability],
  );
  const calendarCells = useMemo(() => buildCalendarCells(selectedMonth), [selectedMonth]);
  const currentStepLabel = STEP_LABELS[step - 1] ?? "Schedule";

  useEffect(() => {
    if (!availableTimeSlots.some((slot) => slot.time === selectedTime)) {
      setSelectedTime(availableTimeSlots[0]?.time || "");
    }
  }, [availableTimeSlots, selectedTime]);

  const handleBack = () => {
    setErrorMessage("");
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

  const handleContinue = async () => {
    setErrorMessage("");

    if (step === 1) {
      if (!selectedConcern) {
        setErrorMessage("Please select a concern first.");
        return;
      }
      if (selectedConcern === "Others" && !otherConcern.trim()) {
        setErrorMessage("Please specify your concern.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (selectedCounselorType !== "professional") {
        setErrorMessage("Peer counseling scheduling is not available yet.");
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!selectedCounselor) {
        setErrorMessage("Please select a counselor.");
        return;
      }
      setStep(4);
      return;
    }

    if (!user?.studentNumber) {
      setErrorMessage("You need to be logged in to book an appointment.");
      return;
    }
    if (!selectedCounselor || !selectedDayAvailability?.date || !selectedTime) {
      setErrorMessage("Please choose an available date and time.");
      return;
    }

    try {
      setSubmitting(true);
      const resolvedConcern = selectedConcern === "Others" ? "Others" : selectedConcern;
      const result = await bookCounselorAppointment({
        appointmentDate: selectedDayAvailability.date,
        concern: resolvedConcern,
        counselorGenderPreference: selectedGender,
        counselorId: selectedCounselor,
        slotTime: selectedTime,
        studentNote: studentNote.trim(),
        studentNumber: user.studentNumber,
      });

      if (!result.ok || !result.appointment) {
        setErrorMessage(result.message || "Failed to confirm appointment.");
        return;
      }

      router.replace(`/home?consultConfirmed=1&appointmentId=${encodeURIComponent(result.appointment.id)}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to confirm appointment.");
    } finally {
      setSubmitting(false);
    }
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
        <View style={styles.introCard}>
          <View style={styles.introHeaderRow}>
            <View style={styles.introIconWrap}>
              <Ionicons name="calendar-clear-outline" size={22} color="#4E7E2D" />
            </View>
            <View style={styles.introTextWrap}>
              <Text style={styles.introEyebrow}>Guidance Support</Text>
              <Text style={styles.introTitle}>Schedule a consultation that fits your day</Text>
              <Text style={styles.introText}>
                We&apos;ll guide you through four quick steps to find the right counselor and an open time slot.
              </Text>
            </View>
          </View>

          <View style={styles.progressMetaRow}>
            <Text style={styles.progressStepText}>{`Step ${step} of ${TOTAL_STEPS}`}</Text>
            <Text style={styles.progressStepLabel}>{currentStepLabel}</Text>
          </View>

          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
              const stepIndex = index + 1;
              return (
                <View key={`step-${stepIndex}`} style={[styles.progressDot, stepIndex <= step && styles.progressDotActive]} />
              );
            })}
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}

        <View style={styles.stepCard}>
          {loadingCounselors ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#70C943" />
              <Text style={styles.loadingText}>Loading counselors...</Text>
            </View>
          ) : null}

          {!loadingCounselors && step === 1 ? (
            <>
              <Text style={styles.stepTitle}>What brings you here today?</Text>
              <Text style={styles.stepSubTitle}>Select your main concern so we can route you to the right counselor.</Text>

              <View style={styles.concernGrid}>
                {concerns.map((item) => {
                  const isSelected = item === selectedConcern;
                  return (
                    <Pressable
                      key={item}
                      style={[styles.concernChip, isSelected && styles.concernChipActive]}
                      onPress={() => setSelectedConcern(item)}
                    >
                      <Text style={[styles.concernChipText, isSelected && styles.concernChipTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {selectedConcern === "Others" ? (
                <TextInput
                  style={styles.otherInput}
                  value={otherConcern}
                  onChangeText={setOtherConcern}
                  placeholder="Please specify your concern"
                  placeholderTextColor="#596878"
                />
              ) : null}
            </>
          ) : null}

          {!loadingCounselors && step === 2 ? (
            <>
              <Text style={styles.stepTitle}>Counselor Preference</Text>
              <Text style={styles.stepSubTitle}>Peer counseling stays unavailable for now, so booking is limited to guidance counselors.</Text>

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
              <Pressable
                style={[styles.preferenceCard, styles.typeCard, styles.preferenceCardActive]}
                onPress={() => setSelectedCounselorType("professional")}
              >
                <Text style={[styles.preferenceTitle, styles.preferenceTitleActive]}>Professional Counselor</Text>
                <Text style={styles.typeSubText}>Licensed counselors and guidance staff</Text>
              </Pressable>

              <View style={[styles.preferenceCard, styles.typeCard, styles.preferenceCardDisabled]}>
                <Text style={styles.preferenceTitle}>Peer Counselor</Text>
                <Text style={styles.typeSubText}>Scheduling coming soon</Text>
              </View>
            </>
          ) : null}

          {!loadingCounselors && step === 3 ? (
            <>
              <Text style={styles.stepTitle}>Select your Counselor</Text>
              <Text style={styles.stepSubTitle}>Only active guidance counselors with real schedules appear here.</Text>

              <View style={styles.counselorList}>
                {filteredCounselors.length ? (
                  filteredCounselors.map((item) => {
                    const selected = selectedCounselor === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.counselorCard, selected && styles.selectedCounselorCard]}
                        onPress={() => setSelectedCounselor(item.id)}
                      >
                        <View style={styles.counselorRow}>
                          {item.pictureUrl ? (
                            <Image source={{ uri: item.pictureUrl }} style={styles.counselorAvatarImage} />
                          ) : (
                            <View style={styles.counselorAvatarFallback}>
                              <Text style={styles.counselorAvatarText}>
                                {item.fullName
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((part) => part.charAt(0))
                                  .join("")
                                  .toUpperCase()}
                              </Text>
                            </View>
                          )}

                          <View style={styles.counselorInfo}>
                            <Text style={styles.counselorName}>{item.fullName}</Text>
                            <Text style={styles.counselorRole}>{item.role}</Text>
                            <Text style={styles.counselorFocus}>
                              {item.specialties?.length ? item.specialties.join(", ") : "General guidance and student support"}
                            </Text>
                          </View>

                          {selected ? <Ionicons name="checkmark-circle" size={24} color="#2E6F24" /> : null}
                        </View>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.emptyStateText}>No counselor matches that preference right now.</Text>
                )}
              </View>
            </>
          ) : null}

          {!loadingCounselors && step === 4 ? (
            <>
              <Text style={styles.stepTitle}>Choose Date & Time</Text>
              <Text style={styles.stepSubTitle}>Only open slots from the counselor&apos;s schedule can be booked.</Text>

              <View style={styles.monthHeaderRow}>
                <Pressable onPress={() => setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                  <Ionicons name="chevron-back" size={24} color="#3F4B58" />
                </Pressable>
                <Text style={styles.monthLabel}>{buildMonthTitle(selectedMonth)}</Text>
                <Pressable onPress={() => setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                  <Ionicons name="chevron-forward" size={24} color="#3F4B58" />
                </Pressable>
              </View>

              <View style={styles.weekHeaderRow}>
                {WEEKDAY_LABELS.map((day) => (
                  <Text key={day} style={styles.weekHeaderText}>
                    {day}
                  </Text>
                ))}
              </View>

              {loadingAvailability ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator color="#70C943" />
                  <Text style={styles.loadingText}>Loading available slots...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.calendarGrid}>
                    {calendarCells.map((day, index) => {
                      const dayData = getDayFromAvailability(availableDays, day);
                      const hasAvailableSlots = Boolean(dayData?.availableSlots.length);
                      const isSelected = selectedDay === day;
                      return (
                        <Pressable
                          key={`day-${String(day)}-${index}`}
                          style={styles.dayCell}
                          disabled={!day || !hasAvailableSlots}
                          onPress={() => {
                            setSelectedDay(day);
                            setSelectedTime("");
                          }}
                        >
                          <View
                            style={[
                              styles.dayBubble,
                              hasAvailableSlots && styles.dayBubbleOpen,
                              isSelected && styles.dayBubbleActive,
                              !hasAvailableSlots && day && styles.dayBubbleDisabled,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayText,
                                hasAvailableSlots && styles.dayTextOpen,
                                isSelected && styles.dayTextActive,
                                !hasAvailableSlots && day && styles.dayTextDisabled,
                              ]}
                            >
                              {day || ""}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.selectedDateLabel}>
                    {selectedDayAvailability?.date
                      ? selectedDayAvailability.blockedByStudentSchedule
                        ? `You already have a confirmed schedule on ${formatSelectedDate(selectedDayAvailability.date)}. Only one appointment is allowed per day.`
                        : `Available times for ${formatSelectedDate(selectedDayAvailability.date)}`
                      : "Select a highlighted day to see open times."}
                  </Text>

                  <View style={styles.timeGrid}>
                    {availableTimeSlots.length ? (
                      availableTimeSlots.map((slot) => {
                        const selected = selectedTime === slot.time;
                        return (
                          <Pressable
                            key={slot.time}
                            style={[styles.timeChip, selected && styles.timeChipActive]}
                            onPress={() => setSelectedTime(slot.time)}
                          >
                            <Text style={[styles.timeChipText, selected && styles.timeChipTextActive]}>{slot.label}</Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyStateText}>No available time slots for that day.</Text>
                    )}
                  </View>

                  <TextInput
                    style={styles.noteInput}
                    value={studentNote}
                    onChangeText={setStudentNote}
                    placeholder="Optional note for the counselor"
                    placeholderTextColor="#73808B"
                    multiline
                  />
                </>
              )}
            </>
          ) : null}
        </View>

        <View style={styles.continueInlineWrap}>
          <Pressable style={[styles.continueButton, submitting && styles.continueButtonDisabled]} disabled={submitting} onPress={() => void handleContinue()}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueButtonText}>{step === TOTAL_STEPS ? "Confirm Appointment" : "Continue"}</Text>}
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
    backgroundColor: "#F7FAF6",
  },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECF1",
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
    fontSize: 17.5,
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
    paddingHorizontal: 12,
    paddingBottom: 116,
  },
  introCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EEE7",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 14,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  introHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
    marginBottom: 12,
  },
  introIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EFF9E7",
    borderWidth: 1,
    borderColor: "#DCEBCF",
    alignItems: "center",
    justifyContent: "center",
  },
  introTextWrap: {
    flex: 1,
  },
  introEyebrow: {
    color: "#6C8756",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  introTitle: {
    color: "#304558",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    marginBottom: 4,
  },
  introText: {
    color: "#5E7080",
    fontSize: 14,
    lineHeight: 20,
  },
  progressMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    columnGap: 12,
  },
  progressStepText: {
    color: "#6C8756",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  progressStepLabel: {
    color: "#34495E",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    columnGap: 6,
  },
  progressDot: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#EDF1F3",
  },
  progressDotActive: {
    backgroundColor: "#79C943",
  },
  errorBanner: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#FFF0F0",
    borderWidth: 1,
    borderColor: "#F1D2D2",
    color: "#B43333",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  stepCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E6EEE7",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 22,
    marginBottom: 16,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    rowGap: 10,
  },
  loadingText: {
    color: "#52606C",
    fontSize: 14,
    lineHeight: 20,
  },
  stepTitle: {
    color: "#34495E",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  stepSubTitle: {
    color: "#617282",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  concernGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 12,
  },
  concernChip: {
    width: "48.5%",
    minHeight: 70,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDE5EA",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 12,
    shadowColor: "#9FAAB4",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  concernChipActive: {
    borderColor: "#78C74A",
    backgroundColor: "#F3FAEE",
  },
  concernChipText: {
    color: "#33475C",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  concernChipTextActive: {
    color: "#2E6F24",
    fontWeight: "700",
  },
  otherInput: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE5EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#36495D",
    fontSize: 15,
  },
  sectionLabel: {
    color: "#35495D",
    fontSize: 14,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDE5EA",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  preferenceCardActive: {
    borderColor: "#79C84B",
    backgroundColor: "#F2FAEE",
  },
  preferenceCardDisabled: {
    opacity: 0.55,
  },
  preferenceTitle: {
    color: "#33475C",
    fontSize: 15,
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
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  counselorList: {
    rowGap: 12,
  },
  counselorCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE5EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#9FAAB4",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  selectedCounselorCard: {
    borderColor: "#6DC23C",
    backgroundColor: "#F3FAEE",
  },
  counselorRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  counselorAvatarImage: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#D0D2D3",
  },
  counselorAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#D7E8CE",
    alignItems: "center",
    justifyContent: "center",
  },
  counselorAvatarText: {
    color: "#2E6F24",
    fontSize: 18,
    fontWeight: "700",
  },
  counselorInfo: {
    flex: 1,
  },
  counselorName: {
    color: "#2F4156",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  counselorRole: {
    color: "#5A8A53",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  counselorFocus: {
    color: "#5A6B7A",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthLabel: {
    color: "#36495D",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "#3D4F61",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: "#F9FBFC",
    paddingVertical: 6,
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
  },
  dayBubble: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBubbleOpen: {
    backgroundColor: "#EDF8E6",
  },
  dayBubbleDisabled: {
    backgroundColor: "#F1F4F6",
  },
  dayBubbleActive: {
    backgroundColor: "#70C943",
  },
  dayText: {
    color: "#4A5F4A",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  dayTextOpen: {
    color: "#2E6F24",
  },
  dayTextDisabled: {
    color: "#9CA4AA",
  },
  dayTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  selectedDateLabel: {
    color: "#526476",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  timeChip: {
    width: "32%",
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD4DB",
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
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  timeChipTextActive: {
    color: "#2E6F24",
    fontWeight: "700",
  },
  noteInput: {
    minHeight: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDE5EA",
    backgroundColor: "#FFFFFF",
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#36495D",
    fontSize: 14,
    textAlignVertical: "top",
  },
  emptyStateText: {
    color: "#66717A",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 18,
  },
  continueInlineWrap: {
    paddingHorizontal: 6,
    marginTop: 2,
    marginBottom: 10,
  },
  continueButton: {
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5F7A55",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
});
