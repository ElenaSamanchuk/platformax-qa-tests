const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createFeature } = require('../scripts/new-feature');

function workspace(fn, withDocs = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-feature-'));
  fs.mkdirSync(path.join(root, 'tests'));
  if (withDocs) fs.mkdirSync(path.join(root, 'docs/features'), { recursive: true });
  try { return fn(root); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('generator preserves existing case/spec and rejects traversal', () => workspace(root => {
  const doc = path.join(root, 'docs/features/course-access.md');
  fs.writeFileSync(doc, 'existing case');
  assert.throws(() => createFeature(root, 'course-access'), /Refusing to overwrite/);
  assert.equal(fs.readFileSync(doc, 'utf8'), 'existing case');
  assert.deepEqual(fs.readdirSync(path.join(root, 'tests')), []);
  assert.throws(() => createFeature(root, '../escape'), /slug/);
  fs.unlinkSync(doc);
  const [spec] = createFeature(root, 'course-access');
  const original = fs.readFileSync(spec, 'utf8');
  assert.throws(() => createFeature(root, 'course-access'), /Refusing to overwrite/);
  assert.equal(fs.readFileSync(spec, 'utf8'), original);
}));

test('generator rolls back its spec if case creation fails', () => workspace(root => {
  assert.throws(() => createFeature(root, 'course-access'), /ENOENT/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'tests')), []);
}, false));

test('generated case fails BLOCKED without requesting browser/network', async () => {
  let scenario;
  workspace(root => {
    const [spec] = createFeature(root, 'course-access');
    const register = (_name, fn) => { scenario = fn; };
    register.use = () => {};
    vm.runInNewContext(fs.readFileSync(spec, 'utf8'), {
      require: name => {
        assert.equal(name, '@playwright/test');
        return { test: register };
      },
    });
  });
  assert.equal(typeof scenario, 'function');
  await assert.rejects(scenario(), /BLOCKED: course-access CASE-1 is an unimplemented skeleton/);
});
