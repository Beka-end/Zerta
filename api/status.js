// api/status.js — клиент проверяет свой заказ по коду WD-XXXX.

const L = require('./_lib');

const handler = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const code = L.clean(url.searchParams.get('code'), 12).toUpperCase();
  if (!code) return L.fail(res, 400, 'Укажите код заказа');

  const ip = L.clientIp(req);
  const rate = await L.limit(`wd:lim:status:${ip}`, 200, L.DAY);
  if (!rate.ok) return L.fail(res, 429, 'Слишком много запросов');

  const order = await L.getJSON(`wd:order:${code}`);
  if (!order) return L.fail(res, 404, 'Заказ не найден');

  // Просроченную бронь освобождаем — сумма возвращается в оборот.
  if (order.status === 'awaiting_payment' && order.expiresAt < Date.now()) {
    order.status = 'expired';
    await L.store.srem('wd:amounts', String(order.amount));
    await L.setJSON(`wd:order:${code}`, order, 120 * L.DAY);
  }

  const out = {
    ok: true,
    code: order.code,
    status: order.status,
    amount: order.amount,
    expiresAt: order.expiresAt,
    business: order.business,
    fileReady: order.status === 'paid',
    note: order.note || null,
    plan: order.plan || 'site',
    planTitle: order.planTitle || '',
    slug: order.slug || null,
    kaspiUrl: process.env.KASPI_URL || 'https://pay.kaspi.kz/pay/cwevqlzj',
    support: L.contacts(),
  };

  // Для тарифа «Готовый сайт» отдаём адрес опубликованной страницы.
  if (order.status === 'paid' && order.slug) out.publicUrl = `/s/${order.slug}`;

  return L.send(res, 200, out);
};

module.exports = L.wrap(handler);
