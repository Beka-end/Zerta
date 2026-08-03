// api/_render.js — движок сайтов WeDesign v2.
// Верстает только сервер. Каждый сайт собирается из «ДНК дизайна»:
// палитра, шрифты, тип первого экрана, движение, фактура и порядок блоков.

const crypto = require('crypto');
const { esc, clean } = require('./_lib');

/* ══════════════════════════ палитры ══════════════════════════ */
// g1/g2 — пара для градиентных заливок и mesh-пятен.

const PALETTES = [
  { n:'obsidian',   mode:'dark',  bg:'#08090C', surf:'#101319', tx:'#F4F6FA', mu:'#8B93A6', ac:'#5B8CFF', g1:'#5B8CFF', g2:'#B14BFF' },
  { n:'aurora',     mode:'dark',  bg:'#050B12', surf:'#0D1720', tx:'#EAF6FA', mu:'#7E97A6', ac:'#2FE0B0', g1:'#2FE0B0', g2:'#2C7BE5' },
  { n:'ember',      mode:'dark',  bg:'#0F0908', surf:'#1A100D', tx:'#FBF1EC', mu:'#A78E82', ac:'#FF6A3D', g1:'#FF6A3D', g2:'#FFC44D' },
  { n:'violet-deep',mode:'dark',  bg:'#0A0714', surf:'#150F24', tx:'#F3EFFC', mu:'#9A8FBA', ac:'#A78BFA', g1:'#A78BFA', g2:'#F472B6' },
  { n:'forest-deep',mode:'dark',  bg:'#050D0A', surf:'#0D1A14', tx:'#EAF7F0', mu:'#84A695', ac:'#4ADE80', g1:'#4ADE80', g2:'#A3E635' },
  { n:'midnight',   mode:'dark',  bg:'#070B16', surf:'#101828', tx:'#EEF2F9', mu:'#8896AE', ac:'#818CF8', g1:'#818CF8', g2:'#38BDF8' },
  { n:'wine',       mode:'dark',  bg:'#100609', surf:'#1D0D13', tx:'#FBEEF1', mu:'#AE8A93', ac:'#F43F5E', g1:'#F43F5E', g2:'#FB923C' },
  { n:'graphite',   mode:'dark',  bg:'#0B0B0B', surf:'#161616', tx:'#F5F5F5', mu:'#909090', ac:'#EAB308', g1:'#EAB308', g2:'#F97316' },

  { n:'porcelain',  mode:'light', bg:'#FAFAFA', surf:'#FFFFFF', tx:'#0A0A0A', mu:'#6B6B6B', ac:'#111111', g1:'#111111', g2:'#5B5B5B' },
  { n:'linen',      mode:'light', bg:'#F7F4EF', surf:'#FFFFFF', tx:'#1C1917', mu:'#79706A', ac:'#B45309', g1:'#B45309', g2:'#D97706' },
  { n:'sky-soft',   mode:'light', bg:'#F4F8FD', surf:'#FFFFFF', tx:'#0B1B2B', mu:'#64778C', ac:'#0B63CE', g1:'#0B63CE', g2:'#22D3EE' },
  { n:'sage',       mode:'light', bg:'#F3F7F3', surf:'#FFFFFF', tx:'#10231A', mu:'#5F7A6C', ac:'#0F8A5F', g1:'#0F8A5F', g2:'#84CC16' },
  { n:'blush',      mode:'light', bg:'#FDF5F6', surf:'#FFFFFF', tx:'#26131A', mu:'#8A6874', ac:'#BE185D', g1:'#BE185D', g2:'#F97316' },
  { n:'lavender-l', mode:'light', bg:'#F6F5FF', surf:'#FFFFFF', tx:'#1A1730', mu:'#6D688F', ac:'#5B4BE0', g1:'#5B4BE0', g2:'#C084FC' },
  { n:'sand',       mode:'light', bg:'#FBF8F1', surf:'#FFFFFF', tx:'#1F2933', mu:'#6F7C89', ac:'#1D4ED8', g1:'#1D4ED8', g2:'#F59E0B' },
  { n:'mono-warm',  mode:'light', bg:'#F5F3F0', surf:'#FFFFFF', tx:'#171412', mu:'#6E6660', ac:'#7C3AED', g1:'#7C3AED', g2:'#EC4899' },
  { n:'ice-light',  mode:'light', bg:'#EFF3F6', surf:'#FFFFFF', tx:'#0E1A22', mu:'#5F7482', ac:'#0E7490', g1:'#0E7490', g2:'#34D399' },
  { n:'citrus',     mode:'light', bg:'#FCFBF3', surf:'#FFFFFF', tx:'#1B1D10', mu:'#727761', ac:'#4D7C0F', g1:'#4D7C0F', g2:'#FACC15' },

  // розово-красная группа
  { n:'rose-warm',  mode:'light', bg:'#FFF5F5', surf:'#FFFFFF', tx:'#2B1216', mu:'#8C6067', ac:'#E11D48', g1:'#E11D48', g2:'#FB7185' },
  { n:'coral',      mode:'light', bg:'#FFF7F4', surf:'#FFFFFF', tx:'#2A1712', mu:'#8A6A5E', ac:'#F43F5E', g1:'#F43F5E', g2:'#FB923C' },
  { n:'ruby-dark',  mode:'dark',  bg:'#150609', surf:'#240C13', tx:'#FDEEF1', mu:'#B58A94', ac:'#FF4D6D', g1:'#FF4D6D', g2:'#FF8FA3' },
  { n:'fuchsia',    mode:'light', bg:'#FDF4FA', surf:'#FFFFFF', tx:'#2A1226', mu:'#8B6480', ac:'#DB2777', g1:'#DB2777', g2:'#F0ABFC' },
  { n:'crimson',    mode:'dark',  bg:'#120608', surf:'#1F0B10', tx:'#FCEEF0', mu:'#AE8890', ac:'#DC2626', g1:'#DC2626', g2:'#F472B6' },
  { n:'peach',      mode:'light', bg:'#FFF8F3', surf:'#FFFFFF', tx:'#2B1A12', mu:'#8B7060', ac:'#EA580C', g1:'#EA580C', g2:'#FDA4AF' },
];

// Группы палитр по настроению — чтобы учитывать пожелания владельца.
// Индексы соответствуют порядку в PALETTES выше.
const MOODS = {
  pink:   [18, 19, 20, 21, 23],          // rose-warm, coral, ruby-dark, fuchsia, peach
  red:    [6, 18, 19, 20, 22],           // wine + розово-красные
  orange: [2, 19, 23],                   // ember, coral, peach
  blue:   [0, 5, 10, 14, 16],            // obsidian, midnight, sky-soft, sand, ice-light
  green:  [4, 11, 17],                   // forest-deep, sage, citrus
  purple: [3, 13, 21],                   // violet-deep, lavender-l, fuchsia
  yellow: [7, 17],                       // graphite, citrus
  dark:   [0, 1, 2, 3, 4, 5, 6, 7, 20, 22],
  light:  [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 23],
  mono:   [7, 8, 15],
};

/* ══════════════════════════ шрифты ══════════════════════════ */

