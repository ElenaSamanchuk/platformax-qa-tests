const fs = require('node:fs');
const path = require('node:path');

function createFeature(root, slug) {
  if (typeof slug !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) {
    throw new Error('Use a lowercase feature slug, e.g. course-access (max 64 characters)');
  }
  const pairs = [
    ['spec.js.txt', `tests/${slug}.spec.js`],
    ['case.md', `docs/features/${slug}.md`],
  ];
  const files = pairs.map(([template, target]) => ({
    target: path.join(root, target),
    content: fs.readFileSync(path.join(__dirname, '../templates/feature', template), 'utf8').replaceAll('__FEATURE__', slug),
  }));
  for (const file of files) if (fs.existsSync(file.target)) throw new Error(`Refusing to overwrite ${file.target}`);
  const created = [];
  try {
    for (const file of files) {
      // Exclusive create also protects against a file appearing after preflight.
      fs.writeFileSync(file.target, file.content, { flag: 'wx' });
      created.push(file.target);
    }
  } catch (error) {
    // Roll back only the files this invocation created; never remove an existing file.
    for (const target of created) fs.unlinkSync(target);
    throw error;
  }
  return created;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: npm run new:feature -- course-access');
    for (const file of createFeature(path.resolve(__dirname, '..'), process.argv[2])) console.log(file);
    console.log('SKELETON / BLOCKED: fill the case and implement assertions before integration.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { createFeature };
