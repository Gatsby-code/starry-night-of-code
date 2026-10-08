/* ============================================================
   星夜 · 代码 —— 交互核心
   Canvas 星空渲染 + 星座连线 + 点亮收集 + 搜索 + 极客试炼
   ============================================================ */
"use strict";

/* ---------- 工具 ---------- */
const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOUCH = window.matchMedia("(pointer: coarse)").matches;

const byId = {};
MILESTONES.forEach((m) => (byId[m.id] = m));
const CHRONO = [...MILESTONES].sort((a, b) => a.year - b.year);
const CONST_BY_ID = {};
CONSTELLATIONS.forEach((c) => (CONST_BY_ID[c.id] = c));

/* ---------- 点亮进度（本地保存） ---------- */
const LIT_KEY = "snoc_lit";
const SEEN_KEY = "snoc_seen";
let lit = new Set(JSON.parse(localStorage.getItem(LIT_KEY) || "[]"));

function saveLit() {
  localStorage.setItem(LIT_KEY, JSON.stringify([...lit]));
  $("litCount").innerHTML = "已点亮 <b>" + lit.size + "</b> / " + MILESTONES.length + " 颗星";
}
saveLit();

/* ---------- Canvas 初始化 ---------- */
const canvas = $("sky");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

/* 恒星尘埃：固定随机种子的背景微星 */
let seed = 20260927;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const DUST = [];
for (let i = 0; i < 90; i++) {
  DUST.push({ x: rnd(), y: rnd(), r: 0.5 + rnd() * 1.1, p: rnd() * 6.28, s: 0.4 + rnd() * 0.8 });
}

/* ---------- 状态 ---------- */
let activeConst = null;
const lineProg = {};
CONSTELLATIONS.forEach((c) => (lineProg[c.id] = 0));
let meteors = [];
let nextMeteor = performance.now() + 6000;
const mouse = { x: 0.5, y: 0.5, px: 0, py: 0 };
let hoverStar = null;
let lastFrame = performance.now();

function starXY(m) { return { x: m.x * W, y: m.y * H }; }
function starBaseR(m) { return [0, 3.2, 4.6, 6.4][m.r] * (W < 720 ? 0.85 : 1); }

