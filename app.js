/* Interfaccia e svolgimento della partita.
 * Sud (giocatore 0) e' l'utente, Nord (2) e' il compagno, Est (1) e Ovest (3)
 * sono gli avversari. Il giro e' antiorario: Sud -> Est -> Nord -> Ovest.
 */

const NOMI = ['Sud', 'Est', 'Nord', 'Ovest'];
const SIGLE = ['S', 'E', 'N', 'O'];

const APP = {
  st: null,
  punti: [0, 0],
  mano: 0,
  mazziere: 3,
  opz: { livello: 'campione', ritardo: 900, sistema: 'quarantuno', obiettivo: 41,
         checkpoint: true },
  sbirciate: 0,
  memoria: [],
  checkFatto: false,
  risolviMossa: null,
  stat: { tot: 0, ok: 0 },
  ultimoLog: null
};

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- memoria locale ---------- */

function caricaStat() {
  try {
    const s = JSON.parse(localStorage.getItem('scopone.stat') || 'null');
    if (s) APP.stat = s;
    const o = JSON.parse(localStorage.getItem('scopone.opz') || 'null');
    if (o) Object.assign(APP.opz, o);
  } catch (e) { /* localStorage non disponibile */ }
  if (!SISTEMI[APP.opz.sistema]) APP.opz.sistema = 'quarantuno';
  impostaSistema(APP.opz.sistema);
}
function salvaStat() {
  try {
    localStorage.setItem('scopone.stat', JSON.stringify(APP.stat));
    localStorage.setItem('scopone.opz', JSON.stringify(APP.opz));
  } catch (e) { /* ignora */ }
}

/* ---------- costruzione elementi ---------- */

function elCarta(c, cls) {
  const d = document.createElement('div');
  d.className = 'carta' + (cls ? ' ' + cls : '');
  d.dataset.seme = seme(c);
  d.dataset.id = c;
  d.title = nomeCartaEsteso(c);
  d.innerHTML = svgCarta(c, /piccola/.test(cls || ''));
  return d;
}

function elDorso() {
  const d = document.createElement('div');
  d.className = 'dorso';
  return d;
}

/* ---------- disegno del tavolo ---------- */

function render() {
  const st = APP.st;
  if (!st) return;

  /* mani avversarie e del compagno: solo dorsi */
  for (const g of [1, 2, 3]) {
    const box = $('#dorsi' + g);
    box.innerHTML = '';
    for (let i = 0; i < st.mani[g].length; i++) box.appendChild(elDorso());
  }

  /* mia mano */
  const mia = $('#mia');
  mia.innerHTML = '';
  const mioTurno = st.turno === 0 && !st.finita && APP.risolviMossa;
  mia.classList.toggle('inattiva', !mioTurno);
  for (const c of st.mani[0]) {
    const el = elCarta(c, 'grande' + (mioTurno ? ' cliccabile' : ''));
    mia.appendChild(el);
  }

  /* tavolo */
  const tav = $('#tavolo');
  tav.innerHTML = '';
  for (const c of st.tavolo) tav.appendChild(elCarta(c));

  /* ultime giocate del giro in corso */
  const ult = $('#ultime');
  ult.innerHTML = '';
  const n = st.storia.length;
  const inizio = Math.floor((n - 1) / 4) * 4;
  for (const m of st.storia.slice(Math.max(0, inizio), n)) {
    const g = document.createElement('div');
    g.className = 'giocata' + (m.g === 0 ? ' mia' : '');
    const chi = document.createElement('div');
    chi.className = 'chi';
    chi.textContent = NOMI[m.g];
    g.appendChild(chi);
    const riga = document.createElement('div');
    riga.className = 'riga';
    riga.appendChild(elCarta(m.carta, 'piccola'));
    if (m.presa) {
      const fr = document.createElement('span');
      fr.className = 'freccia';
      fr.textContent = '◄';
      riga.appendChild(fr);
      for (const c of m.presa) riga.appendChild(elCarta(c, 'piccola spenta'));
    }
    g.appendChild(riga);
    if (m.scopa) {
      const s = document.createElement('div');
      s.className = 'scopa';
      s.textContent = 'SCOPA';
      g.appendChild(s);
    }
    ult.appendChild(g);
  }

  /* posti attivi */
  for (const g of [0, 1, 2, 3]) {
    $('#posto' + g).classList.toggle('attivo', st.turno === g && !st.finita);
  }

  /* pannello */
  $('#pt0').textContent = APP.punti[0];
  $('#pt1').textContent = APP.punti[1];
  $('#statoMano').textContent = 'Mano ' + APP.mano;
  $('#iMano').textContent = APP.mano;
  $('#iMazziere').textContent = NOMI[st.mazziere];
  $('#iTavolo').textContent = st.tavolo.length;
  $('#iTurno').textContent = st.finita ? '—' : NOMI[st.turno];
  $('#bCarte').textContent = st.prese[0].length + ' / ' + st.prese[1].length;
  $('#bScope').textContent = st.scope[0] + ' / ' + st.scope[1];
  $('#mAcc').textContent = APP.stat.tot
    ? Math.round(100 * APP.stat.ok / APP.stat.tot) + '%'
    : '—';
  $('#mTot').textContent = APP.stat.tot;
  $('#notaSbircia').textContent = APP.sbirciate
    ? 'Sbirciate in questa mano: ' + APP.sbirciate + ' (finiscono nel log).'
    : 'Aiuto registrato nel log: usalo il meno possibile.';
  $('#aCount').textContent = leggiArchivio().length;
}

