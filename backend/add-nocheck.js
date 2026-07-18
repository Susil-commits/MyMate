import fs from 'fs';
import path from 'path';

function traverseAndAdd(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === 'dist') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseAndAdd(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.startsWith('// @ts-nocheck')) {
        fs.writeFileSync(fullPath, '// @ts-nocheck\n' + content);
      }
    }
  }
}

traverseAndAdd('.');