const FONTS = [
  { d:'Unbounded',         b:'Golos Text',     dw:800, s:'-.045em', t:'none' },
  { d:'Manrope',           b:'Manrope',        dw:800, s:'-.045em', t:'none' },
  { d:'Playfair Display',  b:'Manrope',        dw:700, s:'-.02em',  t:'none' },
  { d:'Oswald',            b:'PT Sans',        dw:600, s:'.005em',  t:'uppercase' },
  { d:'Cormorant Garamond',b:'Inter',          dw:700, s:'-.01em',  t:'none' },
  { d:'Bitter',            b:'Onest',          dw:700, s:'-.03em',  t:'none' },
  { d:'Rubik',             b:'Nunito Sans',    dw:800, s:'-.04em',  t:'none' },
  { d:'Alegreya',          b:'Fira Sans',      dw:800, s:'-.015em', t:'none' },
  { d:'Merriweather',      b:'Source Sans 3',  dw:700, s:'-.025em', t:'none' },
  { d:'Yeseva One',        b:'Jost',           dw:400, s:'-.01em',  t:'none' },
  { d:'Raleway',           b:'Noto Sans',      dw:800, s:'-.045em', t:'none' },
  { d:'Philosopher',       b:'Ubuntu',         dw:700, s:'-.02em',  t:'none' },
  { d:'Jost',              b:'Jost',           dw:700, s:'-.035em', t:'uppercase' },
  { d:'Golos Text',        b:'Golos Text',     dw:700, s:'-.04em',  t:'none' },
];

const HEROES  = ['mesh','sticky','marquee','overlap','bigtype','rule','gradient','luxe','glass','sky'];
const MOTION  = ['up','mask','stagger','scale'];
const SHAPE   = [0, 4, 12, 20, 28, 999];
const NAVS    = ['float', 'plain', 'rule'];
const SECTIONS = ['stats','services','about','process','gallery','reviews','faq'];

// Варианты раскладки внутри блоков — от них зависит, как выглядит сайт,
// а не только какого он цвета.
const LAY_SERVICES = ['cards', 'rows', 'numbered', 'price-list'];
const LAY_ABOUT    = ['split', 'centered', 'quote', 'wide'];
const LAY_HOURS    = ['table', 'grid', 'compact'];

const DAYS = [
  ['mon','Понедельник'],['tue','Вторник'],['wed','Среда'],['thu','Четверг'],
  ['fri','Пятница'],['sat','Суббота'],['sun','Воскресенье'],
];

/* ══════════════════════════ ДНК ══════════════════════════ */

function rnd(max){ return crypto.randomBytes(2).readUInt16BE(0) % max; }

/* ═══════ пожелания владельца ═══════ */
// Читаем описание и ищем прямые указания на цвет и настроение.
// Что нашли — сужает выбор палитры. Что не нашли — остаётся на жребий.

// Только прямые указания на цвет и настроение. Никаких догадок по сфере:
// «маникюр» не значит «розовый», это решает владелец, а не мы.
const WORDS = {
  pink:   ['розов', 'пудров', 'нежн'],
  red:    ['красн', 'алый', 'алого', 'бордов', 'вишнёв', 'вишнев'],
  orange: ['оранжев', 'персиков', 'коралл'],
  blue:   ['син', 'голуб', 'морск', 'лазурн', 'холодн'],
  green:  ['зелён', 'зелен', 'эко', 'природ', 'мятн', 'травян'],
  purple: ['фиолет', 'сирен', 'лаванд', 'пурпур'],
  yellow: ['жёлт', 'желт', 'солнечн', 'золот'],
  dark:   ['тёмн', 'темн', 'чёрн', 'черн', 'ночн', 'брутальн', 'строг', 'премиум', 'дорог'],
  light:  ['светл', 'бел', 'воздушн', 'лёгк', 'легк', 'минимал', 'чист'],
  mono:   ['чёрно-бел', 'черно-бел', 'монохром', 'без цвета', 'сдержанн'],
};

// «Не хочу розовый» не должно приводить к розовому.
const NEGATION = /(не|без|кроме)\s+\S{0,12}$/i;

function wishes(text){
  const low = String(text || '').toLowerCase();
  const found = [];
  Object.keys(WORDS).forEach(function(mood){
    const hit = WORDS[mood].some(function(w){
      const at = low.indexOf(w);
      if (at < 0) return false;
      // смотрим, нет ли отрицания прямо перед словом
      return !NEGATION.test(low.slice(Math.max(0, at - 16), at));
    });
    if (hit) found.push(mood);
  });
  return found;
}

// Из пожеланий собираем список подходящих палитр.
// Пересечение, если пожеланий несколько: «тёмный розовый» → ruby-dark, crimson.
function palettesFor(moods){
  if (!moods.length) return null;
  let ids = null;
  moods.forEach(function(m){
    const set = MOODS[m];
    if (!set) return;
    ids = ids === null ? set.slice() : ids.filter(function(i){ return set.indexOf(i) >= 0; });
  });
  if (!ids || !ids.length) {
    // пересечение пустое — берём объединение, чтобы не игнорировать человека совсем
    ids = [];
    moods.forEach(function(m){ (MOODS[m] || []).forEach(function(i){ if (ids.indexOf(i) < 0) ids.push(i); }); });
  }
  return ids.length ? ids : null;
}

function makeDNA(hint){
  const order = SECTIONS.slice();
  for (let i = order.length - 1; i > 0; i--){ const j = rnd(i+1); const t = order[i]; order[i] = order[j]; order[j] = t; }

  // Если владелец назвал цвет — выбираем только из подходящих палитр.
  const wanted = palettesFor(wishes(hint));
  const pal = wanted ? wanted[rnd(wanted.length)] : rnd(PALETTES.length);

  return {
    p: pal,
    f: rnd(FONTS.length),
    h: rnd(HEROES.length),
    m: rnd(MOTION.length),
    r: rnd(SHAPE.length),
    nv: rnd(NAVS.length),
    ls: rnd(LAY_SERVICES.length),
    la: rnd(LAY_ABOUT.length),
    lh: rnd(LAY_HOURS.length),
    grain: rnd(3) > 0,
    mesh: rnd(4) > 0,
    wide: rnd(2) === 1,
    order: order,
  };
}

function dnaKey(d){
  return [d.p,d.f,d.h,d.m,d.r,d.nv,d.ls,d.la,d.lh,+d.grain,+d.mesh,+d.wide,d.order.join('')].join('-');
}
function dnaCode(d){
  return 'DNA-' + crypto.createHash('sha256').update(dnaKey(d)).digest('hex').slice(0,6).toUpperCase();
}

/* ══════════════════════════ часы ══════════════════════════ */

// Время приводим к настоящему ЧЧ:ММ. «25:99» и «<script>» сюда не пройдут.
function safeTime(v, fallback){
  const m = String(v || '').match(/^\s*(\d{1,2})\s*[:.\s]\s*(\d{1,2})\s*$/);
  if (!m) return fallback;
  const h = Math.min(23, parseInt(m[1], 10));
  const mi = Math.min(59, parseInt(m[2], 10));
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}

function normalizeHours(input){
  const out = {};
  const src = (input && typeof input === 'object') ? input : {};
  DAYS.forEach(function(pair){
    const k = pair[0];
    const raw = src[k] && typeof src[k] === 'object' ? src[k] : {};
    out[k] = (raw.closed || (!raw.from && !raw.to))
      ? { closed: true }
      : { closed:false, from: safeTime(raw.from, '09:00'), to: safeTime(raw.to, '18:00') };
  });
  return out;
}

/* ══════════════════════════ фактура ══════════════════════════ */

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E\")";

/* ══════════════════════════ CSS ══════════════════════════ */

