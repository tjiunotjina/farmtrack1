(function () {
  'use strict';

  var cfg = window.ORUTUMBO_CONFIG || {};
  var KEY = 'orutumbo_admin_secret';
  var $ = function (s) { return document.querySelector(s); };
  var state = { tab: 'customers', invoiceFilter: '', plans: [] };

  // Everything is built with textContent, never innerHTML, so nothing a
  // customer typed (farm name, bank reference...) can run as markup here.
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k]);
    });
    [].concat(kids === undefined ? [] : kids).forEach(function (c) { n.appendChild(c && c.nodeType ? c : document.createTextNode(c == null ? '' : String(c))); });
    return n;
  }
  function money(n) { return 'N$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function day(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Windhoek' }) : ''; }
  function chip(s) { return el('span', { class: 'chip ' + s }, s ? String(s).replace('_', ' ') : ''); }
  function say(text, isErr) { var m = $('#msg'); m.textContent = text || ''; m.className = 'msg' + (isErr ? ' err' : ''); }

  function api(path, opts) {
    opts = opts || {};
    return fetch(cfg.API_URL + '/api/admin' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': sessionStorage.getItem(KEY) || '' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var e = new Error(data.error || 'Request failed (' + res.status + ')'); e.status = res.status; throw e; }
        return data;
      });
    });
  }

  /* ---------- sign in / out ---------- */
  function showApp(on) {
    $('#login').hidden = on; $('#app').hidden = !on; $('#logout').hidden = !on;
  }
  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('#login-msg'); msg.textContent = 'Checking…';
    sessionStorage.setItem(KEY, $('#secret').value);
    api('/summary').then(function (s) { msg.textContent = ''; $('#secret').value = ''; showApp(true); start(s); })
      .catch(function (err) { sessionStorage.removeItem(KEY); msg.textContent = err.status ? err.message : "Couldn't reach the server. It may be waking up: try again in a minute."; });
  });
  $('#logout').addEventListener('click', function () { sessionStorage.removeItem(KEY); showApp(false); $('#view').textContent = ''; });

  /* ---------- summary tiles ---------- */
  function renderTiles(s) {
    var subs = s.subscriptions || {};
    var tiles = [
      ['Customers', s.customers, ''],
      ['Paying subscriptions', subs.active || 0, 'MRR ' + money(s.mrr)],
      ['On trial', subs.trialing || 0, (subs.expired || 0) + ' expired'],
      ['Collected this month', money(s.collectedThisMonth), money(s.collectedTotal) + ' all time'],
      ['Outstanding', money(s.outstanding), s.openInvoices + ' open invoice' + (s.openInvoices === 1 ? '' : 's')],
      ['Overdue', money(s.overdue), s.overdueInvoices + ' invoice' + (s.overdueInvoices === 1 ? '' : 's')]
    ];
    var box = $('#tiles'); box.textContent = '';
    tiles.forEach(function (t) { box.appendChild(el('div', { class: 'tile' }, [el('small', {}, t[0]), el('b', {}, t[1]), el('span', {}, t[2])])); });
  }
  function refreshSummary() { return api('/summary').then(renderTiles); }

  /* ---------- tables ---------- */
  function table(heads, rows) {
    var t = el('table', {}, [el('thead', {}, el('tr', {}, heads.map(function (h) { return el('th', h.num ? { class: 'num' } : {}, h.t); })))]);
    var body = el('tbody');
    if (!rows.length) body.appendChild(el('tr', {}, el('td', { colspan: heads.length }, 'Nothing here yet.')));
    rows.forEach(function (r) { body.appendChild(el('tr', {}, r.map(function (c, i) { return el('td', heads[i] && heads[i].num ? { class: 'num' } : {}, c); }))); });
    t.appendChild(body); return t;
  }
  function setView(node) { var v = $('#view'); v.textContent = ''; v.appendChild(node); }

  var loaders = {
    customers: function () {
      return api('/customers').then(function (d) {
        setView(table([{ t: 'Customer no.' }, { t: 'Farm' }, { t: 'Owner' }, { t: 'Plan' }, { t: 'Status' }, { t: 'Owing', num: true }, { t: 'Paid', num: true }, { t: 'Joined' }, { t: '' }],
          d.customers.map(function (c) {
            return [c.customer_number || '', c.name, [c.owner_name, el('br'), c.email || ''], c.plan_id || 'free', chip(c.sub_status || ''), money(c.outstanding), money(c.paid_total), day(c.created_at),
              el('span', { class: 'actions' }, el('button', { class: 'ghost', onclick: function () { openInvoiceForm(c.customer_number); } }, 'Invoice'))];
          })));
      });
    },
    invoices: function () {
      var filter = el('select', { 'aria-label': 'Filter invoices', onchange: function () { state.invoiceFilter = this.value; load(); } },
        [['', 'All'], ['open', 'Unpaid'], ['paid', 'Paid'], ['void', 'Void']].map(function (o) { var op = el('option', { value: o[0] }, o[1]); if (o[0] === state.invoiceFilter) op.selected = true; return op; }));
      return api('/invoices' + (state.invoiceFilter ? '?status=' + state.invoiceFilter : '')).then(function (d) {
        var wrap = el('div', {}, [el('div', { style: 'max-width:180px;margin-bottom:10px' }, filter), table(
          [{ t: 'Invoice' }, { t: 'Customer' }, { t: 'Description' }, { t: 'Amount', num: true }, { t: 'Status' }, { t: 'Issued' }, { t: 'Due' }, { t: '' }],
          d.invoices.map(function (i) {
            var acts = el('span', { class: 'actions' });
            if (i.status === 'open') {
              acts.appendChild(el('button', { onclick: function () { openPaymentForm(i); } }, 'Record payment'));
              acts.appendChild(el('button', { class: 'danger', onclick: function () { voidInvoice(i); } }, 'Void'));
            }
            return [i.invoice_number, [i.customer_number, el('br'), i.farm_name], i.description, money(i.amount), chip(i.status), day(i.issued_at), day(i.due_at), acts];
          }))]);
        setView(wrap);
      });
    },
    payments: function () {
      return api('/payments').then(function (d) {
        setView(table([{ t: 'Received' }, { t: 'Invoice' }, { t: 'Customer' }, { t: 'Amount', num: true }, { t: 'Method' }, { t: 'Reference' }],
          d.payments.map(function (p) { return [day(p.received_at), p.invoice_number, [p.customer_number, el('br'), p.farm_name], money(p.amount), p.method.toUpperCase(), p.reference || '']; })));
      });
    },
    emails: function () {
      return api('/email-log').then(function (d) {
        setView(table([{ t: 'Sent' }, { t: 'To' }, { t: 'Subject' }, { t: 'Type' }, { t: 'Status' }, { t: 'Error' }],
          d.emails.map(function (m) { return [day(m.created_at), m.to_email, m.subject, m.template || '', chip(m.status), m.error || '']; })));
      });
    }
  };

  function load() { return loaders[state.tab]().catch(handleErr); }
  function handleErr(err) {
    if (err.status === 401 || err.status === 429) { sessionStorage.removeItem(KEY); showApp(false); $('#login-msg').textContent = err.message; return; }
    say(err.message, true);
  }
  document.querySelectorAll('#tabs [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.tab = b.getAttribute('data-tab'); say('');
      document.querySelectorAll('#tabs [data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      load();
    });
  });

  /* ---------- actions ---------- */
  function closePanels() { $('#invoice-form').hidden = true; $('#payment-form').hidden = true; }
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closePanels); });

  function openPaymentForm(inv) {
    closePanels();
    $('#pay-title').textContent = 'Record payment for ' + inv.invoice_number + ' (' + inv.customer_number + ')';
    $('#pay-id').value = inv.id; $('#pay-amount').value = Number(inv.amount).toFixed(2);
    $('#pay-ref').value = ''; $('#pay-method').value = 'eft'; $('#pay-date').value = new Date().toISOString().slice(0, 10);
    $('#payment-form').hidden = false; $('#pay-ref').focus();
  }
  $('#payment-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = $('#pay-id').value;
    api('/invoices/' + encodeURIComponent(id) + '/payments', { method: 'POST', body: {
      amount: Number($('#pay-amount').value), method: $('#pay-method').value, reference: $('#pay-ref').value.trim() || undefined,
      receivedAt: $('#pay-date').value + 'T12:00:00+02:00'
    } }).then(function (r) {
      closePanels(); say('Payment recorded. ' + r.invoice.invoice_number + ' is paid' + (r.subscription ? ' and the plan is active until ' + day(r.subscription.current_period_end) : '') + '. A receipt was emailed.');
      return Promise.all([load(), refreshSummary()]);
    }).catch(handleErrKeepOpen);
  });
  function handleErrKeepOpen(err) { if (err.status === 401 || err.status === 429) return handleErr(err); say(err.message, true); }

  function voidInvoice(inv) {
    if (!window.confirm('Void ' + inv.invoice_number + ' for ' + inv.farm_name + '? This cannot be undone.')) return;
    var reason = window.prompt('Reason (optional)') || undefined;
    api('/invoices/' + encodeURIComponent(inv.id) + '/void', { method: 'POST', body: { reason: reason } })
      .then(function () { say(inv.invoice_number + ' voided.'); return Promise.all([load(), refreshSummary()]); }).catch(handleErrKeepOpen);
  }

  function openInvoiceForm(customerNumber) {
    closePanels(); $('#inv-customer').value = customerNumber || ''; $('#invoice-form').hidden = false; $('#inv-customer').focus();
  }
  $('#new-invoice-btn').addEventListener('click', function () { openInvoiceForm(''); });
  $('#invoice-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = { customerNumber: $('#inv-customer').value.trim(), planSlug: $('#inv-plan').value || undefined, billingCycle: $('#inv-cycle').value,
      description: $('#inv-desc').value.trim() || undefined, dueDays: Number($('#inv-due').value) };
    if ($('#inv-amount').value !== '') body.amount = Number($('#inv-amount').value);
    api('/invoices', { method: 'POST', body: body }).then(function (r) {
      closePanels(); $('#inv-amount').value = ''; $('#inv-desc').value = '';
      say('Invoice ' + r.invoice.invoice_number + ' created for ' + r.invoice.customer_number + ' and emailed.');
      state.tab = 'invoices'; state.invoiceFilter = '';
      document.querySelectorAll('#tabs [data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-tab') === 'invoices')); });
      return Promise.all([load(), refreshSummary()]);
    }).catch(handleErrKeepOpen);
  });

  /* ---------- start ---------- */
  function start(summary) {
    renderTiles(summary);
    fetch(cfg.API_URL + '/api/billing/plans').then(function (r) { return r.json(); }).then(function (d) {
      var sel = $('#inv-plan');
      (d.plans || []).filter(function (p) { return !p.contact_sales || p.slug === 'enterprise'; }).forEach(function (p) { sel.appendChild(el('option', { value: p.slug }, p.name)); });
    }).catch(function () { /* custom invoices still work without the list */ });
    load();
  }

  if (sessionStorage.getItem(KEY)) {
    api('/summary').then(function (s) { showApp(true); start(s); }).catch(function () { sessionStorage.removeItem(KEY); });
  }
})();
