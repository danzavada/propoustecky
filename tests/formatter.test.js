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
    'Moč z perman. katetru – kultivace 7.9.2026: Primokultura: negativní.');
});

test('vynechá „viz primokultura“', () => {
  assert.strictEqual(paragraphs(sample)[3],
    'Výtěr z rekta – kultivace 7.9.2026: Primokultura: běžná střevní flóra.');
});

test('citlivost jen u testovaného kmene', () => {
  assert.strictEqual(paragraphs(sample)[5],
    'Permanentní močový katetr – kultivace a citlivost 17.9.2026: ' +
    'Primokultura: 1. Staphylococcus epidermidis ojediněle, 2. Enterococcus faecalis ojediněle. ' +
    'Pomnožení: 3. Proteus hauseri. ' +
    'Citlivost 3. Proteus hauseri: amoxicilin klavulanát C, amikacin C, ampicilin R, ciprofloxacin C, ' +
    'kotrimoxazol C, cefuroxim R, furantoin R, gentamicin C, pivmecilinam R.');
});

test('citlivost u dvou kmenů', () => {
  const p = paragraphs(sample)[7];
  assert.match(p, /Citlivost 1\. Citrobacter koseri: amoxicilin klavulanát R, .*pivmecilinam C; 2\. Proteus hauseri: amoxicilin klavulanát C, .*pivmecilinam R\.$/);
});

test('výsledek nezávisí na slitých mezerách, odsazení ani koncích řádků', () => {
  const expected = convert(sample).text;
  assert.strictEqual(convert(sample.replace(/[ \t]+/g, ' ')).text, expected);
  assert.strictEqual(convert(sample.replace(/^[ \t]+/gm, '')).text, expected);
  assert.strictEqual(convert(sample.replace(/\n/g, '\r\n')).text, expected);
});

test('chybějící hodnota v tabulce: podle pozice, se slitými mezerami varování', () => {
  const gap = sample.replace(' gentamicin                  C   C', ' gentamicin                      C');
  assert.match(paragraphs(gap)[7], /Proteus hauseri: [^;]*gentamicin C/);
  assert.deepStrictEqual(convert(gap).warnings, []);
  assert.strictEqual(convert(gap.replace(/[ \t]+/g, ' ')).warnings.length, 1);
});

test('prázdný vstup', () => {
  assert.deepStrictEqual(convert(''), { text: '', count: 0, warnings: [] });
});
