# L'Antico Arco — inventario fotografie antipasti

Data inventario: 2026-11-23. Fonte: `data/menu.json`, sottocategoria `s36` (`Antipasti`).

## Procedura

- Conservare gli originali prima di modificare o sovrascrivere un'immagine.
- Aggiornare una foto per volta. Non alterare la quantità, la disposizione o l'identità dei prodotti; solo correzioni realistiche (luce, nitidezza, colori naturali), rimozione dello sfondo esterno e ritaglio pulito.
- Non utilizzare ricostruzioni artificiali del prodotto se c'è una fotografia reale. Controllare il risultato prima di sostituire l'immagine pubblicata.
- Dopo ogni sostituzione verificare il percorso in `data/menu.json` e la resa sul sito; la versione precedente deve essere recuperabile.

## Da lavorare — 7 fotografie con sfondo

| Piatto | Foto originale | Stato |
|---|---|---|
| Peperone crusco del Senise fritto in olio d’oliva (30 g) | `img/menu/media-161.webp` | Da migliorare e scontornare |
| Prosciutto cotto | `img/menu/media-78.webp` | Da migliorare e scontornare |
| Prosciutto crudo alla barese (nazionale lucano o Parma) | `img/menu/media-73.webp` | Da migliorare e scontornare |
| Tagliere di formaggi murgiani | `img/menu/media-113.webp` | Da migliorare e scontornare |
| Tagliere di salumi misti (in foto porzione per 4 persone) | `img/menu/media-99.webp` | Da migliorare e scontornare |
| Taralli scaldatelli murgiani olio evo ai semi di finocchio | `img/menu/media-137.webp` | Da migliorare e scontornare |
| Verdure miste sott’olio | `img/menu/media-140.webp` | Da migliorare e scontornare |

## Escluse — foto già elaborate oggi

| Piatto | Foto |
|---|---|
| Bruschetta ai cereali (al pezzo) | `img/uploads/20261123-174138-bruschetta-ai-cereali-al-pezzo.webp` |
| Caprese con mozzarella artigianale a siero innesto | `img/uploads/20261123-174338-caprese-con-mozzarella-artigiana.webp` |
| Caprese di bufala km 0 | `img/uploads/20261123-175140-caprese-di-bufala-km-0.webp` |
| Carciofi grigliati sott’olio | `img/uploads/20261123-175506-carciofi-grigliati-sott-olio.webp` |
| Carpaccio di salmone affumicato, rucola, pepe, olio evo e limone | `img/uploads/20261123-175806-carpaccio-di-salmone-affumicato-.webp` |
| Olive miste piccole in calce e salamoia | `img/uploads/20261123-175931-olive-miste-piccole-in-calce-e-s.webp` |
| Olive miste grandi in calce e salamoia | `img/uploads/20261123-180100-olive-miste-grandi-in-calce-e-sa.webp` |

## Esclusa — già scontornata

- Tagliere di salumi e formaggi per 3: `img/menu/media-30.webp`.

## Piatti senza fotografia collegata — non generare immagini inventate

- Alici marinati
- Bologna (mortadella al forno terrina)
- Capocollo e bufala
- Capocollo e mozzarella artigianale a siero innesto
- Capocollo nazionale
- Carpaccio di bresaola, rucola, grana padana, olio e limone
- Cruditè (verdure crude di stagione miste)
- Involtini di speck e mozzarella artigianale a siero innesto
- Mozzarella artigianale a siero innesto
- Mozzarella di bufala km 0 (125 g)
- Pecorino murgiano (Altamura/Potenza)
- Pomodori secchi sott’olio bio
- Prosciutto crudo e mozzarella artigianale (a siero innesto)
- Prosciutto crudo nazionale
- Provolone di bufala km 0
- Provolone di capra murgiano km 0
- Provolone fuso
- Provolone vaccino artigianale murgiano km 0
- Scamorza di pecora murgiana di Altamura km 0
- Stracciatella siero innesto
- Wurstel di pura carne di suino al forno

**Totale:** 36 antipasti; 7 foto caricate oggi; 7 vecchie foto da elaborare; 1 già scontornata; 21 senza foto.

**Nota:** Questo registro serve per il lavoro foto, non modifica il menu né sostituisce le foto pubblicate.

## Stato effettivo del lavoro nel repository (verificato il 23/11/2026)

Esiste già la **[Pull Request #1](https://github.com/annalisazotti11/lanticoarco/pull/1)**, aperta come *bozza* dal ramo `preparazione-foto-antipasti-20261123` verso `main`. Contiene **7 PNG trasparenti** in `img/menu/antipasti-rifiniti/`, una procedura non generativa di scontorno e le sette associazioni aggiornate in `data/menu.json` **sul ramo di bozza**. Gli originali `img/menu/media-*.webp` sono conservati.

### Verifica visiva individuale delle sette immagini

- **Peperone crusco (media-161):** scontorno riuscito, ma sorgente solo 200×150; forte pixelatura a grande formato. Da usare soltanto come miniatura finché non c'è una foto più definita.
- **Prosciutto cotto (media-78):** il bordo inferiore del piatto quadrato risulta irregolare; **da correggere prima del merge**.
- **Prosciutto crudo alla barese (media-73):** disposizione e recipiente conservati; scontorno sostanzialmente accettabile, ricontrollare la posata al bordo.
- **Tagliere formaggi murgiani (media-113):** composizione e tagliere conservati; qualitativamente accettabile come foto da menu.
- **Tagliere salumi misti (media-99):** composizione conservata e sfondo eliminato; accettabile come foto da menu.
- **Taralli scaldatelli (media-137):** margini del piatto non ben regolari e bordi della carta/taglio evidenti; **da correggere prima del merge**.
- **Verdure miste sott'olio (media-140):** scontorno corretto ma sorgente solo 200×150; molto pixelata a grande formato, preferire una sorgente originale migliore.

**Decisione:** lasciare la PR #1 in bozza e non pubblicare finché le foto con difetti di contorno non sono corrette. Procedere una foto per volta con verifica del risultato. La lista precedente si riferisce alle immagini che hanno uno sfondo nella versione `main`; le bozze PNG esistono già sul ramo di revisione.
