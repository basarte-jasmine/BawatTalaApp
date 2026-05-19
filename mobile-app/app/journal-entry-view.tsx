import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchJournalEntryById, JournalEntry, JournalMessage, rateJournalEntrySummary } from "../lib/backend-api";
import { JournalLockGate } from "../lib/app-preferences";
import { useAuthSession } from "../lib/auth-session";

const MUNI_IMAGE = require("../assets/images/MUNI_default.png");
const NOTEBOOK_RINGS = Array.from({ length: 12 }, (_, index) => index);
const PAPER_RULES = Array.from({ length: 24 }, (_, index) => index);
const SUMMARY_FEEDBACK_REASON_WORD_LIMIT = 250;

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
    .flatMap((message) => splitParagraphs(message.text))
    .filter(Boolean);
}

function splitParagraphs(value: string | undefined) {
  return String(value || "")
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function formatSummaryText(summary: string | undefined, insights: string[]) {
  const parts = [summary, ...insights]
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return parts
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ");
}

function summarizeParagraphs(paragraphs: string[]) {
  const text = paragraphs
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  if (!text) return "";
  return text.length > 220 ? `${text.slice(0, 217).trim()}...` : text;
}

function getEntryFallbackParagraphs(entry: JournalEntry | null) {
  const contentText = splitParagraphs(entry?.contentText);
  if (contentText.length > 0) return contentText;

  const previewText = String(entry?.preview || "").replace(/\s+/g, " ").trim();
  if (previewText) {
    return [previewText];
  }

  const summaryText = splitParagraphs(entry?.summary);
  if (summaryText.length > 0) return summaryText;

  const titleText = String(entry?.title || "").replace(/\s+/g, " ").trim();
  if (titleText && titleText.toLowerCase() !== "journal entry") return [titleText];

  return [];
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export default function JournalEntryViewScreen() {
  const { user } = useAuthSession();
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const { width } = useWindowDimensions();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingEntry, setIsLoadingEntry] = useState(true);
  const [summaryFeedbackError, setSummaryFeedbackError] = useState("");
  const [summaryFeedbackReason, setSummaryFeedbackReason] = useState("");
  const [isNeedsWorkReasonVisible, setIsNeedsWorkReasonVisible] = useState(false);
  const [isSavingSummaryRating, setIsSavingSummaryRating] = useState(false);

  const loadEntry = useCallback(async () => {
    if (!user?.studentNumber || !entryId) {
      setEntry(null);
      setMessages([]);
      setIsLoadingEntry(false);
      setSummaryFeedbackError("");
      setSummaryFeedbackReason("");
      setIsNeedsWorkReasonVisible(false);
      return;
    }

    setIsLoadingEntry(true);
    const result = await fetchJournalEntryById(user.studentNumber, entryId);
    if (!result.ok) {
      setErrorMessage(result.message ?? "Unable to load this journal entry.");
      setEntry(null);
      setMessages([]);
      setIsLoadingEntry(false);
      setSummaryFeedbackError("");
      setSummaryFeedbackReason("");
      setIsNeedsWorkReasonVisible(false);
      return;
    }

    setErrorMessage("");
    setEntry(result.entry ?? null);
    setMessages(result.messages ?? []);
    setIsLoadingEntry(false);
    setSummaryFeedbackError("");
    setSummaryFeedbackReason("");
    setIsNeedsWorkReasonVisible(false);
  }, [entryId, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadEntry();
    }, [loadEntry]),
  );

  const visibleMessages = useMemo(
    () => messages.filter((message) => String(message.text || "").trim()),
    [messages],
  );
  const fallbackParagraphs = useMemo(() => getEntryFallbackParagraphs(entry), [entry]);
  const messageParagraphs = useMemo(() => getUserParagraphs(visibleMessages), [visibleMessages]);
  const paragraphs = messageParagraphs.length > 0 ? messageParagraphs : fallbackParagraphs;
  const displayMessages = useMemo<JournalMessage[]>(
    () =>
      visibleMessages.length > 0
        ? visibleMessages
        : fallbackParagraphs.map((paragraph, index) => ({
            createdAt: entry?.createdAt || "",
            id: `fallback-user-${index}`,
            role: "user",
            text: paragraph,
          })),
    [entry?.createdAt, fallbackParagraphs, visibleMessages],
  );
  const createdAt = messages.find((message) => message.role === "user")?.createdAt ?? entry?.createdAt;
  const storedSummaryText = useMemo(
    () => formatSummaryText(entry?.summary, entry?.insights ?? []),
    [entry?.insights, entry?.summary],
  );
  const aiSummaryText = useMemo(
    () => storedSummaryText || summarizeParagraphs(paragraphs),
    [paragraphs, storedSummaryText],
  );
  const usedChatbot = useMemo(
    () => Boolean(entry?.aiEnabled),
    [entry?.aiEnabled],
  );
  const sentimentText = useMemo(() => {
    if (!entry?.sentimentLabel) return "";
    const label = entry.sentimentLabel.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
    const emotion = entry.dominantEmotion ? ` \u2022 ${entry.dominantEmotion}` : "";
    const confidence =
      typeof entry.sentimentConfidence === "number" ? ` \u2022 ${Math.round(entry.sentimentConfidence * 100)}% confidence` : "";
    return `${label}${emotion}${confidence}`;
  }, [entry?.dominantEmotion, entry?.sentimentConfidence, entry?.sentimentLabel]);
  const hasGeneratedSummary = Boolean(aiSummaryText);
  const hasStoredSummary = Boolean(storedSummaryText);
  const summaryRating = entry?.summaryRating ?? null;
  const hasSavedSummaryRating = summaryRating === "HELPFUL" || summaryRating === "NEEDS_WORK";
  const entryTags = entry?.concernTags ?? [];
  const compact = width < 390;
  const narrow = width < 355;
  const ringTopStart = compact ? 14 : 16;
  const ringGap = compact ? 40 : 44;
  const ruleTopStart = compact ? 48 : 52;
  const ruleGap = compact ? 24 : 26;
  const summaryFeedbackReasonWordCount = countWords(summaryFeedbackReason);
  const isSummaryFeedbackReasonOverLimit = summaryFeedbackReasonWordCount > SUMMARY_FEEDBACK_REASON_WORD_LIMIT;

  const handleRateSummary = useCallback(async (rating: "HELPFUL" | "NEEDS_WORK", reason = "") => {
    if (!user?.studentNumber || !entry?.id || isSavingSummaryRating || hasSavedSummaryRating) {
      return;
    }
    const trimmedReason = reason.replace(/\s+/g, " ").trim();
    if (rating === "NEEDS_WORK" && !trimmedReason) {
      setSummaryFeedbackError("Tell us what Muni missed or got wrong.");
      setIsNeedsWorkReasonVisible(true);
      return;
    }
    if (countWords(trimmedReason) > SUMMARY_FEEDBACK_REASON_WORD_LIMIT) {
      setSummaryFeedbackError(`Keep your reason within ${SUMMARY_FEEDBACK_REASON_WORD_LIMIT} words.`);
      setIsNeedsWorkReasonVisible(true);
      return;
    }

    setIsSavingSummaryRating(true);
    setSummaryFeedbackError("");

    const result = await rateJournalEntrySummary({
      entryId: entry.id,
      rating,
      reason: rating === "NEEDS_WORK" ? trimmedReason : undefined,
      studentNumber: user.studentNumber,
    });

    if (!result.ok || !result.entry) {
      setSummaryFeedbackError(result.message ?? "Unable to save your summary feedback right now.");
      setIsSavingSummaryRating(false);
      return;
    }

    setEntry(result.entry);
    setSummaryFeedbackReason("");
    setIsNeedsWorkReasonVisible(false);
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

  const renderSummaryFeedback = hasStoredSummary ? (
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
          onPress={() => {
            setSummaryFeedbackError("");
            setIsNeedsWorkReasonVisible(true);
          }}
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

      {isNeedsWorkReasonVisible && !hasSavedSummaryRating ? (
        <View style={styles.summaryFeedbackReasonWrap}>
          <TextInput
            value={summaryFeedbackReason}
            onChangeText={(value) => {
              setSummaryFeedbackReason(value);
              if (summaryFeedbackError) setSummaryFeedbackError("");
            }}
            multiline
            maxLength={1800}
            placeholder="What did Muni miss, misunderstand, or phrase badly?"
            placeholderTextColor="#7A8A99"
            style={[
              styles.summaryFeedbackReasonInput,
              isSummaryFeedbackReasonOverLimit && styles.summaryFeedbackReasonInputError,
            ]}
            textAlignVertical="top"
          />
          <View style={styles.summaryFeedbackReasonFooter}>
            <Text
              style={[
                styles.summaryFeedbackReasonCount,
                isSummaryFeedbackReasonOverLimit && styles.summaryFeedbackReasonCountError,
              ]}
            >
              {summaryFeedbackReasonWordCount}/{SUMMARY_FEEDBACK_REASON_WORD_LIMIT} words
            </Text>
            <Pressable
              style={[
                styles.summaryFeedbackSubmitButton,
                (!summaryFeedbackReason.trim() || isSummaryFeedbackReasonOverLimit || isSavingSummaryRating) &&
                  styles.summaryFeedbackSubmitButtonDisabled,
              ]}
              disabled={!summaryFeedbackReason.trim() || isSummaryFeedbackReasonOverLimit || isSavingSummaryRating}
              onPress={() => void handleRateSummary("NEEDS_WORK", summaryFeedbackReason)}
            >
              <Text style={styles.summaryFeedbackSubmitButtonText}>Submit reason</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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

                  {isLoadingEntry ? (
                    <View style={[styles.notebookStateCard, compact && styles.notebookStateCardCompact]}>
                      <Ionicons name="book-outline" size={20} color="#4B8F33" />
                      <Text style={styles.notebookStateTitle}>Loading journal entry...</Text>
                    </View>
                  ) : displayMessages.length > 0 ? (
                    displayMessages.map((line) =>
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
                    )
                  ) : (
                    <View style={[styles.notebookStateCard, compact && styles.notebookStateCardCompact]}>
                      <Ionicons name="document-text-outline" size={20} color="#6E8D62" />
                      <Text style={styles.notebookStateTitle}>No saved conversation text found</Text>
                      <Text style={styles.notebookStateText}>
                        This entry may only have saved tags or summary data on this device.
                      </Text>
                    </View>
                  )}

                  {hasGeneratedSummary ? (
                    <View style={[styles.chatInsightBlock, compact && styles.notebookContentBlockCompact]}>
                      <Text style={styles.chatInsightHeading}>AI Summary</Text>
                      <Text style={styles.chatInsightText}>{aiSummaryText}</Text>
                      {sentimentText ? <Text style={styles.summarySentimentText}>Sentiment: {sentimentText}</Text> : null}
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

              {isLoadingEntry ? (
                <View style={styles.emptyContentCard}>
                  <Ionicons name="book-outline" size={20} color="#4B8F33" />
                  <Text style={styles.emptyContentTitle}>Loading journal entry...</Text>
                </View>
              ) : paragraphs.length > 0 ? (
                paragraphs.map((paragraph, index) => (
                  <Text key={`${index}-${paragraph.slice(0, 16)}`} style={styles.paragraphText}>
                    {paragraph}
                  </Text>
                ))
              ) : (
                <View style={styles.emptyContentCard}>
                  <Ionicons name="document-text-outline" size={20} color="#6E8D62" />
                  <Text style={styles.emptyContentTitle}>No saved journal content found</Text>
                  <Text style={styles.emptyContentText}>
                    This entry may only have saved tags or summary data on this device.
                  </Text>
                </View>
              )}

              {hasGeneratedSummary ? (
                <View style={styles.summaryWrap}>
                  <Text style={styles.summaryHeading}>AI Summary</Text>
                  <Text style={styles.summaryText}>{aiSummaryText}</Text>
                  {sentimentText ? <Text style={styles.summarySentimentText}>Sentiment: {sentimentText}</Text> : null}
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
  notebookStateCard: {
    marginLeft: 22,
    marginRight: 10,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE8D2",
    backgroundColor: "#F7FBF2",
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "center",
    rowGap: 6,
  },
  notebookStateCardCompact: {
    marginLeft: 16,
    marginRight: 6,
    paddingHorizontal: 12,
  },
  notebookStateTitle: {
    color: "#34475A",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  notebookStateText: {
    color: "#5D6C76",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  paragraphText: {
    color: "#31465A",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 18,
  },
  emptyContentCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE8D2",
    backgroundColor: "#F7FBF2",
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
    rowGap: 6,
  },
  emptyContentTitle: {
    color: "#34475A",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyContentText: {
    color: "#5D6C76",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
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
  summarySentimentText: {
    color: "#4B6D52",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 9,
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
  summaryFeedbackReasonWrap: {
    marginTop: 10,
    rowGap: 8,
  },
  summaryFeedbackReasonInput: {
    minHeight: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D5E0D0",
    backgroundColor: "#FCFEF9",
    color: "#31465A",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryFeedbackReasonInputError: {
    borderColor: "#D98B7C",
    backgroundColor: "#FFF7F3",
  },
  summaryFeedbackReasonFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
  },
  summaryFeedbackReasonCount: {
    color: "#6B7C88",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  summaryFeedbackReasonCountError: {
    color: "#B04444",
  },
  summaryFeedbackSubmitButton: {
    borderRadius: 999,
    backgroundColor: "#4B8F33",
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  summaryFeedbackSubmitButtonDisabled: {
    opacity: 0.48,
  },
  summaryFeedbackSubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
});