function css(dna, p, f){
  const r = SHAPE[dna.r];
  const maxw = dna.wide ? 1280 : 1080;
  const onAc = p.mode === 'dark' ? '#07080B' : '#FFFFFF';
  const glass = p.mode === 'dark' ? '#FFFFFF0A' : '#0000000A';
  const hair  = p.mode === 'dark' ? '#FFFFFF1A' : '#00000014';

  return `
:root{
 --bg:${p.bg};--surf:${p.surf};--tx:${p.tx};--mu:${p.mu};--ac:${p.ac};
 --g1:${p.g1};--g2:${p.g2};--on:${onAc};--glass:${glass};--hair:${hair};
 --r:${r}px;--maxw:${maxw}px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--tx);font-family:'${f.b}',system-ui,-apple-system,sans-serif;font-size:17px;line-height:1.6;letter-spacing:-.006em;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
button{font:inherit}
.w{max-width:var(--maxw);margin:0 auto;padding:0 24px;position:relative;z-index:2}
.w.n{max-width:820px}

h1,h2,h3{font-family:'${f.d}',Georgia,serif;font-weight:${f.dw};letter-spacing:${f.s};line-height:.98;margin:0 0 .42em;text-transform:${f.t}}
h1{font-size:clamp(40px,7.4vw,92px)}
h2{font-size:clamp(30px,4.6vw,58px);line-height:1.02}
h3{font-size:clamp(19px,1.7vw,23px);line-height:1.2;letter-spacing:-.02em}
p{margin:0 0 1.05em}
.lead{font-size:clamp(17px,1.55vw,21px);color:var(--mu);max-width:60ch;letter-spacing:-.01em}
.eyebrow{display:inline-flex;align-items:center;gap:9px;font-size:11.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--ac);margin-bottom:20px}
.eyebrow:before{content:'';width:22px;height:1.5px;background:var(--ac);display:block}
.grad{background:linear-gradient(102deg,var(--g1),var(--g2));-webkit-background-clip:text;background-clip:text;color:transparent}

${dna.grain ? `body:before{content:'';position:fixed;inset:0;z-index:999;pointer-events:none;background-image:${GRAIN};opacity:${p.mode==='dark'?'.055':'.035'};mix-blend-mode:${p.mode==='dark'?'screen':'multiply'}}` : ''}
.mesh{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.mesh i{position:absolute;border-radius:50%;filter:blur(80px);opacity:${p.mode==='dark'?'.42':'.30'}}
.mesh i:nth-child(1){width:52vw;height:52vw;background:var(--g1);top:-18vw;left:-12vw}
.mesh i:nth-child(2){width:44vw;height:44vw;background:var(--g2);top:6vw;right:-14vw}
.mesh i:nth-child(3){width:34vw;height:34vw;background:var(--ac);bottom:-16vw;left:36vw;opacity:.2}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:var(--ac);color:var(--on);border:0;border-radius:var(--r);padding:16px 30px;font-weight:700;font-size:16px;letter-spacing:-.01em;cursor:pointer;position:relative;overflow:hidden;transition:transform .22s cubic-bezier(.2,.7,.3,1),box-shadow .22s ease}
.btn:hover{transform:translateY(-3px);box-shadow:0 16px 40px ${p.ac}44}
.btn:after{content:'';position:absolute;inset:0;background:linear-gradient(102deg,var(--g1),var(--g2));opacity:0;transition:opacity .25s ease}
.btn:hover:after{opacity:1}
.btn span{position:relative;z-index:1}
.btn.o{background:transparent;color:var(--tx);border:1.5px solid var(--hair);box-shadow:none}
.btn.o:hover{border-color:var(--ac);box-shadow:none}
.btn.o:after{display:none}

.nav{position:fixed;top:0;left:0;right:0;z-index:100;transition:background .3s ease,box-shadow .3s ease,padding .3s ease;padding:14px 0}
.nav.stuck{background:${p.bg}D9;backdrop-filter:blur(18px) saturate(1.4);box-shadow:0 1px 0 var(--hair)}
${dna.nv==='float' ? '.nav.stuck{padding:9px 0}' : ''}
.nav .in{max-width:var(--maxw);margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand{font-family:'${f.d}',serif;font-weight:${f.dw};font-size:20px;letter-spacing:${f.s};text-transform:${f.t}}
.links{display:flex;gap:2px;align-items:center}
.links a{font-size:15px;color:var(--mu);padding:9px 15px;border-radius:999px;transition:color .2s,background .2s}
.links a:hover{color:var(--tx);background:var(--glass)}
${dna.nv==='rule' ? '.links a{border-radius:0;border-bottom:1.5px solid transparent}.links a:hover{background:none;border-color:var(--ac)}' : ''}
.burger{display:none;background:none;border:0;color:inherit;width:44px;height:44px;cursor:pointer}
.burger i{display:block;width:22px;height:1.8px;background:currentColor;margin:5px auto}
.menu{position:fixed;inset:0;z-index:99;background:${p.bg}F7;backdrop-filter:blur(20px);display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px}
.menu.on{display:flex}
.menu a{font-family:'${f.d}',serif;font-size:clamp(28px,7vw,44px);font-weight:${f.dw};letter-spacing:${f.s};padding:10px 0}

.s{padding:clamp(74px,10vw,150px) 0;position:relative}
.s.tint{background:var(--surf)}
.s.line{border-top:1px solid var(--hair)}
.head{max-width:760px;margin-bottom:clamp(36px,5vw,64px)}

.g{display:grid;gap:clamp(14px,1.6vw,22px)}
.g2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.card{background:var(--surf);border:1px solid var(--hair);border-radius:var(--r);padding:clamp(24px,2.6vw,34px);position:relative;overflow:hidden;box-shadow:0 1px 2px ${p.mode==='dark'?'#00000038':'#0000000A'},0 12px 30px ${p.mode==='dark'?'#00000038':'#0000000D'};transition:transform .3s cubic-bezier(.2,.7,.3,1),border-color .3s,box-shadow .3s}
.s.tint .card{background:var(--bg)}
.card:hover{transform:translateY(-5px);border-color:${p.ac}66;box-shadow:0 2px 4px ${p.mode==='dark'?'#00000045':'#0000000F'},0 26px 60px ${p.mode==='dark'?'#00000052':'#00000017'}}
.card:before{content:'';position:absolute;inset:0;background:linear-gradient(140deg,${p.ac}12,transparent 55%);opacity:0;transition:opacity .35s;pointer-events:none}
.card:hover:before{opacity:1}
.card p{color:var(--mu);margin:0;font-size:15.5px}
.card .price{margin-top:16px;font-weight:800;font-size:19px;letter-spacing:-.02em}
.idx{font-size:12px;font-weight:700;color:var(--ac);letter-spacing:.14em;margin-bottom:14px;display:block}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:clamp(20px,3vw,44px)}
.stat b{display:block;font-family:'${f.d}',serif;font-weight:${f.dw};font-size:clamp(38px,5.4vw,70px);letter-spacing:-.05em;line-height:1;background:linear-gradient(102deg,var(--g1),var(--g2));-webkit-background-clip:text;background-clip:text;color:transparent}
.stat span{display:block;color:var(--mu);font-size:14.5px;margin-top:10px}

.marq{overflow:hidden;padding:18px 0;border-top:1px solid var(--hair);border-bottom:1px solid var(--hair);white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.marq .t{display:inline-block;animation:mv 34s linear infinite}
.marq b{font-family:'${f.d}',serif;font-weight:${f.dw};font-size:clamp(22px,3vw,40px);letter-spacing:${f.s};text-transform:${f.t};padding:0 26px;opacity:.85}
.marq i{color:var(--ac);font-style:normal}
@keyframes mv{to{transform:translateX(-50%)}}

.sticky{position:sticky;top:110px}
.proc{border-top:1px solid var(--hair);padding:26px 0;display:grid;grid-template-columns:64px 1fr;gap:22px;align-items:start}
.proc:last-child{border-bottom:1px solid var(--hair)}
.proc em{font-style:normal;font-family:'${f.d}',serif;font-size:15px;font-weight:${f.dw};color:var(--ac)}
.proc p{color:var(--mu);margin:6px 0 0;font-size:15.5px}

.art{aspect-ratio:4/5;border-radius:var(--r);position:relative;overflow:hidden;background:linear-gradient(150deg,var(--g1),var(--g2))}
.art.w{aspect-ratio:16/10}
.art:after{content:'';position:absolute;inset:0;background:radial-gradient(75% 65% at 22% 15%,#FFFFFF40,transparent 62%),${GRAIN};background-blend-mode:overlay;opacity:.9}
.art.v2{background:linear-gradient(35deg,var(--surf) 20%,var(--g2))}
.art.v3{background:conic-gradient(from 210deg at 62% 38%,var(--g1),var(--g2),var(--g1))}
.ph{overflow:hidden;border-radius:var(--r)}
.ph img{width:100%;height:100%;object-fit:cover;aspect-ratio:4/5;transition:transform .7s cubic-bezier(.2,.7,.3,1)}
.ph:hover img{transform:scale(1.06)}

.hrs{width:100%;border-collapse:collapse;font-size:16.5px}
.hrs td{padding:15px 2px;border-bottom:1px solid var(--hair)}
.hrs td:last-child{text-align:right;font-variant-numeric:tabular-nums;color:var(--mu)}
.hrs tr:last-child td{border-bottom:0}
.hrs tr.today td{color:var(--ac);font-weight:700}
.pill{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;font-weight:700;padding:9px 17px;border-radius:999px;background:${p.ac}1F;color:var(--ac)}
.pill:before{content:'';width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 0 0 currentColor;animation:pulse 2.4s infinite}
.pill[data-open="0"]{background:var(--glass);color:var(--mu)}
.pill[data-open="0"]:before{animation:none}
@keyframes pulse{70%{box-shadow:0 0 0 7px transparent}100%{box-shadow:0 0 0 0 transparent}}

.big-link{display:block;font-family:'${f.d}',serif;font-weight:${f.dw};font-size:clamp(22px,3.2vw,38px);letter-spacing:${f.s};padding:20px 0;border-bottom:1px solid var(--hair);transition:padding-left .3s,color .3s}
.big-link:hover{padding-left:16px;color:var(--ac)}

.cta{border-radius:var(--r);padding:clamp(40px,6vw,86px);position:relative;overflow:hidden;background:linear-gradient(120deg,var(--g1),var(--g2));color:#fff;text-align:center}
.cta:after{content:'';position:absolute;inset:0;background:${GRAIN};opacity:.16;mix-blend-mode:overlay;pointer-events:none}
.cta h2{color:#fff}
.cta .lead{color:#FFFFFFDB;margin:0 auto 30px}
.cta .btn{background:#fff;color:#111;position:relative;z-index:2}
.cta .btn:after{display:none}

details{border-bottom:1px solid var(--hair)}
details summary{cursor:pointer;list-style:none;padding:24px 0;font-weight:700;font-size:17.5px;display:flex;justify-content:space-between;gap:20px;align-items:center}
details summary::-webkit-details-marker{display:none}
details summary:after{content:'+';color:var(--ac);font-size:24px;line-height:1;transition:transform .3s}
details[open] summary:after{transform:rotate(45deg)}
details p{color:var(--mu);margin:0 0 24px;max-width:64ch;font-size:16px}

footer{padding:44px 0;border-top:1px solid var(--hair);color:var(--mu);font-size:14px}

.wa{position:fixed;right:20px;bottom:20px;z-index:80;width:58px;height:58px;border-radius:50%;background:#25D366;color:#052E14;display:grid;place-items:center;box-shadow:0 12px 34px #00000047;transition:transform .25s}
.wa:hover{transform:scale(1.08)}
.wa svg{width:28px;height:28px}
.bar{position:fixed;top:0;left:0;height:2.5px;background:linear-gradient(90deg,var(--g1),var(--g2));z-index:120;width:0}

.rows{border-top:1px solid var(--hair)}
.srow{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:24px 0;border-bottom:1px solid var(--hair)}
.srow h3{margin-bottom:6px}
.srow p{color:var(--mu);margin:0;font-size:15.5px;max-width:60ch}
.srow-price{font-weight:800;font-size:19px;letter-spacing:-.02em;white-space:nowrap;color:var(--ac)}
.snum{display:grid;grid-template-columns:56px 1fr;gap:18px;align-items:start;padding:20px 0}
.snum em{font-style:normal;font-family:'${f.d}',serif;font-weight:${f.dw};font-size:34px;letter-spacing:-.05em;color:var(--ac);line-height:1;opacity:.55}
.snum p{color:var(--mu);margin:5px 0 0;font-size:15.5px}
.plist2{display:grid;gap:4px}
.pitem{padding:14px 0;border-bottom:1px solid var(--hair)}
.pitem-top{display:flex;align-items:baseline;gap:10px}
.pitem-name{font-weight:700;font-size:18px;white-space:nowrap}
.pitem-dots{flex:1;border-bottom:2px dotted ${p.mode==='dark'?'#FFFFFF33':'#0000002E'};transform:translateY(-4px)}
.pitem-price{font-weight:800;font-size:18px;color:var(--ac);white-space:nowrap}
.pitem-text{color:var(--mu);margin:6px 0 0;font-size:14.5px;max-width:62ch}
.bigquote{font-family:'${f.d}',serif;font-weight:${f.dw};font-size:clamp(21px,2.8vw,34px);line-height:1.24;letter-spacing:-.025em;margin:0 0 18px}
.hgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;max-width:760px;margin:0 auto}
.hcell{background:var(--surf);border:1px solid var(--hair);border-radius:var(--r);padding:16px 8px;text-align:center}
.hcell span{display:block;font-size:12px;color:var(--mu);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.hcell b{font-size:14px;font-variant-numeric:tabular-nums;line-height:1.35}
.hcell.today{border-color:var(--ac);background:${p.ac}12}
.hcell.today b{color:var(--ac)}
.hlines{display:grid}
.hline{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:15px 0;border-bottom:1px solid var(--hair);font-size:17px}
.hline b{font-variant-numeric:tabular-nums;color:var(--mu);font-weight:500}
.hline.today b,.hline.today span{color:var(--ac);font-weight:700}
.glass{background:${p.mode==='dark'?'#FFFFFF0F':'#FFFFFFB8'};backdrop-filter:blur(22px) saturate(1.3);border:1px solid ${p.mode==='dark'?'#FFFFFF26':'#FFFFFF'};border-radius:calc(var(--r) + 10px);padding:clamp(30px,4.4vw,64px);box-shadow:0 2px 6px #00000012,0 40px 90px ${p.mode==='dark'?'#00000059':'#0000001F'}}
.sky{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.sky .c{position:absolute;border-radius:50%;background:${p.mode==='dark'?'#FFFFFF14':'#FFFFFF'};filter:blur(42px)}
.sky .c:nth-child(1){width:46vw;height:26vw;top:6vw;left:-6vw;opacity:${p.mode==='dark'?'.10':'.85'}}
.sky .c:nth-child(2){width:38vw;height:20vw;top:1vw;right:-4vw;opacity:${p.mode==='dark'?'.08':'.7'}}
.sky .c:nth-child(3){width:30vw;height:16vw;top:16vw;left:34vw;opacity:${p.mode==='dark'?'.06':'.55'}}
.hills{position:absolute;left:0;right:0;bottom:-1px;z-index:1;pointer-events:none}
.rv{opacity:0;transition:opacity .8s cubic-bezier(.2,.7,.3,1),transform .8s cubic-bezier(.2,.7,.3,1),clip-path .9s cubic-bezier(.2,.7,.3,1);transition-delay:var(--d,0ms)}
${dna.m==='up'      ? '.rv{transform:translateY(34px)}' : ''}
${dna.m==='mask'    ? '.rv{clip-path:inset(0 0 100% 0);transform:translateY(14px)}' : ''}
${dna.m==='stagger' ? '.rv{transform:translateY(24px) translateX(-10px)}' : ''}
${dna.m==='scale'   ? '.rv{transform:scale(.955)}' : ''}
.rv.on{opacity:1;transform:none;clip-path:inset(0 0 0 0)}

:focus-visible{outline:2.5px solid var(--ac);outline-offset:3px;border-radius:4px}
::selection{background:${p.ac}40}

@media(max-width:860px){
 .hgrid{grid-template-columns:repeat(4,1fr)}
 .srow{flex-direction:column;gap:10px}
 .snum{grid-template-columns:44px 1fr;gap:12px}
 .pitem-name{white-space:normal}
 .links{display:none}
 .burger{display:block}
 .sticky{position:static}
 .proc{grid-template-columns:1fr;gap:8px}
 .s{padding:66px 0}
}
@media (prefers-reduced-motion:reduce){
 *{animation:none!important;transition:none!important}
 .rv{opacity:1;transform:none;clip-path:none}
 html{scroll-behavior:auto}
}`;
}

