import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createJournalSession,
  discardEmptyJournalEntry,
  discardJournalEntry,
  finishJournalEntry,
  sendJournalMessage,
  suggestJournalTags,
  type JournalEntry,
  type JournalMessage,
} from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";

type VoiceState = "unsupported" | "idle" | "listening" | "thinking" | "speaking" | "error";

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

const MUNI_IMAGE = require("../assets/images/MUNI_default.png");
const MICROPHONE_IMAGE = require("../assets/images/microphone_sample.png");
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

function getSpeechRecognitionConstructor() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function cleanSpokenText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getLatestAssistantReply(messages: JournalMessage[] | undefined) {
  return [...(messages ?? [])].reverse().find((item) => item.role === "assistant")?.text ?? "";
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

function mergeMessageHistory(currentMessages: JournalMessage[], nextMessages: JournalMessage[]) {
  const messagesById = new Map<string, JournalMessage>();
  for (const message of currentMessages) messagesById.set(message.id, message);
  for (const message of nextMessages) messagesById.set(message.id, message);
  return Array.from(messagesById.values()).sort((a, b) => {
    const createdAtDifference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return createdAtDifference || a.id.localeCompare(b.id);
  });
}

export default function MuniVoiceScreen() {
  const { user } = useAuthSession();
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const entryRef = useRef<JournalEntry | null>(null);
  const messagesRef = useRef<JournalMessage[]>([]);
  const sessionStartedRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const latestTranscriptRef = useRef("");
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [transcript, setTranscript] = useState("");
  const [muniReply, setMuniReply] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [isDiscardingJournal, setIsDiscardingJournal] = useState(false);
  const [showTagReviewModal, setShowTagReviewModal] = useState(false);
  const [showRelationshipTagModal, setShowRelationshipTagModal] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAnalyzingTags, setIsAnalyzingTags] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>(() =>
    getSpeechRecognitionConstructor() ? "idle" : "unsupported",
  );

  const speechSupported = useMemo(() => Boolean(getSpeechRecognitionConstructor()), []);
  const hasUserMessages = useMemo(
    () => messages.some((item) => item.role === "user" && item.text.trim()),
    [messages],
  );
  const canListen =
    speechSupported &&
    !isLoadingSession &&
    Boolean(entry?.id) &&
    voiceState !== "listening" &&
    voiceState !== "thinking" &&
    !isSavingJournal &&
    !isAnalyzingTags &&
    !isSavingTags &&
    !isDiscardingJournal;
  const canSaveJournal =
    Boolean(entry?.id) &&
    !entry?.isFinished &&
    hasUserMessages &&
    !isSavingJournal &&
    !isAnalyzingTags &&
    !isSavingTags &&
    !isDiscardingJournal &&
    voiceState !== "listening" &&
    voiceState !== "thinking";

  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (showTagReviewModal) return;
    setSelectedTags(entry?.concernTags ?? []);
  }, [entry?.concernTags, showTagReviewModal]);

  const setActiveEntry = useCallback((nextEntry: JournalEntry | null) => {
    entryRef.current = nextEntry;
    setEntry(nextEntry);
  }, []);

  const setConversationMessages = useCallback((nextMessages: JournalMessage[]) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }, []);

  const toggleSelectedTag = useCallback((tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : uniqueTags([...current, tag]),
    );
  }, []);

  const handleTagOptionPress = useCallback((tag: string) => {
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
  }, [selectedTags, toggleSelectedTag]);

  const handleRelationshipTagSelect = useCallback((tag: string) => {
    setSelectedTags((current) =>
      uniqueTags([
        ...current.filter((item) => !INTERPERSONAL_RELATIONSHIP_TAGS.includes(item)),
        INTERPERSONAL_TAG,
        tag,
      ]),
    );
    setShowRelationshipTagModal(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speakReply = useCallback((reply: string) => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceState("idle");
      return;
    }

    const text = cleanSpokenText(reply);
    if (!text) {
      setVoiceState("idle");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[^\u0000-\u007f]/.test(text) || /\b(ako|ko|mo|naman|kasi|sige|salamat)\b/i.test(text)
      ? "fil-PH"
      : "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onend = () => setVoiceState("idle");
    utterance.onerror = () => setVoiceState("idle");
    setVoiceState("speaking");
    window.speechSynthesis.speak(utterance);
  }, []);

  const loadSession = useCallback(async () => {
    if (!user?.studentNumber) {
      setStatusMessage("Student session is missing.");
      setVoiceState("error");
      setIsLoadingSession(false);
      return;
    }

    if (sessionStartedRef.current) {
      setIsLoadingSession(false);
      return;
    }
    sessionStartedRef.current = true;

    setIsLoadingSession(true);
    setStatusMessage("Starting a fresh voice journal...");
    const created = await createJournalSession({
      aiEnabled: true,
      forceNew: true,
      studentNumber: user.studentNumber,
    });
    if (created.ok && created.entry) {
      setActiveEntry(created.entry);
      setConversationMessages(created.messages ?? []);
      setMuniReply(getLatestAssistantReply(created.messages));
      setStatusMessage("");
      setIsLoadingSession(false);
      return;
    }

    setStatusMessage(created.message ?? "Unable to start a Muni voice journal.");
    setVoiceState("error");
    setIsLoadingSession(false);
    sessionStartedRef.current = false;
  }, [setActiveEntry, setConversationMessages, user?.studentNumber]);

  useEffect(() => {
    void loadSession();
    return () => {
      recognitionRef.current?.stop();
      stopSpeaking();
    };
  }, [loadSession, stopSpeaking]);

  const handleBack = useCallback(() => {
    recognitionRef.current?.stop();
    stopSpeaking();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  }, [stopSpeaking]);

  const sendTranscriptToMuni = useCallback(async (spokenText: string) => {
    if (!user?.studentNumber) {
      setStatusMessage("Student session is missing.");
      setVoiceState("error");
      return;
    }

    const messageText = cleanSpokenText(spokenText);
    if (!messageText) {
      setVoiceState("idle");
      setStatusMessage("I did not catch that. Try speaking again.");
      return;
    }

    const activeEntryId = entryRef.current?.id;
    if (!activeEntryId) {
      setVoiceState("error");
      setStatusMessage("Voice journal session is missing. Go back and start voice again.");
      return;
    }

    setVoiceState("thinking");
    setStatusMessage("Muni is thinking...");
    const result = await sendJournalMessage({
      aiEnabled: true,
      entryId: activeEntryId,
      message: messageText,
      messages: messagesRef.current,
      requireExistingEntry: true,
      studentNumber: user.studentNumber,
    });

    if (!result.ok) {
      setStatusMessage(result.message ?? "Muni could not reply right now.");
      setVoiceState("error");
      return;
    }

    setActiveEntry(result.entry ?? entryRef.current);
    setConversationMessages(mergeMessageHistory(messagesRef.current, result.messages ?? []));
    const reply = cleanSpokenText(result.aiReply || getLatestAssistantReply(result.messages) || result.message || "");
    setMuniReply(reply || "I heard you. You can keep sharing when you are ready.");
    setStatusMessage("");
    speakReply(reply || "I heard you. You can keep sharing when you are ready.");
  }, [setActiveEntry, setConversationMessages, speakReply, user?.studentNumber]);

  const handleRequestTagReview = useCallback(async () => {
    if (!user?.studentNumber || !entry?.id || isAnalyzingTags || isSavingJournal) return;
    if (!hasUserMessages) {
      setStatusMessage("Speak with Muni first before saving this journal.");
      return;
    }

    recognitionRef.current?.stop();
    stopSpeaking();
    setIsAnalyzingTags(true);
    setStatusMessage("Muni is reviewing your journal tags...");

    try {
      const result = await suggestJournalTags({
        entryId: entry.id,
        studentNumber: user.studentNumber,
      });

      if (!result.ok) {
        setStatusMessage(result.message ?? "Unable to suggest tags for this voice journal.");
        setVoiceState("error");
        return;
      }

      const suggestedTags = normalizeTagsForReview(
        (result.suggestedTags?.length ? result.suggestedTags : result.entry?.concernTags) ?? [],
      );
      setActiveEntry(result.entry ?? entry);
      setSelectedTags(suggestedTags.length ? suggestedTags : ["Others"]);
      setShowTagReviewModal(true);
      setStatusMessage("");
    } catch {
      setStatusMessage("Unable to suggest tags right now. Check your connection and try again.");
      setVoiceState("error");
    } finally {
      setIsAnalyzingTags(false);
    }
  }, [entry, hasUserMessages, isAnalyzingTags, isSavingJournal, setActiveEntry, stopSpeaking, user?.studentNumber]);

  const handleConfirmTagsAndFinish = useCallback(async () => {
    if (!user?.studentNumber || !entry?.id || isSavingJournal || isSavingTags) return;
    const finalTags = uniqueTags(selectedTags);
    if (finalTags.length === 0) {
      setStatusMessage("Choose at least one tag before saving this voice journal.");
      return;
    }

    setIsSavingTags(true);
    setIsSavingJournal(true);
    setStatusMessage("Analyzing and saving your voice journal...");

    try {
      const finishResult = await finishJournalEntry({
        concernTags: finalTags,
        entryId: entry.id,
        forceAnalyze: true,
        messages: messagesRef.current,
        primaryConcern: finalTags[0],
        studentNumber: user.studentNumber,
      });

      if (!finishResult.ok) {
        setStatusMessage(finishResult.message ?? "Unable to save this voice journal.");
        setVoiceState("error");
        return;
      }

      setShowRelationshipTagModal(false);
      setShowTagReviewModal(false);
      setActiveEntry(finishResult.entry ?? entry);
      if (finishResult.messages) {
        setConversationMessages(finishResult.messages);
      }
      setStatusMessage("Voice journal saved.");
      router.replace(`/journal-entry-view?entryId=${encodeURIComponent(finishResult.entry?.id ?? entry.id)}`);
    } catch {
      setStatusMessage("Unable to save this voice journal. Check your connection and try again.");
      setVoiceState("error");
    } finally {
      setIsSavingTags(false);
      setIsSavingJournal(false);
    }
  }, [entry, isSavingJournal, isSavingTags, selectedTags, setActiveEntry, setConversationMessages, user?.studentNumber]);

  const handleDiscardJournal = useCallback(async () => {
    if (!user?.studentNumber || !entry?.id || isDiscardingJournal) {
      handleBack();
      return;
    }

    recognitionRef.current?.stop();
    stopSpeaking();
    setIsDiscardingJournal(true);
    setStatusMessage("Discarding voice journal...");

    const result = hasUserMessages
      ? await discardJournalEntry({
          entryId: entry.id,
          studentNumber: user.studentNumber,
        })
      : await discardEmptyJournalEntry({
          entryId: entry.id,
          studentNumber: user.studentNumber,
        });

    setIsDiscardingJournal(false);

    if (!result.ok) {
      setStatusMessage(result.message ?? "Unable to discard this voice journal.");
      setVoiceState("error");
      return;
    }

    setConversationMessages([]);
    setActiveEntry(null);
    router.replace("/home");
  }, [entry?.id, handleBack, hasUserMessages, isDiscardingJournal, setActiveEntry, setConversationMessages, stopSpeaking, user?.studentNumber]);

  const handleStartListening = () => {
    if (!speechSupported) {
      setVoiceState("unsupported");
      setStatusMessage("Voice input works in browsers that support the Web Speech API, like Chrome or Edge.");
      return;
    }
    if (!canListen) return;

    stopSpeaking();
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;

    finalTranscriptRef.current = "";
    latestTranscriptRef.current = "";
    setTranscript("");
    setStatusMessage("Listening...");
    setVoiceState("listening");

    const recognition: BrowserSpeechRecognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-PH";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = finalTranscriptRef.current;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index]?.[0]?.transcript ?? "";
        if (event.results[index]?.isFinal) {
          finalTranscript = cleanSpokenText(`${finalTranscript} ${text}`);
        } else {
          interimTranscript = cleanSpokenText(`${interimTranscript} ${text}`);
        }
      }

      finalTranscriptRef.current = finalTranscript;
      const latestTranscript = cleanSpokenText(`${finalTranscript} ${interimTranscript}`);
      latestTranscriptRef.current = latestTranscript;
      setTranscript(latestTranscript);
    };

    recognition.onerror = (event) => {
      setVoiceState("error");
      setStatusMessage(event.error === "not-allowed" ? "Microphone permission was blocked." : "Voice input stopped. Try again.");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      const spokenText = finalTranscriptRef.current || latestTranscriptRef.current;
      void sendTranscriptToMuni(spokenText);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleStopListening = () => {
    recognitionRef.current?.stop();
  };

  const statusTitle =
    voiceState === "listening"
      ? "Listening"
      : voiceState === "thinking"
        ? "Muni is thinking"
        : voiceState === "speaking"
          ? "Muni is speaking"
          : voiceState === "unsupported"
            ? "Browser not supported"
            : "Voice session idle";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={26} color="#304456" />
        </Pressable>
        <Text style={styles.topTitle}>Talk to Muni</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.muniCircle}>
            <Image source={MUNI_IMAGE} style={styles.muniImage} resizeMode="contain" />
          </View>
          <Text style={styles.heading}>Muni Voice</Text>
          <Text style={styles.subheading}>
            Browser speech turns your voice into text, sends it to Muni chat, then reads Muni&apos;s reply aloud.
          </Text>
        </View>

        <View style={styles.voicePanel}>
          <View style={[styles.connectionDot, voiceState === "listening" && styles.connectionDotLive]} />
          <Text style={styles.connectionTitle}>{statusTitle}</Text>
          <Text style={styles.connectionMessage}>
            {statusMessage || transcript || "Tap Start Listening, speak naturally, and Muni will answer using the existing chat flow."}
          </Text>

          {muniReply ? (
            <View style={styles.replyBox}>
              <Text style={styles.replyLabel}>Muni</Text>
              <Text style={styles.replyText}>{muniReply}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryButton, !canListen && styles.primaryButtonDisabled]}
            disabled={!canListen}
            onPress={handleStartListening}
          >
            <Image source={MICROPHONE_IMAGE} style={styles.buttonIcon} resizeMode="contain" />
            <Text style={styles.primaryButtonText}>Start Listening</Text>
          </Pressable>

          {voiceState === "listening" ? (
            <Pressable style={styles.secondaryButton} onPress={handleStopListening}>
              <Ionicons name="stop-circle-outline" size={18} color="#365368" />
              <Text style={styles.secondaryButtonText}>Stop and Send</Text>
            </Pressable>
          ) : null}

          {voiceState === "speaking" ? (
            <Pressable style={styles.secondaryButton} onPress={stopSpeaking}>
              <Ionicons name="volume-mute-outline" size={18} color="#365368" />
              <Text style={styles.secondaryButtonText}>Stop Voice</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.chatPanel}>
          <View style={styles.chatHeaderRow}>
            <View>
              <Text style={styles.chatEyebrow}>Voice Journal Draft</Text>
              <Text style={styles.chatTitle}>Conversation</Text>
            </View>
            <Text style={styles.chatCount}>{messages.length} turns</Text>
          </View>

          <View style={styles.chatTranscript}>
            {messages.length ? (
              messages.map((item) => {
                const isUser = item.role === "user";
                return (
                  <View
                    key={item.id}
                    style={[styles.messageBubble, isUser ? styles.userBubble : styles.muniBubble]}
                  >
                    <Text style={[styles.messageLabel, isUser && styles.userMessageLabel]}>
                      {isUser ? "You" : "Muni"}
                    </Text>
                    <Text style={[styles.messageText, isUser && styles.userMessageText]}>{item.text}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyTranscriptText}>
                Your spoken conversation will appear here as text before you save it.
              </Text>
            )}
          </View>

          <View style={styles.journalActions}>
            <Pressable
              style={[styles.discardButton, isDiscardingJournal && styles.actionButtonDisabled]}
              disabled={isDiscardingJournal || isSavingJournal || isAnalyzingTags || isSavingTags}
              onPress={() => {
                void handleDiscardJournal();
              }}
            >
              {isDiscardingJournal ? (
                <ActivityIndicator color="#53685A" size="small" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#53685A" />
                  <Text style={styles.discardButtonText}>Discard</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.saveButton, !canSaveJournal && styles.saveButtonDisabled]}
              disabled={!canSaveJournal}
              onPress={() => {
                void handleRequestTagReview();
              }}
            >
              {isSavingJournal || isAnalyzingTags ? (
                <>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.saveButtonText}>{isAnalyzingTags ? "Reviewing..." : "Saving..."}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Journal</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.notePanel}>
          <Ionicons name="globe-outline" size={18} color="#5A7A50" />
          <Text style={styles.noteText}>
            Web Speech API availability depends on the browser. Chrome and Edge usually work best.
          </Text>
        </View>
      </ScrollView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F9F1",
  },
  topBar: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#DDE7D7",
    backgroundColor: "#FEFFFC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#F1F6EE",
    borderWidth: 1,
    borderColor: "#E0EADC",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#304558",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  topBarSpacer: {
    width: 38,
    height: 38,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 18,
    rowGap: 14,
  },
  hero: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  muniCircle: {
    width: 128,
    height: 128,
    borderRadius: 999,
    backgroundColor: "#E7F5DF",
    borderWidth: 1,
    borderColor: "#D4E8CB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  muniImage: {
    width: 104,
    height: 104,
  },
  heading: {
    color: "#304558",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  subheading: {
    marginTop: 8,
    color: "#5F7180",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  voicePanel: {
    borderRadius: 20,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#DCE9D9",
    padding: 16,
    alignItems: "center",
  },
  connectionDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#C7D1C1",
    marginBottom: 10,
  },
  connectionDotLive: {
    backgroundColor: "#70C943",
  },
  connectionTitle: {
    color: "#304558",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    textAlign: "center",
  },
  connectionMessage: {
    marginTop: 8,
    minHeight: 44,
    color: "#5F7180",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  replyBox: {
    alignSelf: "stretch",
    borderRadius: 16,
    backgroundColor: "#F2F8ED",
    borderWidth: 1,
    borderColor: "#D8E9CB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  replyLabel: {
    color: "#5A7A50",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  replyText: {
    color: "#304558",
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: 14,
    minHeight: 46,
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: "#B8D6AA",
  },
  buttonIcon: {
    width: 20,
    height: 20,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },
  secondaryButton: {
    marginTop: 10,
    minHeight: 42,
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: "#F2F6EF",
    borderWidth: 1,
    borderColor: "#D8E6D0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 6,
  },
  secondaryButtonText: {
    color: "#365368",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  chatPanel: {
    borderRadius: 20,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#DCE9D9",
    padding: 14,
  },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 10,
    marginBottom: 12,
  },
  chatEyebrow: {
    color: "#6A805E",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  chatTitle: {
    color: "#304558",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  chatCount: {
    color: "#6C7D88",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    paddingTop: 4,
  },
  chatTranscript: {
    rowGap: 10,
    paddingVertical: 6,
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  muniBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#F2F8ED",
    borderColor: "#D8E9CB",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#F4F7FA",
    borderColor: "#DDE5EC",
  },
  messageLabel: {
    color: "#5A7A50",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  userMessageLabel: {
    color: "#63727F",
    textAlign: "right",
  },
  messageText: {
    color: "#304558",
    fontSize: 14,
    lineHeight: 21,
  },
  userMessageText: {
    textAlign: "right",
  },
  emptyTranscriptText: {
    color: "#687787",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  journalActions: {
    flexDirection: "row",
    alignItems: "stretch",
    columnGap: 10,
    marginTop: 12,
  },
  discardButton: {
    flex: 0.8,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E5D0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 6,
  },
  discardButtonText: {
    color: "#53685A",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  saveButton: {
    flex: 1.2,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 6,
  },
  saveButtonDisabled: {
    backgroundColor: "#B8D6AA",
  },
  actionButtonDisabled: {
    opacity: 0.75,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
  },
  notePanel: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE8D8",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    columnGap: 8,
  },
  noteText: {
    flex: 1,
    color: "#5F7180",
    fontSize: 13,
    lineHeight: 19,
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
  tagReviewScroll: {
    maxHeight: 420,
    marginBottom: 14,
  },
  tagSectionLabel: {
    color: "#53685A",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
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
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
