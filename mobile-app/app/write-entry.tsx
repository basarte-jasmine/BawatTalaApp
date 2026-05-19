import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
  fetchDailyMood,
  fetchTodayJournalSession,
  finishJournalEntry,
  JournalEntry,
  JournalMessage,
  saveJournalSupportResponse,
  saveDailyMood,
  sendJournalMessage,
  suggestJournalTags,
} from "../lib/backend-api";
import { EMOTIONS, getEmotionImageSource } from "../lib/emotions";
import { getManilaTodayParts } from "../lib/manila-date";

const NOTEBOOK_RINGS = Array.from({ length: 12 }, (_, index) => index);
const PAPER_RULES = Array.from({ length: 24 }, (_, index) => index);
const POSITIVE_TAG_OPTIONS = [
  "Gratitude / Appreciation",
  "Hobbies & Interests",
  "Travel & Adventure",
  "Personal Growth / Epiphanies",
  "Spirituality / Faith",
];
const CONCERN_TAG_OPTIONS = [
  "Personal problems",
  "Mental health",
  "Academic problems",
  "Interpersonal relationships",
  "Career guidance",
  "Financial guidance",
  "Anxiety",
  "Stress",
  "Bullying",
  "Adjustment",
  "Others",
];
const INTERPERSONAL_TAG = "Interpersonal relationships";
const INTERPERSONAL_RELATIONSHIP_TAGS = ["Peer", "Family", "Romantic"];
const AI_RETRY_LOCK_MS = 12000;
const NCMH_HOTLINE_DIAL_URL = "tel:+639178998727";
const NCMH_HOTLINE_DISPLAY = "0917-899-8727";
const NCMH_HOTLINE_LANDLINE = "1553";
const MUNI_PROMPT_TYPE_INTERVAL_MS = 34;
const USER_ENTRY_TYPE_INTERVAL_MS = 42;

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

function uniqueTags(tags: string[]) {
  return tags.filter((tag, index, items) => Boolean(tag) && items.indexOf(tag) === index);
}

function normalizeTagsForReview(tags: string[]) {
  const normalizedTags = uniqueTags(tags);
  const hasRelationshipSubtype = normalizedTags.some((tag) => INTERPERSONAL_RELATIONSHIP_TAGS.includes(tag));
  if (!hasRelationshipSubtype || normalizedTags.includes(INTERPERSONAL_TAG)) {
    return normalizedTags;
  }
  return uniqueTags([...normalizedTags, INTERPERSONAL_TAG]);
}

