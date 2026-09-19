import re

with open('mobile-app/lib/notification-utils.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Achievement mapping
achievement_mapping = """
  if (normalized.includes("achievement") || normalized.includes("unlocked") || normalized.includes("badge") || normalized.includes("shopper")) {
    return {
      accent: "#7659B6",
      chip: "#F0EBFE",
      icon: "trophy-outline" as const,
      label: "Achievement",
      surface: "#FAF8FF",
      usesTalaLogo: true,
    };
  }
"""

# Insert before fallback
fallback_idx = content.rfind('return {\n    accent: "#7D89D8"')
if fallback_idx != -1:
    content = content[:fallback_idx] + achievement_mapping + "\n  " + content[fallback_idx:]
    with open('mobile-app/lib/notification-utils.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added achievement mapping!")
else:
    print("Fallback not found")

