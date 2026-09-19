import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken line
broken_line = 'router.push(/write-entry?mode=new-)}'
fixed_line = 'router.push(`/write-entry?mode=new-${selectedJournalMode}`)}'

content = content.replace(broken_line, fixed_line)

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("FIXED")