function messaggio(t) { $('#messaggio').textContent = t || ''; }

/* ---------- finestre ---------- */

function apriFinestra(html) {
  $('#velo').classList.remove('nascosto');
  const f = $('#finestra');
  f.innerHTML = html;
  f.classList.remove('nascosto');
  return f;
}
function chiudiFinestra() {
  $('#velo').classList.add('nascosto');
  $('#finestra').classList.add('nascosto');
  $('#finestra').innerHTML = '';
}

/* ---------- mossa dell'utente ---------- */

function attendiMossa() {
  return new Promise(res => { APP.risolviMossa = res; render(); });
}

function concludiMossa(m) {
  const r = APP.risolviMossa;
  if (!r) return;
  APP.risolviMossa = null;
  r(m);
}

function scegliPresa(c, opzioni) {
  const righe = opzioni.map((op, i) =>
    '<div class="scelta" data-i="' + i + '">' +
      op.map(x => '<div class="carta piccola">' + svgCarta(x, true) + '</div>').join('') +
      '<span class="desc">' + op.map(nomeCarta).join(' + ') + '</span>' +
    '</div>').join('');

  const f = apriFinestra(
    '<h2>Con il ' + nomeCartaEsteso(c) + ' puoi prendere:</h2>' +
    '<p class="sottotitolo">Scegli la presa. Ricorda che la scelta cambia la parità dei ranghi rimasti.</p>' +
    '<div class="scelte">' + righe + '</div>' +
    '<div class="azioni"><button class="secondario" id="annulla" style="width:auto">Annulla</button></div>'
  );

  f.querySelectorAll('.scelta').forEach(el => {
    el.onclick = () => {
      chiudiFinestra();
      concludiMossa({ carta: c, presa: opzioni[+el.dataset.i] });
    };
  });
  f.querySelector('#annulla').onclick = () => { chiudiFinestra(); render(); };
}

/* ---------- controllo memoria ---------- */

function generaDomande(st) {
  const uscite = st.tavolo.concat(st.prese[0], st.prese[1]);
  const dom = [];

  dom.push({
    testo: 'Quanti <b>denari</b> sono già usciti?',
    max: 10,
    giusta: uscite.filter(c => seme(c) === 0).length,
    chiave: 'denari usciti'
  });

  const conta = {};
  for (let v = 1; v <= 10; v++) conta[v] = uscite.filter(c => val(c) === v).length;
  let cand = [];
  for (let v = 1; v <= 10; v++) if (conta[v] >= 1 && conta[v] <= 3) cand.push(v);
  if (!cand.length) cand = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const v = cand[Math.floor(Math.random() * cand.length)];
  dom.push({
    testo: 'Quanti <b>' + VAL_NOME[v] + '</b> sono già usciti?',
    max: 4,
    giusta: conta[v],
    chiave: VAL_NOME[v] + ' usciti'
  });

  dom.push({
    testo: 'Il <b>settebello</b> è già uscito?',
    si: true,
    giusta: uscite.includes(SETTEBELLO) ? 1 : 0,
    chiave: 'settebello uscito'
  });

  return dom;
}

