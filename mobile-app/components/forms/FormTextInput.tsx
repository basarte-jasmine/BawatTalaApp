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
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: "#535353",
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111111",
    marginBottom: 12,
  },
  inputWrap: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: "#535353",
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  inputField: {
    flex: 1,
    fontSize: 13,
    color: "#111111",
    paddingVertical: 8,
  },
});
