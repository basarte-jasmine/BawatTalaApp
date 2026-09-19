import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'  journalArtWrap: \{.*?marginBottom: 0 \},', re.DOTALL)
new_style = """  journalArtWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8 },"""
content = pattern.sub(new_style, content)

pattern2 = re.compile(r'  journalArtWrapCompact: \{.*?marginBottom: 8 \},', re.DOTALL)
new_style2 = """  journalArtWrapCompact: {
    marginBottom: 4 },"""
content = pattern2.sub(new_style2, content)

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

