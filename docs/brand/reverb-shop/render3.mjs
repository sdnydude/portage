import sharp from '/home/swebber64/DHG/portage/.claude/worktrees/feat-reverb-publish/node_modules/sharp/lib/index.js';
import { writeFileSync } from 'node:fs';

const W = 960, H = 160, S = 2;

async function render(name, svg) {
  writeFileSync(`${name}.svg`, svg);
  await sharp(Buffer.from(svg), { density: 72 * S }).resize(W, H).png().toFile(`${name}.png`);
  console.log('rendered', name);
}

/* ────────────────────────────────────────────────────────────────
   OPTION A — RACKMOUNT: the banner IS a 1U unit faceplate
──────────────────────────────────────────────────────────────── */
function screw(cx, cy, angle) {
  return `
  <circle cx="${cx}" cy="${cy}" r="7.5" fill="url(#screwG)" stroke="#0c0c0e" stroke-width="0.8"/>
  <line x1="${cx - 4.6 * Math.cos(angle)}" y1="${cy - 4.6 * Math.sin(angle)}" x2="${cx + 4.6 * Math.cos(angle)}" y2="${cy + 4.6 * Math.sin(angle)}" stroke="#0e0e10" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="${cx - 2}" cy="${cy - 2.4}" r="6.2" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.14"/>`;
}

function knob(cx, cy, r, pointerAngle, label) {
  const px = cx + (r - 4) * Math.cos(pointerAngle);
  const py = cy + (r - 4) * Math.sin(pointerAngle);
  let ticks = '';
  for (let i = 0; i <= 10; i++) {
    const a = (135 + i * 27) * Math.PI / 180;
    const x1 = cx + (r + 4) * Math.cos(a), y1 = cy + (r + 4) * Math.sin(a);
    const x2 = cx + (r + 7.5) * Math.cos(a), y2 = cy + (r + 7.5) * Math.sin(a);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#6f6a62" stroke-width="0.9" opacity="0.75"/>`;
  }
  return `${ticks}
  <circle cx="${cx}" cy="${cy}" r="${r + 1.5}" fill="#0d0d0f"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#knobG)" stroke="#050506" stroke-width="0.8"/>
  <circle cx="${cx - r * 0.28}" cy="${cy - r * 0.34}" r="${r * 0.62}" fill="#ffffff" opacity="0.07"/>
  <line x1="${cx}" y1="${cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#e8e2d6" stroke-width="2.2" stroke-linecap="round"/>
  <text x="${cx}" y="${cy + r + 20}" font-family="DM Mono" font-size="8" fill="#8d867c" text-anchor="middle" letter-spacing="1.6">${label}</text>`;
}

function ledLadder(x, y) {
  const colors = ['#3ecf6f', '#3ecf6f', '#3ecf6f', '#3ecf6f', '#3ecf6f', '#3ecf6f', '#e9b93c', '#e9b93c', '#e0512e', '#e0512e'];
  const lit = 7;
  let out = '';
  colors.forEach((c, i) => {
    const on = i < lit;
    out += `<rect x="${x + i * 13}" y="${y}" width="9" height="22" rx="1.5" fill="${on ? c : '#232324'}" ${on ? `stroke="${c}" stroke-width="0.5" opacity="0.95"` : 'stroke="#2e2e30" stroke-width="0.5"'}/>`;
    if (on) out += `<rect x="${x + i * 13}" y="${y}" width="9" height="22" rx="1.5" fill="${c}" opacity="0.35" filter="url(#glow)"/>`;
  });
  out += `<text x="${x + 58}" y="${y + 40}" font-family="DM Mono" font-size="8" fill="#8d867c" text-anchor="middle" letter-spacing="1.6">SIGNAL</text>`;
  return out;
}

const rackSvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#33333a"/>
    <stop offset="0.06" stop-color="#2b2b31"/>
    <stop offset="0.5" stop-color="#232327"/>
    <stop offset="0.94" stop-color="#1b1b1f"/>
    <stop offset="1" stop-color="#141416"/>
  </linearGradient>
  <linearGradient id="ear" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#26262b"/>
    <stop offset="1" stop-color="#101013"/>
  </linearGradient>
  <radialGradient id="screwG" cx="0.38" cy="0.32" r="1">
    <stop offset="0" stop-color="#9a958c"/>
    <stop offset="0.55" stop-color="#5b574f"/>
    <stop offset="1" stop-color="#2c2a26"/>
  </radialGradient>
  <radialGradient id="knobG" cx="0.42" cy="0.36" r="1">
    <stop offset="0" stop-color="#3c3c42"/>
    <stop offset="0.7" stop-color="#242428"/>
    <stop offset="1" stop-color="#121214"/>
  </radialGradient>
  <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="2.4"/>
  </filter>
  <radialGradient id="pwr" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ffb37a"/>
    <stop offset="0.5" stop-color="#e0722e"/>
    <stop offset="1" stop-color="#7a3812"/>
  </radialGradient>
</defs>

<rect width="${W}" height="${H}" fill="#0a0a0c"/>
<!-- rack ears -->
<rect x="0" y="0" width="34" height="${H}" fill="url(#ear)"/>
<rect x="${W - 34}" y="0" width="34" height="${H}" fill="url(#ear)"/>
<line x1="34.5" y1="0" x2="34.5" y2="${H}" stroke="#000" stroke-width="1.4"/>
<line x1="${W - 34.5}" y1="0" x2="${W - 34.5}" y2="${H}" stroke="#000" stroke-width="1.4"/>
<!-- faceplate -->
<rect x="36" y="3" width="${W - 72}" height="${H - 6}" rx="3.5" fill="url(#face)"/>
<rect x="36.6" y="3.6" width="${W - 73.2}" height="1.4" rx="0.7" fill="#ffffff" opacity="0.10"/>
<rect x="36" y="3" width="${W - 72}" height="${H - 6}" rx="3.5" fill="none" stroke="#000" stroke-width="1" opacity="0.7"/>
${screw(17, 22, 0.5)}${screw(17, 138, 2.2)}${screw(W - 17, 22, 1.3)}${screw(W - 17, 138, 2.9)}

<!-- brand block -->
<text x="70" y="64" font-family="Outfit" font-weight="400" font-size="12.5" fill="#8d867c" letter-spacing="4.6">DIGITAL HARMONY GROUP</text>
<text x="69" y="99" font-family="Outfit" font-weight="700" font-size="30" fill="#efe9df" letter-spacing="7.5">CLOSET</text>
<text x="70" y="124" font-family="DM Mono" font-size="9.5" fill="#c98a52" letter-spacing="2.6">USED &amp; LOVED MUSIC GEAR</text>

<!-- engraved model no. top-right of brand zone -->
<text x="70" y="30" font-family="DM Mono" font-size="7.5" fill="#66615a" letter-spacing="1.8">MODEL DHG-1U · SER. No 000014</text>

<!-- panel section rule -->
<line x1="392" y1="18" x2="392" y2="${H - 18}" stroke="#0d0d0f" stroke-width="1.6"/>
<line x1="393.4" y1="18" x2="393.4" y2="${H - 18}" stroke="#4a4a50" stroke-width="0.6" opacity="0.5"/>

<!-- knobs -->
${knob(464, 74, 24, (135 + 27 * 7) * Math.PI / 180, 'GAIN')}
${knob(566, 74, 24, (135 + 27 * 4) * Math.PI / 180, 'TONE')}
${knob(668, 74, 24, (135 + 27 * 9) * Math.PI / 180, 'VIBE')}

<!-- LED ladder -->
${ledLadder(738, 60)}

