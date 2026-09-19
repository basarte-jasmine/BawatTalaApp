import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('  journalModeInfo: {\n    alignItems: "center" },', '  journalModeInfo: {\n    alignItems: "center",\n    marginBottom: 16 },')

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

