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

const FRAME_SCALE = 1.38;

export function StudentProfileAvatar({
  iconColor = "#4A4A4A",
  iconSize,
  imageUrl,
  frameSource,
  size,
  style }: StudentProfileAvatarProps) {
  const hasFrame = Boolean(frameSource);
  const outerSize = hasFrame ? Math.round(size * FRAME_SCALE) : size;
  const radius = size / 2;
  const photoOffset = hasFrame ? (outerSize - size) / 2 : 0;

  return (
    <View
      style={[
        styles.container,
        { height: outerSize, width: outerSize },
        !hasFrame ? style : undefined,
      ]}
    >
      <View
        style={[
          styles.photo,
          {
            borderRadius: radius,
            height: size,
            width: size,
            left: photoOffset,
            top: photoOffset,
          },
          hasFrame ? undefined : style,
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
      {frameSource ? (
        <Image
          source={frameSource}
          resizeMode="contain"
          style={[styles.frame, { height: outerSize, width: outerSize }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  photo: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#EEF3EF",
  },
  frame: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
