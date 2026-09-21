
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/journal-cover-editor.tsx', 'utf8');

// 1. Add Image to imports
c = c.replace(
  '    TextInput,\n    useWindowDimensions,\n    View,\n} from "react-native";',
  '    TextInput,\n    useWindowDimensions,\n    View,\n    Image,\n} from "react-native";'
);

// Fallback in case spacing is different
c = c.replace(
  'TextInput,\r\n    useWindowDimensions,\r\n    View,\r\n} from "react-native";',
  'TextInput,\r\n    useWindowDimensions,\r\n    View,\r\n    Image,\r\n} from "react-native";'
);
if (!c.includes('Image,')) {
    c = c.replace('useWindowDimensions,', 'useWindowDimensions, Image,');
}

// 2. Add IMAGE_STICKERS map after COLORS
const imageStickersDef = `
const IMAGE_STICKERS = {
  BirdStamp: require("../assets/images/Journal Assets/BirdStamp.webp"),
  BlueEyedGrass: require("../assets/images/Journal Assets/BlueEyedGrass.webp"),
  Cactus: require("../assets/images/Journal Assets/Cactus.webp"),
  Daffodil: require("../assets/images/Journal Assets/Daffodil.webp"),
  FlowerStamp: require("../assets/images/Journal Assets/FlowerStamp.webp"),
  LadyBugStamp: require("../assets/images/Journal Assets/LadyBugStamp.webp"),
  PinkFlower: require("../assets/images/Journal Assets/PinkFlower.webp"),
  SleepingCatStamp: require("../assets/images/Journal Assets/SleepingCatStamp.webp"),
  Turtle: require("../assets/images/Journal Assets/Turtle.webp"),
};
`;
c = c.replace('const STICKERS: { icon: StickerName; label: string }[] = [', imageStickersDef + '\nconst STICKERS: { icon: StickerName; label: string; isImage?: boolean }[] = [');

// 3. Add new stickers to STICKERS array
const newStickers = `
  { icon: "BirdStamp", label: "Bird", isImage: true },
  { icon: "BlueEyedGrass", label: "Grass", isImage: true },
  { icon: "Cactus", label: "Cactus", isImage: true },
  { icon: "Daffodil", label: "Daffodil", isImage: true },
  { icon: "FlowerStamp", label: "Flower", isImage: true },
  { icon: "LadyBugStamp", label: "Ladybug", isImage: true },
  { icon: "PinkFlower", label: "Pink Flower", isImage: true },
  { icon: "SleepingCatStamp", label: "Cat", isImage: true },
  { icon: "Turtle", label: "Turtle", isImage: true },
`;
c = c.replace('{ icon: "sparkles", label: "Sparkles" },', newStickers + '  { icon: "sparkles", label: "Sparkles" },');

// 4. Update DraggableElement render
const oldElementRender = `          {element.type === "text" ? (
            <Text style={[styles.textElement, { color: element.color, fontFamily: element.fontFamily || "Outfit-Bold" }]}>{element.content}</Text>
          ) : (
            <Ionicons name={element.icon} size={42} color="#FFF8E8" />
          )}
        </Pressable>`;

const newElementRender = `          {element.type === "text" ? (
            <Text style={[styles.textElement, { color: element.color, fontFamily: element.fontFamily || "Outfit-Bold" }]}>{element.content}</Text>
          ) : element.icon && IMAGE_STICKERS[element.icon as keyof typeof IMAGE_STICKERS] ? (
            <Image source={IMAGE_STICKERS[element.icon as keyof typeof IMAGE_STICKERS]} style={{ width: 100, height: 100 }} resizeMode="contain" />
          ) : (
            <Ionicons name={element.icon as any} size={42} color="#FFF8E8" />
          )}
        </Pressable>`;

if(c.includes(oldElementRender)) {
  c = c.replace(oldElementRender, newElementRender);
} else {
  // Try regex if exact literal match failed
  c = c.replace(
    /\{element\.type === "text" \? \([\s\S]*?<Text[\s\S]*?<\/Text>\s*\) : \(\s*<Ionicons[\s\S]*?\/>\s*\)\}/,
    newElementRender.replace('        </Pressable>', '').trim()
  );
}

// 5. Update stickerRow render
const oldStickerRowRender = `            {STICKERS.map((sticker) => (
              <Pressable key={sticker.icon} onPress={() => addSticker(sticker.icon)} style={styles.stickerButton} accessibilityLabel={\`Add \${sticker.label} sticker\`}>
                <Ionicons name={sticker.icon} size={23} color="#4D6558" />
              </Pressable>
            ))}`;

const newStickerRowRender = `            {STICKERS.map((sticker) => (
              <Pressable key={sticker.icon} onPress={() => addSticker(sticker.icon)} style={styles.stickerButton} accessibilityLabel={\`Add \${sticker.label} sticker\`}>
                {sticker.isImage ? (
                  <Image source={IMAGE_STICKERS[sticker.icon as keyof typeof IMAGE_STICKERS]} style={{ width: 30, height: 30 }} resizeMode="contain" />
                ) : (
                  <Ionicons name={sticker.icon as any} size={23} color="#4D6558" />
                )}
              </Pressable>
            ))}`;

if(c.includes(oldStickerRowRender)) {
  c = c.replace(oldStickerRowRender, newStickerRowRender);
} else {
  c = c.replace(
    /\{STICKERS\.map\(\(sticker\) => \([\s\S]*?<Pressable[\s\S]*?<Ionicons name=\{sticker\.icon\}[\s\S]*?<\/Pressable>\s*\)\)\}/,
    newStickerRowRender
  );
}

// 6. Update style for stickerRow
c = c.replace(
  'stickerRow: { flexDirection: "row", gap: 10, marginBottom: 12 },',
  'stickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },'
);

fs.writeFileSync('mobile-app/app/journal-cover-editor.tsx', c);
