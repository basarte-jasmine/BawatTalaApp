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
}: PasswordFieldProps) {
  return (
    <FormTextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={!showPassword}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      containerStyle={containerStyle}
      inputWrapStyle={[styles.wrap, inputWrapStyle]}
      inputStyle={inputStyle}
      rightAdornment={
        <Pressable style={styles.eyeButton} onPress={onToggleVisibility}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color="#1D1D1D" />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
  },
  eyeButton: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
