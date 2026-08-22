import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from "expo-audio";
import { File } from "expo-file-system";
import { MuniAvatar } from "../components/muni/MuniAvatar";
import {
  createJournalSession,
  discardEmptyJournalEntry,
  discardJournalEntry,
  finishJournalEntry,
  sendJournalMessage,
  suggestJournalTags,
  synthesizeVoiceSpeech,
  transcribeAudio,
  type JournalEntry,
  type JournalMessage,
} from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";

type VoiceState =
  | "unsupported"
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

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
const VOICE_RECORDING_MAX_MS = 5 * 60 * 1000;
const FILIPINO_MUNI_VOICE = "fil-PH-BlessicaNeural";
const ENGLISH_MUNI_VOICE = "en-US-AvaMultilingualNeural";

function cleanSpokenText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getVoiceForSpokenLanguage(language: string | undefined, transcript: string) {
  const detected = String(language || "").trim().toLowerCase();
  if (detected === "en" || detected.includes("english")) {
    return ENGLISH_MUNI_VOICE;
  }
  if (
    detected === "tl" ||
    detected === "fil" ||
    detected.includes("tagalog") ||
    detected.includes("filipino")
  ) {
    return FILIPINO_MUNI_VOICE;
  }

  const words = transcript.toLowerCase().match(/[a-z]+/g) || [];
  const filipinoMarkers = new Set([
    "ako", "ikaw", "mga", "ang", "ng", "ko", "mo", "kasi",
    "naman", "talaga", "sobrang", "salamat", "hindi", "parang",
    "gusto", "pwede", "puwede", "gawain", "pakiramdam", "pagod",
    "yan", "yung", "pero", "kung", "sana", "marami",
  ]);
  return words.some((word) => filipinoMarkers.has(word))
    ? FILIPINO_MUNI_VOICE
    : ENGLISH_MUNI_VOICE;
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
    INTERPERSONAL_RELATIONSHIP_TAGS.includes(tag),
  );
  if (!hasRelationshipSubtype || normalizedTags.includes(INTERPERSONAL_TAG)) {
    return normalizedTags;
  }
  return uniqueTags([...normalizedTags, INTERPERSONAL_TAG]);
}

