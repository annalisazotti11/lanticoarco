# Pizzeria L'Antico Arco · sito, menu, totem e gestionale

Sito statico pubblicato gratis con GitHub Pages: nessun abbonamento e nessun server da mantenere.

| Indirizzo | A cosa serve |
|---|---|
| `/` | Sito della pizzeria: storia, impasti, foto, orari, dove siamo |
| `/menu/` | Menu per telefono e PC (quello dei QR sui tavoli) |
| `/totem/` | Menu a scorrimento per lo schermo verticale da 32" in sala |
| `/gestione/` | Gestionale privato: si entra con nome utente e password |

## Come funziona il gestionale

- Tutti i dati del menu sono in `data/menu.json`; le foto caricate finiscono in `img/uploads/`.
- Le modifiche restano in bozza sul dispositivo finché non si preme **Pubblica**: allora il gestionale salva un'unica versione su GitHub e in 1–2 minuti si aggiornano sito, menu e totem. Il totem controlla da solo le novità ogni 90 secondi.
- **Anteprima** mostra il menu con la bozza, prima di pubblicare.
- Ogni pubblicazione resta nella cronologia (Altro → Cronologia) e si può ricaricare.

### Prima configurazione (una volta sola)

1. Su GitHub crea una chiave "fine-grained" (Settings → Developer settings → Personal access tokens → Fine-grained tokens):
   accesso **solo a questo repository**, permesso **Contents: Read and write**, scadenza a scelta (consigliata: nessuna, oppure 1 anno con promemoria).
2. Apri `/gestione/` e compila: repository (`utente/nome-repo`), la chiave, nome utente e password del gestore (almeno 10 caratteri).
3. Fatto. Il gestionale salva in `gestione/config.json` la chiave **cifrata** con la password (PBKDF2 + AES‑GCM): senza password la chiave non è leggibile.

Se la chiave scade o viene revocata, basta crearne una nuova, cancellare `gestione/config.json` dal repository e rifare questi passaggi.

## Totem

- Aprire `/totem/` nel browser del totem a schermo intero (pulsante "Schermo intero", oppure in modalità kiosk; su Android va bene un'app tipo *Fully Kiosk Browser*).
- Scorre da solo le categorie; se lo schermo è touch, toccando una categoria si salta lì e dopo 45 secondi riparte da solo.
- Parametri opzionali nell'indirizzo: `?secondi=15`, `?tema=scuro`, `?solo=pizze,bevande`.
- Si ricarica da solo ogni notte alle 4:30; se manca internet continua a mostrare l'ultima versione salvata.

## Dominio

Per usare `www.lanticoarco.it`: in GitHub (Settings → Pages) imposta il dominio personalizzato, poi nel pannello DNS di Aruba
punta `www` con un record CNAME a `UTENTE.github.io` e il dominio senza www con i record A di GitHub Pages
(185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153). **Non toccare i record MX** (la posta).

## Origine dei contenuti

Dati e foto del menu importati da Saliently/EasyMenu il 21/11/2026; storia, foto e testi dal vecchio sito lanticoarco.it.
Logo originale in `assets/img/logo/logo-originale.jpg` (in `logo.png`/`logo.webp` è stato solo reso trasparente lo sfondo bianco).
