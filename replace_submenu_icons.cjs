const fs = require('fs');
const path = require('path');

const replacements = [
  { file: 'GradeReports.tsx', oldIcon: 'FileSpreadsheet', newIcon: 'LaporanNilaiIcon' },
  { file: 'StudentRankings.tsx', oldIcon: 'Trophy', newIcon: 'RankingMuridIcon' },
  { file: 'ParentPortal.tsx', oldIcon: 'UserCheck', newIcon: 'PortalOrangtuaIcon' },
  { file: 'Profile.tsx', oldIcon: 'Users', newIcon: 'ProfilSayaIcon' },
  { file: 'Profile.tsx', oldIcon: 'Shield', newIcon: 'KeamananAkunIcon' }
];

const dir = 'apps/frontend/src/pages';

replacements.forEach(({ file, oldIcon, newIcon }) => {
  const filePath = path.join(dir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import for new icon
    if (!content.includes(`import { ${newIcon} }`)) {
      content = `import { ${newIcon} } from "@/components/ui/animated-icons";\n` + content;
    }
    
    // Replace JSX tags
    const regex = new RegExp(`<${oldIcon}([^>]*)>`, 'g');
    content = content.replace(regex, `<${newIcon} $1 />`);
    
    // Optional: remove old text-indigo-600 classes if present
    content = content.replace(/text-indigo-600 dark:text-indigo-400/g, '');
    content = content.replace(/text-primary/g, '');
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file} with ${newIcon}`);
  }
});
