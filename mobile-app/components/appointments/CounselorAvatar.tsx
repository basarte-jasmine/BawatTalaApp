import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type CounselorAvatarProps = {
  fullName?: string | null;
  pictureUrl?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
};

function getInitials(name?: string | null) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function CounselorAvatar({ fullName, pictureUrl, size, style }: CounselorAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [pictureUrl]);

  const initials = getInitials(fullName);
  const showImage = Boolean(pictureUrl) && !imageFailed;

  return (
    <View style={[styles.avatar, { borderRadius: size / 2, height: size, width: size }, style]}>
      {showImage ? (
        <Image
          accessibilityLabel={`${fullName || "Counselor"} profile picture`}
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          source={{ uri: pictureUrl || "" }}
          style={{ height: size, width: size }}
        />
      ) : initials ? (
        <Text style={[styles.initials, { fontSize: Math.max(16, size * 0.28) }]}>{initials}</Text>
      ) : (
        <Ionicons name="person-outline" size={size * 0.48} color="#54705D" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#DDEED6",
  },
  initials: {
    color: "#41684A",
    fontWeight: "800",
  },
});
