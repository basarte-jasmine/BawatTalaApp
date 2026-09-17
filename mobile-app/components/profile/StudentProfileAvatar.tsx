import { Ionicons } from "@expo/vector-icons";
import { Image, ImageSourcePropType, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type StudentProfileAvatarProps = {
  iconColor?: string;
  iconSize?: number;
  imageUrl?: string | null;
  frameSource?: ImageSourcePropType | null;
  size: number;
  style?: StyleProp<ViewStyle>;
};

export function StudentProfileAvatar({
  iconColor = "#4A4A4A",
  iconSize,
  imageUrl,
  frameSource,
  size,
  style }: StudentProfileAvatarProps) {
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
      {frameSource ? <Image source={frameSource} resizeMode="contain" style={[styles.frame, { height: size, width: size }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden" },
  frame: { position: "absolute", top: 0, left: 0 },
});
