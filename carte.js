/* Disegno delle carte in stile piacentino (mazzo a semi spagnoli:
 * denari, coppe, spade dritte, bastoni).
 *
 * svgCarta(c)            -> carta intera, con i semi disposti come sul mazzo
 * svgCarta(c, true)      -> versione compatta per le carte piccole
 *
 * Tutto e' vettoriale su un riquadro 100x150, cosi' la stessa carta resta
 * leggibile sia grande in mano sia in miniatura.
 */

const COLORI = [
  { base: '#c08a1e', scuro: '#6f4c08', chiaro: '#f2d489' },  /* denari  */
  { base: '#b03a2e', scuro: '#6b1d15', chiaro: '#e8a79f' },  /* coppe   */
  { base: '#2b6ba8', scuro: '#173f5f', chiaro: '#b3cee5' },  /* spade   */
  { base: '#3f7a3a', scuro: '#1f4420', chiaro: '#a9cf95' }   /* bastoni */
];

const FONT = 'Georgia, "Times New Roman", serif';

/* ---------- i quattro semi, disegnati centrati sull'origine ---------- */

function simboloDenaro(k) {
  let petali = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    petali += '<circle cx="' + (Math.cos(a) * 7).toFixed(2) +
              '" cy="' + (Math.sin(a) * 7).toFixed(2) + '" r="1.9"/>';
  }
  return '<g stroke="' + k.scuro + '" stroke-width="1.6">' +
    '<circle cx="0" cy="0" r="15" fill="' + k.chiaro + '"/>' +
    '<circle cx="0" cy="0" r="10.5" fill="none" stroke-width="1.2"/>' +
    '<g fill="' + k.base + '" stroke="none">' + petali + '</g>' +
    '<circle cx="0" cy="0" r="3.6" fill="' + k.base + '" stroke-width="1.1"/>' +
    '</g>';
}

function simboloCoppa(k) {
  return '<g stroke="' + k.scuro + '" stroke-width="1.7" stroke-linejoin="round">' +
    '<ellipse cx="0" cy="16" rx="9" ry="3.2" fill="' + k.base + '"/>' +
    '<rect x="-2.3" y="8" width="4.6" height="8" fill="' + k.base + '"/>' +
    '<path d="M-11,-5 Q-11,12 0,12 Q11,12 11,-5 Z" fill="' + k.base + '"/>' +
    '<path d="M-12,-5 Q0,-11 12,-5 Q0,-1 -12,-5 Z" fill="' + k.chiaro + '"/>' +
    '<circle cx="0" cy="-13" r="3.1" fill="' + k.base + '"/>' +
    '</g>';
}

function simboloSpada(k) {
  return '<g stroke="' + k.scuro + '" stroke-width="1.6" stroke-linejoin="round">' +
    '<path d="M0,-18 L3.6,-10 L3.6,5 L-3.6,5 L-3.6,-10 Z" fill="' + k.chiaro + '"/>' +
    '<rect x="-10.5" y="4.6" width="21" height="3.8" rx="1.7" fill="' + k.base + '"/>' +
    '<rect x="-2.1" y="8.4" width="4.2" height="6" fill="' + k.base + '"/>' +
    '<circle cx="0" cy="16" r="3.3" fill="' + k.base + '"/>' +
    '</g>';
}

function simboloBastone(k) {
  return '<g stroke="' + k.scuro + '" stroke-width="1.6" stroke-linejoin="round">' +
    '<path d="M-3.6,-16 q3.6,-3.4 7.2,0 L6.6,13 q-6.6,3.6 -13.2,0 Z" fill="' + k.base + '"/>' +
    '<circle cx="-4.2" cy="-5" r="2.3" fill="' + k.chiaro + '"/>' +
    '<circle cx="4.4" cy="3.5" r="2.6" fill="' + k.chiaro + '"/>' +
    '</g>';
}

function simbolo(s) {
  const k = COLORI[s];
  return s === 0 ? simboloDenaro(k)
       : s === 1 ? simboloCoppa(k)
       : s === 2 ? simboloSpada(k)
       : simboloBastone(k);
}

/* ---------- disposizione dei semi sulle carte numerali ---------- */

const DISPOSIZIONI = {
  1:  { s: 1.95, p: [[50, 75]] },
  2:  { s: 1.10, p: [[50, 47], [50, 103]] },
  3:  { s: 0.98, p: [[50, 40], [50, 75], [50, 110]] },
  4:  { s: 0.98, p: [[32, 50], [68, 50], [32, 100], [68, 100]] },
  5:  { s: 0.86, p: [[32, 45], [68, 45], [50, 75], [32, 105], [68, 105]] },
  6:  { s: 0.78, p: [[31, 43], [69, 43], [31, 75], [69, 75], [31, 107], [69, 107]] },
  /* il sette porta i sei in due colonne piu' uno al centro, come sul mazzo */
  7:  { s: 0.66, p: [[29, 42], [71, 42], [29, 72], [50, 72], [71, 72], [29, 102], [71, 102]] }
};

