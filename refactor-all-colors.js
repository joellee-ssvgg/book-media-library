const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, 'apps/web/app'),
  path.join(__dirname, 'apps/web/components')
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const allFiles = [];
targetDirs.forEach(dir => {
  allFiles.push(...walk(dir));
});

const regexRules = [
  // Text colors
  { regex: /text-\[#(6c675f|5f665f|3f4945|5a605e|7d8582|525252|71717a|a1a1aa|d4d4d8)\]/g, replacement: 'text-muted-foreground' },
  { regex: /text-\[#(315f53|1f3d35|1f2423|18181b|27272a|09090b)\]/g, replacement: 'text-foreground' }, // main dark text
  { regex: /text-\[#(9a3412|b91c1c|ef4444|dc2626)\]/g, replacement: 'text-destructive' },
  
  // Background colors
  { regex: /bg-\[#(fffdf8|ffffff|fafafa|f4f4f5)\]/g, replacement: 'bg-card' },
  { regex: /bg-\[#(f7f5ef|f8fafc)\]/g, replacement: 'bg-background' },
  { regex: /bg-\[#(efe8d8|f1f5f9|e4e4e7|f4f4f5)\]/g, replacement: 'bg-muted' },
  { regex: /bg-\[#(fff8e8|fefce8)\]/g, replacement: 'bg-accent' },
  { regex: /bg-\[#(eef4f1|f3faf7|e5efe9)\]/g, replacement: 'bg-primary/10' },
  { regex: /bg-\[#(315f53|1f3d35|18181b|09090b)\]/g, replacement: 'bg-primary' },
  { regex: /bg-\[#(ef4444|dc2626)\]/g, replacement: 'bg-destructive' },
  
  // Border colors
  { regex: /border-\[#(d8d2c4|c9c2b3|ead6ab|e4e4e7|d4d4d8)\]/g, replacement: 'border-border' },
  { regex: /border-\[#(315f53|1f3d35|18181b)\]/g, replacement: 'border-primary' },
  
  // Catch-all for any other hex colors
  { regex: /text-\[#[a-fA-F0-9]{3,6}\]/g, replacement: 'text-foreground' },
  { regex: /bg-\[#[a-fA-F0-9]{3,6}\]/g, replacement: 'bg-muted' },
  { regex: /border-\[#[a-fA-F0-9]{3,6}\]/g, replacement: 'border-border' },
  { regex: /divide-\[#[a-fA-F0-9]{3,6}\]/g, replacement: 'divide-border' },
  { regex: /ring-\[#[a-fA-F0-9]{3,6}\]/g, replacement: 'ring-ring' },
];

let changedCount = 0;

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  regexRules.forEach(rule => {
    content = content.replace(rule.regex, rule.replacement);
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
    changedCount++;
  }
});

console.log(`\nRefactored ${changedCount} files.`);
