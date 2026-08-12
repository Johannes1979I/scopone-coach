/* Motore dei 3 avversari.
 *
 * Metodo: determinizzazione + ricerca (PIMC).
 *   1. dalle carte gia' viste si ricava l'insieme delle carte ignote;
 *   2. si campionano piu' distribuzioni possibili delle mani avversarie,
 *      scartando quelle incompatibili con i "rifiuti" osservati
 *      (chi butta una carta senza prendere non ha in mano nessun valore
 *       che in quel momento avrebbe potuto prendere: la presa e' obbligatoria);
 *   3. per ogni distribuzione ogni mossa candidata viene valutata; nelle
 *      ultime prese la posizione si risolve in modo esatto con alfa-beta,
 *      prima si usa una discesa euristica fino in fondo alla mano;
 *   4. si sceglie la mossa con la media migliore.
 */

/* campioni = determinizzazioni nel mediogioco (dove si usa la discesa euristica)
 * campioniFin = determinizzazioni nel finale (dove ogni valutazione e' una
 *   risoluzione esatta, molto piu' cara: servono meno campioni perche' c'e'
 *   anche molta meno incertezza)
 * esattoDa = da quante carte residue in poi si risolve in modo esatto */
/* sogliaScopa = quanto valore (in punti) si e' disposti a lasciare sul piatto
   pur di non scoprire il tavolo; 0 = non ci si pensa affatto */
const LIVELLI = {
  /* guarda solo la presa immediata e quasi non si cura di cosa lascia
     sul tavolo: regala scope, come un principiante vero */
  principiante: { campioni: 0, campioniFin: 0, rumore: 5, pesoRischio: 0.15,
                  esattoDa: 0, nodi: 0, errore: 0, sogliaScopa: 0 },
  /* ragiona sulle mani possibili ma ogni tanto sbaglia scelta */
  intermedio:   { campioni: 45, campioniFin: 14, rumore: 0, pesoRischio: 1,
                  esattoDa: 10, nodi: 120000, errore: 0.18, sogliaScopa: 0.3 },
  campione:     { campioni: 120, campioniFin: 24, rumore: 0, pesoRischio: 1,
                  esattoDa: 12, nodi: 200000, errore: 0, sogliaScopa: 0.7 }
};

/* ---------- vincoli dedotti dai rifiuti ---------- */

function vincoliDaStoria(st) {
  const v = [new Set(), new Set(), new Set(), new Set()];
  for (const m of st.storia) {
    if (m.presa) continue;
    if (!m._prendibili) m._prendibili = valoriPrendibili(m.tavoloPrima);
    for (const x of m._prendibili) v[m.g].add(x);
  }
  return v;
}

/* ---------- campionamento delle mani ignote ---------- */

function campionaMani(st, g, vin, rand) {
  const viste = new Uint8Array(40);
  for (const c of st.mani[g]) viste[c] = 1;
  for (const c of st.tavolo) viste[c] = 1;
  for (const c of st.prese[0]) viste[c] = 1;
  for (const c of st.prese[1]) viste[c] = 1;

  const ignote = [];
  for (let c = 0; c < 40; c++) if (!viste[c]) ignote.push(c);

  const altri = [0, 1, 2, 3].filter(q => q !== g);
  const capienza = {};
  for (const q of altri) capienza[q] = st.mani[q].length;

  /* le carte con meno destinazioni possibili vanno assegnate per prime */
  const ammessi = new Map();
  for (const c of ignote) ammessi.set(c, altri.filter(q => !vin[q].has(val(c))));

  for (let tent = 0; tent < 25; tent++) {
    mescola(ignote, rand);
    ignote.sort((a, b) => ammessi.get(a).length - ammessi.get(b).length);
    const res = { 0: [], 1: [], 2: [], 3: [] };
    let ok = true;
    for (const c of ignote) {
      const cand = ammessi.get(c).filter(q => res[q].length < capienza[q]);
      if (!cand.length) { ok = false; break; }
      res[cand[Math.floor(rand() * cand.length)]].push(c);
    }
    if (ok) return res;
  }

  /* nessuna distribuzione compatibile trovata: si rilassano i vincoli */
  mescola(ignote, rand);
  const res = { 0: [], 1: [], 2: [], 3: [] };
  let k = 0;
  for (const q of altri) { res[q] = ignote.slice(k, k + capienza[q]); k += capienza[q]; }
  return res;
}

/* ---------- euristica di mossa ---------- */

/* probabilita' che una mano di h carte, pescata da U ignote di cui k
 * "pericolose", non ne contenga nessuna */
function probNessuna(U, k, h) {
  if (k <= 0 || h <= 0) return 1;
  if (U - k < h) return 0;
  let p = 1;
  for (let i = 0; i < h; i++) p *= (U - k - i) / (U - i);
  return p;
}

