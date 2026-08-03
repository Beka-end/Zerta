// api/_lib.js — общие серверные утилиты WeDesign.
// Здесь нет ни одного секрета в коде: всё берётся из переменных окружения Vercel.

const crypto = require('crypto');

/* ------------------------------------------------------------------ */
/* Хранилище: Upstash Redis через REST (без npm-пакетов).              */
/* Если переменные не заданы — работает временная память (для теста).   */
/* ------------------------------------------------------------------ */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const hasKV = Boolean(KV_URL && KV_TOKEN);
const mem = new Map();
const memZ = new Map();
const memS = new Map();

function memAlive(key) {
  const rec = mem.get(key);
  if (!rec) return null;
  if (rec.exp && rec.exp < Date.now()) {
    mem.delete(key);
    return null;
  }
  return rec;
}

async function cmd(args) {
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const err = new Error('storage_error_' + r.status);
    err.storage = r.status;
    throw err;
  }
  const data = await r.json();
  return data.result;
}

const store = {
  async get(key) {
    if (!hasKV) {
      const rec = memAlive(key);
      return rec ? rec.v : null;
    }
    return await cmd(['GET', key]);
  },
  async set(key, value, ttlSeconds) {
    if (!hasKV) {
      mem.set(key, {
        v: value,
        exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
      });
      return 'OK';
    }
    const args = ['SET', key, value];
    if (ttlSeconds) args.push('EX', String(ttlSeconds));
    return await cmd(args);
  },
  async del(key) {
    if (!hasKV) return mem.delete(key) ? 1 : 0;
    return await cmd(['DEL', key]);
  },
  // Счётчик с автосбросом — основа лимитов.
  async incr(key, ttlSeconds) {
    if (!hasKV) {
      const rec = memAlive(key);
      const next = (rec ? Number(rec.v) : 0) + 1;
      mem.set(key, {
        v: next,
        exp: rec && rec.exp ? rec.exp : Date.now() + ttlSeconds * 1000,
      });
      return next;
    }
    const n = await cmd(['INCR', key]);
    if (n === 1 && ttlSeconds) await cmd(['EXPIRE', key, String(ttlSeconds)]);
    return n;
  },
  // Вернуть сборку обратно: если запрос не про бизнес, наказывать человека не за что.
  async decr(key) {
    if (!hasKV) {
      const rec = memAlive(key);
      if (!rec) return 0;
      rec.v = Math.max(0, Number(rec.v) - 1);
      return rec.v;
    }
    return await cmd(['DECR', key]);
  },
  async sadd(key, member) {
    if (!hasKV) {
      const s = memS.get(key) || new Set();
      const added = s.has(member) ? 0 : 1;
      s.add(member);
      memS.set(key, s);
      return added;
    }
    return await cmd(['SADD', key, member]);
  },
  async sismember(key, member) {
    if (!hasKV) return (memS.get(key) || new Set()).has(member) ? 1 : 0;
    return await cmd(['SISMEMBER', key, member]);
  },
  async srem(key, member) {
    if (!hasKV) {
      const s = memS.get(key);
      return s && s.delete(member) ? 1 : 0;
    }
    return await cmd(['SREM', key, member]);
  },
  async zadd(key, score, member) {
    if (!hasKV) {
      const z = memZ.get(key) || [];
      const i = z.findIndex((x) => x.m === member);
      if (i >= 0) z[i].s = score;
      else z.push({ s: score, m: member });
      memZ.set(key, z);
      return 1;
    }
    return await cmd(['ZADD', key, String(score), member]);
  },
  async zrem(key, member) {
    if (!hasKV) {
      const z = memZ.get(key) || [];
      memZ.set(
        key,
        z.filter((x) => x.m !== member)
      );
      return 1;
    }
    return await cmd(['ZREM', key, member]);
  },
  // Свежие сверху.
  async zrecent(key, limit) {
    if (!hasKV) {
      const z = (memZ.get(key) || []).slice().sort((a, b) => b.s - a.s);
      return z.slice(0, limit).map((x) => x.m);
    }
    return await cmd(['ZRANGE', key, '0', String(limit - 1), 'REV']);
  },
};

/* ------------------------------------------------------------------ */
/* JSON-обёртки                                                         */
/* ------------------------------------------------------------------ */

async function getJSON(key) {
  const raw = await store.get(key);
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function setJSON(key, value, ttlSeconds) {
  return store.set(key, JSON.stringify(value), ttlSeconds);
}

/* ------------------------------------------------------------------ */
/* Запрос / ответ                                                       */
/* ------------------------------------------------------------------ */

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || '0.0.0.0';
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  // Тело может прийти потоком. Если поток недоступен или битый — считаем тело пустым,
  // но не роняем функцию: пустой запрос должен получить понятный ответ, а не 500.
  try {
    if (!req || typeof req[Symbol.asyncIterator] !== 'function') return {};
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 512) return {}; // полмегабайта — потолок, дальше не читаем
      chunks.push(chunk);
    }
    if (!chunks.length) return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (e) {
    return {};
  }
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function fail(res, status, message) {
  return send(res, status, { ok: false, error: message });
}

/* ------------------------------------------------------------------ */
/* Лимиты — защита денег на API-ключе                                   */
/* ------------------------------------------------------------------ */

const DAY = 24 * 60 * 60;

