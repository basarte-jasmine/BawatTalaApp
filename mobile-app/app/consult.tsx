import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
  blockedByLeadTime?: boolean;
  blockedByStudentSchedule?: boolean;
  date: string;
  dayLabel: string;
  dayNumber: number;
  dayOfWeek: number;
  isPast: boolean;
  slots: { available: boolean; booked: boolean; enabled: boolean; label: string; time: string }[];
};

type SupportTrack = "professional" | "peer";

const TOTAL_STEPS = 4;
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const INTERPERSONAL_RELATIONSHIP_CONCERN = "Interpersonal relationships";
const INTERPERSONAL_RELATIONSHIP_SUBCONCERNS = [
  "Peer relationship",
  "Family relationship",
  "Romantic relationship",
];
const DEFAULT_CONCERNS = [
  "Personal problems",
  "Mental health",
  "Academic problems",
  INTERPERSONAL_RELATIONSHIP_CONCERN,
  "Career guidance",
  "Financial guidance",
  "Anxiety",
  "Stress",
  "Bullying",
  "Adjustment",
  "Others",
];
const DEFAULT_CONCERN_SUBCATEGORIES = {
  [INTERPERSONAL_RELATIONSHIP_CONCERN]: INTERPERSONAL_RELATIONSHIP_SUBCONCERNS,
};
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

function normalizeSupportTrack(value: string | undefined): SupportTrack | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "professional") {
    return "professional";
  }
  if (normalized === "peer") {
    return "peer";
  }
  return null;
}

