import { ReactNode } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

type FormTextInputProps = {
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  inputWrapStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  rightAdornment?: ReactNode;
} & TextInputProps;

export function FormTextInput({
  label,
  containerStyle,
  labelStyle,
  inputWrapStyle,
  inputStyle,
  rightAdornment,
  ...inputProps
}: FormTextInputProps) {
  const useWrappedInput = Boolean(rightAdornment);

  return (
    <View style={containerStyle}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      {useWrappedInput ? (
        <View style={[styles.inputWrap, inputWrapStyle]}>
          <TextInput style={[styles.inputField, inputStyle]} {...inputProps} />
          {rightAdornment}
        </View>
      ) : (
        <TextInput style={[styles.input, inputStyle]} {...inputProps} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: "#111111",
    fontSize: 14,
    marginBottom: 7,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#111111",
    marginBottom: 16,
  },
  inputWrap: {
    height: 44,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: "#111111",
  },
});