/* ---------- 绘制 ---------- */
function draw(t) {
  const dt = Math.min(t - lastFrame, 50); lastFrame = t;
  ctx.clearRect(0, 0, W, H);

  /* 背景微移视差 */
  if (!REDUCED && !TOUCH) {
    mouse.px += ((mouse.x - 0.5) * 22 - mouse.px) * 0.04;
    mouse.py += ((mouse.y - 0.5) * 14 - mouse.py) * 0.04;
    $("bg").style.transform = "translate3d(" + (-mouse.px).toFixed(2) + "px," + (-mouse.py).toFixed(2) + "px,0)";
  }

  /* 尘埃 */
  ctx.fillStyle = "#cfd4e8";
  for (const d of DUST) {
    const a = 0.10 + 0.14 * (0.5 + 0.5 * Math.sin(t * 0.0006 * d.s + d.p));
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* 星座连线（渐进展开） */
  for (const c of CONSTELLATIONS) {
    const target = activeConst === c.id ? 1 : 0;
    lineProg[c.id] += (target - lineProg[c.id]) * (REDUCED ? 1 : Math.min(1, dt * 0.004));
    const p = lineProg[c.id];
    if (p < 0.02) continue;
    const ids = LINES[c.id];
    const pts = ids.map((id) => starXY(byId[id]));
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    let budget = total * p;
    ctx.strokeStyle = "rgba(233,196,106,0.50)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (budget >= seg) { ctx.lineTo(pts[i].x, pts[i].y); budget -= seg; }
      else {
        const k = budget / seg;
        ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k);
        budget = 0; break;
      }
    }
    ctx.stroke();

    /* 星座名标注 */
    if (p > 0.55) {
      const cx = pts.reduce((s, q) => s + q.x, 0) / pts.length;
      const cy = pts.reduce((s, q) => s + q.y, 0) / pts.length;
      ctx.globalAlpha = Math.min(1, (p - 0.55) / 0.45) * 0.92;
      ctx.fillStyle = "#e9c46a";
      ctx.font = "15px 'Noto Serif SC','STZhongsong','SimSun',serif";
      ctx.textAlign = "center";
      ctx.fillText(c.name, cx, cy - 46);
      ctx.font = "9px 'Noto Serif SC',serif";
      ctx.fillStyle = "rgba(154,150,173,0.95)";
      ctx.fillText(c.en + " · " + c.years, cx, cy - 30);
      ctx.globalAlpha = 1;
    }
  }

  /* 星辰 */
  for (const m of MILESTONES) {
    const { x, y } = starXY(m);
    const r = starBaseR(m);
    const dimmed = activeConst && m.c !== activeConst;
    const tw = REDUCED ? 0 : Math.sin(t * 0.0016 + (m.x * 40 + m.y * 17));
    let alpha = (0.55 + 0.35 * tw) * (dimmed ? 0.18 : 1);
    const isLit = lit.has(m.id);

    ctx.globalAlpha = alpha;
    if (isLit) {
      ctx.shadowColor = "rgba(233,196,106,0.9)";
      ctx.shadowBlur = r * 4;
      ctx.fillStyle = "#e9c46a";
    } else {
      ctx.shadowColor = "rgba(200,210,255,0.7)";
      ctx.shadowBlur = r * 2.5;
      ctx.fillStyle = "#cdd6f4";
    }
    /* 四芒星光斑（仅 3 级星） */
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.shadowBlur = 0;
    if (m.r === 3 && !dimmed) {
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = isLit ? "rgba(233,196,106,0.8)" : "rgba(205,214,244,0.7)";
      ctx.lineWidth = 0.8;
      const L = r * (2.6 + 0.5 * tw);
      ctx.beginPath();
      ctx.moveTo(x - L, y); ctx.lineTo(x + L, y);
      ctx.moveTo(x, y - L); ctx.lineTo(x, y + L);
      ctx.stroke();
    }
    /* 已点亮的星加一圈光环 */
    if (isLit && !dimmed) {
      ctx.globalAlpha = 0.5 + 0.2 * tw;
      ctx.strokeStyle = "rgba(233,196,106,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r + 5.5, 0, 6.2832); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* 流星 */
  if (!REDUCED) {
    if (t > nextMeteor) { spawnMeteor(); nextMeteor = t + 8000 + Math.random() * 9000; }
    meteors = meteors.filter((mt) => mt.life > 0);
    for (const mt of meteors) {
      mt.x += mt.vx * dt; mt.y += mt.vy * dt; mt.life -= dt;
      const k = Math.min(1, mt.life / 400);
      const grad = ctx.createLinearGradient(mt.x, mt.y, mt.x - mt.vx * 90, mt.y - mt.vy * 90);
      grad.addColorStop(0, "rgba(240,235,214," + 0.9 * k + ")");
      grad.addColorStop(1, "rgba(240,235,214,0)");
      ctx.strokeStyle = grad; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(mt.x, mt.y); ctx.lineTo(mt.x - mt.vx * 90, mt.y - mt.vy * 90); ctx.stroke();
    }
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

function spawnMeteor() {
  const ang = Math.PI * (0.15 + Math.random() * 0.25);
  const sp = 0.55 + Math.random() * 0.4;
  meteors.push({
    x: Math.random() * W * 0.7, y: Math.random() * H * 0.3,
    vx: Math.cos(ang) * sp * 0.6, vy: Math.sin(ang) * sp * 0.4,
    life: 900,
  });
}

/* ---------- 悬停 / 点击命中 ---------- */
const tt = $("tt");
function hitTest(px, py) {
  let best = null, bestD = 1e9;
  for (const m of MILESTONES) {
    const { x, y } = starXY(m);
    const d = Math.hypot(px - x, py - y);
    if (d < Math.max(16, starBaseR(m) + 9) && d < bestD) { best = m; bestD = d; }
  }
  return best;
}

canvas.addEventListener("pointermove", (e) => {
  mouse.x = e.clientX / W; mouse.y = e.clientY / H;
  const m = hitTest(e.clientX, e.clientY);
  hoverStar = m;
  canvas.style.cursor = m ? "pointer" : "crosshair";
  if (m && !TOUCH) {
    tt.hidden = false;
    tt.style.left = Math.min(e.clientX + 16, W - 190) + "px";
    tt.style.top = (e.clientY - 14) + "px";
    tt.innerHTML = '<div class="t-year">' + m.year + " · " + CONST_BY_ID[m.c].name + '</div><div class="t-title">' + m.title + "</div>";
  } else tt.hidden = true;
});
canvas.addEventListener("pointerleave", () => (tt.hidden = true));
canvas.addEventListener("click", (e) => {
  const m = hitTest(e.clientX, e.clientY);
  if (m) openStar(m.id);
});

/* ---------- 星辰卡片 ---------- */
let currentStar = null;
function openStar(id) {
  const m = byId[id];
  currentStar = id;
  const pos = CHRONO.indexOf(m) + 1;
  $("cardYear").textContent = m.year;
  $("cardConst").textContent = CONST_BY_ID[m.c].name + " · " + CONST_BY_ID[m.c].en;
  $("cardTitle").textContent = m.title;
  $("cardPerson").textContent = m.person;
  $("cardText").textContent = m.text;
  $("cardIndex").textContent = "第 " + pos + " / " + CHRONO.length + " 颗";
  if (!lit.has(id)) { lit.add(id); saveLit(); }
  openModal("cardModal");
}
$("prevStar").addEventListener("click", () => {
  const i = CHRONO.findIndex((m) => m.id === currentStar);
  openStar(CHRONO[(i - 1 + CHRONO.length) % CHRONO.length].id);
});
$("nextStar").addEventListener("click", () => {
  const i = CHRONO.findIndex((m) => m.id === currentStar);
  openStar(CHRONO[(i + 1) % CHRONO.length].id);
});

/* ---------- 浮层通用 ---------- */
function openModal(id) { $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; }
document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => closeModal(b.dataset.close))
);
document.querySelectorAll(".overlay").forEach((ov) =>
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.hidden = true; })
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".overlay").forEach((ov) => (ov.hidden = true));
  if (e.key === "ArrowLeft" && !$("cardModal").hidden) $("prevStar").click();
  if (e.key === "ArrowRight" && !$("cardModal").hidden) $("nextStar").click();
});
$("aboutBtn").addEventListener("click", () => openModal("about"));

