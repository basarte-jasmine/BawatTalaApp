import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type StudentProfileAvatarProps = {
  iconColor?: string;
  iconSize?: number;
  imageUrl?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
};

export function StudentProfileAvatar({
  iconColor = "#4A4A4A",
  iconSize,
  imageUrl,
  size,
  style,
}: StudentProfileAvatarProps) {
  const radius = size / 2;

  return (
    <View
      style={[
        styles.container,
        { borderRadius: radius, height: size, width: size },
        style,
      ]}
    >
      {imageUrl ? (
        <Image
          accessibilityLabel="Student profile picture"
          resizeMode="cover"
          source={{ uri: imageUrl }}
          style={{ borderRadius: radius, height: size, width: size }}
        />
      ) : (
        <Ionicons name="person-outline" size={iconSize ?? size * 0.58} color={iconColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
