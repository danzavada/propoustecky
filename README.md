# VFN

Statická webová stránka hostovaná na GitHub Pages.

**Web:** https://danzavada.github.io/vfn/

## Struktura

- `index.html` – hlavní stránka
- `assets/` – styly, obrázky a skripty
- `.nojekyll` – vypíná Jekyll, soubory se servírují tak, jak jsou

## Lokální náhled

```sh
python3 -m http.server 8000
```

Pak otevři http://localhost:8000.

## Nasazení

Každý push do větve `main` se automaticky nasadí na GitHub Pages.
