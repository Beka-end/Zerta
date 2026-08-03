// api/terms.js — фиксация согласия с условиями.
//
// Зачем отдельная ручка: галочку нажимают в браузере клиента, а браузер
// у клиента в руках. Поэтому запись делает СЕРВЕР: он ставит своё время,
// свой адрес запроса и подписывает результат ключом, которого у клиента нет.
// Изменить такую запись задним числом нельзя — подпись сломается.

const L = require('./_lib');

const handler = async (req, res) => {
  if (req.method !== 'POST') return L.fail(res, 405, 'Только POST');

  const ip = L.clientIp(req);
  const rate = await L.limit(`wd:lim:terms:${ip}`, 30, L.DAY);
  if (!rate.ok) return L.fail(res, 429, 'Слишком много обращений');

  const body = await L.readBody(req);
  const version = L.clean(body.version, 20);
  if (!version) return L.fail(res, 400, 'Не указана редакция документов');

  // Номер расписки — его клиент увидит на экране и сможет назвать при споре.
  const id = 'ACC-' + L.code(8);

  const receipt = L.signReceipt({
    id,
    event: 'terms_accepted',
    version,
    // Время наше, а не с часов клиента: их можно перевести.
    at: Date.now(),
    ip,
    device: L.fingerprint(req),
    ua: L.clean(req.headers['user-agent'], 200),
    lang: L.clean(req.headers['accept-language'], 60),
  });

  // Храним долго: расписка нужна именно на случай спора.
  await L.setJSON(`wd:acc:${id}`, receipt, 400 * L.DAY);
  await L.store.zadd('wd:accs', receipt.at, id);

  return L.send(res, 200, {
    ok: true,
    id,
    at: receipt.at,
    version,
  });
};

module.exports = L.wrap(handler);
