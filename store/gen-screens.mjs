import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync(new URL(".", import.meta.url), { recursive: true });

const FONT = "Helvetica, Arial, sans-serif";

// Reusable bee-cow logo at a given translate/scale
const logo = (x, y, s) => `
<g transform="translate(${x},${y}) scale(${s / 128})">
  <rect width="128" height="128" rx="28" fill="#15140f"/>
  <path d="M52 38 C46 22 42 18 39 13" stroke="#1a1a1a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M76 38 C82 22 86 18 89 13" stroke="#1a1a1a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <circle cx="38" cy="12" r="5" fill="#1a1a1a"/><circle cx="90" cy="12" r="5" fill="#1a1a1a"/>
  <path d="M30 46 C17 42 15 31 22 27 C26 35 34 40 39 44 Z" fill="#f3e6b0"/>
  <path d="M98 46 C111 42 113 31 106 27 C102 35 94 40 89 44 Z" fill="#f3e6b0"/>
  <ellipse cx="24" cy="66" rx="12" ry="8" fill="#e0a92a" transform="rotate(-22 24 66)"/>
  <ellipse cx="104" cy="66" rx="12" ry="8" fill="#e0a92a" transform="rotate(22 104 66)"/>
  <ellipse cx="64" cy="73" rx="40" ry="37" fill="#facc15"/>
  <clipPath id="lf${x}"><ellipse cx="64" cy="73" rx="40" ry="37"/></clipPath>
  <g clip-path="url(#lf${x})"><rect x="18" y="50" width="92" height="9" fill="#1a1a1a"/><rect x="18" y="71" width="92" height="9" fill="#1a1a1a"/></g>
  <circle cx="50" cy="65" r="5.2" fill="#1a1a1a"/><circle cx="78" cy="65" r="5.2" fill="#1a1a1a"/>
  <ellipse cx="64" cy="93" rx="24" ry="15" fill="#fff1c2"/>
  <ellipse cx="55" cy="93" rx="3.3" ry="4.4" fill="#c98a2a"/><ellipse cx="73" cy="93" rx="3.3" ry="4.4" fill="#c98a2a"/>
</g>`;

// A side-panel card mock
function panel(x, y, inner) {
  return `<g transform="translate(${x},${y})">
    <rect width="430" height="560" rx="26" fill="#16130c" stroke="#3a3120" stroke-width="1.5"/>
    ${inner}
  </g>`;
}

const bg = (extraGlow = "") => `
  <defs><radialGradient id="glow" cx="50%" cy="0%" r="80%">
    <stop offset="0%" stop-color="#ffb300" stop-opacity="0.10"/><stop offset="60%" stop-color="#ffb300" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="1280" height="800" fill="#16130c"/>
  <rect width="1280" height="800" fill="url(#glow)"/>${extraGlow}`;

// ---------- Screenshot 1: hero + Send ----------
const sendPanel = panel(720, 130, `
  <g transform="translate(22,22)">
    ${logo(0, 0, 26)}
    <text x="34" y="20" font-family="${FONT}" font-size="20" font-weight="700" fill="#f6edd7">beemo</text>
  </g>
  <line x1="0" y1="74" x2="430" y2="74" stroke="#3a3120"/>
  <text x="60" y="112" font-family="${FONT}" font-size="15" font-weight="600" fill="#f6edd7" text-anchor="middle">Send</text>
  <rect x="40" y="124" width="40" height="3" rx="2" fill="#ffb300"/>
  <text x="190" y="112" font-family="${FONT}" font-size="15" fill="#897c5e" text-anchor="middle">Friends</text>
  <text x="320" y="112" font-family="${FONT}" font-size="15" fill="#897c5e" text-anchor="middle">Inbox</text>
  <text x="26" y="172" font-family="${FONT}" font-size="11" font-weight="600" letter-spacing="1.5" fill="#897c5e">WHAT TO SEND</text>
  <rect x="26" y="186" width="96" height="34" rx="17" fill="#3d3010" stroke="#ffb300"/>
  <text x="74" y="208" font-family="${FONT}" font-size="13" fill="#ffb300" text-anchor="middle">This tab</text>
  <rect x="130" y="186" width="100" height="34" rx="17" fill="#1f1a10" stroke="#3a3120"/>
  <text x="180" y="208" font-family="${FONT}" font-size="13" fill="#b6a884" text-anchor="middle">Tab group</text>
  <rect x="238" y="186" width="70" height="34" rx="17" fill="#1f1a10" stroke="#3a3120"/>
  <text x="273" y="208" font-family="${FONT}" font-size="13" fill="#b6a884" text-anchor="middle">Text</text>
  <rect x="26" y="244" width="378" height="64" rx="12" fill="#1f1a10" stroke="#3a3120"/>
  <rect x="44" y="262" width="20" height="20" rx="5" fill="#ffb300"/>
  <text x="78" y="270" font-family="${FONT}" font-size="14" font-weight="600" fill="#f6edd7">Figma — Beemo redesign</text>
  <text x="78" y="292" font-family="${FONT}" font-size="12" fill="#b6a884">figma.com/file/beemo</text>
  <text x="26" y="350" font-family="${FONT}" font-size="11" font-weight="600" letter-spacing="1.5" fill="#897c5e">SEND TO</text>
  <rect x="26" y="362" width="378" height="50" rx="12" fill="#3d3010" stroke="#ffb300"/>
  <circle cx="52" cy="387" r="15" fill="#ffb300"/>
  <text x="52" y="392" font-family="${FONT}" font-size="12" font-weight="700" fill="#1a1206" text-anchor="middle">AY</text>
  <text x="80" y="392" font-family="${FONT}" font-size="14" font-weight="500" fill="#f6edd7">Ayşe Yılmaz</text>
  <text x="388" y="393" font-family="${FONT}" font-size="16" font-weight="700" fill="#ffb300" text-anchor="end">✓</text>
  <rect x="26" y="450" width="378" height="50" rx="12" fill="#7a5403"/>
  <rect x="26" y="446" width="378" height="50" rx="12" fill="#ffb300"/>
  <text x="215" y="477" font-family="${FONT}" font-size="16" font-weight="700" fill="#1a1206" text-anchor="middle">Send it</text>
`);

