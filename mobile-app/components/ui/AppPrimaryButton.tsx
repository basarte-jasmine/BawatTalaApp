import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

type AppPrimaryButtonProps = {
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  loading?: boolean;
} & PressableProps;

export function AppPrimaryButton({
  label,
  containerStyle,
  labelStyle,
  loading = false,
  disabled,
  ...props
}: AppPrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      style={[
        styles.button,
        containerStyle,
        isDisabled && styles.buttonDisabled,
      ]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...props}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
          <Text style={[styles.label, labelStyle]}>{label}</Text>
        </View>
      ) : (
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      )}
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
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    marginRight: 8,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
