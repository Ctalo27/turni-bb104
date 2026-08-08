# Turni

Calendario personale per consultare i turni, utilizzabile da telefono e computer e installabile
come app web (PWA).

## Uso

- Scegli il preset disponibile nell'intestazione.
- Tocca un giorno per vedere il dettaglio o gestire un turno speciale.
- Usa l'icona 📍 per ritornare al giorno corrente.
- La pagina **Info** spiega in modo semplice lo scopo dell'app.

## Dati e privacy

Turni è un'app statica: non richiede account, non ha un backend e non invia dati a servizi
esterni. Le informazioni inserite restano nel browser del dispositivo (`localStorage`).

> Strumento personale, non ufficiale. Sviluppato e mantenuto in autonomia, in uso informale.
> Tutti i dati restano solo su questo dispositivo.

## Struttura del progetto

L'app non richiede un processo di compilazione né dipendenze da installare:

- `index.html` — struttura e stile dell'interfaccia
- `app.js` — interfaccia e comportamenti dell'app
- `config/` — preset dei cicli
- `core/` — date, festività, dati e calcolo dei turni
- `sw.js` — cache offline della PWA

Per provarla in locale basta servire questa cartella con un normale server HTTP statico.
