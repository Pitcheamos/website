// pitcheamos.com/diagnostico: sends the B2C diagnostic form to the worker (Contact + Deal, segment b2c),
// then to the HubSpot form (notification + Comments). Based on b2b.js.
// Sends the site's contact forms to HubSpot (Forms API, no cookies) and then
// goes to the thank-you page set in the form's action.
(function () {
  var PORTAL = '52333636';
  var FORM = '714b9459-f62c-4390-b27a-7ced277ab845';
  var URL = 'https://api.hsforms.com/submissions/v3/integration/submit/' + PORTAL + '/' + FORM;
  var SKIP = { 'form-name': 1, 'subject': 1, 'bot-field': 1, 'nombre': 1, 'email': 1, 'telefono': 1, 'cvfile': 1 };
  var MAX_CV = 5 * 1024 * 1024;
  var en = document.documentElement.lang === 'en';
  // Cloudflare Worker that creates Company + Contact + Deal in HubSpot (set after deploying it).
  var WORKER = 'https://pitcheamos-b2b.hola-fb1.workers.dev';

  document.querySelectorAll('form[data-hs]').forEach(function (form) {
    // "Otro" in the difficulties: show a required free-text field.
    var otro = form.querySelector('#difOtro'), otroBox = form.querySelector('#difOtroBox');
    var otroInput = otroBox && otroBox.querySelector('input');
    if (otro && otroBox) otro.addEventListener('change', function () {
      otroBox.hidden = !otro.checked; otroInput.required = otro.checked;
      if (otro.checked) otroInput.focus();
    });
    var checks = form.querySelectorAll('input[name=dificultad]');
    checks.forEach(function (c) { c.addEventListener('change', function () { checks[0].setCustomValidity(''); }); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (checks.length && !form.querySelector('input[name=dificultad]:checked')) {
        checks[0].setCustomValidity('Elegí al menos una opción.');
        checks[0].reportValidity();
        return;
      }
      var data = new FormData(form);
      var thanks = form.getAttribute('action') || '/';
      if (data.get('bot-field')) { location.href = thanks; return; }
      var cv = data.get('cvfile');
      var cvInput = form.querySelector('input[name=cvfile]');
      if (cv && cv.size > MAX_CV) {
        cvInput.setCustomValidity('El archivo pesa más de 5 MB. Probá exportarlo de nuevo en PDF.');
        cvInput.reportValidity();
        cvInput.addEventListener('change', function () { cvInput.setCustomValidity(''); }, { once: true });
        return;
      }

      // Everything that isn't name, email or phone goes into the Message field.
      var lines = ['Form: ' + (data.get('form-name') || form.getAttribute('name')), 'Page: ' + location.pathname];
      data.forEach(function (v, k) { if (!SKIP[k] && String(v).trim()) lines.push(k + ': ' + v); });
      if (cv && cv.name) lines.push('cv: ' + cv.name + ' (attached to the deal)');

      var fields = [
        { name: 'firstname', value: data.get('nombre') || '' },
        { name: 'email', value: data.get('email') || '' },
        { name: 'message', value: lines.join('\n') },
        { name: 'comments', value: lines.join('\n') }
      ];
      if (data.get('telefono')) {
        fields.push({ name: 'phone', value: data.get('telefono') });
        fields.push({ name: 'mobilephone', value: data.get('telefono') });
      }

      // Amplitude: tie this visitor (and their replays) to the lead.
      if (window.amplitude) {
        try {
          window.amplitude.setUserId(String(data.get('email') || '').trim().toLowerCase() || undefined);
          window.amplitude.track('Lead Submitted', {
            form: data.get('form-name') || form.getAttribute('name'),
            page: location.pathname,
            has_phone: !!data.get('telefono'),
            moment: data.get('momento') || undefined
          });
        } catch (err) {}
      }

      var btn = form.querySelector('button[type=submit]');
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = en ? 'Sending…' : 'Enviando…'; }

      var payload = {};
      data.forEach(function (v, k) { if (k !== 'cvfile') payload[k] = payload[k] ? payload[k] + ', ' + v : v; });
      try { sessionStorage.setItem('pitch_lead', JSON.stringify({ name: payload.nombre || '', email: payload.email || '' })); } catch (err) {}
      var readCv = (cv && cv.size) ? new Promise(function (res) {
        var fr = new FileReader();
        fr.onload = function () { res({ name: cv.name, type: cv.type || 'application/octet-stream', data: String(fr.result).split(',')[1] }); };
        fr.onerror = function () { res(null); };
        fr.readAsDataURL(cv);
      }) : Promise.resolve(null);
      var toWorker = WORKER
        ? readCv.then(function (file) {
            if (file) payload.cv_file = file;
            return fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          }).catch(function () {})
        : Promise.resolve();

      toWorker.then(function () { return fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fields, context: { pageUri: location.href, pageName: document.title } })
      }); }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        location.href = thanks;
      }).catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
        var msg = form.querySelector('.hs-error') || document.createElement('p');
        msg.className = 'small hs-error';
        msg.style.color = '#C0392B';
        msg.textContent = en
          ? 'Something went wrong. Please try again or email hola@pitcheamos.com.'
          : 'Algo falló. Probá de nuevo o escribime a hola@pitcheamos.com.';
        form.appendChild(msg);
      });
    });
  });
})();
