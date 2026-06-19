import fs from "fs/promises";
import { createRequire } from "module";

const require = createRequire("/Users/xiangyu/Desktop/明动aim智能体/clipflow/package.json");
const sharp = require("sharp");

const outDir = "/Users/xiangyu/Desktop/明动aim智能体/artifacts/posters";
const avatarPath = `${outDir}/mingyuan-cutout-bust.png`;
const svgPath = `${outDir}/zhongruda-ai-course-poster.svg`;
const pngPath = `${outDir}/zhongruda-ai-course-poster.png`;

const W = 1080;
const H = 1920;

const colors = {
  primary: "#D14A33",
  gold: "#B88C33",
  bg: "#FAF8F3",
  card: "#FEFDFB",
  secondary: "#F6EEDA",
  border: "#EFE7DC",
  text: "#25211D",
  regular: "#5F5A52",
  muted: "#8A8175",
  dark: "#1A1816",
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function linesText(lines, x, y, size, lineHeight, weight, fill, extra = "") {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif" ${extra}>${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`)
    .join("")}</text>`;
}

function card(x, y, width, height, rx = 28, fill = colors.card, opacity = 0.94) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" opacity="${opacity}" stroke="${colors.border}" stroke-width="2" filter="url(#cardShadow)"/>`;
}

function compactPointRows(items, x, y) {
  return items
    .map((item, index) => {
      const yy = y + index * 96;
      return `<g>
        <rect x="${x}" y="${yy - 45}" width="52" height="52" rx="15" fill="url(#sealGrad)"/>
        <text x="${x + 26}" y="${yy - 10}" text-anchor="middle" font-size="28" font-weight="900" fill="#FEFDFB" font-family="PingFang SC, sans-serif">${index + 1}</text>
        <text x="${x + 78}" y="${yy - 8}" font-size="34" font-weight="850" fill="${colors.text}" font-family="PingFang SC, sans-serif">${esc(item)}</text>
        ${index < items.length - 1 ? `<line x1="${x + 78}" y1="${yy + 34}" x2="914" y2="${yy + 34}" stroke="${colors.border}" stroke-width="2" stroke-dasharray="8 9"/>` : ""}
      </g>`;
    })
    .join("");
}

