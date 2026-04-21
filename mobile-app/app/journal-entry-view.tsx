import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchJournalEntryById, JournalEntry, JournalMessage } from "../lib/backend-api";
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
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const loadEntry = useCallback(async () => {
    if (!user?.studentNumber || !entryId) {
      setEntry(null);
      setMessages([]);
      return;
    }

    const result = await fetchJournalEntryById(user.studentNumber, entryId);
    if (!result.ok) {
      setErrorMessage(result.message ?? "Unable to load this journal entry.");
      setEntry(null);
      setMessages([]);
      return;
    }

    setErrorMessage("");
    setEntry(result.entry ?? null);
    setMessages(result.messages ?? []);
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

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBarBackButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#39434F" />
        </Pressable>
        <Text style={styles.topBarTitle}>Journal Entry</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <JournalLockGate>
        <View style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>READ ONLY</Text>
            <Text style={styles.heroTitle}>{formatEntryHeader(entry, createdAt)}</Text>
          </View>

          <View style={[styles.heroStatusPill, usedChatbot && styles.heroStatusPillActive]}>
            <Ionicons
              name={usedChatbot ? "sparkles" : "document-text-outline"}
              size={14}
              color={usedChatbot ? "#2E6B23" : "#5D6E7C"}
            />
            <Text style={[styles.heroStatusText, usedChatbot && styles.heroStatusTextActive]}>
              {usedChatbot ? "With Muni" : "Manual Entry"}
            </Text>
          </View>
        </View>

        {usedChatbot ? (
          <View style={styles.pageWrap}>
            <View style={styles.notebookShell}>
              <View style={styles.spineColumn}>
                {NOTEBOOK_RINGS.map((ring) => (
                  <View key={`ring-${ring}`} style={[styles.ringItem, { top: 16 + ring * 44 }]}>
                    <View style={styles.ringHole} />
                    <View style={styles.ringArc} />
                  </View>
                ))}
              </View>

              <View style={styles.paperCard}>
                <View style={styles.ruleLayer} pointerEvents="none">
                  {PAPER_RULES.map((line) => (
                    <View key={`rule-${line}`} style={[styles.ruleLine, { top: 52 + line * 26 }]} />
                  ))}
                </View>

                <View style={styles.marginLine} />

                <ScrollView
                  style={styles.conversationScroll}
                  contentContainerStyle={styles.conversationContent}
                  showsVerticalScrollIndicator={false}
                >
                  {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                  {messages.map((line) =>
                    line.role === "assistant" ? (
                      <View key={line.id} style={styles.leftMessageRow}>
                        <Text style={styles.messageRoleLabel}>Muni</Text>
                        <Text style={styles.leftMessageText}>{line.text}</Text>
                      </View>
                    ) : (
                      <View key={line.id} style={styles.rightMessageRow}>
                        <Text style={[styles.messageRoleLabel, styles.messageRoleLabelSelf]}>You</Text>
                        <Text style={styles.rightMessageText}>{line.text}</Text>
                      </View>
                    ),
                  )}

                  {entry?.insights?.length ? (
                    <View style={styles.chatInsightBlock}>
                      <Text style={styles.chatInsightHeading}>Insights</Text>
                      <Text style={styles.chatInsightText}>{combinedInsights}</Text>
                    </View>
                  ) : null}
                </ScrollView>

                <View style={styles.footnoteWrap}>
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
          <View style={styles.card}>
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

              {entry?.insights?.length ? (
                <View style={styles.summaryWrap}>
                  <Text style={styles.summaryHeading}>Insights</Text>
                  <Text style={styles.summaryText}>{combinedInsights}</Text>
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
  notebookShell: {
    flex: 1,
    backgroundColor: "#78C654",
    borderRadius: 24,
    padding: 5,
    flexDirection: "row",
  },
  spineColumn: {
    width: 30,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    backgroundColor: "#D7EEBE",
    position: "relative",
  },
  ringItem: {
    position: "absolute",
    left: 1,
    width: 32,
    height: 20,
    justifyContent: "center",
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
  conversationScroll: {
    flex: 1,
  },
  conversationContent: {
    paddingBottom: 16,
    paddingTop: 4,
    rowGap: 8,
  },
  leftMessageRow: {
    maxWidth: "84%",
    alignSelf: "flex-start",
    marginLeft: 22,
    marginBottom: 4,
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
  footnoteWrap: {
    minHeight: 38,
    justifyContent: "center",
    paddingRight: 42,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#EBEFE5",
    paddingTop: 8,
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
});


