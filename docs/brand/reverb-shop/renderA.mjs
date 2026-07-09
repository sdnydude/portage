import sharp from '/home/swebber64/DHG/portage/.claude/worktrees/feat-reverb-publish/node_modules/sharp/lib/index.js';
import { writeFileSync } from 'node:fs';

const W = 960, H = 160, S = 2;

async function render(name, svg) {
  writeFileSync(`${name}.svg`, svg);
  await sharp(Buffer.from(svg), { density: 72 * S }).resize(W, H).png().toFile(`${name}.png`);
  console.log('rendered', name);
}

const DEFS_COMMON = (theme) => `
  <radialGradient id="screwG" cx="0.38" cy="0.32" r="1">
    <stop offset="0" stop-color="#9a958c"/><stop offset="0.55" stop-color="#5b574f"/><stop offset="1" stop-color="#2c2a26"/>
  </radialGradient>
  <filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4"/></filter>`;

function screw(cx, cy, angle) {
  return `
  <circle cx="${cx}" cy="${cy}" r="7.5" fill="url(#screwG)" stroke="#0c0c0e" stroke-width="0.8"/>
  <line x1="${cx - 4.6 * Math.cos(angle)}" y1="${cy - 4.6 * Math.sin(angle)}" x2="${cx + 4.6 * Math.cos(angle)}" y2="${cy + 4.6 * Math.sin(angle)}" stroke="#0e0e10" stroke-width="1.6" stroke-linecap="round"/>`;
}

function knob(cx, cy, r, frac, label, opts = {}) {
  const dark = opts.dark ?? false;
  const labelFill = opts.labelFill ?? '#8d867c';
  const cap = dark ? 'url(#knobDark)' : 'url(#knobLight)';
  const pointer = dark ? '#e8e2d6' : '#1c1a17';
  const a = (135 + 270 * frac) * Math.PI / 180;
  const px = cx + (r - 4) * Math.cos(a), py = cy + (r - 4) * Math.sin(a);
  let ticks = '';
  for (let i = 0; i <= 10; i++) {
    const t = (135 + i * 27) * Math.PI / 180;
    ticks += `<line x1="${(cx + (r + 4) * Math.cos(t)).toFixed(1)}" y1="${(cy + (r + 4) * Math.sin(t)).toFixed(1)}" x2="${(cx + (r + 7.5) * Math.cos(t)).toFixed(1)}" y2="${(cy + (r + 7.5) * Math.sin(t)).toFixed(1)}" stroke="${labelFill}" stroke-width="0.9" opacity="0.7"/>`;
  }
  return `${ticks}
  <circle cx="${cx}" cy="${cy}" r="${r + 1.5}" fill="rgba(0,0,0,0.55)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${cap}" stroke="#050506" stroke-width="0.8"/>
  <circle cx="${cx - r * 0.28}" cy="${cy - r * 0.34}" r="${r * 0.62}" fill="#ffffff" opacity="0.08"/>
  <line x1="${cx}" y1="${cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${pointer}" stroke-width="2.2" stroke-linecap="round"/>
  <text x="${cx}" y="${cy + r + 20}" font-family="DM Mono" font-size="8" fill="${labelFill}" text-anchor="middle" letter-spacing="1.6">${label}</text>`;
}

function vuMeter(x, y, w, h, labelFill) {
  // needle pivots from below the window's bottom edge, sweeping an upward arc
  const cx = x + w / 2, cy = y + h + 18;
  const rIn = h * 0.78, rTick = 10;
  let scale = '';
  for (let i = 0; i <= 10; i++) {
    const a = (-44 + i * 8.8) * Math.PI / 180;
    const hot = i >= 8;
    const x1 = cx + rIn * Math.sin(a), y1 = cy - rIn * Math.cos(a);
    const x2 = cx + (rIn + (i % 5 === 0 ? rTick : rTick * 0.6)) * Math.sin(a), y2 = cy - (rIn + (i % 5 === 0 ? rTick : rTick * 0.6)) * Math.cos(a);
    scale += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${hot ? '#c23b1e' : '#3a3226'}" stroke-width="${i % 5 === 0 ? 1.6 : 0.9}"/>`;
  }
  // hot-zone arc along the tick tips
  const arcPts = [];
  for (let i = 80; i <= 100; i++) {
    const a = (-44 + (i / 10) * 8.8) * Math.PI / 180;
    arcPts.push(`${(cx + (rIn + rTick + 2.5) * Math.sin(a)).toFixed(1)},${(cy - (rIn + rTick + 2.5) * Math.cos(a)).toFixed(1)}`);
  }
  const na = (-44 + 7.4 * 8.8) * Math.PI / 180;
  const nx = cx + (rIn + rTick) * Math.sin(na), ny = cy - (rIn + rTick) * Math.cos(na);
  const scaleArc = `<path d="M${arcPts.join(' L')}" fill="none" stroke="#c23b1e" stroke-width="2"/>`;
  scale += scaleArc;
  return `
  <rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" rx="4" fill="#0d0d0f"/>
  <clipPath id="vuClip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5"/></clipPath>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="url(#vuFace)"/>
  <g clip-path="url(#vuClip)">
    ${scale}
    <text x="${cx}" y="${y + h - 9}" font-family="DM Mono" font-size="9" fill="#3a3226" text-anchor="middle" letter-spacing="1">VU</text>
    <text x="${x + w - 12}" y="${y + 20}" font-family="DM Mono" font-size="7" fill="#c23b1e" text-anchor="end">+3</text>
    <text x="${x + 12}" y="${y + 20}" font-family="DM Mono" font-size="7" fill="#3a3226">-20</text>
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#1c1a17" stroke-width="1.8" stroke-linecap="round"/>
  </g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="none" stroke="#000" stroke-width="1"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h * 0.45}" rx="2.5" fill="#ffffff" opacity="0.05"/>
  <text x="${cx}" y="${y + h + 22}" font-family="DM Mono" font-size="8" fill="${labelFill}" text-anchor="middle" letter-spacing="1.6">OUTPUT</text>`;
}

