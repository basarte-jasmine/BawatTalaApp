
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'journal-cover-editor.tsx');
let content = fs.readFileSync(p, 'utf8');

// 1. Add showToolbar state
content = content.replace(
  /const \[isSaving, setIsSaving\] = useState\(false\);/,
  `const [isSaving, setIsSaving] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);`
);

// 2. Remove previewHint from previewArea and fix the overlap
content = content.replace(
  /<View style=\{styles\.previewArea\}>\s*<Text style=\{styles\.previewHint\}>Drag, pinch, or rotate your pieces<\/Text>/,
  `<View style={styles.previewArea}>`
);

// 3. Put the hint inside emptyCoverMessage instead
content = content.replace(
  /<Text style=\{styles\.emptyCoverText\}>Start with a title or a little detail<\/Text>/,
  `<Text style={styles.emptyCoverText}>Start with a title or a little detail\n\nDrag, pinch, or rotate your pieces</Text>`
);

// 4. Wrap toolbarContainer in {showToolbar && (...)} and add a "Show Tools" button
const toolbarReplacement = `
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
                accessibilityLabel={\`Choose \${color.name} cover\`}
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
              <Pressable key={sticker.icon} onPress={() => addSticker(sticker.icon)} style={styles.stickerButton} accessibilityLabel={\`Add \${sticker.label} sticker\`}>
                <Ionicons name={sticker.icon} size={23} color="#4D6558" />
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
`;

content = content.replace(/<ScrollView style=\{styles\.toolbarContainer\}[\s\S]*?<\/ScrollView>/, toolbarReplacement);

fs.writeFileSync(p, content, 'utf8');

