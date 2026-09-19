const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/home.tsx', 'utf8');

const regex = /<View style=\{styles.recentCard\}>[\s\S]*?<\/ScrollView>\s*<\/View>\s*<\/View>/m;

if (regex.test(content)) {
    content = content.replace(regex, '');
    fs.writeFileSync('mobile-app/app/home.tsx', content);
    console.log("Section removed successfully!");
} else {
    console.log("Could not find the recentCard section.");
}

