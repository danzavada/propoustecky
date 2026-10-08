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

  // Zkratky, které v názvu materiálu zůstanou velkými písmeny
  // („STĚR Z RÁNY PDK“ → „Stěr z rány PDK“).
  var ABBREVIATIONS = [
    // končetiny
    'DK', 'DKK', 'PDK', 'LDK', 'HK', 'HKK', 'PHK', 'LHK',
    // katétry, kanyly, sondy, vstupy
    'CVK', 'CŽK', 'PŽK', 'PICC', 'PMK', 'HD', 'PD', 'AV', 'ETK', 'TSK', 'NGS', 'PEG', 'TEP',
    // dýchací cesty
    'HCD', 'DCD', 'BAL', 'ETA',
    // screening
    'MRSA', 'VRE', 'ESBL', 'CPE'
  ];

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
  var DATE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;

  function collapse(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  function sentenceCase(s) {
    var lower = s.toLocaleLowerCase('cs');
    return lower.charAt(0).toLocaleUpperCase('cs') + lower.slice(1);
  }

  function keepAbbreviations(s) {
    return s.replace(/\p{L}+/gu, function (word) {
      var upper = word.toLocaleUpperCase('cs');
      return ABBREVIATIONS.indexOf(upper) !== -1 ? upper : word;
    });
  }

  function formatMaterial(raw) {
    var key = collapse(raw).toLocaleUpperCase('cs');
    if (MATERIALS[key]) return MATERIALS[key];
    // „PERMAN.KATETRU“ → „perman. katetru“
    return keepAbbreviations(sentenceCase(collapse(raw).replace(/\.(?=\S)/g, '. ')));
  }

  function formatDate(raw) {
    var m = DATE.exec(raw || '');
    if (!m) return '';
    return parseInt(m[1], 10) + '.' + parseInt(m[2], 10) + '.' + m[3];
  }

  // Hodnota pole z hlavičky nálezu i s místem, kde v řádku začíná.
  function field(lines, label) {
    var re = new RegExp('^(\\s*' + label + '\\s+)(.*?)\\s*$');
    for (var i = 0; i < lines.length; i++) {
      var m = re.exec(lines[i]);
      if (m) return { value: m[2], line: i, col: m[1].length };
    }
    return null;
  }

  // Rozdělí text na řádky a zapamatuje si, kde ve vstupu každý začíná.
  function splitLines(text) {
    var lines = [];
    var offsets = [];
    var re = /\r\n?|\n/g;
    var pos = 0;
    var m;
    while ((m = re.exec(text))) {
      lines.push(text.slice(pos, m.index));
      offsets.push(pos);
      pos = re.lastIndex;
    }
    lines.push(text.slice(pos));
    offsets.push(pos);
    return { lines: lines, offsets: offsets };
  }

  // Rozdělí vložený text na jednotlivé nálezy.
  function splitReports(text) {
    var all = splitLines(text);
    var starter = /^\s*Laboratoř\b/;
    if (!all.lines.some(function (l) { return starter.test(l); })) starter = /^\s*Pacient\b/;

    var reports = [];
    var current = null;
    all.lines.forEach(function (line, i) {
      if (starter.test(line)) {
        current = { lines: [], offsets: [] };
        reports.push(current);
      }
      if (current) {
        current.lines.push(line);
        current.offsets.push(all.offsets[i]);
      }
    });
    return reports.filter(function (r) {
      return r.lines.some(function (l) { return /^\s*Biologický materiál\b/.test(l); });
    });
  }

  // Úsek řádku bez mezer na okrajích jako [začátek, konec].
  function trimmedSpan(line) {
    var start = line.length - line.trimStart().length;
    var end = line.trimEnd().length;
    return start < end ? [start, end] : null;
  }

  // Zapamatuje si úsek vstupu, ze kterého se něco převzalo do výsledku.
  function mark(r, line, span) {
    if (!span) return;
    var base = r.src.offsets[line];
    r.marks.push([base + span[0], base + span[1]]);
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
  // idxs jsou čísla řádků nálezu, které do kultivace patří.
  function parseCulture(lines, idxs) {
    var indentAware = idxs.some(function (i) { return /^\s+\S/.test(lines[i]); });
    var sections = [];
    var current = null;
    idxs.forEach(function (i) {
      var line = lines[i];
      if (!line.trim()) return;
      if (isSectionHeader(line, indentAware)) {
        current = { title: collapse(line), line: i, items: [] };
        sections.push(current);
        return;
      }
      if (!current) {
        current = { title: '', line: -1, items: [] };
        sections.push(current);
      }
      var item = parseOrganism(line) || { text: collapse(line) };
      item.line = i;
      current.items.push(item);
    });
    return sections;
  }

  // Tabulka citlivosti: sloupce = čísla kmenů, řádky = antibiotika.
  function parseSensitivity(lines, idxs) {
    var headerAt = -1;
    for (var i = 0; i < idxs.length; i++) {
      if (/^\s*Účinná látka\b/.test(lines[idxs[i]])) { headerAt = i; break; }
    }
    if (headerAt === -1) return null;

    var header = lines[idxs[headerAt]];
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

    for (var j = headerAt + 1; j < idxs.length; j++) {
      var lineNo = idxs[j];
      var line = lines[lineNo];
      if (SEPARATOR.test(line) || !line.trim()) continue;
      var m = /^\s*(.+?)((?:\s+[CRIXNQ*])+)\s*$/.exec(line);
      if (!m) continue;
      var drug = collapse(m[1]);
      var drugStart = line.length - line.trimStart().length;
      var drugSpan = [drugStart, drugStart + m[1].length];

      var values = [];
      var tokRe = /\S/g;
      var offset = line.trimEnd().length - m[2].length;
      var t;
      while ((t = tokRe.exec(m[2]))) {
        if (SENSITIVITY_CODE.test(t[0])) values.push({ code: t[0], pos: offset + t.index });
      }

      // Netestované kmeny (1*) hodnoty nemají, takže když počet sedí,
      // stačí pořadí. Pozice ve sloupcích jsou jen záloha - při kopírování
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
        if (v.code !== '*') {
          targets[k].results.push({
            drug: drug, code: v.code, line: lineNo, drugSpan: drugSpan, codePos: v.pos
          });
        }
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

  // src = { lines, offsets } ze splitReports.
  function parseReport(src) {
    var lines = src.lines;
    var report = {
      material: '',
      date: '',
      sections: [],
      sensitivity: null,
      legend: '',
      legendLines: [],
      src: src,
      marks: []
    };

    var material = field(lines, 'Biologický materiál');
    if (material) {
      report.material = material.value;
      mark(report, material.line, [material.col, material.col + material.value.length]);
    }
    ['Datum a doba odběru', 'Datum a doba příjmu'].some(function (label) {
      var f = field(lines, label);
      var m = f && DATE.exec(f.value);
      if (!m) return false;
      report.date = m[0];
      mark(report, f.line, [f.col + m.index, f.col + m.index + m[0].length]);
      return true;
    });

    var mode = 'header';
    var culture = [];
    var sens = [];
    var legend = [];
    lines.forEach(function (line, i) {
      if (/^\s*KULTIVACE A VYŠETŘENÍ/.test(line)) { mode = 'culture'; return; }
      if (/^\s*CITLIVOST\b/.test(line)) { mode = 'sensitivity'; return; }
      if (/^\s*LEGENDA:/.test(line)) { mode = 'legend'; legend.push(i); return; }
      if (/^\s*UVOLNIL:/.test(line)) { mode = 'done'; return; }
      if (mode === 'legend') {
        if (!line.trim()) { mode = 'done'; return; }
        legend.push(i);
        return;
      }
      if (SEPARATOR.test(line)) return;
      if (mode === 'culture') culture.push(i);
      else if (mode === 'sensitivity') sens.push(i);
    });

    report.sections = parseCulture(lines, culture);
    report.sensitivity = parseSensitivity(lines, sens);
    report.legend = joinLegend(legend.map(function (i) {
      return lines[i].replace(/^\s*LEGENDA:\s*/, '');
    }));
    report.legendLines = legend;
    return report;
  }

  function organismText(o) {
    return o.num + '. ' + o.name + (o.quantity ? ' ' + o.quantity : '');
  }

  // „MRSA nezachycen“ zůstane, „Negativní“ → „negativní“.
  function lowerFirst(s) {
    return /^\p{Lu}{2}/u.test(s) ? s : s.charAt(0).toLocaleLowerCase('cs') + s.slice(1);
  }

  // Nález jako nadpis + řádky. Kmeny i citlivost jsou každý na svém řádku.
  // Převzaté úseky vstupu si poznamená do r.marks.
  function formatReport(r) {
    var src = r.src.lines;
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
      if (s.line !== -1) mark(r, s.line, trimmedSpan(src[s.line]));
      items.forEach(function (it) { mark(r, it.line, trimmedSpan(src[it.line])); });

      var label = s.title ? sentenceCase(s.title) + ':' : '';
      if (items.some(function (it) { return it.num; })) {
        if (label) lines.push(label);
        items.forEach(function (it) { lines.push(it.num ? organismText(it) : it.text); });
      } else {
        var body = items.map(function (it) { return it.text; }).join(', ');
        if (label) body = label + ' ' + lowerFirst(body);
        lines.push(body);
      }
    });

    if (withResults.length) {
      lines.push('Citlivost:');
      withResults.forEach(function (c) {
        c.results.forEach(function (x) {
          mark(r, x.line, x.drugSpan);
          mark(r, x.line, [x.codePos, x.codePos + 1]);
        });
        lines.push(c.num + '. ' + c.results.map(function (x) { return x.drug + ' ' + x.code; }).join(', '));
      });
    }

    if (!lines.length) lines.push('bez výsledku');
    return { title: title, lines: lines };
  }

  // Seřadí úseky a slije ty, které se překrývají nebo dotýkají.
  function mergeRanges(ranges) {
    var sorted = ranges.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    return sorted.reduce(function (acc, r) {
      var last = acc[acc.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else acc.push([r[0], r[1]]);
      return acc;
    }, []);
  }

  // Vrací i marks: úseky vstupu [začátek, konec), které se dostaly do výsledku.
  function convert(text) {
    var reports = splitReports(text || '').map(parseReport);
    if (!reports.length) return { blocks: [], legend: '', text: '', count: 0, warnings: [], marks: [] };

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
    if (legendSource) {
      legendSource.legendLines.forEach(function (i) {
        mark(legendSource, i, trimmedSpan(legendSource.src.lines[i]));
      });
    }

    var paragraphs = blocks.map(function (b) { return [b.title].concat(b.lines).join('\n'); });
    if (legend) paragraphs.push(legend);
    return {
      blocks: blocks,
      legend: legend,
      text: paragraphs.join('\n\n'),
      count: reports.length,
      warnings: warnings,
      marks: mergeRanges(reports.reduce(function (acc, r) { return acc.concat(r.marks); }, []))
    };
  }

  var api = { convert: convert, parseReport: parseReport, splitReports: splitReports };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PropousteckyFormatter = api;
})(this);