function toggle(x, y, on, label, labelFill) {
  return `
  <circle cx="${x}" cy="${y}" r="10.5" fill="#0d0d0f" stroke="#000" stroke-width="0.8"/>
  <circle cx="${x}" cy="${y}" r="8" fill="#1d1d21"/>
  <line x1="${x}" y1="${y + (on ? 5 : -5)}" x2="${x}" y2="${y - (on ? 9 : -9)}" stroke="#c9c2b4" stroke-width="4.4" stroke-linecap="round"/>
  <circle cx="${x}" cy="${y - (on ? 9 : -9)}" r="3.1" fill="#ded7c8"/>
  <text x="${x}" y="${y + 34}" font-family="DM Mono" font-size="8" fill="${labelFill}" text-anchor="middle" letter-spacing="1.6">${label}</text>`;
}

/* ── A1: BLACKFACE + VU NEEDLE ── */
const a1 = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  ${DEFS_COMMON()}
  <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#33333a"/><stop offset="0.06" stop-color="#2b2b31"/><stop offset="0.5" stop-color="#232327"/><stop offset="0.94" stop-color="#1b1b1f"/><stop offset="1" stop-color="#141416"/>
  </linearGradient>
  <linearGradient id="ear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26262b"/><stop offset="1" stop-color="#101013"/></linearGradient>
  <radialGradient id="knobDark" cx="0.42" cy="0.36" r="1"><stop offset="0" stop-color="#3c3c42"/><stop offset="0.7" stop-color="#242428"/><stop offset="1" stop-color="#121214"/></radialGradient>
  <linearGradient id="vuFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0e7cf"/><stop offset="1" stop-color="#ddd0ae"/></linearGradient>
  <radialGradient id="pwr" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb37a"/><stop offset="0.5" stop-color="#e0722e"/><stop offset="1" stop-color="#7a3812"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#0a0a0c"/>
