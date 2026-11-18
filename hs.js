// Sends the site's contact forms to HubSpot (Forms API, no cookies) and then
// goes to the thank-you page set in the form's action.
(function () {
  var PORTAL = '52333636';
  var FORM = '714b9459-f62c-4390-b27a-7ced277ab845';
  var URL = 'https://api.hsforms.com/submissions/v3/integration/submit/' + PORTAL + '/' + FORM;
  var SKIP = { 'form-name': 1, 'subject': 1, 'bot-field': 1, 'nombre': 1, 'email': 1, 'telefono': 1 };
  var en = document.documentElement.lang === 'en';

  document.querySelectorAll('form[data-hs]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var thanks = form.getAttribute('action') || '/';
      if (data.get('bot-field')) { location.href = thanks; return; }

      // Everything that isn't name, email or phone goes into the Message field.
      var lines = ['Form: ' + (data.get('form-name') || form.getAttribute('name')), 'Page: ' + location.pathname];
      data.forEach(function (v, k) { if (!SKIP[k] && String(v).trim()) lines.push(k + ': ' + v); });

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

      fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fields, context: { pageUri: location.href, pageName: document.title } })
      }).then(function (r) {
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
