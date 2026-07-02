import fs from "fs/promises";
import { createRequire } from "module";

const require = createRequire("/Users/xiangyu/Desktop/明动aim智能体/clipflow/package.json");
const sharp = require("sharp");

const outDir = "/Users/xiangyu/Desktop/明动aim智能体/artifacts/posters";
const logoPath = "/Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web/public/branding/mingyuan-aim-logo.svg";
const avatarPath = `${outDir}/mingyuan-cutout-bust.png`;
const svgPath = `${outDir}/zhongruda-ai-9concepts-poster.svg`;
const pngPath = `${outDir}/zhongruda-ai-9concepts-poster.png`;

const W = 1080;
const H = 1920;
const C = {
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

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const logoBase64 = (await fs.readFile(logoPath)).toString("base64");
const avatarBase64 = (await fs.readFile(avatarPath)).toString("base64");

function concept({ n, title, desc, x, y }) {
  return `<g transform="translate(${x} ${y})">
    <rect width="452" height="98" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2" filter="url(#cardShadow)"/>
    <rect x="24" y="23" width="52" height="52" rx="16" fill="url(#sealGrad)"/>
    <text x="50" y="59" text-anchor="middle" font-size="27" font-weight="900" fill="${C.card}" font-family="PingFang SC, sans-serif">${n}</text>
    <text x="96" y="42" font-size="30" font-weight="900" fill="${C.text}" font-family="PingFang SC, sans-serif">${esc(title)}</text>
    <text x="96" y="75" font-size="22" font-weight="650" fill="${C.regular}" font-family="PingFang SC, sans-serif">${esc(desc)}</text>
  </g>`;
}

const concepts = [
  ["模型", "AI 的大脑"],
  ["提示词", "下任务的语言"],
  ["知识库", "懂中汝达业务"],
  ["RAG", "从资料中找答案"],
  ["工作流", "把经验变流程"],
  ["工具调用", "操作外部软件"],
  ["MCP", "连接业务系统"],
  ["智能体", "连续执行任务"],
  ["业务场景", "增长 · 效率 · 交付"],
];

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="paperBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFCF7"/>
      <stop offset="0.55" stop-color="${C.bg}"/>
      <stop offset="1" stop-color="${C.secondary}"/>
    </linearGradient>
    <linearGradient id="sealGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.primary}"/>
      <stop offset="1" stop-color="${C.gold}"/>
    </linearGradient>
    <linearGradient id="darkGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.dark}"/>
      <stop offset="1" stop-color="#37251B"/>
    </linearGradient>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#8E5A2A" flood-opacity="0.11"/>
    </filter>
    <filter id="heroShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#5F2C1B" flood-opacity="0.18"/>
    </filter>
    <filter id="avatarShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#4B2D20" flood-opacity="0.20"/>
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#FFF8EA" flood-opacity="0.90"/>
    </filter>
    <pattern id="paperGrid" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M36 0H0V36" fill="none" stroke="${C.gold}" stroke-width="1" opacity="0.055"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#paperBg)"/>
  <rect width="${W}" height="${H}" fill="url(#paperGrid)"/>
  <circle cx="980" cy="142" r="286" fill="${C.gold}" opacity="0.13"/>
  <circle cx="900" cy="520" r="392" fill="${C.primary}" opacity="0.07"/>
  <circle cx="50" cy="1650" r="292" fill="${C.gold}" opacity="0.10"/>

  <g transform="translate(58 44)">
    <rect x="0" y="0" width="964" height="116" rx="28" fill="${C.card}" stroke="${C.border}" stroke-width="2" filter="url(#cardShadow)"/>
    <image x="20" y="10" width="86" height="96" href="data:image/svg+xml;base64,${logoBase64}" preserveAspectRatio="xMidYMid meet"/>
    <text x="126" y="49" font-size="29" font-weight="900" fill="${C.text}" font-family="PingFang SC, sans-serif">中汝达AI数字供暖 · 企业AI实战课</text>
    <text x="126" y="84" font-size="22" font-weight="680" fill="${C.regular}" font-family="PingFang SC, sans-serif">明远AIM｜企业AI增长大脑</text>
    <rect x="744" y="28" width="176" height="58" rx="18" fill="url(#darkGrad)"/>
    <text x="832" y="66" text-anchor="middle" font-size="25" font-weight="850" fill="${C.card}" font-family="PingFang SC, sans-serif">内部学习</text>
    <rect x="616" y="34" width="112" height="46" rx="23" fill="${C.secondary}" stroke="${C.border}" stroke-width="2"/>
    <text x="672" y="64" text-anchor="middle" font-size="18" font-weight="820" fill="${C.gold}" font-family="PingFang SC, sans-serif">系列 · 02</text>
  </g>

  <text x="58" y="252" font-size="66" font-weight="950" fill="${C.text}" font-family="PingFang SC, sans-serif">AI 时代必懂的</text>
  <text x="58" y="335" font-size="86" font-weight="950" fill="${C.primary}" font-family="PingFang SC, sans-serif">9 个基础概念</text>
  <rect x="60" y="374" width="654" height="58" rx="18" fill="${C.secondary}" stroke="${C.border}" stroke-width="2"/>
  <text x="88" y="413" font-size="27" font-weight="850" fill="${C.gold}" font-family="PingFang SC, sans-serif">从会聊天，到懂业务、会干活</text>
  <ellipse cx="838" cy="545" rx="260" ry="360" fill="${C.secondary}" opacity="0.72"/>
  <ellipse cx="842" cy="588" rx="296" ry="345" fill="${C.gold}" opacity="0.10"/>
  <image x="650" y="260" width="406" height="414" href="data:image/png;base64,${avatarBase64}" preserveAspectRatio="xMidYMid meet" filter="url(#avatarShadow)"/>
  <path d="M592 638C706 690 888 698 1052 634L1052 782L592 782Z" fill="${C.bg}" opacity="0.76"/>
  <ellipse cx="835" cy="706" rx="264" ry="58" fill="${C.card}" opacity="0.54"/>
  <rect x="60" y="455" width="518" height="104" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2" filter="url(#cardShadow)"/>
  <text x="90" y="502" font-size="42" font-weight="950" fill="${C.primary}" font-family="PingFang SC, sans-serif">明远老师</text>
  <text x="90" y="539" font-size="25" font-weight="760" fill="${C.regular}" font-family="PingFang SC, sans-serif">企业AI转型战略顾问</text>
  <path d="M440 481H546" stroke="${C.gold}" stroke-width="5" stroke-linecap="round"/>
  <path d="M440 513H520" stroke="${C.primary}" stroke-width="5" stroke-linecap="round" opacity="0.72"/>

  <rect x="58" y="650" width="675" height="154" rx="28" fill="url(#sealGrad)" filter="url(#heroShadow)"/>
  <rect x="58" y="650" width="675" height="154" rx="28" fill="none" stroke="#FFF5E3" stroke-width="3" opacity="0.78"/>
  <text x="92" y="712" font-size="42" font-weight="950" fill="${C.card}" font-family="PingFang SC, sans-serif">《AI 时代必懂概念课》</text>
  <text x="92" y="762" font-size="31" font-weight="850" fill="${C.card}" font-family="PingFang SC, sans-serif">模型 · 知识库 · 工作流 · 智能体</text>

  <rect x="58" y="854" width="964" height="700" rx="34" fill="${C.card}" stroke="${C.border}" stroke-width="2" filter="url(#cardShadow)"/>
  <text x="92" y="918" font-size="36" font-weight="950" fill="${C.primary}" font-family="PingFang SC, sans-serif">不是背术语，是看懂企业 AI 怎么落地</text>
  <text x="92" y="962" font-size="23" font-weight="680" fill="${C.regular}" font-family="PingFang SC, sans-serif">每个概念只讲三件事：是什么、怎么理解、在中汝达怎么用。</text>

  ${concept({ n: 1, title: concepts[0][0], desc: concepts[0][1], x: 92, y: 1008 })}
  ${concept({ n: 2, title: concepts[1][0], desc: concepts[1][1], x: 536, y: 1008 })}
  ${concept({ n: 3, title: concepts[2][0], desc: concepts[2][1], x: 92, y: 1110 })}
  ${concept({ n: 4, title: concepts[3][0], desc: concepts[3][1], x: 536, y: 1110 })}
  ${concept({ n: 5, title: concepts[4][0], desc: concepts[4][1], x: 92, y: 1212 })}
  ${concept({ n: 6, title: concepts[5][0], desc: concepts[5][1], x: 536, y: 1212 })}
  ${concept({ n: 7, title: concepts[6][0], desc: concepts[6][1], x: 92, y: 1314 })}
  ${concept({ n: 8, title: concepts[7][0], desc: concepts[7][1], x: 536, y: 1314 })}
  <g transform="translate(92 1416)">
    <rect width="896" height="118" rx="26" fill="url(#darkGrad)" filter="url(#heroShadow)"/>
    <rect x="28" y="31" width="58" height="58" rx="18" fill="${C.gold}"/>
    <text x="57" y="71" text-anchor="middle" font-size="30" font-weight="950" fill="${C.dark}" font-family="PingFang SC, sans-serif">9</text>
    <text x="112" y="55" font-size="34" font-weight="950" fill="${C.card}" font-family="PingFang SC, sans-serif">业务场景</text>
    <text x="112" y="91" font-size="25" font-weight="760" fill="#D7C4A0" font-family="PingFang SC, sans-serif">最终为增长、效率、交付服务</text>
  </g>

  <g transform="translate(58 1584)">
    <rect x="0" y="0" width="964" height="150" rx="34" fill="${C.secondary}" stroke="${C.border}" stroke-width="2" filter="url(#cardShadow)"/>
    <text x="34" y="58" font-size="29" font-weight="900" fill="${C.text}" font-family="PingFang SC, sans-serif">中汝达的 AI 学习路线</text>
    <text x="34" y="104" font-size="25" font-weight="720" fill="${C.regular}" font-family="PingFang SC, sans-serif">先懂概念，再练岗位场景，最后沉淀成知识库、工作流和智能体。</text>
  </g>

  <g transform="translate(58 1740)">
    <rect x="0" y="0" width="964" height="92" rx="46" fill="url(#sealGrad)" filter="url(#heroShadow)"/>
    <text x="482" y="59" text-anchor="middle" font-size="36" font-weight="950" fill="${C.card}" font-family="PingFang SC, sans-serif">模型 · 知识库 · 工作流 · 智能体 · 业务场景</text>
  </g>

</svg>`;

await fs.writeFile(svgPath, svg);
await sharp(Buffer.from(svg)).png().toFile(pngPath);

const metadata = await sharp(pngPath).metadata();
console.log(`${pngPath} ${metadata.width}x${metadata.height}`);
