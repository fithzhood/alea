/* ==========================================================================
   Alea — un dado con temi, storico e giro senza ripetizioni.
   ========================================================================== */
(function () {
  'use strict';

  // ---- versione: dal ?v=N con cui e' stato caricato lo script ----------
  const VER = ((document.currentScript && document.currentScript.src || '').match(/\?v=\d+/) || [''])[0];
  const VERSIONE = (VER.match(/\d+/) || ['dev'])[0];

  const CHIAVE = 'alea.stato';
  const MAX_STORICO = 400;

  // ---- i temi: nome, sottotitolo e le parole che cambiano con il tema ---
  const TEMI = {
    metal:   { nome: 'Heavy Metal', sotto: 'acciaio, fuoco e borchie', colore: '#0b0b0d',
               lancia: 'ROLL!', max: 'CRITICO ⚡', min: '…fail', giro: 'GIRO COMPLETO' },
    fantasy: { nome: 'High Fantasy', sotto: 'oro, smeraldo e pergamena', colore: '#0e1a2b',
               lancia: 'Getta il dado', max: 'Colpo critico!', min: 'Fallimento critico…', giro: 'Il ciclo è compiuto' },
    scifi:   { nome: 'Sci-Fi', sotto: 'HUD ciano su blu notte', colore: '#04070f',
               lancia: 'ESEGUI', max: 'VALORE MASSIMO', min: 'VALORE MINIMO', giro: 'SEQUENZA COMPLETATA' },
    arcade:  { nome: 'Arcade', sotto: 'cabinato anni ottanta', colore: '#06030f',
               lancia: 'PLAY', max: 'PERFECT!', min: 'MISS…', giro: 'STAGE CLEAR!' },
    casino:  { nome: 'Casinò', sotto: 'panno verde e neon', colore: '#0b3d23',
               lancia: 'Punta!', max: 'Jackpot!', min: 'Vince il banco…', giro: 'Giro completo' },
    pirati:  { nome: 'Pirati', sotto: 'pergamena, legno e monete', colore: '#6b4423',
               lancia: 'Tira, marinaio', max: 'Tesoro!', min: 'In fondo al mare…', giro: 'Tutti a bordo!' },
    horror:  { nome: 'Horror', sotto: 'nero, sangue e macchina da scrivere', colore: '#050505',
               lancia: 'Osa…', max: 'Sopravvissuto', min: 'È finita…', giro: 'Il cerchio è chiuso' },
    candy:   { nome: 'Candy', sotto: 'pastello, bolle e zucchero', colore: '#ffe4f1',
               lancia: 'Lancia!', max: 'Dolcissimo!', min: 'Ops…', giro: 'Giro completo ♡' }
  };
  const ORDINE_TEMI = ['metal', 'fantasy', 'scifi', 'arcade', 'casino', 'pirati', 'horror', 'candy'];
  const FACCE_PRESET = [4, 6, 8, 10, 12, 20, 100];

  // ---- stato -----------------------------------------------------------
  const S = {
    tema: 'metal',
    facce: 20,
    escl: false,
    suono: false,
    storico: [],      // {v, f} dal piu' recente
    pool: [],         // valori ancora da estrarre nel giro corrente (solo in esclusione)
    usciti: [],       // valori usciti nel giro corrente
    cicloPieno: false // il giro si e' appena chiuso: la griglia resta piena fino al prossimo lancio
  };

  function carica() {
    try {
      const raw = localStorage.getItem(CHIAVE);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (TEMI[o.tema]) S.tema = o.tema;
      if (Number.isInteger(o.facce) && o.facce >= 2 && o.facce <= 9999) S.facce = o.facce;
      S.escl = !!o.escl;
      S.suono = o.suono === 'on';
      if (Array.isArray(o.storico)) S.storico = o.storico.filter(r => r && Number.isInteger(r.v) && Number.isInteger(r.f)).slice(0, MAX_STORICO);
      if (Array.isArray(o.pool)) S.pool = o.pool.filter(Number.isInteger);
      if (Array.isArray(o.usciti)) S.usciti = o.usciti.filter(Number.isInteger);
      S.cicloPieno = !!o.cicloPieno;
    } catch (e) { /* stato illeggibile: si riparte puliti */ }
    // coerenza: pool e usciti devono coprire esattamente 1..facce
    if (S.escl && !cicloCoerente()) nuovoCiclo();
  }
  function salva() {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify({
        tema: S.tema, facce: S.facce, escl: S.escl, suono: S.suono ? 'on' : 'off',
        storico: S.storico, pool: S.pool, usciti: S.usciti, cicloPieno: S.cicloPieno
      }));
    } catch (e) { /* niente spazio: pazienza */ }
  }
  function cicloCoerente() {
    if (S.pool.length + S.usciti.length !== S.facce) return false;
    const tutti = new Set([...S.pool, ...S.usciti]);
    if (tutti.size !== S.facce) return false;
    for (const v of tutti) if (v < 1 || v > S.facce) return false;
    return true;
  }
  function tuttiIValori() { const a = []; for (let i = 1; i <= S.facce; i++) a.push(i); return a; }
  function nuovoCiclo() { S.pool = tuttiIValori(); S.usciti = []; S.cicloPieno = false; }

  // ---- casualita' ------------------------------------------------------
  function casuale(n) { // intero in [0, n)
    if (window.crypto && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      const limite = Math.floor(0x100000000 / n) * n;
      let x;
      do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limite);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }

  // ---- elementi --------------------------------------------------------
  const $ = id => document.getElementById(id);
  const el = {
    arena: $('arena'), avviso: $('avviso'), dado: $('dado'), dadoNum: $('dadoNum'), esito: $('esito'),
    btnLancia: $('btnLancia'), lanciaTesto: $('lanciaTesto'), facce: $('facce'), btnAltro: $('btnAltro'),
    ciclo: $('ciclo'), chkEscl: $('chkEscl'), cicloConta: $('cicloConta'), cicloGriglia: $('cicloGriglia'), cicloBarra: $('cicloBarra'),
    storico: $('storico'), storicoN: $('storicoN'), storicoMedia: $('storicoMedia'), btnPulisci: $('btnPulisci'),
    btnSuono: $('btnSuono'), btnTema: $('btnTema'), btnInfo: $('btnInfo'),
    veloTema: $('veloTema'), temi: $('temi'), veloAltro: $('veloAltro'), formAltro: $('formAltro'), inputAltro: $('inputAltro'),
    rapidi: $('rapidi'), veloInfo: $('veloInfo'), versione: $('versione'), infoVersione: $('infoVersione'), scintille: $('scintille')
  };

  // ---- audio -----------------------------------------------------------
  const audio = { shake: [], throw: [], pronto: false };
  function preparaAudio() {
    if (audio.pronto) return;
    audio.pronto = true;
    for (let i = 1; i <= 3; i++) {
      const s = new Audio('audio/dice-shake-' + i + '.ogg'); s.preload = 'auto'; audio.shake.push(s);
      const t = new Audio('audio/dice-throw-' + i + '.ogg'); t.preload = 'auto'; audio.throw.push(t);
    }
  }
  function suona(lista) {
    if (!S.suono) return null;
    preparaAudio();
    const a = lista[casuale(lista.length)];
    try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* autoplay negato */ }
    return a;
  }
  function vibra(ms) { if (S.suono && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* niente */ } } }

  // ---- rendering -------------------------------------------------------
  function formaPer(facce) {
    return [4, 6, 8, 10, 12, 20].includes(facce) ? String(facce) : 'tondo';
  }
  function mostraNumero(v) {
    el.dadoNum.textContent = v;
    const cifre = String(v).length;
    el.dado.classList.toggle('cifre3', cifre === 3);
    el.dado.classList.toggle('cifre4', cifre >= 4);
  }
  function applicaTema() {
    document.body.dataset.tema = S.tema;
    const t = TEMI[S.tema];
    el.lanciaTesto.textContent = t.lancia;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.colore);
    for (const b of el.temi.querySelectorAll('.tessera')) b.classList.toggle('attiva', b.dataset.tema === S.tema);
  }
  function renderFacce() {
    let trovato = false;
    for (const b of el.facce.querySelectorAll('button[data-f]')) {
      const on = Number(b.dataset.f) === S.facce;
      b.classList.toggle('attivo', on);
      if (on) trovato = true;
    }
    el.btnAltro.classList.toggle('attivo', !trovato);
    el.btnAltro.firstElementChild.textContent = trovato ? 'altro…' : 'd' + S.facce;
    el.dado.dataset.forma = formaPer(S.facce);
  }
  function renderCiclo() {
    el.chkEscl.checked = S.escl;
    el.ciclo.classList.toggle('pieno', S.cicloPieno);
    if (!S.escl) {
      el.ciclo.dataset.modo = 'off';
      el.cicloConta.textContent = '';
      el.cicloGriglia.innerHTML = '';
      return;
    }
    const n = S.facce, k = S.usciti.length;
    el.cicloConta.textContent = k + ' / ' + n;
    if (n > 120) {
      el.ciclo.dataset.modo = 'barra';
      el.cicloGriglia.innerHTML = '';
      el.cicloBarra.firstElementChild.style.width = (k ? Math.max(0.8, 100 * k / n) : 0).toFixed(1) + '%';
      return;
    }
    el.ciclo.dataset.modo = 'griglia';
    const usciti = new Set(S.usciti);
    const ultimo = S.usciti.length ? S.usciti[S.usciti.length - 1] : 0;
    const piccola = n > 30;
    el.cicloGriglia.classList.toggle('piccola', piccola);
    const frag = document.createDocumentFragment();
    for (let v = 1; v <= n; v++) {
      const i = document.createElement('i');
      i.textContent = piccola ? '' : v;
      i.title = String(v);
      if (usciti.has(v)) i.classList.add('uscito');
      if (v === ultimo) i.classList.add('ultimo');
      frag.appendChild(i);
    }
    el.cicloGriglia.replaceChildren(frag);
    const u = el.cicloGriglia.querySelector('.ultimo');
    if (u && u.scrollIntoView) u.scrollIntoView({ block: 'nearest' });
  }
  function renderStorico(nuovo) {
    el.storicoN.textContent = S.storico.length;
    if (S.storico.length) {
      const somma = S.storico.reduce((a, r) => a + r.v, 0);
      const media = somma / S.storico.length;
      el.storicoMedia.textContent = (Math.round(media * 10) / 10).toLocaleString('it-IT');
    } else el.storicoMedia.textContent = '–';
    const frag = document.createDocumentFragment();
    S.storico.forEach((r, idx) => {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = r.v;
      if (r.v === r.f && r.f > 1) c.classList.add('max');
      else if (r.v === 1 && r.f > 1) c.classList.add('min');
      if (r.f !== S.facce) { const d = document.createElement('i'); d.className = 'd'; d.textContent = 'd' + r.f; c.appendChild(d); }
      if (nuovo && idx === 0) c.classList.add('nuovo');
      frag.appendChild(c);
    });
    el.storico.replaceChildren(frag);
    el.storico.scrollTop = 0;
  }
  function renderTutto() {
    applicaTema(); renderFacce(); renderCiclo(); renderStorico(false);
    mostraNumero(S.storico.length ? S.storico[0].v : '?');
  }

  // ---- avvisi ----------------------------------------------------------
  let timerAvviso = 0, timerEsito = 0;
  function avvisa(html, ms) {
    el.avviso.innerHTML = html;
    el.avviso.classList.add('visibile');
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => el.avviso.classList.remove('visibile'), ms || 3200);
  }
  function esito(testo) {
    el.esito.textContent = testo;
    el.esito.classList.add('visibile');
    clearTimeout(timerEsito);
    timerEsito = setTimeout(() => el.esito.classList.remove('visibile'), 1800);
  }
  function scintille() {
    const n = 14, frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      const a = (Math.PI * 2 * i) / n + (Math.random() - .5) * .4;
      const r = 90 + Math.random() * 70;
      s.style.setProperty('--dx', (Math.cos(a) * r).toFixed(0) + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * r).toFixed(0) + 'px');
      s.style.animationDelay = (Math.random() * 80) + 'ms';
      frag.appendChild(s);
    }
    el.scintille.replaceChildren(frag);
  }

  // ---- il lancio -------------------------------------------------------
  let rotolando = false;
  function lancia() {
    if (rotolando) return;
    rotolando = true;
    el.btnLancia.disabled = true;
    el.arena.classList.remove('critico', 'minimo');
    el.dado.classList.remove('fermo');
    el.esito.classList.remove('visibile');

    // se il giro precedente si era chiuso, la griglia riparte da vuota adesso
    if (S.escl && S.cicloPieno) nuovoCiclo();
    if (S.escl && !cicloCoerente()) nuovoCiclo();

    let v;
    if (S.escl) {
      const i = casuale(S.pool.length);
      v = S.pool.splice(i, 1)[0];
    } else {
      v = 1 + casuale(S.facce);
    }

    const rumore = suona(audio.shake);
    vibra([20, 40, 20, 40, 30]);
    el.dado.classList.add('rotola');

    // numeri che sfarfallano mentre rotola
    const durata = 900;
    const inizio = performance.now();
    const flicker = setInterval(() => {
      mostraNumero(1 + casuale(S.facce));
      if (performance.now() - inizio > durata - 120) clearInterval(flicker);
    }, 70);

    setTimeout(() => {
      clearInterval(flicker);
      if (rumore) { try { rumore.pause(); } catch (e) { /* niente */ } }
      suona(audio.throw);
      vibra(60);
      el.dado.classList.remove('rotola');
      el.dado.classList.add('fermo');
      mostraNumero(v);

      S.storico.unshift({ v: v, f: S.facce });
      if (S.storico.length > MAX_STORICO) S.storico.length = MAX_STORICO;
      if (S.escl) S.usciti.push(v);

      const t = TEMI[S.tema];
      if (v === S.facce && S.facce > 1) {
        el.arena.classList.add('critico'); scintille(); esito(t.max);
      } else if (v === 1 && S.facce > 1) {
        el.arena.classList.add('minimo'); esito(t.min);
      }

      if (S.escl && S.pool.length === 0) {
        S.cicloPieno = true;
        avvisa('<b>' + t.giro + '</b><br>Sono usciti tutti i ' + S.facce + ' valori: il prossimo lancio ricomincia il giro.', 4200);
        vibra([40, 60, 40, 60, 80]);
      }

      renderCiclo();
      renderStorico(true);
      salva();
      rotolando = false;
      el.btnLancia.disabled = false;
    }, durata);
  }

  // ---- interazioni -----------------------------------------------------
  function impostaFacce(n) {
    n = Math.max(2, Math.min(9999, Math.floor(n)));
    if (!Number.isFinite(n)) return;
    if (n === S.facce) return;
    S.facce = n;
    if (S.escl) nuovoCiclo();
    mostraNumero('?');
    el.dado.classList.remove('fermo');
    renderFacce(); renderCiclo(); renderStorico(false); salva();
  }

  el.dado.addEventListener('click', lancia);
  el.btnLancia.addEventListener('click', lancia);
  document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (!document.querySelector('.velo:not([hidden])')) { e.preventDefault(); lancia(); }
    }
    if (e.key === 'Escape') chiudiVeli();
  });

  el.facce.addEventListener('click', e => {
    const b = e.target.closest('button[data-f]');
    if (b) impostaFacce(Number(b.dataset.f));
  });
  el.btnAltro.addEventListener('click', () => {
    el.inputAltro.value = FACCE_PRESET.includes(S.facce) ? '' : S.facce;
    apri(el.veloAltro);
    setTimeout(() => { try { el.inputAltro.focus(); el.inputAltro.select(); } catch (e) { /* niente */ } }, 80);
  });
  el.formAltro.addEventListener('submit', e => {
    e.preventDefault();
    const n = Number(el.inputAltro.value);
    if (!Number.isInteger(n) || n < 2 || n > 9999) { el.inputAltro.focus(); return; }
    impostaFacce(n);
    chiudiVeli();
  });
  el.rapidi.addEventListener('click', e => {
    const b = e.target.closest('button[data-f]');
    if (b) { impostaFacce(Number(b.dataset.f)); chiudiVeli(); }
  });

  el.chkEscl.addEventListener('change', () => {
    S.escl = el.chkEscl.checked;
    if (S.escl) nuovoCiclo();
    renderCiclo(); salva();
    if (S.escl) avvisa('<b>Senza ripetizioni</b><br>Ogni valore esce una volta sola, finché non sono usciti tutti e ' + S.facce + '.', 3000);
  });

  let timerPulisci = 0;
  el.btnPulisci.addEventListener('click', () => {
    if (!el.btnPulisci.classList.contains('conferma')) {
      if (!S.storico.length && !S.usciti.length) return;
      el.btnPulisci.classList.add('conferma');
      el.btnPulisci.textContent = 'Sicuro?';
      clearTimeout(timerPulisci);
      timerPulisci = setTimeout(ripristinaPulisci, 2500);
      return;
    }
    clearTimeout(timerPulisci);
    ripristinaPulisci();
    S.storico = [];
    if (S.escl) nuovoCiclo();
    mostraNumero('?');
    el.dado.classList.remove('fermo');
    el.arena.classList.remove('critico', 'minimo');
    renderCiclo(); renderStorico(false); salva();
  });
  function ripristinaPulisci() { el.btnPulisci.classList.remove('conferma'); el.btnPulisci.textContent = 'Svuota'; }

  el.btnSuono.addEventListener('click', () => {
    S.suono = !S.suono;
    document.body.classList.toggle('suono-on', S.suono);
    if (S.suono) { preparaAudio(); suona(audio.throw); vibra(30); }
    salva();
  });

  // ---- finestre --------------------------------------------------------
  function apri(v) { chiudiVeli(); v.hidden = false; }
  function chiudiVeli() { for (const v of document.querySelectorAll('.velo')) v.hidden = true; }
  for (const v of document.querySelectorAll('.velo')) {
    v.addEventListener('click', e => { if (e.target === v) chiudiVeli(); });
  }
  for (const b of document.querySelectorAll('[data-chiudi]')) b.addEventListener('click', chiudiVeli);
  el.btnTema.addEventListener('click', () => apri(el.veloTema));
  el.btnInfo.addEventListener('click', () => apri(el.veloInfo));

  function costruisciTessere() {
    const frag = document.createDocumentFragment();
    for (const id of ORDINE_TEMI) {
      const t = TEMI[id];
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tessera'; b.dataset.tema = id;
      b.innerHTML = '<span class="tessera-dado">' + (id === 'arcade' ? '8' : '20') + '</span>' +
        '<span class="tessera-icona"></span>' +
        '<span class="tessera-nome">' + t.nome + '</span>' +
        '<span class="tessera-sotto">' + t.sotto + '</span>';
      b.addEventListener('click', () => { S.tema = id; applicaTema(); salva(); setTimeout(chiudiVeli, 160); });
      frag.appendChild(b);
    }
    el.temi.replaceChildren(frag);
  }

  // ---- avvio -----------------------------------------------------------
  function isCapacitorNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  if (isCapacitorNative()) document.body.classList.add('capacitor');

  // il dado si dimensiona sullo spazio che l'arena ha davvero (schermi bassi, caratteri ingranditi)
  function misuraArena() { el.arena.style.setProperty('--arena-h', el.arena.clientHeight + 'px'); }
  if (window.ResizeObserver) new ResizeObserver(misuraArena).observe(el.arena);
  window.addEventListener('resize', misuraArena);
  misuraArena();

  carica();
  costruisciTessere();
  document.body.classList.toggle('suono-on', S.suono);
  renderTutto();
  el.versione.textContent = 'v' + VERSIONE;
  el.infoVersione.textContent = 'Versione ' + VERSIONE;

  // ---- gancio di collaudo: ?debug espone lo stato --------------------
  if (/[?&]debug\b/.test(location.search)) {
    window.__alea = { S, lancia, impostaFacce, TEMI, casuale, render: renderTutto, VERSIONE };
  }
})();
