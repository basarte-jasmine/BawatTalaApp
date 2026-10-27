import React, { type ErrorInfo, type ReactNode } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  children: ReactNode;
};

type State = {
  error?: Error | null;
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Mobile UI render crash:", error, info);
  }

  handleReload = () => {
    this.setState({ error: null, hasError: false });
  };

  handleGoHome = () => {
    this.setState({ error: null, hasError: false });
    try {
      router.replace("/home");
    } catch {}
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <View style={styles.card}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>
              {this.state.error?.message ? String(this.state.error.message) : "This screen hit an unexpected error. Try again to continue using Bawat Tala."}
            </Text>
            <View style={styles.buttonRow}>
              <Pressable style={[styles.button, styles.secondaryButton]} onPress={this.handleGoHome}>
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Go Home</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={this.handleReload}>
                <Text style={styles.buttonText}>Try again</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7FAF4",
    paddingHorizontal: 22,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: "#525C67",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    color: "#1F2A24",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    color: "#52606C",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Outfit-Medium",
    textAlign: "center",
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  button: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: "#EEF6EB",
  },
  secondaryButtonText: {
    color: "#203426",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Outfit-Bold",
  },
});
