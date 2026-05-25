const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, 'apps/web/components/domain')
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

const allFiles = walk(targetDirs[0]);

const regexRules = [
  // Upgrade primary cards
  { 
    regex: /border border-border bg-card p-5/g, 
    replacement: 'rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md' 
  },
  { 
    regex: /border border-border bg-card p-4/g, 
    replacement: 'rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 shadow-sm transition-all hover:shadow-md' 
  },
  { 
    regex: /border border-dashed border-border bg-card p-5/g, 
    replacement: 'rounded-2xl border-2 border-dashed border-border/60 bg-card/40 p-6 transition-colors hover:bg-card/60' 
  },
  
  // Upgrade muted sections / sidebars / small cards
  { 
    regex: /border border-border bg-muted/g, 
    replacement: 'rounded-xl border border-border/50 bg-muted/50 overflow-hidden' 
  },
  { 
    regex: /border border-border bg-primary\/10 p-3/g, 
    replacement: 'rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm' 
  },
  { 
    regex: /border-l-2 border-primary bg-primary\/10 px-4 py-3/g, 
    replacement: 'rounded-r-xl border-l-4 border-primary bg-primary/5 px-5 py-4 shadow-sm' 
  },

  // Upgrade Inputs & Buttons
  { 
    regex: /className="h-10 border border-border bg-card px-3 text-sm outline-none focus:border-primary"/g, 
    replacement: 'className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"' 
  },
  { 
    regex: /className="h-10 border border-border bg-card px-3 font-mono/g, 
    replacement: 'className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring' 
  },
  { 
    regex: /className="h-10 border border-primary px-4 text-sm font-medium text-foreground" type="submit"/g, 
    replacement: 'className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-transform hover:scale-105 active:scale-95" type="submit"' 
  },
  { 
    regex: /className="inline-flex h-10 w-fit items-center border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground"/g, 
    replacement: 'className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-transform hover:scale-105 active:scale-95"' 
  }
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
    console.log(`Updated layout classes in ${file}`);
    changedCount++;
  }
});

console.log(`\nRefactored ${changedCount} files.`);