export default function ConsultScreen() {
  const { track, skipIntro } = useLocalSearchParams<{ skipIntro?: string; track?: string }>();
  const { user } = useAuthSession();
  const initialTrack = normalizeSupportTrack(track);
  const opensWithChooser = initialTrack === null && skipIntro !== "1";
  const [step, setStep] = useState(1);
  const [showChooser, setShowChooser] = useState(opensWithChooser);
  const [concerns, setConcerns] = useState<string[]>(DEFAULT_CONCERNS);
  const [concernSubcategories, setConcernSubcategories] = useState<Record<string, string[]>>(DEFAULT_CONCERN_SUBCATEGORIES);
  const [selectedConcern, setSelectedConcern] = useState("Anxiety");
  const [selectedRelationshipConcern, setSelectedRelationshipConcern] = useState(INTERPERSONAL_RELATIONSHIP_SUBCONCERNS[0]);
  const [otherConcern, setOtherConcern] = useState("");
  const [selectedGender, setSelectedGender] = useState("No Preference");
  const [selectedTrack, setSelectedTrack] = useState<SupportTrack>(initialTrack ?? "professional");
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
        if (result.concernSubcategories && Object.keys(result.concernSubcategories).length > 0) {
          setConcernSubcategories(result.concernSubcategories);
          const relationshipOptions = result.concernSubcategories[INTERPERSONAL_RELATIONSHIP_CONCERN] ?? [];
          if (relationshipOptions.length > 0) {
            setSelectedRelationshipConcern((current) =>
              relationshipOptions.includes(current) ? current : relationshipOptions[0],
            );
          }
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

  const professionalCounselors = useMemo(
    () =>
      counselors.filter((item) => {
        const role = String(item.role || "").toLowerCase();
        return !role.includes("peer");
      }),
    [counselors],
  );
  const peerCounselors = useMemo(
    () =>
      counselors.filter((item) => {
        const role = String(item.role || "").toLowerCase();
        return role.includes("peer");
      }),
    [counselors],
  );
  const activeCounselors = useMemo(
    () => (selectedTrack === "peer" ? peerCounselors : professionalCounselors),
    [peerCounselors, professionalCounselors, selectedTrack],
  );
  const filteredCounselors = useMemo(() => {
    const counselorPool = activeCounselors;
    if (selectedGender === "Female Counselor") {
      return counselorPool.filter((item) => item.gender === "Female");
    }
    if (selectedGender === "Male Counselor") {
      return counselorPool.filter((item) => item.gender === "Male");
    }
    return counselorPool;
  }, [activeCounselors, selectedGender]);
  const hasPeerCounselors = peerCounselors.length > 0;
  const supportsStepFlow = selectedTrack === "professional" || hasPeerCounselors;
  const supportEyebrow = selectedTrack === "peer" ? "Peer Support" : "Guidance Support";
  const supportTitle =
    selectedTrack === "peer" ? "Find a calmer conversation with a peer counselor" : "Schedule a consultation that fits your day";
  const supportDescription =
    selectedTrack === "peer"
      ? "Choose a trained peer listener when you want a gentler first step and a scheduled space to talk."
      : "We'll guide you through four quick steps to find the right counselor and an open time slot.";

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
    if (showChooser) {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace("/home");
      return;
    }
    if (step > 1) {
      setStep((current) => current - 1);
      return;
    }
    if (opensWithChooser) {
      setShowChooser(true);
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
      if (selectedConcern === INTERPERSONAL_RELATIONSHIP_CONCERN && !selectedRelationshipConcern) {
        setErrorMessage("Please select the relationship concern.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
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
      const resolvedConcern =
        selectedConcern === INTERPERSONAL_RELATIONSHIP_CONCERN
          ? selectedRelationshipConcern
          : selectedConcern === "Others"
            ? "Others"
            : selectedConcern;
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
        setErrorMessage(result.message || "Failed to submit appointment request.");
        return;
      }

      router.replace(`/home?consultConfirmed=1&appointmentId=${encodeURIComponent(result.appointment.id)}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit appointment request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChooseTrack = (nextTrack: SupportTrack) => {
    setSelectedTrack(nextTrack);
    setShowChooser(false);
    setStep(1);
    setErrorMessage("");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#3A434E" />
        </Pressable>

        <Text style={styles.topTitle}>Consult Support</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {showChooser ? (
          <>
            <View style={styles.welcomeHeroCard}>
              <View style={styles.welcomeGlowOne} />
              <View style={styles.welcomeGlowTwo} />
              <View style={styles.welcomeHeroTopRow}>
                <View style={styles.welcomeHeroIconWrap}>
                  <Ionicons name="chatbubbles-outline" size={24} color="#447348" />
                </View>
                <View style={styles.welcomeHeroCopy}>
                  <Text style={styles.welcomeEyebrow}>Support That Meets You Gently</Text>
                  <Text style={styles.welcomeTitle}>Choose the kind of support that feels right today.</Text>
                  <Text style={styles.welcomeText}>
                    Start with a licensed professional counselor or a peer counselor. Both paths are meant to help you feel safer, heard, and supported.
                  </Text>
                </View>
              </View>

              <View style={styles.welcomePillRow}>
                <View style={styles.welcomePill}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#4B7A42" />
                  <Text style={styles.welcomePillText}>Private support</Text>
                </View>
                <View style={styles.welcomePill}>
                  <Ionicons name="leaf-outline" size={14} color="#4B7A42" />
                  <Text style={styles.welcomePillText}>Calm first step</Text>
                </View>
              </View>
            </View>

            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}

            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>Who would you like to talk to?</Text>
              <Text style={styles.stepSubTitle}>
                Pick the kind of support you want first. You can always come back and choose the other option later.
              </Text>

              <Pressable style={styles.trackOptionCard} onPress={() => handleChooseTrack("professional")}>
                <View style={styles.trackOptionIconWrap}>
                  <Ionicons name="calendar-clear-outline" size={22} color="#4E7E2D" />
                </View>
                <View style={styles.trackOptionCopy}>
                  <View style={styles.trackOptionHeaderRow}>
                    <Text style={styles.trackOptionTitle}>Professional Counselor</Text>
                    <View style={[styles.trackStatusPill, styles.trackStatusPillActive]}>
                      <Text style={[styles.trackStatusText, styles.trackStatusTextActive]}>
                        {professionalCounselors.length ? `${professionalCounselors.length} available` : "Book a session"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.trackOptionBody}>
                    Meet with guidance staff for deeper support, private counseling, and formal scheduled care.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B8862" />
              </Pressable>

              <Pressable style={[styles.trackOptionCard, styles.trackOptionCardSoft]} onPress={() => handleChooseTrack("peer")}>
                <View style={[styles.trackOptionIconWrap, styles.trackOptionIconWrapBlue]}>
                  <Ionicons name="people-outline" size={22} color="#4E6F88" />
                </View>
                <View style={styles.trackOptionCopy}>
                  <View style={styles.trackOptionHeaderRow}>
                    <Text style={styles.trackOptionTitle}>Peer Counselor</Text>
                    <View style={[styles.trackStatusPill, hasPeerCounselors ? styles.trackStatusPillBlue : styles.trackStatusPillMuted]}>
                      <Text
                        style={[
                          styles.trackStatusText,
                          hasPeerCounselors ? styles.trackStatusTextBlue : styles.trackStatusTextMuted,
                        ]}
                      >
                        {hasPeerCounselors ? `${peerCounselors.length} available` : "Preparing schedules"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.trackOptionBody}>
                    Start with a trained student listener when you want a more relatable, lighter first conversation.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7B87" />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.introCard}>
              <View style={styles.introHeaderRow}>
                <View style={[styles.introIconWrap, selectedTrack === "peer" && styles.introIconWrapBlue]}>
                  <Ionicons
                    name={selectedTrack === "peer" ? "people-outline" : "calendar-clear-outline"}
                    size={22}
                    color={selectedTrack === "peer" ? "#4E6F88" : "#4E7E2D"}
                  />
                </View>
                <View style={styles.introTextWrap}>
                  <Text style={styles.introEyebrow}>{supportEyebrow}</Text>
                  <Text style={styles.introTitle}>{supportTitle}</Text>
                  <Text style={styles.introText}>{supportDescription}</Text>
                </View>
              </View>

              {supportsStepFlow ? (
                <>
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
                </>
              ) : (
                <View style={styles.peerStatusBanner}>
                  <Ionicons name="sparkles-outline" size={16} color="#5F7A8F" />
                  <Text style={styles.peerStatusBannerText}>Peer counselor schedules are still being prepared.</Text>
                </View>
              )}
            </View>

            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}

            <View style={styles.stepCard}>
              {loadingCounselors ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator color="#70C943" />
                  <Text style={styles.loadingText}>Loading counselors...</Text>
                </View>
              ) : null}

              {!loadingCounselors && !supportsStepFlow ? (
                <View style={styles.peerEmptyState}>
                  <View style={styles.peerEmptyIconWrap}>
                    <Ionicons name="people-outline" size={26} color="#5C7790" />
                  </View>
                  <Text style={styles.peerEmptyTitle}>Peer counseling will open here soon</Text>
                  <Text style={styles.peerEmptyText}>
                    We&apos;re getting peer listeners and schedules ready. For now, you can return to the welcome screen or continue with a professional counselor right away.
                  </Text>

                  <Pressable style={styles.peerPrimaryButton} onPress={() => handleChooseTrack("professional")}>
                    <Text style={styles.peerPrimaryButtonText}>Continue with Professional Counselor</Text>
                  </Pressable>

                  {opensWithChooser ? (
                    <Pressable
                      style={styles.peerSecondaryButton}
                      onPress={() => {
                        setShowChooser(true);
                        setErrorMessage("");
                      }}
                    >
                      <Text style={styles.peerSecondaryButtonText}>Back to Support Options</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {!loadingCounselors && supportsStepFlow && step === 1 ? (
                <>
                  <Text style={styles.stepTitle}>What brings you here today?</Text>
                  <Text style={styles.stepSubTitle}>
                    Select your main concern so we can route you to the right {selectedTrack === "peer" ? "peer counselor" : "counselor"}.
                  </Text>

                  <View style={styles.concernGrid}>
                    {concerns.map((item) => {
                      const isSelected = item === selectedConcern;
                      return (
                        <Pressable
                          key={item}
                          style={[styles.concernChip, isSelected && styles.concernChipActive]}
                          onPress={() => {
                            setSelectedConcern(item);
                            if (item === INTERPERSONAL_RELATIONSHIP_CONCERN) {
                              const relationshipOptions = concernSubcategories[INTERPERSONAL_RELATIONSHIP_CONCERN] ?? [];
                              setSelectedRelationshipConcern((current) =>
                                relationshipOptions.includes(current) ? current : relationshipOptions[0] ?? "",
                              );
                            }
                          }}
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

                  {selectedConcern === INTERPERSONAL_RELATIONSHIP_CONCERN ? (
                    <View style={styles.relationshipDropdown}>
                      {(concernSubcategories[INTERPERSONAL_RELATIONSHIP_CONCERN] ?? INTERPERSONAL_RELATIONSHIP_SUBCONCERNS).map((item) => {
                        const isSelected = selectedRelationshipConcern === item;
                        return (
                          <Pressable
                            key={item}
                            style={[styles.relationshipOption, isSelected && styles.relationshipOptionActive]}
                            onPress={() => setSelectedRelationshipConcern(item)}
                          >
                            <Text style={[styles.relationshipOptionText, isSelected && styles.relationshipOptionTextActive]}>
                              {item}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </>
              ) : null}

              {!loadingCounselors && supportsStepFlow && step === 2 ? (
                <>
                  <Text style={styles.stepTitle}>Counselor Preference</Text>
                  <Text style={styles.stepSubTitle}>
                    Let us know if you have a gender preference before we show your available {selectedTrack === "peer" ? "peer counselors" : "counselors"}.
                  </Text>

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
                </>
              ) : null}

              {!loadingCounselors && supportsStepFlow && step === 3 ? (
                <>
                  <Text style={styles.stepTitle}>Select your Counselor</Text>
                  <Text style={styles.stepSubTitle}>
                    Only active {selectedTrack === "peer" ? "peer counselors" : "guidance counselors"} with real schedules appear here.
                  </Text>

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

              {!loadingCounselors && supportsStepFlow && step === 4 ? (
                <>
                  <Text style={styles.stepTitle}>Choose Date & Time</Text>
                  <Text style={styles.stepSubTitle}>
                    Only open slots from the counselor&apos;s schedule can be booked. Same-day and next-day requests stay blocked so the counselor still has 24 hours to confirm.
                  </Text>

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
                                  !hasAvailableSlots && Boolean(day) && styles.dayBubbleDisabled,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.dayText,
                                    hasAvailableSlots && styles.dayTextOpen,
                                    isSelected && styles.dayTextActive,
                                    !hasAvailableSlots && Boolean(day) && styles.dayTextDisabled,
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
                            ? `You already have an appointment request or confirmed schedule on ${formatSelectedDate(selectedDayAvailability.date)}. Only one appointment is allowed per day.`
                            : selectedDayAvailability.blockedByLeadTime
                              ? `That date stays unavailable because appointment requests need a 24-hour counselor review window.`
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

            {supportsStepFlow ? (
              <View style={styles.continueInlineWrap}>
                <Pressable style={[styles.continueButton, submitting && styles.continueButtonDisabled]} disabled={submitting} onPress={() => void handleContinue()}>
                  {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueButtonText}>{step === TOTAL_STEPS ? "Submit Request" : "Continue"}</Text>}
                </Pressable>
              </View>
            ) : null}
          </>
        )}
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
  welcomeHeroCard: {
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#F7F6EE",
    borderWidth: 1,
    borderColor: "#E1E8D9",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    marginBottom: 14,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  welcomeGlowOne: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#E7F4D1",
    top: -34,
    right: -22,
  },
  welcomeGlowTwo: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 999,
    backgroundColor: "#E8F1F5",
    bottom: -44,
    left: -34,
  },
  welcomeHeroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
  },
  welcomeHeroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#EEF7E5",
    borderWidth: 1,
    borderColor: "#DCEBCF",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeHeroCopy: {
    flex: 1,
  },
  welcomeEyebrow: {
    color: "#6A8558",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  welcomeTitle: {
    color: "#304558",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    marginBottom: 6,
  },
  welcomeText: {
    color: "#5B6D7B",
    fontSize: 14,
    lineHeight: 20,
  },
  welcomePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 10,
    marginTop: 14,
  },
  welcomePill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E9DA",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  welcomePillText: {
    color: "#4B6653",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
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
  introIconWrapBlue: {
    backgroundColor: "#EEF4F8",
    borderColor: "#D5E3EC",
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
  peerStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    borderRadius: 16,
    backgroundColor: "#F1F5F8",
    borderWidth: 1,
    borderColor: "#DCE6ED",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  peerStatusBannerText: {
    flex: 1,
    color: "#51697B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
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
  trackOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DFE8DD",
    backgroundColor: "#FCFDF9",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  trackOptionCardSoft: {
    backgroundColor: "#F9FBFD",
    borderColor: "#DEE8EF",
  },
  trackOptionIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "#EFF9E7",
    borderWidth: 1,
    borderColor: "#DCEBCF",
    alignItems: "center",
    justifyContent: "center",
  },
  trackOptionIconWrapBlue: {
    backgroundColor: "#EEF4F8",
    borderColor: "#D5E3EC",
  },
  trackOptionCopy: {
    flex: 1,
  },
  trackOptionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
    rowGap: 6,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  trackOptionTitle: {
    flexShrink: 1,
    color: "#31465A",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  trackOptionBody: {
    color: "#607180",
    fontSize: 13,
    lineHeight: 18,
  },
  trackStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  trackStatusPillActive: {
    backgroundColor: "#EFF8E7",
    borderColor: "#D7E9C8",
  },
  trackStatusPillBlue: {
    backgroundColor: "#EEF4F8",
    borderColor: "#D5E3EC",
  },
  trackStatusPillMuted: {
    backgroundColor: "#F5F7F9",
    borderColor: "#E2E8ED",
  },
  trackStatusText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  trackStatusTextActive: {
    color: "#44712F",
  },
  trackStatusTextBlue: {
    color: "#45657D",
  },
  trackStatusTextMuted: {
    color: "#768491",
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
  peerEmptyState: {
    alignItems: "center",
    paddingTop: 8,
  },
  peerEmptyIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "#EEF4F8",
    borderWidth: 1,
    borderColor: "#D9E5ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  peerEmptyTitle: {
    color: "#31465A",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  peerEmptyText: {
    color: "#617282",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 18,
  },
  peerPrimaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#6FBF44",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  peerPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  peerSecondaryButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D7E0E6",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  peerSecondaryButtonText: {
    color: "#526678",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
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
  relationshipDropdown: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDE5EA",
    backgroundColor: "#F9FBFC",
    padding: 8,
    rowGap: 8,
  },
  relationshipOption: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE7EC",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  relationshipOptionActive: {
    borderColor: "#78C74A",
    backgroundColor: "#F3FAEE",
  },
  relationshipOptionText: {
    color: "#33475C",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  relationshipOptionTextActive: {
    color: "#2E6F24",
    fontWeight: "700",
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