<rect x="0" y="0" width="34" height="${H}" fill="url(#ear)"/><rect x="${W - 34}" y="0" width="34" height="${H}" fill="url(#ear)"/>
<line x1="34.5" y1="0" x2="34.5" y2="${H}" stroke="#000" stroke-width="1.4"/><line x1="${W - 34.5}" y1="0" x2="${W - 34.5}" y2="${H}" stroke="#000" stroke-width="1.4"/>
<rect x="36" y="3" width="${W - 72}" height="${H - 6}" rx="3.5" fill="url(#face)"/>
<rect x="36.6" y="3.6" width="${W - 73.2}" height="1.4" rx="0.7" fill="#ffffff" opacity="0.10"/>
<rect x="36" y="3" width="${W - 72}" height="${H - 6}" rx="3.5" fill="none" stroke="#000" stroke-width="1" opacity="0.7"/>
${screw(17, 22, 0.5)}${screw(17, 138, 2.2)}${screw(W - 17, 22, 1.3)}${screw(W - 17, 138, 2.9)}
<text x="70" y="30" font-family="DM Mono" font-size="7.5" fill="#66615a" letter-spacing="1.8">MODEL DHG-1U · SER. No 000014</text>
<text x="70" y="64" font-family="Outfit" font-weight="400" font-size="12.5" fill="#8d867c" letter-spacing="4.6">DIGITAL HARMONY GROUP</text>
<text x="69" y="99" font-family="Outfit" font-weight="700" font-size="30" fill="#efe9df" letter-spacing="7.5">CLOSET</text>
<text x="70" y="124" font-family="DM Mono" font-size="9.5" fill="#c98a52" letter-spacing="2.6">USED &amp; LOVED MUSIC GEAR</text>
<line x1="392" y1="18" x2="392" y2="${H - 18}" stroke="#0d0d0f" stroke-width="1.6"/><line x1="393.4" y1="18" x2="393.4" y2="${H - 18}" stroke="#4a4a50" stroke-width="0.6" opacity="0.5"/>
${knob(452, 74, 24, 0.7, 'GAIN', { dark: true })}
${knob(548, 74, 24, 0.4, 'TONE', { dark: true })}
${toggle(628, 70, true, 'BYPASS', '#8d867c')}
${vuMeter(688, 34, 150, 74, '#8d867c')}
<circle cx="886" cy="60" r="4.5" fill="url(#pwr)"/><circle cx="886" cy="60" r="8" fill="#e0722e" opacity="0.25" filter="url(#glow)"/>
<text x="886" y="104" font-family="DM Mono" font-size="8" fill="#8d867c" text-anchor="middle" letter-spacing="1.4">ON</text>
</svg>`;

/* ── A2: SILVERFACE — brushed aluminum, black skirted knobs ── */
let brush = '';
for (let i = 0; i < 90; i++) {
  const y = 4 + i * 1.7;
  brush += `<line x1="37" y1="${y.toFixed(1)}" x2="${W - 37}" y2="${y.toFixed(1)}" stroke="#ffffff" stroke-width="0.4" opacity="${(0.02 + 0.025 * Math.abs(Math.sin(i * 1.7))).toFixed(3)}"/>`;
}
const a2 = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  ${DEFS_COMMON()}
  <linearGradient id="faceS" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#d9d5cc"/><stop offset="0.08" stop-color="#c8c4bb"/><stop offset="0.5" stop-color="#b7b3aa"/><stop offset="0.92" stop-color="#a49f96"/><stop offset="1" stop-color="#8e897f"/>
  </linearGradient>
  <linearGradient id="earS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3e"/><stop offset="1" stop-color="#1c1c20"/></linearGradient>
  <radialGradient id="knobDark" cx="0.42" cy="0.36" r="1"><stop offset="0" stop-color="#3c3c42"/><stop offset="0.7" stop-color="#242428"/><stop offset="1" stop-color="#121214"/></radialGradient>
  <radialGradient id="jewelR" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#ff8a6a"/><stop offset="0.5" stop-color="#d43c20"/><stop offset="1" stop-color="#5e1408"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#101012"/>
<rect x="0" y="0" width="34" height="${H}" fill="url(#earS)"/><rect x="${W - 34}" y="0" width="34" height="${H}" fill="url(#earS)"/>
<rect x="36" y="3" width="${W - 72}" height="${H - 6}" rx="3.5" fill="url(#faceS)"/>
${brush}
<rect x="36" y="3" width="${W - 72}" height="${H - 6}" rx="3.5" fill="none" stroke="#5c574e" stroke-width="1"/>
${screw(17, 22, 0.5)}${screw(17, 138, 2.2)}${screw(W - 17, 22, 1.3)}${screw(W - 17, 138, 2.9)}
<text x="70" y="30" font-family="DM Mono" font-size="7.5" fill="#6b665d" letter-spacing="1.8">MODEL DHG-1U · SER. No 000014</text>
<text x="70" y="64" font-family="Outfit" font-weight="400" font-size="12.5" fill="#4c473f" letter-spacing="4.6">DIGITAL HARMONY GROUP</text>
<text x="69" y="99" font-family="Outfit" font-weight="700" font-size="30" fill="#1e1b16" letter-spacing="7.5">CLOSET</text>
<line x1="70" y1="110" x2="252" y2="110" stroke="#b0490f" stroke-width="1.6"/>
<text x="70" y="126" font-family="DM Mono" font-size="9.5" fill="#7a4210" letter-spacing="2.6">USED &amp; LOVED MUSIC GEAR</text>
<line x1="392" y1="16" x2="392" y2="${H - 16}" stroke="#7d786f" stroke-width="1"/>
${knob(458, 72, 25, 0.65, 'LEVEL', { dark: true, labelFill: '#4c473f' })}
${knob(562, 72, 25, 0.35, 'BLEND', { dark: true, labelFill: '#4c473f' })}
${knob(666, 72, 25, 0.8, 'AGE', { dark: true, labelFill: '#4c473f' })}
${toggle(756, 68, true, 'VINTAGE', '#4c473f')}
${toggle(826, 68, false, 'MODERN', '#4c473f')}
<circle cx="890" cy="66" r="7" fill="url(#jewelR)" stroke="#3a352c" stroke-width="1.4"/>
<circle cx="890" cy="66" r="11" fill="#d43c20" opacity="0.18" filter="url(#glow)"/>
<text x="890" y="104" font-family="DM Mono" font-size="8" fill="#4c473f" text-anchor="middle" letter-spacing="1.4">POWER</text>
</svg>`;

