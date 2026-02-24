import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

type SelectFieldProps = {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  valueStyle?: StyleProp<TextStyle>;
};

export function SelectField({
  label,
  value,
  options,
  onSelect,
  placeholder = "Select",
  disabled = false,
  containerStyle,
  labelStyle,
  valueStyle,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={containerStyle}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <Pressable
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
      >
        <Text style={[styles.value, !value && styles.placeholder, valueStyle]}>
          {value || placeholder}
        </Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option}
                  style={styles.option}
                  onPress={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: "#111111",
    fontSize: 10,
    marginBottom: 6,
  },
  trigger: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    justifyContent: "center",
    marginBottom: 14,
  },
  triggerDisabled: {
    backgroundColor: "#F3F3F3",
  },
  value: {
    fontSize: 14,
    color: "#111111",
  },
  placeholder: {
    color: "#8D8D8D",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    maxHeight: 360,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7D7D7",
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  optionText: {
    color: "#111111",
    fontSize: 14,
  },
});
