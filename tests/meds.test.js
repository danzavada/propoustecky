// Spuštění: node --test
const test = require('node:test');
const assert = require('node:assert');
const { convert, detect } = require('../assets/meds.js');

const toWard = (text) => convert(text, 'ward').text;
const toClassic = (text) => convert(text, 'classic').text;

test('ráno-poledne-večer → poledne-večer; ráno, bez hlavičky', () => {
  assert.strictEqual(toWard('Concor 5mg tbl 1-0-1\nForxiga 10mg tbl 1/2-0-0'),
    'Concor 5mg tbl 0-1-;1-\nForxiga 10mg tbl 0-0-;1/2-');
});

test('dávka na noc a desetinná čísla', () => {
  assert.deepStrictEqual(toWard('Midazolam 7,5mg 0-0-0-1/2\nBisoprolol 5mg 1,5-0-0').split('\n'),
    ['Midazolam 7,5mg 0-0-1/2-;0-', 'Bisoprolol 5mg 0-0-;1,5-']);
});

test('řádek FA se rozdělí na léky pod sebou', () => {
  assert.strictEqual(
    toWard('FA:  Digoxin 0,125 mg tbl 1-0-0, Januvia 0-1-0, Warfarin 1-0-0 (vysazen 10.8., znovu 13.8.), Vigantol 4 kapky denně'),
    ['Digoxin 0,125 mg tbl 0-0-;1-', 'Januvia 1-0-;0-',
      'Warfarin 0-0-;1- (vysazen 10.8., znovu 13.8.)', 'Vigantol 4 kapky denně'].join('\n'));
});

test('výčet léků za sebou i bez FA se rozdělí pod sebe', () => {
  assert.strictEqual(
    toWard('Xarelto 15 mg tbl 1-0-0, Cipralex 20 mg tbl 1/2-0-0, Glyclada 30 mg tlb 1-0-1, Vigantol 4 kapky denně'),
    ['Xarelto 15 mg tbl 0-0-;1-', 'Cipralex 20 mg tbl 0-0-;1/2-', 'Glyclada 30 mg tlb 0-1-;1-',
      'Vigantol 4 kapky denně'].join('\n'));
});

test('jeden lék s čárkou v poznámce se nerozdělí', () => {
  assert.strictEqual(toWard('Concor 5mg tbl 1-0-0, při TF < 50 vynechat'),
    'Concor 5mg tbl 0-0-;1-, při TF < 50 vynechat');
});

test('existující hlavička p.o. zůstane, nová se nepřidá', () => {
  const text = 'p.o.: (Poledne-Večer, Ráno-)\nConcor 5mg tbl 1-0-0';
  assert.strictEqual(toWard(text), 'p.o.: (Poledne-Večer, Ráno-)\nConcor 5mg tbl 0-0-;1-');
});

test('zpět na ráno-poledne-večer ze všech variant zápisu', () => {
  assert.strictEqual(toClassic([
    'p.o.: (Poledne-Večer, Ráno-) ',
    'Bisoprolol 10mg tbl 0-0; 1-',
    'Forxiga 10mg tbl 0-0-;1-',
    'Concor 5mg tbl 0-0, 1-',
    'Verospiron 25mg tbl 1/2-0; 0-',
    'Trittico 75 mg tbl. 0-0-1/3; 0-',
    'Tiapridal 100mg tbl 0-0-1, 0-',
    'Helicid 20mg cps. 0-0; 1- nalačno'
  ].join('\n')), [
    'Bisoprolol 10mg tbl 1-0-0',
    'Forxiga 10mg tbl 1-0-0',
    'Concor 5mg tbl 1-0-0',
    'Verospiron 25mg tbl 0-1/2-0',
    'Trittico 75 mg tbl. 0-0-0-1/3',
    'Tiapridal 100mg tbl 0-0-0-1',
    'Helicid 20mg cps. 1-0-0 nalačno'
  ].join('\n'));
});

test('tam a zpět vrátí původní dávky', () => {
  const text = 'Concor 5mg tbl 1-0-1\nMidazolam 7,5mg 0-0-0-1/2';
  assert.strictEqual(toClassic(toWard(text)), text);
});

test('ostatní řádky zůstanou beze změny', () => {
  const text = [
    'Eliquis 5mg tbl v 20-;08- hod.',
    'Tardyferon 247,25mg tbl. EX',
    'Eliquis 2,5mg tbl. STOP',
    'Afexil 500mg tbl 1tbl při bolesti >2/10 NRS, max. á 6h',
    'Entresto 24/26 mg tbl'
  ].join('\n');
  assert.strictEqual(toWard(text), text);
  assert.strictEqual(toClassic(text), text);
  assert.strictEqual(convert(text, 'ward').count, 0);
});

test('v daném směru převede jen druhý zápis', () => {
  assert.strictEqual(toWard('A 0-0; 1-\nB 1-0-0'), 'A 0-0; 1-\nB 0-0-;1-');
  assert.strictEqual(toClassic('A 0-0; 1-\nB 1-0-0'), 'A 1-0-0\nB 1-0-0');
});

test('odhad směru podle převažujícího zápisu', () => {
  assert.strictEqual(detect('FA: A 1-0-0, B 1-0-1'), 'ward');
  assert.strictEqual(detect('A 0-0; 1-\nB 0-1; 1-\nFA: C 1-0-0'), 'classic');
  assert.strictEqual(detect(''), 'ward');
});

test('podbarvené úseky odpovídají převedeným dávkám', () => {
  const text = 'FA: Concor 1-0-1, Januvia 0-1-0';
  const r = convert(text, 'ward');
  assert.deepStrictEqual(r.marks.map(([a, b]) => text.slice(a, b)), ['1-0-1', '0-1-0']);
  assert.deepStrictEqual(r.outMarks.map(([a, b]) => r.text.slice(a, b)), ['0-1-;1-', '1-0-;0-']);
});