/* ---------- figure ---------- */

function figura(v, k) {
  const t = 'stroke="' + k.scuro + '" stroke-width="1.9" stroke-linejoin="round" ' +
            'stroke-linecap="round" fill="' + k.base + '"';

  if (v === 10) {          /* re: corona e manto */
    return '<g ' + t + '>' +
      '<path d="M26,101 Q28,76 42,69 L58,69 Q72,76 74,101 Z"/>' +
      '<circle cx="50" cy="59" r="11"/>' +
      '<rect x="32" y="41" width="36" height="7" rx="2.4"/>' +
      '<path d="M33,42 L35,23 L43,34 L50,19 L57,34 L65,23 L67,42 Z" fill="' + k.chiaro + '"/>' +
      '<circle cx="35" cy="21" r="2.4" fill="' + k.base + '"/>' +
      '<circle cx="50" cy="17" r="2.6" fill="' + k.base + '"/>' +
      '<circle cx="65" cy="21" r="2.4" fill="' + k.base + '"/>' +
      '</g>';
  }

  if (v === 9) {           /* cavallo: cavallo di profilo con il cavaliere */
    return '<g ' + t + '>' +
      '<path d="M26,73 q-9,9 -7,22" fill="none" stroke="' + k.scuro + '" stroke-width="4.5"/>' +
      '<rect x="30" y="86" width="6.5" height="21" rx="2.6"/>' +
      '<rect x="55" y="86" width="6.5" height="21" rx="2.6"/>' +
      '<ellipse cx="46" cy="79" rx="21" ry="11"/>' +
      '<path d="M57,75 L65,53 L76,56 L69,79 Z"/>' +
      '<path d="M64,55 L83,49 L89,57 L78,63 L66,62 Z"/>' +
      '<path d="M67,51 L69,41 L75,50 Z"/>' +
      '<circle cx="76" cy="55" r="2.2" fill="' + k.scuro + '" stroke="none"/>' +
      '<circle cx="44" cy="43" r="7.5" fill="' + k.chiaro + '"/>' +
      '<path d="M36,52 L52,52 L56,74 L33,74 Z" fill="' + k.chiaro + '"/>' +
      '</g>';
  }

  /* fante: cappello piumato e veste */
  return '<g ' + t + '>' +
    '<path d="M34,105 L37,66 Q50,58 63,66 L66,105 Z"/>' +
    '<rect x="35.5" y="86" width="29" height="5" fill="' + k.chiaro + '"/>' +
    '<circle cx="50" cy="48" r="10"/>' +
    '<path d="M36,43 Q50,26 64,43 Z" fill="' + k.chiaro + '"/>' +
    '<path d="M60,38 Q72,32 78,18 Q74,33 63,42 Z" fill="' + k.chiaro + '"/>' +
    '<path d="M44,60 L50,71 L56,60" fill="none" stroke="' + k.scuro + '" stroke-width="2.2"/>' +
    '</g>';
}

/* ---------- assemblaggio ---------- */

const _cache = new Map();

function svgCarta(c, compatta) {
  const chiave = c + (compatta ? 'c' : 'g');
  if (_cache.has(chiave)) return _cache.get(chiave);

  const v = val(c), s = seme(c);
  const k = COLORI[s];
  const sig = VAL_SIGLA[v];
  const sim = simbolo(s);

  let dentro;
  if (compatta) {
    dentro =
      '<text x="50" y="62" font-family="' + FONT + '" font-size="46" font-weight="700" ' +
      'text-anchor="middle" fill="' + k.base + '">' + sig + '</text>' +
      '<g transform="translate(50,104) scale(1.45)">' + sim + '</g>';
  } else {
    const indice =
      '<text x="12" y="25" font-family="' + FONT + '" font-size="20" font-weight="700" ' +
      'fill="' + k.base + '">' + sig + '</text>' +
      '<g transform="translate(15.5,37) scale(0.3)">' + sim + '</g>';

    const corpo = v <= 7
      ? DISPOSIZIONI[v].p.map(([x, y]) =>
          '<g transform="translate(' + x + ',' + y + ') scale(' +
          DISPOSIZIONI[v].s + ')">' + sim + '</g>').join('')
      : figura(v, k) + '<g transform="translate(50,124) scale(0.62)">' + sim + '</g>';

    dentro = corpo + indice + '<g transform="rotate(180 50 75)">' + indice + '</g>';
  }

  const svg =
    '<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" ' +
    'preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
    '<rect x="0.9" y="0.9" width="98.2" height="148.2" rx="7" fill="#fdfbf5" ' +
    'stroke="#c5bda6" stroke-width="1.8"/>' +
    (compatta ? '' :
      '<rect x="5.5" y="5.5" width="89" height="139" rx="4" fill="none" stroke="' +
      k.base + '" stroke-width="0.9" opacity="0.38"/>') +
    dentro +
    '</svg>';

  _cache.set(chiave, svg);
  return svg;
}
