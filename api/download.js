// api/download.js — файл сайта для самого клиента.
//
// Отдаём только по коду ОПЛАЧЕННОГО заказа: без оплаты файла нет,
// как нет и опубликованного сайта.

const L = require('./_lib');
const R = require('./_render');

const handler = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const code = L.clean(url.searchParams.get('code'), 12).toUpperCase();
  if (!code) return L.fail(res, 400, 'Укажите код заказа');

  const ip = L.clientIp(req);
  const rate = await L.limit(`wd:lim:dl:${ip}`, 30, L.DAY);
  if (!rate.ok) return L.fail(res, 429, 'Слишком много запросов. Попробуйте завтра');

  const order = await L.getJSON(`wd:order:${code}`);
  if (!order) return L.fail(res, 404, 'Заказ не найден');
  if (order.status !== 'paid')
    return L.fail(res, 403, 'Файл доступен после подтверждения оплаты');

  const draft = await L.getJSON(`wd:draft:${order.draftId}`);
  if (!draft)
    return L.fail(res, 404, 'Черновик уже удалён. Напишите нам, соберём файл вручную');

  const name = L.slugify(order.business) + '.html';
  // standalone: копия для клиента, без подписи сервиса и без привязки к нам.
  const html = R.render(draft.data, draft.dna, { preview: false, standalone: true });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.end(html);
};

module.exports = L.wrap(handler);
