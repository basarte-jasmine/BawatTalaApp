import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

const TALA_STAR_IMAGE = require("../../assets/images/Tala_Star.png");

type TalaRewardModalProps = {
  buttonLabel?: string;
  message: string;
  onClose: () => void;
  rewardTala: number;
  title: string;
  visible: boolean;
};

/** Consistent acknowledgement for every action that awards Tala. */
export function TalaRewardModal({ buttonLabel = "Continue", message, onClose, rewardTala, title, visible }: TalaRewardModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Image source={TALA_STAR_IMAGE} style={styles.starImage} contentFit="contain" cachePolicy="memory-disk" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.rewardPill}><Text style={styles.rewardPillText}>+{rewardTala} Tala</Text></View>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(22, 35, 29, 0.48)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  card: { width: "100%", maxWidth: 312, borderRadius: 22, backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, alignItems: "center", shadowColor: "#304030", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6, borderWidth: 1, borderColor: "#E1EDE0" },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFF9E6", alignItems: "center", justifyContent: "center", marginBottom: 10, borderWidth: 1, borderColor: "#FBE69B" },
  starImage: { width: 36, height: 36 },
  title: { fontFamily: "Outfit-Bold", fontSize: 18, lineHeight: 23, color: "#1B321F", textAlign: "center", marginBottom: 6 },
  rewardPill: { backgroundColor: "#ECF8E7", borderColor: "#B8E2A2", borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, marginBottom: 10 },
  rewardPillText: { fontFamily: "Outfit-Bold", fontSize: 14, lineHeight: 18, color: "#2D6824" },
  message: { fontFamily: "Outfit-Regular", fontSize: 13, lineHeight: 19, color: "#4B614E", textAlign: "center", marginBottom: 16 },
  button: { width: "100%", minHeight: 46, borderRadius: 999, backgroundColor: "#73CD44", alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: "Outfit-Bold", fontSize: 14, lineHeight: 19, color: "#FFFFFF" },
});
