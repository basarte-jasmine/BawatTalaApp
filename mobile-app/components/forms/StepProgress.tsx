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
        const stepNum = index + 1;
        const isActive = stepNum === current;
        const isPast = stepNum < current;
        return (
          <View
            key={"step-" + stepNum}
            style={[
              styles.pill,
              isPast && styles.pillPast,
              isActive && styles.pillActive,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    columnGap: 5,
  },
  pill: {
    width: 14,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  pillPast: {
    backgroundColor: "#A7D7C5",
  },
  pillActive: {
    width: 28,
    backgroundColor: "#2D7D5A",
  },
});

