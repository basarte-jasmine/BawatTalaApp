import re

with open('mobile-app/app/notification-view.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add metadata to loadedItem
content = content.replace('title?: string;', 'title?: string;\n    metadata?: any;')

# Add metadata to setLoadedItem
set_loaded = """          if (found) {
            setLoadedItem({
              createdAt: found.createdAt,
              kind: found.kind,
              message: found.message,
              timeLabel: found.timeLabel,
              title: found.title,
              metadata: found.metadata,
            });"""
content = re.sub(r'\s*if \(found\) \{\s*setLoadedItem\(\{\s*createdAt: found\.createdAt,[\s\S]*?title: found\.title,\s*\}\);', set_loaded, content)

# Extract illustration
content = content.replace('const visual = getNotificationVisual(activeKind || "");', 'const visual = getNotificationVisual(activeKind || "");\n  const illustration = loadedItem?.metadata?.illustration || loadedItem?.metadata?.imageUrl || loadedItem?.metadata?.image;')

# Display illustration
hero_bubble = """        <View style={styles.heroCard}>
          {illustration ? (
            <Image source={{ uri: illustration }} style={styles.heroIllustration} resizeMode="contain" />
          ) : (
            <View style={[styles.heroIconBubble, { backgroundColor: visual.chip }]}>
              {visual.usesTalaLogo ? (
                <Image source={TALA_IMAGE} style={styles.heroTalaIcon} resizeMode="contain" />
              ) : (
                <Ionicons name={visual.icon} size={20} color={visual.accent} />
              )}
            </View>
          )}"""
content = re.sub(r'\s*<View style=\{styles\.heroCard\}>\s*<View style=\{\[styles\.heroIconBubble[\s\S]*?<\/View>', hero_bubble, content)

# Add styles for heroIllustration
style_append = """  heroIllustration: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginTop: 2 },
  heroIconBubble: {"""
content = content.replace('  heroIconBubble: {', style_append)

with open('mobile-app/app/notification-view.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