/* ── A3: ORANGE BADGE — dark panel, orange anodized brand plate ── */
const a3 = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  ${DEFS_COMMON()}
  <linearGradient id="faceO" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#26262a"/><stop offset="0.5" stop-color="#1d1d21"/><stop offset="1" stop-color="#121215"/>
  </linearGradient>
  <linearGradient id="badge" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ef8a3c"/><stop offset="0.5" stop-color="#dd6d24"/><stop offset="1" stop-color="#b9531a"/>
  </linearGradient>
  <linearGradient id="ear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26262b"/><stop offset="1" stop-color="#101013"/></linearGradient>
  <radialGradient id="knobCream" cx="0.42" cy="0.36" r="1"><stop offset="0" stop-color="#f4ecd9"/><stop offset="0.7" stop-color="#e2d6ba"/><stop offset="1" stop-color="#b6a985"/></radialGradient>
  <radialGradient id="jewelA" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#ffd9a1"/><stop offset="0.5" stop-color="#ef8a3c"/><stop offset="1" stop-color="#6e3208"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#0a0a0c"/>
<rect x="0" y="0" width="34" height="${H}" fill="url(#ear)"/><rect x="${W - 34}" y="0" width="34" height="${H}" fill="url(#ear)"/>
<line x1="34.5" y1="0" x2="34.5" y2="${H}" stroke="#000" stroke-width="1.4"/><line x1="${W - 34.5}" y1="0" x2="${W - 34.5}" y2="${H}" stroke="#000" stroke-width="1.4"/>
<rect x="36" y="3" width="${W - 72}" height="${H - 6}" rx="3.5" fill="url(#faceO)"/>
<rect x="36.6" y="3.6" width="${W - 73.2}" height="1.4" rx="0.7" fill="#ffffff" opacity="0.08"/>
<rect x="36" y="3" width="${W - 72}" height="${H - 6}" rx="3.5" fill="none" stroke="#000" stroke-width="1" opacity="0.7"/>
${screw(17, 22, 0.5)}${screw(17, 138, 2.2)}${screw(W - 17, 22, 1.3)}${screw(W - 17, 138, 2.9)}

<!-- orange anodized brand badge -->
<rect x="62" y="28" width="330" height="104" rx="6" fill="url(#badge)" stroke="#050506" stroke-width="1.2"/>
<rect x="63" y="29" width="328" height="2" rx="1" fill="#ffffff" opacity="0.28"/>
<rect x="62" y="28" width="330" height="104" rx="6" fill="none" stroke="#ffb877" stroke-width="0.6" opacity="0.5"/>
${screw(78, 44, 0.9)}${screw(376, 44, 2.4)}${screw(78, 116, 1.8)}${screw(376, 116, 0.3)}
<text x="227" y="62" font-family="Outfit" font-weight="400" font-size="12" fill="#4d2408" text-anchor="middle" letter-spacing="4.2">DIGITAL HARMONY GROUP</text>
<text x="227" y="94" font-family="Outfit" font-weight="700" font-size="27" fill="#241002" text-anchor="middle" letter-spacing="6.5">CLOSET</text>
<text x="227" y="116" font-family="DM Mono" font-size="8.5" fill="#4d2408" text-anchor="middle" letter-spacing="2.2">USED &amp; LOVED MUSIC GEAR</text>

${knob(478, 72, 25, 0.6, 'DRIVE', { labelFill: '#8d867c' })}
${knob(582, 72, 25, 0.45, 'SHAPE', { labelFill: '#8d867c' })}
${knob(686, 72, 25, 0.75, 'SOUL', { labelFill: '#8d867c' })}
${toggle(776, 68, true, 'CLASS A', '#8d867c')}
<circle cx="866" cy="66" r="8" fill="url(#jewelA)" stroke="#000" stroke-width="1.4"/>
<circle cx="866" cy="66" r="13" fill="#ef8a3c" opacity="0.22" filter="url(#glow)"/>
<text x="866" y="106" font-family="DM Mono" font-size="8" fill="#8d867c" text-anchor="middle" letter-spacing="1.4">ON AIR</text>
<text x="866" y="30" font-family="DM Mono" font-size="7.5" fill="#66615a" text-anchor="end" letter-spacing="1.8">MODEL DHG-1U</text>
</svg>`;

// knobCream used in a3 via opts
await render('rack-a1-vu-needle', a1);
await render('rack-a2-silverface', a2);
await render('rack-a3-orange-badge', a3.replace(/url\(#knobLight\)/g, 'url(#knobCream)'));