/* ══════════════════════════ блоки ══════════════════════════ */

function mesh(on){ return on ? '<div class="mesh"><i></i><i></i><i></i></div>' : ''; }

// Вторая линия защиты: даже если в данные попала ссылка вида javascript:,
// в разметку она не выйдет. Проверяется КАЖДЫЙ адрес, попадающий в href или src.
function safeUrl(u){
  return /^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '';
}
function photos(d){
  return (d.photos || []).map(safeUrl).filter(Boolean);
}
// Для tel: оставляем только цифры, плюс, скобки и дефисы.
function safeTel(v){
  const t = String(v || '').replace(/[^0-9+()\-\s]/g, '').trim();
  return t.replace(/\D/g, '').length >= 5 ? t : '';
}
// Только цифры — для wa.me.
function safeWa(v){
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}

function btn(href, label, ghost){
  return `<a class="btn${ghost?' o':''}" href="${esc(href)}"><span>${esc(label)}</span></a>`;
}

function heroArt(d, cls){
  const ph = photos(d);
  if (ph[0])
    return `<div class="ph rv" style="--d:180ms"><img src="${esc(ph[0])}" alt="${esc(d.name)}"></div>`;
  return `<div class="art ${cls||''} rv" style="--d:180ms"></div>`;
}

function marquee(d){
  const words = (d.services||[]).map(function(s){ return s.name; }).filter(Boolean);
  const list = words.length ? words : [d.category, d.city, d.name];
  const line = list.map(function(w){ return `<b>${esc(w)}</b><i>✦</i>`; }).join('');
  return `<div class="marq"><div class="t">${line}${line}</div></div>`;
}

