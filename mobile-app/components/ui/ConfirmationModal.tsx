import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ConfirmationModalProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmTone?: "danger" | "primary";
  title?: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  isConfirming?: boolean;
};

export function ConfirmationModal({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmTone = "primary",
  title,
  message,
  onCancel,
  onConfirm,
  visible,
  secondaryActionLabel,
  onSecondaryAction,
  isConfirming = false }: ConfirmationModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {Boolean(title) && <Text style={styles.modalTitle}>{title}</Text>}
          <Text style={[styles.modalBody, Boolean(title) && styles.modalBodyWithTitle]}>{message}</Text>

          {secondaryActionLabel && onSecondaryAction ? (
            <View style={styles.modalActionsStacked}>
              <Pressable
                style={[
                  styles.modalConfirmButtonStacked,
                  confirmTone === "danger" ? styles.modalConfirmButtonDanger : styles.modalConfirmButtonPrimary,
                ]}
                onPress={onConfirm}
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.modalSecondaryActionButton}
                onPress={onSecondaryAction}
                disabled={isConfirming}
              >
                <Text style={styles.modalSecondaryActionText}>{secondaryActionLabel}</Text>
              </Pressable>

              <Pressable
                style={styles.modalCancelLink}
                onPress={onCancel}
                disabled={isConfirming}
              >
                <Text style={styles.modalCancelLinkText}>{cancelLabel}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={onCancel} disabled={isConfirming}>
                <Text style={styles.modalSecondaryText}>{cancelLabel}</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalConfirmButton,
                  confirmTone === "danger" ? styles.modalConfirmButtonDanger : styles.modalConfirmButtonPrimary,
                ]}
                onPress={onConfirm}
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
                )}
              </Pressable>
            </View>
          )}
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
    paddingHorizontal: 22 },
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
    elevation: 4 },
  modalTitle: {
    color: "#243324",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
    marginBottom: 6 },
  modalBody: {
    color: "#52606C",
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Outfit-SemiBold",
    textAlign: "center",
    marginBottom: 16 },
  modalBodyWithTitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5F6E7B",
    marginBottom: 18 },
  modalActions: {
    flexDirection: "row",
    columnGap: 10 },
  modalActionsStacked: {
    width: "100%",
    rowGap: 10,
    marginTop: 2 },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CDD5C7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center" },
  modalSecondaryText: {
    color: "#566271",
    fontSize: 13,
    fontFamily: "Outfit-Bold" },
  modalConfirmButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center" },
  modalConfirmButtonStacked: {
    width: "100%",
    minHeight: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center" },
  modalSecondaryActionButton: {
    width: "100%",
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CDD5C7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center" },
  modalSecondaryActionText: {
    color: "#4F5D6B",
    fontSize: 13,
    fontFamily: "Outfit-Bold" },
  modalCancelLink: {
    width: "100%",
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4 },
  modalCancelLinkText: {
    color: "#81909E",
    fontSize: 13,
    fontFamily: "Outfit-SemiBold" },
  modalConfirmButtonPrimary: {
    backgroundColor: "#79C943" },
  modalConfirmButtonDanger: {
    backgroundColor: "#D85B5B" },
  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold" } });
