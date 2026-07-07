const fs = require('fs');
const path = require('path');

const replacements = [
  { file: 'Dashboard.tsx', oldIcon: 'LayoutDashboard', newIcon: 'DashboardIcon' },
  { file: 'Classes.tsx', oldIcon: 'School', newIcon: 'KelasIcon' },
  { file: 'Subjects.tsx', oldIcon: 'BookOpen', newIcon: 'MataPelajaranIcon' },
  { file: 'Grades.tsx', oldIcon: 'FileSpreadsheet', newIcon: 'InputNilaiIcon' },
  { file: 'Attendance.tsx', oldIcon: 'CalendarDays', newIcon: 'PresensiIcon' },
  { file: 'AttendanceV2.tsx', oldIcon: 'CalendarDays', newIcon: 'PresensiIcon' },
  { file: 'Reports.tsx', oldIcon: 'BarChart3', newIcon: 'LaporanIcon' },
  { file: 'Settings.tsx', oldIcon: 'Settings', newIcon: 'PengaturanIcon' },
  { file: 'Help.tsx', oldIcon: 'HelpCircle', newIcon: 'PanduanIcon' },
  { file: 'About.tsx', oldIcon: 'Info', newIcon: 'TentangIcon' }
];

const dir = 'apps/frontend/src/pages';

replacements.forEach(({ file, oldIcon, newIcon }) => {
  const filePath = path.join(dir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import for new icon
    if (!content.includes(`import { ${newIcon} }`)) {
      content = content.replace(
        `import React`, 
        `import { ${newIcon} } from "@/components/ui/animated-icons";\nimport React`
      );
    }
    
    // Replace JSX tags
    const regex = new RegExp(`<${oldIcon}([^>]*)>`, 'g');
    content = content.replace(regex, `<${newIcon} $1 />`);
    
    // Optional: remove old text-indigo-600 classes if present
    content = content.replace(/text-indigo-600 dark:text-indigo-400/g, '');
    content = content.replace(/text-primary/g, '');
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
