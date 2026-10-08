// Spuštění: node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { convert } = require('../assets/formatter.js');

const sample = fs.readFileSync(path.join(__dirname, '..', 'samples', 'priklad.txt'), 'utf8');
const paragraphs = (text) => convert(text).text.split('\n\n');

test('rozpozná všechny nálezy a přidá jednu legendu na konec', () => {
  const out = paragraphs(sample);
  assert.strictEqual(convert(sample).count, 8);
  assert.strictEqual(out.length, 9);
  assert.match(out[8], /^Legenda: C-citlivý, R-resistentní/);
  assert.strictEqual(out.filter((p) => p.startsWith('Legenda')).length, 1);
});

test('negativní kultivace', () => {
  assert.strictEqual(paragraphs(sample)[0],
    'Moč z perman. katetru - kultivace 7.9.2026\nPrimokultura: negativní');
});

test('vynechá „viz primokultura“', () => {
  assert.strictEqual(paragraphs(sample)[3],
    'Výtěr z rekta - kultivace 7.9.2026\nPrimokultura: běžná střevní flóra');
});

test('kmeny pod sebou, citlivost jen u testovaného kmene', () => {
  assert.strictEqual(paragraphs(sample)[5], [
    'Permanentní močový katetr - kultivace a citlivost 17.9.2026',
    'Primokultura:',
    '1. Staphylococcus epidermidis ojediněle',
    '2. Enterococcus faecalis ojediněle',
    'Pomnožení:',
    '3. Proteus hauseri',
    'Citlivost:',
    '3. amoxicilin klavulanát C, amikacin C, ampicilin R, ciprofloxacin C, ' +
      'kotrimoxazol C, cefuroxim R, furantoin R, gentamicin C, pivmecilinam R'
  ].join('\n'));
});

test('citlivost u dvou kmenů', () => {
  const lines = paragraphs(sample)[7].split('\n');
  assert.strictEqual(lines[0], 'Uretra - kultivace a citlivost 19.9.2026');
  assert.strictEqual(lines[4], 'Citlivost:');
  assert.match(lines[5], /^1\. amoxicilin klavulanát R, .*pivmecilinam C$/);
  assert.match(lines[6], /^2\. amoxicilin klavulanát C, .*pivmecilinam R$/);
});

test('bez dlouhých pomlček', () => {
  assert.doesNotMatch(convert(sample).text, /[–—]/);
});

test('výsledek nezávisí na slitých mezerách, odsazení ani koncích řádků', () => {
  const expected = convert(sample).text;
  assert.strictEqual(convert(sample.replace(/[ \t]+/g, ' ')).text, expected);
  assert.strictEqual(convert(sample.replace(/^[ \t]+/gm, '')).text, expected);
  assert.strictEqual(convert(sample.replace(/\n/g, '\r\n')).text, expected);
});

test('chybějící hodnota v tabulce: podle pozice, se slitými mezerami varování', () => {
  const gap = sample.replace(' gentamicin                  C   C', ' gentamicin                      C');
  const lines = paragraphs(gap)[7].split('\n');
  assert.doesNotMatch(lines[5], /gentamicin/);
  assert.match(lines[6], /gentamicin C/);
  assert.deepStrictEqual(convert(gap).warnings, []);
  assert.strictEqual(convert(gap.replace(/[ \t]+/g, ' ')).warnings.length, 1);
});

test('prázdný vstup', () => {
  assert.deepStrictEqual(convert(''), { blocks: [], legend: '', text: '', count: 0, warnings: [], marks: [] });
});

test('zkratky v názvu materiálu zůstanou velkými písmeny', () => {
  const title = (material) =>
    paragraphs(sample.replace('MOČ Z PERMAN.KATETRU', material))[0].split('\n')[0];
  assert.strictEqual(title('STĚR Z RÁNY PDK'), 'Stěr z rány PDK - kultivace 7.9.2026');
  assert.strictEqual(title('STĚR Z RÁNY LDK A DK'), 'Stěr z rány LDK a DK - kultivace 7.9.2026');
  assert.strictEqual(title('KONEC CVK'), 'Konec CVK - kultivace 7.9.2026');
  assert.strictEqual(title('BAL'), 'BAL - kultivace 7.9.2026');
  assert.strictEqual(title('MOČ Z PMK'), 'Moč z PMK - kultivace 7.9.2026');
});

const marked = (text) => convert(text).marks.map(([a, b]) => text.slice(a, b));

test('zvýrazní převzaté části vstupu', () => {
  const m = marked(sample);
  assert.ok(m.includes('MOČ Z PERMAN.KATETRU'));
  assert.ok(m.includes('07.09.2026'));
  assert.ok(m.includes('17.09.2026'));
  assert.ok(m.includes('Primokultura'));
  assert.ok(m.includes('negativní'));
  assert.ok(m.includes('1.Staphylococcus aureus                 ojediněle'));
  assert.ok(m.includes('oxacilin'));
  assert.ok(m.includes('C'));
  assert.ok(m.some((x) => x.startsWith('LEGENDA: C-citlivý')));
  // datum odběru, ne příjmu ani ukončení; netestované kmeny ani hlavička ne
  assert.ok(!m.some((x) => /14:00|08:01|Laboratorní|Účinná látka|UVOLNIL|viz primokultur/i.test(x)));
  // legenda jen jednou
  assert.strictEqual(m.filter((x) => x.startsWith('LEGENDA')).length, 1);
});

test('zvýraznění sedí i s konci řádků CRLF', () => {
  const crlf = sample.replace(/\n/g, '\r\n');
  assert.deepStrictEqual(marked(crlf), marked(sample));
});
