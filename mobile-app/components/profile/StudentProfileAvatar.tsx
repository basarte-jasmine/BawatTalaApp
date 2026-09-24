import { Ionicons } from "@expo/vector-icons";
import { ImageSourcePropType, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";

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
  style,
}: StudentProfileAvatarProps) {
  const hasFrame = Boolean(frameSource);
  const outerSize = hasFrame ? Math.round(size * FRAME_SCALE) : size;
  const radius = size / 2;
  const inset = hasFrame ? Math.round((outerSize - size) / 2) : 0;
  const validImageUrl = typeof imageUrl === "string" && imageUrl.trim().length > 0 ? imageUrl.trim() : null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { height: outerSize, width: outerSize },
        !hasFrame ? style : undefined,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.photo,
          {
            borderRadius: radius,
            height: size,
            width: size,
            top: inset,
            left: inset,
            zIndex: 1,
          },
          hasFrame ? undefined : style,
        ]}
      >
        {validImageUrl ? (
          <Image
            accessibilityLabel="Student profile picture"
            contentFit="cover"
            source={{ uri: validImageUrl }}
            style={{ borderRadius: radius, height: size, width: size }}
            cachePolicy="memory-disk"
            transition={150}
            pointerEvents="none"
          />
        ) : (
          <Ionicons name="person-outline" size={iconSize ?? size * 0.58} color={iconColor} />
        )}
      </View>
      {frameSource ? (
        <Image
          source={frameSource}
          contentFit="contain"
          pointerEvents="none"
          style={[styles.frame, { height: outerSize, width: outerSize, top: 0, left: 0, zIndex: 2 }]}
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
  },
});