import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove journalModeInfo block
pattern_info = re.compile(r'\s*<View style=\{styles\.journalModeInfo\}>.*?<\/View>', re.DOTALL)
content = pattern_info.sub('', content)

# 2. Change the button text
pattern_btn = re.compile(r'\{selectedJournalMode === "muni" \? "Add Guided Entry" : "Add Solo Entry"\}')
content = pattern_btn.sub('{selectedJournalMode === "muni" ? "Write with Muni" : "Write"}', content)

# 3. Remove styles for journalModeInfo, journalModeTitle, journalModeDesc
# It starts at journalModeInfo: { ... } and ends right before addEntryButton: {
pattern_styles = re.compile(r'\s*journalModeInfo: \{.*?journalModeDesc: \{.*?\},', re.DOTALL)
content = pattern_styles.sub('', content)

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

