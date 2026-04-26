import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchJournalEntryById, JournalEntry, JournalMessage, rateJournalEntrySummary } from "../lib/backend-api";
import { JournalLockGate } from "../lib/app-preferences";
import { useAuthSession } from "../lib/auth-session";

const MUNI_IMAGE = require("../assets/images/MUNI_default.png");
const NOTEBOOK_RINGS = Array.from({ length: 12 }, (_, index) => index);
const PAPER_RULES = Array.from({ length: 24 }, (_, index) => index);

function formatEntryHeader(entry: JournalEntry | null, createdAt?: string) {
  if (!entry) return "Journal Entry";
  const date = new Date(createdAt || entry.createdAt);
  const timeLabel = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
  return timeLabel ? `\uD83D\uDCD6 ${timeLabel}` : "\uD83D\uDCD6 Journal Entry";
}

function getUserParagraphs(messages: JournalMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.text.trim())
    .filter(Boolean);
}

function hasAssistantMessages(messages: JournalMessage[]) {
  return messages.some((message) => message.role === "assistant");
}

function formatInsightsText(insights: string[]) {
  return insights
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");
}

export default function JournalEntryViewScreen() {
  const { user } = useAuthSession();
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const { width } = useWindowDimensions();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [summaryFeedbackError, setSummaryFeedbackError] = useState("");
  const [isSavingSummaryRating, setIsSavingSummaryRating] = useState(false);

  const loadEntry = useCallback(async () => {
    if (!user?.studentNumber || !entryId) {
      setEntry(null);
      setMessages([]);
      setSummaryFeedbackError("");
      return;
    }

    const result = await fetchJournalEntryById(user.studentNumber, entryId);
    if (!result.ok) {
      setErrorMessage(result.message ?? "Unable to load this journal entry.");
      setEntry(null);
      setMessages([]);
      setSummaryFeedbackError("");
      return;
    }

    setErrorMessage("");
    setEntry(result.entry ?? null);
    setMessages(result.messages ?? []);
    setSummaryFeedbackError("");
  }, [entryId, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadEntry();
    }, [loadEntry]),
  );

  const paragraphs = useMemo(() => getUserParagraphs(messages), [messages]);
  const createdAt = messages.find((message) => message.role === "user")?.createdAt ?? entry?.createdAt;
  const usedChatbot = useMemo(
    () => Boolean(entry?.aiEnabled) && hasAssistantMessages(messages),
    [entry?.aiEnabled, messages],
  );
  const combinedInsights = useMemo(
    () => formatInsightsText(entry?.insights ?? []),
    [entry?.insights],
  );
  const aiSummaryText = useMemo(
    () => [entry?.summary, combinedInsights].map((item) => String(item || "").trim()).filter(Boolean).join(" "),
    [combinedInsights, entry?.summary],
  );
  const hasGeneratedSummary = Boolean(aiSummaryText);
  const summaryRating = entry?.summaryRating ?? null;
  const hasSavedSummaryRating = summaryRating === "HELPFUL" || summaryRating === "NEEDS_WORK";
  const entryTags = entry?.concernTags ?? [];
  const compact = width < 390;
  const narrow = width < 355;
  const ringTopStart = compact ? 14 : 16;
  const ringGap = compact ? 40 : 44;
  const ruleTopStart = compact ? 48 : 52;
  const ruleGap = compact ? 24 : 26;

  const handleRateSummary = useCallback(async (rating: "HELPFUL" | "NEEDS_WORK") => {
    if (!user?.studentNumber || !entry?.id || isSavingSummaryRating || hasSavedSummaryRating) {
      return;
    }

    setIsSavingSummaryRating(true);
    setSummaryFeedbackError("");

    const result = await rateJournalEntrySummary({
      entryId: entry.id,
      rating,
      studentNumber: user.studentNumber,
    });

    if (!result.ok || !result.entry) {
      setSummaryFeedbackError(result.message ?? "Unable to save your summary feedback right now.");
      setIsSavingSummaryRating(false);
      return;
    }

    setEntry(result.entry);
    setIsSavingSummaryRating(false);
  }, [entry?.id, hasSavedSummaryRating, isSavingSummaryRating, user?.studentNumber]);

  const summaryFeedbackMessage = summaryFeedbackError
    ? summaryFeedbackError
    : isSavingSummaryRating
      ? "Saving your feedback..."
      : summaryRating === "HELPFUL"
        ? "Thanks. You marked this summary as helpful."
        : summaryRating === "NEEDS_WORK"
          ? "Thanks. You marked this summary as needing work."
          : "Your feedback helps Muni improve future summaries.";

  const renderSummaryFeedback = hasGeneratedSummary ? (
    <View style={styles.summaryFeedbackWrap}>
      <Text style={styles.summaryFeedbackPrompt}>Did Muni get this summary right?</Text>

      <View style={styles.summaryFeedbackRow}>
        <Pressable
          style={[
            styles.summaryFeedbackButton,
            summaryRating === "HELPFUL" && styles.summaryFeedbackButtonHelpful,
            hasSavedSummaryRating && summaryRating !== "HELPFUL" && styles.summaryFeedbackButtonLocked,
          ]}
          disabled={isSavingSummaryRating || hasSavedSummaryRating}
          onPress={() => void handleRateSummary("HELPFUL")}
        >
          <Ionicons
            name={summaryRating === "HELPFUL" ? "thumbs-up" : "thumbs-up-outline"}
            size={16}
            color={summaryRating === "HELPFUL" ? "#2F7A25" : "#4D6476"}
          />
          <Text
            style={[
              styles.summaryFeedbackButtonText,
              summaryRating === "HELPFUL" && styles.summaryFeedbackButtonTextHelpful,
            ]}
          >
            Helpful
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.summaryFeedbackButton,
            summaryRating === "NEEDS_WORK" && styles.summaryFeedbackButtonNeedsWork,
            hasSavedSummaryRating && summaryRating !== "NEEDS_WORK" && styles.summaryFeedbackButtonLocked,
          ]}
          disabled={isSavingSummaryRating || hasSavedSummaryRating}
          onPress={() => void handleRateSummary("NEEDS_WORK")}
        >
          <Ionicons
            name={summaryRating === "NEEDS_WORK" ? "thumbs-down" : "thumbs-down-outline"}
            size={16}
            color={summaryRating === "NEEDS_WORK" ? "#A24B38" : "#4D6476"}
          />
          <Text
            style={[
              styles.summaryFeedbackButtonText,
              summaryRating === "NEEDS_WORK" && styles.summaryFeedbackButtonTextNeedsWork,
            ]}
          >
            Needs work
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.summaryFeedbackNote, summaryFeedbackError && styles.summaryFeedbackNoteError]}>
        {summaryFeedbackMessage}
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBarBackButton} onPress={() => router.replace("/journal-calendar")}>
          <Ionicons name="chevron-back" size={28} color="#39434F" />
        </Pressable>
        <Text style={styles.topBarTitle}>Journal Entry</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <JournalLockGate>
        <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>READ ONLY</Text>
            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>{formatEntryHeader(entry, createdAt)}</Text>
          </View>

          <View
            style={[
              styles.heroStatusPill,
              usedChatbot && styles.heroStatusPillActive,
              compact && styles.heroStatusPillCompact,
            ]}
          >
            <Ionicons
              name={usedChatbot ? "sparkles" : "document-text-outline"}
              size={14}
              color={usedChatbot ? "#2E6B23" : "#5D6E7C"}
            />
            <Text style={[styles.heroStatusText, usedChatbot && styles.heroStatusTextActive]}>
              {usedChatbot ? "With Muni" : "Manual Entry"}
            </Text>
          </View>

          <View style={[styles.metaBlock, compact && styles.metaBlockCompact]}>
            <Text style={styles.metaLabel}>Tags</Text>
            <View style={[styles.tagRow, compact && styles.tagRowCompact]}>
              {entryTags.length ? (
                entryTags.map((tag) => (
                  <View key={tag} style={[styles.tagPill, narrow && styles.tagPillCompact]}>
                    <Text style={[styles.tagPillText, narrow && styles.tagPillTextCompact]}>{tag}</Text>
                  </View>
                ))
              ) : (
                <View style={[styles.tagPillMuted, narrow && styles.tagPillCompact]}>
                  <Text style={[styles.tagPillMutedText, narrow && styles.tagPillTextCompact]}>No tags saved</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {usedChatbot ? (
          <View style={[styles.pageWrap, compact && styles.pageWrapCompact]}>
            <View style={[styles.notebookShell, compact && styles.notebookShellCompact]}>
              <View style={[styles.spineColumn, compact && styles.spineColumnCompact]}>
                {NOTEBOOK_RINGS.map((ring) => (
                  <View key={`ring-${ring}`} style={[styles.ringItem, compact && styles.ringItemCompact, { top: ringTopStart + ring * ringGap }]}>
                    <View style={styles.ringHole} />
                    <View style={styles.ringArc} />
                  </View>
                ))}
              </View>

              <View style={[styles.paperCard, compact && styles.paperCardCompact]}>
                <View style={styles.ruleLayer} pointerEvents="none">
                  {PAPER_RULES.map((line) => (
                    <View key={`rule-${line}`} style={[styles.ruleLine, { top: ruleTopStart + line * ruleGap }]} />
                  ))}
                </View>

                <View style={[styles.marginLine, compact && styles.marginLineCompact]} />

                <ScrollView
                  style={styles.conversationScroll}
                  contentContainerStyle={[styles.conversationContent, compact && styles.conversationContentCompact]}
                  showsVerticalScrollIndicator={false}
                >
                  {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                  {messages.map((line) =>
                    line.role === "assistant" ? (
                      <View key={line.id} style={[styles.leftMessageRow, compact && styles.leftMessageRowCompact]}>
                        <Text style={styles.messageRoleLabel}>Muni</Text>
                        <Text style={styles.leftMessageText}>{line.text}</Text>
                      </View>
                    ) : (
                      <View key={line.id} style={[styles.rightMessageRow, compact && styles.rightMessageRowCompact]}>
                        <Text style={[styles.messageRoleLabel, styles.messageRoleLabelSelf]}>You</Text>
                        <Text style={styles.rightMessageText}>{line.text}</Text>
                      </View>
                    ),
                  )}

                  {hasGeneratedSummary ? (
                    <View style={[styles.chatInsightBlock, compact && styles.notebookContentBlockCompact]}>
                      <Text style={styles.chatInsightHeading}>AI Summary</Text>
                      <Text style={styles.chatInsightText}>{aiSummaryText}</Text>
                      {renderSummaryFeedback}
                    </View>
                  ) : null}
                </ScrollView>

                <View style={[styles.footnoteWrap, compact && styles.footnoteWrapCompact]}>
                  <Text style={styles.footnoteText}>
                    Read-only journal view. This entry was created with Muni and can no longer be edited.
                  </Text>

                  <View style={styles.muniBadge}>
                    <Image source={MUNI_IMAGE} style={styles.muniBadgeImage} resizeMode="contain" />
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.card, compact && styles.cardCompact]}>
            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              {paragraphs.length > 0 ? (
                paragraphs.map((paragraph, index) => (
                  <Text key={`${index}-${paragraph.slice(0, 16)}`} style={styles.paragraphText}>
                    {paragraph}
                  </Text>
                ))
              ) : (
                <Text style={styles.paragraphText}>No saved journal content found for this entry.</Text>
              )}

              {hasGeneratedSummary ? (
                <View style={styles.summaryWrap}>
                  <Text style={styles.summaryHeading}>AI Summary</Text>
                  <Text style={styles.summaryText}>{aiSummaryText}</Text>
                  {renderSummaryFeedback}
                </View>
              ) : null}
            </ScrollView>
          </View>
        )}
      </JournalLockGate>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F9F2",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 18,
  },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#D0D4D6",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginHorizontal: -12,
    marginBottom: 10,
    shadowColor: "#5C6570",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  topBarBackButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    color: "#2F4155",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  heroCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAD9",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: "#5C6570",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heroCardCompact: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  heroCopy: {
    marginBottom: 10,
  },
  heroEyebrow: {
    color: "#7D8F78",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroTitle: {
    color: "#34475A",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    flexShrink: 1,
  },
  heroTitleCompact: {
    fontSize: 15.5,
    lineHeight: 21,
  },
  heroStatusPill: {
    alignSelf: "flex-start",
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "#F2F5F6",
    borderWidth: 1,
    borderColor: "#D7DEE3",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 10,
  },
  heroStatusPillCompact: {
    paddingHorizontal: 9,
  },
  heroStatusPillActive: {
    backgroundColor: "#EBF7E0",
    borderColor: "#D0E7BF",
  },
  heroStatusText: {
    color: "#5D6E7C",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  heroStatusTextActive: {
    color: "#2E6B23",
  },
  metaBlock: {
    marginTop: 12,
    rowGap: 6,
  },
  metaBlockCompact: {
    marginTop: 10,
    rowGap: 5,
  },
  metaLabel: {
    color: "#6E8174",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metaValue: {
    color: "#31465A",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    flexShrink: 1,
  },
  metaValueCompact: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "flex-start",
  },
  tagRowCompact: {
    gap: 6,
  },
  tagPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CFE4C2",
    backgroundColor: "#F0FAE8",
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  tagPillCompact: {
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  tagPillText: {
    color: "#2F6F28",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  tagPillTextCompact: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  tagPillMuted: {
    borderRadius: 999,
    backgroundColor: "#F1F4F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  tagPillMutedText: {
    color: "#687783",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  pageWrap: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#5C6570",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  pageWrapCompact: {
    borderRadius: 22,
  },
  notebookShell: {
    flex: 1,
    backgroundColor: "#78C654",
    borderRadius: 24,
    padding: 5,
    flexDirection: "row",
  },
  notebookShellCompact: {
    padding: 4,
  },
  spineColumn: {
    width: 30,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    backgroundColor: "#D7EEBE",
    position: "relative",
  },
  spineColumnCompact: {
    width: 24,
  },
  ringItem: {
    position: "absolute",
    left: 1,
    width: 32,
    height: 20,
    justifyContent: "center",
  },
  ringItemCompact: {
    width: 26,
  },
  ringHole: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#F7FAF5",
    marginLeft: 3,
  },
  ringArc: {
    position: "absolute",
    left: 8,
    width: 22,
    height: 16,
    borderWidth: 3,
    borderRightWidth: 0,
    borderColor: "#8E989F",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  paperCard: {
    flex: 1,
    backgroundColor: "#FFFDF7",
    borderRadius: 18,
    borderTopLeftRadius: 8,
    borderWidth: 1,
    borderColor: "#E6E9DD",
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 10,
    position: "relative",
  },
  paperCardCompact: {
    borderRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 9,
  },
  ruleLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 58,
  },
  ruleLine: {
    position: "absolute",
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: "#E2EEE0",
  },
  marginLine: {
    position: "absolute",
    top: 46,
    bottom: 58,
    left: 30,
    width: 1,
    backgroundColor: "#E7BFC2",
  },
  marginLineCompact: {
    left: 24,
  },
  conversationScroll: {
    flex: 1,
  },
  conversationContent: {
    paddingBottom: 16,
    paddingTop: 4,
    rowGap: 8,
  },
  conversationContentCompact: {
    paddingBottom: 12,
    rowGap: 7,
  },
  leftMessageRow: {
    maxWidth: "84%",
    alignSelf: "flex-start",
    marginLeft: 22,
    marginBottom: 4,
  },
  leftMessageRowCompact: {
    maxWidth: "88%",
    marginLeft: 16,
  },
  leftMessageText: {
    color: "#2D3B4D",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  messageRoleLabel: {
    color: "#6E8D62",
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
    fontWeight: "700",
    marginBottom: 3,
  },
  messageRoleLabelSelf: {
    color: "#7B8792",
    textAlign: "right",
  },
  rightMessageRow: {
    maxWidth: "78%",
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  rightMessageRowCompact: {
    maxWidth: "84%",
  },
  rightMessageText: {
    color: "#2D3B4D",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "right",
    fontWeight: "500",
  },
  chatInsightBlock: {
    marginTop: 14,
    marginLeft: 22,
    marginRight: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#F4F9EF",
    borderWidth: 1,
    borderColor: "#DEEBD3",
  },
  notebookContentBlockCompact: {
    marginLeft: 16,
    marginRight: 6,
    padding: 12,
  },
  chatInsightHeading: {
    color: "#34475A",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  chatInsightText: {
    color: "#31465A",
    fontSize: 14,
    lineHeight: 21,
  },
  entryContentBlock: {
    marginLeft: 22,
    marginRight: 10,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FCFEF8",
    borderWidth: 1,
    borderColor: "#E2EBD9",
  },
  entryContentText: {
    color: "#31465A",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  chatHistoryHeading: {
    marginLeft: 22,
    marginBottom: 6,
    color: "#34475A",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  chatHistoryHeadingCompact: {
    marginLeft: 16,
  },
  footnoteWrap: {
    minHeight: 38,
    justifyContent: "center",
    paddingRight: 42,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#EBEFE5",
    paddingTop: 8,
  },
  footnoteWrapCompact: {
    paddingRight: 36,
  },
  footnoteText: {
    color: "#5D6C76",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  muniBadge: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#4B8F33",
    backgroundColor: "#C2EDAA",
    alignItems: "center",
    justifyContent: "center",
  },
  muniBadgeImage: {
    width: 24,
    height: 24,
  },
  card: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#E6E9DD",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: "#5C6570",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardCompact: {
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingTop: 11,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 18,
  },
  errorText: {
    color: "#B04444",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  paragraphText: {
    color: "#31465A",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 18,
  },
  summaryWrap: {
    marginTop: 10,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderRadius: 18,
    backgroundColor: "#F4F9EF",
    borderWidth: 1,
    borderColor: "#DEEBD3",
  },
  summaryHeading: {
    color: "#34475A",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  summaryText: {
    color: "#31465A",
    fontSize: 14,
    lineHeight: 22,
  },
  summaryFeedbackWrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#DDE8D2",
  },
  summaryFeedbackPrompt: {
    color: "#395167",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  summaryFeedbackRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
  },
  summaryFeedbackButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D5E0D0",
    backgroundColor: "#FCFEF9",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  summaryFeedbackButtonHelpful: {
    borderColor: "#BBD9AE",
    backgroundColor: "#EAF8DE",
  },
  summaryFeedbackButtonNeedsWork: {
    borderColor: "#E9C5B8",
    backgroundColor: "#FFF0EA",
  },
  summaryFeedbackButtonLocked: {
    opacity: 0.52,
  },
  summaryFeedbackButtonText: {
    color: "#4D6476",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  summaryFeedbackButtonTextHelpful: {
    color: "#2F7A25",
  },
  summaryFeedbackButtonTextNeedsWork: {
    color: "#A24B38",
  },
  summaryFeedbackNote: {
    color: "#5E6F7B",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 9,
  },
  summaryFeedbackNoteError: {
    color: "#B04444",
  },
});


