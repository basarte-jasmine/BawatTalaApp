
const fs = require('fs');
let content = fs.readFileSync('./mobile-app/components/profile/StudentProfileAvatar.tsx', 'utf8');
content = content.replace(
  'import {  ImageSourcePropType, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";',
  'import { Image as RNImage, ImageSourcePropType, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";'
);
content = content.replace(
  /<Image\s+accessibilityLabel="Student profile picture"\s+contentFit="cover"\s+source=\{\{ uri: imageUrl \}\}\s+style=\{\{ height: '100%', width: '100%' \}\}\s+\/>/g,
  '<RNImage\n            accessibilityLabel="Student profile picture"\n            resizeMode="cover"\n            source={{ uri: imageUrl }}\n            style={{ height: \'100%\', width: \'100%\' }}\n          />'
);
fs.writeFileSync('./mobile-app/components/profile/StudentProfileAvatar.tsx', content);