async function limit(key, max, ttlSeconds) {
  const used = await store.incr(key, ttlSeconds);
  return { ok: used <= max, used, max };
}

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/* ------------------------------------------------------------------ */
/* Токены админа: подпись HMAC, ключ никогда не покидает сервер         */
/* ------------------------------------------------------------------ */

function secret() {
  return (
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_PASSWORD ||
    'wedesign-insecure-default'
  );
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signAdminToken(hours) {
  const exp = Date.now() + (hours || 8) * 60 * 60 * 1000;
  const payload = b64url(JSON.stringify({ exp }));
  const sig = b64url(
    crypto.createHmac('sha256', secret()).update(payload).digest()
  );
  return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expected = b64url(
    crypto.createHmac('sha256', secret()).update(payload).digest()
  );
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    return data.exp > Date.now();
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Расписка о согласии                                                  */
/* Сервер сам ставит время и подписывает запись своим ключом. Подделать */
/* её со стороны клиента нельзя, изменить задним числом — тоже: любая   */
/* правка ломает подпись.                                               */
/* ------------------------------------------------------------------ */

function signReceipt(payload) {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('hex');
  return { ...payload, sig };
}

function verifyReceipt(receipt) {
  if (!receipt || !receipt.sig) return false;
  const { sig, ...payload } = receipt;
  const expected = crypto
    .createHmac('sha256', secret())
    .update(JSON.stringify(payload))
    .digest('hex');
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Отпечаток устройства: без имён и точных данных, только то, что пришло
// в самом запросе. Нужен, чтобы показать — заходили с того же устройства.
function fingerprint(req) {
  const parts = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    clientIp(req),
  ].join('|');
  return crypto.createHash('sha256').update(parts).digest('hex').slice(0, 16);
}

function samePassword(input) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real) return false;
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

async function requireAdmin(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyAdminToken(token)) {
    fail(res, 401, 'Нужен вход в панель');
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Мелочи                                                               */
/* ------------------------------------------------------------------ */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function code(len) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clean(value, maxLen) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, maxLen || 200);
}

function slugify(value) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ә: 'a', ғ: 'g',
    қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h',
  };
  return String(value || '')
    .toLowerCase()
    .split('')
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'site';
}

/* ------------------------------------------------------------------ */
/* Общая обёртка над обработчиками                                      */
/* Любая неожиданная ошибка превращается в понятный JSON, а не в 500.   */
/* ------------------------------------------------------------------ */

function storageHint(status) {
  if (status === 401 || status === 403)
    return 'Хранилище отклонило запрос (код ' + status + '). В переменных Vercel неверный токен Upstash: нужен основной KV_REST_API_TOKEN, а не read-only. После замены сделайте Redeploy.';
  if (status === 404)
    return 'Хранилище не найдено по указанному адресу. Проверьте KV_REST_API_URL — он должен начинаться на https:// и заканчиваться на upstash.io.';
  if (status === 429)
    return 'Исчерпан лимит бесплатного тарифа хранилища. Загляните в панель Upstash.';
  return 'Хранилище не отвечает (код ' + status + '). Попробуйте через минуту.';
}

function wrap(handler) {
  return async function (req, res) {
    try {
      return await handler(req, res);
    } catch (e) {
      // В логи Vercel — всё как есть, чтобы можно было починить.
      console.error('[wedesign]', req.url, e && e.stack ? e.stack : e);
      if (res.headersSent) return;
      if (e && e.storage) return fail(res, 503, storageHint(e.storage));
      return fail(res, 500, 'На сервере что-то сломалось. Точная причина — в логах Vercel.');
    }
  };
}

/* ------------------------------------------------------------------ */
/* Контакты владельца                                                   */
/* Задаются переменными Vercel, чтобы номер лежал в одном месте.        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Тарифы                                                               */
/* «file» — клиент размещает сам. «site» — размещаем мы, плюс файл.     */
/* Диапазоны сумм не пересекаются: 4991–5489 и 9991–10489.              */
/* ------------------------------------------------------------------ */

const PLANS = {
  file: {
    id: 'file',
    title: 'Файл сайта',
    envPrice: 'PRICE_FILE',
    fallback: 4990,
    short: 'скачиваете и размещаете сами',
  },
  site: {
    id: 'site',
    title: 'Готовый сайт',
    envPrice: 'PRICE_SITE',
    fallback: 9990,
    short: 'живая ссылка сразу, файл тоже ваш',
  },
};

function plan(id) {
  const p = PLANS[id] || PLANS.site;
  return { ...p, price: num(p.envPrice, p.fallback) };
}

function plans() {
  return [plan('file'), plan('site')];
}

function contacts() {
  const wa = String(process.env.SUPPORT_WHATSAPP || '').replace(/\D/g, '');
  const phone = String(process.env.SUPPORT_PHONE || process.env.SUPPORT_WHATSAPP || '').trim();
  return {
    whatsapp: wa.length >= 10 ? wa : '',
    phone: phone || '',
    email: String(process.env.SUPPORT_EMAIL || '').trim(),
    hours: String(process.env.SUPPORT_HOURS || 'с 10:00 до 20:00, время Астаны').trim(),
  };
}

module.exports = {
  store,
  contacts,
  plan,
  plans,
  wrap,
  getJSON,
  setJSON,
  clientIp,
  readBody,
  send,
  fail,
  limit,
  num,
  DAY,
  signAdminToken,
  signReceipt,
  verifyReceipt,
  fingerprint,
  verifyAdminToken,
  samePassword,
  requireAdmin,
  code,
  esc,
  clean,
  slugify,
  hasKV,
};
