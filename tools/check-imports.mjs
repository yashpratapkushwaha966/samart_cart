// Offline sanity checker (no dependencies needed):
//  1. every relative import points to a file that exists
//  2. every named import is actually exported by that file
//  3. every bare package import is declared in package.json
// usage: node tools/check-imports.mjs server/src [more dirs...]
import fs from 'node:fs';
import path from 'node:path';

const roots = process.argv.slice(2);
const problems = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === 'node_modules' || e.name === 'dist' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);

const exportsOf = (file) => {
  const src = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) m[1].split(',').forEach((s) => names.add(s.trim().split(/\s+as\s+/).pop()));
  if (/export\s+default/.test(src)) names.add('default');
  if (/export\s+\*\s+from/.test(src)) names.add('*');
  return names;
};
const resolveFile = (from, spec) => {
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.js`, `${base}.jsx`, `${base}/index.js`, `${base}/index.jsx`]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
};

for (const root of roots) {
  const pkgPath = ['.', '..'].map((p) => path.join(root, p, 'package.json')).find(fs.existsSync) ||
    path.join(root.split(path.sep)[0], 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
  const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
  for (const file of walk(root).filter((f) => /\.(js|jsx|mjs)$/.test(f))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?(?:\*\s+as\s+[\w$]+\s*)?from\s+['"]([^'"]+)['"]/g)) {
      const [, def, named, spec] = m;
      if (spec.startsWith('.')) {
        if (/\.(css|svg|png|jpg)$/.test(spec)) continue;
        const target = resolveFile(file, spec);
        if (!target) { problems.push(`${file}: cannot resolve ${spec}`); continue; }
        if (!/\.(js|jsx|mjs)$/.test(target)) continue;
        const ex = exportsOf(target);
        if (ex.has('*')) continue;
        if (def && !ex.has('default')) problems.push(`${file}: ${spec} has no default export`);
        for (const n of (named || '').split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
          if (!ex.has(n)) problems.push(`${file}: ${spec} does not export "${n}"`);
        }
      } else if (!spec.startsWith('node:')) {
        const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (!declared.has(pkgName)) problems.push(`${file}: package "${pkgName}" is not in package.json`);
      }
    }
  }
}
if (problems.length) { console.log(problems.join('\n')); console.log(`\n${problems.length} problem(s)`); process.exit(1); }
console.log('imports OK');
