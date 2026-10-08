(function () {
  'use strict';

  var input = document.getElementById('input');
  var highlights = document.getElementById('highlights');
  var output = document.getElementById('output');
  var count = document.getElementById('count');
  var warnings = document.getElementById('warnings');
  var copyBtn = document.getElementById('copy');
  var fontSelect = document.getElementById('font');
  var sizeSelect = document.getElementById('size');
  var current = null;

  var FONTS = {
    arial: '"Arial CE", Arial, Helvetica, sans-serif',
    calibri: 'Calibri, Carlito, "Segoe UI", sans-serif',
    times: '"Times New Roman", Times, serif'
  };
  var DEFAULT_FONT = 'arial';
  var DEFAULT_SIZE = '10';

  // Volba písma se pamatuje jen v tomto prohlížeči; bez úložiště platí výchozí.
  function load(key, fallback, allowed) {
    try {
      var v = localStorage.getItem(key);
      return allowed(v) ? v : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* bez úložiště */ }
  }

  function docStyle() {
    return 'font-family:' + FONTS[fontSelect.value] + ';font-size:' + sizeSelect.value + 'pt';
  }

  function applyFont() {
    var rootStyle = document.documentElement.style;
    rootStyle.setProperty('--doc-font', FONTS[fontSelect.value]);
    rootStyle.setProperty('--doc-size', sizeSelect.value + 'pt');
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Stejné HTML se zobrazí na stránce i vloží do schránky. Pro schránku
  // dostane každý odstavec i písmo, aby ho Word a spol. převzaly.
  function toHtml(result, style) {
    var open = style ? '<p style="' + escapeHtml(style) + '">' : '<p>';
    var parts = result.blocks.map(function (b) {
      return open + '<b>' + escapeHtml(b.title) + '</b><br>' +
        b.lines.map(escapeHtml).join('<br>') + '</p>';
    });
    if (result.legend) parts.push(open + escapeHtml(result.legend) + '</p>');
    return parts.join('');
  }

  // Pod průhledným polem leží kopie vstupu, ve které jsou zeleně
  // podbarvené úseky převzaté do výsledku (datum, materiál, kmeny, …).
  function renderHighlights(text, marks) {
    var html = '';
    var pos = 0;
    marks.forEach(function (m) {
      html += escapeHtml(text.slice(pos, m[0])) + '<mark>' + escapeHtml(text.slice(m[0], m[1])) + '</mark>';
      pos = m[1];
    });
    highlights.innerHTML = html + escapeHtml(text.slice(pos));
    syncScroll();
  }

  function syncScroll() {
    highlights.style.transform = 'translate(' + -input.scrollLeft + 'px, ' + -input.scrollTop + 'px)';
  }

  function render() {
    current = PropousteckyFormatter.convert(input.value);
    renderHighlights(input.value, current.marks);
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
  input.addEventListener('scroll', syncScroll);

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
    var style = docStyle();
    var html = '<div style="' + escapeHtml(style) + '">' + toHtml(current, style) + '</div>';
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

  fontSelect.value = load('propoustecky.font', DEFAULT_FONT, function (v) { return FONTS.hasOwnProperty(v); });
  sizeSelect.value = load('propoustecky.size', DEFAULT_SIZE, function (v) {
    return Array.prototype.some.call(sizeSelect.options, function (o) { return o.value === v; });
  });
  fontSelect.addEventListener('change', function () { save('propoustecky.font', fontSelect.value); applyFont(); });
  sizeSelect.addEventListener('change', function () { save('propoustecky.size', sizeSelect.value); applyFont(); });
  applyFont();

  render();
})();