function mergeMessageHistory(
  currentMessages: JournalMessage[],
  nextMessages: JournalMessage[],
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

export default function MuniVoiceScreen() {
  const { user } = useAuthSession();
  const entryRef = useRef<JournalEntry | null>(null);
  const messagesRef = useRef<JournalMessage[]>([]);
  const sessionStartedRef = useRef(false);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldCancelRecordingRef = useRef(false);

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
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");

  const hasUserMessages = useMemo(
    () => messages.some((item) => item.role === "user" && item.text.trim()),
    [messages],
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
        : uniqueTags([...current, tag]),
    );
  }, []);

  const handleTagOptionPress = useCallback(
    (tag: string) => {
      if (tag !== INTERPERSONAL_TAG) {
        toggleSelectedTag(tag);
        return;
      }

      if (selectedTags.includes(INTERPERSONAL_TAG)) {
        setSelectedTags((current) =>
          current.filter(
            (item) =>
              item !== INTERPERSONAL_TAG &&
              !INTERPERSONAL_RELATIONSHIP_TAGS.includes(item),
          ),
        );
        return;
      }

      setShowRelationshipTagModal(true);
    },
    [selectedTags, toggleSelectedTag],
  );

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

  const stopSpeaking = useCallback(async () => {
    if (Platform.OS === "web") {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current.currentTime = 0;
        webAudioRef.current = null;
      }
      if (webBlobUrlRef.current) {
        URL.revokeObjectURL(webBlobUrlRef.current);
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
    setVoiceState("idle");
  }, []);

  const clearRecordingTimeout = useCallback(() => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  const speakReply = useCallback(
    async (replyText: string, requestedVoice?: string) => {
      const cleanText = cleanSpokenText(replyText);
      if (!cleanText) {
        setVoiceState("idle");
        return;
      }

      try {
        await stopSpeaking();
        const selectedVoice = requestedVoice || replyVoiceRef.current || undefined;
        if (selectedVoice) replyVoiceRef.current = selectedVoice;
        setVoiceState("speaking");
        setStatusMessage(
          selectedVoice === ENGLISH_MUNI_VOICE
            ? "Muni is speaking in English..."
            : selectedVoice === FILIPINO_MUNI_VOICE
              ? "Muni is speaking in Filipino..."
              : "Muni is speaking...",
        );

        const result = await synthesizeVoiceSpeech({
          text: cleanText,
          voice: selectedVoice,
        });

        if (!result.ok || !result.audioBase64) {
          setVoiceState("idle");
          setStatusMessage("");
          return;
        }
        if (result.voice) replyVoiceRef.current = result.voice;

        if (Platform.OS === "web") {
          const blobUrl = base64ToBlobUrl(result.audioBase64, "audio/mp3");
          webBlobUrlRef.current = blobUrl;
          const audio = new Audio(blobUrl);
          webAudioRef.current = audio;

          audio.onended = () => {
            webAudioRef.current = null;
            if (webBlobUrlRef.current) {
              URL.revokeObjectURL(webBlobUrlRef.current);
              webBlobUrlRef.current = null;
            }
            setVoiceState("idle");
            setStatusMessage("");
          };

          audio.onerror = () => {
            webAudioRef.current = null;
            if (webBlobUrlRef.current) {
              URL.revokeObjectURL(webBlobUrlRef.current);
              webBlobUrlRef.current = null;
            }
            setVoiceState("idle");
            setStatusMessage("");
          };

          await audio.play();
        } else {
          await setAudioModeAsync({
            playsInSilentMode: true,
          });
          const audioUrl = "data:audio/mp3;base64," + result.audioBase64;
          const player = createAudioPlayer(audioUrl);
          nativePlayerRef.current = player;
          player.addListener("playbackStatusUpdate", (status) => {
            if (status.didJustFinish) {
              nativePlayerRef.current = null;
              setVoiceState("idle");
              setStatusMessage("");
            }
          });
          player.play();
        }
      } catch (err) {
        setVoiceState("idle");
        setStatusMessage("");
      }
    },
    [stopSpeaking],
  );

  const sendTranscriptToMuni = useCallback(
    async (spokenText: string, replyVoice: string) => {
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
      setConversationMessages(
        mergeMessageHistory(messagesRef.current, result.messages ?? []),
      );
      const reply = cleanSpokenText(
        result.aiReply ||
          getLatestAssistantReply(result.messages) ||
          result.message ||
          "",
      );
      const finalMuniReply =
        reply || "Narinig kita. Handa akong makinig kapag handa ka na ulit magbahagi.";
      setMuniReply(finalMuniReply);
      setStatusMessage("");
      void speakReply(finalMuniReply, replyVoice);
    },
    [setActiveEntry, setConversationMessages, speakReply, user?.studentNumber],
  );

  const processAudioDataAndSend = useCallback(
    async (base64Audio: string, mimeType: string, filename: string) => {
      if (shouldCancelRecordingRef.current) {
        shouldCancelRecordingRef.current = false;
        setVoiceState("idle");
        setStatusMessage("Recording cancelled.");
        return;
      }

      setVoiceState("transcribing");
      setStatusMessage("Transcribing audio with Whisper AI...");

      try {
        const result = await transcribeAudio({
          audioBase64: base64Audio,
          mimeType,
          filename,
        });

        if (!result.ok || !result.text) {
          setVoiceState("idle");
          setStatusMessage("Could not recognize clear speech. Please try speaking again.");
          return;
        }

        const recognizedText = cleanSpokenText(result.text);
        const replyVoice = getVoiceForSpokenLanguage(result.language, recognizedText);
        setTranscript(recognizedText);
        setStatusMessage("");
        await sendTranscriptToMuni(recognizedText, replyVoice);
      } catch (err: any) {
        setVoiceState("error");
        setStatusMessage(err?.message || "Speech transcription failed.");
      }
    },
    [sendTranscriptToMuni],
  );

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
      clearRecordingTimeout();
      shouldCancelRecordingRef.current = true;
      if (Platform.OS === "web") {
        mediaRecorderRef.current?.stop();
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      } else {
        try {
          nativeRecorder.stop();
        } catch {}
      }
      void stopSpeaking();
    };
  }, [clearRecordingTimeout, loadSession, nativeRecorder, stopSpeaking]);

  const handleBack = useCallback(() => {
    shouldCancelRecordingRef.current = true;
    clearRecordingTimeout();
    if (Platform.OS === "web") {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } else {
      try {
        nativeRecorder.stop();
      } catch {}
    }
    void stopSpeaking();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  }, [clearRecordingTimeout, nativeRecorder, stopSpeaking]);

  const handleStartListening = async () => {
    if (!canListen) return;
    await stopSpeaking();

    shouldCancelRecordingRef.current = false;
    clearRecordingTimeout();
    setTranscript("");
    setStatusMessage("Listening... Speak naturally in Tagalog or English.");
    setVoiceState("listening");

    try {
      if (Platform.OS === "web") {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setVoiceState("unsupported");
          setStatusMessage("Microphone access is not supported in this browser.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];

        const mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;

          if (shouldCancelRecordingRef.current) {
            shouldCancelRecordingRef.current = false;
            setVoiceState("idle");
            setStatusMessage("Recording cancelled.");
            return;
          }

          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          if (blob.size === 0) {
            setVoiceState("idle");
            setStatusMessage("No audio captured.");
            return;
          }

          const arrayBuffer = await blob.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          const ext = mimeType.includes("webm") ? "webm" : "m4a";
          await processAudioDataAndSend(base64, mimeType, "recording." + ext);
        };

        recorder.start(250);
      } else {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          setVoiceState("error");
          setStatusMessage("Microphone permission was not granted.");
          return;
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        await nativeRecorder.prepareToRecordAsync();
        nativeRecorder.record();
      }

      recordingTimeoutRef.current = setTimeout(() => {
        handleStopListening();
      }, VOICE_RECORDING_MAX_MS);
    } catch (err: any) {
      clearRecordingTimeout();
      setVoiceState("error");
      setStatusMessage(err?.message || "Failed to start recording.");
    }
  };

  const handleStopListening = async () => {
    clearRecordingTimeout();
    if (voiceState !== "listening") return;

    if (Platform.OS === "web") {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        await nativeRecorder.stop();
        const uri = nativeRecorder.uri;
        if (!uri) {
          setVoiceState("idle");
          setStatusMessage("No audio recording found.");
          return;
        }

        const file = new File(uri);
        const arrayBuffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        await processAudioDataAndSend(base64, "audio/m4a", "recording.m4a");
      } catch (err: any) {
        setVoiceState("error");
        setStatusMessage(err?.message || "Failed to process mobile audio.");
      }
    }
  };

  const handleCancelListening = async () => {
    shouldCancelRecordingRef.current = true;
    clearRecordingTimeout();
    if (Platform.OS === "web") {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        await nativeRecorder.stop();
      } catch {}
    }
    setVoiceState("idle");
    setStatusMessage("Recording cancelled.");
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
        setStatusMessage(
          result.message ?? "Unable to suggest tags for this voice journal.",
        );
        setVoiceState("error");
        return;
      }

      const suggestedTags = normalizeTagsForReview(
        (result.suggestedTags?.length
          ? result.suggestedTags
          : result.entry?.concernTags) ?? [],
      );
      setActiveEntry(result.entry ?? entry);
      setSelectedTags(suggestedTags.length ? suggestedTags : ["Others"]);
      setShowTagReviewModal(true);
      setStatusMessage("");
    } catch {
      setStatusMessage(
        "Unable to suggest tags right now. Check your connection and try again.",
      );
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
        setStatusMessage(
          finishResult.message ?? "Unable to save this voice journal.",
        );
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
      router.replace({
        pathname: "/journal-entry-view",
        params: { entryId: finishResult.entry?.id ?? entry.id },
      });
    } catch {
      setStatusMessage(
        "Unable to save this voice journal. Check your connection and try again.",
      );
      setVoiceState("error");
    } finally {
      setIsSavingTags(false);
      setIsSavingJournal(false);
    }
  }, [
    entry,
    isSavingJournal,
    isSavingTags,
    selectedTags,
    setActiveEntry,
    setConversationMessages,
    user?.studentNumber,
  ]);

  const handleDiscardJournal = useCallback(async () => {
    if (!user?.studentNumber || !entry?.id || isDiscardingJournal) {
      handleBack();
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
      setStatusMessage(
        result.message ?? "Unable to discard this voice journal.",
      );
      setVoiceState("error");
      return;
    }

    setConversationMessages([]);
    setActiveEntry(null);
    router.replace("/home");
  }, [
    clearRecordingTimeout,
    entry?.id,
    handleBack,
    hasUserMessages,
    isDiscardingJournal,
    nativeRecorder,
    setActiveEntry,
    setConversationMessages,
    stopSpeaking,
    user?.studentNumber,
  ]);

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
              : "Voice session idle";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          accessibilityLabel="Go back"
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={26} color="#304456" />
        </Pressable>
        <Text style={styles.topTitle}>Talk to Muni</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.muniCircle}>
            <MuniAvatar style={styles.muniImage} />
          </View>
          <Text style={styles.heading}>Muni Voice</Text>
          <Text style={styles.subheading}>
            Powered by Whisper AI speech recognition and natural Filipino and English neural voices.
          </Text>
        </View>

        <View style={styles.voicePanel}>
          <View
            style={[
              styles.connectionDot,
              voiceState === "listening" && styles.connectionDotLive,
              voiceState === "speaking" && styles.connectionDotSpeaking,
            ]}
          />
          <Text style={styles.connectionTitle}>{statusTitle}</Text>
          <Text style={styles.connectionMessage}>
            {statusMessage ||
              transcript ||
              "Tap Start Listening, speak naturally in Filipino or English, and Muni will respond with voice."}
          </Text>

          {muniReply ? (
            <View style={styles.replyBox}>
              <View style={styles.replyHeader}>
                <Text style={styles.replyLabel}>Muni</Text>
                <Pressable
                  style={styles.replayButton}
                  accessibilityLabel="Play Muni's voice reply again"
                  onPress={() => {
                    void speakReply(muniReply);
                  }}
                >
                  <Ionicons
                    name={voiceState === "speaking" ? "volume-high" : "volume-medium-outline"}
                    size={16}
                    color="#4A7540"
                  />
                  <Text style={styles.replayButtonText}>
                    {voiceState === "speaking" ? "Playing..." : "Listen"}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.replyText}>{muniReply}</Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              !canListen && styles.primaryButtonDisabled,
            ]}
            disabled={!canListen}
            onPress={() => {
              void handleStartListening();
            }}
          >
            <Image
              source={MICROPHONE_IMAGE}
              style={styles.buttonIcon}
              resizeMode="contain"
            />
            <Text style={styles.primaryButtonText}>
              {voiceState === "listening" ? "Listening..." : "Start Listening"}
            </Text>
          </Pressable>

          {voiceState === "listening" ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                void handleStopListening();
              }}
            >
              <Ionicons name="stop-circle-outline" size={18} color="#365368" />
              <Text style={styles.secondaryButtonText}>Stop and Send</Text>
            </Pressable>
          ) : null}

          {voiceState === "listening" ? (
            <Pressable
              style={styles.cancelRecordingButton}
              onPress={() => {
                void handleCancelListening();
              }}
            >
              <Ionicons name="close-circle-outline" size={18} color="#8A4F4A" />
              <Text style={styles.cancelRecordingButtonText}>Cancel Recording</Text>
            </Pressable>
          ) : null}

          {voiceState === "speaking" ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                void stopSpeaking();
              }}
            >
              <Ionicons name="volume-mute-outline" size={18} color="#365368" />
              <Text style={styles.secondaryButtonText}>Stop Voice</Text>
            </Pressable>
          ) : null}

          <View style={styles.journalActions}>
            <Pressable
              style={[
                styles.discardButton,
                isDiscardingJournal && styles.actionButtonDisabled,
              ]}
              disabled={
                isDiscardingJournal ||
                isSavingJournal ||
                isAnalyzingTags ||
                isSavingTags
              }
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
              style={[
                styles.saveButton,
                !canSaveJournal && styles.saveButtonDisabled,
              ]}
              disabled={!canSaveJournal}
              onPress={() => {
                void handleRequestTagReview();
              }}
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
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={19}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveButtonText}>Save Journal</Text>
                </>
              )}
            </Pressable>
          </View>
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

            <ScrollView
              style={styles.tagReviewScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.tagSectionLabel}>Positive tags</Text>
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
                      disabled={isSavingTags}
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

              <Text style={styles.tagSectionLabel}>Concern tags</Text>
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
                      disabled={isSavingTags}
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
                onPress={() => {
                  setShowRelationshipTagModal(false);
                  setShowTagReviewModal(false);
                }}
                disabled={isSavingTags}
              >
                <Text style={styles.modalSecondaryText}>Keep Editing</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalPrimaryButton,
                  selectedTags.length === 0 &&
                    styles.modalPrimaryButtonDisabled,
                ]}
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
          <View
            style={[styles.modalCard, styles.relationshipTagModalCard]}
          >
            <Text style={styles.concernTitle}>Choose relationship type</Text>
            <Text style={styles.concernSubtitle}>
              Select the relationship tag that best matches this journal entry.
            </Text>

            <View style={styles.relationshipTagList}>
              {INTERPERSONAL_RELATIONSHIP_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={"relationship-tag-" + tag}
                    style={[
                      styles.relationshipTagOption,
                      isSelected && styles.relationshipTagOptionSelected,
                    ]}
                    onPress={() => handleRelationshipTagSelect(tag)}
                  >
                    <Text
                      style={[
                        styles.relationshipTagOptionText,
                        isSelected && styles.relationshipTagOptionTextSelected,
                      ]}
                    >
                      {tag}
                    </Text>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#2E6B23"
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.relationshipTagCancelButton}
              onPress={() => setShowRelationshipTagModal(false)}
            >
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
  connectionDotSpeaking: {
    backgroundColor: "#3B82F6",
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
  replyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  replyLabel: {
    color: "#5A7A50",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#E2F0D8",
    borderWidth: 1,
    borderColor: "#CCE4BF",
  },
  replayButtonText: {
    color: "#3E6634",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
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
  cancelRecordingButton: {
    marginTop: 8,
    minHeight: 40,
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: "#FFF7F5",
    borderWidth: 1,
    borderColor: "#E7C9C3",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 6,
  },
  cancelRecordingButtonText: {
    color: "#8A4F4A",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  journalActions: {
    flexDirection: "row",
    alignItems: "stretch",
    columnGap: 10,
    alignSelf: "stretch",
    marginTop: 14,
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
