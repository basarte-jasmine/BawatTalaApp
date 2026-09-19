import re

with open('mobile-app/components/notifications/StudentInboxScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace TALA_IMAGE import to also include ACHIEVEMENT_BADGE
content = content.replace('const TALA_IMAGE = require("../../assets/images/Tala_Star.png");', 'const TALA_IMAGE = require("../../assets/images/Tala_Star.png");\nconst ACHIEVEMENT_BADGE = require("../../assets/images/Notification Badge.png");')

# Replace the icon wrap to handle isAchievement
old_icon_wrap = """            <View style={[styles.itemIconWrap, { backgroundColor: visual.chip }]}>
              {visual.usesTalaLogo ? (
                <Image source={TALA_IMAGE} style={styles.itemTalaIcon} resizeMode="contain" />
              ) : (
                <Ionicons name={visual.icon} size={18} color={visual.accent} />
              )}
            </View>"""

new_icon_wrap = """            {visual.isAchievement ? (
              <Image source={ACHIEVEMENT_BADGE} style={styles.itemAchievementBadge} resizeMode="contain" />
            ) : (
              <View style={[styles.itemIconWrap, { backgroundColor: visual.chip }]}>
                {visual.usesTalaLogo ? (
                  <Image source={TALA_IMAGE} style={styles.itemTalaIcon} resizeMode="contain" />
                ) : (
                  <Ionicons name={visual.icon} size={18} color={visual.accent} />
                )}
              </View>
            )}"""

content = content.replace(old_icon_wrap, new_icon_wrap)

# Add style for itemAchievementBadge
style_append = """  itemAchievementBadge: {
    width: 44,
    height: 44,
    marginTop: -2,
    marginLeft: -2 },
  itemTalaIcon: {"""
content = content.replace('  itemTalaIcon: {', style_append)

with open('mobile-app/components/notifications/StudentInboxScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

