import { useMemo, useRef } from "react";
import { StyleProp, StyleSheet, TextInput, View, ViewStyle } from "react-native";

type OtpCodeInputProps = {
  length: number;
  value: string;
  onChangeCode: (value: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
};

export function OtpCodeInput({
  length,
  value,
  onChangeCode,
  containerStyle,
  boxStyle,
}: OtpCodeInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const digits = useMemo(
    () => Array.from({ length }, (_v, i) => value[i] ?? ""),
    [length, value],
  );

  const handleDigitChange = (index: number, rawValue: string) => {
    const numeric = rawValue.replace(/\D/g, "");
    const current = Array.from({ length }, (_v, i) => value[i] ?? "");

    if (!numeric) {
      current[index] = "";
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
          maxLength={1}
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
    marginBottom: 14,
  },
  box: {
    width: 34,
    height: 42,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 16,
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },
});