function checkpointMemoria() {
  const dom = generaDomande(APP.st);
  const risposte = new Array(dom.length).fill(null);

  const html =
    '<h2>Controllo memoria</h2>' +
    '<p class="sottotitolo">Ti restano 3 carte. Rispondi senza guardare indietro: ' +
    'l\'esito te lo dico a fine mano, così non ti aiuta a giocare.</p>' +
    dom.map((d, i) =>
      '<div class="domanda" data-d="' + i + '">' +
        '<div class="testo">' + d.testo + '</div>' +
        '<div class="opzioni">' +
          (d.si
            ? '<button data-v="1">Sì</button><button data-v="0">No</button>'
            : Array.from({ length: d.max + 1 }, (_, k) => '<button data-v="' + k + '">' + k + '</button>').join('')) +
        '</div>' +
      '</div>').join('') +
    '<div class="azioni"><button id="ok" disabled>Continua</button></div>';

  const f = apriFinestra(html);
  const ok = f.querySelector('#ok');

  f.querySelectorAll('.domanda').forEach(box => {
    const i = +box.dataset.d;
    box.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        box.querySelectorAll('button').forEach(x => x.classList.remove('scelto'));
        b.classList.add('scelto');
        risposte[i] = +b.dataset.v;
        ok.disabled = risposte.some(r => r === null);
      };
    });
  });

  return new Promise(res => {
    ok.onclick = () => {
      dom.forEach((d, i) => {
        const giusto = risposte[i] === d.giusta;
        APP.memoria.push({
          domanda: d.chiave, risposta: risposte[i], corretta: d.giusta, esatta: giusto
        });
        APP.stat.tot++;
        if (giusto) APP.stat.ok++;
      });
      salvaStat();
      chiudiFinestra();
      render();
      res();
    };
  });
}

/* ---------- sbircia ---------- */

function sbircia() {
  const st = APP.st;
  APP.sbirciate++;
  const uscite = new Set(st.tavolo.concat(st.prese[0], st.prese[1]));

  let griglia = '';
  for (let s = 0; s < 4; s++) {
    griglia += '<h3>' + SEMI_NOME[s] + '</h3><div class="griglia40">';
    for (let v = 1; v <= 10; v++) {
      const c = carta(v, s);
      griglia += '<div class="carta piccola' + (uscite.has(c) ? '' : ' spenta') + '">' +
        svgCarta(c, true) + '</div>';
    }
    griglia += '</div>';
  }

  const f = apriFinestra(
    '<h2>Carte già uscite</h2>' +
    '<p class="sottotitolo">In evidenza quelle già giocate; in ombra quelle ancora in mano a qualcuno ' +
    '(comprese le tue). Sbirciate in questa mano: ' + APP.sbirciate + '.</p>' +
    griglia +
    '<div class="azioni"><button id="ok">Chiudi</button></div>'
  );
  f.querySelector('#ok').onclick = () => { chiudiFinestra(); render(); };
}

/* ---------- fine mano ---------- */

function trascrizione(st) {
  const righe = [];
  for (const m of st.storia) {
    let s = m.presa_num + '. ' + NOMI[m.g] + ': ' + nomeCarta(m.carta);
    s += m.presa ? ' prende ' + m.presa.map(nomeCarta).join('+') : ' (butta)';
    if (m.scopa) s += '  <<< SCOPA';
    s += '   | tavolo prima: ' + (m.tavoloPrima.map(nomeCarta).join(' ') || 'vuoto');
    s += ' | aveva in mano: ' + m.inMano.map(nomeCarta).join(' ');
    righe.push(s);
  }
  if (st.rastrello) {
    righe.push('Ultima presa: ' + st.rastrello.carte.map(nomeCarta).join(' ') +
      ' vanno a ' + (st.rastrello.squadra === 0 ? 'NOI' : 'LORO'));
  }
  return righe.join('\n');
}

