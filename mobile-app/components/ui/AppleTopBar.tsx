import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type AppleTopBarProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  intensity?: number;
  tint?: "light" | "dark" | "default";
};

export function AppleTopBar({
  title,
  subtitle,
  onBack,
  rightAction,
  intensity = 85,
  tint = "light",
}: AppleTopBarProps) {
  const insets = useSafeAreaInsets();
  const backBtnScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(backBtnScale, {
      toValue: 0.9,
      damping: 14,
      stiffness: 340,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handlePressOut = () => {
    Animated.spring(backBtnScale, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const handleBackPress = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const navBarHeight = Math.max(insets.top, 14) + 48;

  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={[
        styles.floatingBar,
        {
          paddingTop: Math.max(insets.top, 12),
          height: navBarHeight,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: backBtnScale }] }}>
        <Pressable
          style={styles.circleButton}
          onPress={handleBackPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </Pressable>
      </Animated.View>

      <View style={styles.titleCenterWrap}>
        <Text style={styles.titleText} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitleText} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightAction ? (
        <View style={styles.rightActionWrap}>{rightAction}</View>
      ) : (
        <View style={styles.placeholderSpacer} />
      )}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  floatingBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "rgba(255, 255, 255, 0.76)",
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  titleCenterWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  titleText: {
    color: "#0F172A",
    fontSize: 16.5,
    lineHeight: 21,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  subtitleText: {
    color: "#64748B",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-Medium",
    marginTop: 1,
    textAlign: "center",
  },
  rightActionWrap: {
    minWidth: 38,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  placeholderSpacer: {
    width: 38,
    height: 38,
  },
});
