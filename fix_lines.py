
with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Delete lines 302 to 319 (0-indexed: 301 to 318)
del lines[301:319]

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

