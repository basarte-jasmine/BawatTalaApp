import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from "expo-audio";
import { File } from "expo-file-system";
import { MuniAvatar } from "../muni/MuniAvatar";
import { JournalLockGate, useAppPreferences } from "../../lib/app-preferences";
import {
  createJournalSession,
  discardEmptyJournalEntry,
  discardJournalEntry,
  finishJournalEntry,
  saveJournalSupportResponse,
  sendJournalMessage,
  suggestJournalTags,
  synthesizeVoiceSpeech,
  transcribeAudio,
  type JournalEntry,
  type JournalMessage,
} from "../../lib/backend-api";
import { useAuthSession } from "../../lib/auth-session";
import { unlockAchievement } from "../../lib/achievements";
import {
  needsCrisisTrioPrompt,
  needsDistressWellnessOffer,
  needsFinishSupportPrompt,
} from "../../lib/risk-level";
import { showAppNotice } from "../../lib/app-notice";

type VoiceState =
  | "unsupported"
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

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
const VOICE_RECORDING_MAX_MS = 5 * 60 * 1000;
const MUNI_VOICE = "fil-PH-BlessicaNeural";
const NCMH_HOTLINE_DIAL_URL = "tel:+639178998727";
const NCMH_HOTLINE_DISPLAY = "0917-899-8727";
const NCMH_HOTLINE_LANDLINE = "1553";

function cleanSpokenText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getVoiceForSpokenLanguage(_language?: string, _transcript?: string) {
  return MUNI_VOICE;
}

function getLatestAssistantReply(messages: JournalMessage[] | undefined) {
  return [...(messages ?? [])].reverse().find((item) => item.role === "assistant")?.text ?? "";
}

function uniqueTags(tags: string[]) {
  return tags.filter((tag, index, items) => Boolean(tag) && items.indexOf(tag) === index);
}

function normalizeTagsForReview(tags: string[]) {
  const normalizedTags = uniqueTags(tags);
  const hasRelationshipSubtype = normalizedTags.some((tag) =>
    INTERPERSONAL_RELATIONSHIP_TAGS.includes(tag)
  );
  if (!hasRelationshipSubtype || normalizedTags.includes(INTERPERSONAL_TAG)) {
    return normalizedTags;
  }
  return uniqueTags([...normalizedTags, INTERPERSONAL_TAG]);
}

function mergeMessageHistory(
  currentMessages: JournalMessage[],
  nextMessages: JournalMessage[]
) {
  const messagesById = new Map<string, JournalMessage>();
  for (const message of currentMessages) messagesById.set(message.id, message);
  for (const message of nextMessages) messagesById.set(message.id, message);
  return Array.from(messagesById.values()).sort((a, b) => {
    const createdAtDifference =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return createdAtDifference || a.id.localeCompare(b.id);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}

function base64ToBlobUrl(base64Data: string, contentType = "audio/mp3"): string {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: contentType });
  return URL.createObjectURL(blob);
}

function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

export type MuniVoiceOverlayProps = {
  visible: boolean;
  onClose: () => void;
};

