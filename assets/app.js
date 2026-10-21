(function () {
  'use strict';

  var input = document.getElementById('input');
  var highlights = document.getElementById('highlights');
  var output = document.getElementById('output');
  var count = document.getElementById('count');
  var warnings = document.getElementById('warnings');
  var copyBtn = document.getElementById('copy');
  var sizeSelect = document.getElementById('size');
  var modeSelect = document.getElementById('mode');
  var directionBtn = document.getElementById('direction');
  var inputLabel = document.getElementById('input-label');
  var outputTitle = document.getElementById('output-title');
  var current = null;

  // Každý nástroj má vlastní vložený text; při přepnutí se vymění.
  var MODES = {
    micro: {
      input: 'Nálezy z NIS',
      output: 'Přeformátováno',
      placeholder: 'Sem vlož text nálezů zkopírovaný ze systému…'
    },
    meds: {
      input: 'Léky',
      output: 'Převedeno',
      placeholder: 'Sem vlož seznam léků s dávkováním (1-0-0 nebo 0-0-;1-)…'
    }
  };
  var DIRECTIONS = { ward: '1-0-0 → 0-0-;1-', classic: '0-0-;1- → 1-0-0' };
  var mode = 'micro';
  var texts = { micro: '', meds: '' };
  // Směr převodu léků; null = odhadnout podle vloženého textu.
  var direction = null;

  var FONT = 'Calibri, Carlito, "Segoe UI", sans-serif';
  var DEFAULT_SIZE = '10';

  // Velikost písma se pamatuje jen v tomto prohlížeči; bez úložiště platí výchozí.
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
    return 'font-family:' + FONT + ';font-size:' + sizeSelect.value + 'pt';
  }

  function applySize() {
    var rootStyle = document.documentElement.style;
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
    if (!result.blocks.length) return '';
    var lines = result.blocks.map(function (b) {
      return ['<b>' + escapeHtml(b.title) + '</b>'].concat(b.lines.map(escapeHtml)).join('<br>');
    });
    return open + lines.join('<br>') + '</p>';
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

  // Text léků řádek po řádku; na stránce jsou převedené dávky podbarvené.
  function medsHtml(result, style, marks) {
    if (!result.text) return '';
    var open = style ? '<p style="' + escapeHtml(style) + '">' : '<p>';
    var text = result.text;
    var html = '';
    var pos = 0;
    (marks || []).forEach(function (m) {
      html += escapeHtml(text.slice(pos, m[0])) + '<mark>' + escapeHtml(text.slice(m[0], m[1])) + '</mark>';
      pos = m[1];
    });
    html += escapeHtml(text.slice(pos));
    return open + html.replace(/\n/g, '<br>') + '</p>';
  }

  function render() {
    if (mode === 'meds') renderMeds();
    else renderMicro();
  }

  function renderMeds() {
    if (!input.value.trim()) direction = null;
    var target = direction || PropousteckyMeds.detect(input.value);
    var result = PropousteckyMeds.convert(input.value, target);
    current = {
      text: result.text,
      html: function (style) { return medsHtml(result, style); }
    };
    renderHighlights(input.value, result.marks);
    output.innerHTML = medsHtml(result, null, result.outMarks);
    copyBtn.disabled = !input.value.trim();
    directionBtn.textContent = DIRECTIONS[target];

    if (!input.value.trim()) count.textContent = '';
    else if (!result.count) count.textContent = '(žádné dávkování nerozpoznáno)';
    else count.textContent = '(převedeno ' + result.count + ')';
    warnings.hidden = true;
  }

  function renderMicro() {
    var result = PropousteckyFormatter.convert(input.value);
    current = {
      text: result.text,
      html: function (style) { return toHtml(result, style); }
    };
    renderHighlights(input.value, result.marks);
    output.innerHTML = toHtml(result);
    copyBtn.disabled = !result.text;

    if (!input.value.trim()) count.textContent = '';
    else if (!result.count) count.textContent = '(žádný nález nerozpoznán)';
    else count.textContent = '(' + result.count + ' ' + plural(result.count) + ')';

    warnings.hidden = !result.warnings.length;
    warnings.textContent = '';
    result.warnings.forEach(function (w) {
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
    var html = '<div style="' + escapeHtml(style) + '">' + current.html(style) + '</div>';
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

  // Podnadpis je výběr nástroje. Šířka se přizpůsobí zvolené položce,
  // aby šipka byla hned za textem.
  function fitModeSelect() {
    var probe = document.createElement('span');
    var cs = getComputedStyle(modeSelect);
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + cs.font;
    probe.textContent = modeSelect.options[modeSelect.selectedIndex].text;
    document.body.appendChild(probe);
    modeSelect.style.width = Math.ceil(probe.getBoundingClientRect().width +
      parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2) + 'px';
    probe.remove();
  }

  function setMode(next) {
    texts[mode] = input.value;
    mode = next;
    modeSelect.value = mode;
    input.value = texts[mode];
    inputLabel.textContent = MODES[mode].input;
    outputTitle.textContent = MODES[mode].output;
    input.placeholder = MODES[mode].placeholder;
    directionBtn.hidden = mode !== 'meds';
    history.replaceState(null, '', mode === 'meds' ? '#leky' : location.pathname + location.search);
    fitModeSelect();
    render();
  }

  modeSelect.addEventListener('change', function () {
    save('propoustecky.mode', modeSelect.value);
    setMode(modeSelect.value);
  });

  directionBtn.addEventListener('click', function () {
    var shown = direction || PropousteckyMeds.detect(input.value);
    direction = shown === 'ward' ? 'classic' : 'ward';
    render();
  });

  sizeSelect.value = load('propoustecky.size', DEFAULT_SIZE, function (v) {
    return Array.prototype.some.call(sizeSelect.options, function (o) { return o.value === v; });
  });
  sizeSelect.addEventListener('change', function () { save('propoustecky.size', sizeSelect.value); applySize(); });
  applySize();

  setMode(location.hash === '#leky' ? 'meds' :
    load('propoustecky.mode', 'micro', function (v) { return v in MODES; }));
})();
