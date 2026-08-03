// api/health.js — самопроверка сервера.
// Показывает ИМЕНА переменных и результат живого пинга к хранилищу.
// Значения переменных не выводятся никогда — только адрес хоста.
//
// Открывается так:  /api/health?key=ВАШ_ADMIN_PASSWORD

const L = require('./_lib');

const URL_VARS = ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL'];
const TOKEN_VARS = ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN'];

const handler = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const key = url.searchParams.get('key') || '';

  if (!process.env.ADMIN_PASSWORD)
    return L.fail(res, 500, 'Сначала задайте ADMIN_PASSWORD в переменных Vercel');
  if (!L.samePassword(key))
    return L.fail(res, 401, 'Добавьте к адресу ?key=ваш_ADMIN_PASSWORD');

  // Все переменные окружения, которые хоть как-то похожи на хранилище.
  // Только имена — значения не показываем.
  const related = Object.keys(process.env)
    .filter((n) => /REDIS|KV_|UPSTASH|DATABASE/i.test(n))
    .sort();

  const urlVar = URL_VARS.find((n) => process.env[n]) || null;
  const tokenVar = TOKEN_VARS.find((n) => process.env[n]) || null;
  const rawUrl = urlVar ? String(process.env[urlVar]).trim() : '';
  const rawToken = tokenVar ? String(process.env[tokenVar]).trim() : '';

  const storage = {
    имена_похожих_переменных: related.length ? related : ['ни одной не найдено'],
    адрес_взят_из: urlVar,
    токен_взят_из: tokenVar,
    адрес_начинается_на_https: rawUrl.startsWith('https://'),
    хост: rawUrl.replace(/^https?:\/\//, '').split('/')[0] || null,
    длина_токена: rawToken.length,
    в_токене_есть_пробелы: /\s/.test(process.env[tokenVar] || ''),
    пинг: 'не проверялся',
  };

  // Живой пинг: пишем и сразу читаем тестовый ключ.
  if (rawUrl && rawToken) {
    try {
      const r = await fetch(rawUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + rawToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SET', 'wd:health', String(Date.now()), 'EX', '60']),
      });
      storage.пинг = r.ok
        ? 'запись прошла, хранилище работает'
        : 'хранилище ответило ' + r.status + ' — ' + hint(r.status);
    } catch (e) {
      storage.пинг = 'не удалось достучаться: ' + String(e.message).slice(0, 120);
    }
  } else {
    storage.пинг = 'нечем пинговать — нет адреса или токена';
  }

  return L.send(res, 200, {
    ok: true,
    хранилище: storage,
    ключ_ии: {
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    },
    панель: {
      ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
      ADMIN_SECRET: Boolean(process.env.ADMIN_SECRET),
    },
    деньги: {
      PRICE_KZT: process.env.PRICE_KZT || '9990 (по умолчанию)',
      KASPI_URL: process.env.KASPI_URL || 'по умолчанию',
      LIMIT_GLOBAL_DAY: process.env.LIMIT_GLOBAL_DAY || '250 (по умолчанию)',
    },
  });
};

function hint(status) {
  if (status === 401 || status === 403) return 'токен не тот или он только для чтения';
  if (status === 404) return 'адрес указывает не на ту базу';
  if (status === 429) return 'исчерпан лимит тарифа';
  return 'смотрите панель Upstash';
}

module.exports = L.wrap(handler);