export function MuniVoiceOverlay({ visible, onClose }: MuniVoiceOverlayProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthSession();
  const { appLockEnabled, isAppLocked, suppressJournalAutoLock } = useAppPreferences();

  const entryRef = useRef<JournalEntry | null>(null);
  const messagesRef = useRef<JournalMessage[]>([]);
  const sessionStartedRef = useRef(false);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldCancelRecordingRef = useRef(false);
  const isDisposedRef = useRef(false);
  const activeRequestIdRef = useRef(0);

  // Web recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Native player / web audio refs
  const nativePlayerRef = useRef<AudioPlayer | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const webBlobUrlRef = useRef<string | null>(null);
  const replyVoiceRef = useRef<string | null>(null);

  // Expo native audio recorder
  const nativeRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const nativeRecorderRef = useRef(nativeRecorder);
  nativeRecorderRef.current = nativeRecorder;

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
  const [showExitModal, setShowExitModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [isSavingSupportResponse, setIsSavingSupportResponse] = useState(false);
  const [riskModalRedirectEntryId, setRiskModalRedirectEntryId] = useState<string | null>(null);
  const [riskPromptSuppressedUntilFinish, setRiskPromptSuppressedUntilFinish] = useState(false);
  const [distressOfferPhase, setDistressOfferPhase] = useState<"wellness" | "save" | null>(null);
  const distressWellnessOfferDoneRef = useRef(false);
  const pendingWellnessAfterFinishRef = useRef(false);
  const [isAnalyzingTags, setIsAnalyzingTags] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");

  const auraPulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Slide-in animation on visible toggle
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 24,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    } else {
      slideAnim.setValue(400);
    }
  }, [visible, slideAnim]);

  // Breathing aura animation for Muni
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (voiceState === "listening" || voiceState === "speaking") {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(auraPulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(auraPulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      Animated.timing(auraPulseAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [voiceState, auraPulseAnim]);

  const hasUserMessages = useMemo(
    () => messages.some((item) => item.role === "user" && item.text.trim()),
    [messages]
  );

  const canListen =
    !isLoadingSession &&
    Boolean(entry?.id) &&
    voiceState !== "listening" &&
    voiceState !== "transcribing" &&
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
    voiceState !== "transcribing" &&
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
        : uniqueTags([...current, tag])
    );
  }, []);

  const handleTagOptionPress = useCallback((tag: string) => {
    if (tag === INTERPERSONAL_TAG) {
      setShowRelationshipTagModal(true);
      return;
    }
    toggleSelectedTag(tag);
  }, [toggleSelectedTag]);

  const handleRelationshipTagSelect = useCallback((subTag: string) => {
    setSelectedTags((current) => {
      const withoutSubtypes = current.filter(
        (item) => !INTERPERSONAL_RELATIONSHIP_TAGS.includes(item)
      );
      return uniqueTags([...withoutSubtypes, subTag, INTERPERSONAL_TAG]);
    });
    setShowRelationshipTagModal(false);
  }, []);

  const clearRecordingTimeout = useCallback(() => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(async () => {
    if (Platform.OS === "web") {
      if (webAudioRef.current) {
        try {
          webAudioRef.current.pause();
          webAudioRef.current.currentTime = 0;
          webAudioRef.current.src = "";
        } catch {}
        webAudioRef.current = null;
      }
      if (webBlobUrlRef.current) {
        try {
          URL.revokeObjectURL(webBlobUrlRef.current);
        } catch {}
        webBlobUrlRef.current = null;
      }
    } else {
      if (nativePlayerRef.current) {
        try {
          nativePlayerRef.current.pause();
          nativePlayerRef.current.remove();
        } catch {}
        nativePlayerRef.current = null;
      }
    }
    setVoiceState((prev) => (prev === "speaking" ? "idle" : prev));
  }, []);

  const stopSpeakingRef = useRef(stopSpeaking);
  stopSpeakingRef.current = stopSpeaking;

  const speakReply = useCallback(
    async (replyText: string, voiceName?: string) => {
      const cleaned = cleanSpokenText(replyText);
      if (!cleaned || isDisposedRef.current) return;

      void stopSpeaking();
      const chosenVoice = MUNI_VOICE;
      replyVoiceRef.current = chosenVoice;

      try {
        setVoiceState("speaking");
        const synthRes = await synthesizeVoiceSpeech({
          text: cleaned,
          voice: chosenVoice,
        });

        if (isDisposedRef.current) return;
        const base64Audio = synthRes?.audioBase64 || "";
        if (!base64Audio) {
          setVoiceState("idle");
          return;
        }

        if (Platform.OS === "web") {
          const audioSrc = "data:audio/mp3;base64," + base64Audio;
          const audio = new Audio(audioSrc);
          webAudioRef.current = audio;
          audio.onended = () => {
            webAudioRef.current = null;
            if (!isDisposedRef.current) {
              setVoiceState("idle");
            }
          };
          audio.onerror = () => {
            webAudioRef.current = null;
            if (!isDisposedRef.current) {
              setVoiceState("idle");
            }
          };
          await audio.play();
        } else {
          await setAudioModeAsync({
            playsInSilentMode: true,
          });
          const audioUrl = "data:audio/mp3;base64," + base64Audio;
          const player = createAudioPlayer(audioUrl);
          nativePlayerRef.current = player;
          player.addListener("playbackStatusUpdate", (status) => {
            if (status.didJustFinish && !isDisposedRef.current) {
              setVoiceState("idle");
            }
          });
          player.play();
        }
      } catch {
        if (!isDisposedRef.current) {
          setVoiceState("idle");
        }
      }
    },
    [(entry as any)?.spokenLanguage, stopSpeaking]
  );

  const loadSession = useCallback(async () => {
    if (appLockEnabled && isAppLocked) return;
    if (!user?.studentNumber) {
      setIsLoadingSession(false);
      setStatusMessage("Please log in to start talking to Muni.");
      setVoiceState("error");
      return;
    }

    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    setIsLoadingSession(true);
    setStatusMessage("Connecting with Muni...");

    try {
      if (Platform.OS !== "web") {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }

      const session = await createJournalSession({
        studentNumber: user.studentNumber,
        aiEnabled: true,
        forceNew: true,
      });

      if (isDisposedRef.current) return;

      setActiveEntry(session.entry ?? null);
      setConversationMessages(session.messages ?? []);

      const latestReply = getLatestAssistantReply(session.messages);
      if (latestReply) {
        setMuniReply(latestReply);
      }
      setIsLoadingSession(false);
      setStatusMessage("");
      setVoiceState("idle");

      if (latestReply) {
        void speakReply(latestReply);
      }
    } catch {
      if (!isDisposedRef.current) {
        setIsLoadingSession(false);
        setStatusMessage("Unable to start a voice journal right now.");
        setVoiceState("error");
      }
    }
  }, [appLockEnabled, isAppLocked, setActiveEntry, setConversationMessages, speakReply, user?.studentNumber]);

  useEffect(() => {
    if (visible) {
      isDisposedRef.current = false;
      sessionStartedRef.current = false;
      if (!(appLockEnabled && isAppLocked)) {
        void loadSession();
      }
    } else {
      isDisposedRef.current = true;
      clearRecordingTimeout();
      void stopSpeaking();
    }
  }, [visible, appLockEnabled, isAppLocked, clearRecordingTimeout, loadSession, stopSpeaking]);

  const handleStartListening = async () => {
    if (!canListen) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    shouldCancelRecordingRef.current = false;
    void stopSpeaking();

    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const mr = new MediaRecorder(stream);
        mediaRecorderRef.current = mr;
        audioChunksRef.current = [];

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mr.onstop = () => {
          if (shouldCancelRecordingRef.current || isDisposedRef.current) return;
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          void blob.arrayBuffer().then((buf) => {
            if (shouldCancelRecordingRef.current || isDisposedRef.current) return;
            const base64 = arrayBufferToBase64(buf);
            void processRecordedAudio(base64, "audio/webm", "recording.webm");
          });
        };

        mr.start();
        setVoiceState("listening");
        setStatusMessage("Listening... speak your mind freely.");

        recordingTimeoutRef.current = setTimeout(() => {
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
          }
        }, VOICE_RECORDING_MAX_MS);
      } catch {
        setStatusMessage("Microphone permission denied or unsupported.");
        setVoiceState("unsupported");
      }
    } else {
      try {
          suppressJournalAutoLock(20000);
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setStatusMessage("Microphone permission denied.");
          setVoiceState("unsupported");
          return;
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        await nativeRecorder.prepareToRecordAsync();
        nativeRecorder.record();
        setVoiceState("listening");
        setStatusMessage("Listening... speak your mind freely.");

        recordingTimeoutRef.current = setTimeout(() => {
          void handleStopListening();
        }, VOICE_RECORDING_MAX_MS);
      } catch {
        setStatusMessage("Could not start audio recorder.");
        setVoiceState("error");
      }
    }
  };

  const handleStopListening = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    clearRecordingTimeout();

    if (Platform.OS === "web") {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      }
    } else {
      try {
        await nativeRecorder.stop();
        const uri = nativeRecorder.uri;
          if (uri && !shouldCancelRecordingRef.current && !isDisposedRef.current) {
            const file = new File(uri);
            try {
              const arrayBuffer = await file.arrayBuffer();
              const base64 = arrayBufferToBase64(arrayBuffer);
              void processRecordedAudio(base64, "audio/m4a", "recording.m4a");
            } finally {
              try {
                if (file.exists) file.delete();
              } catch {}
            }
        }
      } catch {
        setStatusMessage("Error stopping audio recorder.");
        setVoiceState("idle");
      }
    }
  };

  const handleCancelListening = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    shouldCancelRecordingRef.current = true;
    clearRecordingTimeout();

    if (Platform.OS === "web") {
      try {
        mediaRecorderRef.current?.stop();
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
    } else {
      try {
        nativeRecorder.stop();
        const cancelUri = nativeRecorder.uri;
        if (cancelUri) {
          try {
            const cancelFile = new File(cancelUri);
            if (cancelFile.exists) cancelFile.delete();
          } catch {}
        }
      } catch {}
    }
    setVoiceState("idle");
    setStatusMessage("Recording cancelled.");
  };

  const processRecordedAudio = async (base64Audio: string, mimeType = "audio/m4a", filename = "recording.m4a") => {
    if (!user?.studentNumber || !entry?.id) return;

    setVoiceState("transcribing");
    setStatusMessage("Transcribing your voice...");

    try {
      const txResult = await transcribeAudio({
        audioBase64: base64Audio,
        mimeType,
        filename,
      });
      if (!txResult.text || !txResult.text.trim()) {
        setStatusMessage("No speech was recognized. Tap to try again.");
        setVoiceState("idle");
        return;
      }

      const spokenText = txResult.text.trim();
      const replyVoice = getVoiceForSpokenLanguage(txResult.language, spokenText);
      replyVoiceRef.current = replyVoice;
      setTranscript(spokenText);
      setVoiceState("thinking");
      setStatusMessage("Muni is thinking...");

      const sendResult = await sendJournalMessage({
        aiEnabled: true,
        entryId: entry.id,
        message: spokenText,
        messages: messagesRef.current,
        requireExistingEntry: true,
        studentNumber: user.studentNumber,
      });

      if (!sendResult.ok) {
        setStatusMessage(sendResult.message ?? "Could not send your message.");
        setVoiceState("error");
        return;
      }

      setActiveEntry(sendResult.entry ?? entry);
      setConversationMessages(
        mergeMessageHistory(messagesRef.current, sendResult.messages ?? [])
      );

      const latestReply = getLatestAssistantReply(sendResult.messages);
      if (latestReply) {
        setMuniReply(latestReply);
        setStatusMessage("");
        void speakReply(latestReply, replyVoice);
      } else {
        setVoiceState("idle");
        setStatusMessage("");
      }

      if (sendResult.entry && !riskPromptSuppressedUntilFinish && needsCrisisTrioPrompt(sendResult.entry)) {
        setShowRiskModal(true);
      } else if (
        sendResult.entry &&
        !distressWellnessOfferDoneRef.current &&
        needsDistressWellnessOffer(sendResult.entry)
      ) {
        distressWellnessOfferDoneRef.current = true;
        setDistressOfferPhase("wellness");
      }
    } catch {
      setStatusMessage("Error processing audio. Check your connection.");
      setVoiceState("error");
    }
  };

  const handleRequestTagReview = useCallback(async () => {
    if (!user?.studentNumber || !entry?.id || isAnalyzingTags || isSavingJournal) return;
    if (!hasUserMessages) {
      setStatusMessage("Speak with Muni first before saving this journal.");
      return;
    }

    shouldCancelRecordingRef.current = true;
    clearRecordingTimeout();
    if (Platform.OS === "web") {
      mediaRecorderRef.current?.stop();
    } else {
      try {
        nativeRecorder.stop();
      } catch {}
    }
    void stopSpeaking();
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
        (result.suggestedTags?.length ? result.suggestedTags : result.entry?.concernTags) ?? []
      );
      setActiveEntry(result.entry ?? entry);
      setSelectedTags(suggestedTags.length ? suggestedTags : ["Others"]);
      setShowTagReviewModal(true);
      setStatusMessage("");
    } catch {
      setStatusMessage("Unable to suggest tags right now. Check your connection.");
      setVoiceState("error");
    } finally {
      setIsAnalyzingTags(false);
    }
  }, [
    clearRecordingTimeout,
    entry,
    hasUserMessages,
    isAnalyzingTags,
    isSavingJournal,
    nativeRecorder,
    setActiveEntry,
    stopSpeaking,
    user?.studentNumber,
  ]);

  const handleConfirmSaveTags = async () => {
    if (!user?.studentNumber || !entry?.id || isSavingJournal) return;
    const finalTags = uniqueTags(selectedTags);
    if (finalTags.length === 0) {
      setStatusMessage("Choose at least one tag before saving this voice journal.");
      return;
    }

    setIsSavingTags(true);
    setIsSavingJournal(true);
    setStatusMessage("Analyzing and saving your voice journal...");

    try {
      const prioritizedPrimaryConcern =
        finalTags.find((tag) => CONCERN_TAG_OPTIONS.includes(tag) || INTERPERSONAL_RELATIONSHIP_TAGS.includes(tag)) ||
        finalTags[0];

      const finishResult = await finishJournalEntry({
        concernTags: finalTags,
        entryId: entry.id,
        forceAnalyze: true,
        messages: messagesRef.current,
        primaryConcern: prioritizedPrimaryConcern,
        studentNumber: user.studentNumber,
      });

      if (!finishResult.ok) {
        setStatusMessage(finishResult.message ?? "Could not save voice journal.");
        setVoiceState("error");
        return;
      }

      await unlockAchievement("voice-beneath-the-stars", user.studentNumber);
      if (finalTags.some((t: string) => POSITIVE_TAG_OPTIONS.includes(t))) {
        await unlockAchievement("small-good-thing", user.studentNumber);
      }

      if (pendingWellnessAfterFinishRef.current) {
        pendingWellnessAfterFinishRef.current = false;
        await saveSupportDecision("VIEWED_WELLNESS");
        void stopSpeaking();
        setShowTagReviewModal(false);
        onClose();
        router.push("/wellness-tools");
        return;
      }

      if (finishResult.entry && needsFinishSupportPrompt(finishResult.entry, finishResult.messages)) {
        setRiskModalRedirectEntryId(finishResult.entry.id);
        setShowTagReviewModal(false);
        setShowRiskModal(true);
        return;
      }

      setShowTagReviewModal(false);
      onClose();
      router.replace({
        pathname: "/journal-entry-view",
        params: { entryId: finishResult.entry?.id ?? entry.id },
      });
    } catch {
      setStatusMessage("Unable to save this voice journal.");
      setVoiceState("error");
    } finally {
      setIsSavingTags(false);
      setIsSavingJournal(false);
    }
  };

  const saveSupportDecision = useCallback(
    async (
      studentAction: "CLICKED_HOTLINE" | "SCHEDULED_COUNSELING" | "VIEWED_WELLNESS" | "DISMISSED"
    ) => {
      if (!user?.studentNumber || !entry?.id) {
        return true;
      }
      setIsSavingSupportResponse(true);
      const supportResult = await saveJournalSupportResponse({
        entryId: entry.id,
        studentAction,
        studentNumber: user.studentNumber,
      });
      setIsSavingSupportResponse(false);
      if (!supportResult.ok) {
        setStatusMessage(supportResult.message ?? "Unable to save your support response.");
        return false;
      }
      if (supportResult.entry) {
        setActiveEntry(supportResult.entry);
      }
      return true;
    },
    [entry?.id, setActiveEntry, user?.studentNumber]
  );

  const handleDismissRiskModal = useCallback(async () => {
    if (isSavingSupportResponse) return;
    setRiskPromptSuppressedUntilFinish(true);
    const saved = await saveSupportDecision("DISMISSED");
    if (!saved) return;
    setShowRiskModal(false);
    if (riskModalRedirectEntryId) {
      onClose();
      router.replace({
        pathname: "/journal-entry-view",
        params: { entryId: riskModalRedirectEntryId },
      });
    }
  }, [isSavingSupportResponse, onClose, riskModalRedirectEntryId, saveSupportDecision]);

  const handleCallHotline = useCallback(async () => {
    if (isSavingSupportResponse) return;
    const saved = await saveSupportDecision("CLICKED_HOTLINE");
    if (!saved) return;
    try {
      const canOpen = await Linking.canOpenURL(NCMH_HOTLINE_DIAL_URL);
      if (!canOpen) {
        showAppNotice(
          "Call NCMH Hotline",
          `Please call ${NCMH_HOTLINE_LANDLINE} or ${NCMH_HOTLINE_DISPLAY} for immediate support.`
        );
        setShowRiskModal(false);
        return;
      }
      setShowRiskModal(false);
      await Linking.openURL(NCMH_HOTLINE_DIAL_URL);
    } catch {
      showAppNotice(
        "Call NCMH Hotline",
        `Please call ${NCMH_HOTLINE_LANDLINE} or ${NCMH_HOTLINE_DISPLAY} for immediate support.`
      );
      setShowRiskModal(false);
    }
  }, [isSavingSupportResponse, saveSupportDecision]);

  const handleOpenCounseling = useCallback(async () => {
    if (isSavingSupportResponse) return;
    const saved = await saveSupportDecision("SCHEDULED_COUNSELING");
    if (!saved) return;
    setShowRiskModal(false);
    setRiskModalRedirectEntryId(null);
    onClose();
    router.push("/consult?track=professional&skipIntro=1");
  }, [isSavingSupportResponse, onClose, saveSupportDecision]);

  const handleOpenWellnessTools = useCallback(async () => {
    if (isSavingSupportResponse) return;
    void stopSpeaking();
    const saved = await saveSupportDecision("VIEWED_WELLNESS");
    if (!saved) return;
    setShowRiskModal(false);
    setRiskModalRedirectEntryId(null);
    onClose();
    router.push("/wellness-tools");
  }, [isSavingSupportResponse, onClose, saveSupportDecision, stopSpeaking]);

  const clearDistressOffer = useCallback(() => {
    distressWellnessOfferDoneRef.current = true;
    setDistressOfferPhase(null);
  }, []);

  const handleDistressWellnessYes = useCallback(() => {
    distressWellnessOfferDoneRef.current = true;
    setDistressOfferPhase("save");
  }, []);

  const handleDistressWellnessNo = useCallback(() => {
    clearDistressOffer();
  }, [clearDistressOffer]);

  const handleDistressSaveDecline = useCallback(() => {
    clearDistressOffer();
    void handleOpenWellnessTools();
  }, [clearDistressOffer, handleOpenWellnessTools]);

  const handleDistressSaveAccept = useCallback(() => {
    setDistressOfferPhase(null);
    pendingWellnessAfterFinishRef.current = true;
    void handleRequestTagReview();
  }, [handleRequestTagReview]);

  const resetVoiceOverlayState = useCallback(() => {
    setEntry(null);
    setMessages([]);
    setTranscript("");
    setMuniReply("");
    setStatusMessage("");
    setSelectedTags([]);
    setVoiceState("idle");
    setShowExitModal(false);
    setShowTagReviewModal(false);
    setShowRelationshipTagModal(false);
    setShowRiskModal(false);
    setDistressOfferPhase(null);
    distressWellnessOfferDoneRef.current = false;
    pendingWellnessAfterFinishRef.current = false;
    sessionStartedRef.current = false;
  }, []);

  const handleRequestDiscard = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setShowExitModal(true);
  };

  const handleDiscardJournal = async () => {
    clearRecordingTimeout();
    void stopSpeaking();

    if (isDiscardingJournal || !user?.studentNumber) {
      resetVoiceOverlayState();
      onClose();
      return;
    }
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    setIsDiscardingJournal(true);
    try {
      if (entry?.id) {
        await discardJournalEntry({
          entryId: entry.id,
          studentNumber: user.studentNumber,
        });
      }
    } catch {
      // silently catch
    } finally {
      setIsDiscardingJournal(false);
      resetVoiceOverlayState();
      onClose();
    }
  };

  const handleCloseOverlay = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (hasUserMessages && !entry?.isFinished) {
      setShowExitModal(true);
      return;
    }

    if (entry?.id && user?.studentNumber && !hasUserMessages) {
      void discardEmptyJournalEntry({
        entryId: entry.id,
        studentNumber: user.studentNumber,
      });
    }

    Animated.timing(slideAnim, {
      toValue: 450,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleConfirmExit = async () => {
    setShowExitModal(false);
    await handleDiscardJournal();
  };

  const statusTitle =
    voiceState === "listening"
      ? "Listening"
      : voiceState === "transcribing"
      ? "Transcribing voice"
      : voiceState === "thinking"
      ? "Muni is thinking"
      : voiceState === "speaking"
      ? "Muni is speaking"
      : voiceState === "unsupported"
      ? "Microphone not supported"
      : "Ready when you are";

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCloseOverlay}
    >
      <View style={styles.overlayContainer}>
        {/* Frosted Blurred Ambient Backdrop */}
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backdropDismissArea} onPress={handleCloseOverlay} />

        {appLockEnabled && isAppLocked ? (
          <View style={styles.lockGateWrapper}>
            <JournalLockGate onBack={handleCloseOverlay} />
          </View>
        ) : (
        <Animated.View
          style={[
            styles.voiceSheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Top Drag Indicator */}
          <View style={styles.dragPill} />

          {/* Sheet Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.sheetHeading}>Talk to Muni</Text>
              <Text style={styles.sheetSubheading}>
                Speak in Filipino or English. Muni will listen and reply.
              </Text>
            </View>
            <Pressable
              style={styles.closeIconButton}
              onPress={handleCloseOverlay}
              accessibilityLabel="Close voice session"
            >
              <Ionicons name="close" size={18} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Muni Breathing Halo Orb */}
            <View style={styles.muniHaloWrap}>
              <Animated.View
                style={[
                  styles.muniAuraOuter,
                  (voiceState === "listening" || voiceState === "speaking") && styles.muniAuraOuterActive,
                  { transform: [{ scale: auraPulseAnim }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.muniAuraInner,
                  voiceState === "listening" && styles.muniAuraInnerListening,
                  voiceState === "speaking" && styles.muniAuraInnerSpeaking,
                ]}
              />
              <View style={styles.muniCircle}>
                <MuniAvatar style={styles.muniImage} />
              </View>
            </View>

            {/* Status Indicator Pill */}
            <View style={styles.statusPill}>
              <View
                style={[
                  styles.connectionDot,
                  voiceState === "listening" && styles.connectionDotLive,
                  voiceState === "speaking" && styles.connectionDotSpeaking,
                  voiceState === "transcribing" && styles.connectionDotBusy,
                  voiceState === "thinking" && styles.connectionDotBusy,
                ]}
              />
              <Text style={styles.connectionTitle}>{statusTitle}</Text>
            </View>

            <Text style={styles.connectionMessage}>
              {statusMessage ||
                (voiceState === "listening"
                  ? "Muni is listening to your voice..."
                  : "Tap the microphone when you're ready to share.")}
            </Text>

            {/* User Speech Bubble */}
            {transcript ? (
              <View style={styles.userBubble}>
                <View style={styles.bubbleHeaderRow}>
                  <Ionicons name="person-circle" size={14} color="#64748B" />
                  <Text style={styles.bubbleUserTag}>YOU</Text>
                </View>
                <Text style={styles.userBubbleText}>{transcript}</Text>
              </View>
            ) : null}

            {/* Muni Voice Reply Pod */}
            {muniReply ? (
              <View style={styles.replyBox}>
                <View style={styles.replyHeader}>
                  <View style={styles.replyMuniTagWrap}>
                    <Ionicons name="sparkles" size={13} color="#2E7C1F" />
                    <Text style={styles.replyLabel}>MUNI</Text>
                  </View>
                  <Pressable
                    style={styles.replayButton}
                    accessibilityLabel="Play Muni's voice reply again"
                    onPress={() => {
                      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                      void speakReply(muniReply);
                    }}
                  >
                    <Ionicons
                      name={voiceState === "speaking" ? "volume-high" : "volume-medium-outline"}
                      size={14}
                      color="#2E7C1F"
                    />
                    <Text style={styles.replayButtonText}>
                      {voiceState === "speaking" ? "Playing..." : "Listen"}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.replyText}>{muniReply}</Text>
                {distressOfferPhase ? (
                  <View style={styles.distressInlineOffer}>
                    {distressOfferPhase === "wellness" ? (
                      <>
                        <Text style={styles.distressInlineHint}>Open wellness tools?</Text>
                        <View style={styles.distressYesNoRow}>
                          <Pressable
                            style={[styles.distressChoiceButton, styles.distressChoiceNo]}
                            onPress={handleDistressWellnessNo}
                          >
                            <Text style={styles.distressChoiceNoText}>No</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.distressChoiceButton, styles.distressChoiceYes]}
                            onPress={handleDistressWellnessYes}
                          >
                            <Text style={styles.distressChoiceYesText}>Yes</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.distressInlineHint}>
                          Save this entry first? (tags + summary, then wellness tools)
                        </Text>
                        <View style={styles.distressYesNoRow}>
                          <Pressable
                            style={[styles.distressChoiceButton, styles.distressChoiceNo]}
                            onPress={handleDistressSaveDecline}
                          >
                            <Text style={styles.distressChoiceNoText}>Open now</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.distressChoiceButton, styles.distressChoiceYes]}
                            onPress={handleDistressSaveAccept}
                          >
                            <Text style={styles.distressChoiceYesText}>Save first</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Center Siri Microphone Action */}
            <View style={styles.micControlArea}>
              {voiceState === "listening" ? (
                <>
                  <Animated.View
                    style={[
                      styles.micPulseRing,
                      { transform: [{ scale: auraPulseAnim }] },
                    ]}
                  />
                  <Pressable
                    style={[styles.bigMicButton, styles.bigMicButtonActive]}
                    onPress={() => {
                      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                      void handleStopListening();
                    }}
                    accessibilityLabel="Stop and send recording"
                  >
                    <Ionicons name="stop" size={26} color="#FFFFFF" />
                  </Pressable>
                  <Text style={[styles.micHintText, styles.micHintTextActive]}>
                    Tap to stop & send
                  </Text>
                  <Pressable style={styles.cancelLink} onPress={handleCancelListening}>
                    <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                    <Text style={styles.cancelLinkText}>Cancel recording</Text>
                  </Pressable>
                </>
              ) : voiceState === "transcribing" || voiceState === "thinking" ? (
                <View style={styles.loadingControlBubble}>
                  <ActivityIndicator size="small" color="#52B72A" />
                  <Text style={styles.loadingControlText}>
                    {voiceState === "transcribing"
                      ? "Transcribing your voice..."
                      : "Muni is thinking..."}
                  </Text>
                </View>
              ) : (
                <>
                  <Pressable
                    style={[
                      styles.bigMicButton,
                      !canListen && styles.bigMicButtonDisabled,
                    ]}
                    disabled={!canListen}
                    onPress={() => {
                      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                      void handleStartListening();
                    }}
                    accessibilityLabel="Start Recording"
                  >
                    <Ionicons name="mic" size={32} color="#FFFFFF" />
                  </Pressable>
                  <Text style={styles.micHintText}>Tap to speak</Text>
                </>
              )}

              {voiceState === "speaking" ? (
                <Pressable style={styles.stopVoiceButton} onPress={stopSpeaking}>
                  <Ionicons name="volume-mute-outline" size={17} color="#475569" />
                  <Text style={styles.stopVoiceButtonText}>Mute Voice</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Bottom Actions Row */}
            <View style={styles.journalActions}>
              <Pressable
                style={[
                  styles.discardButton,
                  isDiscardingJournal && styles.actionButtonDisabled,
                ]}
                disabled={isDiscardingJournal || isSavingJournal || isAnalyzingTags}
                onPress={handleRequestDiscard}
              >
                {isDiscardingJournal ? (
                  <ActivityIndicator color="#64748B" size="small" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={17} color="#64748B" />
                    <Text style={styles.discardButtonText}>Discard</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.saveButton,
                  !canSaveJournal && styles.saveButtonDisabled,
                ]}
                disabled={!canSaveJournal}
                onPress={handleRequestTagReview}
              >
                {isSavingJournal || isAnalyzingTags ? (
                  <>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.saveButtonText}>
                      {isAnalyzingTags ? "Reviewing..." : "Saving..."}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save Journal</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
        )}

        {/* Tag Review Modal Sheet */}
        <Modal
          visible={showTagReviewModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTagReviewModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.concernTitle}>Review Journal Tags</Text>
              <Text style={styles.concernSubtitle}>
                Muni suggested these tags based on what you shared.
              </Text>

              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.tagSectionLabel}>Positive Tags</Text>
                <View style={styles.concernGrid}>
                  {POSITIVE_TAG_OPTIONS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        style={[
                          styles.concernOption,
                          isSelected && styles.concernOptionSelected,
                        ]}
                        onPress={() => toggleSelectedTag(tag)}
                      >
                        <Text
                          style={[
                            styles.concernOptionText,
                            isSelected && styles.concernOptionTextSelected,
                          ]}
                        >
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.tagSectionLabel}>Concern Tags</Text>
                <View style={styles.concernGrid}>
                  {CONCERN_TAG_OPTIONS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        style={[
                          styles.concernOption,
                          isSelected && styles.concernOptionSelected,
                        ]}
                        onPress={() => handleTagOptionPress(tag)}
                      >
                        <Text
                          style={[
                            styles.concernOptionText,
                            isSelected && styles.concernOptionTextSelected,
                          ]}
                        >
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
                  onPress={() => setShowTagReviewModal(false)}
                >
                  <Text style={styles.modalSecondaryText}>Keep Editing</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.modalPrimaryButton,
                    selectedTags.length === 0 && styles.modalPrimaryButtonDisabled,
                  ]}
                  disabled={selectedTags.length === 0 || isSavingTags}
                  onPress={handleConfirmSaveTags}
                >
                  <Text style={styles.modalPrimaryText}>
                    {isSavingTags ? "Saving..." : "Save Entry"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Relationship Subtype Modal */}
        <Modal
          visible={showRelationshipTagModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRelationshipTagModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxWidth: 310 }]}>
              <Text style={styles.concernTitle}>Relationship Focus</Text>
              <Text style={styles.concernSubtitle}>
                Select who this reflection primarily concerns:
              </Text>

              <View style={{ rowGap: 8, marginVertical: 8 }}>
                {INTERPERSONAL_RELATIONSHIP_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      style={[
                        styles.relationshipOption,
                        isSelected && styles.relationshipOptionSelected,
                      ]}
                      onPress={() => handleRelationshipTagSelect(tag)}
                    >
                      <Text
                        style={[
                          styles.relationshipOptionText,
                          isSelected && styles.relationshipOptionTextSelected,
                        ]}
                      >
                        {tag}
                      </Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={18} color="#2E7C1F" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[styles.modalSecondaryButton, { marginTop: 8 }]}
                onPress={() => setShowRelationshipTagModal(false)}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Safety / Crisis Support Modal */}
        <Modal
          visible={showRiskModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            void handleDismissRiskModal();
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.riskModalCard]}>
              <Pressable
                style={styles.riskCloseButton}
                onPress={() => {
                  void handleDismissRiskModal();
                }}
                disabled={isSavingSupportResponse}
                accessibilityLabel="Dismiss support options"
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>

              <View style={styles.riskHeader}>
                <View style={styles.riskIconBadge}>
                  <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.riskTitle}>Support is here for you</Text>
                <Text style={styles.riskBody}>
                  Muni noticed thoughts that feel heavy or overwhelming. You are not alone, and help is available right now.
                </Text>
                <Text style={styles.riskHotlineText}>
                  24/7 NCMH Crisis Hotline: {NCMH_HOTLINE_LANDLINE} or {NCMH_HOTLINE_DISPLAY}
                </Text>
              </View>

              <View style={styles.riskActionStack}>
                <Pressable
                  style={[styles.riskActionButton, styles.riskActionButtonHotline]}
                  onPress={() => {
                    void handleCallHotline();
                  }}
                  disabled={isSavingSupportResponse}
                >
                  <View style={styles.riskActionIconWrap}>
                    <Ionicons name="call" size={20} color="#2E7C1F" />
                  </View>
                  <View style={styles.riskActionCopy}>
                    <Text style={styles.riskActionTitle}>Call Crisis Hotline</Text>
                    <Text style={styles.riskActionHint}>
                      Direct call to NCMH 24/7 confidential counselors
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </Pressable>

                <Pressable
                  style={[styles.riskActionButton, styles.riskActionButtonCounseling]}
                  onPress={() => {
                    void handleOpenCounseling();
                  }}
                  disabled={isSavingSupportResponse}
                >
                  <View style={styles.riskActionIconWrap}>
                    <Ionicons name="calendar" size={20} color="#1E40AF" />
                  </View>
                  <View style={styles.riskActionCopy}>
                    <Text style={styles.riskActionTitle}>Schedule Guidance Counselor</Text>
                    <Text style={styles.riskActionHint}>
                      Book a dedicated session with your school counselor
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </Pressable>

                <Pressable
                  style={[styles.riskActionButton, styles.riskActionButtonWellness]}
                  onPress={() => {
                    void handleOpenWellnessTools();
                  }}
                  disabled={isSavingSupportResponse}
                >
                  <View style={styles.riskActionIconWrap}>
                    <Ionicons name="leaf" size={20} color="#059669" />
                  </View>
                  <View style={styles.riskActionCopy}>
                    <Text style={styles.riskActionTitle}>Calming Wellness Tools</Text>
                    <Text style={styles.riskActionHint}>
                      Guided 5-4-3-2-1 grounding and breathing resets
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Exit Confirmation Modal */}
        <Modal
          visible={showExitModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowExitModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.exitModalCard}>
              <Text style={styles.exitTitle}>Leave Voice Session?</Text>
              <Text style={styles.exitSubtitle}>
                Your unsaved voice journal entry will be discarded.
              </Text>
              <View style={styles.exitActionRow}>
                <Pressable
                  style={styles.exitStayButton}
                  onPress={() => setShowExitModal(false)}
                >
                  <Text style={styles.exitStayText}>Stay</Text>
                </Pressable>
                <Pressable
                  style={styles.exitDiscardButton}
                  onPress={handleConfirmExit}
                >
                  <Text style={styles.exitDiscardText}>Discard</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  lockGateWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  backdropDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  voiceSheet: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "88%",
  },
  dragPill: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitleGroup: {
    flex: 1,
    paddingRight: 8,
  },
  sheetHeading: {
    color: "#0F172A",
    fontSize: 21,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.3,
  },
  sheetSubheading: {
    color: "#64748B",
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
    fontFamily: "Outfit-Regular",
  },
  closeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetScroll: {
    width: "100%",
  },
  sheetContent: {
    alignItems: "center",
    paddingBottom: 16,
  },

  /* Halo Orb */
  muniHaloWrap: {
    width: 124,
    height: 124,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginVertical: 10,
  },
  muniAuraOuter: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(82, 183, 42, 0.12)",
  },
  muniAuraOuterActive: {
    backgroundColor: "rgba(82, 183, 42, 0.22)",
  },
  muniAuraInner: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(82, 183, 42, 0.2)",
  },
  muniAuraInnerListening: {
    backgroundColor: "rgba(239, 68, 68, 0.22)",
  },
  muniAuraInnerSpeaking: {
    backgroundColor: "rgba(56, 189, 248, 0.25)",
  },
  muniCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2EADC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  muniImage: {
    width: 74,
    height: 74,
  },

  /* Status */
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F1F6EF",
    marginBottom: 6,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#94A3B8",
  },
  connectionDotLive: {
    backgroundColor: "#EF4444",
  },
  connectionDotSpeaking: {
    backgroundColor: "#38BDF8",
  },
  connectionDotBusy: {
    backgroundColor: "#F59E0B",
  },
  connectionTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
  connectionMessage: {
    color: "#64748B",
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Outfit-Regular",
    paddingHorizontal: 10,
  },

  /* Bubbles */
  userBubble: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#F8FAF7",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 10,
  },
  bubbleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginBottom: 4,
  },
  bubbleUserTag: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
  },
  userBubbleText: {
    color: "#0F172A",
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
  },

  replyBox: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#F2F8ED",
    borderWidth: 1,
    borderColor: "#D8E9CB",
    padding: 12,
    marginBottom: 12,
  },
  replyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  replyMuniTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
  },
  replyLabel: {
    color: "#2E7C1F",
    fontSize: 10.5,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#E4F2DB",
    borderWidth: 1,
    borderColor: "#CCE6BE",
  },
  replayButtonText: {
    color: "#2E7C1F",
    fontSize: 11,
    fontFamily: "Outfit-Bold",
  },
  replyText: {
    color: "#0F172A",
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
  },

  /* Mic Controls */
  micControlArea: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    position: "relative",
  },
  bigMicButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#52B72A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#52B72A",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bigMicButtonActive: {
    backgroundColor: "#DC2626",
    shadowColor: "#DC2626",
  },
  bigMicButtonDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
  },
  micPulseRing: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(220, 38, 38, 0.2)",
    top: -8,
  },
  micHintText: {
    marginTop: 7,
    color: "#64748B",
    fontSize: 12,
    fontFamily: "Outfit-Medium",
  },
  micHintTextActive: {
    color: "#DC2626",
    fontFamily: "Outfit-Bold",
  },
  cancelLink: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelLinkText: {
    color: "#DC2626",
    fontSize: 12,
    fontFamily: "Outfit-Bold",
  },
  loadingControlBubble: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  loadingControlText: {
    color: "#334155",
    fontSize: 13,
    fontFamily: "Outfit-Medium",
  },
  stopVoiceButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  stopVoiceButtonText: {
    color: "#475569",
    fontSize: 12,
    fontFamily: "Outfit-Bold",
  },

  /* Actions */
  journalActions: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    width: "100%",
    marginTop: 10,
  },
  discardButton: {
    flex: 0.8,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 6,
  },
  discardButtonText: {
    color: "#64748B",
    fontSize: 14,
    fontFamily: "Outfit-Bold",
  },
  saveButton: {
    flex: 1.2,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#52B72A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 6,
    shadowColor: "#52B72A",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Outfit-Bold",
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 335,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  concernTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  concernSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginBottom: 14,
  },
  tagSectionLabel: {
    color: "#0F172A",
    fontSize: 12.5,
    fontFamily: "Outfit-Bold",
    marginTop: 8,
    marginBottom: 6,
  },
  concernGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  concernOption: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  concernOptionSelected: {
    backgroundColor: "#EAF6E8",
    borderColor: "#52B72A",
  },
  concernOptionText: {
    color: "#475569",
    fontSize: 12,
    fontFamily: "Outfit-Medium",
  },
  concernOptionTextSelected: {
    color: "#2E7C1F",
    fontFamily: "Outfit-Bold",
  },
  modalActions: {
    flexDirection: "row",
    columnGap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  modalSecondaryButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#475569",
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
  },
  modalPrimaryButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#52B72A",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryButtonDisabled: {
    backgroundColor: "#CBD5E1",
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
  },

  /* Exit Modal */
  exitModalCard: {
    width: "100%",
    maxWidth: 295,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  exitTitle: {
    color: "#0F172A",
    fontSize: 19,
    fontFamily: "Outfit-Bold",
    marginBottom: 6,
  },
  exitSubtitle: {
    color: "#64748B",
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "Outfit-Regular",
  },
  exitActionRow: {
    flexDirection: "row",
    columnGap: 10,
    width: "100%",
  },
  exitStayButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  exitStayText: {
    color: "#475569",
    fontFamily: "Outfit-Bold",
    fontSize: 13.5,
  },
  exitDiscardButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  exitDiscardText: {
    color: "#FFFFFF",
    fontFamily: "Outfit-Bold",
    fontSize: 13.5,
  },

  /* Inline Distress Offers */
  distressInlineOffer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#D8E9CB",
    rowGap: 6,
  },
  distressInlineHint: {
    color: "#2E7C1F",
    fontSize: 12.5,
    fontFamily: "Outfit-Medium",
  },
  distressYesNoRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 2,
  },
  distressChoiceButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  distressChoiceNo: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
  },
  distressChoiceYes: {
    backgroundColor: "#E2F0D8",
    borderColor: "#B7D8A2",
  },
  distressChoiceNoText: {
    color: "#64748B",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
  distressChoiceYesText: {
    color: "#2E7C1F",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },

  /* Relationship Option */
  relationshipOption: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  relationshipOptionSelected: {
    borderColor: "#52B72A",
    backgroundColor: "#F0FDF4",
  },
  relationshipOptionText: {
    color: "#334155",
    fontSize: 14,
    fontFamily: "Outfit-Medium",
  },
  relationshipOptionTextSelected: {
    color: "#2E7C1F",
    fontFamily: "Outfit-Bold",
  },

  /* Risk Modal */
  riskModalCard: {
    maxWidth: 345,
    padding: 22,
  },
  riskCloseButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  riskHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  riskIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#52B72A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#52B72A",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  riskTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  riskBody: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
    marginBottom: 8,
  },
  riskHotlineText: {
    color: "#2E7C1F",
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
  },
  riskActionStack: {
    rowGap: 9,
  },
  riskActionButton: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  riskActionButtonHotline: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  riskActionButtonCounseling: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  riskActionButtonWellness: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  riskActionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  riskActionCopy: {
    flex: 1,
  },
  riskActionTitle: {
    color: "#0F172A",
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
  },
  riskActionHint: {
    marginTop: 1,
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Outfit-Regular",
  },
});
