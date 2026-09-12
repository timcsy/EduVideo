import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('desktop bundle declares Windows, macOS and Linux targets', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url)));
  assert.deepEqual(config.bundle.targets, ['nsis', 'dmg', 'appimage', 'deb']);
  assert.equal(config.build.frontendDist, '../dist');
  assert.equal(fs.existsSync(new URL('../scripts/build-web.mjs', import.meta.url)), true);
});