// Первый цвет градиента текущей палитры — нужен внутри разметки первого экрана.
var CURRENT_PAL = null;
function p_g1(){ return CURRENT_PAL ? CURRENT_PAL.g1 : '#000000'; }

function hero(dna, d){
  const kind = HEROES[dna.h];
  const eyebrow = `<div class="eyebrow rv">${esc(d.category)} · ${esc(d.city)}</div>`;
  const cta = btn('#contacts', d.ctaText || 'Записаться');
  const telNum = safeTel(d.phone);
  const tel = telNum ? btn('tel:' + telNum, telNum, true) : '';
  const pill = '<span class="pill" data-open-badge>Часы работы</span>';
  const pad = 'padding:clamp(130px,17vw,210px) 0 clamp(70px,9vw,120px)';

  if (kind === 'mesh')
    return `<header style="${pad};position:relative">${mesh(dna.mesh)}<div class="w" style="text-align:center;max-width:960px">
      ${eyebrow}<h1 class="rv" style="--d:60ms">${esc(d.headline)}</h1>
      <p class="lead rv" style="--d:140ms;margin:0 auto 34px">${esc(d.subheadline)}</p>
      <div class="rv" style="--d:220ms;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">${cta}${tel}</div>
      <div class="rv" style="--d:300ms;margin-top:34px">${pill}</div></div></header>`;

  if (kind === 'sticky')
    return `<header style="${pad};position:relative">${mesh(dna.mesh)}<div class="w" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:clamp(30px,5vw,70px);align-items:center">
      <div>${eyebrow}<h1 class="rv" style="--d:60ms">${esc(d.headline)}</h1>
      <p class="lead rv" style="--d:140ms">${esc(d.subheadline)}</p>
      <div class="rv" style="--d:220ms;margin:30px 0 22px;display:flex;gap:14px;flex-wrap:wrap">${cta}${tel}</div>
      <div class="rv" style="--d:300ms">${pill}</div></div>
      ${heroArt(d)}</div></header>`;

  if (kind === 'marquee')
    return `<header style="padding:clamp(126px,16vw,190px) 0 0;position:relative">${mesh(dna.mesh)}<div class="w" style="max-width:900px">
      ${eyebrow}<h1 class="rv" style="--d:60ms">${esc(d.headline)}</h1>
      <p class="lead rv" style="--d:140ms">${esc(d.subheadline)}</p>
      <div class="rv" style="--d:220ms;margin:32px 0 46px;display:flex;gap:14px;flex-wrap:wrap;align-items:center">${cta}${tel}${pill}</div></div>
      ${marquee(d)}</header>`;

  if (kind === 'overlap')
    return `<header style="${pad};position:relative">${mesh(dna.mesh)}<div class="w">
      ${eyebrow}<h1 class="rv" style="--d:60ms;max-width:13ch">${esc(d.headline)}</h1>
      <div class="g g2" style="margin-top:42px;align-items:end">
        <div><p class="lead rv" style="--d:140ms">${esc(d.subheadline)}</p>
        <div class="rv" style="--d:220ms;margin-top:26px;display:flex;gap:14px;flex-wrap:wrap">${cta}${tel}</div>
        <div class="rv" style="--d:300ms;margin-top:24px">${pill}</div></div>
        ${heroArt(d,'w')}</div></div></header>`;

  if (kind === 'bigtype')
    return `<header style="${pad};position:relative">${mesh(dna.mesh)}<div class="w">
      ${eyebrow}<h1 class="rv" style="--d:60ms;font-size:clamp(46px,11vw,150px);line-height:.9">${esc(d.name)}</h1>
      <div class="g g2" style="margin-top:36px;align-items:start">
        <p class="lead rv" style="--d:140ms">${esc(d.headline)}. ${esc(d.subheadline)}</p>
        <div class="rv" style="--d:220ms;display:flex;gap:14px;flex-wrap:wrap;justify-content:flex-end;align-items:flex-start">${cta}${tel}</div></div>
      <div class="rv" style="--d:300ms;margin-top:30px">${pill}</div></div></header>`;

  if (kind === 'rule')
    return `<header style="${pad};position:relative"><div class="w">
      ${eyebrow}<h1 class="rv" style="--d:60ms;max-width:15ch">${esc(d.headline)}</h1>
      <div style="height:1px;background:var(--hair);margin:38px 0"></div>
      <div class="g g2" style="align-items:start">
        <p class="lead rv" style="--d:140ms">${esc(d.subheadline)}</p>
        <div class="rv" style="--d:220ms"><div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:20px">${cta}${tel}</div>${pill}</div>
      </div></div></header>`;

  if (kind === 'gradient')
    return `<header style="${pad};position:relative;background:linear-gradient(135deg,var(--g1),var(--g2));color:#fff">
      <div class="w" style="max-width:960px">
      <div class="eyebrow rv" style="color:#FFFFFFCC">${esc(d.category)} · ${esc(d.city)}</div>
      <h1 class="rv" style="--d:60ms;color:#fff;max-width:14ch">${esc(d.headline)}</h1>
      <p class="lead rv" style="--d:140ms;color:#FFFFFFDD">${esc(d.subheadline)}</p>
      <div class="rv" style="--d:220ms;margin-top:32px;display:flex;gap:14px;flex-wrap:wrap">
        <a class="btn" style="background:#fff;color:#111" href="#contacts"><span>${esc(d.ctaText||'Записаться')}</span></a>
        ${telNum?`<a class="btn o" style="color:#fff;border-color:#FFFFFF66" href="tel:${esc(telNum)}"><span>${esc(telNum)}</span></a>`:''}
      </div></div></header>`;

  if (kind === 'glass')
    return `<header style="${pad};position:relative;background:linear-gradient(165deg,${p_g1(d)}22,transparent 55%)">${mesh(true)}<div class="w">
      <div class="glass">${eyebrow}<h1 class="rv" style="--d:60ms">${esc(d.headline)}</h1>
      <p class="lead rv" style="--d:140ms">${esc(d.subheadline)}</p>
      <div class="rv" style="--d:220ms;margin:30px 0 20px;display:flex;gap:14px;flex-wrap:wrap">${cta}${tel}</div>
      <div class="rv" style="--d:300ms">${pill}</div></div></div></header>`;

  if (kind === 'sky')
    return `<header style="padding:clamp(130px,17vw,200px) 0 0;position:relative;overflow:hidden;background:linear-gradient(180deg,${p_g1(d)}26,transparent 62%)">
      <div class="sky"><i class="c"></i><i class="c"></i><i class="c"></i></div>
      <div class="w" style="text-align:center;max-width:940px;padding-bottom:clamp(80px,11vw,150px)">
      ${eyebrow}<h1 class="rv" style="--d:60ms">${esc(d.headline)}</h1>
      <p class="lead rv" style="--d:140ms;margin:0 auto 32px">${esc(d.subheadline)}</p>
      <div class="rv" style="--d:220ms;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">${cta}${tel}</div>
      <div class="rv" style="--d:300ms;margin-top:30px">${pill}</div></div>
      <svg class="hills" viewBox="0 0 1440 140" preserveAspectRatio="none" aria-hidden="true" style="height:clamp(60px,9vw,130px);width:100%">
        <path d="M0 88c220-52 400 26 640 10s420-74 800-26v68H0z" fill="var(--surf)" opacity=".7"/>
        <path d="M0 116c260-40 430 14 700 2s470-56 740-14v36H0z" fill="var(--surf)"/>
      </svg></header>`;

  return `<header style="padding:clamp(150px,20vw,240px) 0 clamp(80px,10vw,130px);position:relative"><div class="w n" style="text-align:center">
    ${eyebrow}<h1 class="rv" style="--d:60ms;font-size:clamp(34px,5.4vw,64px)">${esc(d.headline)}</h1>
    <p class="lead rv" style="--d:140ms;margin:0 auto 36px">${esc(d.subheadline)}</p>
    <div class="rv" style="--d:220ms;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">${cta}${tel}</div>
    <div class="rv" style="--d:300ms;margin-top:36px">${pill}</div></div></header>`;
}

