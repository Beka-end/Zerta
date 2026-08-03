/* Панель WeDesign. Токен живёт 8 часов и проверяется подписью на сервере —
   подделать его в браузере нельзя, а без него ни одна операция не пройдёт. */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'wd_admin_token';
  var token = sessionStorage.getItem(KEY) || '';
  var orders = [];
  var filter = 'claimed';
  var kaspiUrl = '';

  function parse(res, text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      if (res.status === 404)
        throw new Error('Сервер не нашёл /api/admin (404). Папка api лежит не в корне репозитория.');
      if (res.status >= 500)
        throw new Error('Функция упала (ошибка ' + res.status + '). Причина — в логах Vercel.');
      throw new Error('Сервер вернул страницу вместо ответа (код ' + res.status + ').');
    }
  }

  async function call(payload) {
    var res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    var data = parse(res, await res.text());
    if (res.status === 401) { logout(); throw new Error('Сессия закончилась, войдите заново'); }
    if (!res.ok || !data.ok) throw new Error(data.error || 'Не получилось');
    return data;
  }

  function logout() {
    token = '';
    sessionStorage.removeItem(KEY);
    $('panel').hidden = true;
    $('loginBox').hidden = false;
  }

  /* ————— вход ————— */

  async function login() {
    var err = $('loginErr');
    err.hidden = true;
    var btn = $('btnLogin');
    btn.disabled = true;
    try {
      var res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password: $('pw').value })
      });
      var data = parse(res, await res.text());
      if (!data.ok) throw new Error(data.error);
      token = data.token;
      sessionStorage.setItem(KEY, token);
      $('pw').value = '';
      open();
    } catch (e) {
      err.hidden = false;
      err.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  $('btnLogin').addEventListener('click', login);
  $('pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
  $('btnLogout').addEventListener('click', logout);
  $('btnReload').addEventListener('click', function () { load(); });

  function open() {
    $('loginBox').hidden = true;
    $('panel').hidden = false;
    load();
  }

  /* ————— список ————— */

  var LABEL = {
    awaiting_payment: 'ждёт оплату',
    claimed: 'на проверке',
    paid: 'оплачено, файл выдан',
    rejected: 'отклонено',
    expired: 'бронь истекла'
  };

  function tenge(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function when(ts) { return ts ? new Date(ts).toLocaleString('ru-RU') : '—'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function load() {
    try {
      var data = await call({ action: 'list' });
      orders = data.orders || [];
      kaspiUrl = data.kaspiUrl;
      $('kaspiOpen').href = kaspiUrl;
      var waiting = orders.filter(function (o) { return o.status === 'claimed'; }).length;
      var pr = (data.plans || []).map(function (p) { return p.title + ' ' + tenge(p.price) + ' ₸'; }).join(' · ');
      $('meta').textContent = pr + ' · хранилище: ' + data.storage + ' · ждут проверки: ' + waiting;
      render();
    } catch (e) {
      alert(e.message);
    }
  }

  function render() {
    var list = $('list');
    var shown = orders.filter(function (o) { return filter === 'all' || o.status === filter; });
    if (!shown.length) {
      list.innerHTML = '<p class="micro">Здесь пока пусто. Как только клиент оформит заказ, он появится в этом списке.</p>';
      return;
    }
    list.innerHTML = shown.map(card).join('');

    list.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () { act(b.dataset.act, b.dataset.code); });
    });
    list.querySelectorAll('[data-acc]').forEach(function (b) {
      b.addEventListener('click', function () { checkReceipt(b.dataset.acc); });
    });
  }

  function card(o) {
    var risky = o.risk && o.risk.length;
    var c = o.claim || {};
    var checklist = o.status === 'claimed'
      ? '<div class="steps-check">Проверьте в Kaspi по порядку:<br>' +
        '1. Найдите поступление ровно на <b>' + tenge(o.amount) + ' ₸</b> около ' + esc(c.paidAt || 'указанного времени') + '.<br>' +
        '2. Сверьте отправителя: клиент назвался <b>' + esc(c.payerName) + '</b>. Kaspi покажет имя и первую букву фамилии — полной фамилии там не будет, это нормально.<br>' +
        '3. Чек <b>' + esc(c.receiptNo) + '</b> — он нужен против повторов: если этот номер уже был в другом заказе, карточка станет оранжевой.<br>' +
        'Главный признак — сумма. Совпала сумма и примерно совпало время — платёж ваш.</div>'
      : '';

    return '' +
      '<div class="order' + (risky ? ' hot' : '') + '">' +
        '<div class="order-top">' +
          '<div><b class="mono" style="font-size:18px">' + esc(o.code) + '</b> · ' + esc(o.business) + ', ' + esc(o.city) + '</div>' +
          '<span class="tag ' + o.status + '">' + (LABEL[o.status] || o.status) + '</span>' +
        '</div>' +
        '<div class="kv">' +
          '<div><span>Сумма к оплате</span><b class="mono">' + tenge(o.amount) + ' ₸</b></div>' +
          '<div><span>Тариф</span><b>' + esc(o.planTitle || 'Готовый сайт') +
            (o.plan === 'site' ? ' <span style="color:var(--ac);font-size:12px">— публикуем</span>' : ' <span style="color:var(--mu);font-size:12px">— только файл</span>') + '</b></div>' +
          '<div><span>Телефон для связи</span><b><a href="tel:' + esc(String(o.contactPhone).replace(/[^0-9+]/g, '')) +
            '" style="color:var(--ac)">' + esc(o.contactPhone) + '</a></b></div>' +
          '<div><span>Заказ создан</span><b style="font-size:14px">' + when(o.createdAt) + '</b></div>' +
          (o.slug ? '<div><span>Адрес сайта</span><b style="font-size:14px">/s/' + esc(o.slug) + '</b></div>' : '') +
          (c.payerName ? '<div><span>Плательщик по чеку</span><b>' + esc(c.payerName) + '</b></div>' : '') +
          (c.receiptNo ? '<div><span>Номер чека</span><b class="mono">' + esc(c.receiptNo) + '</b></div>' : '') +
          (c.amountPaid ? '<div><span>Заявленная сумма</span><b class="mono">' + tenge(c.amountPaid) + ' ₸</b></div>' : '') +

          (o.terms && o.terms.verified
            ? '<div><span>Согласие с условиями</span><b style="font-size:13px">' +
              when(o.terms.at) + '<br><span class="mono" style="font-size:12px">' + esc(o.terms.id) + '</span>' +
              (o.terms.sameDevice === false ? '<br><span style="color:var(--amber);font-size:12px">заказ с другого устройства</span>' : '') +
              '</b></div>'
            : '<div><span>Согласие с условиями</span><b style="font-size:13px;color:var(--danger)">не зафиксировано</b></div>') +
        '</div>' +
        (risky ? '<div class="risk"><b>Обратите внимание:</b><ul><li>' + o.risk.map(esc).join('</li><li>') + '</li></ul></div>' : '') +
        chain(o) +
        checklist +
        '<div class="row-actions">' +
          '<button class="btn btn-ghost btn-sm" data-act="preview" data-code="' + o.code + '">Посмотреть</button>' +
          (o.terms && o.terms.verified
            ? '<button class="btn btn-ghost btn-sm" data-acc="' + esc(o.terms.id) + '">Расписка</button>'
            : '') +
          (o.status === 'paid' ? '<button class="btn btn-ghost btn-sm" data-act="export" data-code="' + o.code + '">Скачать файл</button>' : '') +
          (o.status === 'paid' && o.slug && o.contactPhone
            ? '<a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/' +
              encodeURIComponent(String(o.contactPhone).replace(/\D/g, '')) +
              '?text=' + encodeURIComponent(
                'Здравствуйте! Ваш сайт готов и работает: ' + location.origin + '/s/' + o.slug +
                '\nЭту ссылку можно ставить в Instagram, 2ГИС и на визитку. Заказ ' + o.code + '.'
              ) + '">Отправить ссылку в WhatsApp</a>'
            : '') +
          (o.status !== 'paid' ? '<button class="btn btn-sm" data-act="confirm" data-code="' + o.code + '">Платёж получен' + (o.plan === 'site' ? ', опубликовать' : ', выдать файл') + '</button>' : '') +
          (o.status === 'paid' ? '<button class="btn btn-ghost btn-sm" data-act="revoke" data-code="' + o.code + '">Отозвать</button>' : '') +
          (o.status !== 'paid' && o.status !== 'rejected' ? '<button class="btn btn-ghost btn-sm" data-act="reject" data-code="' + o.code + '">Платежа нет</button>' : '') +
        '</div>' +
      '</div>';
  }

  // Что мы знаем о человеке за этим заказом. Регистрации нет — поэтому
  // единственная настоящая привязка к личности приходит из банка.
  function chain(o) {
    if (o.status !== 'claimed' && o.status !== 'paid') return '';
    var c = o.claim || {};
    var rows = [];
    rows.push(['Назвался при заказе', esc(o.contactPhone) + ' — телефон не подтверждён, вписать можно любой']);
    if (o.terms && o.terms.verified)
      rows.push(['Принял условия', when(o.terms.at) + ', адрес ' + esc(o.terms.ip) +
        (o.terms.sameDevice === false ? ' — но заказ оформлен с другого устройства' : ' — с того же устройства, что и заказ')]);
    else
      rows.push(['Принял условия', '<span style="color:var(--danger)">не зафиксировано</span>']);
    if (c.payerName)
      rows.push(['Опознан банком', '<b>' + esc(c.payerName) + '</b> — так Kaspi показывает отправителя. Это единственное имя, которое проверил не мы, а банк']);
    return '<div class="chain"><b>Кто стоит за заказом</b>' +
      rows.map(function (r) {
        return '<div class="chain-row"><span>' + r[0] + '</span><div>' + r[1] + '</div></div>';
      }).join('') + '</div>';
  }

  async function act(action, code) {
    try {
      if (action === 'export') {
        var f = await call({ action: 'export', code: code });
        var blob = new Blob([f.html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = f.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        alert('Файл сохранён: ' + f.filename + '\n\nОбычно клиент скачивает его сам на сайте. Эта копия — если он потерял доступ.');
        return;
      }
      if (action === 'preview') {
        var data = await call({ action: 'preview', code: code });
        $('dlgTitle').textContent = code + ' · ' + data.dnaCode;
        $('dlgFrame').srcdoc = data.html;
        $('dlg').showModal();
        return;
      }
      if (action === 'confirm') {
        if (!confirm('Вы своими глазами увидели этот платёж в Kaspi?')) return;
      }
      var note = '';
      if (action === 'reject' || action === 'revoke') {
        note = prompt('Причина — её увидит клиент при проверке заказа:', 'Платёж на эту сумму не найден') || '';
      }
      await call({ action: action, code: code, note: note });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  /* ————— проверка расписки о согласии ————— */

  $('btnAcc').addEventListener('click', async function () {
    var id = $('accId').value.trim().toUpperCase();
    var out = $('accOut');
    out.hidden = true;
    out.className = 'acc-out';
    if (!id) return;
    try {
      var d = await call({ action: 'receipt', id: id });
      var r = d.receipt;
      out.innerHTML =
        '<div class="verdict ' + (d.valid ? 'ok' : 'bad') + '">' +
          (d.valid
            ? 'Подпись цела. Запись подлинная и не изменялась после создания.'
            : 'Подпись не сходится. Запись изменена или сделана другим ключом — доверять ей нельзя.') +
        '</div>' +
        '<h3>Расписка ' + esc(r.id) + '</h3>' +
        '<table>' +
          '<tr><td>Что принято</td><td>Публичная оферта и политика обработки персональных данных, редакция <b>' + esc(r.version) + '</b></td></tr>' +
          '<tr><td>Когда</td><td><b>' + when(r.at) + '</b> (время сервера, не устройства клиента)</td></tr>' +
          '<tr><td>Сетевой адрес</td><td class="mono">' + esc(r.ip) + '</td></tr>' +
          '<tr><td>Отпечаток устройства</td><td class="mono">' + esc(r.device) + '</td></tr>' +
          '<tr><td>Браузер</td><td style="font-size:13px">' + esc(r.ua || '—') + '</td></tr>' +
          '<tr><td>Язык</td><td>' + esc(r.lang || '—') + '</td></tr>' +
          '<tr><td>Подпись</td><td class="mono" style="font-size:11px;word-break:break-all;line-height:1.5">' + esc(r.sig) + '</td></tr>' +
        '</table>' +
        '<p class="micro" style="margin-top:14px">Эту таблицу можно распечатать или сохранить как PDF через печать страницы.</p>';
      out.classList.add(d.valid ? 'ok' : 'bad');
      out.hidden = false;
    } catch (e) {
      out.className = 'acc-out bad';
      out.innerHTML = '<div class="verdict bad">' + esc(e.message) + '</div>';
      out.hidden = false;
    }
  });

  $('accId').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('btnAcc').click(); });

  // Из карточки заказа — сразу к его расписке.
  function checkReceipt(id) {
    $('accId').value = id;
    $('btnAcc').click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-f]').forEach(function (b) {
    b.addEventListener('click', function () { filter = b.dataset.f; render(); });
  });
  $('dlgClose').addEventListener('click', function () { $('dlg').close(); });

  if (token) open();
})();
