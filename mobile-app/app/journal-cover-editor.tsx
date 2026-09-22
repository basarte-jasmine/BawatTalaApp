import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Pressable,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View} from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import ViewShot, { captureRef, type ViewShotRef } from "react-native-view-shot";
import { useAuthSession } from "../lib/auth-session";
import { loadJournalCover, persistJournalCoverPreview, saveJournalCover, type JournalCoverElement, type JournalCoverSticker } from "../lib/journal-cover";

type CoverElement = JournalCoverElement;
type StickerName = JournalCoverSticker;


const FONTS = [
  { name: "Bold", value: "Outfit-Bold" },
  { name: "Regular", value: "Outfit" },
  { name: "Classic", value: "serif" },
  { name: "Type", value: "monospace" },
];

const TEXT_COLORS = ["#FFF8E8", "#1A1A1A", "#A85D5D", "#4D6558", "#B6CDE0"];

const COLORS = [

  { name: "Sage", value: "#AFC4B1" },
  { name: "Blush", value: "#E9BFC1" },
  { name: "Sky", value: "#B6CDE0" },
  { name: "Butter", value: "#E9D8A6" },
  { name: "Lilac", value: "#C9B9D9" },
  { name: "Forest", value: "#4D6558" },
];


const IMAGE_STICKERS = {
  BirdStamp: require("../assets/images/Journal Assets/BirdStamp.webp"),
  BlueEyedGrass: require("../assets/images/Journal Assets/BlueEyedGrass.webp"),
  Cactus: require("../assets/images/Journal Assets/Cactus.webp"),
  Daffodil: require("../assets/images/Journal Assets/Daffodil.webp"),
  FlowerStamp: require("../assets/images/Journal Assets/FlowerStamp.webp"),
  LadyBugStamp: require("../assets/images/Journal Assets/LadyBugStamp.webp"),
  PinkFlower: require("../assets/images/Journal Assets/PinkFlower.webp"),
  SleepingCatStamp: require("../assets/images/Journal Assets/SleepingCatStamp.webp"),
  Turtle: require("../assets/images/Journal Assets/Turtle.webp")};

const STICKERS: { icon: StickerName; label: string; isImage?: boolean }[] = [
  
  { icon: "BirdStamp", label: "Bird", isImage: true },
  { icon: "BlueEyedGrass", label: "Grass", isImage: true },
  { icon: "Cactus", label: "Cactus", isImage: true },
  { icon: "Daffodil", label: "Daffodil", isImage: true },
  { icon: "FlowerStamp", label: "Flower", isImage: true },
  { icon: "LadyBugStamp", label: "Ladybug", isImage: true },
  { icon: "PinkFlower", label: "Pink Flower", isImage: true },
  { icon: "SleepingCatStamp", label: "Cat", isImage: true },
  { icon: "Turtle", label: "Turtle", isImage: true },
  { icon: "sparkles", label: "Sparkles" },
  { icon: "heart", label: "Heart" },
  { icon: "flower", label: "Flower" },
  { icon: "leaf", label: "Leaf" },
  { icon: "sunny", label: "Sun" },
  { icon: "star", label: "Star" },
];

