# Scopone Coach

Tavolo da scopone scientifico contro tre avversari virtuali, pensato per
allenare la memoria delle carte. Si gioca in silenzio: nessun commento
durante la mano, l'analisi arriva dopo, leggendo il resoconto.

**Online:** <https://johannes1979i.github.io/scopone-coach/>

Funziona anche da telefono e da tablet. Su iPhone e iPad, «Aggiungi a Home»
dal menu di condivisione lo apre a schermo intero come un'app.

## In locale

```bash
/Library/Developer/CommandLineTools/usr/bin/python3 ~/Progetti/scopone-coach/server.py
```

Poi <http://localhost:8103>. In locale c'è una comodità in più: il server
salva da solo il resoconto di ogni mano in `logs/`, senza doverlo copiare.

## Come funziona

Tu sei **Sud**. Il compagno è **Nord**, gli avversari **Est** e **Ovest**.
Il giro è antiorario: Sud → Est → Nord → Ovest.

Regole applicate: mazzo di 40 carte distribuito tutto, tavolo inizialmente
vuoto, presa obbligatoria della singola quando c'è (le somme valgono solo
se sul tavolo non c'è una carta di pari valore), niente scopa sull'ultima
presa, le carte rimaste vanno a chi ha preso per ultimo.

### Punteggio

Predefinito **a 41**:

| voce | punti |
| --- | --- |
| ogni denaro preso | 1 ciascuno (10 in palio) |
| settebello | 1 in più, oltre al suo punto da denaro |
| più carte | 1 |
| più denari | 1 |
| primiera | 1 |
| ogni scopa | 1 |

Fanno 14 punti fissi a mano più le scope, quindi la partita dura tre o
quattro mani. Con questo conteggio i denari pesano dieci volte più che nel
gioco classico: la mano si decide su quelli, non sulle carte.

Resta disponibile il **classico** (carte, denari, settebello, primiera e le
scope, partita a 11, 16 o 21). Cambiare sistema azzera la partita in corso,
perché i punti delle due scale non sono confrontabili.

**Non c'è nessun contatore delle carte uscite.** È voluto: il pannello
mostra solo carte prese e scope, mentre denari, settebello e primiera
restano da tenere a mente. Il pulsante *Sbircia* mostra tutto, ma ogni
sbirciata finisce nel resoconto.

**Controllo memoria**: quando restano 3 carte compaiono tre domande
(denari usciti, quante carte di un certo rango, settebello). L'esito viene
mostrato solo a fine mano, così non aiuta a giocare. La percentuale di
risposte esatte si accumula nel pannello laterale.

## Analisi

A fine mano si può copiare il resoconto (o scaricarlo) e incollarlo in chat:
contiene le quattro mani iniziali, ogni giocata con il tavolo prima e dopo,
le carte che ciascuno aveva ancora in mano, il punteggio e le risposte al
controllo memoria. Le ultime 25 mani restano salvate nel browser, e
*Archivio mani → Copia tutto* le riversa tutte insieme.

In locale il resoconto finisce già come file in `logs/`.

## Gli avversari

Determinizzazione più ricerca: il motore campiona le distribuzioni possibili
delle carte non viste, scarta quelle incompatibili con i rifiuti osservati
(chi butta senza prendere non ha in mano nessun valore che avrebbe potuto
prendere, perché la presa è obbligatoria), e valuta ogni mossa candidata su
tutti i campioni. Nelle ultime prese la posizione viene risolta in modo
esatto con alfa-beta.

Alla fine c'è uno **spareggio sul tavolo che si lascia scoperto**: fra le
mosse che la ricerca giudica equivalenti si sceglie quella che espone meno
alla scopa. Sembra un dettaglio ed è invece la correzione che ha pesato di
più — vedi sotto.

I bot vedono solo ciò che vedrebbe un giocatore umano: `test.html` contiene
una verifica apposta che la scelta non cambi se si rimescolano le carte che
il bot non può vedere.

Livelli: *principiante* (guarda solo la presa immediata, regala scope),
*intermedio* (ragiona ma sbaglia il 18% delle scelte), *campione*.

### Cosa è stato provato, e cosa ha funzionato

`bench.html` fa giocare due configurazioni una contro l'altra sulle stesse
mani nei due sensi, e misura punti, denari e scope. Serve perché su questo
motore l'intuito sbaglia quasi sempre. Risultati misurati:

| modifica | esito |
| --- | --- |
| simulazioni interne che guardano la risposta avversaria | **peggio**: costa 4,8× e a parità di tempo perde 155-173 |
| pesi dell'euristica ritarati sul punteggio a 41 | **peggio**: 304-343 su 40 mani |
| 2,5× i campioni e finale esatto più profondo | **inutile**: 150-151, la ricerca è satura |
| penalità sul punteggio proporzionale al rischio di scopa | **peggio**: 208-221, e 22 denari persi |
| spareggio a parità di valore sul rischio di scopa | **meglio**: 212-203, e scope regalate da 5,2 a 1,8 per mano |

Il difetto vero non era la profondità della ricerca ma il fatto che il
rischio di scopa, pur essendo calcolato, non entrava nella decisione finale:
finiva diluito nella media sui campioni. Prima della correzione il motore
lasciava la scopa all'avversario 5,2 volte a mano, e in 29 casi su 31 aveva
sottomano un'alternativa che non gliela lasciava.

## File

| file | contenuto |
| --- | --- |
| `rules.js` | mazzo, prese, svolgimento, punteggio |
| `carte.js` | disegno vettoriale delle carte, mazzo piacentino |
| `ai.js` | motore degli avversari |
| `app.js` | interfaccia e svolgimento della partita |
| `server.py` | solo per l'uso locale: file statici + `POST /log` |
| `test.html` | verifica di regole, invarianti e forza dei livelli |