function statsBlock(d){
  if (!d.stats || d.stats.length < 2) return '';
  return `<section class="s line"><div class="w"><div class="stats">${
    d.stats.map(function(s,i){
      return `<div class="stat rv" style="--d:${i*90}ms"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`;
    }).join('')
  }</div></div></section>`;
}

function servicesBlock(d, dna){
  if (!d.services || !d.services.length) return '';
  const head = `<div class="head"><div class="eyebrow rv">Услуги</div><h2 class="rv" style="--d:60ms">${esc(d.servicesTitle||'Что мы делаем')}</h2></div>`;
  const kind = LAY_SERVICES[dna ? dna.ls : 0];

  // Карточки в сетке
  if (kind === 'cards')
    return `<section class="s tint" id="services"><div class="w">${head}
      <div class="g g3">${d.services.map(function(s,i){
        return `<div class="card rv" style="--d:${i*80}ms">
        <span class="idx">${String(i+1).padStart(2,'0')}</span><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p>
        ${s.price?`<div class="price grad">${esc(s.price)}</div>`:''}</div>`;
      }).join('')}</div></div></section>`;

  // Широкие строки с разделителями
  if (kind === 'rows')
    return `<section class="s tint" id="services"><div class="w">${head}
      <div class="rows">${d.services.map(function(s,i){
        return `<div class="srow rv" style="--d:${i*70}ms">
        <div><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p></div>
        ${s.price?`<div class="srow-price">${esc(s.price)}</div>`:''}</div>`;
      }).join('')}</div></div></section>`;

  // Крупная нумерация слева
  if (kind === 'numbered')
    return `<section class="s tint" id="services"><div class="w">${head}
      <div class="g g2">${d.services.map(function(s,i){
        return `<div class="snum rv" style="--d:${i*70}ms">
        <em>${String(i+1).padStart(2,'0')}</em>
        <div><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p>
        ${s.price?`<div class="price grad" style="font-size:17px">${esc(s.price)}</div>`:''}</div></div>`;
      }).join('')}</div></div></section>`;

  // Прайс-лист с точками
  return `<section class="s tint" id="services"><div class="w"><div class="wn">${head}
    <div class="plist2">${d.services.map(function(s,i){
      return `<div class="pitem rv" style="--d:${i*60}ms">
      <div class="pitem-top"><span class="pitem-name">${esc(s.name)}</span><span class="pitem-dots"></span>
      ${s.price?`<span class="pitem-price">${esc(s.price)}</span>`:''}</div>
      ${s.text?`<p class="pitem-text">${esc(s.text)}</p>`:''}</div>`;
    }).join('')}</div></div></div></section>`;
}