<!-- power -->
<rect x="884" y="56" width="14" height="34" rx="2.5" fill="#141416" stroke="#000" stroke-width="0.8"/>
<rect x="886" y="58" width="10" height="16" rx="2" fill="#2c2c31"/>
<circle cx="891" cy="34" r="4.5" fill="url(#pwr)"/>
<circle cx="891" cy="34" r="8" fill="#e0722e" opacity="0.25" filter="url(#glow)"/>
<text x="891" y="120" font-family="DM Mono" font-size="8" fill="#8d867c" text-anchor="middle" letter-spacing="1.4">ON</text>
</svg>`;

/* ────────────────────────────────────────────────────────────────
   OPTION B — VINTAGE CATALOG: '65 gear-catalog letterpress plate
──────────────────────────────────────────────────────────────── */
let catalogTicks = '';
for (let i = 0; i <= 56; i++) {
  const x = 40 + i * 15.7;
  const major = i % 4 === 0;
  catalogTicks += `<line x1="${x}" y1="${major ? 128 : 132}" x2="${x}" y2="136" stroke="#2e2a24" stroke-width="${major ? 1 : 0.6}" opacity="${major ? 0.8 : 0.5}"/>`;
}

const catalogSvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f2ecdd"/>
    <stop offset="1" stop-color="#e9e1cd"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#paper)"/>
<!-- plate frame: double rule -->
<rect x="10.5" y="10.5" width="${W - 21}" height="${H - 21}" fill="none" stroke="#2e2a24" stroke-width="1.6"/>
<rect x="15.5" y="15.5" width="${W - 31}" height="${H - 31}" fill="none" stroke="#2e2a24" stroke-width="0.6"/>

<!-- catalog header row -->
<text x="40" y="42" font-family="IBM Plex Mono" font-size="9" fill="#2e2a24" letter-spacing="2.2">CAT. No 014</text>
<text x="${W / 2}" y="42" font-family="IBM Plex Mono" font-size="9" fill="#2e2a24" text-anchor="middle" letter-spacing="2.2">— FINE USED INSTRUMENTS &amp; APPARATUS —</text>
<text x="${W - 40}" y="42" font-family="IBM Plex Mono" font-size="9" fill="#2e2a24" text-anchor="end" letter-spacing="2.2">EST. 2026</text>
<line x1="40" y1="52" x2="${W - 40}" y2="52" stroke="#2e2a24" stroke-width="0.8"/>

<!-- masthead -->
<text x="${W / 2}" y="98" font-family="Gloock" font-size="42" fill="#211d18" text-anchor="middle" letter-spacing="1">Digital Harmony Group Closet</text>
<text x="${W / 2}" y="121" font-family="CrimsonPro" font-style="italic" font-size="15" fill="#8a4b26" text-anchor="middle">used &amp; loved music gear — every piece plays a second act</text>

<!-- ruler footer -->
${catalogTicks}
</svg>`;

/* ────────────────────────────────────────────────────────────────
   OPTION C — TAPE STRIPE: 70s master-tape box, VU gradient bands
──────────────────────────────────────────────────────────────── */
const bandColors = ['#3ecf6f', '#7ed957', '#c9d94a', '#e9b93c', '#e08a2e', '#e0512e'];
let bands = '';
const bandX = 596, bandW = 46, skew = -34;
bandColors.forEach((c, i) => {
  const x = bandX + i * (bandW + 10);
  bands += `<g transform="skewX(${skew / 3.2})"><rect x="${x}" y="-10" width="${bandW}" height="${H + 20}" fill="${c}"/></g>`;
});

const tapeSvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<rect width="${W}" height="${H}" fill="#181511"/>
<!-- fine grid, tape-box spec paper -->
${Array.from({ length: 24 }, (_, i) => `<line x1="0" y1="${(i + 1) * 6.6}" x2="${W}" y2="${(i + 1) * 6.6}" stroke="#241f19" stroke-width="0.5"/>`).join('')}
${Array.from({ length: 60 }, (_, i) => `<line x1="${(i + 1) * 16}" y1="0" x2="${(i + 1) * 16}" y2="${H}" stroke="#241f19" stroke-width="0.5"/>`).join('')}

${bands}
<!-- band overprint: darken base -->
<rect x="0" y="0" width="${W}" height="${H}" fill="none"/>

<text x="44" y="66" font-family="Big Shoulders" font-weight="700" font-size="52" fill="#f2ecdd" letter-spacing="3">DHG CLOSET</text>
<line x1="46" y1="82" x2="336" y2="82" stroke="#e0722e" stroke-width="2"/>
<text x="46" y="104" font-family="DM Mono" font-size="11" fill="#b8b0a2" letter-spacing="3.4">USED &amp; LOVED MUSIC GEAR</text>
<text x="46" y="132" font-family="DM Mono" font-size="8" fill="#6f675c" letter-spacing="2">REEL 014 · 15 IPS · MASTER — DIGITAL HARMONY GROUP</text>
</svg>`;

await render('option-a-rackmount', rackSvg);
await render('option-b-catalog', catalogSvg);
await render('option-c-tapestripe', tapeSvg);
