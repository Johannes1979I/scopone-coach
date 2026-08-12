/* Scopone scientifico — regole, mazzo, prese, punteggio.
 *
 * Una carta e' un intero 0..39:   id = (valore - 1) * 4 + seme
 *   valore 1..10   (1 asso, 8 fante, 9 cavallo, 10 re)
 *   seme   0..3    (0 denari, 1 coppe, 2 spade, 3 bastoni)
 *
 * Squadre: giocatori 0 e 2 = squadra 0 ; giocatori 1 e 3 = squadra 1.
 */

const SEMI_NOME = ['denari', 'coppe', 'spade', 'bastoni'];
const SEMI_GLIFO = ['♦', '♥', '♠', '♣'];
const VAL_SIGLA = ['', 'A', '2', '3', '4', '5', '6', '7', 'F', 'C', 'R'];
const VAL_NOME = ['', 'asso', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'fante', 'cavallo', 're'];

/* punti primiera per valore */
const PRIMIERA = [0, 16, 12, 13, 14, 15, 18, 21, 10, 10, 10];

const val = c => (c >> 2) + 1;
const seme = c => c & 3;
const carta = (v, s) => (v - 1) * 4 + s;
const SETTEBELLO = carta(7, 0);

const nomeCarta = c => VAL_SIGLA[val(c)] + SEMI_GLIFO[seme(c)];
const nomeCartaEsteso = c => VAL_NOME[val(c)] + ' di ' + SEMI_NOME[seme(c)];

const squadraDi = g => g & 1;

