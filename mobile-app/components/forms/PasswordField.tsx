import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleProp, StyleSheet, TextStyle, ViewStyle } from "react-native";
import { FormTextInput } from "./FormTextInput";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputWrapStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  editable?: boolean;
};

export function PasswordField({
  label,
  value,
  onChangeText,
  showPassword,
  onToggleVisibility,
  placeholder,
  placeholderTextColor,
  containerStyle,
  inputWrapStyle,
  inputStyle,
  editable }: PasswordFieldProps) {
  return (
    <FormTextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={!showPassword}
      editable={editable}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      containerStyle={containerStyle}
      inputWrapStyle={[styles.wrap, inputWrapStyle]}
      inputStyle={inputStyle}
      rightAdornment={
        <Pressable
          style={styles.eyeButton}
          onPress={onToggleVisibility}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          hitSlop={8}
        >
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#556677" />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8 },
  eyeButton: {
    width: 36,
    alignItems: "center",
    justifyContent: "center" } });