function costruisciLog(st, p) {
  const mani = {};
  for (const g of [0, 1, 2, 3]) mani[NOMI[g]] = st.maniIniziali[g].map(nomeCarta);
  return {
    versione: 1,
    data: new Date().toISOString(),
    mano: APP.mano,
    seed: st.seed,
    sistema_punteggio: APP.opz.sistema === 'quarantuno'
      ? 'a 41: ogni denaro 1 punto, settebello 1 in più, poi carte, più denari e primiera, più le scope'
      : 'classico: carte, denari, settebello, primiera, più le scope',
    obiettivo: APP.opz.obiettivo,
    livello_avversari: APP.opz.livello,
    mazziere: NOMI[st.mazziere],
    primo_di_mano: NOMI[st.primo],
    squadre: { NOI: 'Sud (utente) + Nord (bot)', LORO: 'Est + Ovest (bot)' },
    mani_iniziali: mani,
    trascrizione: trascrizione(st),
    mosse: st.storia.map(m => ({
      presa_num: m.presa_num,
      giocatore: NOMI[m.g],
      squadra: m.squadra === 0 ? 'NOI' : 'LORO',
      carta: nomeCarta(m.carta),
      presa: m.presa ? m.presa.map(nomeCarta) : null,
      scopa: m.scopa,
      tavolo_prima: m.tavoloPrima.map(nomeCarta),
      tavolo_dopo: m.tavoloDopo.map(nomeCarta),
      aveva_in_mano: m.inMano.map(nomeCarta)
    })),
    ultima_presa: st.rastrello
      ? { squadra: st.rastrello.squadra === 0 ? 'NOI' : 'LORO', carte: st.rastrello.carte.map(nomeCarta) }
      : null,
    punteggio_mano: {
      NOI: { carte: p[0].carte, denari: p[0].denari, settebello: p[0].settebello,
             primiera: p[0].primiera.totale, scope: p[0].scope, punti: p[0].punti, voci: p[0].voci },
      LORO: { carte: p[1].carte, denari: p[1].denari, settebello: p[1].settebello,
              primiera: p[1].primiera.totale, scope: p[1].scope, punti: p[1].punti, voci: p[1].voci }
    },
    punti_partita: { NOI: APP.punti[0], LORO: APP.punti[1] },
    controllo_memoria: APP.memoria,
    sbirciate: APP.sbirciate
  };
}

/* in locale il server scrive il file da solo; su GitHub Pages non esiste
   nessun server, quindi si archivia nel browser e si copia a mano */
const LOCALE = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