/* ---------- 时代星宿栏 ---------- */
const eraBar = $("eraBar");
const allChip = document.createElement("button");
allChip.className = "chip active";
allChip.innerHTML = '全部星空<span class="cy">ALL SKIES</span>';
allChip.addEventListener("click", () => setActive(null));
eraBar.appendChild(allChip);
CONSTELLATIONS.forEach((c) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.innerHTML = c.name + '<span class="cy">' + c.years + "</span>";
  b.addEventListener("click", () => setActive(c.id));
  eraBar.appendChild(b);
});
function setActive(id) {
  activeConst = id;
  [...eraBar.children].forEach((chip, i) =>
    chip.classList.toggle("active", (id === null && i === 0) || (id !== null && i > 0 && CONSTELLATIONS[i - 1].id === id))
  );
  tt.hidden = true;
}

/* ---------- 掷一颗星 ---------- */
$("randomBtn").addEventListener("click", () => {
  spawnMeteor();
  const pool = MILESTONES.filter((m) => m.id !== currentStar);
  const m = pool[Math.floor(Math.random() * pool.length)];
  if (REDUCED) openStar(m.id);
  else setTimeout(() => openStar(m.id), 550);
});

/* ---------- 搜索 ---------- */
const searchBox = $("searchBox");
const searchResults = $("searchResults");
searchBox.addEventListener("input", () => {
  const q = searchBox.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (!q) { searchResults.hidden = true; return; }
  const hits = MILESTONES.filter((m) =>
    (m.title + m.person + m.year + m.text + CONST_BY_ID[m.c].name).toLowerCase().includes(q)
  ).slice(0, 8);
  if (!hits.length) {
    searchResults.innerHTML = '<button disabled style="color:var(--dim)">夜空里暂时没有这颗星</button>';
  } else {
    hits.forEach((m) => {
      const b = document.createElement("button");
      b.innerHTML = '<span class="yr">' + m.year + "</span><span>" + m.title + "</span>";
      b.addEventListener("mousedown", () => { searchResults.hidden = true; searchBox.value = ""; openStar(m.id); });
      searchResults.appendChild(b);
    });
  }
  searchResults.hidden = false;
});
searchBox.addEventListener("blur", () => setTimeout(() => (searchResults.hidden = true), 180));

