import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { JournalLockGate } from "../lib/app-preferences";
import { useAuthSession } from "../lib/auth-session";
import {
  createJournalSession,
  discardEmptyJournalEntry,
  discardJournalEntry,
  fetchTodayJournalSession,
  finishJournalEntry,
  JournalEntry,
  JournalMessage,
  saveJournalConcerns,
  saveJournalSupportResponse,
  sendJournalMessage,
} from "../lib/backend-api";
import { getManilaTodayParts } from "../lib/manila-date";

const NOTEBOOK_RINGS = Array.from({ length: 12 }, (_, index) => index);
const PAPER_RULES = Array.from({ length: 24 }, (_, index) => index);
const CONCERN_OPTIONS = [
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
const AI_RETRY_LOCK_MS = 12000;

function formatJournalHeaderDate(entryDate?: string) {
  const safeDate =
    typeof entryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entryDate)
      ? entryDate
      : getManilaTodayParts().isoDate;
  const parts = safeDate.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) {
    return `TODAY, ${safeDate}`;
  }
  const monthName = date
    .toLocaleString("en-US", { month: "short" })
    .toUpperCase();
  const weekday = date
    .toLocaleString("en-US", { weekday: "short" })
    .toUpperCase();
  return `TODAY, ${monthName} ${String(day).padStart(2, "0")} ${year} ${weekday}`;
}

function getIntroMessages(
  firstName: string,
  aiEnabled: boolean,
): JournalMessage[] {
  if (!aiEnabled) return [];
  return [
    {
      createdAt: "",
      id: "intro",
      role: "assistant",
      text: `Hello, ${firstName || "friend"}!\nWhat happened today, and what part of it is still sitting with you?`,
    },
  ];
}