async function salvaLog(dati) {
  if (!LOCALE) return null;
  try {
    const r = await fetch('log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dati)
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.file || null;
  } catch (e) { return null; }
}

/* versione testuale: e' quella da incollare in chat per l'analisi.
   Contiene tutto il necessario ed e' molto piu' compatta del json. */
function testoAnalisi(d) {
  const r = [];
  r.push('SCOPONE SCIENTIFICO — mano ' + d.mano + ' (avversari: ' + d.livello_avversari + ')');
  r.push('Punteggio ' + d.sistema_punteggio + '. Partita a ' + d.obiettivo + '.');
  r.push('Mazziere: ' + d.mazziere + '. Primo di mano: ' + d.primo_di_mano + '.');
  r.push('NOI = Sud (io) + Nord.  LORO = Est + Ovest.');
  r.push('');
  r.push('MANI INIZIALI');
  for (const n of NOMI) {
    r.push('  ' + (n + (n === 'Sud' ? ' (io)' : '')).padEnd(11) + d.mani_iniziali[n].join(' '));
  }
  r.push('');
  r.push('SVOLGIMENTO');
  r.push(d.trascrizione);
  r.push('');
  r.push('PUNTEGGIO');
  for (const s of ['NOI', 'LORO']) {
    const p = d.punteggio_mano[s];
    r.push('  ' + s.padEnd(5) + 'carte ' + p.carte + ', denari ' + p.denari +
           ', settebello ' + (p.settebello ? 'sì' : 'no') + ', primiera ' + p.primiera +
           ', scope ' + p.scope + '  →  ' + p.punti + ' punti');
  }
  for (const s of ['NOI', 'LORO']) {
    const p = d.punteggio_mano[s];
    r.push('    (' + s.toLowerCase() + ': ' + (p.voci.length ? p.voci.join(', ') : 'niente') + ')');
  }
  r.push('  Partita: NOI ' + d.punti_partita.NOI + ' – LORO ' + d.punti_partita.LORO);
  if (d.controllo_memoria.length) {
    r.push('');
    r.push('CONTROLLO MEMORIA');
    for (const m of d.controllo_memoria) {
      r.push('  ' + (m.esatta ? 'esatta  ' : 'sbagliata ') + m.domanda +
             ': risposto ' + m.risposta + ', corretto ' + m.corretta);
    }
  }
  r.push('Sbirciate: ' + d.sbirciate);
  return r.join('\n');
}

function archivia(dati) {
  let a = [];
  try { a = JSON.parse(localStorage.getItem('scopone.archivio') || '[]'); } catch (e) { a = []; }
  a.push(dati);
  while (a.length > 25) a.shift();
  for (;;) {
    try { localStorage.setItem('scopone.archivio', JSON.stringify(a)); break; }
    catch (e) {
      if (a.length <= 1) return 0;         /* spazio finito davvero */
      a = a.slice(Math.ceil(a.length / 2));
    }
  }
  return a.length;
}

function leggiArchivio() {
  try { return JSON.parse(localStorage.getItem('scopone.archivio') || '[]'); }
  catch (e) { return []; }
}

async function negliAppunti(testo) {
  try {
    await navigator.clipboard.writeText(testo);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = testo;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}

function scarica(nome, testo, tipo) {
  const b = new Blob([testo], { type: tipo || 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function rigaPunti(et, a, b, vincitore) {
  const c0 = vincitore === 0 ? ' class="vinto"' : '';
  const c1 = vincitore === 1 ? ' class="vinto"' : '';
  return '<tr><th>' + et + '</th><td' + c0 + '>' + a + '</td><td' + c1 + '>' + b + '</td></tr>';
}

async function fineMano() {
  const st = APP.st;
  const p = punteggioMano(st);
  APP.punti[0] += p[0].punti;
  APP.punti[1] += p[1].punti;

  const dati = costruisciLog(st, p);
  const file = await salvaLog(dati);
  const inArchivio = archivia(dati);
  APP.ultimoLog = dati;
  render();

  const vinc = (a, b) => a > b ? 0 : b > a ? 1 : -1;
  const a41 = APP.opz.sistema === 'quarantuno';

  let tab = '<table class="punti"><tr><th></th><th>Noi</th><th>Loro</th></tr>';
  tab += rigaPunti('Carte', p[0].carte, p[1].carte, vinc(p[0].carte, p[1].carte));
  tab += rigaPunti(a41 ? 'Denari (1 punto ciascuno)' : 'Denari',
    p[0].denari, p[1].denari, vinc(p[0].denari, p[1].denari));
  tab += rigaPunti('Settebello', p[0].settebello ? '✓' : '—', p[1].settebello ? '✓' : '—',
    p[0].settebello ? 0 : 1);
  tab += rigaPunti('Primiera', p[0].primiera.totale, p[1].primiera.totale,
    vinc(p[0].primiera.totale, p[1].primiera.totale));
  tab += rigaPunti('Scope', p[0].scope, p[1].scope, vinc(p[0].scope, p[1].scope));
  tab += '<tr class="totale"><th>Punti della mano</th><td>' + p[0].punti + '</td><td>' + p[1].punti + '</td></tr>';
  tab += '<tr class="totale"><th>Partita (a ' + APP.opz.obiettivo + ')</th><td>' +
    APP.punti[0] + '</td><td>' + APP.punti[1] + '</td></tr>';
  tab += '</table>';

  tab += '<p class="nota">' +
    ['Noi', 'Loro'].map((n, i) => '<b>' + n + ' ' + p[i].punti + '</b>: ' +
      (p[i].voci.length ? p[i].voci.join(', ') : 'niente')).join(' &nbsp;·&nbsp; ') +
    '</p>';

  let mem = '';
  if (APP.memoria.length) {
    mem = '<h3>Controllo memoria</h3><div class="esito">' +
      APP.memoria.map(m =>
        '<div>' + (m.esatta ? '<span class="ok">✓</span>' : '<span class="ko">✗</span>') +
        ' ' + m.domanda + ': hai detto <b>' + (m.domanda === 'settebello uscito' ? (m.risposta ? 'sì' : 'no') : m.risposta) +
        '</b>' + (m.esatta ? '' : ', erano <b>' +
          (m.domanda === 'settebello uscito' ? (m.corretta ? 'sì' : 'no') : m.corretta) + '</b>') +
        '</div>').join('') + '</div>';
  }

  const finita = APP.punti[0] >= APP.opz.obiettivo || APP.punti[1] >= APP.opz.obiettivo;
  const pareggio = APP.punti[0] === APP.punti[1];

  const f = apriFinestra(
    '<h2>Mano ' + APP.mano + ' — conteggio</h2>' +
    tab + mem +
    '<h3>Per farmi analizzare la mano</h3>' +
    (file
      ? '<p class="percorso">~/Progetti/scopone-coach/logs/' + file + '</p>' +
        '<p class="nota">Dimmi «analizza l\'ultima mano» e leggo questo file.</p>'
      : '<p class="nota">Copia il resoconto e incollalo in chat: contiene le quattro mani, ' +
        'tutte le giocate e il punteggio. Restano salvate le ultime ' + inArchivio +
        ' mani, anche se chiudi la pagina.</p>') +
    '<div class="azioni" style="justify-content:flex-start">' +
      '<button class="secondario" id="copia" style="width:auto">Copia il resoconto</button>' +
      '<button class="secondario" id="scarica" style="width:auto">Scarica</button>' +
    '</div>' +
    '<div class="azioni">' +
      '<button class="secondario" id="mostraMani" style="width:auto">Mostra le mani</button>' +
      '<button id="avanti">' + (finita && !pareggio ? 'Fine partita' : 'Mano successiva') + '</button>' +
    '</div>'
  );

  const bCopia = f.querySelector('#copia');
  bCopia.onclick = async () => {
    const ok = await negliAppunti(testoAnalisi(dati));
    bCopia.textContent = ok ? 'Copiato ✓' : 'Non riesco a copiare';
  };
  f.querySelector('#scarica').onclick = () =>
    scarica('scopone-mano' + APP.mano + '.txt', testoAnalisi(dati));

  f.querySelector('#mostraMani').onclick = () => {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Mani iniziali</h3>' + [0, 1, 2, 3].map(g =>
      '<p><b>' + NOMI[g] + '</b>: ' + st.maniIniziali[g].map(nomeCarta).join('  ') + '</p>').join('');
    f.querySelector('.azioni').before(box);
    f.querySelector('#mostraMani').remove();
  };

  f.querySelector('#avanti').onclick = () => {
    chiudiFinestra();
    if (finita && !pareggio) finePartita();
    else iniziaMano();
  };
}

function finePartita() {
  const noi = APP.punti[0] > APP.punti[1];
  apriFinestra(
    '<h2>' + (noi ? 'Partita vinta' : 'Partita persa') + '</h2>' +
    '<p class="sottotitolo">Risultato finale ' + APP.punti[0] + ' – ' + APP.punti[1] +
    ' in ' + APP.mano + ' mani.</p>' +
    '<div class="azioni"><button id="ok">Nuova partita</button></div>'
  ).querySelector('#ok').onclick = () => { chiudiFinestra(); nuovaPartita(); };
}

/* ---------- svolgimento ---------- */

async function ciclo() {
  const st = APP.st;
  while (!st.finita) {
    if (st.turno === 0) {
      if (APP.opz.checkpoint && !APP.checkFatto && st.mani[0].length === 3) {
        APP.checkFatto = true;
        await checkpointMemoria();
      }
      messaggio('Tocca a te.');
      const m = await attendiMossa();
      messaggio('');
      gioca(st, m.carta, m.presa);
      render();
    } else {
      render();
      await sleep(Math.round(APP.opz.ritardo * 0.35));
      const m = scegliMossa(st, st.turno, APP.opz.livello);
      gioca(st, m.carta, m.presa);
      render();
      await sleep(Math.round(APP.opz.ritardo * 0.65));
    }
  }
  render();
  messaggio('Mano finita.');
  await sleep(900);
  fineMano();
}

function iniziaMano() {
  APP.mano++;
  APP.mazziere = (APP.mazziere + 1) % 4;
  APP.sbirciate = 0;
  APP.memoria = [];
  APP.checkFatto = false;
  APP.risolviMossa = null;
  const seed = (Math.random() * 0xffffffff) >>> 0;
  APP.st = nuovaMano(seed, APP.mazziere);
  messaggio('');
  render();
  ciclo();
}

function nuovaPartita() {
  APP.punti = [0, 0];
  APP.mano = 0;
  APP.mazziere = 3;
  iniziaMano();
}

/* ---------- eventi ---------- */

function collega() {
  $('#mia').addEventListener('click', e => {
    const el = e.target.closest('.carta');
    if (!el || !APP.risolviMossa) return;
    const c = +el.dataset.id;
    const op = prese(c, APP.st.tavolo);
    if (op.length <= 1) concludiMossa({ carta: c, presa: op[0] || null });
    else scegliPresa(c, op);
  });

  $('#btnSbircia').onclick = () => { if (APP.st && !APP.st.finita) sbircia(); };

  $('#btnNuovaMano').onclick = () => {
    if (!APP.st || APP.st.finita) return;
    if (!confirm('Abbandonare la mano in corso? Non verrà conteggiata.')) return;
    APP.st.finita = true;
    APP.risolviMossa = null;
    iniziaMano();
  };

  $('#btnNuovaPartita').onclick = () => {
    if (!confirm('Ricominciare da 0 a 0?')) return;
    APP.risolviMossa = null;
    nuovaPartita();
  };

  const testoArchivio = () => leggiArchivio().map(testoAnalisi)
    .join('\n\n' + '='.repeat(60) + '\n\n');

  const bArch = $('#btnCopiaArchivio');
  bArch.onclick = async () => {
    const a = leggiArchivio();
    if (!a.length) { bArch.textContent = 'Archivio vuoto'; return; }
    const ok = await negliAppunti(testoArchivio());
    bArch.textContent = ok ? 'Copiate ' + a.length + ' mani ✓' : 'Non riesco a copiare';
    setTimeout(() => { bArch.textContent = "Copia tutto per l'analisi"; }, 2500);
  };

  $('#btnScaricaArchivio').onclick = () => {
    if (!leggiArchivio().length) return;
    scarica('scopone-archivio.txt', testoArchivio());
  };

  $('#btnSvuotaArchivio').onclick = () => {
    if (!confirm("Cancellare l'archivio delle mani salvate?")) return;
    try { localStorage.removeItem('scopone.archivio'); } catch (e) { /* ignora */ }
    render();
  };

  const bind = (id, chiave, num) => {
    const el = $(id);
    /* se il valore salvato non e' fra quelli previsti si torna al predefinito,
       altrimenti il menu resterebbe vuoto */
    const predefinito = num ? +el.value : el.value;
    const validi = [...el.options].map(o => (num ? +o.value : o.value));
    if (validi.indexOf(APP.opz[chiave]) < 0) APP.opz[chiave] = predefinito;
    el.value = APP.opz[chiave];
    el.onchange = () => {
      APP.opz[chiave] = num ? +el.value : el.value;
      salvaStat();
      render();
    };
  };
  bind('#optLivello', 'livello', false);
  bind('#optRitardo', 'ritardo', true);

  /* i traguardi possibili dipendono dal sistema di punteggio */
  const aggiornaObiettivi = () => {
    const sel = $('#optObiettivo');
    const lista = SISTEMI[APP.opz.sistema].obiettivi;
    sel.innerHTML = lista.map(v => '<option value="' + v + '">' + v + ' punti</option>').join('');
    if (lista.indexOf(APP.opz.obiettivo) < 0) APP.opz.obiettivo = lista[0];
    sel.value = APP.opz.obiettivo;
  };

  const selSis = $('#optSistema');
  if (!SISTEMI[APP.opz.sistema]) APP.opz.sistema = 'quarantuno';
  selSis.value = APP.opz.sistema;
  aggiornaObiettivi();
  bind('#optObiettivo', 'obiettivo', true);

  selSis.onchange = () => {
    const nuovo = selSis.value;
    const iniziata = APP.punti[0] || APP.punti[1] || APP.mano > 1;
    if (iniziata && !confirm('Cambiare il punteggio azzera la partita in corso. Procedo?')) {
      selSis.value = APP.opz.sistema;
      return;
    }
    APP.opz.sistema = nuovo;
    impostaSistema(nuovo);
    aggiornaObiettivi();
    salvaStat();
    APP.risolviMossa = null;
    nuovaPartita();
  };

  const chk = $('#optCheckpoint');
  chk.checked = APP.opz.checkpoint;
  chk.onchange = () => { APP.opz.checkpoint = chk.checked; salvaStat(); };
}

caricaStat();
collega();
nuovaPartita();
