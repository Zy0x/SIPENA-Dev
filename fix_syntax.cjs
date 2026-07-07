const fs = require('fs');
const path = require('path');

const dir = 'apps/frontend/src/pages';
const files = fs.readdirSync(dir);

let fixedCount = 0;

files.forEach(file => {
  if (file.endsWith('.tsx')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('/ />')) {
      content = content.replace(/\/ \/>/g, '/>');
      fs.writeFileSync(filePath, content);
      console.log(`Fixed syntax in ${file}`);
      fixedCount++;
    }
  }
});

console.log(`Total files fixed: ${fixedCount}`);
