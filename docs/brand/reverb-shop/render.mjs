import sharp from '/home/swebber64/DHG/portage/.claude/worktrees/feat-reverb-publish/node_modules/sharp/lib/index.js';
import { writeFileSync } from 'node:fs';

const W = 960, H = 160;
const S = 2; // supersample

// ── palette: instrument panel ──
const FLOOR = '#161310';        // noise floor, warm near-black
const FLOOR_HI = '#1d1915';     // faint top light
const SIGNAL = '#e07a3f';       // tube-bias orange — fundamental
const PHOSPHOR = '#57c4b8';     // oscilloscope teal — partials
const FACE = '#8d867c';         // brushed faceplate grey — rules/labels
const INK = '#efe9df';          // engraved name

// ── harmonic geometry ──
const x0 = 300;                 // string start (after text zone)
const xEnd = W - 12;
const lambda = 336;             // fundamental wavelength
const baseline = 80;

function envelope(x) {
  if (x < x0) return 0;
  const t = (x - x0) / (xEnd - x0);
  const attack = Math.min(1, t / 0.09);
  const decay = Math.exp(-1.9 * t);
  return attack * decay;
}

function partialPath(n, amp, phase) {
  const pts = [];
  for (let x = x0; x <= xEnd; x += 1.5) {
    const y = baseline + amp * envelope(x) * Math.sin((2 * Math.PI * n * (x - x0)) / lambda + phase) / n;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${pts.join(' L')}`;
}

let waves = '';
// long-exposure echoes of the fundamental (settling string)
for (const [ampScale, op] of [[1.22, 0.05], [1.13, 0.08], [1.06, 0.12]]) {
  waves += `<path d="${partialPath(1, 58 * ampScale, 0)}" fill="none" stroke="${SIGNAL}" stroke-width="1" opacity="${op}"/>`;
}
// partials 7..2 — phosphor, opacity and amplitude decay 1/n
for (let n = 7; n >= 2; n--) {
  const op = (0.62 / Math.sqrt(n)).toFixed(3);
  const phase = (n % 2) * Math.PI / 2;
  waves += `<path d="${partialPath(n, 58, phase)}" fill="none" stroke="${PHOSPHOR}" stroke-width="1.1" opacity="${op}"/>`;
}
// fundamental — the signal
waves += `<path d="${partialPath(1, 58, 0)}" fill="none" stroke="${SIGNAL}" stroke-width="2" opacity="0.95"/>`;

// ── monochord division rules (octave, fifth, fourth) ──
const span = xEnd - x0;
const divisions = [
  { r: 1 / 2, label: '1/2' },
  { r: 2 / 3, label: '2/3' },
  { r: 3 / 4, label: '3/4' },
];
let rules = '';
for (const d of divisions) {
  const x = (x0 + span * d.r).toFixed(1);
  rules += `<line x1="${x}" y1="26" x2="${x}" y2="${H - 18}" stroke="${FACE}" stroke-width="0.6" opacity="0.28"/>`;
  rules += `<text x="${x}" y="20.5" font-family="DM Mono" font-size="7.5" fill="${FACE}" opacity="0.62" text-anchor="middle" letter-spacing="0.5">${d.label}</text>`;
}
// string anchor tick at x0
rules += `<line x1="${x0}" y1="${baseline - 64}" x2="${x0}" y2="${baseline + 64}" stroke="${FACE}" stroke-width="0.6" opacity="0.35"/>`;
rules += `<circle cx="${x0}" cy="${baseline}" r="2.1" fill="${SIGNAL}" opacity="0.9"/>`;

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${FLOOR_HI}"/>
      <stop offset="0.45" stop-color="${FLOOR}"/>
      <stop offset="1" stop-color="#120f0c"/>
    </linearGradient>
    <linearGradient id="waveFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="white" stop-opacity="0"/>
      <stop offset="0.055" stop-color="white" stop-opacity="1"/>
      <stop offset="0.94" stop-color="white" stop-opacity="1"/>
      <stop offset="1" stop-color="white" stop-opacity="0.25"/>
    </linearGradient>
    <mask id="fade"><rect x="${x0 - 20}" y="0" width="${xEnd - x0 + 40}" height="${H}" fill="url(#waveFade)"/></mask>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#floor)"/>

  <g mask="url(#fade)">${waves}</g>
  ${rules}

  <!-- hairline frame, faceplate engraving -->
  <rect x="6.5" y="6.5" width="${W - 13}" height="${H - 13}" fill="none" stroke="${FACE}" stroke-width="0.7" opacity="0.30"/>

  <!-- nameplate -->
  <text x="40" y="52" font-family="Outfit" font-weight="400" font-size="13" fill="${FACE}" letter-spacing="5.2">DIGITAL HARMONY GROUP</text>
  <text x="39" y="97" font-family="Outfit" font-weight="700" font-size="31" fill="${INK}" letter-spacing="8">CLOSET</text>
  <line x1="40" y1="110" x2="230" y2="110" stroke="${SIGNAL}" stroke-width="1.4" opacity="0.85"/>
  <text x="40" y="133" font-family="DM Mono" font-size="11.7" fill="${FACE}" opacity="0.9" letter-spacing="3.1">USED &amp; LOVED MUSIC GEAR</text>

  <!-- atlas plate label -->
  <text x="${W - 40}" y="136" font-family="DM Mono" font-size="8" fill="${FACE}" opacity="0.55" text-anchor="end" letter-spacing="1.6">OVERTONE SERIES · A440 · n&#8315;&#185; DECAY</text>
</svg>`;

writeFileSync('banner.svg', svg);
await sharp(Buffer.from(svg), { density: 72 * S })
  .resize(W, H)
  .png()
  .toFile('dhg-closet-reverb-banner.png');
console.log('rendered');
