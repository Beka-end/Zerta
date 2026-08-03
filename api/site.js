// api/site.js — отдаёт опубликованный сайт клиента по адресу /s/{slug}

const L = require('./_lib');
const R = require('./_render');

const handler = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const slug = L.clean(url.searchParams.get('slug'), 60).toLowerCase();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const site = slug ? await L.getJSON(`wd:site:${slug}`) : null;
  const draft = site ? await L.getJSON(`wd:draft:${site.draftId}`) : null;
  const order = site ? await L.getJSON(`wd:order:${site.code}`) : null;

  if (!site || !draft || !order || order.status !== 'paid') {
    res.statusCode = 404;
    return res.end(
      `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Сайт не найден</title></head>
<body style="font:16px/1.6 system-ui;padding:56px 24px;max-width:520px;margin:0 auto;color:#13161B">
<h1 style="font-size:26px;letter-spacing:-.03em">Такого сайта здесь нет</h1>
<p style="color:#6A727E">Возможно, адрес набран с ошибкой или сайт снят с публикации.</p>
<p><a href="/" style="color:#2563EB;font-weight:700">На главную WeDesign</a></p></body></html>`
    );
  }

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  res.statusCode = 200;
  return res.end(R.render(draft.data, draft.dna, { preview: false }));
};

module.exports = L.wrap(handler);