const DraggableElement = ({
  element,
  isActive,
  onFocus,
  onTransformChange}: {
  element: CoverElement;
  isActive: boolean;
  onFocus: () => void;
  onTransformChange: (id: string, x: number, y: number, scale: number, rotation: number) => void;
}) => {
  const translateX = useSharedValue(element.x);
  const translateY = useSharedValue(element.y);
  const savedTranslateX = useSharedValue(element.x);
  const savedTranslateY = useSharedValue(element.y);
  const scale = useSharedValue(element.scale);
  const savedScale = useSharedValue(element.scale);
  const rotation = useSharedValue(element.rotation);
  const savedRotation = useSharedValue(element.rotation);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      runOnJS(onTransformChange)(element.id, translateX.value, translateY.value, scale.value, rotation.value);
    });
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(0.55, Math.min(2.4, savedScale.value * event.scale));
    })
    .onEnd(() => {
      runOnJS(onTransformChange)(element.id, translateX.value, translateY.value, scale.value, rotation.value);
    });
  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      savedRotation.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = savedRotation.value + event.rotation;
    })
    .onEnd(() => {
      runOnJS(onTransformChange)(element.id, translateX.value, translateY.value, scale.value, rotation.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` },
    ]}));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture)}>
      <Animated.View style={[styles.elementContainer, animatedStyle]}>
        <Pressable
          onPress={onFocus}
          style={[styles.elementTouchTarget, isActive && styles.elementSelected]}
          accessibilityRole="button"
          accessibilityLabel={element.type === "text" ? element.content : `${element.icon} sticker`}
        >
          {element.type === "text" ? (
            <Text style={[styles.textElement, { color: element.color, fontFamily: element.fontFamily || "Outfit-Bold" }]}>{element.content}</Text>
          ) : element.icon && IMAGE_STICKERS[element.icon as keyof typeof IMAGE_STICKERS] ? (
            <Image source={IMAGE_STICKERS[element.icon as keyof typeof IMAGE_STICKERS]} style={{ width: 100, height: 100 }} contentFit="contain" />
          ) : (
            <Ionicons name={element.icon as any} size={42} color="#FFF8E8" />
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};

export default function JournalCoverEditorScreen() {
  const { mode = "solo" } = useLocalSearchParams<{ mode: "muni" | "solo" }>();
  const { user } = useAuthSession();
  const { width } = useWindowDimensions();
  const [coverColor, setCoverColor] = useState(COLORS[0].value);
  const [elements, setElements] = useState<CoverElement[]>([]);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const coverShotRef = useRef<ViewShotRef>(null);

  const { height } = useWindowDimensions();
  // Make the book take up as much vertical space as possible, but cap the width
  const maxAvailableHeight = height - (showToolbar ? 420 : 180); 
  const calculatedWidth = maxAvailableHeight / 1.4;
  const bookWidth = Math.min(width - 48, Math.max(300, calculatedWidth));
  const bookHeight = bookWidth * 1.4;
  const activeElement = elements.find((element) => element.id === activeElementId);

  useEffect(() => {
    if (!user?.studentNumber) return;

    let mounted = true;
    void loadJournalCover(user.studentNumber, mode).then((design) => {
      if (!mounted || !design) return;
      setCoverColor(design.color);
      setElements(design.elements);
    });

    return () => {
      mounted = false;
    };
  }, [user?.studentNumber, mode]);

  const addText = () => {
    const id = Math.random().toString();
    setElements((current) => [
      ...current,
      { id, type: "text", content: "My Journal", color: "#FFF8E8", x: 0, y: -8, scale: 1, rotation: 0 },
    ]);
    setActiveElementId(id);
  };

  const addSticker = (icon: StickerName) => {
    const id = Math.random().toString();
    setElements((current) => [
      ...current,
      { id, type: "sticker", content: icon, icon, x: 0, y: 0, scale: 1, rotation: 0 },
    ]);
    setActiveElementId(id);
  };

  const updateElementTransform = (id: string, x: number, y: number, scale: number, rotation: number) => {
    setElements((current) => current.map((element) => (
      element.id === id ? { ...element, x, y, scale, rotation } : element
    )));
  };

  const updateActiveText = (content: string) => {
    setElements((current) => current.map((element) => (
      element.id === activeElementId ? { ...element, content } : element
    )));
  };

  
  const updateActiveTextFont = (fontFamily: string) => {
    setElements((current) => current.map((element) => (
      element.id === activeElementId ? { ...element, fontFamily } : element
    )));
  };

  const updateActiveTextColor = (color: string) => {
    setElements((current) => current.map((element) => (
      element.id === activeElementId ? { ...element, color } : element
    )));
  };

  const removeActiveElement = () => {

    if (!activeElementId) return;
    setElements((current) => current.filter((element) => element.id !== activeElementId));
    setActiveElementId(null);
  };

  const resetDesign = () => {
    setCoverColor(COLORS[0].value);
    setElements([]);
    setActiveElementId(null);
  };

  const handleSave = async () => {
    if (!user?.studentNumber || isSaving) return;

    setIsSaving(true);
    setActiveElementId(null);
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      let previewUri: string | null = null;
      try {
        if (coverShotRef.current) {
          if (Platform.OS === 'web') {
             previewUri = await captureRef(coverShotRef.current, { format: 'webp', quality: 0.88, result: 'data-uri' });
          } else {
             const temporaryPreviewUri = await captureRef(coverShotRef.current, { format: 'webp', quality: 0.88, result: 'tmpfile' });
             previewUri = await persistJournalCoverPreview(user.studentNumber, mode, temporaryPreviewUri);
          }
        }
      } catch {
      }
      await saveJournalCover(user.studentNumber, mode, {
        version: 1,
        color: coverColor,
        elements,
        previewUri});
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={23} color="#20352B" />
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>YOUR JOURNAL</Text>
          <Text style={styles.headerTitle}>Design your cover</Text>
        </View>
        <Pressable onPress={() => void handleSave()} style={styles.doneButton} accessibilityLabel="Save cover" disabled={isSaving}>
          <Ionicons name="checkmark" size={18} color="#FFF8E8" />
          <Text style={styles.doneText}>{isSaving ? "Saving" : "Done"}</Text>
        </Pressable>
      </View>

      <View style={styles.previewArea}>
        <ViewShot ref={coverShotRef} options={{ format: "webp", quality: 0.88 }} style={[styles.notebookBase, { backgroundColor: coverColor, width: bookWidth, height: bookHeight }]}>
          <View style={styles.coverHighlight} />
          <View style={styles.spine} />
          <View style={styles.spineLine} />
          <View style={styles.pageEdge} />
          <View style={styles.elementsCanvas}>
            {elements.map((element) => (
              <DraggableElement
                key={element.id}
                element={element}
                isActive={activeElementId === element.id}
                onFocus={() => setActiveElementId(element.id)}
                onTransformChange={updateElementTransform}
              />
            ))}
            {elements.length === 0 && (
              <View pointerEvents="none" style={styles.emptyCoverMessage}>
                <Ionicons name="add-circle-outline" size={30} color="rgba(255,248,232,0.7)" />
                <Text style={styles.emptyCoverText}>Start with a title or a little detail

Drag, pinch, or rotate your pieces</Text>
              </View>
            )}
          </View>
        </ViewShot>
      </View>

      
      {showToolbar ? (
        <ScrollView style={styles.toolbarContainer} contentContainerStyle={styles.toolbarContent} showsVerticalScrollIndicator={false}>
          <View style={styles.toolbarHeader}>
            <View>
              <Text style={styles.toolTitle}>Make it yours</Text>
              <Text style={styles.toolSubtitle}>Choose a mood, then add your pieces.</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={resetDesign} style={styles.iconOnlyButton} accessibilityLabel="Reset cover design">
                <Ionicons name="refresh-outline" size={20} color="#4D6558" />
              </Pressable>
              <Pressable onPress={() => setShowToolbar(false)} style={styles.iconOnlyButton} accessibilityLabel="Hide tools">
                <Ionicons name="chevron-down-outline" size={22} color="#4D6558" />
              </Pressable>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Cover color</Text>
          <View style={styles.colorRow}>
            {COLORS.map((color) => (
              <Pressable
                key={color.value}
                onPress={() => setCoverColor(color.value)}
                style={[styles.colorButton, { backgroundColor: color.value }, coverColor === color.value && styles.colorButtonActive]}
                accessibilityLabel={`Choose ${color.name} cover`}
                accessibilityRole="button"
              />
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Add to cover</Text>
            <Pressable onPress={addText} style={styles.textToolButton} accessibilityLabel="Add title text">
              <Ionicons name="text-outline" size={18} color="#FFF8E8" />
              <Text style={styles.textToolLabel}>Title</Text>
            </Pressable>
          </View>
          <View style={styles.stickerRow}>
            {STICKERS.map((sticker) => (
              <Pressable key={sticker.icon} onPress={() => addSticker(sticker.icon)} style={styles.stickerButton} accessibilityLabel={`Add ${sticker.label} sticker`}>
                {sticker.isImage ? (
                  <Image source={IMAGE_STICKERS[sticker.icon as keyof typeof IMAGE_STICKERS]} style={{ width: 30, height: 30 }} contentFit="contain" />
                ) : (
                  <Ionicons name={sticker.icon as any} size={23} color="#4D6558" />
                )}
              </Pressable>
            ))}
          </View>

          {activeElement?.type === "text" && (
            <View style={styles.editPanel}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Edit title</Text>
                <Pressable onPress={removeActiveElement} accessibilityLabel="Delete selected element" hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color="#A85D5D" />
                </Pressable>
              </View>
              <TextInput
                value={activeElement.content}
                onChangeText={updateActiveText}
                maxLength={28}
                style={styles.titleInput}
                placeholder="Type a title"
                placeholderTextColor="#9BA89F"
                accessibilityLabel="Cover title"
              />
              
              <Text style={[styles.sectionLabel, { marginTop: 12, marginBottom: 8 }]}>Font Style</Text>
              <View style={styles.fontRow}>
                {FONTS.map((font) => (
                  <Pressable
                    key={font.value}
                    onPress={() => updateActiveTextFont(font.value)}
                    style={[styles.fontButton, activeElement.fontFamily === font.value || (!activeElement.fontFamily && font.value === "Outfit-Bold") ? styles.fontButtonActive : null]}
                  >
                    <Text style={[styles.fontButtonText, { fontFamily: font.value }]}>{font.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 12, marginBottom: 8 }]}>Text Color</Text>
              <View style={styles.colorRow}>
                {TEXT_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => updateActiveTextColor(color)}
                    style={[styles.textColorButton, { backgroundColor: color }, activeElement.color === color && styles.textColorButtonActive]}
                  />
                ))}
              </View>
            </View>
          )}
          {activeElement?.type === "sticker" && (
            <Pressable onPress={removeActiveElement} style={styles.deleteButton} accessibilityLabel="Delete selected sticker">
              <Ionicons name="trash-outline" size={18} color="#A85D5D" />
              <Text style={styles.deleteText}>Remove selected sticker</Text>
            </Pressable>
          )}
        </ScrollView>
      ) : (
        <View style={styles.showToolsContainer}>
          <Pressable onPress={() => setShowToolbar(true)} style={styles.showToolsButton}>
            <Ionicons name="color-palette-outline" size={22} color="#FFF8E8" />
            <Text style={styles.showToolsText}>Show Tools</Text>
          </Pressable>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7FAF4" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12 },
  iconButton: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  eyebrow: { color: "#809087", fontFamily: "Outfit-SemiBold", fontSize: 10, letterSpacing: 1.2, textAlign: "center" },
  headerTitle: { color: "#20352B", fontFamily: "Outfit-Bold", fontSize: 19, textAlign: "center", marginTop: 2 },
  doneButton: { minWidth: 72, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: "#4D6558", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  doneText: { color: "#FFF8E8", fontFamily: "Outfit-SemiBold", fontSize: 13 },
  previewArea: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 340, paddingVertical: 14 },
  previewHint: { color: "#809087", fontFamily: "Outfit-Medium", fontSize: 12, marginBottom: 14 },
  notebookBase: { borderRadius: 18, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, shadowColor: "#20352B", shadowOffset: { width: 7, height: 9 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 10, overflow: "hidden", position: "relative" },
  coverHighlight: { position: "absolute", top: 0, left: 22, right: 0, height: 90, backgroundColor: "rgba(255,255,255,0.1)", transform: [{ skewY: "-8deg" }] },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 24, backgroundColor: "rgba(22,48,37,0.15)" },
  spineLine: { position: "absolute", left: 18, top: 18, bottom: 18, width: 1, backgroundColor: "rgba(255,248,232,0.28)" },
  pageEdge: { position: "absolute", right: 0, top: 10, bottom: 10, width: 4, backgroundColor: "rgba(255,248,232,0.32)" },
  elementsCanvas: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  emptyCoverMessage: { alignItems: "center", width: 150, gap: 8 },
  emptyCoverText: { color: "rgba(255,248,232,0.72)", fontFamily: "Outfit-Medium", fontSize: 13, textAlign: "center", lineHeight: 19 },
  elementContainer: { position: "absolute" },
  elementTouchTarget: { padding: 7, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  elementSelected: { borderColor: "rgba(255,248,232,0.9)", borderStyle: "dashed" },
  textElement: { fontFamily: "Outfit-Bold", fontSize: 28, maxWidth: 230, textAlign: "center" },
  
  iconOnlyButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#EEF3ED" },
  showToolsContainer: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  showToolsButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#4D6558", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 30, gap: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  showToolsText: { color: "#FFF8E8", fontFamily: "Outfit-Bold", fontSize: 15 },

  toolbarContainer: { flexGrow: 0, maxHeight: 290, backgroundColor: "#FFFFFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: "#20352B", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  toolbarContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24 },
  toolbarHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  toolTitle: { color: "#20352B", fontFamily: "Outfit-Bold", fontSize: 17 },
  toolSubtitle: { color: "#809087", fontFamily: "Outfit-Regular", fontSize: 12, marginTop: 3 },
  resetButton: { flexDirection: "row", alignItems: "center", gap: 4, padding: 5 },
  resetText: { color: "#4D6558", fontFamily: "Outfit-SemiBold", fontSize: 12 },
  sectionLabel: { color: "#52635A", fontFamily: "Outfit-SemiBold", fontSize: 12, marginBottom: 9 },
  colorRow: { flexDirection: "row", gap: 13, marginBottom: 16 },
  colorButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: "transparent" },
  colorButtonActive: { borderColor: "#20352B" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  textToolButton: { backgroundColor: "#4D6558", borderRadius: 16, minHeight: 32, paddingHorizontal: 10, flexDirection: "row", gap: 5, alignItems: "center", marginBottom: 9 },
  textToolLabel: { color: "#FFF8E8", fontFamily: "Outfit-SemiBold", fontSize: 12 },
  stickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  stickerButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#EEF3ED", alignItems: "center", justifyContent: "center" },
  editPanel: { borderTopWidth: 1, borderTopColor: "#E6EDE7", paddingTop: 12, marginTop: 2 },
  titleInput: { height: 42, borderWidth: 1, borderColor: "#CBD8CE", borderRadius: 12, paddingHorizontal: 12, color: "#20352B", fontFamily: "Outfit-Medium", fontSize: 14, marginTop: 1 },
  deleteButton: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 8 },
  deleteText: { color: "#A85D5D", fontFamily: "Outfit-SemiBold", fontSize: 12 },

  fontRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  fontButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#EEF3ED", borderWidth: 1, borderColor: "transparent" },
  fontButtonActive: { borderColor: "#4D6558", backgroundColor: "#E3EBE4" },
  fontButtonText: { color: "#20352B", fontSize: 13 },
  textColorButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#E6EDE7", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  textColorButtonActive: { borderColor: "#20352B", transform: [{ scale: 1.1 }] }});