const s1 = `<svg viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">
  ${bg()}
  ${logo(96, 150, 64)}
  <text x="96" y="320" font-family="${FONT}" font-size="76" font-weight="700" fill="#f6edd7" letter-spacing="-2">Buzz it <tspan fill="#ffb300">over.</tspan></text>
  <text x="98" y="380" font-family="${FONT}" font-size="26" fill="#b6a884">Send tabs, tab groups &amp; text to a friend —</text>
  <text x="98" y="416" font-family="${FONT}" font-size="26" fill="#b6a884">Chrome to Chrome, in one shortcut.</text>
  <rect x="98" y="452" width="320" height="48" rx="12" fill="#3d3010"/>
  <text x="120" y="482" font-family="${FONT}" font-size="17" fill="#ffb300">Cmd / Ctrl + Shift + S</text>
  ${sendPanel}
</svg>`;

// ---------- Screenshot 2: Inbox ----------
const card = (y, who, initials, pill, title, sub, btn, accent) => `
  <rect x="26" y="${y}" width="378" height="96" rx="14" fill="#1f1a10" stroke="${accent ? "#ffb300" : "#3a3120"}"/>
  ${accent ? `<rect x="26" y="${y}" width="4" height="96" rx="2" fill="#ffb300"/>` : ""}
  <circle cx="50" cy="${y + 26}" r="13" fill="${accent ? "#ffb300" : "#2a2315"}"/>
  <text x="50" y="${y + 31}" font-family="${FONT}" font-size="10" font-weight="700" fill="${accent ? "#1a1206" : "#ffb300"}" text-anchor="middle">${initials}</text>
  <text x="74" y="${y + 30}" font-family="${FONT}" font-size="12" fill="#b6a884">${who}</text>
  <rect x="320" y="${y + 14}" width="${pill.length * 8 + 16}" height="20" rx="10" fill="#3d3010"/>
  <text x="${320 + (pill.length * 8 + 16) / 2}" y="${y + 28}" font-family="${FONT}" font-size="11" fill="#ffb300" text-anchor="middle">${pill}</text>
  <text x="44" y="${y + 56}" font-family="${FONT}" font-size="14" font-weight="600" fill="#f6edd7">${title}</text>
  <text x="44" y="${y + 76}" font-family="${FONT}" font-size="12" fill="#b6a884">${sub}</text>`;

const inboxPanel = panel(720, 130, `
  <g transform="translate(22,22)">${logo(0, 0, 26)}<text x="34" y="20" font-family="${FONT}" font-size="20" font-weight="700" fill="#f6edd7">beemo</text></g>
  <line x1="0" y1="74" x2="430" y2="74" stroke="#3a3120"/>
  <text x="60" y="112" font-family="${FONT}" font-size="15" fill="#897c5e" text-anchor="middle">Send</text>
  <text x="190" y="112" font-family="${FONT}" font-size="15" fill="#897c5e" text-anchor="middle">Friends</text>
  <text x="315" y="112" font-family="${FONT}" font-size="15" font-weight="600" fill="#f6edd7" text-anchor="middle">Inbox</text>
  <rect x="300" y="124" width="60" height="3" rx="2" fill="#ffb300"/>
  ${card(150, "Ayşe Yılmaz", "AY", "tab", "Figma — Beemo redesign", "figma.com/file/beemo", "", true)}
  ${card(258, "Mehmet E.", "ME", "group", "6 tabs", "Docs · Pricing · Roadmap · API", "", true)}
  ${card(366, "Ayşe Yılmaz", "AY", "text", "Meeting at 3 — don't be late", "", "", false)}
`);

const s2 = `<svg viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">
  ${bg()}
  ${logo(96, 150, 64)}
  <text x="96" y="318" font-family="${FONT}" font-size="64" font-weight="700" fill="#f6edd7" letter-spacing="-2">Everything lands</text>
  <text x="96" y="390" font-family="${FONT}" font-size="64" font-weight="700" fill="#ffb300" letter-spacing="-2">in real time.</text>
  <text x="98" y="446" font-family="${FONT}" font-size="26" fill="#b6a884">Open a tab, copy a note, or restore a whole</text>
  <text x="98" y="482" font-family="${FONT}" font-size="26" fill="#b6a884">group — receiving is always free.</text>
  ${inboxPanel}
</svg>`;

for (const [name, svg] of [["screenshot-1.png", s1], ["screenshot-2.png", s2]]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1280 } }).render().asPng();
  writeFileSync(new URL(name, import.meta.url), png);
  console.log("wrote", name);
}