/* ---------- generatore casuale riproducibile ---------- */

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mescola(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- prese ---------- */

/* Insiemi di carte del tavolo che la carta giocata puo' prendere.
 * Regola: se sul tavolo c'e' almeno una carta di pari valore, si DEVE
 * prendere quella (una singola a scelta); le somme valgono solo se non
 * esiste nessuna carta singola di pari valore. */
function prese(c, tavolo) {
  const v = val(c);
  const singole = tavolo.filter(t => val(t) === v);
  if (singole.length) return singole.map(t => [t]);
  return sommeChe(tavolo, v);
}

function sommeChe(tavolo, somma) {
  const out = [];
  const cur = [];
  (function rec(i, resto) {
    if (resto === 0) {
      if (cur.length >= 2) out.push(cur.slice());
      return;
    }
    for (let j = i; j < tavolo.length; j++) {
      const v = val(tavolo[j]);
      if (v <= resto) {
        cur.push(tavolo[j]);
        rec(j + 1, resto - v);
        cur.pop();
      }
    }
  })(0, somma);
  return out;
}

/* i valori 1..10 che, giocati ora, prenderebbero qualcosa */
function valoriPrendibili(tavolo) {
  const s = new Set();
  for (let v = 1; v <= 10; v++) {
    if (tavolo.some(t => val(t) === v)) { s.add(v); continue; }
    if (sommeChe(tavolo, v).length) s.add(v);
  }
  return s;
}

/* una mano puo' fare scopa sul tavolo dato? */
function puoScopare(tavolo, mano) {
  if (!tavolo.length) return false;
  const tot = tavolo.reduce((a, c) => a + val(c), 0);
  if (tot > 10) return false;
  /* se esiste una singola di pari valore, la regola obbliga a prendere
     solo quella: fa scopa solo se il tavolo ha una carta sola */
  const singola = tavolo.some(t => val(t) === tot);
  if (singola && tavolo.length > 1) return false;
  return mano.some(c => val(c) === tot);
}

/* ---------- stato ---------- */

function nuovaMano(seed, mazziere) {
  const rand = rng(seed);
  const mazzo = mescola([...Array(40).keys()], rand);
  const mani = [[], [], [], []];
  for (let i = 0; i < 40; i++) mani[i % 4].push(mazzo[i]);
  for (const m of mani) m.sort((a, b) => val(a) - val(b) || seme(a) - seme(b));
  const primo = (mazziere + 1) % 4;
  return {
    seed,
    mazziere,
    primo,
    turno: primo,
    mani,
    maniIniziali: mani.map(m => m.slice()),
    tavolo: [],
    prese: [[], []],
    scope: [0, 0],
    ultimaPresa: null,
    storia: [],
    finita: false,
    rastrello: null
  };
}

function mosseLegali(st, g) {
  const out = [];
  for (const c of st.mani[g]) {
    const ps = prese(c, st.tavolo);
    if (!ps.length) out.push({ carta: c, presa: null });
    else for (const p of ps) out.push({ carta: c, presa: p });
  }
  return out;
}

/* applica la mossa; ritorna il record della mossa */
function gioca(st, c, presa) {
  const g = st.turno;
  const sq = squadraDi(g);
  const mano = st.mani[g];
  const i = mano.indexOf(c);
  if (i < 0) throw new Error('carta non in mano: ' + nomeCarta(c));

  const rec = {
    n: st.storia.length + 1,
    presa_num: Math.floor(st.storia.length / 4) + 1,
    g,
    squadra: sq,
    carta: c,
    presa: presa ? presa.slice() : null,
    scopa: false,
    tavoloPrima: st.tavolo.slice(),
    inMano: mano.slice()
  };

  mano.splice(i, 1);
  const ultima = st.mani.every(m => !m.length);

  if (presa && presa.length) {
    for (const t of presa) {
      const k = st.tavolo.indexOf(t);
      if (k < 0) throw new Error('carta non sul tavolo: ' + nomeCarta(t));
      st.tavolo.splice(k, 1);
    }
    st.prese[sq].push(c, ...presa);
    st.ultimaPresa = sq;
    if (!st.tavolo.length && !ultima) {
      st.scope[sq]++;
      rec.scopa = true;
    }
  } else {
    st.tavolo.push(c);
  }

  rec.tavoloDopo = st.tavolo.slice();
  st.storia.push(rec);
  st.turno = (g + 1) % 4;

  if (ultima) {
    if (st.tavolo.length && st.ultimaPresa !== null) {
      st.rastrello = { squadra: st.ultimaPresa, carte: st.tavolo.slice() };
      st.prese[st.ultimaPresa].push(...st.tavolo);
      st.tavolo = [];
    }
    st.finita = true;
  }
  return rec;
}

/* versione senza storia, per la ricerca */
function giocaVeloce(st, c, presa) {
  const g = st.turno;
  const sq = g & 1;
  const mano = st.mani[g];
  mano.splice(mano.indexOf(c), 1);
  const ultima = st.mani[0].length === 0 && st.mani[1].length === 0 &&
                 st.mani[2].length === 0 && st.mani[3].length === 0;
  if (presa && presa.length) {
    for (const t of presa) st.tavolo.splice(st.tavolo.indexOf(t), 1);
    st.prese[sq].push(c, ...presa);
    st.ultimaPresa = sq;
    if (!st.tavolo.length && !ultima) st.scope[sq]++;
  } else {
    st.tavolo.push(c);
  }
  st.turno = (g + 1) & 3;
  if (ultima) {
    if (st.tavolo.length && st.ultimaPresa !== null) {
      st.prese[st.ultimaPresa].push(...st.tavolo);
      st.tavolo = [];
    }
    st.finita = true;
  }
}

function clona(st) {
  return {
    mani: [st.mani[0].slice(), st.mani[1].slice(), st.mani[2].slice(), st.mani[3].slice()],
    tavolo: st.tavolo.slice(),
    prese: [st.prese[0].slice(), st.prese[1].slice()],
    scope: st.scope.slice(),
    ultimaPresa: st.ultimaPresa,
    turno: st.turno,
    finita: st.finita
  };
}

/* ---------- punteggio ---------- */

/* Due sistemi.
 *   classico   — carte, denari, settebello, primiera, piu' le scope.
 *   quarantuno — ogni denaro preso vale un punto, il settebello ne vale uno
 *                in piu', e restano i classici carte, denari e primiera.
 *                Fanno 14 punti fissi a mano piu' le scope: si va a 41.
 */
const SISTEMI = {
  quarantuno: { obiettivi: [41, 61] },
  classico:   { obiettivi: [11, 16, 21] }
};

let SISTEMA = 'quarantuno';
function impostaSistema(s) { if (SISTEMI[s]) SISTEMA = s; }

function primieraDi(carte) {
  const best = [0, 0, 0, 0];
  for (const c of carte) {
    const p = PRIMIERA[val(c)];
    if (p > best[seme(c)]) best[seme(c)] = p;
  }
  return { totale: best[0] + best[1] + best[2] + best[3], perSeme: best };
}

function punteggioMano(st, sistema) {
  const sis = SISTEMI[sistema] ? sistema : SISTEMA;

  const sq = [0, 1].map(s => {
    const cs = st.prese[s];
    return {
      carte: cs.length,
      denari: cs.filter(c => seme(c) === 0).length,
      settebello: cs.includes(SETTEBELLO),
      primiera: primieraDi(cs),
      scope: st.scope[s],
      punti: 0,
      voci: []
    };
  });

  const assegna = (vincitore, nome) => {
    if (vincitore < 0) return;
    sq[vincitore].punti++;
    sq[vincitore].voci.push(nome);
  };

  /* a 41 ogni denaro preso e' gia' un punto per conto suo */
  if (sis === 'quarantuno') {
    for (const s of [0, 1]) {
      if (!sq[s].denari) continue;
      sq[s].punti += sq[s].denari;
      sq[s].voci.push(sq[s].denari + (sq[s].denari === 1 ? ' denaro' : ' denari'));
    }
  }

  assegna(sq[0].carte > sq[1].carte ? 0 : sq[1].carte > sq[0].carte ? 1 : -1, 'carte');
  assegna(sq[0].denari > sq[1].denari ? 0 : sq[1].denari > sq[0].denari ? 1 : -1,
          'più denari');
  assegna(sq[0].settebello ? 0 : sq[1].settebello ? 1 : -1, 'settebello');
  const p0 = sq[0].primiera.totale, p1 = sq[1].primiera.totale;
  assegna(p0 > p1 ? 0 : p1 > p0 ? 1 : -1, 'primiera');

  for (const s of [0, 1]) {
    if (sq[s].scope) {
      sq[s].punti += sq[s].scope;
      sq[s].voci.push(sq[s].scope === 1 ? '1 scopa' : sq[s].scope + ' scope');
    }
  }
  return sq;
}

/* differenza di punti dal punto di vista della squadra 0 */
function diffPunti(st) {
  const p = punteggioMano(st);
  return p[0].punti - p[1].punti;
}
