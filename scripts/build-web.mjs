import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
fs.copyFileSync(path.join(root, 'presentation.html'), path.join(dist, 'presentation.html'));
fs.copyFileSync(path.join(root, 'studio.html'), path.join(dist, 'studio.html'));
fs.cpSync(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });
const vendor = path.join(root, 'vendor');
fs.mkdirSync(vendor, { recursive: true });
fs.cpSync(path.join(root, 'node_modules/@mediapipe/selfie_segmentation'), path.join(vendor, 'segmentation'), { recursive: true });
fs.cpSync(path.join(root, 'node_modules/pdfjs-dist/build'), path.join(vendor, 'pdfjs'), { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/fflate/esm/browser.js'), path.join(vendor, 'fflate.mjs'));
fs.cpSync(vendor, path.join(dist, 'vendor'), { recursive: true });
