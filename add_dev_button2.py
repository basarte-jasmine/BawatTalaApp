import re

with open('mobile-app/app/achievements.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

dev_button = """<Pressable 
        style={{ backgroundColor: '#FF6B6B', marginHorizontal: 20, padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 }}
        onPress={async () => {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const achKeys = keys.filter(k => k.startsWith('@bawat-tala/achievement') || k.startsWith('@bawat-tala/future-bottle') || k.startsWith('@bawat-tala/achievement-emotions'));
            await AsyncStorage.multiRemove(achKeys);
            alert('Local achievements cache cleared! Please go back and re-enter this screen.');
          } catch (e) {
            alert('Failed to clear cache');
          }
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>DEV: Reset Local Achievements</Text>
      </Pressable><ScrollView """

content = content.replace('<ScrollView ', dev_button)

with open('mobile-app/app/achievements.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

