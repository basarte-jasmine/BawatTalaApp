import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "./auth-session";

type ConsentFeature = "journal" | "mood";

type InformedConsentGateProps = PropsWithChildren<{
  feature: ConsentFeature;
}>;

type ConsentSection = {
  items: string[];
  title: string;
};

const CONSENT_STORAGE_PREFIX = "bawattala.informedConsent.v2.";

const CONSENT_COPY: Record<
  ConsentFeature,
  {
    body: string;
    icon: keyof typeof Ionicons.glyphMap;
    sections: ConsentSection[];
    subtitle: string;
    title: string;
  }
> = {
  journal: {
    body:
      "Before you write or view journal entries, please review how Bawat Tala handles journal information.",
    icon: "book-outline",
    sections: [
      {
        title: "What may be saved",
        items: [
          "Your journal messages, entry dates, selected emotion, concern tags, summaries, insights, and summary feedback.",
          "Safety-related signals such as risk level, support prompt response, and flag reason when the system detects possible distress.",
          "Offline copies on this device so you can keep writing without internet.",
        ],
      },
      {
        title: "How it may be used",
        items: [
          "To show your journal history, calendar, entry details, Muni summaries, reflections, and tags.",
          "To let Muni, an artificial intelligence companion, analyze entries for supportive replies, summaries, emotion patterns, and safety prompts.",
          "To sync your entries to your account when internet is available.",
        ],
      },
      {
        title: "Privacy and safety",
        items: [
          "Journal data is linked to your student account and may be processed by the app backend and configured AI services.",
          "Authorized school support/admin users may review journal summaries, risk flags, support responses, and related records for safety and support workflows.",
          "If a high-risk entry is deleted, it may be hidden from your view but retained for admin review.",
        ],
      },
      {
        title: "Important limits",
        items: [
          "Muni is artificial intelligence. It can be helpful for reflection, but it can be wrong and should not be relied on too much.",
          "Muni is not a psychometrician, therapist, counselor, diagnosis, clinical assessment, or emergency service.",
          "If you may hurt yourself or someone else, contact local emergency services, a trusted person, or a qualified mental health professional right away.",
        ],
      },
    ],
    subtitle: "For private reflections, Muni summaries, and support flags",
    title: "Journal Consent",
  },
  mood: {
    body:
      "Before you save emotions or view emotion history, please review how Bawat Tala handles mood information.",
    icon: "heart-outline",
    sections: [
      {
        title: "What may be saved",
        items: [
          "Your selected emotion, check-in date, time, and source, such as Mood Input or Journal.",
          "Monthly counts, daily records, most common emotions, and emotion history shown in the app.",
          "Offline copies on this device so emotion history still works without internet.",
        ],
      },
      {
        title: "How it may be used",
        items: [
          "To build your emotion calendar, daily check-in trail, monthly totals, and Muni AI reflections.",
          "To sync emotion check-ins to your account when internet is available.",
          "To support app dashboards, reports, and wellness insights connected to student support workflows.",
        ],
      },
      {
        title: "Privacy and limits",
        items: [
          "Emotion data is linked to your student account and may be processed by the app backend.",
          "Authorized school support/admin users may see related mood records, counts, or analytics for wellness monitoring and support.",
          "Muni is artificial intelligence, not a psychometrician or mental health professional. Emotion history is for self-awareness only and is not a diagnosis or clinical assessment.",
        ],
      },
    ],
    subtitle: "For check-ins, mood history, and wellness insights",
    title: "Emotion Consent",
  },
};

function getConsentStorageKey(studentNumber: string, feature: ConsentFeature) {
  return `${CONSENT_STORAGE_PREFIX}${studentNumber}.${feature}`;
}

