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
      <View style={[styles.photo, { borderRadius: radius, height: size, width: size }]}>
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
      {frameSource ? <Image source={frameSource} resizeMode="contain" style={[styles.frame, { height: size * 1.24, width: size * 1.24, left: size * -0.12, top: size * -0.12 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center" },
  photo: { alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "#EEF3EF" },
  frame: { position: "absolute" },
});
