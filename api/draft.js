// api/draft.js — вернуть уже собранный сайт по его номеру.
// Модель здесь не вызывается: человек просто возвращается к своему черновику,
// платить за это второй раз незачем.

const L = require('./_lib');
const R = require('./_render');

const handler = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const id = L.clean(url.searchParams.get('id'), 20);
  if (!id) return L.fail(res, 400, 'Не указан черновик');

  const ip = L.clientIp(req);
  const rate = await L.limit(`wd:lim:draft:${ip}`, 150, L.DAY);
  if (!rate.ok) return L.fail(res, 429, 'Слишком много запросов');

  const draft = await L.getJSON(`wd:draft:${id}`);
  if (!draft) return L.fail(res, 404, 'Черновик устарел');

  // Водяной знак снимаем, только если по этому черновику уже подтверждена оплата.
  let paid = false;
  if (draft.orderCode) {
    const order = await L.getJSON(`wd:order:${draft.orderCode}`);
    paid = Boolean(order && order.status === 'paid');
  }

  return L.send(res, 200, {
    ok: true,
    html: R.render(draft.data, draft.dna, { preview: !paid }),
    dnaCode: R.dnaCode(draft.dna),
    orderCode: draft.orderCode || null,
    name: draft.data.name,
  });
};

module.exports = L.wrap(handler);
