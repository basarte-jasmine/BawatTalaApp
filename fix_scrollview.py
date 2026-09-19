
with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('        </View>\n\n        <Modal', '        </View>\n        </ScrollView>\n\n        <Modal')

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

