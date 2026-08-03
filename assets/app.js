/* WeDesign — фронтенд. Ключей здесь нет и быть не может:
   всё, что стоит денег, живёт на сервере в /api. */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var openedAt = Date.now();
  var draftId = null;
  var order = null;
  var timerId = null;

  // Память браузера: чтобы человек не потерял сайт, закрыв вкладку.
  // В приватном режиме localStorage кидает ошибку — молча переживаем это.
  var STORE = {
    get: function (k) { try { return localStorage.getItem('wd_' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('wd_' + k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem('wd_' + k); } catch (e) {} }
  };

  /* ═══════════ контакты поддержки ═══════════ */
  // Номер живёт в переменных Vercel и подставляется во все места сразу.

  var support = null;

  function waLink(text) {
    if (!support || !support.whatsapp) return '';
    return 'https://wa.me/' + support.whatsapp + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  function askText(extra) {
    var base = 'Здравствуйте! Нужна помощь по WeDesign.';
    if (order && order.code) return base + ' Код заказа: ' + order.code + '.' + (extra ? ' ' + extra : '');
    var saved = STORE.get('order');
    if (saved) return base + ' Код заказа: ' + saved + '.';
    return base;
  }

  async function loadSupport() {
    try {
      var r = await fetch('/api/contacts');
      var d = await r.json();
      support = d.ok ? d.support : null;
      if (d.ok && d.plans) paintPlans(d.plans);
    } catch (e) { support = null; }
    paintSupport();
  }

  // Цены задаются переменными на сервере — подставляем их в разметку.
  function paintPlans(list) {
    list.forEach(function (p) {
      var money = String(p.price).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸';
      document.querySelectorAll('[data-price="' + p.id + '"]').forEach(function (el) {
        el.textContent = money;
      });
    });
  }

  function paintSupport() {
    var box = $('helpLinks');
    if (!support || (!support.whatsapp && !support.phone && !support.email)) {
      box.innerHTML = '<p class="micro">Контакты пока не настроены. Владельцу сервиса: задайте SUPPORT_WHATSAPP в переменных Vercel.</p>';
      return;
    }
    var html = '';
    if (support.whatsapp)
      html += '<a class="btn" href="' + waLink(askText()) + '" target="_blank" rel="noopener">Написать в WhatsApp</a>';
    if (support.phone)
      html += '<a class="btn o" href="tel:' + support.phone.replace(/[^0-9+]/g, '') + '">' + support.phone + '</a>';
    if (support.email)
      html += '<a class="btn o" href="mailto:' + support.email + '">' + support.email + '</a>';
    box.innerHTML = html;
    if (support.hours) $('helpHours').textContent = support.hours;

    if (support.whatsapp) {
      var btn = $('helpBtn');
      btn.href = waLink(askText());
      btn.hidden = false;
    }
  }

  loadSupport();

  /* ═══════════ согласие с условиями ═══════════ */
  // Версию поднимаем при каждом изменении оферты — тогда согласие спросят заново.
  var TERMS = '2026-08-01';
  var accepted = null;

  function loadAccepted() {
    try {
      var raw = STORE.get('terms');
      if (!raw) return null;
      var v = JSON.parse(raw);
      return v && v.version === TERMS ? v : null;
    } catch (e) { return null; }
  }

  function openGate() {
    $('gate').hidden = false;
    document.body.classList.add('locked');
  }
  function closeGate() {
    $('gate').hidden = true;
    document.body.classList.remove('locked');
  }

  accepted = loadAccepted();
  if (!accepted) openGate();

  $('gateYes').addEventListener('click', async function () {
    var box = $('gateBox');
    if (!box.checked) {
      var wrap = box.closest('.gate-check');
      wrap.classList.remove('bad');
      void wrap.offsetWidth;
      wrap.classList.add('bad');
      show($('gateError'), 'Поставьте галочку — без неё продолжить нельзя. Оба документа открываются по ссылкам выше.');
      setTimeout(function () { wrap.classList.remove('bad'); }, 2600);
      box.focus();
      return;
    }
    var btn = this;
    btn.disabled = true;
    try {
      // Расписку выписывает сервер: время и адрес он ставит свои.
      var r = await api('/api/terms', { version: TERMS });
      accepted = { version: TERMS, id: r.id, at: r.at };
      STORE.set('terms', JSON.stringify(accepted));
      $('gateId').textContent = r.id;
      $('gateAsk').hidden = true;
      $('gateDone').hidden = false;
    } catch (e) {
      show($('gateError'), e.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('gateGo').addEventListener('click', closeGate);

  $('gateNo').addEventListener('click', function () {
    $('gateAsk').hidden = true;
    $('gateBye').hidden = false;
  });

  $('gateBack').addEventListener('click', function () {
    $('gateBye').hidden = true;
    $('gateAsk').hidden = false;
    $('gateError').hidden = true;
    $('gateBox').focus();
  });

  // Если согласия нет — сервис не работает, независимо от того, куда нажали.
  function requireTerms() {
    if (accepted) return true;
    $('gateAsk').hidden = false;
    $('gateBye').hidden = true;
    openGate();
    return false;
  }

  /* ═══════════ движение ═══════════ */

  var rv = document.querySelectorAll('.rv');
  if (reduce) {
    for (var i = 0; i < rv.length; i++) rv[i].classList.add('on');
  } else {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8%' });
    for (var j = 0; j < rv.length; j++) io.observe(rv[j]);
  }

  var nav = document.querySelector('.nav');
  var bar = document.querySelector('.bar');
  function onScroll() {
    var y = window.scrollY || 0;
    nav.classList.toggle('stuck', y > 24);
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var burger = document.querySelector('.burger');
  var menu = document.querySelector('.menu');
  burger.addEventListener('click', function () {
    menu.classList.toggle('on');
    document.body.style.overflow = menu.classList.contains('on') ? 'hidden' : '';
  });
  menu.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') { menu.classList.remove('on'); document.body.style.overflow = ''; }
  });

  /* ═══════════ тикер ДНК под полем ввода ═══════════ */

  var HEX = '0123456789ABCDEF';
  function randCode() {
    var out = 'DNA-';
    for (var n = 0; n < 6; n++) out += HEX[Math.floor(Math.random() * 16)];
    return out;
  }
  if (!reduce) {
    setInterval(function () {
      var el = $('dnaTicker'), n = 0;
      var id = setInterval(function () {
        el.textContent = randCode();
        if (++n > 6) clearInterval(id);
      }, 60);
    }, 3600);
  }

  /* ═══════════ подсказки под полем ═══════════ */

  var SAMPLE = 'Мужской барбершоп на три кресла в Алмалинском районе. Стрижки, бороды, детские. ' +
    'Работаем по записи, но берём и без неё, если есть окно. Мастера с опытом от пяти лет, у каждого своё направление.';

  $('btnExample').addEventListener('click', function () {
    var d = $('fDescription');
    d.value = SAMPLE;
    d.dispatchEvent(new Event('input'));
    if (!$('fName').value.trim()) $('fName').value = 'Barber Loft';
    if (!$('fCategory').value.trim()) $('fCategory').value = 'барбершоп';
    d.focus();
  });

  $('btnAddPhotos').addEventListener('click', function () {
    $('build').scrollIntoView({ behavior: 'smooth' });
    setTimeout(function () { $('fPhotos').focus(); }, 500);
  });

  /* ═══════════ часы работы ═══════════ */

  var DAYS = [['mon','Понедельник'],['tue','Вторник'],['wed','Среда'],['thu','Четверг'],
              ['fri','Пятница'],['sat','Суббота'],['sun','Воскресенье']];

  var box = $('hoursBox');
  DAYS.forEach(function (d) {
    var row = document.createElement('div');
    row.className = 'hrow';
    row.dataset.key = d[0];
    row.innerHTML =
      '<label>' + d[1] + '</label>' +
      '<input type="time" value="09:00" data-from>' +
      '<input type="time" value="18:00" data-to>' +
      '<label class="off"><input type="checkbox" data-closed> выходной</label>';
    row.querySelector('[data-closed]').addEventListener('change', function () {
      row.classList.toggle('closed', this.checked);
    });
    box.appendChild(row);
  });

  function setDay(key, from, to, closed) {
    var row = box.querySelector('[data-key="' + key + '"]');
    row.querySelector('[data-from]').value = from;
    row.querySelector('[data-to]').value = to;
    var cb = row.querySelector('[data-closed]');
    cb.checked = !!closed;
    row.classList.toggle('closed', !!closed);
  }

  document.querySelectorAll('[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var p = b.dataset.preset;
      DAYS.forEach(function (d, i) {
        if (p === 'weekdays') setDay(d[0], '09:00', '18:00', i > 4);
        if (p === 'daily') setDay(d[0], '10:00', '22:00', false);
        if (p === 'always') setDay(d[0], '00:00', '23:59', false);
      });
    });
  });

  function collectHours() {
    var out = {};
    DAYS.forEach(function (d) {
      var row = box.querySelector('[data-key="' + d[0] + '"]');
      out[d[0]] = row.querySelector('[data-closed]').checked
        ? { closed: true }
        : { closed: false, from: row.querySelector('[data-from]').value, to: row.querySelector('[data-to]').value };
    });
    return out;
  }

  var desc = $('fDescription');
  function refreshHint() {
    var n = desc.value.trim().length;
    var hasServices = $('fServices').value.trim().length > 0;
    var hint = $('descHint');
    $('descCount').textContent = desc.value.length;

    if (n >= 40) hint.textContent = 'готово, можно собирать';
    else if (hasServices) hint.textContent = 'можно не заполнять — услуги указаны';
    else if (n === 0) hint.textContent = 'опишите дело или укажите услуги ниже';
    else hint.textContent = 'ещё ' + (40 - n) + ' символов';

    hint.classList.toggle('ready', n >= 40 || hasServices);
    if (n >= 40 || hasServices) $('heroError').hidden = true;
  }

  desc.addEventListener('input', refreshHint);
  $('fServices').addEventListener('input', refreshHint);

  /* ═══════════ вызов API ═══════════ */

  // Разбор ответа сервера. Если пришёл не JSON, а страница с ошибкой —
  // говорим об этом прямо, вместе с кодом. Так проще чинить.
  function parse(res, text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      if (res.status === 404)
        throw new Error('Сервер не нашёл /api (ошибка 404). Похоже, папка api лежит не в корне репозитория.');
      if (res.status >= 500)
        throw new Error('Функция на сервере упала (ошибка ' + res.status + '). Точная причина — в логах Vercel.');
      throw new Error('Сервер вернул страницу вместо ответа (код ' + res.status + ').');
    }
  }

  async function api(path, payload) {
    var res, text;
    try {
      res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      text = await res.text();
    } catch (e) {
      throw new Error('Не удалось связаться с сервером. Проверьте интернет и обновите страницу.');
    }
    var data = parse(res, text);
    if (!res.ok || !data.ok) throw new Error(data.error || 'Не получилось');
    return data;
  }

  function show(el, text, good) {
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle('good', !!good);
    // Каждое нажатие должно быть заметно, даже если текст тот же самый.
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  // Ошибка не просто пишется — она приводит человека к нужному полю
  // и подсвечивает его. Иначе кажется, что кнопка не работает.
  function pointAt(field, el, text) {
    show(el, text, false);
    field.classList.remove('bad');
    void field.offsetWidth;
    field.classList.add('bad');
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { field.focus({ preventScroll: true }); }, 400);
    setTimeout(function () { field.classList.remove('bad'); }, 2600);
  }

  /* ═══════════ генерация ═══════════ */

  async function generate() {
    if (!requireTerms()) return;
    var btn = $('btnGenerate');
    var err = $('genError');
    err.hidden = true;

    var payload = {
      name: $('fName').value.trim(),
      city: $('fCity').value.trim(),
      category: $('fCategory').value.trim(),
      style: $('fStyle').value.trim(),
      services: $('fServices').value.trim(),
      description: desc.value.trim(),
      phone: $('fPhone').value.trim(),
      whatsapp: $('fWhatsapp').value.trim(),
      address: $('fAddress').value.trim(),
      instagram: $('fInstagram').value.trim(),
      photos: $('fPhotos').value.split(/\s+/).filter(Boolean).slice(0, 3),
      hours: collectHours(),
      company_website: $('fCompanyWebsite').value,
      elapsed: Date.now() - openedAt
    };

    if (payload.description.length < 40 && !payload.services) {
      return pointAt(desc, err, payload.description.length === 0
        ? 'Заполните что-то одно: опишите дело в поле наверху или перечислите услуги ниже. Одного из двух достаточно.'
        : 'Описание короткое — не хватает ' + (40 - payload.description.length) +
          ' символов. Либо допишите, либо перечислите услуги ниже: одного из двух достаточно.');
    }
    if (!payload.name) return pointAt($('fName'), err, 'Не хватает названия — впишите его в поле «Название».');
    if (!payload.city) return pointAt($('fCity'), err, 'Не хватает города — впишите его в поле «Город».');
    if (!payload.category) return pointAt($('fCategory'), err, 'Не хватает сферы: барбершоп, кофейня, автосервис — впишите своё.');

    var hero = $('btnHero');
    btn.disabled = true;
    hero.disabled = true;
    btn.textContent = 'Собираю…';
    try {
      var data = await api('/api/generate', payload);
      draftId = data.draftId;
      STORE.set('draft', draftId);
      STORE.del('order');
      $('restore').hidden = true;
      $('resultDna').textContent = data.dnaCode;
      $('preview').srcdoc = data.html;
      $('result').hidden = false;
      // Телефон человек уже вписал выше — не спрашиваем второй раз.
      if (!$('fContact').value.trim())
        $('fContact').value = $('fWhatsapp').value.trim() || $('fPhone').value.trim();
      $('genHint').textContent = 'Осталось бесплатных сборок сегодня: ' + data.left;
      $('result').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      show(err, e.message);
    } finally {
      btn.disabled = false;
      hero.disabled = false;
      btn.textContent = 'Собрать сайт';
    }
  }

  $('btnGenerate').addEventListener('click', generate);

  // Кнопка в первом экране: если короткие поля ещё пустые — ведём к ним,
  // а не ругаемся непонятной ошибкой.
  $('btnHero').addEventListener('click', function () {
    if (!requireTerms()) return;
    var len = desc.value.trim().length;
    if (len < 40 && !$('fServices').value.trim()) {
      show($('heroError'), len === 0
        ? 'Опишите своё дело в этом поле — или пропустите его и перечислите услуги ниже. Достаточно чего-то одного.'
        : 'Ещё ' + (40 - len) + ' символов. Либо допишите, либо перечислите услуги ниже — достаточно одного.');
      desc.focus();
      return;
    }
    $('heroError').hidden = true;
    if (!$('fName').value.trim() || !$('fCity').value.trim() || !$('fCategory').value.trim()) {
      show($('heroError'), 'Описание готово. Осталось название, город и сфера — они чуть ниже, я перенёс вас туда.', true);
      $('build').scrollIntoView({ behavior: 'smooth' });
      setTimeout(function () {
        var f = !$('fName').value.trim() ? $('fName') : (!$('fCity').value.trim() ? $('fCity') : $('fCategory'));
        f.classList.add('bad');
        f.focus({ preventScroll: true });
        setTimeout(function () { f.classList.remove('bad'); }, 2600);
      }, 500);
      return;
    }
    generate();
  });
  $('btnRegen').addEventListener('click', generate);

  /* ═══════════ выбор тарифа ═══════════ */

  function chosenPlan() {
    var el = document.querySelector('input[name="plan"]:checked');
    return el ? el.value : 'site';
  }

  document.querySelectorAll('input[name="plan"]').forEach(function (r) {
    r.addEventListener('change', function () {
      document.querySelectorAll('.pick-opt').forEach(function (o) {
        o.classList.toggle('on', o.contains(r) && r.checked ? true : o.querySelector('input').checked);
      });
    });
  });

  /* ═══════════ заказ и оплата ═══════════ */

  function tenge(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  function startTimer(until) {
    clearInterval(timerId);
    timerId = setInterval(function () {
      var left = until - Date.now();
      if (left <= 0) { clearInterval(timerId); $('payTimer').textContent = 'истекла'; return; }
      var m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      $('payTimer').textContent = m + ':' + (s < 10 ? '0' : '') + s;
    }, 1000);
  }

  var watchId = null;
  var watchLeft = 0;

  // Пока владелец сверяет платёж, страница сама тихо спрашивает статус.
  // Клиенту не нужно ничего обновлять и никуда возвращаться.
  function watchOrder(code) {
    stopWatch();
    watchLeft = 40; // около двадцати минут
    async function tick() {
      if (watchLeft-- <= 0) return stopWatch();
      try {
        var r = await fetch('/api/status?code=' + encodeURIComponent(code));
        var d = await r.json();
        if (!d.ok) return;
        if (d.status === 'paid') {
          stopWatch();
          clearInterval(timerId);
          $('pay').hidden = true;
          showDone(d);
        } else if (d.status === 'rejected') {
          stopWatch();
          var t = 'Платёж не подтверждён' + (d.note ? ': ' + d.note : '') + '.';
          show($('claimMsg'), t + (support && support.whatsapp ? ' Напишите нам — кнопка помощи в углу экрана, назовите код ' + d.code + '.' : ''));
        }
      } catch (e) { /* сети нет — попробуем в следующий раз */ }
    }
    watchId = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', onVisible);
  }

  function onVisible() { if (!document.hidden && watchId && order) fetchOnce(); }

  async function fetchOnce() {
    try {
      var r = await fetch('/api/status?code=' + encodeURIComponent(order.code));
      var d = await r.json();
      if (d.ok && d.status === 'paid') {
        stopWatch();
        clearInterval(timerId);
        $('pay').hidden = true;
        showDone(d);
      }
    } catch (e) {}
  }

  function stopWatch() {
    if (watchId) clearInterval(watchId);
    watchId = null;
    document.removeEventListener('visibilitychange', onVisible);
  }

  function openPay(o) {
    order = o;
    $('payAmount').textContent = tenge(o.amount) + ' ₸';
    if (o.planTitle) $('payPlan').textContent = 'Тариф «' + o.planTitle + '»';
    $('payCode').textContent = o.code;
    $('cAmount').value = o.amount;
    $('kaspiLink').href = o.kaspiUrl || 'https://pay.kaspi.kz/pay/cwevqlzj';
    $('pay').hidden = false;
    startTimer(o.expiresAt);
  }

  $('btnCopy').addEventListener('click', function () {
    var code = $('payCode').textContent;
    var btn = this;
    function done() { btn.textContent = 'Скопирован'; setTimeout(function () { btn.textContent = 'Скопировать код'; }, 1800); }
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, done);
    else done();
  });

  $('btnTake').addEventListener('click', async function () {
    if (!requireTerms()) return;
    if (!draftId) return;
    var err = $('takeError');
    err.hidden = true;

    var phone = $('fContact').value.trim();
    if (phone.replace(/\D/g, '').length < 10) {
      $('fContact').focus();
      return show(err, 'Впишите телефон в формате +7 7XX XXX XX XX — по нему мы свяжемся, если с платежом что-то не сойдётся.');
    }

    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Бронирую сумму…';
    try {
      var made = await api('/api/order', {
        draftId: draftId,
        contactPhone: phone,
        plan: chosenPlan(),
        termsId: accepted ? accepted.id : ''
      });
      STORE.set('order', made.code);
      openPay(made);
      $('pay').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      show(err, e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Забрать сайт';
    }
  });

  $('btnClaim').addEventListener('click', async function () {
    if (!order) return;
    var msg = $('claimMsg');
    msg.hidden = true;
    var btn = this;
    btn.disabled = true;
    try {
      var data = await api('/api/claim', {
        code: order.code,
        payerName: $('cPayer').value.trim(),
        receiptNo: $('cReceipt').value.trim(),
        amountPaid: Number(String($('cAmount').value).replace(/\D/g, '')),
        paidAt: $('cPaidAt').value
      });
      show(msg, data.message + ' Не закрывайте страницу — как только платёж подтвердят, ссылка на сайт появится здесь сама. Код заказа: ' + order.code + '.', true);
      if (support && support.whatsapp) {
        var a = document.createElement('a');
        a.href = waLink(askText());
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Написать нам, если что-то не так';
        a.style.cssText = 'display:inline-block;margin-top:10px;color:var(--ac);font-weight:700';
        msg.appendChild(document.createElement('br'));
        msg.appendChild(a);
      }
      watchOrder(order.code);
    } catch (e) {
      show(msg, e.message);
    } finally {
      btn.disabled = false;
    }
  });

  /* ═══════════ готовый сайт ═══════════ */

  function showDone(data) {
    $('btnDownload').href = '/api/download?code=' + encodeURIComponent(data.code);

    if (data.publicUrl) {
      var url = location.origin + data.publicUrl;
      $('doneUrl').textContent = url;
      $('doneUrl').href = url;
      $('btnOpenSite').href = url;
      $('liveBox').hidden = false;
      $('doneTitle').textContent = 'Ваш сайт работает';
      $('doneLead').textContent = 'Ставьте эту ссылку в шапку Instagram, в карточку 2ГИС и на визитку. Сайт открывается сразу, ничего устанавливать не нужно.';
    } else {
      $('liveBox').hidden = true;
      $('doneTitle').textContent = 'Ваш сайт готов';
      $('doneLead').textContent = 'Скачайте файл — это ваш сайт целиком. Разместить его можно бесплатно за пару минут, инструкция рядом с кнопкой.';
    }
    $('doneNote').innerHTML =
      'Нужно поправить текст или добавить фотографии — ' +
      (support && support.whatsapp
        ? '<a href="' + waLink('Здравствуйте! Хочу поправить сайт по заказу ' + data.code + '.') +
          '" target="_blank" rel="noopener" style="color:var(--ac);font-weight:700">напишите нам в WhatsApp</a>'
        : 'напишите нам') +
      ' и назовите код заказа ' + data.code + '. Соберём заново и пришлём новый файл.';
    $('done').hidden = false;
    $('done').scrollIntoView({ behavior: 'smooth' });
  }

  /* ═══════════ статус заказа ═══════════ */

  var LABEL = {
    awaiting_payment: 'Ждём оплату',
    claimed: 'Платёж на проверке',
    paid: 'Оплачено — файл готов к скачиванию',
    rejected: 'Отклонено',
    expired: 'Бронь истекла — соберите заказ заново'
  };

  $('btnStatus').addEventListener('click', async function () {
    var code = $('sCode').value.trim().toUpperCase();
    var out = $('statusBox');
    out.hidden = true;
    if (!code) return;
    try {
      var res = await fetch('/api/status?code=' + encodeURIComponent(code));
      var data = parse(res, await res.text());
      if (!data.ok) throw new Error(data.error);
      var text = LABEL[data.status] || data.status;
      if (data.note) text += ' · ' + data.note;
      show(out, text, data.status === 'paid');
      if (data.status === 'awaiting_payment' || data.status === 'claimed') {
        STORE.set('order', data.code);
        openPay(data);
        $('pay').scrollIntoView({ behavior: 'smooth' });
      }
      if (data.status === 'paid') showDone(data);
    } catch (e) {
      show(out, e.message || 'Заказ не найден');
    }
  });

  /* ═══════════ возврат к прошлой работе ═══════════ */

  (async function restore() {
    var savedDraft = STORE.get('draft');
    var savedOrder = STORE.get('order');

    if (savedDraft) {
      try {
        var r = await fetch('/api/draft?id=' + encodeURIComponent(savedDraft));
        var d = await r.json();
        if (d.ok) {
          draftId = savedDraft;
          $('resultDna').textContent = d.dnaCode;
          $('preview').srcdoc = d.html;
          $('result').hidden = false;
          $('restore').hidden = false;
        } else {
          STORE.del('draft');
        }
      } catch (e) { /* сети нет — просто не восстанавливаем */ }
    }

    if (savedOrder) {
      try {
        var r2 = await fetch('/api/status?code=' + encodeURIComponent(savedOrder));
        var s2 = await r2.json();
        if (s2.ok && (s2.status === 'awaiting_payment' || s2.status === 'claimed')) {
          openPay(s2);
          if (s2.status === 'claimed') watchOrder(s2.code);
        } else if (s2.ok && s2.status === 'paid') {
          $('sCode').value = s2.code;
          showDone(s2);
        } else {
          STORE.del('order');
        }
      } catch (e) { /* тихо */ }
    }
  })();
})();
