import re

with open('mobile-app/lib/notification-utils.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Change usesTalaLogo to isAchievement
content = content.replace('usesTalaLogo: true,\n    };\n  }\n\n  if (normalized.includes("referral")', 'isAchievement: true,\n    };\n  }\n\n  if (normalized.includes("referral")')

with open('mobile-app/lib/notification-utils.ts', 'w', encoding='utf-8') as f:
    f.write(content)

with open('mobile-app/app/notification-view.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('const TALA_IMAGE = require("../assets/images/Tala_Star.png");', 'const TALA_IMAGE = require("../assets/images/Tala_Star.png");\nconst ACHIEVEMENT_BADGE = require("../assets/images/Notification Badge.png");')

hero_block = """          {illustration ? (
            <Image source={{ uri: illustration }} style={styles.heroIllustration} resizeMode="contain" />
          ) : (
            <View style={[styles.heroIconBubble, { backgroundColor: visual.chip }]}>
              {visual.usesTalaLogo ? (
                <Image source={TALA_IMAGE} style={styles.heroTalaIcon} resizeMode="contain" />
              ) : visual.isAchievement ? (
                <Image source={ACHIEVEMENT_BADGE} style={styles.heroAchievementIcon} resizeMode="contain" />
              ) : (
                <Ionicons name={visual.icon} size={20} color={visual.accent} />
              )}
            </View>
          )}"""

content = re.sub(r'\s*\{illustration \? \([\s\S]*?<\/View>\s*\)\s*\}', '\n' + hero_block, content)

style_append = """  heroAchievementIcon: {
    width: 60,
    height: 60,
    marginTop: -8,
    marginLeft: -4 },
  heroTalaIcon: {"""
content = content.replace('  heroTalaIcon: {', style_append)

# Also wait, if visual.isAchievement is true, then I need to make the heroIconBubble have no background if they want it to look like a full badge?
# "make the illustration visible instead of the bell" - The badge is probably a PNG with its own shape.
# Let's change the heroIconBubble so it doesn't clip it.
# Actually I'll just change the hero_block to render the badge WITHOUT the heroIconBubble if it's an achievement!

hero_block_fixed = """          {illustration ? (
            <Image source={{ uri: illustration }} style={styles.heroIllustration} resizeMode="contain" />
          ) : visual.isAchievement ? (
            <Image source={ACHIEVEMENT_BADGE} style={styles.heroIllustrationBadge} resizeMode="contain" />
          ) : (
            <View style={[styles.heroIconBubble, { backgroundColor: visual.chip }]}>
              {visual.usesTalaLogo ? (
                <Image source={TALA_IMAGE} style={styles.heroTalaIcon} resizeMode="contain" />
              ) : (
                <Ionicons name={visual.icon} size={20} color={visual.accent} />
              )}
            </View>
          )}"""

content = re.sub(r'\s*\{illustration \? \([\s\S]*?<\/View>\s*\)\s*\}', '\n' + hero_block_fixed, content)

style_append_fixed = """  heroIllustrationBadge: {
    width: 50,
    height: 50,
    marginTop: -2 },
  heroTalaIcon: {"""
content = content.replace('  heroTalaIcon: {', style_append_fixed)

with open('mobile-app/app/notification-view.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

