# Propouštěčky - Zkracovač zpráv z mikrobiologie VFN

Webová aplikace, která převádí mikrobiologické nálezy zkopírované z NIS VFN
do stručného textu, např.:

> **Výtěr z nosu - kultivace a citlivost 7.9.2026**
> Primokultura:
> 1. Staphylococcus aureus ojediněle
> Citlivost:
> 1. oxacilin C

Nadpisy jsou tučně; tlačítko Kopírovat vloží do schránky formátovaný text
i čistý text pro programy, které formátování neumí.
Nálezy jdou rovnou pod sebe, bez prázdných řádků a bez legendy.
Ve vloženém textu se zeleně podbarví vše, co se převzalo do výsledku
(materiál, datum odběru, kmeny, citlivost).

Podnadpis v hlavičce je zároveň výběr nástroje. Druhý nástroj, **Převodník
dávkování léků** (`#leky`), převádí dávkování mezi zápisem ráno-poledne-večer
(`1-0-0`) a zápisem poledne-večer; ráno (`0-0-;1-`) a zpět. Směr se odhadne
podle vloženého textu a jde přepnout tlačítkem. Při převodu na `0-0-;1-` se
řádek `FA:` rozdělí na léky pod sebou a nahoru se doplní
`p.o.: (Poledne-Večer, Ráno-)`; při převodu zpět se tato hlavička odebere.

**Web:** https://danzavada.github.io/propoustecky/

Text se zpracovává jen v prohlížeči a nikam se neodesílá.

## Struktura

- `index.html` - stránka
- `assets/formatter.js` - parser a formátování (bez závislosti na prohlížeči)
- `assets/meds.js` - převod dávkování léků (bez závislosti na prohlížeči)
- `assets/app.js` - ovládání stránky
- `samples/priklad.txt` - anonymizovaná ukázka nálezů
- `tests/` - testy formátovače a převodu léků

Skutečné nálezy ukládej jen jako `samples/original*.txt` - tyto soubory jsou
v `.gitignore` a do repozitáře se nedostanou. **Repozitář je veřejný.**

Názvy materiálů, které se nemají jen převést na malá písmena (např.
`KRK-VÝTĚR` → „Výtěr z krku“), se doplňují do `MATERIALS` v `assets/formatter.js`.
Zkratky, které mají zůstat velkými písmeny (PDK, LDK, DK, CVK, BAL, …),
jsou v `ABBREVIATIONS` tamtéž.

## Lokální náhled

```sh
python3 -m http.server 8000
```

Pak otevři http://localhost:8000.

## Testy

```sh
node --test
```

## Nasazení

Každý push do větve `main` se automaticky nasadí na GitHub Pages.
