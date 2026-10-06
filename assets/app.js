(function () {
  'use strict';

  var input = document.getElementById('input');
  var output = document.getElementById('output');
  var count = document.getElementById('count');
  var warnings = document.getElementById('warnings');
  var copyBtn = document.getElementById('copy');

  function render() {
    var result = VfnFormatter.convert(input.value);
    output.value = result.text;
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

  document.getElementById('clear').addEventListener('click', function () {
    input.value = '';
    render();
    input.focus();
  });

  document.getElementById('sample').addEventListener('click', function () {
    fetch('samples/priklad.txt')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) { input.value = text; render(); })
      .catch(function () { count.textContent = '(ukázku se nepodařilo načíst)'; });
  });

  copyBtn.addEventListener('click', function () {
    var done = function () {
      copyBtn.textContent = 'Zkopírováno';
      setTimeout(function () { copyBtn.textContent = 'Kopírovat'; }, 1500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(output.value).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      output.select();
      document.execCommand('copy');
      done();
    }
  });

  render();
})();
