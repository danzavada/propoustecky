/*
 * Převod mikrobiologických nálezů z NIS VFN do stručného textu.
 * Vše běží lokálně v prohlížeči, text se nikam neodesílá.
 */
(function (root) {
  'use strict';

  // Názvy materiálů, které se nedají převést jen změnou velikosti písmen.
  // Klíč je název z NIS velkými písmeny, hodnota je výstupní text.
  var MATERIALS = {
    'KRK-VÝTĚR': 'Výtěr z krku',
    'NOS-VÝTĚR': 'Výtěr z nosu',
    'STOLICE VÝTĚR Z REKTA': 'Výtěr z rekta',
    'STĚR PENIS': 'Stěr z penisu'
  };

  // Hlavičky oddílů v části „KULTIVACE A VYŠETŘENÍ“. Používají se jen tehdy,
  // když se při kopírování ztratí odsazení a oddíly nejdou poznat jinak.
  var KNOWN_SECTIONS = [
    'primokultura', 'pomnožení', 'mikroskopie', 'mikroskopicky', 'kultivace',
    'kvasinky', 'anaerobní kultivace', 'aerobní kultivace', 'mykologie'
  ];

  var QUANTITIES = [
    'velmi hojně', 'ojediněle', 'slabě', 'středně', 'hojně', 'masivně'
  ];

  var SEPARATOR = /^\s*-{5,}\s*$/;
  var SENSITIVITY_CODE = /^[CRIXNQ*]$/;

  function collapse(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  function sentenceCase(s) {
    var lower = s.toLocaleLowerCase('cs');
    return lower.charAt(0).toLocaleUpperCase('cs') + lower.slice(1);
  }

  function formatMaterial(raw) {
    var key = collapse(raw).toLocaleUpperCase('cs');
    if (MATERIALS[key]) return MATERIALS[key];
    // „PERMAN.KATETRU“ → „perman. katetru“
    return sentenceCase(collapse(raw).replace(/\.(?=\S)/g, '. '));
  }

  function formatDate(raw) {
    var m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(raw || '');
    if (!m) return '';
    return parseInt(m[1], 10) + '.' + parseInt(m[2], 10) + '.' + m[3];
  }

  function field(lines, label) {
    var re = new RegExp('^\\s*' + label + '\\s+(.*)$');
    for (var i = 0; i < lines.length; i++) {
      var m = re.exec(lines[i]);
      if (m) return m[1].trim();
    }
    return '';
  }

  // Rozdělí vložený text na jednotlivé nálezy.
  function splitReports(text) {
    var lines = text.replace(/\r\n?/g, '\n').split('\n');
    var starter = /^\s*Laboratoř\b/;
    if (!lines.some(function (l) { return starter.test(l); })) starter = /^\s*Pacient\b/;

    var reports = [];
    var current = null;
    lines.forEach(function (line) {
      if (starter.test(line)) {
        current = [];
        reports.push(current);
      }
      if (current) current.push(line);
    });
    return reports.filter(function (r) {
      return r.some(function (l) { return /^\s*Biologický materiál\b/.test(l); });
    });
  }

  // „1.Staphylococcus aureus      ojediněle“ → { num: '1', name, quantity }
  function parseOrganism(line) {
    var m = /^\s*(\d+)\.\s*(.+?)\s*$/.exec(line);
    if (!m) return null;
    var rest = m[2];
    var name = rest;
    var quantity = '';
    var gap = /^(.+?)\s{2,}(\S.*)$/.exec(rest);
    if (gap) {
      name = gap[1];
      quantity = gap[2];
    } else {
      var lower = rest.toLocaleLowerCase('cs');
      for (var i = 0; i < QUANTITIES.length; i++) {
        var q = QUANTITIES[i];
        if (lower.endsWith(' ' + q)) {
          name = rest.slice(0, rest.length - q.length).trim();
          quantity = rest.slice(rest.length - q.length);
          break;
        }
      }
    }
    return { num: m[1], name: collapse(name), quantity: collapse(quantity) };
  }

  function isSectionHeader(line, indentAware) {
    if (!line.trim() || /^\s*\d+\./.test(line)) return false;
    if (indentAware) return !/^\s/.test(line);
    return KNOWN_SECTIONS.indexOf(collapse(line).toLocaleLowerCase('cs')) !== -1;
  }

  // Oddíly kultivace (Primokultura, Pomnožení, …) s jejich obsahem.
  function parseCulture(lines) {
    var indentAware = lines.some(function (l) { return /^\s+\S/.test(l); });
    var sections = [];
    var current = null;
    lines.forEach(function (line) {
      if (!line.trim()) return;
      if (isSectionHeader(line, indentAware)) {
        current = { title: collapse(line), items: [] };
        sections.push(current);
        return;
      }
      if (!current) {
        current = { title: '', items: [] };
        sections.push(current);
      }
      var org = parseOrganism(line);
      current.items.push(org ? org : { text: collapse(line) });
    });
    return sections;
  }

  // Tabulka citlivosti: sloupce = čísla kmenů, řádky = antibiotika.
  function parseSensitivity(lines) {
    var headerIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*Účinná látka\b/.test(lines[i])) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return null;

    var header = lines[headerIdx];
    var columns = [];
    var colRe = /(\d+)(\*?)/g;
    var after = header.indexOf('látka') + 'látka'.length;
    colRe.lastIndex = after;
    var cm;
    while ((cm = colRe.exec(header))) {
      columns.push({ num: cm[1], tested: !cm[2], pos: cm.index, results: [] });
    }
    if (!columns.length) return null;
    var tested = columns.filter(function (c) { return c.tested; });
    var uncertain = false;

    for (var j = headerIdx + 1; j < lines.length; j++) {
      var line = lines[j];
      if (SEPARATOR.test(line) || !line.trim()) continue;
      var m = /^\s*(.+?)((?:\s+[CRIXNQ*])+)\s*$/.exec(line);
      if (!m) continue;
      var drug = collapse(m[1]);

      var values = [];
      var tokRe = /\S/g;
      var offset = line.trimEnd().length - m[2].length;
      var t;
      while ((t = tokRe.exec(m[2]))) {
        if (SENSITIVITY_CODE.test(t[0])) values.push({ code: t[0], pos: offset + t.index });
      }

      // Netestované kmeny (1*) hodnoty nemají, takže když počet sedí,
      // stačí pořadí. Pozice ve sloupcích jsou jen záloha – při kopírování
      // se mezery často slijí a pozice pak neplatí.
      var targets;
      if (values.length === tested.length) {
        targets = tested;
      } else if (values.length === columns.length) {
        targets = columns;
      } else {
        if (!positionsMatch(values, columns)) uncertain = true;
        targets = values.map(function (v) { return nearestColumn(v.pos, columns); });
      }
      values.forEach(function (v, k) {
        if (v.code !== '*') targets[k].results.push({ drug: drug, code: v.code });
      });
    }
    return { columns: columns, uncertain: uncertain };
  }

  function positionsMatch(values, columns) {
    return values.every(function (v) {
      return columns.some(function (c) { return Math.abs(c.pos - v.pos) <= 1; });
    });
  }

  function nearestColumn(pos, columns) {
    var best = columns[0];
    columns.forEach(function (c) {
      if (Math.abs(c.pos - pos) < Math.abs(best.pos - pos)) best = c;
    });
    return best;
  }

  // Řádky legendy spojí do jednoho; nový kód („N-…“) oddělí čárkou.
  function joinLegend(lines) {
    return lines.reduce(function (acc, line) {
      var l = collapse(line);
      if (!l) return acc;
      if (!acc) return l;
      var sep = /^[A-Z*]-/.test(l) && !/,$/.test(acc) ? ', ' : ' ';
      return acc + sep + l;
    }, '');
  }

  function parseReport(lines) {
    var report = {
      material: field(lines, 'Biologický materiál'),
      date: field(lines, 'Datum a doba odběru') || field(lines, 'Datum a doba příjmu'),
      sections: [],
      sensitivity: null,
      legend: ''
    };

    var mode = 'header';
    var culture = [];
    var sens = [];
    var legend = [];
    lines.forEach(function (line) {
      if (/^\s*KULTIVACE A VYŠETŘENÍ/.test(line)) { mode = 'culture'; return; }
      if (/^\s*CITLIVOST\b/.test(line)) { mode = 'sensitivity'; return; }
      if (/^\s*LEGENDA:/.test(line)) { mode = 'legend'; legend.push(line.replace(/^\s*LEGENDA:\s*/, '')); return; }
      if (/^\s*UVOLNIL:/.test(line)) { mode = 'done'; return; }
      if (mode === 'legend') {
        if (!line.trim()) { mode = 'done'; return; }
        legend.push(line);
        return;
      }
      if (SEPARATOR.test(line)) return;
      if (mode === 'culture') culture.push(line);
      else if (mode === 'sensitivity') sens.push(line);
    });

    report.sections = parseCulture(culture);
    report.sensitivity = parseSensitivity(sens);
    report.legend = joinLegend(legend);
    return report;
  }

  function organismText(o) {
    return o.num + '. ' + o.name + (o.quantity ? ' ' + o.quantity : '');
  }

  // Nález jako nadpis + řádky. Kmeny i citlivost jsou každý na svém řádku.
  function formatReport(r) {
    var columns = r.sensitivity ? r.sensitivity.columns : [];
    var withResults = columns.filter(function (c) { return c.results.length; });
    var date = formatDate(r.date);
    var title = formatMaterial(r.material) + ' - kultivace' +
      (withResults.length ? ' a citlivost' : '') + (date ? ' ' + date : '');
    var lines = [];

    r.sections.forEach(function (s) {
      var items = s.items.filter(function (it) {
        return !(it.text && /^viz primokultur/i.test(it.text));
      });
      if (!items.length) return;
      var label = s.title ? sentenceCase(s.title) + ':' : '';
      if (items.some(function (it) { return it.num; })) {
        if (label) lines.push(label);
        items.forEach(function (it) { lines.push(it.num ? organismText(it) : it.text); });
      } else {
        var body = items.map(function (it) { return it.text; }).join(', ');
        if (label) body = label + ' ' + body.charAt(0).toLocaleLowerCase('cs') + body.slice(1);
        lines.push(body);
      }
    });

    if (withResults.length) {
      lines.push('Citlivost:');
      withResults.forEach(function (c) {
        lines.push(c.num + '. ' + c.results.map(function (x) { return x.drug + ' ' + x.code; }).join(', '));
      });
    }

    if (!lines.length) lines.push('bez výsledku');
    return { title: title, lines: lines };
  }

  function convert(text) {
    var reports = splitReports(text || '').map(parseReport);
    if (!reports.length) return { blocks: [], legend: '', text: '', count: 0, warnings: [] };

    var warnings = reports.filter(function (r) {
      return r.sensitivity && r.sensitivity.uncertain;
    }).map(function (r) {
      return formatMaterial(r.material) + ' ' + formatDate(r.date) +
        ': citlivost nešlo spolehlivě přiřadit ke kmenům, zkontroluj ji s originálem.';
    });

    var blocks = reports.map(formatReport);
    var legendSource = reports.filter(function (r) {
      return r.legend && r.sensitivity && r.sensitivity.columns.some(function (c) { return c.results.length; });
    })[0];
    var legend = legendSource ? 'Legenda: ' + legendSource.legend : '';

    var paragraphs = blocks.map(function (b) { return [b.title].concat(b.lines).join('\n'); });
    if (legend) paragraphs.push(legend);
    return {
      blocks: blocks,
      legend: legend,
      text: paragraphs.join('\n\n'),
      count: reports.length,
      warnings: warnings
    };
  }

  var api = { convert: convert, parseReport: parseReport, splitReports: splitReports };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VfnFormatter = api;
})(this);
