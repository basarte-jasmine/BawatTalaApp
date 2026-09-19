import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the book badges (bookDecoBig) from the JSX
deco_pattern = re.compile(r'\{selectedJournalMode === "muni" \? \(\s*<View style=\{\[styles\.bookDecoBig.*?<Ionicons name="chatbubbles".*?</View>\s*\) : \(\s*<View style=\{\[styles\.bookDecoBig.*?<Ionicons name="pencil".*?</View>\s*\)\}', re.DOTALL)
content = deco_pattern.sub('', content)

# 2. Update journalArtWrap styles to remove box, background, borders, shadows
art_wrap_pattern = re.compile(r'  journalArtWrap: \{.*?elevation: 2 \},', re.DOTALL)
new_art_wrap = """  journalArtWrap: {
    position: "relative",
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0 },"""
content = art_wrap_pattern.sub(new_art_wrap, content)

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed box and icons!")

