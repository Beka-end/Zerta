// api/contacts.js — контакты поддержки для страницы.
// Номер задаётся переменными Vercel, поэтому лежит в одном месте,
// а не разбросан по разметке.

const L = require('./_lib');

const handler = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return L.send(res, 200, { ok: true, support: L.contacts(), plans: L.plans() });
};

module.exports = L.wrap(handler);