function aboutBlock(d, dna){
  if (!d.about) return '';
  const ph = photos(d);
  const kind = LAY_ABOUT[dna ? dna.la : 0];
  const side = ph[1]
    ? `<div class="ph rv" style="--d:200ms"><img src="${esc(ph[1])}" alt="" loading="lazy"></div>`
    : '<div class="art v2 rv" style="--d:200ms"></div>';

  if (kind === 'split')
    return `<section class="s line" id="about"><div class="w"><div class="g g2" style="gap:clamp(30px,5vw,70px);align-items:center">
      <div><div class="eyebrow rv">О нас</div><h2 class="rv" style="--d:60ms">${esc(d.aboutTitle||'Кто мы')}</h2>
      <p class="lead rv" style="--d:140ms">${esc(d.about)}</p></div>${side}</div></div></section>`;

  if (kind === 'centered')
    return `<section class="s line" id="about"><div class="w" style="text-align:center;max-width:760px">
      <div class="eyebrow rv">О нас</div><h2 class="rv" style="--d:60ms">${esc(d.aboutTitle||'Кто мы')}</h2>
      <p class="lead rv" style="--d:140ms;margin:0 auto">${esc(d.about)}</p></div></section>`;

  if (kind === 'quote')
    return `<section class="s line" id="about"><div class="w" style="max-width:900px">
      <div class="eyebrow rv">О нас</div>
      <p class="bigquote rv" style="--d:60ms">${esc(d.about)}</p>
      <div class="rv" style="--d:160ms;color:var(--mu);font-size:15px">— ${esc(d.name)}${d.city ? ', ' + esc(d.city) : ''}</div></div></section>`;

  return `<section class="s line" id="about">${mesh(true)}<div class="w">
    <div class="eyebrow rv">О нас</div>
    <h2 class="rv" style="--d:60ms;max-width:15ch">${esc(d.aboutTitle||'Кто мы')}</h2>
    <div class="g g2" style="margin-top:26px;align-items:start;gap:clamp(24px,4vw,56px)">
      <p class="lead rv" style="--d:140ms">${esc(d.about)}</p>
      ${ph[1] ? `<div class="ph rv" style="--d:200ms"><img src="${esc(ph[1])}" alt="" loading="lazy"></div>` : `<div class="art w v3 rv" style="--d:200ms"></div>`}
    </div></div></section>`;
}

function processBlock(d){
  if (!d.process || !d.process.length) return '';
  return `<section class="s line"><div class="w"><div class="g g2" style="gap:clamp(30px,5vw,70px);align-items:start">
    <div class="sticky"><div class="eyebrow rv">Как это устроено</div><h2 class="rv" style="--d:60ms">${esc(d.processTitle||'Как мы работаем')}</h2></div>
    <div>${d.process.map(function(s,i){
      return `<div class="proc rv" style="--d:${i*90}ms"><em>${String(i+1).padStart(2,'0')}</em>
      <div><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p></div></div>`;
    }).join('')}</div></div></div></section>`;
}

function galleryBlock(d){
  const list = photos(d).slice(0,3);
  const cells = list.length
    ? list.map(function(u,i){ return `<div class="ph rv" style="--d:${i*90}ms"><img src="${esc(u)}" alt="" loading="lazy"></div>`; }).join('')
    : ['','v2','v3'].map(function(v,i){ return `<div class="art ${v} rv" style="--d:${i*90}ms"></div>`; }).join('');
  return `<section class="s tint" id="gallery"><div class="w">
    <div class="head"><div class="eyebrow rv">Галерея</div><h2 class="rv" style="--d:60ms">Как у нас</h2></div>
    <div class="g g3">${cells}</div></div></section>`;
}

function reviewsBlock(d){
  if (!d.reviews || !d.reviews.length) return '';
  return `<section class="s line" id="reviews"><div class="w">
    <div class="head"><div class="eyebrow rv">Отзывы</div><h2 class="rv" style="--d:60ms">Что говорят клиенты</h2></div>
    <div class="g g2">${d.reviews.map(function(r,i){
      return `<blockquote class="card rv" style="--d:${i*90}ms;margin:0">
      <p style="font-size:19px;color:var(--tx);line-height:1.45">«${esc(r.text)}»</p>
      <div style="color:var(--mu);font-size:14px;margin-top:16px">${esc(r.name)}</div></blockquote>`;
    }).join('')}</div></div></section>`;
}

function faqBlock(d){
  if (!d.faq || !d.faq.length) return '';
  return `<section class="s line" id="faq"><div class="w n">
    <div class="head"><div class="eyebrow rv">Вопросы</div><h2 class="rv" style="--d:60ms">Коротко о главном</h2></div>
    <div class="rv" style="--d:120ms">${d.faq.map(function(f){
      return `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`;
    }).join('')}</div></div></section>`;
}

function hoursBlock(h, dna){
  const kind = LAY_HOURS[dna ? dna.lh : 0];
  const pill = '<span class="pill" data-open-badge>Часы работы</span>';

  if (kind === 'table') {
    const rows = DAYS.map(function(pair){
      const k = pair[0], label = pair[1];
      return `<tr data-day="${k}"><td>${label}</td><td>${h[k].closed ? 'Выходной' : esc(h[k].from)+' – '+esc(h[k].to)}</td></tr>`;
    }).join('');
    return `<section class="s tint" id="hours"><div class="w"><div class="g g2" style="gap:clamp(30px,5vw,70px);align-items:start">
      <div class="sticky"><div class="eyebrow rv">Режим</div><h2 class="rv" style="--d:60ms">Часы работы</h2>
        <div class="rv" style="--d:140ms;margin-bottom:18px">${pill}</div>
        <p class="rv" style="--d:180ms;color:var(--mu);font-size:14.5px">Время по Астане, UTC+5. Метка обновляется сама.</p></div>
      <table class="hrs rv" style="--d:120ms">${rows}</table></div></div></section>`;
  }

  if (kind === 'grid') {
    const cells = DAYS.map(function(pair, i){
      const k = pair[0], label = pair[1];
      return `<div class="hcell rv" data-day="${k}" style="--d:${i*50}ms">
        <span>${label.slice(0,2)}</span><b>${h[k].closed ? '—' : esc(h[k].from)+'<br>'+esc(h[k].to)}</b></div>`;
    }).join('');
    return `<section class="s tint" id="hours"><div class="w" style="text-align:center">
      <div class="eyebrow rv">Режим</div><h2 class="rv" style="--d:60ms">Часы работы</h2>
      <div class="rv" style="--d:120ms;margin-bottom:26px">${pill}</div>
      <div class="hgrid">${cells}</div>
      <p class="rv" style="--d:200ms;color:var(--mu);font-size:14px;margin-top:20px">Время по Астане, UTC+5</p></div></section>`;
  }

  const lines = DAYS.map(function(pair, i){
    const k = pair[0], label = pair[1];
    return `<div class="hline rv" data-day="${k}" style="--d:${i*40}ms"><span>${label}</span><b>${
      h[k].closed ? 'Выходной' : esc(h[k].from)+' – '+esc(h[k].to)}</b></div>`;
  }).join('');
  return `<section class="s tint" id="hours"><div class="w n">
    <div class="head"><div class="eyebrow rv">Режим</div><h2 class="rv" style="--d:60ms">Часы работы</h2>
    <div class="rv" style="--d:120ms">${pill}</div></div>
    <div class="hlines">${lines}</div></div></section>`;
}

function contactsBlock(d){
  const wa = safeWa(d.whatsapp);
  const tel = safeTel(d.phone);
  const insta = safeUrl(d.instagram);
  return `<section class="s line" id="contacts"><div class="w">
    <div class="head"><div class="eyebrow rv">Контакты</div><h2 class="rv" style="--d:60ms">${esc(d.contactsTitle||'Свяжитесь с нами')}</h2>
    <p class="lead rv" style="--d:120ms">${esc(d.contactsText||'')}</p></div>
    <div class="rv" style="--d:160ms">
      ${tel?`<a class="big-link" href="tel:${esc(tel)}">${esc(tel)}</a>`:''}
      ${wa?`<a class="big-link" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>`:''}
      ${d.address?`<a class="big-link" href="https://2gis.kz/search/${encodeURIComponent(d.address)}" target="_blank" rel="noopener">${esc(d.address)}</a>`:''}
      ${insta?`<a class="big-link" href="${esc(insta)}" target="_blank" rel="noopener nofollow">Instagram</a>`:''}
    </div></div></section>`;
}