function contaViste(st, g, v) {
  let n = 0;
  for (const c of st.mani[g]) if (val(c) === v) n++;
  for (const c of st.tavolo) if (val(c) === v) n++;
  for (const c of st.prese[0]) if (val(c) === v) n++;
  for (const c of st.prese[1]) if (val(c) === v) n++;
  return n;
}

/* quanto e' probabile che il prossimo giocatore faccia scopa sul tavolo
 * lasciato da g, quando le sue carte NON sono note */
function rischioScopa(st, tav, g) {
  if (!tav.length) return 0;
  let tot = 0;
  for (const c of tav) tot += val(c);
  if (tot > 10) return 0;
  if (tav.length > 1 && tav.some(c => val(c) === tot)) return 0;

  const dopo = (g + 1) & 3;
  const h = st.mani[dopo].length;
  const U = 40 - st.mani[g].length - st.tavolo.length -
            st.prese[0].length - st.prese[1].length;
  const k = 4 - contaViste(st, g, tot);
  return 1 - probNessuna(U, k, h);
}

/* Pesi dell'euristica, in una scala dove la scopa vale 9.
 *
 * Non dipendono dal sistema di punteggio, e non e' una svista: il sistema
 * entra gia' dove conta davvero, cioe' nella valutazione finale delle
 * posizioni (diffPunti usa punteggioMano). Questa euristica serve solo a
 * guidare le discese e l'ordinamento delle mosse, e li' quello che serve e'
 * una politica di gioco sensata in generale. Provato per davvero: gonfiare
 * il peso dei denari per il punteggio a 41 fa giocare *peggio* — su 40 mani
 * a lati invertiti la versione "tarata" perde 304 a 343, e prende pure meno
 * denari, perche' le discese diventano sciatte su presa, tempo e ultima
 * presa. Se un giorno si cambiano questi numeri, rimisurare. */
const PESI = { carta: 1.0, denaro: 2.4, settebello: 10, prim: 0.22,
               buttaDenaro: 1.6, buttaSette: 7 };

/* noto: true quando le mani in st sono attendibili (ricerca su una
 * determinizzazione), false quando si decide alla radice senza vedere
 * le carte altrui — in quel caso il rischio va stimato, non letto. */
function valutaMossa(st, m, g, noto, pesoRischio) {
  let s = 0;
  let tav;
  const w = PESI;
  if (pesoRischio === undefined) pesoRischio = 1;

  if (m.presa) {
    const prese = m.presa;
    for (let i = -1; i < prese.length; i++) {
      const c = i < 0 ? m.carta : prese[i];
      s += w.carta;
      if (seme(c) === 0) s += w.denaro;
      if (c === SETTEBELLO) s += w.settebello;
      s += (PRIMIERA[val(c)] - 10) * w.prim;
    }
    if (st.tavolo.length === prese.length) s += 9;     /* scopa */
    tav = st.tavolo.filter(c => prese.indexOf(c) < 0);
  } else {
    s -= 0.5;
    if (seme(m.carta) === 0) s -= w.buttaDenaro;       /* non regalare denari */
    if (m.carta === SETTEBELLO) s -= w.buttaSette;
    s -= (PRIMIERA[val(m.carta)] - 10) * 0.15;
    tav = st.tavolo.concat([m.carta]);
  }

  /* che cosa lascio al giocatore successivo */
  const dopo = (g + 1) & 3;
  const restano = st.mani[0].length + st.mani[1].length + st.mani[2].length +
                  st.mani[3].length - 1;
  if (restano > 0 && pesoRischio > 0) {
    const peso = (((dopo & 1) === (g & 1)) ? 3.5 : -9) * pesoRischio;
    if (noto) {
      if (puoScopare(tav, st.mani[dopo])) s += peso;
    } else {
      s += peso * rischioScopa(st, tav, g);
    }
  }
  return s;
}

/* Scelta di un giocatore dentro le simulazioni.
 *
 * Resta volutamente a un solo colpo d'occhio. Provata anche una versione che
 * guardava la risposta migliore dell'avversario: a parita' di campioni gioca
 * un filo meglio, ma costa 4,8 volte tanto, e a parita' di TEMPO perde
 * nettamente (155-173, e concede pure piu' scope). Qui conviene simulare
 * tante distribuzioni in modo rozzo piuttosto che poche in modo raffinato. */
