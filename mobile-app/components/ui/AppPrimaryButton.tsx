import { Pressable, PressableProps, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from "react-native";

type AppPrimaryButtonProps = {
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
} & PressableProps;

export function AppPrimaryButton({ label, containerStyle, labelStyle, ...props }: AppPrimaryButtonProps) {
  return (
    <Pressable style={[styles.button, containerStyle]} {...props}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    maxWidth: 320,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4B8F22",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