function ctaBlock(d){
  return `<section class="s"><div class="w"><div class="cta rv">
    <h2>${esc(d.ctaTitle || 'Готовы записаться?')}</h2>
    <p class="lead">${esc(d.ctaSub || 'Позвоните или напишите в WhatsApp — ответим в рабочее время.')}</p>
    ${safeTel(d.phone)?`<a class="btn" href="tel:${esc(safeTel(d.phone))}"><span>${esc(safeTel(d.phone))}</span></a>`:btn('#contacts','Связаться')}
  </div></div></section>`;
}

/* ══════════════════════════ скрипты ══════════════════════════ */

function scripts(hours){
  return `<script>
(function(){
var R=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var els=document.querySelectorAll('.rv');
if(R){for(var i=0;i<els.length;i++)els[i].classList.add('on');}
else{var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}})},{threshold:.1,rootMargin:'0px 0px -8%'});
for(var j=0;j<els.length;j++)io.observe(els[j]);}

var nav=document.querySelector('.nav'),bar=document.querySelector('.bar');
function onScroll(){
  var y=window.scrollY||0;
  nav.classList.toggle('stuck',y>24);
  var h=document.documentElement.scrollHeight-window.innerHeight;
  bar.style.width=(h>0?(y/h*100):0)+'%';
}
onScroll();window.addEventListener('scroll',onScroll,{passive:true});

var b=document.querySelector('.burger'),m=document.querySelector('.menu');
if(b&&m){
  b.addEventListener('click',function(){m.classList.toggle('on');document.body.style.overflow=m.classList.contains('on')?'hidden':'';});
  m.addEventListener('click',function(e){if(e.target.tagName==='A'){m.classList.remove('on');document.body.style.overflow='';}});
}

var H=${JSON.stringify(hours)},K=['sun','mon','tue','wed','thu','fri','sat'];
function alm(){var n=new Date();return new Date(n.getTime()+n.getTimezoneOffset()*60000+5*3600000);}
function mn(s){var p=String(s).split(':');return (+p[0])*60+(+p[1]||0);}
function paint(){
  var d=alm(),day=H[K[d.getDay()]],open=false;
  if(day&&!day.closed){var now=d.getHours()*60+d.getMinutes(),a=mn(day.from),z=mn(day.to);
    open=z>a?(now>=a&&now<z):(now>=a||now<z);}
  var badges=document.querySelectorAll('[data-open-badge]');
  for(var i=0;i<badges.length;i++){badges[i].textContent=open?'Сейчас открыто':'Сейчас закрыто';badges[i].setAttribute('data-open',open?'1':'0');}
  var rows=document.querySelectorAll('[data-day]');
  for(var j=0;j<rows.length;j++){
    if(rows[j].getAttribute('data-day')===K[d.getDay()])rows[j].classList.add('today');else rows[j].classList.remove('today');
  }
}
paint();setInterval(paint,60000);
})();
</script>`;
}

/* ══════════════════════════ страница ══════════════════════════ */

// Любое поле-список приводим к настоящему массиву: строка или null не должны
// ронять сборку страницы.
function asList(v){ return Array.isArray(v) ? v : []; }

function render(data, dna, opts){
  const o = opts || {};
  const p = PALETTES[dna.p];
  const f = FONTS[dna.f];
  CURRENT_PAL = p;
  const h = normalizeHours(data.hours);
  const d = Object.assign({}, data, {
    services: asList(data.services),
    stats: asList(data.stats),
    process: asList(data.process),
    faq: asList(data.faq),
    reviews: asList(data.reviews),
    photos: asList(data.photos),
  });

  const blocks = {
    stats: statsBlock(d), services: servicesBlock(d, dna), about: aboutBlock(d, dna),
    process: processBlock(d), gallery: galleryBlock(d), reviews: reviewsBlock(d), faq: faqBlock(d),
  };

  const body = dna.order.map(function(k){ return blocks[k] || ''; }).join('')
    + hoursBlock(h, dna) + ctaBlock(d) + contactsBlock(d);

  const nav = [
    blocks.services && ['#services','Услуги'],
    blocks.about && ['#about','О нас'],
    blocks.gallery && ['#gallery','Галерея'],
    ['#hours','Часы'],
    ['#contacts','Контакты'],
  ].filter(Boolean);

  const links = nav.map(function(n){ return `<a href="${n[0]}">${n[1]}</a>`; }).join('');
  const fam = f.d === f.b
    ? 'family=' + encodeURIComponent(f.d) + ':wght@400;600;700;800'
    : 'family=' + encodeURIComponent(f.d) + ':wght@400;700;800&family=' + encodeURIComponent(f.b) + ':wght@400;600;700;800';

  const wm = o.preview
    ? `<div style="position:fixed;inset:0;z-index:900;pointer-events:none;background:repeating-linear-gradient(-32deg,transparent 0 140px,${p.ac}10 140px 280px)"></div>
<div style="position:fixed;left:0;right:0;bottom:0;z-index:901;background:#0B0B0B;color:#fff;font:600 13px/1.4 system-ui;padding:11px 16px;text-align:center">Предпросмотр WeDesign · водяной знак снимается после оплаты</div>`
    : '';

  return `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(d.title || d.name)}</title>
<meta name="description" content="${esc(d.metaDescription || d.subheadline || '')}">
<meta name="theme-color" content="${p.bg}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(d.title || d.name)}">
<meta property="og:description" content="${esc(d.metaDescription || d.subheadline || '')}">
<meta name="robots" content="${o.preview ? 'noindex,nofollow' : 'index,follow'}">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fam}&display=swap&subset=cyrillic,latin">
<style>${css(dna,p,f)}</style>
</head><body>
<div class="bar"></div>
<nav class="nav"><div class="in">
  <a class="brand" href="#">${esc(d.name)}</a>
  <div class="links">${links}</div>
  ${safeTel(d.phone)?`<a class="btn" href="tel:${esc(safeTel(d.phone))}" style="padding:11px 22px;font-size:14.5px"><span>Позвонить</span></a>`:''}
  <button class="burger" aria-label="Меню"><i></i><i></i></button>
</div></nav>
<div class="menu">${nav.map(function(n){ return `<a href="${n[0]}">${n[1]}</a>`; }).join('')}</div>
${hero(dna,d)}
${body}
<footer><div class="w" style="display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap">
<span>© ${new Date().getFullYear()} ${esc(d.name)}${d.city ? ', ' + esc(d.city) : ''}</span>
${o.standalone ? '' : `<span>Сведения на странице размещены владельцем бизнеса. Сайт собран в WeDesign · ${esc(dnaCode(dna))}</span>`}</div></footer>
${safeWa(d.whatsapp)?`<a class="wa" href="https://wa.me/${esc(safeWa(d.whatsapp))}" target="_blank" rel="noopener" aria-label="Написать в WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-1.5-.6-3.4-1.7-4.9-3.8-.6-.8-1-1.7-1.1-2.5-.1-.8.2-1.5.6-1.9.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .6.4l.7 1.7c.1.2 0 .4-.1.5l-.4.5c-.1.2-.3.3-.1.6.4.7 1 1.3 1.6 1.8.6.4 1.1.6 1.3.7.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.2.1.6-.1 1.1Z"/></svg></a>`:''}
${wm}
${scripts(h)}
</body></html>`;
}

module.exports = { render, makeDNA, dnaKey, dnaCode, normalizeHours, DAYS, PALETTES, FONTS, HEROES, wishes, MOODS };
