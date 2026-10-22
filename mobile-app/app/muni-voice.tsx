import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function MuniVoiceScreen() {
  useEffect(() => {
    router.replace("/home?voice=1");
  }, []);

  return <View style={{ flex: 1, backgroundColor: "#F7FAF6" }} />;
}