function mossaGreedy(st, g) {
  const mosse = mosseLegali(st, g);
  if (mosse.length === 1) return mosse[0];
  let best = mosse[0], bv = -Infinity;
  for (const m of mosse) {
    const v = valutaMossa(st, m, g, true);
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}

/* discesa euristica fino alla fine della mano */
function discesa(st) {
  const s = clona(st);
  while (!s.finita) {
    const m = mossaGreedy(s, s.turno);
    giocaVeloce(s, m.carta, m.presa);
  }
  return diffPunti(s);
}

/* ---------- risoluzione esatta del finale ---------- */

function risolvi(st, alpha, beta, budget) {
  if (st.finita) return diffPunti(st);
  if (++budget.n > budget.max) return discesa(st);

  const g = st.turno;
  const massimizza = (g & 1) === 0;
  const mosse = mosseLegali(st, g);

  /* ordinamento: prima le prese piu' ricche, aiuta i tagli */
  if (mosse.length > 1) {
    for (const m of mosse) m._o = valutaMossa(st, m, g, true);
    mosse.sort((a, b) => b._o - a._o);
  }

  let best = massimizza ? -Infinity : Infinity;
  for (const m of mosse) {
    const s2 = clona(st);
    giocaVeloce(s2, m.carta, m.presa);
    const v = risolvi(s2, alpha, beta, budget);
    if (massimizza) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

/* ---------- scelta della mossa ---------- */

function scegliMossa(st, g, livello) {
  /* si puo' passare il nome di un livello oppure direttamente una
     configurazione, cosi' il banco di prova puo' confrontare varianti */
  const opt = (livello && typeof livello === 'object')
    ? livello
    : (LIVELLI[livello] || LIVELLI.campione);
  const mosse = mosseLegali(st, g);
  if (mosse.length === 1) return mosse[0];

  const rand = rng(((st.seed || 1) ^ ((st.storia.length + 1) * 2654435761)) >>> 0);
  const segno = (g & 1) === 0 ? 1 : -1;

  if (!opt.campioni) {
    let best = mosse[0], bv = -Infinity;
    for (const m of mosse) {
      const v = valutaMossa(st, m, g, false, opt.pesoRischio) + rand() * opt.rumore;
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  const vin = vincoliDaStoria(st);
  const somma = new Array(mosse.length).fill(0);
  const inMano = st.mani[0].length + st.mani[1].length +
                 st.mani[2].length + st.mani[3].length;
  const finale = inMano - 1 <= opt.esattoDa;
  const campioni = finale ? opt.campioniFin : opt.campioni;

  for (let k = 0; k < campioni; k++) {
    const mani = campionaMani(st, g, vin, rand);
    const base = clona(st);
    for (const q of [0, 1, 2, 3]) if (q !== g) base.mani[q] = mani[q];

    for (let i = 0; i < mosse.length; i++) {
      const s2 = clona(base);
      giocaVeloce(s2, mosse[i].carta, mosse[i].presa);
      const restano = s2.mani[0].length + s2.mani[1].length +
                      s2.mani[2].length + s2.mani[3].length;
      const v = restano <= opt.esattoDa
        ? risolvi(s2, -Infinity, Infinity, { n: 0, max: opt.nodi })
        : discesa(s2);
      somma[i] += v * segno;
    }
  }

  const ordine = mosse.map((m, i) => i).sort((a, b) => somma[b] - somma[a]);

  /* Spareggio sul tavolo che si lascia scoperto.
   *
   * La media sui campioni conta gia' la scopa concessa, ma diluita: pesa solo
   * nei campioni dove l'avversario ha davvero la carta giusta, e quel segnale
   * finisce sotto il rumore delle altre differenze. Il risultato era che il
   * motore regalava 5,2 occasioni di scopa a mano, e in 29 casi su 31 aveva
   * un'alternativa che non ne regalava nessuna.
   *
   * Qui il rischio si calcola una volta sola ed esattamente, sulle carte non
   * ancora viste. Ma NON come penalita' sul punteggio: quella e' stata
   * provata e perde (208-221 su 26 mani, con 22 denari persi) perche' a 41 un
   * denaro vale quanto una scopa e rinunciare a una presa costa piu' di quel
   * che salva. Funziona invece come spareggio fra le mosse che la ricerca
   * giudica equivalenti: si toglie il regalo gratuito senza rinunciare a
   * niente che valga. Misurato: da 5,2 a 1,8 occasioni concesse per mano, e
   * 212-203 sui punti contro la versione senza.
   *
   * Chi gioca dopo e' sempre un avversario: il giro e' 0-1-2-3 e le squadre
   * sono pari contro dispari. */
  if (opt.sogliaScopa && mosse.length > 1) {
    const limite = somma[ordine[0]] - opt.sogliaScopa * campioni;
    const vicine = ordine.filter(i => somma[i] >= limite);
    if (vicine.length > 1) {
      const rischio = new Map();
      for (const i of vicine) {
        const tav = mosse[i].presa
          ? st.tavolo.filter(c => mosse[i].presa.indexOf(c) < 0)
          : st.tavolo.concat([mosse[i].carta]);
        rischio.set(i, rischioScopa(st, tav, g));
      }
      vicine.sort((a, b) => (rischio.get(a) - rischio.get(b)) || (somma[b] - somma[a]));
      ordine.splice(0, vicine.length, ...vicine);
    }
  }

  /* ai livelli non massimi ogni tanto si sceglie la seconda migliore */
  const scelto = (opt.errore && mosse.length > 1 && rand() < opt.errore)
    ? ordine[1]
    : ordine[0];
  return mosse[scelto];
}
