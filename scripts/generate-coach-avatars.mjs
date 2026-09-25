/// Genera los avatares de coach — ilustración flat paramétrica:
/// cara andrógina compartida, torso M/F, variantes de piel/cabello/top.
/// Emite a ../prototipo-gym/assets/avatars/coaches/ (bundle de la app)
/// y ./public/avatars/coaches/ (preview del picker en B2B).
///
/// Uso: node scripts/generate-coach-avatars.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTS = [
  resolve(repoRoot, 'public/avatars/coaches'),
  resolve(repoRoot, '../prototipo-gym/assets/avatars/coaches'),
];

const HAIR_STYLES = {
  buzz: (c) =>
    `<path d="M 73 64 C 73 38 127 38 127 64 C 121 50 112 46 100 46 C 88 46 79 50 73 64 Z" fill="${c}"/>`,
  crop: (c) =>
    `<path d="M 72 66 C 72 36 128 36 128 66 L 120 58 C 118 51 110 48 100 48 C 90 48 82 51 80 58 Z" fill="${c}"/>`,
  curly: (c) =>
    `<path d="M 73 66 C 71 44 82 34 100 34 C 118 34 129 44 127 66 C 122 57 115 54 108 56 C 106 49 94 49 92 56 C 85 54 78 57 73 66 Z" fill="${c}"/>
     <circle cx="80" cy="46" r="9" fill="${c}"/><circle cx="94" cy="40" r="10" fill="${c}"/>
     <circle cx="109" cy="41" r="9" fill="${c}"/><circle cx="121" cy="49" r="8" fill="${c}"/>`,
  bun: (c) =>
    `<path d="M 73 66 C 73 38 127 38 127 66 C 122 52 112 46 100 46 C 88 46 78 52 73 66 Z" fill="${c}"/>
     <circle cx="100" cy="36" r="9" fill="${c}"/>`,
  long: (c) =>
    `<path d="M 73 64 C 73 38 127 38 127 64 C 121 50 112 46 100 46 C 88 46 79 50 73 64 Z" fill="${c}"/>
     <path d="M 73 58 C 68 70 67 96 74 108 C 79 112 83 106 82 98 L 81 66 Z" fill="${c}"/>
     <path d="M 127 58 C 132 70 133 96 126 108 C 121 112 117 106 118 98 L 119 66 Z" fill="${c}"/>`,
};

function avatarSvg({ bg, skin, shade, hairStyle, hairColor, body, top }) {
  const masc = body === 'm';
  const torso = masc
    ? 'M 34 200 C 34 148 62 122 100 122 C 138 122 166 148 166 200 Z'
    : 'M 52 200 C 52 152 70 126 100 126 C 130 126 148 152 148 200 Z';
  const garment = masc
    ? // Tank top con cuello scoop + tirantes
      `<path d="M 44 200 L 44 168 C 44 152 58 144 76 140 L 82 138 C 86 150 92 157 100 157 C 108 157 114 150 118 138 L 124 140 C 142 144 156 152 156 168 L 156 200 Z" fill="${top}"/>
       <path d="M 66 126 L 84 132 L 80 143 L 62 136 Z" fill="${top}"/>
       <path d="M 134 126 L 116 132 L 120 143 L 138 136 Z" fill="${top}"/>`
    : // Top deportivo con escote + tirantes finos
      `<path d="M 56 200 L 56 162 Q 100 172 144 162 L 144 200 Z" fill="${top}"/>
       <rect x="75" y="132" width="8" height="32" rx="4" fill="${top}"/>
       <rect x="117" y="132" width="8" height="32" rx="4" fill="${top}"/>`;
  const muscle = masc
    ? `<path d="M 88 146 Q 100 154 112 146" stroke="${shade}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"/>
       <path d="M 48 152 Q 60 140 74 136" stroke="${shade}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.4"/>
       <path d="M 152 152 Q 140 140 126 136" stroke="${shade}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.4"/>`
    : `<path d="M 84 140 Q 100 148 116 140" stroke="${shade}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.45"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="${bg}"/>
  <path d="${torso}" fill="${skin}"/>
  ${garment}
  ${muscle}
  <rect x="88" y="92" width="24" height="30" rx="9" fill="${skin}"/>
  <rect x="88" y="92" width="24" height="12" rx="6" fill="${shade}" opacity="0.55"/>
  <circle cx="73" cy="72" r="5.5" fill="${skin}"/>
  <circle cx="127" cy="72" r="5.5" fill="${skin}"/>
  <ellipse cx="100" cy="68" rx="27" ry="30" fill="${skin}"/>
  ${HAIR_STYLES[hairStyle](hairColor)}
  <path d="M 84 57 Q 89 54 94 57" stroke="#2E2118" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path d="M 106 57 Q 111 54 116 57" stroke="#2E2118" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <circle cx="88.5" cy="66" r="2.7" fill="#2E2118"/>
  <circle cx="111.5" cy="66" r="2.7" fill="#2E2118"/>
  <path d="M 100 69 L 98 76 L 102 76" stroke="${shade}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 93 83 Q 100 87 107 83" stroke="#2E2118" stroke-width="2.4" fill="none" stroke-linecap="round"/>
</svg>
`;
}

