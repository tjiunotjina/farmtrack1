(function () {
  'use strict';

  var cfg = Object.assign({ API_URL: '', APP_URL: '#', CONTACT_EMAIL: '' }, window.ORUTUMBO_CONFIG || {});
  var $ = function (sel) { return document.querySelector(sel); };

  /* ---------- footer ---------- */
  $('#year').textContent = new Date().getFullYear();
  if (cfg.CONTACT_EMAIL) {
    var c = $('#contact');
    c.appendChild(document.createTextNode('Contact: '));
    var a = document.createElement('a');
    a.href = 'mailto:' + cfg.CONTACT_EMAIL;
    a.textContent = cfg.CONTACT_EMAIL;
    c.appendChild(a);
  }

  /* ---------- offline demo pill ---------- */
  var pill = $('#pill');
  var syncing = false;
  pill.addEventListener('click', function () {
    if (syncing) return;
    if (!pill.classList.contains('off')) {
      pill.classList.add('off');
      pill.textContent = 'Offline · 3 queued';
    } else {
      syncing = true;
      pill.textContent = 'Syncing…';
      setTimeout(function () {
        pill.classList.remove('off');
        pill.textContent = 'Online · Synced';
        syncing = false;
      }, 1200);
    }
  });

  /* ---------- pricing ---------- */
  // Shown immediately. If the API answers, prices and animal limits are
  // replaced with the live values, so the site can't drift from the app.
  var PLANS = [
    { slug: 'free', name: 'Free', monthly: 0, annual: 0, animals: 'Up to 15 animals' },
    { slug: 'basic', name: 'Basic', monthly: 99, annual: 990, animals: 'Up to 100 animals' },
    { slug: 'standard', name: 'Standard', monthly: 199, annual: 1990, animals: 'Up to 500 animals', popular: true },
    { slug: 'professional', name: 'Professional', monthly: 399, annual: 3990, animals: 'Unlimited animals', extra: ['Priority support'] },
    { slug: 'enterprise', name: 'Enterprise', custom: true, animals: 'Unlimited animals', extra: ['Priority support', 'Terms that fit your operation'] }
  ];
  var cycle = 'monthly';
  var plansEl = $('#plans');

  function money(n) { return 'N$' + Number(n).toLocaleString('en-US'); }

  function renderPlans() {
    var yearly = cycle === 'annual';
    plansEl.innerHTML = PLANS.map(function (p) {
      var free = !p.custom && p.monthly === 0;
      var price = p.custom ? 'Custom' : free ? 'N$0' : money(yearly ? p.annual : p.monthly);
      var unit = p.custom ? 'for larger operations' : free ? 'free for as long as you like' : yearly ? 'per year, 2 months free' : 'per month';
      var bullets = [p.animals].concat(p.extra || []).map(function (b) { return '<li>' + b + '</li>'; }).join('');
      var cta = '';
      if (p.custom) {
        if (cfg.CONTACT_EMAIL) cta = '<a class="btn btn-line" href="mailto:' + cfg.CONTACT_EMAIL + '">Contact us</a>';
      } else {
        cta = '<a class="btn ' + (p.popular ? 'btn-light' : 'btn-line') + '" href="#signup">' + (free ? 'Start free' : 'Start free trial') + '</a>';
      }
      return '<article class="plan' + (p.popular ? ' plan-pop' : '') + '">' +
        '<h3>' + p.name + '</h3>' + (p.popular ? '<span class="badge">Most popular</span>' : '') +
        '<p class="price">' + price + '</p><p class="unit">' + unit + '</p>' +
        '<ul>' + bullets + '</ul>' + cta + '</article>';
    }).join('');
  }

  document.querySelectorAll('.toggle button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      cycle = btn.getAttribute('data-cycle');
      document.querySelectorAll('.toggle button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      renderPlans();
    });
  });
  renderPlans();

  if (cfg.API_URL) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 8000);
    fetch(cfg.API_URL + '/api/billing/plans', { signal: ctrl.signal })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        (d.plans || []).forEach(function (live) {
          var p = PLANS.filter(function (x) { return x.slug === live.slug; })[0];
          if (!p || p.custom) return;
          if (isFinite(Number(live.monthly_price))) p.monthly = Number(live.monthly_price);
          if (isFinite(Number(live.annual_price))) p.annual = Number(live.annual_price);
          var lim = live.features && live.features.max_livestock;
          if (lim !== undefined && isFinite(Number(lim))) {
            p.animals = Number(lim) < 0 ? 'Unlimited animals' : 'Up to ' + Number(lim) + ' animals';
          }
        });
        renderPlans();
      })
      .catch(function () { /* keep the built-in prices */ })
      .then(function () { clearTimeout(t); });
  }

  /* ---------- signup ---------- */
  var form = $('#signup-form');
  var btn = $('#signup-btn');
  var statusEl = $('#signup-status');

  function setStatus(msg, isErr) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('err', !!isErr);
  }

  function validate(d) {
    if (!d.farmName.trim()) return { field: 'farmName', msg: 'Enter your farm name.' };
    if (!d.ownerName.trim()) return { field: 'ownerName', msg: 'Enter your name.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return { field: 'email', msg: 'Enter a valid email address.' };
    if (d.password.length < 8) return { field: 'password', msg: 'Your password needs at least 8 characters.' };
    return null;
  }

  function showDone(d) {
    var panel = $('#signup-panel');
    panel.textContent = '';
    var box = document.createElement('div');
    box.className = 'done';
    var h = document.createElement('h3');
    h.textContent = 'Your farm account is ready';
    var p1 = document.createElement('p');
    p1.textContent = 'Welcome, ' + d.ownerName.trim() + '. Your 30-day Standard trial has started.';
    var p2 = document.createElement('p');
    p2.textContent = 'Open Orutumbo and log in with ' + d.email.trim() + ' and the password you just chose.';
    var link = document.createElement('a');
    link.className = 'btn btn-block';
    link.href = cfg.APP_URL;
    link.textContent = 'Open Orutumbo';
    box.appendChild(h); box.appendChild(p1); box.appendChild(p2); box.appendChild(link);
    panel.appendChild(box);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = String(v); });

    if (data.company) { showDone(data); return; } // honeypot filled: a bot, pretend success

    var problem = validate(data);
    if (problem) { setStatus(problem.msg, true); form.elements[problem.field].focus(); return; }
    if (!cfg.API_URL) { setStatus('Sign-up is not set up on this site yet.', true); return; }

    btn.disabled = true;
    setStatus('Creating your account…');
    // The free-tier server sleeps when idle, so the first request can be slow.
    var slow = setTimeout(function () {
      setStatus('Waking up the server. The first request can take up to a minute.');
    }, 4000);
    var ctrl = new AbortController();
    var kill = setTimeout(function () { ctrl.abort(); }, 90000);

    fetch(cfg.API_URL + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        farmName: data.farmName.trim(),
        village: data.village.trim(),
        ownerName: data.ownerName.trim(),
        email: data.email.trim(),
        password: data.password
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (res.ok) { showDone(data); return; }
          if (res.status === 409) setStatus('An account with that email already exists. Open the app and log in instead.', true);
          else setStatus(body.error || 'Something went wrong. Please try again.', true);
        });
      })
      .catch(function (err) {
        setStatus(err && err.name === 'AbortError'
          ? 'The server took too long to answer. Please try again in a minute.'
          : "Couldn't reach the server. Check your connection and try again.", true);
      })
      .then(function () {
        clearTimeout(slow); clearTimeout(kill); btn.disabled = false;
      });
  });
})();
