
with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines[200:320]):
    print(f"{i+201}: {line.rstrip()}")

