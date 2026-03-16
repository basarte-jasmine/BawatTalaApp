import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

type StepProgressProps = {
  total: number;
  current: number;
  containerStyle?: StyleProp<ViewStyle>;
};

export function StepProgress({ total, current, containerStyle }: StepProgressProps) {
  return (
    <View style={[styles.row, containerStyle]}>
      {Array.from({ length: total }, (_, index) => {
        const isActive = index + 1 === current;
        return <View key={`step-${index + 1}`} style={[styles.pill, isActive && styles.pillActive]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignSelf: "center",
    gap: 3,
  },
  pill: {
    width: 20,
    height: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#6F7A57",
    backgroundColor: "#FFFFFF",
  },
  pillActive: {
    backgroundColor: "#334E16",
  },
});
