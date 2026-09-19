import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove bookDecoBig, bookDecoMuniBig, bookDecoSoloBig from styles
pattern = re.compile(r'  bookDecoBig: \{.*?elevation: 4 \},\s*bookDecoMuniBig: \{.*?right: -10 \},\s*bookDecoSoloBig: \{.*?left: -10 \},\s*', re.DOTALL)
content = pattern.sub('', content)

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

