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
    width: 290,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#7A9EBA",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5E7D95",
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
