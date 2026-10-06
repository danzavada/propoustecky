# VFN · mikrobiologie do propouštěček

Webová aplikace, která převádí mikrobiologické nálezy zkopírované z NIS VFN
do stručného textu, např.:

> **Výtěr z nosu - kultivace a citlivost 7.9.2026**
> Primokultura:
> 1. Staphylococcus aureus ojediněle
> Citlivost:
> 1. oxacilin C

Nadpisy jsou tučně; tlačítko Kopírovat vloží do schránky formátovaný text
i čistý text pro programy, které formátování neumí.
Legenda k citlivosti se vypíše jen jednou, na konci.

**Web:** https://danzavada.github.io/vfn/

Text se zpracovává jen v prohlížeči a nikam se neodesílá.

## Struktura

- `index.html` - stránka
- `assets/formatter.js` - parser a formátování (bez závislosti na prohlížeči)
- `assets/app.js` - ovládání stránky
- `samples/priklad.txt` - anonymizovaná ukázka nálezů
- `tests/` - testy formátovače

Skutečné nálezy ukládej jen jako `samples/original*.txt` - tyto soubory jsou
v `.gitignore` a do repozitáře se nedostanou. **Repozitář je veřejný.**

Názvy materiálů, které se nemají jen převést na malá písmena (např.
`KRK-VÝTĚR` → „Výtěr z krku“), se doplňují do `MATERIALS` v `assets/formatter.js`.

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
