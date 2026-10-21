/*
 * Převod dávkování léků mezi zápisem ráno-poledne-večer („1-0-0“)
 * a zápisem oddělení, kde den začíná v poledne („0-0-;1-“ = poledne-večer; ráno).
 * Vše běží lokálně v prohlížeči, text se nikam neodesílá.
 */
(function (root) {
  'use strict';

  // Jedna dávka: 1, 0, 1/2, 1,5, 1/3, ½, 1½ …
  var DOSE = '\\d+(?:,\\d+)?(?:\\/\\d+)?|\\d*[½¼¾⅓]';
  // Pomlčka mezi dávkami, i s mezerami („1 - 0 - 1“).
  var DASH = '\\s*-\\s*';
  // Dávka nesmí navazovat na slovo, číslo, zlomek ani desetinnou čárku („7,5mg“, „24/26“).
  var BEFORE = '(?<![\\p{L}\\d/\\-½¼¾⅓])(?<!\\d,)';
  var AFTER = '(?![\\p{L}\\d/\\-½¼¾⅓])';

  function dose() { return '(' + DOSE + ')'; }

  // Poledne-večer(-noc); ráno: „0-0; 1-“, „0-0-;1-“, „0-0-1/3; 0-“, „0-0, 1-“.
  // Varianta s čárkou musí končit pomlčkou, jinak by šla splést s výčtem léků.
  var WARD = new RegExp(BEFORE + dose() + DASH + dose() + '(?:' + DASH + dose() + ')?(?:\\s*-)?\\s*' +
    '(?:;\\s*' + dose() + '(?:\\s*-)?|,\\s*' + dose() + '\\s*-)' + AFTER, 'gu');
  // Ráno-poledne-večer(-noc): „1-0-0“, „1/2-0-0“, „0-0-0-1/2“.
  var CLASSIC = new RegExp(BEFORE + dose() + DASH + dose() + DASH + dose() + '(?:' + DASH + dose() + ')?' +
    AFTER + '(?!\\s*-\\s*(?:' + DOSE + '))(?!,\\d)', 'gu');
  // Co po odečtení rozpoznaných dávek pořád vypadá jako dávkování („1 tbl-0-0“, „0-0“).
  var SUSPECT = new RegExp('(?:' + DOSE + ')\\s*-\\s*(?:' + DOSE + ')', 'u');

  var FA = /^\s*FA:\s*/;
  var HEADER_LINE = /^\s*p\.o\.:\s*\(\s*poledne-večer,\s*ráno-?\s*\)\s*$/iu;
  var HEADER_NOTE = /\s*\(\s*poledne-večer,\s*ráno-?\s*\)/iu;

  function findAll(re, line) {
    var found = [];
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(line))) found.push({ start: m.index, end: m.index + m[0].length, m: m });
    return found;
  }

  function overlaps(a, list) {
    return list.some(function (b) { return a.start < b.end && b.start < a.end; });
  }

  // Dávkování na řádku. CLASSIC by jinak našel „0-0-1“ i uvnitř „0-0-1, 0-“.
  function findDoses(line) {
    var ward = findAll(WARD, line).map(function (d) {
      var m = d.m;
      d.format = 'ward';
      d.doses = { morning: m[4] || m[5], noon: m[1], evening: m[2], night: m[3] };
      return d;
    });
    var classic = findAll(CLASSIC, line).filter(function (d) {
      return !overlaps(d, ward);
    }).map(function (d) {
      var m = d.m;
      d.format = 'classic';
      d.doses = { morning: m[1], noon: m[2], evening: m[3], night: m[4] };
      return d;
    });
    return ward.concat(classic);
  }

  function formatDoses(d, format) {
    var night = d.night ? '-' + d.night : '';
    if (format === 'ward') return d.noon + '-' + d.evening + night + '-;' + d.morning + '-';
    return d.morning + '-' + d.noon + '-' + d.evening + night;
  }

  // Čárky mezi léky na řádku FA – ne uvnitř závorek, desetinných čísel ani dávkování.
  function listSeparators(line, from, doses) {
    var seps = [];
    var depth = 0;
    for (var i = from; i < line.length; i++) {
      var c = line[i];
      if (c === '(') depth++;
      else if (c === ')') depth = Math.max(0, depth - 1);
      else if (c === ',' && !depth && !/\d/.test(line[i + 1] || '')) {
        var begin = i;
        while (begin > from && /\s/.test(line[begin - 1])) begin--;
        var end = i + 1;
        while (end < line.length && /\s/.test(line[end])) end++;
        var sep = { start: begin, end: end };
        if (!overlaps(sep, doses)) seps.push(sep);
      }
    }
    return seps;
  }

  function detect(text) {
    var ward = 0;
    var classic = 0;
    (text || '').split('\n').forEach(function (line) {
      findDoses(line).forEach(function (d) {
        if (d.format === 'ward') ward++; else classic++;
      });
    });
    return ward > classic ? 'classic' : 'ward';
  }

  // Vícenásobné mezery a tabulátory → jedna mezera, okraje řádku bez mezer.
  // Úseky, které už mění jiná úprava, se přeskočí.
  function spaceEdits(line, edits) {
    var found = [];
    var re = /[ \t]+/g;
    var m;
    while ((m = re.exec(line))) {
      var e = { start: m.index, end: m.index + m[0].length };
      var edge = !e.start || e.end === line.length;
      if (edge) e.text = '';
      else if (m[0] !== ' ') e.text = ' ';
      else continue;
      if (!overlaps(e, edits)) found.push(e);
    }
    return found;
  }

  // format je cílový zápis: 'ward' (0-0-;1-) nebo 'classic' (1-0-0).
  // Všechna rozpoznaná dávkování se přepíšou do jednoho zápisu („0-0; 1-“ → „0-0-;1-“).
  // Vrací i marks (rozpoznané úseky vstupu), outMarks (tytéž úseky ve výstupu)
  // a warnings (řádky, kde něco vypadá jako dávkování, ale převést nešlo).
  function convert(text, format) {
    text = text || '';
    var out = '';
    var marks = [];
    var outMarks = [];
    var warnings = [];
    var count = 0;
    var offset = 0;
    var emitted = false;

    text.split('\n').forEach(function (line) {
      var start = offset;
      offset += line.length + 1;
      if (format === 'classic' && HEADER_LINE.test(line)) return;

      var found = findDoses(line);
      var edits = found.map(function (d) {
        var to = formatDoses(d.doses, format);
        return { start: d.start, end: d.end, text: to, dose: true, changed: to !== line.slice(d.start, d.end) };
      });

      var rest = found.reduce(function (acc, d) {
        return acc.slice(0, d.start) + ' '.repeat(d.end - d.start) + acc.slice(d.end);
      }, line);
      if (SUSPECT.test(rest)) {
        warnings.push('Zkontroluj dávkování, nešlo převést: ' + line.replace(/\s+/g, ' ').trim());
      }

      if (format === 'ward') {
        // Řádek FA i jiný výčet léků za sebou se rozdělí na léky pod sebou.
        var fa = FA.exec(line);
        if (fa) edits.push({ start: 0, end: fa[0].length, text: '' });
        if (fa || found.length > 1) {
          listSeparators(line, fa ? fa[0].length : 0, found).forEach(function (s) {
            edits.push({ start: s.start, end: s.end, text: '\n' });
          });
        }
      } else {
        var note = HEADER_NOTE.exec(line);
        if (note) edits.push({ start: note.index, end: note.index + note[0].length, text: '' });
      }

      edits = edits.concat(spaceEdits(line, edits));
      edits.sort(function (a, b) { return a.start - b.start; });
      if (emitted) out += '\n';
      emitted = true;
      var pos = 0;
      edits.forEach(function (e) {
        out += line.slice(pos, e.start);
        if (e.dose) {
          marks.push([start + e.start, start + e.end]);
          outMarks.push([out.length, out.length + e.text.length]);
          if (e.changed) count++;
        }
        out += e.text;
        pos = e.end;
      });
      out += line.slice(pos);
    });

    return { text: out, count: count, marks: marks, outMarks: outMarks, warnings: warnings };
  }

  var api = { convert: convert, detect: detect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PropousteckyMeds = api;
})(this);
