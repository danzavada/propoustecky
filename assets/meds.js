/*
 * Převod dávkování léků mezi zápisem ráno-poledne-večer („1-0-0“)
 * a zápisem oddělení, kde den začíná v poledne („0-0-;1-“ = poledne-večer; ráno).
 * Vše běží lokálně v prohlížeči, text se nikam neodesílá.
 */
(function (root) {
  'use strict';

  var HEADER = 'p.o.: (Poledne-Večer, Ráno-)';

  // Jedna dávka: 1, 0, 1/2, 1,5, 1/3 …
  var DOSE = '\\d+(?:,\\d+)?(?:\\/\\d+)?';
  // Dávka nesmí navazovat na slovo, číslo, zlomek ani desetinnou čárku („7,5mg“, „24/26“).
  var BEFORE = '(?<![\\p{L}\\d/\\-])(?<!\\d,)';
  var AFTER = '(?![\\p{L}\\d/\\-])';

  // Poledne-večer(-noc); ráno: „0-0; 1-“, „0-0-;1-“, „0-0-1/3; 0-“, „0-0, 1-“.
  // Varianta s čárkou musí končit pomlčkou, jinak by šla splést s výčtem léků.
  var WARD = new RegExp(BEFORE + '(' + DOSE + ')-(' + DOSE + ')(?:-(' + DOSE + '))?-?\\s*' +
    '(?:;\\s*(' + DOSE + ')-?|,\\s*(' + DOSE + ')-)' + AFTER, 'gu');
  // Ráno-poledne-večer(-noc): „1-0-0“, „1/2-0-0“, „0-0-0-1/2“.
  var CLASSIC = new RegExp(BEFORE + '(' + DOSE + ')-(' + DOSE + ')-(' + DOSE + ')(?:-(' + DOSE + '))?' +
    AFTER + '(?!,\\d)', 'gu');

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
        var end = i + 1;
        while (end < line.length && /\s/.test(line[end])) end++;
        var sep = { start: i, end: end };
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

  // format je cílový zápis: 'ward' (0-0-;1-) nebo 'classic' (1-0-0).
  // Vrací i marks (převedené úseky vstupu) a outMarks (tytéž úseky ve výstupu).
  function convert(text, format) {
    text = text || '';
    var out = '';
    var marks = [];
    var outMarks = [];
    var count = 0;
    var offset = 0;
    var emitted = false;

    text.split('\n').forEach(function (line) {
      var start = offset;
      offset += line.length + 1;
      if (format === 'classic' && HEADER_LINE.test(line)) return;

      var doses = findDoses(line).filter(function (d) { return d.format !== format; });
      var edits = doses.map(function (d) {
        return { start: d.start, end: d.end, text: formatDoses(d.doses, format), dose: true };
      });

      if (format === 'ward') {
        // Řádek FA se rozdělí na jednotlivé léky pod sebou.
        var fa = FA.exec(line);
        if (fa) {
          edits.push({ start: 0, end: fa[0].length, text: '' });
          listSeparators(line, fa[0].length, doses).forEach(function (s) {
            edits.push({ start: s.start, end: s.end, text: '\n' });
          });
        }
      } else {
        var note = HEADER_NOTE.exec(line);
        if (note) edits.push({ start: note.index, end: note.index + note[0].length, text: '' });
      }

      edits.sort(function (a, b) { return a.start - b.start; });
      if (emitted) out += '\n';
      emitted = true;
      var pos = 0;
      edits.forEach(function (e) {
        out += line.slice(pos, e.start);
        if (e.dose) {
          marks.push([start + e.start, start + e.end]);
          outMarks.push([out.length, out.length + e.text.length]);
          count++;
        }
        out += e.text;
        pos = e.end;
      });
      out += line.slice(pos);
    });

    if (format === 'ward' && count && !/poledne-večer/iu.test(text)) {
      out = HEADER + '\n' + out;
      outMarks = outMarks.map(function (r) { return [r[0] + HEADER.length + 1, r[1] + HEADER.length + 1]; });
    }

    return { text: out, count: count, marks: marks, outMarks: outMarks };
  }

  var api = { convert: convert, detect: detect, HEADER: HEADER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PropousteckyMeds = api;
})(this);