/* ---------- 极客试炼 ---------- */
let qIdx = 0, qScore = 0, qLock = false;
const SCORE_TITLES = [
  [10, "图灵座 · 传说", "十题全中。你的名字值得被画进这片星空。"],
  [8, "深蓝座 · 大师", "只差一步登顶——深蓝当年也是从一盘棋学起的。"],
  [6, "阿尔法 · 行家", "稳扎稳打，星星已经记住了你。"],
  [3, "见习工程师", "夜路刚开始走，46 颗星都在等你点亮。"],
  [0, "仰望星空的新朋友", "没关系，梵高第一笔也画歪过。回到星图里逛逛吧。"],
];
$("quizBtn").addEventListener("click", startQuiz);
$("introQuiz").addEventListener("click", () => { markSeen(); closeModal("intro"); startQuiz(); });
$("introStart").addEventListener("click", () => { markSeen(); closeModal("intro"); });

function startQuiz() {
  qIdx = 0; qScore = 0; qLock = false;
  $("quizResult").hidden = true;
  $("quizQuestion").style.display = "";
  $("quizOptions").style.display = "";
  renderDots();
  renderQuestion();
  openModal("quiz");
}
function renderDots() {
  $("quizDots").innerHTML = QUIZ.map((_, i) =>
    '<i data-i="' + i + '" class="' + (i === qIdx && qIdx < QUIZ.length ? "now " : "") + '"></i>'
  ).join("");
}
function renderQuestion() {
  const q = QUIZ[qIdx];
  $("quizQuestion").textContent = "Q" + (qIdx + 1) + " · " + q.q;
  const box = $("quizOptions");
  box.innerHTML = "";
  const old = document.querySelector(".quiz-explain");
  if (old) old.remove();
  q.opts.forEach((opt, i) => {
    const b = document.createElement("button");
    b.textContent = String.fromCharCode(65 + i) + " . " + opt;
    b.addEventListener("click", () => answer(i, b));
    box.appendChild(b);
  });
}
function answer(i, btn) {
  if (qLock) return;
  qLock = true;
  const q = QUIZ[qIdx];
  const buttons = [...$("quizOptions").children];
  buttons.forEach((b) => (b.disabled = true));
  buttons[q.a].classList.add("correct");
  if (i !== q.a) { btn.classList.add("wrong"); } else qScore++;
  const dot = document.querySelector('.quiz-dots i[data-i="' + qIdx + '"]');
  if (dot) dot.classList.add(i === q.a ? "done" : "wrong");
  const ex = document.createElement("p");
  ex.className = "quiz-explain";
  ex.textContent = (i === q.a ? "√ " : "× ") + q.why;
  $("quizOptions").after(ex);
  setTimeout(() => {
    qIdx++; qLock = false;
    if (qIdx < QUIZ.length) { renderDots(); renderQuestion(); }
    else showResult();
  }, REDUCED ? 400 : 1900);
}
function showResult() {
  const hit = SCORE_TITLES.find(([min]) => qScore >= min);
  $("quizQuestion").style.display = "none";
  $("quizOptions").style.display = "none";
  const ex = document.querySelector(".quiz-explain");
  if (ex) ex.remove();
  document.querySelectorAll(".quiz-dots i").forEach((d) => (d.className = "done"));
  $("resultTitle").textContent = hit[1];
  $("resultScore").textContent = "答对 " + qScore + " / " + QUIZ.length + " 题";
  $("resultNote").textContent = hit[2];
  $("quizResult").hidden = false;
}
$("retryQuiz").addEventListener("click", startQuiz);
$("copyScore").addEventListener("click", async () => {
  const t = "我在《星夜 · 代码》的极客试炼中答对 " + qScore + "/" + QUIZ.length +
    "，获得称号「" + $("resultTitle").textContent + "」。来星空里数数你能点亮几颗星！";
  try { await navigator.clipboard.writeText(t); flash($("copyScore"), "已复制"); }
  catch (_) {
    const ta = document.createElement("textarea");
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); flash($("copyScore"), "已复制"); } catch (_) { flash($("copyScore"), "复制失败"); }
    ta.remove();
  }
});
function flash(btn, txt) {
  const old = btn.textContent;
  btn.textContent = txt;
  setTimeout(() => (btn.textContent = old), 1400);
}

/* ---------- 首次到访 ---------- */
function markSeen() { localStorage.setItem(SEEN_KEY, "1"); }
if (!localStorage.getItem(SEEN_KEY)) openModal("intro");