export function InformedConsentGate({ children, feature }: InformedConsentGateProps) {
  const { isHydrated, user } = useAuthSession();
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const studentNumber = user?.studentNumber ?? "";
  const copy = CONSENT_COPY[feature];

  useEffect(() => {
    let mounted = true;

    const loadConsent = async () => {
      if (!isHydrated) return;
      if (!studentNumber) {
        if (mounted) {
          setHasAccepted(false);
          setIsChecking(false);
        }
        return;
      }

      setIsChecking(true);
      const storedValue = await AsyncStorage.getItem(getConsentStorageKey(studentNumber, feature));
      if (!mounted) return;
      setHasAccepted(storedValue === "accepted");
      setIsChecking(false);
    };

    void loadConsent();

    return () => {
      mounted = false;
    };
  }, [feature, isHydrated, studentNumber]);

  const handleAccept = useCallback(async () => {
    if (!studentNumber || isSaving) return;
    setIsSaving(true);
    await AsyncStorage.setItem(getConsentStorageKey(studentNumber, feature), "accepted");
    setHasAccepted(true);
    setIsSaving(false);
  }, [feature, isSaving, studentNumber]);

  const handleLeave = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  }, []);

  const content = useMemo(
    () => (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <Ionicons name={copy.icon} size={25} color="#2F7A25" />
          </View>

          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>INFORMED CONSENT</Text>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.detailsScroll}
          contentContainerStyle={styles.detailsContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.body}>{copy.body}</Text>

          <View style={styles.sectionStack}>
            {copy.sections.map((section, sectionIndex) => (
              <View key={section.title} style={styles.noticePanel}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionNumber}>
                    <Text style={styles.sectionNumberText}>{sectionIndex + 1}</Text>
                  </View>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>

                {section.items.map((item) => (
                  <View key={item} style={styles.noticeRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#67B73A" style={styles.noticeIcon} />
                    <Text style={styles.noticeText}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          <Text style={styles.confirmationText}>
            By tapping Agree, you confirm that you understand this notice and allow Bawat Tala to save, process, sync, and use this information for the purposes described above.
          </Text>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={handleLeave} disabled={isSaving}>
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>

          <Pressable style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]} onPress={handleAccept} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryText}>Agree</Text>
            )}
          </Pressable>
        </View>
      </View>
    ),
    [copy.body, copy.icon, copy.sections, copy.subtitle, copy.title, handleAccept, handleLeave, isSaving],
  );

  if (isChecking) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#72C843" />
      </View>
    );
  }

  if (hasAccepted) {
    return <>{children}</>;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.screenContent}>
        {content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6FAF3",
    overflow: "hidden",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6FAF3",
  },
  glowTop: {
    position: "absolute",
    top: -68,
    left: -54,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: "#DCF2CB",
    opacity: 0.88,
  },
  glowBottom: {
    position: "absolute",
    right: -58,
    bottom: 14,
    width: 218,
    height: 218,
    borderRadius: 999,
    backgroundColor: "#E6F1FF",
    opacity: 0.82,
  },
  screenContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 124,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFEBD7",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 15,
    maxHeight: "100%",
    shadowColor: "#43505C",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#F1FBEA",
    borderWidth: 1,
    borderColor: "#D8EDCC",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  eyebrow: {
    color: "#74896A",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontWeight: "800",
    marginBottom: 5,
  },
  title: {
    color: "#30465B",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    marginBottom: 2,
  },
  subtitle: {
    color: "#627383",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  body: {
    color: "#4F5F6F",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  detailsScroll: {
    flexShrink: 1,
  },
  detailsContent: {
    paddingBottom: 2,
  },
  sectionStack: {
    rowGap: 8,
    marginBottom: 11,
  },
  noticePanel: {
    borderRadius: 16,
    backgroundColor: "#F7FBF3",
    borderWidth: 1,
    borderColor: "#E0ECD7",
    paddingHorizontal: 11,
    paddingVertical: 10,
    rowGap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 1,
  },
  sectionNumber: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#E7F6DC",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionNumberText: {
    color: "#3D852D",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
  },
  sectionTitle: {
    color: "#30465B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  noticeRow: {
    flexDirection: "row",
    columnGap: 8,
    alignItems: "flex-start",
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    color: "#344B5F",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  confirmationText: {
    color: "#687887",
    fontSize: 11,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    columnGap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E1D0",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#536474",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#73CB47",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5F8F41",
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  primaryButtonDisabled: {
    backgroundColor: "#A8C99C",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
});
