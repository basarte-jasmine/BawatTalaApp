import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmationModal } from "../ui/ConfirmationModal";
import { useAuthSession } from "../../lib/auth-session";
import {
  AppNotification,
  deleteStudentNotification,
  fetchStudentMessageThread,
  fetchStudentNotifications,
  markAllStudentNotificationsRead,
  markStudentMessageThreadRead,
  markStudentNotificationRead,
  StudentNotificationCategory,
} from "../../lib/backend-api";
import {
  AdminMessageThread,
  getAdminMessageInitials,
  getNotificationDateSeparator,
  getNotificationDateTimeLabel,
  getNotificationRoute,
  getNotificationTimeOnlyLabel,
  getNotificationVisual,
  groupAdminMessageThreads,
  isAdminMessageNotification,
  isOutgoingAdminMessage,
} from "../../lib/notification-utils";

type StudentInboxScreenProps = {
  variant: "messages" | "notifications";
};

type PendingDelete =
  | { type: "item"; id: string }
  | { type: "thread"; key: string };

const TALA_IMAGE = require("../../assets/images/Tala_Star.png");
const inboxCache = new Map<string, AppNotification[]>();
const INBOX_STORAGE_PREFIX = "bawat_tala_inbox:";
const NOTIFICATION_FILTERS: { key: StudentNotificationCategory; label: string }[] = [
  { key: "notifications", label: "All" },
  { key: "guidance", label: "Guidance" },
  { key: "peer", label: "Peer" },
  { key: "future-self", label: "Future Me" },
  { key: "other", label: "Other" },
];

function getStringMetadataValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function getInboxStorageKey(cacheKey: string) {
  return `${INBOX_STORAGE_PREFIX}${cacheKey}`;
}