/// Catálogo — ids canónicos guardados en trainers.avatar.
export const COACH_AVATARS = [
  { id: 'bronce', body: 'm', skin: '#C98850', shade: '#B0703B', hairStyle: 'buzz', hairColor: '#2A2320', top: '#FACC15', bg: '#F5E6D3' },
  { id: 'tide', body: 'm', skin: '#9A6238', shade: '#7F4E2B', hairStyle: 'crop', hairColor: '#2A2320', top: '#3B82F6', bg: '#E3EAF5' },
  { id: 'ember', body: 'm', skin: '#E9AE7E', shade: '#CF9261', hairStyle: 'curly', hairColor: '#B5542A', top: '#EF4444', bg: '#F8E3DC' },
  { id: 'slate', body: 'm', skin: '#F6C9A0', shade: '#E0A97E', hairStyle: 'crop', hairColor: '#D9A441', top: '#64748B', bg: '#E8EBEF' },
  { id: 'vine', body: 'm', skin: '#6F4526', shade: '#5A3619', hairStyle: 'bun', hairColor: '#2A2320', top: '#22C55E', bg: '#E5EFE2' },
  { id: 'iron', body: 'm', skin: '#C98850', shade: '#B0703B', hairStyle: 'crop', hairColor: '#5C3A21', top: '#F97316', bg: '#F3E7D8' },
  { id: 'rosa', body: 'f', skin: '#F6C9A0', shade: '#E0A97E', hairStyle: 'bun', hairColor: '#D9A441', top: '#EC4899', bg: '#F7E7EE' },
  { id: 'terra', body: 'f', skin: '#9A6238', shade: '#7F4E2B', hairStyle: 'curly', hairColor: '#2A2320', top: '#14B8A6', bg: '#E0F0EF' },
  { id: 'amber', body: 'f', skin: '#E9AE7E', shade: '#CF9261', hairStyle: 'long', hairColor: '#5C3A21', top: '#F59E0B', bg: '#F5E9D5' },
  { id: 'onyx', body: 'f', skin: '#6F4526', shade: '#5A3619', hairStyle: 'crop', hairColor: '#2A2320', top: '#8B5CF6', bg: '#E9E3F2' },
  { id: 'cielo', body: 'f', skin: '#C98850', shade: '#B0703B', hairStyle: 'long', hairColor: '#2A2320', top: '#06B6D4', bg: '#E2EEF4' },
  { id: 'lima', body: 'f', skin: '#E9AE7E', shade: '#CF9261', hairStyle: 'buzz', hairColor: '#B5542A', top: '#84CC16', bg: '#EDF2DE' },
];

for (const dir of OUTS) mkdirSync(dir, { recursive: true });
for (const spec of COACH_AVATARS) {
  const svg = avatarSvg(spec);
  for (const dir of OUTS) {
    writeFileSync(resolve(dir, `${spec.id}.svg`), svg);
  }
}
console.log(`✔ ${COACH_AVATARS.length} avatares → ${OUTS.join(', ')}`);