export default function WriteEntryScreen() {
  const { user } = useAuthSession();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isAiRetryLocked, setIsAiRetryLocked] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showConcernModal, setShowConcernModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [selectedConcern, setSelectedConcern] = useState<string | null>(null);
  const [isSavingConcern, setIsSavingConcern] = useState(false);

  const loadJournalSession = useCallback(async () => {
    if (!user?.studentNumber) {
      setMessages([]);
      setEntry(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("");

    if (mode === "new") {
      const createResult = await createJournalSession({
        aiEnabled: true,
        forceNew: true,
        studentNumber: user.studentNumber,
      });

      if (!createResult.ok) {
        setErrorMessage(
          createResult.message ?? "Unable to open a new journal entry.",
        );
        setMessages([]);
        setEntry(null);
        setAiEnabled(true);
        setIsLoading(false);
        return;
      }

      setEntry(createResult.entry ?? null);
      setMessages(createResult.messages ?? []);
      setAiEnabled(createResult.entry?.aiEnabled ?? true);
      setIsLoading(false);
      return;
    }

    const result = await fetchTodayJournalSession(user.studentNumber);

    if (!result.ok) {
      setErrorMessage(
        result.message ?? "Unable to load your journal right now.",
      );
      setMessages([]);
      setEntry(null);
      setAiEnabled(true);
      setIsLoading(false);
      return;
    }

    setEntry(result.entry ?? null);
    setMessages(result.messages ?? []);
    setAiEnabled(result.entry?.aiEnabled ?? true);
    setIsLoading(false);
  }, [mode, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadJournalSession();
    }, [loadJournalSession]),
  );

  useEffect(() => {
    setSelectedConcern(entry?.primaryConcern ?? null);
  }, [entry?.primaryConcern]);

  useEffect(() => {
    if (!isAiRetryLocked) return undefined;

    const timer = setTimeout(() => {
      setIsAiRetryLocked(false);
    }, AI_RETRY_LOCK_MS);

    return () => clearTimeout(timer);
  }, [isAiRetryLocked]);

  const visibleMessages = useMemo(() => {
    if (messages.length > 0) return messages;
    return getIntroMessages(user?.firstName || "friend", aiEnabled);
  }, [aiEnabled, messages, user?.firstName]);
  const userParagraphs = useMemo(
    () =>
      messages
        .filter((item) => item.role === "user")
        .map((item) => item.text.trim())
        .filter(Boolean),
    [messages],
  );
  const hasTypedContent = useMemo(
    () => userParagraphs.length > 0 || Boolean(inputValue.trim()),
    [inputValue, userParagraphs.length],
  );

  const navigateAway = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/journal");
  };

  const handleRequestExit = () => {
    if (isDiscarding || isFinishing || isSending) return;
    setShowExitModal(true);
  };

  const handleConfirmExit = async () => {
    if (isDiscarding) return;

    setIsDiscarding(true);
    setErrorMessage("");
    setStatusMessage("");

    if (user?.studentNumber && entry?.id && !entry.isFinished) {
      const hasSavedUserMessages = messages.some(
        (item) => item.role === "user" && item.text.trim(),
      );
      const result = hasSavedUserMessages
        ? await discardJournalEntry({
            entryId: entry.id,
            studentNumber: user.studentNumber,
          })
        : await discardEmptyJournalEntry({
            entryId: entry.id,
            studentNumber: user.studentNumber,
          });

      if (!result.ok) {
        setIsDiscarding(false);
        setErrorMessage(
          result.message ?? "Unable to discard this journal entry.",
        );
        return;
      }
    }

    setShowExitModal(false);
    setIsDiscarding(false);
    setInputValue("");
    setMessages([]);
    setEntry(null);
    navigateAway();
  };

  const handleSendMessage = async () => {
    if (!user?.studentNumber || isSending) return;

    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage) return;

    setIsSending(true);
    setErrorMessage("");
    setStatusMessage("");

    const result = await sendJournalMessage({
      aiEnabled,
      entryId: entry?.id,
      message: trimmedMessage,
      studentNumber: user.studentNumber,
    });

    setIsSending(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Unable to save your journal entry.");
      return;
    }

    setInputValue("");
    setEntry(result.entry ?? null);
    setMessages(result.messages ?? []);
    setStatusMessage(result.aiReply ? "" : result.message ?? "");
    setIsAiRetryLocked(
      !result.aiReply &&
        result.message === "Muni is temporarily unavailable. Please try again in a bit.",
    );
    if (result.entry?.riskLevel === "HIGH") {
      setShowRiskModal(true);
    }
  };

  const handleCreateOrOpenEntry = async () => {
    if (!user?.studentNumber || isLoading) return;

    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("");
    const result = await createJournalSession({
      aiEnabled,
      forceNew: true,
      studentNumber: user.studentNumber,
    });

    if (!result.ok) {
      setErrorMessage(result.message ?? "Unable to open a new journal entry.");
      setIsLoading(false);
      return;
    }

    setEntry(result.entry ?? null);
    setMessages(result.messages ?? []);
    setAiEnabled(result.entry?.aiEnabled ?? aiEnabled);
    setIsLoading(false);
  };

  const handleSelectConcern = async (concern: string) => {
    if (
      !user?.studentNumber ||
      !entry?.id ||
      isSavingConcern ||
      isEntryFinished
    ) {
      return;
    }

    setSelectedConcern(concern);
    setIsSavingConcern(true);
    const result = await saveJournalConcerns({
      concernTags: [concern],
      entryId: entry.id,
      primaryConcern: concern,
      studentNumber: user.studentNumber,
    });
    setIsSavingConcern(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Unable to save the selected concern.");
      return;
    }

    setEntry(result.entry ?? entry);
  };

  const handleFinishEntry = async () => {
    if (!user?.studentNumber || !entry?.id || isFinishing) {
      router.replace("/journal-entries");
      return;
    }
    if (!selectedConcern) {
      setErrorMessage(
        "Select a concern tag before finishing your journal entry.",
      );
      setShowConcernModal(true);
      return;
    }
    if (!hasTypedContent) {
      setErrorMessage(
        "Write something first before finishing your journal entry.",
      );
      return;
    }

    setIsFinishing(true);
    setErrorMessage("");
    setStatusMessage("");
    const result = await finishJournalEntry({
      entryId: entry.id,
      studentNumber: user.studentNumber,
    });
    setIsFinishing(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Unable to finish this journal entry.");
      return;
    }

    setEntry(result.entry ?? null);
    if (result.entry?.riskLevel === "HIGH") {
      setShowRiskModal(true);
      return;
    }
    router.replace("/journal-entries");
  };

  const handleRequestFinish = () => {
    if (isEntryFinished) {
      setErrorMessage("This journal entry is already finished and can no longer be edited.");
      return;
    }
    if (!entry?.id) {
      setErrorMessage("Start a journal entry first.");
      return;
    }
    if (!hasTypedContent) {
      setErrorMessage("Write something first before finishing your journal entry.");
      return;
    }
    if (!selectedConcern) {
      setErrorMessage("Select a concern tag before finishing your journal entry.");
      setShowConcernModal(true);
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setShowFinishModal(true);
  };

  const isEntryFinished = Boolean(entry?.isFinished);
  const canWrite = !isEntryFinished;
  const finishValidationMessage = !entry?.id
    ? "Start a journal entry first."
    : !hasTypedContent
      ? "Write something first before finishing."
      : !selectedConcern
        ? "Select a concern tag before finishing."
        : "";
  const canFinishEntry = !isEntryFinished && !isFinishing && !isSending && !isSavingConcern && !finishValidationMessage;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <JournalLockGate>
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        {aiEnabled ? (
          <View style={styles.pageWrap}>
            <View style={styles.notebookShell}>
              <View style={styles.spineColumn}>
                {NOTEBOOK_RINGS.map((ring) => (
                  <View
                    key={`ring-${ring}`}
                    style={[styles.ringItem, { top: 16 + ring * 44 }]}
                  >
                    <View style={styles.ringHole} />
                    <View style={styles.ringArc} />
                  </View>
                ))}
              </View>

              <View style={styles.paperCard}>
                <View style={styles.ruleLayer} pointerEvents="none">
                  {PAPER_RULES.map((line) => (
                    <View
                      key={`rule-${line}`}
                      style={[styles.ruleLine, { top: 52 + line * 26 }]}
                    />
                  ))}
                </View>

                <View style={styles.marginLine} />

                <View style={styles.paperHeaderRow}>
                  <Text style={styles.dateText}>
                    {formatJournalHeaderDate(entry?.entryDate)}
                  </Text>

                  <Pressable
                    style={[
                      styles.muniToggle,
                      aiEnabled ? styles.muniToggleOn : styles.muniToggleOff,
                      isEntryFinished && styles.muniToggleDisabled,
                    ]}
                    onPress={() => {
                      if (isEntryFinished) return;
                      setAiEnabled(false);
                    }}
                    disabled={isEntryFinished}
                    accessibilityLabel="Turn off Muni AI"
                  >
                    <View
                      style={[
                        styles.muniToggleIconBubble,
                        aiEnabled
                          ? styles.muniToggleIconBubbleOn
                          : styles.muniToggleIconBubbleOff,
                      ]}
                    >
                      <Ionicons
                        name="sparkles"
                        size={12}
                        color="#2E6B23"
                      />
                    </View>
                    <Text style={styles.muniToggleText}>Muni On</Text>
                  </Pressable>
                </View>

                {entry?.summary ? (
                  <Text style={styles.summaryText}>{entry.summary}</Text>
                ) : null}

                <ScrollView
                  style={styles.conversationScroll}
                  contentContainerStyle={styles.conversationContent}
                  showsVerticalScrollIndicator={false}
                >
                  {isLoading ? (
                    <View style={styles.loadingWrap}>
                      <ActivityIndicator color="#5AA63D" size="small" />
                      <Text style={styles.loadingText}>
                        Loading your journal...
                      </Text>
                    </View>
                  ) : visibleMessages.length > 0 ? (
                    visibleMessages.map((line) =>
                      line.role === "assistant" ? (
                        <View key={line.id} style={styles.leftMessageRow}>
                          <Text style={styles.messageRoleLabel}>Muni</Text>
                          <Text style={styles.leftMessageText}>
                            {line.text}
                          </Text>
                        </View>
                      ) : (
                        <View key={line.id} style={styles.rightMessageRow}>
                          <Text style={[styles.messageRoleLabel, styles.messageRoleLabelSelf]}>
                            You
                          </Text>
                          <Text style={styles.rightMessageText}>
                            {line.text}
                          </Text>
                        </View>
                      ),
                    )
                  ) : (
                    <Text style={styles.emptyText}>
                      Start writing about how your day went.
                    </Text>
                  )}
                </ScrollView>

                <View style={styles.footnoteWrap}>
                  <Text style={styles.footnoteText}>
                    Muni is on. Replies stay brief, specific, and focused on
                    reflection inside Bawat Tala.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.plainCard}>
            <View style={styles.plainHeaderRow}>
              <Text style={styles.plainDateText}>{formatJournalHeaderDate(entry?.entryDate)}</Text>

              <Pressable
                style={[
                  styles.muniToggle,
                  styles.muniToggleOff,
                  isEntryFinished && styles.muniToggleDisabled,
                ]}
                onPress={() => {
                  if (isEntryFinished) return;
                  setAiEnabled(true);
                }}
                disabled={isEntryFinished}
                accessibilityLabel="Turn on Muni AI"
              >
                <View
                  style={[
                    styles.muniToggleIconBubble,
                    styles.muniToggleIconBubbleOff,
                  ]}
                >
                  <Ionicons name="moon-outline" size={12} color="#687787" />
                </View>
                <Text style={styles.muniToggleTextOff}>Muni Off</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.plainBody}
              contentContainerStyle={styles.plainBodyContent}
              showsVerticalScrollIndicator={false}
            >
              {isLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color="#5AA63D" size="small" />
                  <Text style={styles.loadingText}>
                    Loading your journal...
                  </Text>
                </View>
              ) : userParagraphs.length > 0 ? (
                userParagraphs.map((paragraph, index) => (
                  <Text
                    key={`${index}-${paragraph.slice(0, 12)}`}
                    style={styles.plainParagraph}
                  >
                    {paragraph}
                  </Text>
                ))
              ) : (
                <Text style={styles.plainPlaceholder}>
                  Start writing about how your day went.
                </Text>
              )}
            </ScrollView>

            <Text style={styles.plainFootnote}>
              Muni is off. Your journal will be saved without Muni&apos;s replies.
              Muni will still provide insights when you finish your entry.
            </Text>
          </View>
        )}

        <View style={styles.inputCard}>
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Write what happened today..."
            placeholderTextColor="#7B8893"
            multiline
            style={styles.input}
            editable={canWrite}
          />

          <Pressable
            style={[
              styles.sendButton,
              (isSending || isAiRetryLocked || !canWrite) && styles.sendButtonDisabled,
            ]}
            onPress={() => {
              void handleSendMessage();
            }}
            disabled={isSending || isAiRetryLocked || !canWrite}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[
              styles.concernIconButton,
              selectedConcern && styles.concernIconButtonSelected,
            ]}
            onPress={() => setShowConcernModal(true)}
            disabled={!entry?.id || isEntryFinished || isSavingConcern}
            accessibilityLabel={
              selectedConcern
                ? `Selected concern: ${selectedConcern}`
                : "Select concern tag"
            }
          >
            <Ionicons
              name={selectedConcern ? "pricetag" : "pricetag-outline"}
              size={20}
              color={selectedConcern ? "#2E6B23" : "#5E6E7E"}
            />
          </Pressable>

          <Pressable
            style={[styles.finishButton, !canFinishEntry && styles.finishButtonDisabled]}
            onPress={handleRequestFinish}
            disabled={isEntryFinished || isFinishing || isSending || isSavingConcern}
          >
            <Text style={styles.finishButtonText}>
              {isFinishing ? "Finishing..." : "Finish Entry"}
            </Text>
          </Pressable>

          <Pressable style={styles.exitButton} onPress={handleRequestExit}>
            <Text style={styles.exitButtonText}>Exit</Text>
          </Pressable>
        </View>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
        {!errorMessage && statusMessage ? (
          <Text style={styles.statusText}>{statusMessage}</Text>
        ) : null}
        {!isEntryFinished && finishValidationMessage ? (
          <Text style={styles.helperText}>{finishValidationMessage}</Text>
        ) : null}
        {isEntryFinished ? (
          <Text style={styles.lockedText}>
            This entry is finished and can no longer be edited.
          </Text>
        ) : null}

        {!entry ? (
          <Pressable
            style={styles.newEntryButton}
            onPress={() => {
              void handleCreateOrOpenEntry();
            }}
          >
            <Text style={styles.newEntryButtonText}>Start New Entry</Text>
          </Pressable>
        ) : null}

        <Modal
          visible={showRiskModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRiskModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalBody}>
                Muni noticed that this entry may need immediate human support.
                Would you like to contact a counselor now?
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={async () => {
                    if (user?.studentNumber && entry?.id) {
                      const result = await saveJournalSupportResponse({
                        entryId: entry.id,
                        response: "DECLINED",
                        studentNumber: user.studentNumber,
                      });
                      if (result.ok && result.entry) {
                        setEntry(result.entry);
                      }
                    }
                    setShowRiskModal(false);
                  }}
                >
                  <Text style={styles.modalSecondaryText}>Not Now</Text>
                </Pressable>

                <Pressable
                  style={styles.modalPrimaryButton}
                  onPress={async () => {
                    if (user?.studentNumber && entry?.id) {
                      const result = await saveJournalSupportResponse({
                        entryId: entry.id,
                        response: "CONTACTED",
                        studentNumber: user.studentNumber,
                      });
                      if (result.ok && result.entry) {
                        setEntry(result.entry);
                      }
                    }
                    setShowRiskModal(false);
                    router.push("/consult");
                  }}
                >
                  <Text style={styles.modalPrimaryText}>Contact</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showConcernModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConcernModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.concernModalCard]}>
              <Text style={styles.concernTitle}>
                What brings you here today?
              </Text>

              {selectedConcern ? (
                <Text style={styles.concernCurrentText}>
                  Selected: {selectedConcern}
                </Text>
              ) : null}

              <View style={styles.concernGrid}>
                {CONCERN_OPTIONS.map((concern) => {
                  const isSelected = selectedConcern === concern;
                  return (
                    <Pressable
                      key={concern}
                      style={[
                        styles.concernOption,
                        isSelected && styles.concernOptionSelected,
                      ]}
                      onPress={async () => {
                        await handleSelectConcern(concern);
                        setShowConcernModal(false);
                      }}
                      disabled={
                        !entry?.id || isEntryFinished || isSavingConcern
                      }
                    >
                      <Text
                        style={[
                          styles.concernOptionText,
                          isSelected && styles.concernOptionTextSelected,
                        ]}
                      >
                        {concern}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => setShowConcernModal(false)}
              >
                <Text style={styles.modalSecondaryText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showFinishModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (isFinishing) return;
            setShowFinishModal(false);
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalBody}>
                Finish this journal entry? After finishing, this entry will be locked and can no longer be edited.
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowFinishModal(false)}
                  disabled={isFinishing}
                >
                  <Text style={styles.modalSecondaryText}>Keep Editing</Text>
                </Pressable>

                <Pressable
                  style={styles.modalPrimaryButton}
                  onPress={async () => {
                    setShowFinishModal(false);
                    await handleFinishEntry();
                  }}
                  disabled={isFinishing}
                >
                  <Text style={styles.modalPrimaryText}>
                    {isFinishing ? "Finishing..." : "Finish"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showExitModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (isDiscarding) return;
            setShowExitModal(false);
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalBody}>
                Exit this entry? Your current journal draft will be discarded
                and will not be saved unless you finish the entry first.
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowExitModal(false)}
                  disabled={isDiscarding}
                >
                  <Text style={styles.modalSecondaryText}>Stay</Text>
                </Pressable>

                <Pressable
                  style={styles.modalDangerButton}
                  onPress={() => {
                    void handleConfirmExit();
                  }}
                  disabled={isDiscarding}
                >
                  {isDiscarding ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryText}>Discard</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        </KeyboardAvoidingView>
      </JournalLockGate>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F9F2",
  },
  content: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 10,
    paddingBottom: 18,
  },
  pageWrap: {
    flex: 1,
    minHeight: 420,
    marginBottom: 10,
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
  paperHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 22,
    marginBottom: 8,
    columnGap: 8,
  },
  dateText: {
    color: "#586B63",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
    flex: 1,
  },
  muniToggle: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 10,
  },
  muniToggleOn: {
    backgroundColor: "#EFF8E8",
    borderColor: "#CFE5C1",
  },
  muniToggleOff: {
    backgroundColor: "#F3F4F5",
    borderColor: "#D9DFE3",
  },
  muniToggleDisabled: {
    opacity: 0.7,
  },
  muniToggleIconBubble: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  muniToggleIconBubbleOn: {
    backgroundColor: "#DFF2D1",
  },
  muniToggleIconBubbleOff: {
    backgroundColor: "#E7EBEE",
  },
  muniToggleText: {
    color: "#2E6B23",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  muniToggleTextOff: {
    color: "#687787",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  summaryText: {
    marginLeft: 22,
    marginBottom: 8,
    color: "#5D6E65",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  conversationScroll: {
    flex: 1,
  },
  conversationContent: {
    paddingBottom: 16,
    paddingTop: 4,
    rowGap: 8,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    rowGap: 6,
  },
  loadingText: {
    color: "#45515E",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: "#4D5B69",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 26,
    paddingTop: 16,
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
    lineHeight: 23,
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
  footnoteWrap: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 8,
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
  plainCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#E6E9DD",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 10,
    shadowColor: "#5C6570",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  plainHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 8,
    marginBottom: 12,
  },
  plainDateText: {
    flex: 1,
    color: "#586B63",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  plainBody: {
    flex: 1,
  },
  plainBodyContent: {
    paddingBottom: 16,
  },
  plainParagraph: {
    color: "#31465A",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 18,
  },
  plainPlaceholder: {
    color: "#6D7A87",
    fontSize: 15,
    lineHeight: 22,
    paddingTop: 4,
  },
  plainFootnote: {
    color: "#334256",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 8,
  },
  inputCard: {
    minHeight: 72,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2ECDD",
    shadowColor: "#5C6570",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    columnGap: 10,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    minHeight: 50,
    maxHeight: 110,
    color: "#2E4155",
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#73CB47",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#A3C88F",
  },
  actionRow: {
    marginHorizontal: 2,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "stretch",
    columnGap: 8,
  },
  concernIconButton: {
    width: 56,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E0D2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5C6570",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  concernIconButtonSelected: {
    borderColor: "#7BCB46",
    backgroundColor: "#F4FBEE",
  },
  concernModalCard: {
    maxWidth: 360,
  },
  concernTitle: {
    color: "#34465A",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  concernSubtitle: {
    color: "#5E6E7E",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  concernCurrentText: {
    color: "#2E6B23",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  concernGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginBottom: 14,
  },
  concernOption: {
    width: "48.5%",
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C9D2DA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  concernOptionSelected: {
    borderColor: "#7BCB46",
    backgroundColor: "#F1FAEA",
  },
  concernOptionText: {
    color: "#3E556B",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
  concernOptionTextSelected: {
    color: "#2E6B23",
    fontWeight: "700",
  },
  errorText: {
    color: "#B04444",
    fontSize: 12,
    lineHeight: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  statusText: {
    color: "#53685A",
    fontSize: 12,
    lineHeight: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  lockedText: {
    color: "#5B6774",
    fontSize: 12,
    lineHeight: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  finishButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: "#73CB47",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6D6D6D",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  finishButtonDisabled: {
    backgroundColor: "#A8C99C",
  },
  finishButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
  },
  helperText: {
    color: "#6B7784",
    fontSize: 12,
    lineHeight: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  exitButton: {
    flex: 0.8,
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E5D0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6D6D6D",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  exitButtonText: {
    color: "#53685A",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  newEntryButton: {
    height: 40,
    borderRadius: 999,
    backgroundColor: "#EAF5E3",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    marginTop: 8,
  },
  newEntryButtonText: {
    color: "#436152",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(21, 27, 24, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalBody: {
    color: "#52606C",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    columnGap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CDD5C7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#566271",
    fontSize: 13,
    fontWeight: "700",
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#C85656",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});


