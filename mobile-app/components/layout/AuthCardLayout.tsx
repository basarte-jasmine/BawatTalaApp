import { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

type AuthCardLayoutProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
  centerContent?: boolean;
}>;

export function AuthCardLayout({
  children,
  contentContainerStyle,
  cardStyle,
  centerContent = true,
}: AuthCardLayoutProps) {
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // Android already resizes the window for the IME (`adjustResize`). Adding `height`
      // compensation on top squeezes the layout twice and pushes the focused field off
      // screen, which makes Android dismiss the keyboard. iOS needs `padding`.
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          centerContent && styles.centeredContent,
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, cardStyle]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FFF8",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  centeredContent: {
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
});
