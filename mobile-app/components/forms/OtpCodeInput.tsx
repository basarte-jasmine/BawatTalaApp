import { useMemo, useRef } from "react";
import { StyleProp, StyleSheet, TextInput, TextStyle, View, ViewStyle } from "react-native";

type OtpCodeInputProps = {
  length: number;
  value: string;
  onChangeCode: (value: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<TextStyle>;
};

export function OtpCodeInput({
  length,
  value,
  onChangeCode,
  containerStyle,
  boxStyle }: OtpCodeInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const digits = useMemo(
    () => Array.from({ length }, (_v, i) => value[i] ?? ""),
    [length, value],
  );

  const handleDigitChange = (index: number, rawValue: string) => {
    const numeric = rawValue.replace(/\D/g, "");
    const current = Array.from({ length }, (_v, i) => value[i] ?? "");
    const hadDigit = Boolean(current[index]);

    if (!numeric) {
      current[index] = "";
      // Android often skips onKeyPress when the box is already empty — treat
      // an empty change on an empty box as backspace into the previous digit.
      if (!hadDigit && index > 0) {
        current[index - 1] = "";
        onChangeCode(current.join(""));
        inputRefs.current[index - 1]?.focus();
        return;
      }
      onChangeCode(current.join(""));
      return;
    }

    if (numeric.length > 1) {
      for (let i = 0; i < numeric.length && index + i < length; i += 1) {
        current[index + i] = numeric[i];
      }
      onChangeCode(current.join(""));
      const nextIndex = Math.min(index + numeric.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    current[index] = numeric;
    onChangeCode(current.join(""));
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key !== "Backspace") return;
    const currentDigit = value[index] ?? "";
    if (!currentDigit && index > 0) {
      const current = Array.from({ length }, (_v, i) => value[i] ?? "");
      current[index - 1] = "";
      onChangeCode(current.join(""));
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={[styles.row, containerStyle]}>
      {digits.map((digit, index) => (
        <TextInput
          key={`otp-digit-${index}`}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          value={digit}
          onChangeText={(text) => handleDigitChange(index, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          // Empty box accepts a paste of the full code; filled box is 1 digit.
          maxLength={digit ? 1 : length}
          style={[styles.box, boxStyle]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12 },
  box: {
    width: 32,
    height: 38,
    borderWidth: 1,
    borderColor: "#535353",
    borderRadius: 7,
    textAlign: "center",
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#FFFFFF" } });
