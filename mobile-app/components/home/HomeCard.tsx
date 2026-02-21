import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

type HomeCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function HomeCard({ children, style }: HomeCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    backgroundColor: "#F7F7F7",
    shadowColor: "#A0A0A0",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
