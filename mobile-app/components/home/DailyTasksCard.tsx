import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import {
  createDailyTask,
  deleteDailyTask,
  fetchTaskReflectionPrompt,
  fetchTodayTasks,
  toggleDailyTask,
  type DailyTask,
  type DailyTaskProgress,
} from "../../lib/backend-api";
import { updateAvailableMuniTala } from "../../lib/muni-wardrobe";
import { ConfirmationModal } from "../ui/ConfirmationModal";

const TALA_STAR_IMAGE = require("../../assets/images/Tala_Star.png");

type DailyTasksCardProps = {
  studentNumber: string;
  currentMoodId?: string | null;
  onRefreshTriggered?: () => void;
};

type TalaRewardModalState = {
  visible: boolean;
  rewardTala: number;
  bonusClaimed: boolean;
  title: string;
  message: string;
};

export function DailyTasksCard({
  studentNumber,
  onRefreshTriggered,
}: DailyTasksCardProps) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [progress, setProgress] = useState<DailyTaskProgress>({
    tasksRewardedCount: 0,
    dailyBonusClaimed: false,
    totalRewardedTala: 0,
    maxDailyTala: 50,
    allTasksDone: false,
    completedCount: 0,
    totalTasks: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isGentleSelected, setIsGentleSelected] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "gentle">("all");

  const [pendingAction, setPendingAction] = useState<{
    action: "complete" | "uncomplete" | "delete";
    task: DailyTask;
  } | null>(null);

  const handleRequestToggle = (task: DailyTask) => {
    setPendingAction({
      action: task.completed ? "uncomplete" : "complete",
      task,
    });
  };

  const handleRequestDelete = (task: DailyTask) => {
    setPendingAction({
      action: "delete",
      task,
    });
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const { action, task } = pendingAction;
    setPendingAction(null);

    if (action === "delete") {
      await handleDeleteTask(task.id);
    } else {
      await handleToggleTask(task);
    }
  };

  const handleCancelAction = () => {
    setPendingAction(null);
  };

  // Reward Pop-up Modal State
  const [rewardModal, setRewardModal] = useState<TalaRewardModalState>({
    visible: false,
    rewardTala: 0,
    bonusClaimed: false,
    title: "",
    message: "",
  });

  const loadTasks = useCallback(async () => {
    if (!studentNumber) return;
    try {
      const res = await fetchTodayTasks(studentNumber);
      if (res.ok) {
        setTasks(res.tasks || []);
        setProgress(res.progress);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  }, [studentNumber]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useFocusEffect(
    useCallback(() => {
      void loadTasks();
    }, [loadTasks])
  );

  const handleAddTask = async () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed || isAdding || !studentNumber) return;
    if (tasks.length >= 7) {
      return;
    }

    setIsAdding(true);
    try {
      const res = await createDailyTask({
        studentNumber,
        title: trimmed,
        isGentle: isGentleSelected,
      });
      if (res.ok && res.task) {
        setTasks((prev) => [...prev, res.task!]);
        setNewTaskTitle("");
        setIsGentleSelected(false);
        void loadTasks();
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleTask = async (task: DailyTask) => {
    const nextCompleted = !task.completed;
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t))
    );

    const res = await toggleDailyTask({
      studentNumber,
      taskId: task.id,
      completed: nextCompleted,
    });

    if (res.ok) {
      if (res.task) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? res.task! : t))
        );
      }
      if (typeof res.totalTala === "number") {
        updateAvailableMuniTala(res.totalTala);
      }

      // Show celebratory reward pop-up modal when Tala is earned
      if (res.rewardTala && res.rewardTala > 0) {
        setRewardModal({
          visible: true,
          rewardTala: res.rewardTala,
          bonusClaimed: Boolean(res.bonusClaimed),
          title: res.bonusClaimed
            ? "Araw ng Tagumpay! 🎉"
            : `+${res.rewardTala} Tala Nakuha! ✨`,
          message: res.bonusClaimed
            ? "Kahanga-hanga! Natapos mo ang lahat ng iyong mga tala ngayong araw.\nNakuha mo ang buong 50/50 Tala para kay Muni!"
            : `Nakatanggap ka ng +${res.rewardTala} Tala para sa iyong natapos na gawain. Patuloy lang sa pagsulong!`,
        });
      }

      void loadTasks();
      onRefreshTriggered?.();
    } else {
      // Revert if error
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t))
      );
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await deleteDailyTask({ studentNumber, taskId });
    void loadTasks();
  };

  const handleOpenJournalReflection = async () => {
    const promptData = await fetchTaskReflectionPrompt(studentNumber);
    let reflectionDraft = promptData.prompt;

    if (!reflectionDraft) {
      const completedList = tasks.filter((t) => t.completed);
      const bullets = completedList.map((t) => `• ${t.title}`).join("\n");
      reflectionDraft = `Ngayong araw, natapos ko ang mga gawaing ito:\n${bullets || "• Munting tagumpay sa araw na ito"}\n\nMasaya ako at naglaan ako ng oras para tapusin ang mga ito nang may tiyaga at hinahon.`;
    }

    router.push({
      pathname: "/write-entry",
      params: {
        mode: "new-muni",
        initialText: reflectionDraft,
      },
    });
  };

  const filteredTasks = useMemo(() => {
    if (activeFilter === "gentle") {
      return tasks.filter((t) => t.is_gentle);
    }
    return tasks;
  }, [tasks, activeFilter]);

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <View style={styles.card}>
      <View style={styles.surfaceGlow} />

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitles}>
          <Text style={styles.eyebrow}>TASK & NOTE TRACKER</Text>
          <Text style={styles.title}>Mga Gawain at Tala</Text>
        </View>

        {/* Tala Star Progress Pill */}
        <View style={styles.talaPill}>
          <Image source={TALA_STAR_IMAGE} style={styles.talaIcon} contentFit="contain" cachePolicy="memory-disk" />
          <Text style={styles.talaText}>
            {progress.totalRewardedTala} / {progress.maxDailyTala}
          </Text>
        </View>
      </View>



      {/* Filter Tabs if there are gentle tasks */}
      {tasks.some((t) => t.is_gentle) ? (
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, activeFilter === "all" && styles.filterChipActive]}
            onPress={() => setActiveFilter("all")}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === "all" && styles.filterChipTextActive,
              ]}
            >
              Lahat ({tasks.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, activeFilter === "gentle" && styles.filterChipActive]}
            onPress={() => setActiveFilter("gentle")}
          >
            <Ionicons
              name="leaf-outline"
              size={12}
              color={activeFilter === "gentle" ? "#234B20" : "#5A7258"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                activeFilter === "gentle" && styles.filterChipTextActive,
              ]}
            >
              Magaan Lang ({tasks.filter((t) => t.is_gentle).length})
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Task List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#73CD44" />
        </View>
      ) : filteredTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="sunny-outline" size={24} color="#94A3B8" />
          <Text style={styles.emptyText}>
            {activeFilter === "gentle"
              ? "Walang magaang gawain sa listahan."
              : "Wala pang nakatalang gawain para sa araw na ito."}
          </Text>
          <Text style={styles.emptySubtext}>Maglagay ng 1 hanggang 3 munting gagawin sa ibaba.</Text>
        </View>
      ) : (
        <View style={styles.taskList}>
          {filteredTasks.map((task) => (
            <View
              key={task.id}
              style={[
                styles.taskItem,
                task.completed && styles.taskItemCompleted,
              ]}
            >
              <Pressable
                style={styles.checkboxTouch}
                onPress={() => handleRequestToggle(task)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: task.completed }}
              >
                <View style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
                  {task.completed ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : null}
                </View>

                <View style={styles.taskContent}>
                  <Text
                    style={[
                      styles.taskTitle,
                      task.completed && styles.taskTitleCompleted,
                    ]}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>

                  {task.is_gentle ? (
                    <View style={styles.gentleTag}>
                      <Ionicons name="leaf" size={10} color="#457A3B" />
                      <Text style={styles.gentleTagText}>Magaan</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>

                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleRequestDelete(task)}
                  hitSlop={8}
                  accessibilityLabel="Tanggalin ang gawain"
                >
                  <Ionicons name="close-circle-outline" size={18} color="#9BAAA0" />
                </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Add Task Input Row */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Magdagdag ng munting tala..."
          placeholderTextColor="#8A9E8D"
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={handleAddTask}
        />

        <Pressable
          style={[styles.gentleToggle, isGentleSelected && styles.gentleToggleActive]}
          onPress={() => setIsGentleSelected((prev) => !prev)}
          hitSlop={4}
        >
          <Ionicons
            name="leaf"
            size={13}
            color={isGentleSelected ? "#245220" : "#7A917D"}
            style={{ marginRight: 3 }}
          />
          <Text
            style={[
              styles.gentleToggleText,
              isGentleSelected && styles.gentleToggleTextActive,
            ]}
          >
            Magaan
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.addButton,
            (!newTaskTitle.trim() || isAdding) && styles.addButtonDisabled,
          ]}
          onPress={handleAddTask}
          disabled={!newTaskTitle.trim() || isAdding}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="add" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      {/* Idea 3: Task-to-Journal Reflection Bridge */}
      {completedCount > 0 ? (
        <Pressable
          style={styles.journalBridgeButton}
          onPress={handleOpenJournalReflection}
          accessibilityLabel="Isulat ang mga Tala sa Journal"
        >
          <View style={styles.journalBridgeLeft}>
            <View style={styles.journalBridgeIconCircle}>
              <Ionicons name="book" size={14} color="#2D4B32" />
            </View>
            <View>
              <Text style={styles.journalBridgeTitle}>Isulat ang Tagumpay sa Journal</Text>
              <Text style={styles.journalBridgeMeta}>
                Pagnilayan ang {completedCount} natapos na gawain kasama si Muni ✨
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#457A3B" />
        </Pressable>
      ) : null}

      {/* Tala Reward Pop-up Modal */}
      <Modal
        visible={rewardModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRewardModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Image source={TALA_STAR_IMAGE} style={styles.modalStarImage} contentFit="contain" cachePolicy="memory-disk" />
            </View>

            <Text style={styles.modalTitle}>{rewardModal.title}</Text>

            <View style={styles.modalRewardPill}>
              <Text style={styles.modalRewardPillText}>
                +{rewardModal.rewardTala} Tala Earned
              </Text>
            </View>

            <Text style={styles.modalMessage}>{rewardModal.message}</Text>

            <Pressable
              style={styles.modalButton}
              onPress={() => setRewardModal((prev) => ({ ...prev, visible: false }))}
            >
              <Text style={styles.modalButtonText}>Ipagpatuloy</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={Boolean(pendingAction)}
        message={
          pendingAction?.action === "delete"
            ? ("Are you sure you want to delete \"" + (pendingAction?.task.title || "") + "\"?")
            : pendingAction?.action === "uncomplete"
            ? ("Unmark \"" + (pendingAction?.task.title || "") + "\"?")
            : ("Mark \"" + (pendingAction?.task.title || "") + "\" as completed?")
        }
        confirmLabel={
          pendingAction?.action === "delete"
            ? "Delete"
            : pendingAction?.action === "uncomplete"
            ? "Unmark"
            : "Mark Done"
        }
        cancelLabel="Cancel"
        confirmTone={pendingAction?.action === "delete" ? "danger" : "primary"}
        onCancel={handleCancelAction}
        onConfirm={() => void handleConfirmAction()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6EEE7",
    overflow: "hidden",
    position: "relative",
  },
  surfaceGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(224, 245, 218, 0.28)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitles: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: "Outfit-Bold",
    fontSize: 11,
    letterSpacing: 0.8,
    color: "#5B7960",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    fontFamily: "Outfit-Bold",
    fontSize: 17,
    color: "#1E3322",
  },
  subtitle: {
    fontFamily: "Outfit-Regular",
    fontSize: 12,
    color: "#5C7560",
    marginTop: 4,
    marginBottom: 12,
  },
  talaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9E6",
    borderColor: "#FBE69B",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  talaIcon: {
    width: 15,
    height: 15,
    marginRight: 4,
  },
  talaText: {
    fontFamily: "Outfit-Bold",
    fontSize: 12,
    color: "#8C6A00",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F0F5EF",
    borderWidth: 1,
    borderColor: "#DEE8DC",
  },
  filterChipActive: {
    backgroundColor: "#DCEFCE",
    borderColor: "#B8E2A2",
  },
  filterChipText: {
    fontFamily: "Outfit-Medium",
    fontSize: 11,
    color: "#566E54",
  },
  filterChipTextActive: {
    fontFamily: "Outfit-Bold",
    color: "#214A1E",
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: "#FAFCF9",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAF1E9",
    marginBottom: 10,
  },
  emptyText: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13,
    color: "#4B614E",
    marginTop: 4,
    textAlign: "center",
  },
  emptySubtext: {
    fontFamily: "Outfit-Regular",
    fontSize: 11,
    color: "#7E9482",
    marginTop: 2,
    textAlign: "center",
  },
  taskList: {
    marginBottom: 10,
    gap: 7,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAF7",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#E4ECE2",
  },
  taskItemCompleted: {
    backgroundColor: "#F2F5F1",
    borderColor: "#DFE7DD",
    opacity: 0.78,
  },
  checkboxTouch: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#9EBC9E",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#73CD44",
    borderColor: "#73CD44",
  },
  taskContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  taskTitle: {
    fontFamily: "Outfit-Medium",
    fontSize: 13,
    color: "#223825",
    lineHeight: 18,
  },
  taskTitleCompleted: {
    textDecorationLine: "line-through",
    color: "#7A8F7D",
  },
  gentleTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2F2DE",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    gap: 3,
  },
  gentleTagText: {
    fontFamily: "Outfit-Medium",
    fontSize: 10,
    color: "#2E5825",
  },
  deleteButton: {
    padding: 4,
    marginLeft: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F7F2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE7DA",
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: "Outfit-Regular",
    fontSize: 13,
    color: "#243E28",
    paddingVertical: 4,
  },
  gentleToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E6EEE4",
    marginRight: 5,
  },
  gentleToggleActive: {
    backgroundColor: "#CEE6C5",
  },
  gentleToggleText: {
    fontFamily: "Outfit-Medium",
    fontSize: 11,
    color: "#5B745D",
  },
  gentleToggleTextActive: {
    fontFamily: "Outfit-Bold",
    color: "#1E471A",
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#73CD44",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: {
    backgroundColor: "#B4D4B0",
  },
  journalBridgeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EDF7EB",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#CDE5C8",
  },
  journalBridgeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
  },
  journalBridgeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D3ECCB",
    alignItems: "center",
    justifyContent: "center",
  },
  journalBridgeTitle: {
    fontFamily: "Outfit-Bold",
    fontSize: 13,
    color: "#214226",
  },
  journalBridgeMeta: {
    fontFamily: "Outfit-Regular",
    fontSize: 11,
    color: "#466C4C",
  },

  /* Pop-up Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 28, 20, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#304030",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "#E1EDE0",
  },
  modalIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFF9E6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FBE69B",
  },
  modalStarImage: {
    width: 44,
    height: 44,
  },
  modalTitle: {
    fontFamily: "Outfit-Bold",
    fontSize: 19,
    color: "#1B321F",
    textAlign: "center",
    marginBottom: 8,
  },
  modalRewardPill: {
    backgroundColor: "#ECF8E7",
    borderColor: "#B8E2A2",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  modalRewardPillText: {
    fontFamily: "Outfit-Bold",
    fontSize: 13,
    color: "#2D6824",
  },
  modalMessage: {
    fontFamily: "Outfit-Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#4B614E",
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    width: "100%",
    height: 44,
    borderRadius: 999,
    backgroundColor: "#73CD44",
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontFamily: "Outfit-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});
