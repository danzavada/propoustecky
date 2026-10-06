(function () {
  'use strict';

  var input = document.getElementById('input');
  var output = document.getElementById('output');
  var count = document.getElementById('count');
  var warnings = document.getElementById('warnings');
  var copyBtn = document.getElementById('copy');
  var current = null;

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Stejné HTML se zobrazí na stránce i vloží do schránky.
  function toHtml(result) {
    var parts = result.blocks.map(function (b) {
      return '<p><b>' + escapeHtml(b.title) + '</b><br>' +
        b.lines.map(escapeHtml).join('<br>') + '</p>';
    });
    if (result.legend) parts.push('<p>' + escapeHtml(result.legend) + '</p>');
    return parts.join('');
  }

  function render() {
    current = VfnFormatter.convert(input.value);
    output.innerHTML = toHtml(current);
    copyBtn.disabled = !current.text;

    if (!input.value.trim()) count.textContent = '';
    else if (!current.count) count.textContent = '(žádný nález nerozpoznán)';
    else count.textContent = '(' + current.count + ' ' + plural(current.count) + ')';

    warnings.hidden = !current.warnings.length;
    warnings.textContent = '';
    current.warnings.forEach(function (w) {
      var p = document.createElement('p');
      p.textContent = w;
      warnings.appendChild(p);
    });
  }

  function plural(n) {
    if (n === 1) return 'nález';
    if (n >= 2 && n <= 4) return 'nálezy';
    return 'nálezů';
  }

  input.addEventListener('input', render);

  document.getElementById('clear').addEventListener('click', function () {
    input.value = '';
    render();
    input.focus();
  });

  // Do schránky jde HTML (tučné nadpisy) i čistý text pro programy bez formátování.
  copyBtn.addEventListener('click', function () {
    var done = function () {
      copyBtn.textContent = 'Zkopírováno';
      setTimeout(function () { copyBtn.textContent = 'Kopírovat'; }, 1500);
    };
    var html = '<div>' + toHtml(current) + '</div>';
    if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([current.text], { type: 'text/plain' })
      })]).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      var onCopy = function (e) {
        e.clipboardData.setData('text/html', html);
        e.clipboardData.setData('text/plain', current.text);
        e.preventDefault();
      };
      document.addEventListener('copy', onCopy);
      document.execCommand('copy');
      document.removeEventListener('copy', onCopy);
      done();
    }
  });

  render();
})();