async function readPersistedInbox(cacheKey: string): Promise<AppNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(getInboxStorageKey(cacheKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePersistedInbox(cacheKey: string, items: AppNotification[]) {
  try {
    await AsyncStorage.setItem(getInboxStorageKey(cacheKey), JSON.stringify(items));
  } catch {
    // Offline cache is best-effort.
  }
}

function matchesCategoryFilter(item: AppNotification, filter: StudentNotificationCategory) {
  if (filter === "messages") {
    return isAdminMessageNotification(item);
  }
  if (isAdminMessageNotification(item)) {
    return false;
  }
  if (filter === "notifications") {
    return true;
  }
  const kind = String(item.kind || "").toUpperCase();
  const metadata = item.metadata || {};
  const supportType = getStringMetadataValue(metadata, "supportType").toUpperCase();

  if (filter === "future-self") {
    return kind.startsWith("FUTURE_SELF") || kind.includes("FUTURE");
  }
  if (filter === "guidance") {
    const isConsult = kind.startsWith("APPOINTMENT") || kind.startsWith("CONSULT");
    return isConsult && supportType !== "PEER";
  }
  if (filter === "peer") {
    const isConsult = kind.startsWith("APPOINTMENT") || kind.startsWith("CONSULT");
    return isConsult && supportType === "PEER";
  }
  if (filter === "other") {
    const isConsult = kind.startsWith("APPOINTMENT") || kind.startsWith("CONSULT");
    const isFutureSelf = kind.startsWith("FUTURE_SELF") || kind.includes("FUTURE");
    return !isConsult && !isFutureSelf;
  }
  return true;
}

export function StudentInboxScreen({ variant }: StudentInboxScreenProps) {
  const { user } = useAuthSession();
  const [notificationFilter, setNotificationFilter] = useState<StudentNotificationCategory>("notifications");
  const requestCategory = variant === "messages" ? "messages" : notificationFilter;
  const cacheKey = user?.studentNumber ? `${user.studentNumber}:${requestCategory}` : "";
  const cachedItems = cacheKey ? inboxCache.get(cacheKey) : undefined;
  const [items, setItems] = useState<AppNotification[]>(() => cachedItems ?? []);
  const [loading, setLoading] = useState(() => !cachedItems);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [activeThreadKey, setActiveThreadKey] = useState<string | null>(null);
  const [remoteThreadMessages, setRemoteThreadMessages] = useState<AppNotification[] | null>(null);
  const [remoteThreadPhoto, setRemoteThreadPhoto] = useState("");
  const threadScrollRef = useRef<ScrollView>(null);

  const isMessageInbox = variant === "messages";
  const summaryAccent = isMessageInbox ? "#4F7D63" : "#4B7F34";
  const summaryChip = isMessageInbox ? "#E6F4EA" : "#EAF7DD";
  const summarySurface = isMessageInbox ? "#F4FBF6" : "#F6FFF0";
  const emptyIcon = isMessageInbox ? "mail-open-outline" : "notifications-off-outline";
  const summaryIcon = isMessageInbox ? "mail-unread-outline" : "notifications";
  const topTitle = isMessageInbox ? "Messages" : "Notifications";
  const emptyTitle = isMessageInbox ? "No messages yet" : "No notifications yet";
  const emptyText = isMessageInbox
    ? "Messages from admins or counselors will appear here."
    : "Appointments, journal updates, and support alerts will appear here.";
  const summaryBody = isMessageInbox
    ? "Conversations with counselors live here. Open a thread to read every follow-up."
    : "Appointments, journal updates, and support alerts land here. Tap any card to open it.";

  const visibleItems = useMemo(
    () => items.filter((item) => matchesCategoryFilter(item, requestCategory)),
    [items, requestCategory],
  );
  const messageThreads = useMemo(
    () => (isMessageInbox ? groupAdminMessageThreads(visibleItems) : []),
    [isMessageInbox, visibleItems],
  );
  const activeThread = useMemo(
    () => (activeThreadKey ? messageThreads.find((thread) => thread.key === activeThreadKey) ?? null : null),
    [activeThreadKey, messageThreads],
  );
  const unreadCount = useMemo(
    () =>
      isMessageInbox
        ? messageThreads.reduce((total, thread) => total + thread.unreadCount, 0)
        : visibleItems.filter((item) => !item.isRead).length,
    [isMessageInbox, messageThreads, visibleItems],
  );
  const showingThread = Boolean(isMessageInbox && activeThread);
  const threadMessages = remoteThreadMessages?.length ? remoteThreadMessages : activeThread?.messages ?? [];

  const persistInboxItems = useCallback(
    (nextItems: AppNotification[]) => {
      if (cacheKey) {
        inboxCache.set(cacheKey, nextItems);
        void writePersistedInbox(cacheKey, nextItems);
      }
    },
    [cacheKey],
  );

  useEffect(() => {
    if (!isMessageInbox) {
      setActiveThreadKey(null);
      setRemoteThreadMessages(null);
      setRemoteThreadPhoto("");
    }
  }, [isMessageInbox]);

  useEffect(() => {
    if (isMessageInbox && activeThreadKey && !activeThread) {
      setActiveThreadKey(null);
      setRemoteThreadMessages(null);
      setRemoteThreadPhoto("");
    }
  }, [activeThread, activeThreadKey, isMessageInbox]);

  useEffect(() => {
    if (!showingThread) return;
    const frame = requestAnimationFrame(() => {
      threadScrollRef.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [showingThread, activeThread?.key, threadMessages.length]);

  useEffect(() => {
    let cancelled = false;
    const hydrateInbox = async () => {
      const memoryItems = cacheKey ? inboxCache.get(cacheKey) : undefined;
      if (memoryItems) {
        setItems(memoryItems);
        setLoading(false);
        return;
      }
      const persistedItems = cacheKey ? await readPersistedInbox(cacheKey) : [];
      if (cancelled) return;
      if (persistedItems.length) {
        inboxCache.set(cacheKey, persistedItems);
        setItems(persistedItems);
        setLoading(false);
        return;
      }
      setItems([]);
      setLoading(true);
    };
    void hydrateInbox();
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  const handleBack = () => {
    if (isMessageInbox && activeThreadKey) {
      setActiveThreadKey(null);
      setRemoteThreadMessages(null);
      setRemoteThreadPhoto("");
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const loadNotifications = useCallback(async () => {
    if (!user?.studentNumber) {
      setItems([]);
      setLoading(false);
      return;
    }

    const memoryCached = cacheKey ? inboxCache.get(cacheKey) : undefined;
    const persistedItems = !memoryCached && cacheKey ? await readPersistedInbox(cacheKey) : [];
    const cachedInboxItems = memoryCached ?? persistedItems;
    if (cachedInboxItems.length) {
      if (cacheKey) {
        inboxCache.set(cacheKey, cachedInboxItems);
      }
      setItems(cachedInboxItems);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const result = await fetchStudentNotifications(user.studentNumber, requestCategory);
      if (!result.ok) {
        if (!cachedInboxItems.length) {
          setItems([]);
        }
        return;
      }
      const nextItems = Array.isArray(result.notifications) ? result.notifications : [];
      persistInboxItems(nextItems);
      setItems(nextItems);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, persistInboxItems, requestCategory, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const handleMarkAllAsRead = async () => {
    if (!user?.studentNumber) return;

    const unreadItems = visibleItems.filter((item) => !item.isRead);
    const unreadThreads = isMessageInbox ? messageThreads.filter((thread) => thread.unreadCount > 0) : [];
    if (!unreadItems.length && !unreadThreads.length) {
      return;
    }

    if (isMessageInbox) {
      await Promise.all(
        unreadThreads
          .map((thread) => thread.counselorId || (thread.key.startsWith("id:") ? thread.key.slice(3) : ""))
          .filter(Boolean)
          .map((counselorId) => markStudentMessageThreadRead(counselorId)),
      );
    }

    const result = await markAllStudentNotificationsRead(user.studentNumber, requestCategory);
    if (!result.ok && !isMessageInbox) {
      return;
    }

    setItems((current) => {
      const nextItems = current.map((item) => (visibleItems.some((entry) => entry.id === item.id) ? { ...item, isRead: true } : item));
      persistInboxItems(nextItems);
      return nextItems;
    });
  };

  const markItemsRead = async (targetIds: string[]) => {
    if (!user?.studentNumber || !targetIds.length) return;
    const uniqueIds = [...new Set(targetIds)];
    const results = await Promise.all(uniqueIds.map((id) => markStudentNotificationRead(user.studentNumber, id)));
    const readIds = new Set(uniqueIds.filter((_, index) => results[index]?.ok));
    if (!readIds.size) return;
    setItems((current) => {
      const nextItems = current.map((entry) => (readIds.has(entry.id) ? { ...entry, isRead: true } : entry));
      persistInboxItems(nextItems);
      return nextItems;
    });
  };

  const handleOpenThread = async (thread: AdminMessageThread) => {
    setActiveThreadKey(thread.key);
    setRemoteThreadMessages(null);
    setRemoteThreadPhoto(thread.photoUrl || "");
    const threadId =
      thread.counselorId ||
      (thread.key.startsWith("id:") ? thread.key.slice(3) : "") ||
      (thread.latest.metadata?.thread ? String(thread.latest.id) : "");
    if (threadId) {
      const result = await fetchStudentMessageThread(threadId);
      if (result.ok && result.thread?.messages?.length) {
        const mapped: AppNotification[] = result.thread.messages.map((entry) => ({
          createdAt: entry.createdAt,
          id: entry.id,
          isRead: entry.isRead ?? true,
          kind: "ADMIN_MESSAGE",
          message: entry.body,
          metadata: {
            counselorId: result.thread?.counselorId || threadId,
            counselorName: result.thread?.counselorName || thread.displayName,
            from: entry.from,
            pictureUrl: result.thread?.pictureUrl || result.thread?.photoUrl,
          },
          timeLabel: "",
          title: result.thread?.counselorName || thread.displayName,
        }));
        mapped.sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
        setRemoteThreadMessages(mapped);
        if (result.thread.pictureUrl || result.thread.photoUrl) {
          setRemoteThreadPhoto(result.thread.pictureUrl || result.thread.photoUrl || "");
        }
      }
      await markStudentMessageThreadRead(threadId);
    }
    const unreadIds = thread.messages.filter((item) => !item.isRead).map((item) => item.id);
    const threadItemIds = new Set(thread.messages.map((item) => item.id));
    setItems((current) => {
      const nextItems = current.map((entry) =>
        threadItemIds.has(entry.id) || (threadId && entry.id === threadId) ? { ...entry, isRead: true } : entry,
      );
      persistInboxItems(nextItems);
      return nextItems;
    });
    await markItemsRead(unreadIds);
  };

  const handleOpenNotification = async (item: AppNotification) => {
    if (!user?.studentNumber) return;
    if (!item.isRead) {
      await markItemsRead([item.id]);
    }

    const targetRoute = getNotificationRoute(item);
    if (targetRoute) {
      router.push(targetRoute as never);
      return;
    }

    router.push({
      pathname: "/notification-view",
      params: {
        createdAt: item.createdAt,
        kind: item.kind,
        message: item.message,
        timeLabel: item.timeLabel,
        title: item.title,
      },
    });
  };

  const handleConfirmDelete = async () => {
    if (!user?.studentNumber || !pendingDelete) return;

    if (pendingDelete.type === "item") {
      const result = await deleteStudentNotification(user.studentNumber, pendingDelete.id);
      if (result.ok) {
        setItems((current) => {
          const nextItems = current.filter((item) => item.id !== pendingDelete.id);
          persistInboxItems(nextItems);
          return nextItems;
        });
      }
      setPendingDelete(null);
      return;
    }

    const thread = messageThreads.find((entry) => entry.key === pendingDelete.key);
    const ids = thread?.messages.map((item) => item.id) ?? [];
    if (ids.length) {
      const results = await Promise.all(ids.map((id) => deleteStudentNotification(user.studentNumber, id)));
      const deletedIds = new Set(ids.filter((_, index) => results[index]?.ok));
      if (deletedIds.size) {
        setItems((current) => {
          const nextItems = current.filter((item) => !deletedIds.has(item.id));
          persistInboxItems(nextItems);
          return nextItems;
        });
      }
    }
    if (activeThreadKey === pendingDelete.key) {
      setActiveThreadKey(null);
    }
    setPendingDelete(null);
  };

  const renderNotificationCard = (item: AppNotification) => {
    const visual = getNotificationVisual(item.kind);
    return (
      <Swipeable
        key={item.id}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable style={styles.deleteSwipeAction} onPress={() => setPendingDelete({ type: "item", id: item.id })}>
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
            <Text style={styles.deleteSwipeText}>Delete</Text>
          </Pressable>
        )}
      >
        <Pressable
          style={[
            styles.itemCard,
            {
              borderColor: item.isRead ? "#E6EAF0" : visual.chip,
              backgroundColor: item.isRead ? "#FFFFFF" : visual.surface,
            },
            item.isRead && styles.itemCardRead,
          ]}
          onPress={() => void handleOpenNotification(item)}
        >
          <View style={styles.itemRow}>
            <View style={[styles.itemIconWrap, { backgroundColor: visual.chip }]}>
              {visual.usesTalaLogo ? (
                <Image source={TALA_IMAGE} style={styles.itemTalaIcon} resizeMode="contain" />
              ) : (
                <Ionicons name={visual.icon} size={18} color={visual.accent} />
              )}
            </View>

            <View style={styles.itemTextWrap}>
              <View style={styles.itemTopRow}>
                <Text style={[styles.itemTitle, item.isRead && styles.itemTextRead]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.itemTimePill}>
                  <Text style={styles.itemTime}>{item.timeLabel}</Text>
                </View>
              </View>

              <View style={styles.itemMetaRow}>
                <View style={[styles.itemKindChip, { backgroundColor: visual.chip }]}>
                  <Text style={[styles.itemKindText, { color: visual.accent }]}>{visual.label}</Text>
                </View>
                {!item.isRead ? <View style={[styles.itemUnreadDot, { backgroundColor: visual.accent }]} /> : null}
              </View>

              <Text style={[styles.itemMessage, item.isRead && styles.itemTextRead]} numberOfLines={3}>
                {item.message}
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  const renderCounselorAvatar = (name: string, photoUrl?: string, unread = false) => {
    if (photoUrl) {
      return <Image source={{ uri: photoUrl }} style={[styles.avatarImage, unread && styles.avatarUnreadRing]} />;
    }
    return (
      <View style={[styles.avatarFallback, unread && styles.avatarUnreadRing]}>
        <Text style={styles.avatarInitials}>{getAdminMessageInitials(name)}</Text>
      </View>
    );
  };

  const renderThreadCard = (thread: AdminMessageThread) => {
    const visual = getNotificationVisual(thread.latest.kind);
    const isUnread = thread.unreadCount > 0;
    return (
      <Swipeable
        key={thread.key}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable style={styles.deleteSwipeAction} onPress={() => setPendingDelete({ type: "thread", key: thread.key })}>
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
            <Text style={styles.deleteSwipeText}>Delete</Text>
          </Pressable>
        )}
      >
        <Pressable
          style={[
            styles.itemCard,
            {
              borderColor: isUnread ? "#B7D8C4" : "#E6EAF0",
              backgroundColor: isUnread ? "#F4FBF6" : "#FFFFFF",
            },
            isUnread ? styles.itemCardUnread : styles.itemCardRead,
          ]}
          onPress={() => void handleOpenThread(thread)}
        >
          <View style={styles.itemRow}>
            {renderCounselorAvatar(thread.displayName, thread.photoUrl, isUnread)}
            <View style={styles.itemTextWrap}>
              <View style={styles.itemTopRow}>
                <Text
                  style={[styles.itemTitle, isUnread ? styles.itemTitleUnread : styles.itemTextRead]}
                  numberOfLines={1}
                >
                  {thread.displayName}
                </Text>
                <View style={styles.itemTimePill}>
                  <Text style={styles.itemTime}>{thread.latest.timeLabel || getNotificationDateTimeLabel(thread.latest)}</Text>
                </View>
              </View>
              <View style={styles.itemMetaRow}>
                {thread.actorRole ? (
                  <View style={[styles.itemKindChip, { backgroundColor: visual.chip }]}>
                    <Text style={[styles.itemKindText, { color: visual.accent }]}>{thread.actorRole}</Text>
                  </View>
                ) : null}
                {isUnread ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{thread.unreadCount > 9 ? "9+" : String(thread.unreadCount)}</Text>
                  </View>
                ) : (
                  <Text style={styles.readHint}>Read</Text>
                )}
                {isUnread ? <View style={[styles.itemUnreadDot, { backgroundColor: visual.accent }]} /> : null}
              </View>
              <Text style={[styles.itemMessage, !isUnread && styles.itemTextRead]} numberOfLines={2}>
                {thread.latest.message}
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  const deleteMessage =
    pendingDelete?.type === "thread"
      ? "Delete this conversation?"
      : isMessageInbox
        ? "Delete this message?"
        : "Delete this notification?";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#34424F" />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {showingThread ? activeThread?.displayName ?? topTitle : topTitle}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      {showingThread ? null : (
        <View style={styles.summaryWrap}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: summarySurface, borderColor: summaryChip },
            ]}
          >
            <View style={[styles.summaryIconBubble, { backgroundColor: "#FFFFFF" }]}>
              <Ionicons name={summaryIcon} size={20} color={summaryAccent} />
            </View>

            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryTitle}>
                {unreadCount
                  ? `${unreadCount} unread ${unreadCount === 1 ? (isMessageInbox ? "message" : "update") : isMessageInbox ? "messages" : "updates"}`
                  : isMessageInbox
                    ? "Your inbox is quiet"
                    : "You're all caught up"}
              </Text>
              <Text style={styles.summaryBody}>{summaryBody}</Text>
            </View>
          </View>

          {!isMessageInbox ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              style={styles.filterScroll}
            >
              {NOTIFICATION_FILTERS.map((filter) => {
                const isActive = notificationFilter === filter.key;
                return (
                  <Pressable
                    key={filter.key}
                    style={[styles.filterButton, isActive && styles.filterButtonActive]}
                    onPress={() => setNotificationFilter(filter.key)}
                  >
                    <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>{filter.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={styles.dayRow}>
            <Text style={styles.dayLabel}>{isMessageInbox ? "Conversations" : "Recent"}</Text>
            <Pressable
              style={[styles.markAsReadButton, unreadCount === 0 && styles.markAsReadButtonDisabled]}
              onPress={() => void handleMarkAllAsRead()}
              disabled={unreadCount === 0}
            >
              <Ionicons name="checkbox-outline" size={15} color={unreadCount === 0 ? "#9CA6AE" : summaryAccent} />
              <Text style={[styles.markAsReadText, unreadCount === 0 && styles.markAsReadTextDisabled, unreadCount > 0 && { color: summaryAccent }]}>
                Mark All as Read
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#6FAE46" />
        </View>
      ) : showingThread && activeThread ? (
        <ScrollView
          ref={threadScrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.threadScrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => threadScrollRef.current?.scrollToEnd({ animated: false })}
        >
          {threadMessages.map((item, index) => {
            const outgoing = isOutgoingAdminMessage(item);
            const dateLabel = getNotificationDateSeparator(item);
            const previousDate = index > 0 ? getNotificationDateSeparator(threadMessages[index - 1]) : "";
            const showDate = Boolean(dateLabel && dateLabel !== previousDate);
            return (
              <View key={item.id}>
                {showDate ? (
                  <View style={styles.dateSeparator}>
                    <Text style={styles.dateSeparatorText}>{dateLabel}</Text>
                  </View>
                ) : null}
                <Swipeable
                  overshootRight={false}
                  renderRightActions={() => (
                    <Pressable style={styles.deleteSwipeAction} onPress={() => setPendingDelete({ type: "item", id: item.id })}>
                      <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.deleteSwipeText}>Delete</Text>
                    </Pressable>
                  )}
                >
                  <View style={[styles.bubbleRow, outgoing && styles.bubbleRowOutgoing]}>
                    {outgoing ? null : renderCounselorAvatar(activeThread.displayName, remoteThreadPhoto || activeThread.photoUrl)}
                    <View
                      style={[
                        styles.bubbleCard,
                        outgoing ? styles.bubbleOutgoing : styles.bubbleIncoming,
                        !item.isRead && !outgoing && styles.bubbleUnread,
                      ]}
                    >
                      <Text style={[styles.bubbleBody, outgoing && styles.bubbleBodyOutgoing]}>{item.message}</Text>
                      <View style={styles.bubbleMetaRow}>
                        <Text style={[styles.bubbleTime, outgoing && styles.bubbleTimeOutgoing]}>
                          {getNotificationTimeOnlyLabel(item) || getNotificationDateTimeLabel(item) || item.timeLabel}
                        </Text>
                        {!item.isRead && !outgoing ? <Text style={styles.bubbleUnreadLabel}>New</Text> : null}
                      </View>
                    </View>
                  </View>
                </Swipeable>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {isMessageInbox ? (
            messageThreads.length ? (
              messageThreads.map((thread) => renderThreadCard(thread))
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBubble}>
                  <Ionicons name={emptyIcon} size={24} color="#7AA85C" />
                </View>
                <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                <Text style={styles.emptyText}>{emptyText}</Text>
              </View>
            )
          ) : visibleItems.length ? (
            visibleItems.map((item) => renderNotificationCard(item))
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBubble}>
                <Ionicons name={emptyIcon} size={24} color="#7AA85C" />
              </View>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          )}
        </ScrollView>
      )}

      <ConfirmationModal
        visible={Boolean(pendingDelete)}
        message={deleteMessage}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmTone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF5",
  },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E7DD",
    backgroundColor: "rgba(250, 252, 249, 0.98)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#33475C",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },
  summaryWrap: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    shadowColor: "#6B7B69",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  summaryIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryTitle: {
    color: "#2F4656",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  summaryBody: {
    color: "#55706B",
    fontSize: 13,
    lineHeight: 18,
  },
  dayRow: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
  },
  filterScroll: {
    marginTop: 12,
  },
  filterRow: {
    flexDirection: "row",
    columnGap: 8,
    paddingRight: 12,
  },
  filterButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDE9D5",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: {
    borderColor: "#6FAE46",
    backgroundColor: "#EAF7DD",
  },
  filterButtonText: {
    color: "#65746C",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  filterButtonTextActive: {
    color: "#4B7F34",
  },
  dayLabel: {
    color: "#324254",
    fontSize: 16.5,
    lineHeight: 22,
    fontWeight: "700",
    flexShrink: 1,
  },
  markAsReadButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE9D5",
  },
  markAsReadButtonDisabled: {
    backgroundColor: "#F5F7F8",
    borderColor: "#E4E8EB",
  },
  markAsReadText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  markAsReadTextDisabled: {
    color: "#9CA6AE",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 28,
    rowGap: 10,
  },
  threadScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 28,
    rowGap: 10,
  },
  itemCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#6B7781",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  itemCardRead: {
    shadowOpacity: 0.04,
  },
  itemCardUnread: {
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  itemTitleUnread: {
    color: "#24384A",
    fontWeight: "800",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#DCE8DF",
    marginTop: 1,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#4F7D63",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  avatarUnreadRing: {
    borderWidth: 2,
    borderColor: "#6FAE46",
  },
  readHint: {
    color: "#8A969E",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  dateSeparator: {
    alignSelf: "center",
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#E6F4EA",
  },
  dateSeparatorText: {
    color: "#4F7D63",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    columnGap: 8,
    marginBottom: 2,
  },
  bubbleRowOutgoing: {
    justifyContent: "flex-end",
  },
  bubbleIncoming: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E6F4EA",
  },
  bubbleOutgoing: {
    alignSelf: "flex-end",
    backgroundColor: "#4F7D63",
    borderColor: "#4F7D63",
  },
  bubbleUnread: {
    borderColor: "#6FAE46",
    backgroundColor: "#F4FBF6",
  },
  bubbleBodyOutgoing: {
    color: "#FFFFFF",
  },
  bubbleMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  bubbleTimeOutgoing: {
    color: "#E6F4EA",
  },
  bubbleUnreadLabel: {
    color: "#4F7D63",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  deleteSwipeAction: {
    width: 92,
    borderRadius: 20,
    backgroundColor: "#D85B5B",
    alignItems: "center",
    justifyContent: "center",
    rowGap: 4,
    marginLeft: 10,
  },
  deleteSwipeText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
  },
  itemIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  itemTalaIcon: {
    width: 25,
    height: 25,
  },
  itemTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 8,
    rowGap: 6,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  itemTimePill: {
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    backgroundColor: "#F4F7F8",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTime: {
    color: "#5F6C74",
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "700",
  },
  itemTitle: {
    color: "#33475B",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    flexGrow: 1,
    flexShrink: 1,
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  itemKindChip: {
    minHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  itemKindText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  itemUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  unreadBadge: {
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: "#4F7D63",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  itemMessage: {
    color: "#384A5E",
    fontSize: 14,
    lineHeight: 20,
  },
  itemTextRead: {
    color: "#647280",
  },
  bubbleCard: {
    maxWidth: "78%",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleBody: {
    color: "#33475B",
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTime: {
    color: "#6A7A72",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6ECF0",
  },
  emptyIconBubble: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#F0F8E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#324254",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyText: {
    color: "#647280",
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
  },
});
