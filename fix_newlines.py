
with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken newlines in the string literals
content = content.replace('Guided{"\n"}Journal', 'Guided{"\\n"}Journal')
content = content.replace('Solo{"\n"}Journal', 'Solo{"\\n"}Journal')

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

