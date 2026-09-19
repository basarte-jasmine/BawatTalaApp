import re

with open('mobile-app/lib/achievements.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
import_stmt = 'import * as Notifications from "expo-notifications";\n'
content = import_stmt + content

# Add notification
notify_code = """    if (result.ok || result.alreadyUnlocked) {
      try {
        await AsyncStorage.setItem(`@bawat-tala/achievement:${achievementId}:${studentNumber}`, "true");
        if (result.ok && !result.alreadyUnlocked) {
           await Notifications.scheduleNotificationAsync({
             content: {
               title: "Achievement Unlocked!",
               body: result.message || "You earned a new achievement.",
             },
             trigger: null,
           });
        }
      } catch {
        // The server remains the source of truth if local storage is unavailable.
      }
    }"""

content = re.sub(r'\s*if \(result\.ok \|\| result\.alreadyUnlocked\) \{[\s\S]*?// The server remains the source of truth if local storage is unavailable\.\n\s*\}\n\s*\}', '\n' + notify_code, content)

with open('mobile-app/lib/achievements.ts', 'w', encoding='utf-8') as f:
    f.write(content)

