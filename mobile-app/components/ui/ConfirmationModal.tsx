import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ConfirmationModalProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmTone?: "danger" | "primary";
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
};

export function ConfirmationModal({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmTone = "primary",
  message,
  onCancel,
  onConfirm,
  visible,
}: ConfirmationModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalBody}>{message}</Text>

          <View style={styles.modalActions}>
            <Pressable style={styles.modalSecondaryButton} onPress={onCancel}>
              <Text style={styles.modalSecondaryText}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              style={[styles.modalConfirmButton, confirmTone === "danger" ? styles.modalConfirmButtonDanger : styles.modalConfirmButtonPrimary]}
              onPress={onConfirm}
            >
              <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 17,
    lineHeight: 24,
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
  modalConfirmButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmButtonPrimary: {
    backgroundColor: "#79C943",
  },
  modalConfirmButtonDanger: {
    backgroundColor: "#D85B5B",
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
