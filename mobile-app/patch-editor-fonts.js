
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'journal-cover-editor.tsx');
let content = fs.readFileSync(p, 'utf8');

// Fix headerTitle syntax error
content = content.replace(
  /headerTitle: \{ color: "#20352B", \s*fontFamily: element\.fontFamily \|\| "Outfit-Bold",\s*fontSize: 19, textAlign: "center", marginTop: 2 \},/,
  `headerTitle: { color: "#20352B", fontFamily: "Outfit-Bold", fontSize: 19, textAlign: "center", marginTop: 2 },`
);

// Add FONTS and TEXT_COLORS constants
const importsAndConstants = `
const FONTS = [
  { name: "Bold", value: "Outfit-Bold" },
  { name: "Regular", value: "Outfit" },
  { name: "Classic", value: "serif" },
  { name: "Type", value: "monospace" },
];

const TEXT_COLORS = ["#FFF8E8", "#1A1A1A", "#A85D5D", "#4D6558", "#B6CDE0"];

const COLORS = [
`;
content = content.replace(/const COLORS = \[/, importsAndConstants);

// Update DraggableElement text style to use element.fontFamily
content = content.replace(
  /<Text style=\{\[styles\.textElement, \{ color: element\.color \}\]\}>\{element\.content\}<\/Text>/,
  `<Text style={[styles.textElement, { color: element.color, fontFamily: element.fontFamily || "Outfit-Bold" }]}>{element.content}</Text>`
);

// Add updateActiveTextFont and updateActiveTextColor
const updateFunctions = `
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
`;
content = content.replace(/const removeActiveElement = \(\) => \{/, updateFunctions);


// Update the editPanel JSX
const editPanelReplacement = `
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
`;
content = content.replace(/\{activeElement\?\.type === "text" && \([\s\S]*?<\/View>\s*\)\}/, editPanelReplacement);

fs.writeFileSync(p, content, 'utf8');

