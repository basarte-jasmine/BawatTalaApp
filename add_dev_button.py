import re

with open('mobile-app/app/achievements.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

dev_button = """        <View style={styles.headerSpacer} />
      </View>

      {/* DEV ONLY BUTTON */}
      <Pressable 
        style={{ backgroundColor: '#FF6B6B', marginHorizontal: 20, padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 10 }}
        onPress={async () => {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const achKeys = keys.filter(k => k.startsWith('@bawat-tala/achievement') || k.startsWith('@bawat-tala/future-bottle'));
            await AsyncStorage.multiRemove(achKeys);
            setUnlockedAchievements(new Set());
            alert('Local achievements cache cleared!');
          } catch (e) {
            alert('Failed to clear cache');
          }
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>DEV: Reset Local Achievements</Text>
      </Pressable>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>"""

content = content.replace('        <View style={styles.headerSpacer} />\n      </View>\n\n      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>', dev_button)

with open('mobile-app/app/achievements.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

