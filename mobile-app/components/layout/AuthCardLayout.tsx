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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          centerContent && styles.centeredContent,
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
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
    backgroundColor: "#FFFFFF",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  centeredContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 320,
  },
});
