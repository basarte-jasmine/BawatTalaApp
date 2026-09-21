
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/image-puzzle.tsx', 'utf8');

c = c.replace(
  'borderBottomColor: "#E0E7DD",\n  },',
  'borderBottomColor: "#E0E7DD",\n    zIndex: 9999,\n    elevation: 9999,\n  },'
);

// Fallback if the whitespace is different
c = c.replace(
  'borderBottomColor: "#E0E7DD",\r\n  },',
  'borderBottomColor: "#E0E7DD",\n    zIndex: 9999,\n    elevation: 9999,\n  },'
);

fs.writeFileSync('mobile-app/app/image-puzzle.tsx', c);