const avatarBase64 = (await fs.readFile(avatarPath)).toString("base64");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="paperBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFCF7"/>
      <stop offset="0.52" stop-color="${colors.bg}"/>
      <stop offset="1" stop-color="#F6EEDA"/>
    </linearGradient>
    <linearGradient id="sealGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.primary}"/>
      <stop offset="1" stop-color="${colors.gold}"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F7D98A"/>
      <stop offset="0.5" stop-color="${colors.gold}"/>
      <stop offset="1" stop-color="${colors.primary}"/>
    </linearGradient>
    <linearGradient id="darkGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.dark}"/>
      <stop offset="1" stop-color="#34251C"/>
    </linearGradient>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#8E5A2A" flood-opacity="0.12"/>
    </filter>
    <filter id="heroShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#5F2C1B" flood-opacity="0.20"/>
    </filter>
    <filter id="avatarShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#4B2D20" flood-opacity="0.22"/>
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#FFF8EA" flood-opacity="0.90"/>
    </filter>
    <pattern id="paperGrid" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M36 0H0V36" fill="none" stroke="#B88C33" stroke-width="1" opacity="0.055"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#paperBg)"/>
  <rect width="${W}" height="${H}" fill="url(#paperGrid)"/>
  <circle cx="948" cy="94" r="294" fill="${colors.gold}" opacity="0.13"/>
  <circle cx="925" cy="492" r="374" fill="${colors.primary}" opacity="0.075"/>
  <circle cx="66" cy="1650" r="280" fill="${colors.gold}" opacity="0.09"/>
  <path d="M706 356C798 303 930 308 1036 370" fill="none" stroke="${colors.gold}" stroke-width="2" opacity="0.28"/>
  <path d="M702 382C818 330 946 358 1048 456" fill="none" stroke="${colors.primary}" stroke-width="2" opacity="0.14"/>

  <g opacity="0.10" transform="translate(744 245) scale(0.74)">
    <circle cx="200" cy="150" r="100" fill="none" stroke="${colors.primary}" stroke-width="20"/>
    <path d="M200 70 C180 90, 170 110, 180 130 C170 140, 175 155, 190 165 C195 160, 205 160, 210 165 C225 155, 230 140, 220 130 C230 110, 220 90, 200 70 L230 100 L250 80 L240 110 Z" fill="${colors.primary}"/>
    <path d="M225 150 C235 160, 240 170, 235 180 L215 165 Z" fill="${colors.primary}"/>
    <path d="M130 250 L200 120 L270 250 L230 250 L200 190 L170 250 Z" fill="${colors.gold}"/>
  </g>

  <g transform="translate(58 44)">
    <rect x="0" y="0" width="460" height="58" rx="18" fill="${colors.card}" stroke="${colors.border}" stroke-width="2"/>
    <circle cx="31" cy="29" r="17" fill="none" stroke="${colors.primary}" stroke-width="4"/>
    <path d="M31 16 C25 22 25 28 31 34 C37 28 37 22 31 16Z" fill="${colors.primary}"/>
    <path d="M16 48 L31 22 L46 48 L38 48 L31 36 L24 48 Z" fill="${colors.gold}"/>
    <text x="66" y="38" font-size="25" font-weight="850" fill="${colors.text}" font-family="PingFang SC, sans-serif">中汝达AI数字供暖 · 企业AI实战课</text>
  </g>

  <g transform="translate(838 50)">
    <rect x="0" y="0" width="184" height="58" rx="18" fill="url(#darkGrad)"/>
    <text x="92" y="38" text-anchor="middle" font-size="25" font-weight="850" fill="${colors.card}" font-family="PingFang SC, sans-serif">内部实战</text>
    <rect x="18" y="70" width="148" height="36" rx="18" fill="${colors.secondary}" stroke="${colors.border}" stroke-width="2"/>
    <text x="92" y="95" text-anchor="middle" font-size="20" font-weight="780" fill="${colors.gold}" font-family="PingFang SC, sans-serif">系列课程 · 01</text>
  </g>

  <text x="58" y="214" font-size="76" font-weight="950" fill="${colors.text}" font-family="PingFang SC, sans-serif">AI 不只是聊天</text>
  <text x="58" y="298" font-size="53" font-weight="900" fill="${colors.primary}" font-family="PingFang SC, sans-serif">已经开始替企业干活了</text>
  <rect x="60" y="344" width="594" height="56" rx="18" fill="${colors.secondary}" stroke="${colors.border}" stroke-width="2"/>
  <text x="82" y="382" font-size="25" font-weight="820" fill="${colors.gold}" font-family="PingFang SC, sans-serif">让第一波用 AI 转型的企业先富起来</text>
  <rect x="60" y="422" width="518" height="104" rx="22" fill="${colors.card}" stroke="${colors.border}" stroke-width="2" filter="url(#cardShadow)"/>
  <text x="90" y="469" font-size="42" font-weight="950" fill="${colors.primary}" font-family="PingFang SC, sans-serif">明远老师</text>
  <text x="90" y="506" font-size="25" font-weight="760" fill="${colors.regular}" font-family="PingFang SC, sans-serif">企业AI转型战略顾问</text>
  <path d="M440 448H546" stroke="${colors.gold}" stroke-width="5" stroke-linecap="round"/>
  <path d="M440 480H520" stroke="${colors.primary}" stroke-width="5" stroke-linecap="round" opacity="0.72"/>

  <ellipse cx="838" cy="545" rx="260" ry="360" fill="${colors.secondary}" opacity="0.72"/>
  <ellipse cx="842" cy="588" rx="296" ry="345" fill="${colors.gold}" opacity="0.10"/>
  <image x="650" y="260" width="406" height="414" href="data:image/png;base64,${avatarBase64}" preserveAspectRatio="xMidYMid meet" filter="url(#avatarShadow)"/>
  <path d="M592 638C706 690 888 698 1052 634L1052 782L592 782Z" fill="${colors.bg}" opacity="0.76"/>
  <ellipse cx="835" cy="706" rx="264" ry="58" fill="${colors.card}" opacity="0.54"/>

  <rect x="58" y="632" width="675" height="222" rx="28" fill="url(#sealGrad)" filter="url(#heroShadow)"/>
  <rect x="58" y="632" width="675" height="222" rx="28" fill="none" stroke="#FFF5E3" stroke-width="3" opacity="0.78"/>
  ${linesText(["《企业 AI 团队提效实战课》", "文档 · 表格 · 会议 · 内容"], 92, 704, 42, 58, 900, colors.card)}

  ${card(58, 914, 964, 468, 30)}
  <text x="92" y="984" font-size="40" font-weight="900" fill="${colors.primary}" font-family="PingFang SC, sans-serif">这次只讲四件事</text>
  ${compactPointRows([
    "Codex 为什么突然火了",
    "AI 如何从聊天变成干活",
    "WorkBuddy 怎么帮团队实战",
    "企业哪些场景最适合 AI 化",
  ], 92, 1074)}

  <g transform="translate(58 1430)">
    <rect x="0" y="0" width="964" height="104" rx="30" fill="${colors.card}" stroke="${colors.border}" stroke-width="2" filter="url(#cardShadow)"/>
    <text x="34" y="45" font-size="29" font-weight="850" fill="${colors.text}" font-family="PingFang SC, sans-serif">不讲虚的，不只教按钮。</text>
    <text x="34" y="82" font-size="24" font-weight="620" fill="${colors.regular}" font-family="PingFang SC, sans-serif">目标是让 AI 进入文档、表格、会议和内容工作流。</text>
  </g>

  <g transform="translate(58 1586)">
    <rect x="0" y="0" width="964" height="118" rx="30" fill="${colors.secondary}" stroke="${colors.border}" stroke-width="2" filter="url(#cardShadow)"/>
    <text x="34" y="48" font-size="26" font-weight="820" fill="${colors.text}" font-family="PingFang SC, sans-serif">适合管理层、业务负责人、运营/文档/会议协作岗位，</text>
    <text x="34" y="86" font-size="26" font-weight="820" fill="${colors.text}" font-family="PingFang SC, sans-serif">以及想把 AI 真正用进团队工作的人。</text>
  </g>

  <g transform="translate(58 1744)">
    <rect x="0" y="0" width="964" height="92" rx="46" fill="url(#darkGrad)" filter="url(#heroShadow)"/>
    <text x="482" y="59" text-anchor="middle" font-size="38" font-weight="950" fill="${colors.card}" font-family="PingFang SC, sans-serif"><tspan fill="${colors.gold}">Codex</tspan> 看未来，<tspan fill="#F0C86A">WorkBuddy</tspan> 先落地</text>
  </g>
</svg>`;

await fs.writeFile(svgPath, svg);
await sharp(Buffer.from(svg)).png().toFile(pngPath);

const metadata = await sharp(pngPath).metadata();
console.log(`${pngPath} ${metadata.width}x${metadata.height}`);
