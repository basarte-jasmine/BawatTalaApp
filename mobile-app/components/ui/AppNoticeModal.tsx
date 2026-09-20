import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type AppNoticeModalProps = {
  message: string;
  okLabel?: string;
  onOk: () => void;
  title: string;
  visible: boolean;
};

export function AppNoticeModal({
  message,
  okLabel = "OK",
  onOk,
  title,
  visible,
}: AppNoticeModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onOk}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalBody}>{message}</Text>
          <Pressable style={styles.modalConfirmButton} onPress={onOk}>
            <Text style={styles.modalConfirmText}>{okLabel}</Text>
          </Pressable>
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
  modalTitle: {
    color: "#1F2A24",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  modalBody: {
    color: "#52606C",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Outfit-Medium",
    textAlign: "center",
    marginBottom: 16,
  },
  modalConfirmButton: {
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#79C943",
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
});