function TypewrittenMuniPrompt({ onComplete, text }: { onComplete?: () => void; text: string }) {
  const [visibleLength, setVisibleLength] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isComplete = visibleLength >= text.length;

  useEffect(() => {
    setVisibleLength(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = setInterval(() => {
      setVisibleLength((current) => {
        if (current >= text.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return current;
        }
        return current + 1;
      });
    }, MUNI_PROMPT_TYPE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text]);

  useEffect(() => {
    if (!isComplete) return;
    onComplete?.();
  }, [isComplete, onComplete]);

  return (
    <View>
      <Text style={styles.leftMessageText}>
        {text.slice(0, visibleLength)}
        {!isComplete ? <Text style={styles.typewriterCursor}>|</Text> : null}
      </Text>
      {!isComplete ? (
        <View style={styles.muniWritingRow}>
          <Ionicons name="create-outline" size={13} color="#5B8D4E" />
          <Text style={styles.muniWritingText}>Muni is writing...</Text>
        </View>
      ) : null}
    </View>
  );
}

function TypewrittenUserEntry({ isSending, text }: { isSending: boolean; text: string }) {
  const [visibleLength, setVisibleLength] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isComplete = visibleLength >= text.length;

  useEffect(() => {
    setVisibleLength(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (text.length <= 0) {
      return undefined;
    }

    intervalRef.current = setInterval(() => {
      setVisibleLength((current) => {
        if (current >= text.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return current;
        }
        return current + 1;
      });
    }, USER_ENTRY_TYPE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text]);

  return (
    <View>
      <Text style={styles.rightMessageText}>
        {text.slice(0, visibleLength)}
        {isSending ? <Text style={styles.userTypewriterCursor}>|</Text> : null}
      </Text>
      {isSending ? (
        <View style={styles.userWritingRow}>
          <Text style={styles.userWritingText}>
            {isComplete ? "Sending to Muni..." : "Writing into journal..."}
          </Text>
          <Ionicons name="create-outline" size={13} color="#63727F" />
        </View>
      ) : null}
    </View>
  );
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
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [animatedMuniMessageId, setAnimatedMuniMessageId] = useState("");
  const [isAiRetryLocked, setIsAiRetryLocked] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showTagReviewModal, setShowTagReviewModal] = useState(false);
  const [showRelationshipTagModal, setShowRelationshipTagModal] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAnalyzingTags, setIsAnalyzingTags] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [isSavingSupportResponse, setIsSavingSupportResponse] = useState(false);
  const [selectedJournalEmotionId, setSelectedJournalEmotionId] = useState(EMOTIONS[0]?.id ?? "");
  const [activeJournalEmotionId, setActiveJournalEmotionId] = useState<string | null>(null);
  const [isSavingJournalEmotion, setIsSavingJournalEmotion] = useState(false);
  const [showEmotionPicker, setShowEmotionPicker] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const selectedJournalEmotion = useMemo(
    () => EMOTIONS.find((emotion) => emotion.id === selectedJournalEmotionId) ?? EMOTIONS[0],
    [selectedJournalEmotionId],
  );
  const selectedJournalEmotionImageSource = getEmotionImageSource(
    selectedJournalEmotion,
    activeJournalEmotionId === selectedJournalEmotion?.id,
  );

  const loadJournalEmotion = useCallback(async () => {
    if (!user?.studentNumber) {
      setSelectedJournalEmotionId(EMOTIONS[0]?.id ?? "");
      setActiveJournalEmotionId(null);
      return;
    }

    const result = await fetchDailyMood(user.studentNumber, getManilaTodayParts().isoDate);
    if (result.ok && result.entry?.moodId) {
      setSelectedJournalEmotionId(result.entry.moodId);
      setActiveJournalEmotionId(null);
    }
  }, [user?.studentNumber]);

  const loadJournalSession = useCallback(async () => {
    if (!user?.studentNumber) {
      setMessages([]);
      setEntry(null);
      setIsLoading(false);
      void loadJournalEmotion();
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
      void loadJournalEmotion();
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
    void loadJournalEmotion();
    setIsLoading(false);
  }, [loadJournalEmotion, mode, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadJournalSession();
    }, [loadJournalSession]),
  );

  useEffect(() => {
    if (showTagReviewModal) return;
    setSelectedTags(entry?.concernTags ?? []);
  }, [entry?.concernTags, showTagReviewModal]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setInputFocused(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
  const displayMessages = useMemo(
    () =>
      pendingUserMessage
        ? [
            ...visibleMessages,
            {
              createdAt: "",
              id: "pending-user-message",
              role: "user" as const,
              text: pendingUserMessage,
            },
          ]
        : visibleMessages,
    [pendingUserMessage, visibleMessages],
  );
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
    setPendingUserMessage(trimmedMessage);
    setAnimatedMuniMessageId("");
    setInputValue("");

    const result = await sendJournalMessage({
      aiEnabled,
      entryId: entry?.id,
      message: trimmedMessage,
      studentNumber: user.studentNumber,
    });

    setIsSending(false);

    if (!result.ok) {
      setPendingUserMessage("");
      setInputValue(trimmedMessage);
      setErrorMessage(result.message ?? "Unable to save your journal entry.");
      return;
    }

    const latestAssistantMessage = [...(result.messages ?? [])]
      .reverse()
      .find((item) => item.role === "assistant");

    setEntry(result.entry ?? null);
    setPendingUserMessage("");
    setMessages(result.messages ?? []);
    setAnimatedMuniMessageId(result.aiReply ? latestAssistantMessage?.id ?? "" : "");
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

  const handleSelectJournalEmotion = async (emotionId: string) => {
    if (!user?.studentNumber || !canWrite || isSavingJournalEmotion) return;

    setSelectedJournalEmotionId(emotionId);
    setActiveJournalEmotionId(emotionId);
    setIsSavingJournalEmotion(true);
    setErrorMessage("");

    const result = await saveDailyMood(user.studentNumber, emotionId, getManilaTodayParts().isoDate, "JOURNAL");
    setIsSavingJournalEmotion(false);

    if (!result.ok) {
      setActiveJournalEmotionId(null);
      setErrorMessage(result.message ?? "Unable to save your emotion right now.");
      return;
    }

    if (result.entry?.moodId) {
      setSelectedJournalEmotionId(result.entry.moodId);
      setActiveJournalEmotionId(result.entry.moodId);
    }

    setStatusMessage("Emotion check-in saved for today.");
    setShowEmotionPicker(false);
  };

  const toggleSelectedTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : uniqueTags([...current, tag]),
    );
  };

  const handleTagOptionPress = (tag: string) => {
    if (tag !== INTERPERSONAL_TAG) {
      toggleSelectedTag(tag);
      return;
    }

    if (selectedTags.includes(INTERPERSONAL_TAG)) {
      setSelectedTags((current) =>
        current.filter((item) => item !== INTERPERSONAL_TAG && !INTERPERSONAL_RELATIONSHIP_TAGS.includes(item)),
      );
      return;
    }

    setShowRelationshipTagModal(true);
  };

  const handleRelationshipTagSelect = (tag: string) => {
    setSelectedTags((current) =>
      uniqueTags([
        ...current.filter((item) => !INTERPERSONAL_RELATIONSHIP_TAGS.includes(item)),
        INTERPERSONAL_TAG,
        tag,
      ]),
    );
    setShowRelationshipTagModal(false);
  };

  const saveSupportDecision = useCallback(
    async (response: "CONTACTED" | "DECLINED") => {
      if (!user?.studentNumber || !entry?.id) {
        return true;
      }

      setIsSavingSupportResponse(true);
      const result = await saveJournalSupportResponse({
        entryId: entry.id,
        response,
        studentNumber: user.studentNumber,
      });
      setIsSavingSupportResponse(false);

      if (!result.ok) {
        setErrorMessage(result.message ?? "Unable to save your support response.");
        return false;
      }

      if (result.entry) {
        setEntry(result.entry);
      }

      return true;
    },
    [entry?.id, user?.studentNumber],
  );

  const finishRiskEntryWithSupport = useCallback(
    async (response: "CONTACTED" | "DECLINED") => {
      if (!user?.studentNumber || !entry?.id) {
        return true;
      }

      setIsSavingSupportResponse(true);

      const supportResult = await saveJournalSupportResponse({
        entryId: entry.id,
        response,
        studentNumber: user.studentNumber,
      });

      if (!supportResult.ok) {
        setIsSavingSupportResponse(false);
        setErrorMessage(supportResult.message ?? "Unable to save your support response.");
        return false;
      }

      let nextEntry = supportResult.entry ?? entry;

      if (!nextEntry.isFinished) {
        const fallbackTags = uniqueTags(nextEntry.concernTags?.length ? nextEntry.concernTags : ["Mental health"]);
        const finishResult = await finishJournalEntry({
          concernTags: fallbackTags,
          entryId: nextEntry.id,
          primaryConcern: fallbackTags[0] ?? "Mental health",
          studentNumber: user.studentNumber,
        });

        if (!finishResult.ok) {
          setIsSavingSupportResponse(false);
          setErrorMessage(finishResult.message ?? "Unable to finish this journal entry.");
          return false;
        }

        nextEntry = finishResult.entry ?? nextEntry;
      }

      setEntry(nextEntry);
      setIsSavingSupportResponse(false);
      return true;
    },
    [entry, user?.studentNumber],
  );

  const handleDismissRiskModal = useCallback(async () => {
    if (isSavingSupportResponse) {
      return;
    }

    const saved = await saveSupportDecision("DECLINED");
    if (!saved) {
      return;
    }

    setShowRiskModal(false);
  }, [isSavingSupportResponse, saveSupportDecision]);

  const handleCallHotline = useCallback(async () => {
    if (isSavingSupportResponse) {
      return;
    }

    const saved = await finishRiskEntryWithSupport("CONTACTED");
    if (!saved) {
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(NCMH_HOTLINE_DIAL_URL);
      if (!canOpen) {
        Alert.alert(
          "Call NCMH Hotline",
          `Please call ${NCMH_HOTLINE_LANDLINE} or ${NCMH_HOTLINE_DISPLAY} for immediate support.`,
        );
        return;
      }

      setShowRiskModal(false);
      await Linking.openURL(NCMH_HOTLINE_DIAL_URL);
    } catch {
      Alert.alert(
        "Call NCMH Hotline",
        `Please call ${NCMH_HOTLINE_LANDLINE} or ${NCMH_HOTLINE_DISPLAY} for immediate support.`,
      );
    }
  }, [finishRiskEntryWithSupport, isSavingSupportResponse]);

  const handleOpenCounseling = useCallback(async () => {
    if (isSavingSupportResponse) {
      return;
    }

    const saved = await finishRiskEntryWithSupport("CONTACTED");
    if (!saved) {
      return;
    }

    setShowRiskModal(false);
    router.push("/consult?track=professional&skipIntro=1");
  }, [finishRiskEntryWithSupport, isSavingSupportResponse]);

  const handleOpenWellnessTools = useCallback(async () => {
    if (isSavingSupportResponse) {
      return;
    }

    const saved = await finishRiskEntryWithSupport("CONTACTED");
    if (!saved) {
      return;
    }

    setShowRiskModal(false);
    router.push("/wellness-tools");
  }, [finishRiskEntryWithSupport, isSavingSupportResponse]);

  const handleConfirmTagsAndFinish = async () => {
    if (!user?.studentNumber || !entry?.id || isFinishing || isSavingTags) {
      return;
    }
    const finalTags = uniqueTags(selectedTags);
    if (finalTags.length === 0) {
      setErrorMessage("Choose at least one tag before saving this journal entry.");
      return;
    }

    setIsSavingTags(true);
    setIsFinishing(true);
    setErrorMessage("");
    setStatusMessage("");
    const result = await finishJournalEntry({
      concernTags: finalTags,
      entryId: entry.id,
      primaryConcern: finalTags[0],
      studentNumber: user.studentNumber,
    });
    setIsFinishing(false);
    setIsSavingTags(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Unable to finish this journal entry.");
      return;
    }

    setShowTagReviewModal(false);
    setEntry(result.entry ?? null);
    if (result.messages) {
      setMessages(result.messages);
    }
    router.replace(`/journal-entry-view?entryId=${encodeURIComponent(result.entry?.id ?? entry.id)}`);
  };

  const handleRequestFinish = async () => {
    if (isEntryFinished) {
      setErrorMessage("This journal entry is already finished and can no longer be edited.");
      return;
    }
    if (!entry?.id) {
      setErrorMessage("Start a journal entry first.");
      return;
    }
    if (!user?.studentNumber) {
      setErrorMessage("You need to be logged in to finish this journal entry.");
      return;
    }
    const studentNumber = user.studentNumber;
    if (!hasTypedContent) {
      setErrorMessage("Write something first before finishing your journal entry.");
      return;
    }

    setIsAnalyzingTags(true);
    setErrorMessage("");
    setStatusMessage("");
    let activeEntry = entry;

    if (inputValue.trim()) {
      const sendResult = await sendJournalMessage({
        aiEnabled,
        entryId: entry.id,
        message: inputValue.trim(),
        studentNumber,
      });

      if (!sendResult.ok || !sendResult.entry) {
        setIsAnalyzingTags(false);
        setErrorMessage(sendResult.message ?? "Unable to save your journal entry.");
        return;
      }

      activeEntry = sendResult.entry;
      setInputValue("");
      setEntry(sendResult.entry);
      setMessages(sendResult.messages ?? []);
    }

    const result = await suggestJournalTags({
      entryId: activeEntry.id,
      studentNumber,
    });
    setIsAnalyzingTags(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Unable to suggest tags for this journal entry.");
      return;
    }

    const suggestedTags = normalizeTagsForReview(
      (result.suggestedTags?.length ? result.suggestedTags : result.entry?.concernTags) ?? [],
    );
    setEntry(result.entry ?? activeEntry);
    setSelectedTags(suggestedTags.length ? suggestedTags : ["Others"]);
    setShowTagReviewModal(true);
  };

  const isEntryFinished = Boolean(entry?.isFinished);
  const canWrite = !isEntryFinished;
  const finishValidationMessage = !entry?.id
    ? "Start a journal entry first."
    : !hasTypedContent
      ? "Write something first before finishing."
      : "";
  const canFinishEntry = !isEntryFinished && !isFinishing && !isSending && !isAnalyzingTags && !isSavingTags && !finishValidationMessage;
  const liftComposer = keyboardVisible || inputFocused;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <JournalLockGate>
        <KeyboardAvoidingView
          style={[styles.content, liftComposer && styles.contentKeyboardVisible]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        {aiEnabled ? (
          <View style={[styles.pageWrap, liftComposer && styles.pageWrapKeyboardVisible]}>
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
                  ) : displayMessages.length > 0 ? (
                    displayMessages.map((line) =>
                      line.role === "assistant" ? (
                        <View key={line.id} style={styles.leftMessageRow}>
                          <Text style={styles.messageRoleLabel}>Muni</Text>
                          {line.id === "intro" || line.id === animatedMuniMessageId ? (
                            <TypewrittenMuniPrompt
                              text={line.text}
                              onComplete={
                                line.id === animatedMuniMessageId
                                  ? () => setAnimatedMuniMessageId("")
                                  : undefined
                              }
                            />
                          ) : (
                            <Text style={styles.leftMessageText}>
                              {line.text}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View key={line.id} style={styles.rightMessageRow}>
                          <Text style={[styles.messageRoleLabel, styles.messageRoleLabelSelf]}>
                            You
                          </Text>
                          {line.id === "pending-user-message" ? (
                            <TypewrittenUserEntry isSending={isSending} text={line.text} />
                          ) : (
                            <Text style={styles.rightMessageText}>
                              {line.text}
                            </Text>
                          )}
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
                    Muni is AI. Replies are for reflection only and are not psychometrician or professional advice.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.plainCard, liftComposer && styles.plainCardKeyboardVisible]}>
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
              Muni AI may still summarize when you finish, but it is not a psychometrician.
            </Text>
          </View>
        )}

        <View style={[styles.inputCard, liftComposer && styles.inputCardKeyboardVisible]}>
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="Write what happened today..."
            placeholderTextColor="#7B8893"
            multiline
            style={styles.input}
            editable={canWrite}
          />

          <Pressable
            style={[
              styles.emotionMenuButton,
              selectedJournalEmotion && { borderColor: selectedJournalEmotion.color },
              (!canWrite || isSavingJournalEmotion) && styles.emotionMenuButtonDisabled,
            ]}
            onPress={() => setShowEmotionPicker(true)}
            disabled={!canWrite || isSavingJournalEmotion}
            accessibilityLabel="Choose journal emotion"
          >
            {isSavingJournalEmotion ? (
              <ActivityIndicator color="#5AA63D" size="small" />
            ) : selectedJournalEmotionImageSource ? (
              <Image
                source={selectedJournalEmotionImageSource}
                style={styles.emotionMenuImage}
                resizeMode="contain"
              />
            ) : (
              <Ionicons name="menu-outline" size={20} color="#53685A" />
            )}
          </Pressable>

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
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {!liftComposer ? (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.finishButton, !canFinishEntry && styles.finishButtonDisabled]}
              onPress={() => {
                void handleRequestFinish();
              }}
              disabled={!canFinishEntry}
            >
              <Text style={styles.finishButtonText}>
                {isAnalyzingTags ? "Analyzing..." : isFinishing ? "Saving..." : "Finish Entry"}
              </Text>
            </Pressable>

            <Pressable style={styles.exitButton} onPress={handleRequestExit}>
              <Text style={styles.exitButtonText}>Exit</Text>
            </Pressable>
          </View>
        ) : null}

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
          visible={showEmotionPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEmotionPicker(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.emotionPickerModalCard]}>
              <View style={styles.emotionPickerHeader}>
                <View>
                  <Text style={styles.concernTitle}>Choose emotion</Text>
                  <Text style={styles.concernSubtitle}>Tap any emotion to add another daily check-in.</Text>
                </View>
                <Pressable
                  style={styles.emotionPickerCloseButton}
                  onPress={() => setShowEmotionPicker(false)}
                  accessibilityLabel="Close emotion picker"
                >
                  <Ionicons name="close" size={18} color="#687787" />
                </Pressable>
              </View>

              <View style={styles.emotionPickerGrid}>
                {EMOTIONS.map((emotion) => {
                  const emotionImageSource = getEmotionImageSource(emotion, activeJournalEmotionId === emotion.id);

                  return (
                    <Pressable
                      key={emotion.id}
                      style={styles.emotionPickerOption}
                      onPress={() => {
                        void handleSelectJournalEmotion(emotion.id);
                      }}
                      disabled={isSavingJournalEmotion}
                    >
                      <View
                        style={[
                          styles.emotionPickerIcon,
                          { borderColor: emotion.color },
                        ]}
                      >
                        {emotionImageSource ? (
                          <Image source={emotionImageSource} style={styles.emotionPickerImage} resizeMode="contain" />
                        ) : (
                          <View style={[styles.emotionPickerFallback, { backgroundColor: emotion.color }]} />
                        )}
                      </View>
                      <Text style={styles.emotionPickerLabel} numberOfLines={2}>
                        {emotion.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showRiskModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            void handleDismissRiskModal();
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.riskModalCard}>
              <Pressable
                style={styles.riskCloseButton}
                onPress={() => {
                  void handleDismissRiskModal();
                }}
                disabled={isSavingSupportResponse}
                accessibilityLabel="Dismiss support options"
              >
                <Ionicons name="close" size={18} color="#72808C" />
              </Pressable>

              <View style={styles.riskHeader}>
                <View style={styles.riskIconBadge}>
                  <Ionicons name="shield-outline" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.riskTitle}>Get support right now</Text>
                <Text style={styles.riskBody}>
                  Muni noticed language that may point to self-harm or suicide.
                  Choose the fastest support option below.
                </Text>
                <Text style={styles.riskHotlineText}>
                  24/7 NCMH Crisis Hotline: {NCMH_HOTLINE_LANDLINE} or{" "}
                  {NCMH_HOTLINE_DISPLAY}
                </Text>
              </View>

              <View style={styles.riskActionStack}>
                <Pressable
                  style={[
                    styles.riskActionButton,
                    styles.riskActionButtonHotline,
                    isSavingSupportResponse && styles.riskActionButtonDisabled,
                  ]}
                  onPress={() => {
                    void handleCallHotline();
                  }}
                  disabled={isSavingSupportResponse}
                >
                  <View style={styles.riskActionIconWrap}>
                    <Ionicons name="call-outline" size={20} color="#2E6B23" />
                  </View>
                  <View style={styles.riskActionCopy}>
                    <Text style={styles.riskActionTitle}>Call hotline now</Text>
                    <Text style={styles.riskActionHint}>
                      Open your phone dialer for immediate crisis support.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#68815F" />
                </Pressable>

                <Pressable
                  style={[
                    styles.riskActionButton,
                    styles.riskActionButtonCounseling,
                    isSavingSupportResponse && styles.riskActionButtonDisabled,
                  ]}
                  onPress={() => {
                    void handleOpenCounseling();
                  }}
                  disabled={isSavingSupportResponse}
                >
                  <View style={styles.riskActionIconWrap}>
                    <Ionicons name="calendar-outline" size={20} color="#3B5B7A" />
                  </View>
                  <View style={styles.riskActionCopy}>
                    <Text style={styles.riskActionTitle}>Schedule counseling</Text>
                    <Text style={styles.riskActionHint}>
                      Go straight to the counseling booking screen.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#68815F" />
                </Pressable>

                <Pressable
                  style={[
                    styles.riskActionButton,
                    styles.riskActionButtonWellness,
                    isSavingSupportResponse && styles.riskActionButtonDisabled,
                  ]}
                  onPress={handleOpenWellnessTools}
                  disabled={isSavingSupportResponse}
                >
                  <View style={styles.riskActionIconWrap}>
                    <Ionicons name="leaf-outline" size={20} color="#4F7D38" />
                  </View>
                  <View style={styles.riskActionCopy}>
                    <Text style={styles.riskActionTitle}>Use wellness tools</Text>
                    <Text style={styles.riskActionHint}>
                      Open guided calming exercises right away.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#68815F" />
                </Pressable>
              </View>

              <Text style={styles.riskFooterText}>
                If you are in immediate danger, contact local emergency services
                now.
              </Text>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showTagReviewModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (isSavingTags) return;
            setShowRelationshipTagModal(false);
            setShowTagReviewModal(false);
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.tagReviewModalCard]}>
              <Text style={styles.concernTitle}>Review journal tags</Text>
              <Text style={styles.concernSubtitle}>
                Muni suggested these tags. You can add or remove tags before saving the finished entry.
              </Text>

              <ScrollView style={styles.tagReviewScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.tagSectionLabel}>Positive tags</Text>
                <View style={styles.concernGrid}>
                  {POSITIVE_TAG_OPTIONS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        style={[styles.concernOption, isSelected && styles.concernOptionSelected]}
                        onPress={() => toggleSelectedTag(tag)}
                        disabled={isSavingTags}
                      >
                        <Text style={[styles.concernOptionText, isSelected && styles.concernOptionTextSelected]}>
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.tagSectionLabel}>Concern tags</Text>
                <View style={styles.concernGrid}>
                  {CONCERN_TAG_OPTIONS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        style={[styles.concernOption, isSelected && styles.concernOptionSelected]}
                        onPress={() => handleTagOptionPress(tag)}
                        disabled={isSavingTags}
                      >
                        <Text style={[styles.concernOptionText, isSelected && styles.concernOptionTextSelected]}>
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={() => {
                    setShowRelationshipTagModal(false);
                    setShowTagReviewModal(false);
                  }}
                  disabled={isSavingTags}
                >
                  <Text style={styles.modalSecondaryText}>Keep Editing</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalPrimaryButton, selectedTags.length === 0 && styles.modalPrimaryButtonDisabled]}
                  onPress={() => {
                    void handleConfirmTagsAndFinish();
                  }}
                  disabled={isSavingTags || selectedTags.length === 0}
                >
                  {isSavingTags ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryText}>Save Entry</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showRelationshipTagModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRelationshipTagModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.relationshipTagModalCard]}>
              <Text style={styles.concernTitle}>Choose relationship type</Text>
              <Text style={styles.concernSubtitle}>
                Select the relationship tag that best matches this journal entry.
              </Text>

              <View style={styles.relationshipTagList}>
                {INTERPERSONAL_RELATIONSHIP_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <Pressable
                      key={`relationship-tag-${tag}`}
                      style={[styles.relationshipTagOption, isSelected && styles.relationshipTagOptionSelected]}
                      onPress={() => handleRelationshipTagSelect(tag)}
                    >
                      <Text style={[styles.relationshipTagOptionText, isSelected && styles.relationshipTagOptionTextSelected]}>
                        {tag}
                      </Text>
                      {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#2E6B23" /> : null}
                    </Pressable>
                  );
                })}
              </View>

              <Pressable style={styles.relationshipTagCancelButton} onPress={() => setShowRelationshipTagModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
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
  contentKeyboardVisible: {
    paddingBottom: 6,
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
  pageWrapKeyboardVisible: {
    minHeight: 0,
    marginBottom: 6,
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
  typewriterCursor: {
    color: "#5B8D4E",
    fontWeight: "800",
  },
  muniWritingRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginTop: 5,
  },
  muniWritingText: {
    color: "#5B8D4E",
    fontSize: 11,
    lineHeight: 15,
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
  userTypewriterCursor: {
    color: "#63727F",
    fontWeight: "800",
  },
  userWritingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    columnGap: 4,
    marginTop: 5,
  },
  userWritingText: {
    color: "#63727F",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textAlign: "right",
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
  plainCardKeyboardVisible: {
    marginBottom: 6,
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
  inputCardKeyboardVisible: {
    marginBottom: 0,
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
  emotionMenuButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D9E6D2",
    backgroundColor: "#F7FAF4",
    alignItems: "center",
    justifyContent: "center",
  },
  emotionMenuButtonDisabled: {
    opacity: 0.6,
  },
  emotionMenuImage: {
    width: 32,
    height: 32,
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
  emotionPickerModalCard: {
    maxWidth: 360,
  },
  emotionPickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
  },
  emotionPickerCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#F2F5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  emotionPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  emotionPickerOption: {
    width: "48.5%",
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D4DED0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emotionPickerIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emotionPickerImage: {
    width: 26,
    height: 26,
  },
  emotionPickerFallback: {
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  emotionPickerLabel: {
    flex: 1,
    color: "#3E556B",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  tagReviewModalCard: {
    maxWidth: 380,
    maxHeight: "82%",
  },
  relationshipTagModalCard: {
    maxWidth: 340,
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
  tagReviewScroll: {
    maxHeight: 420,
    marginBottom: 14,
  },
  tagSectionLabel: {
    color: "#53685A",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  relationshipTagList: {
    rowGap: 10,
    marginBottom: 12,
  },
  relationshipTagOption: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C9D2DA",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  relationshipTagOptionSelected: {
    borderColor: "#7BCB46",
    backgroundColor: "#F1FAEA",
  },
  relationshipTagOptionText: {
    color: "#3E556B",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  relationshipTagOptionTextSelected: {
    color: "#2E6B23",
  },
  relationshipTagCancelButton: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CDD5C7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
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
  riskModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
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
  riskCloseButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  riskHeader: {
    alignItems: "center",
    paddingTop: 8,
    marginBottom: 14,
  },
  riskIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  riskTitle: {
    color: "#33475C",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  riskBody: {
    marginTop: 8,
    color: "#566675",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    textAlign: "center",
  },
  riskHotlineText: {
    marginTop: 10,
    color: "#2E6B23",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  riskActionStack: {
    rowGap: 10,
  },
  riskActionButton: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  riskActionButtonHotline: {
    backgroundColor: "#F3FBEF",
    borderColor: "#CFE7BE",
  },
  riskActionButtonCounseling: {
    backgroundColor: "#F4F8FC",
    borderColor: "#D7E2EE",
  },
  riskActionButtonWellness: {
    backgroundColor: "#F8FAF3",
    borderColor: "#E1E8D8",
  },
  riskActionButtonDisabled: {
    opacity: 0.7,
  },
  riskActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  riskActionCopy: {
    flex: 1,
  },
  riskActionTitle: {
    color: "#31465A",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  riskActionHint: {
    marginTop: 2,
    color: "#667683",
    fontSize: 12,
    lineHeight: 17,
  },
  riskFooterText: {
    marginTop: 12,
    color: "#7A8691",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
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
  modalPrimaryButtonDisabled: {
    backgroundColor: "#A8C99C",
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


