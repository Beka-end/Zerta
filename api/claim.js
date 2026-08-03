// api/claim.js — клиент сообщает, что оплатил. Здесь же считается «риск-балл»,
// чтобы владелец видел, что именно нужно перепроверить в Kaspi.

const L = require('./_lib');

const handler = async (req, res) => {
  if (req.method !== 'POST') return L.fail(res, 405, 'Только POST');

  const ip = L.clientIp(req);
  const rate = await L.limit(`wd:lim:claim:${ip}`, 10, L.DAY);
  if (!rate.ok) return L.fail(res, 429, 'Слишком много попыток. Напишите нам в WhatsApp');

  const body = await L.readBody(req);
  const code = L.clean(body.code, 12).toUpperCase();
  const payerName = L.clean(body.payerName, 80);
  const receiptNo = L.clean(body.receiptNo, 40).replace(/\s+/g, '');
  const paidAt = L.clean(body.paidAt, 30);
  const raw = Number(body.amountPaid);
  const amountPaid = Number.isFinite(raw) && raw > 0 && raw < 10000000 ? Math.round(raw) : 0;

  const order = await L.getJSON(`wd:order:${code}`);
  if (!order) return L.fail(res, 404, 'Заказ с таким кодом не найден');
  if (order.status === 'paid') return L.send(res, 200, { ok: true, status: 'paid' });

  // Бронь истекла — сумма уже вернулась в оборот и могла достаться другому заказу.
  // Принимать по ней чек нельзя: платежи перепутаются.
  const dead = order.status === 'expired' || order.expiresAt < Date.now() - 30 * 60000;
  if (dead)
    return L.fail(
      res,
      409,
      'Бронь на эту сумму истекла, и она уже вернулась в общий оборот. Соберите заказ заново — получите свежую сумму. Если вы уже успели заплатить, напишите нам и назовите код ' + code + ' и номер чека, деньги не потеряются.'
    );

  // Kaspi показывает получателю только имя и первую букву фамилии: «Асхат Н.»
  // Полное ФИО просить бессмысленно — владельцу не с чем будет сравнивать.
  if (!/^[^\s]{2,}\s+[^\s]/.test(payerName))
    return L.fail(res, 400, 'Впишите отправителя так, как его показывает Kaspi: имя и первая буква фамилии, например «Асхат Н.»');
  if (receiptNo.length < 4) return L.fail(res, 400, 'Впишите номер чека из Kaspi');

  const risk = [];
  if (amountPaid !== order.amount) risk.push('Сумма в заявке не совпадает с забронированной');
  if (order.status === 'rejected')
    risk.push('Заказ был отклонён, клиент подал чек повторно — сверьте платёж заново, прежде чем подтверждать');
  if (order.claim)
    risk.push('По этому заказу чек подаётся не первый раз — предыдущий: ' + String(order.claim.receiptNo || '—'));

  const receiptFresh = await L.store.sadd('wd:receipts', receiptNo);
  if (receiptFresh !== 1) risk.push('Такой номер чека уже использовался в другом заказе');

  // За человека часто платит родственник — само по себе это не тревога.
  // Сверяем имя, только если оно уже называлось раньше в этом заказе.
  if (order.contactName) {
    const known = order.contactName.toLowerCase();
    const same = payerName.toLowerCase().split(/\s+/).some((w) => known.includes(w));
    if (!same) risk.push('Имя плательщика не совпадает с именем в заказе');
  }

  // Заявку об оплате тоже привязываем к устройству — цепочка должна сходиться.
  const device = L.fingerprint(req);
  if (order.device && order.device !== device)
    risk.push('Чек отправлен с другого устройства, чем оформлялся заказ');

  order.status = 'claimed';
  order.claim = { payerName, receiptNo, paidAt, amountPaid, at: Date.now(), ip, device };
  order.risk = risk;

  await L.setJSON(`wd:order:${code}`, order, 120 * L.DAY);

  return L.send(res, 200, {
    ok: true,
    status: 'claimed',
    message: 'Проверим платёж вручную — обычно в течение нескольких часов в рабочее время.',
  });
};

module.exports = L.wrap(handler);
