/* Emotie Kwadrant — drie-lagen-logging (kwadrant → emotie → factoren).
   Vanilla JS PWA, geen buildstap. */
(function () {
  'use strict';

  var KEY = 'emokwadrant.entries.v1';

  // Kwadranten. Interne 'key' blijft ongewijzigd zodat bestaande logs + kleuren
  // behouden blijven. Assen (impliciet): verticaal aan/uit, horizontaal duw/trek.
  var EMO = [
    { key: 'forceren', label: 'Beuken',     kort: 'BEU', hue: 25 },   // aan + duw
    { key: 'bouwen',   label: 'Bouwen',     kort: 'BOU', hue: 150 },  // aan + trek
    { key: 'wegzakken',label: 'Wegkwijnen', kort: 'WEG', hue: 290 },  // uit + duw
    { key: 'opladen',  label: 'Ontspannen', kort: 'ONT', hue: 220 }   // uit + trek
  ];

  // Laag 2: specifieke emoties per kwadrant. Elk kwadrant is zelf óók een kwadrant:
  // volgorde = [linksboven, rechtsboven, linksonder, rechtsonder]
  // (verticale as aan/uit, horizontale as duw/trek).
  var EMOTIONS = {
    forceren:  ['Forceren', 'Doorzetten', 'Chaotisch', 'Werkmodus'],
    bouwen:    ['Actieve modus', 'Flow', 'Excited zacht', 'Excited hard'],
    opladen:   ['Volwaardig', 'Actieve zelfwaardering', 'Actieve ontspanning', 'Opladen'],
    wegzakken: ['Zelfafwijzing', 'Zelf struggle', 'Verdoven', 'Fantaseren']
  };

  // Laag 3: factoren die de staat kunnen beïnvloeden. Schaal 1–5; null = niet ingesteld.
  var FACTORS = [
    { key: 'slaap', label: 'Slaap' },
    { key: 'stress', label: 'Stress' },
    { key: 'eten', label: 'Eten' },
    { key: 'wiet', label: 'Wiet' },
    { key: 'alcohol', label: 'Alcohol' },
    { key: 'planning', label: 'Planning' }
  ];

  // Laag 4: principes + tools per gekozen emotie. Placeholders — later te vervangen
  // (o.a. eigen iconen + echte principes/tools). PRINCIPES nu generiek per staat.
  var PRINCIPES = [
    'Erken de staat waar je in zit — hij geeft informatie.',
    'Je gedrag volgt uit je staat, niet andersom.',
    'Eén kleine, passende actie kan de staat verschuiven.'
  ];
  var TOOLS = [
    { icon: '📝', label: 'Emotieregulatie-vragenlijst', sub: 'kort invullen' },
    { icon: '📅', label: 'Dagplanning maken', sub: 'structuur aanbrengen' },
    { icon: '🧩', label: 'Flow-structuur uitdenken', sub: 'stap voor stap' },
    { icon: '⏱️', label: 'Pauze-timer 20 min', sub: 'even eruit' }
  ];

  var HUE = {}, LABEL = {};
  EMO.forEach(function (e) { HUE[e.key] = e.hue; LABEL[e.key] = e.label; });

  function color(hue) { return 'oklch(72% 0.085 ' + hue + ')'; }
  function bg(hue, t) { return 'oklch(72% 0.085 ' + hue + ' / ' + t + ')'; }
  function line(hue) { return 'oklch(72% 0.085 ' + hue + ' / 0.3)'; }
  function colorForKey(k) { return color(HUE[k]); }

  /* ---------- State ---------- */
  var entries = [];
  var screen = 'log';   // bottom-nav: 'log' | 'ins'
  // Lopende log-flow. null als er geen flow actief is.
  //   { step: 'pick' | 'factors' | 'tools', key, emotion, ts,
  //     factors:{<factor>:1..5|null}, note, savedId }
  // De entry wordt opgeslagen bij de overgang factoren → tools (savedId onthoudt
  // welke, zodat terug/vooruit dezelfde entry bijwerkt i.p.v. dubbel logt).
  var flow = null;

  function load() {
    try { entries = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { entries = []; }
    if (!Array.isArray(entries)) entries = [];
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch (e) {}
  }

  /* ---------- Mini DOM-helper ---------- */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'value') el.value = v;
        else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else for (var s in v) el.style[s] = v[s]; }
        else if (k === 'onclick') el.addEventListener('click', v);
        else el.setAttribute(k, v);
      }
    }
    if (children != null) {
      var arr = Array.isArray(children) ? children : [children];
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if (c == null || c === false) continue;
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return el;
  }

  /* ---------- Datum/tijd (nl-NL) ---------- */
  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  function dayLabel(d) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var dd = new Date(d); dd.setHours(0, 0, 0, 0);
    var diff = Math.round((today - dd) / 86400000);
    if (diff === 0) return 'Vandaag';
    if (diff === 1) return 'Gisteren';
    return dd.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  /* ---------- Log-flow ---------- */
  var noteInput = null; // ref naar het notitieveld op het factoren-scherm

  function syncNote() {
    if (flow && noteInput) flow.note = noteInput.value || '';
  }
  function startFlow(key) {
    var factors = {};
    FACTORS.forEach(function (f) { factors[f.key] = null; });
    flow = { step: 'pick', key: key, emotion: null, ts: Date.now(),
      factors: factors, note: '', savedId: null };
    render();
  }
  function pickEmotion(name) {
    flow.emotion = name;
    flow.step = 'factors';
    render();
  }
  function back() {
    if (!flow) return;
    if (flow.step === 'tools') { flow.step = 'factors'; }
    else if (flow.step === 'factors') { syncNote(); flow.step = 'pick'; }
    else { flow = null; }
    noteInput = null;
    render();
  }
  // Factoren → tools: sla de entry op (of werk 'm bij bij terug/vooruit) en ga door.
  function saveAndAdvance(saveNote) {
    if (!flow) return;
    syncNote();
    var factors = {};
    FACTORS.forEach(function (f) { factors[f.key] = flow.factors[f.key]; });
    var note = saveNote ? (flow.note || '').trim() : '';
    if (flow.savedId) {
      var ex = entries.filter(function (e) { return e.id === flow.savedId; })[0];
      if (ex) { ex.factors = factors; ex.note = note; }
    } else {
      var entry = {
        id: 'e-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
        key: flow.key, emotion: flow.emotion, ts: flow.ts,
        factors: factors, note: note
      };
      entries.push(entry);
      flow.savedId = entry.id;
    }
    persist();
    flow.step = 'tools';
    noteInput = null;
    render();
  }
  // Tools-scherm afsluiten (entry is al opgeslagen bij saveAndAdvance).
  function finishFlow() {
    flow = null;
    noteInput = null;
    render();
  }

  /* ---------- Laag 1: kwadrant-rooster ---------- */
  function todayStr() {
    return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function todayCountStr() {
    var t0 = new Date(); t0.setHours(0, 0, 0, 0);
    var n = entries.filter(function (e) { return e.ts >= t0.getTime(); }).length;
    return n === 0 ? 'nog niets gelogd' : n === 1 ? '1 log vandaag' : n + ' logs vandaag';
  }
  function renderLog() {
    return h('div', { class: 'log-screen' }, [
      h('div', { class: 'log-head' }, [
        h('div', { class: 'today', text: todayStr() }),
        h('div', { class: 'today-count', text: todayCountStr() })
      ]),
      h('div', { class: 'grid' }, EMO.map(function (e) {
        return h('button', {
          class: 'tile',
          style: { background: bg(e.hue, 0.09), border: '1px solid ' + line(e.hue) },
          onclick: function () { startFlow(e.key); }
        }, [
          h('span', { class: 'tile-label', style: { color: color(e.hue) }, text: e.label })
        ]);
      }))
    ]);
  }

  /* ---------- Laag 2: emotie-kiezer ---------- */
  function renderPick() {
    var c = colorForKey(flow.key);
    return h('div', { class: 'screen-overlay' }, [
      h('button', { class: 'back-btn', text: '‹ terug', onclick: back }),
      h('div', { class: 'ov-head' }, [
        h('span', { class: 'ov-dot', style: { background: c } }),
        h('div', { class: 'ov-title', style: { color: c }, text: LABEL[flow.key] }),
        h('div', { class: 'ov-sub', text: 'waar zit je nu?' })
      ]),
      h('div', { class: 'picker-grid' }, (EMOTIONS[flow.key] || []).map(function (name) {
        return h('button', {
          class: 'emotion-tile',
          style: { background: bg(HUE[flow.key], 0.09), border: '1px solid ' + line(HUE[flow.key]), color: c },
          onclick: function () { pickEmotion(name); }
        }, [name]);
      }))
    ]);
  }

  /* ---------- Laag 3: factoren + notitie ---------- */
  function buildSlider(factorKey, colorStr, readout) {
    var track = h('div', { class: 'slider-track' });
    var fill = h('div', { class: 'slider-fill' });
    var thumb = h('div', { class: 'slider-thumb' });
    // 5 stops (1–5) als kleine tikjes.
    for (var s = 1; s <= 5; s++) {
      track.appendChild(h('div', { class: 'slider-tick', style: { left: (s / 5 * 100) + '%' } }));
    }
    track.appendChild(fill);
    track.appendChild(thumb);

    // v === null: nog niet ingesteld (leeg). Anders 1..5.
    function paint(v) {
      if (v == null) {
        fill.style.width = '0%';
        thumb.style.opacity = '0';
        fill.style.background = 'transparent';
        readout.textContent = '–';
        return;
      }
      var frac = v / 5;
      fill.style.width = (frac * 100) + '%';
      thumb.style.left = (frac * 100) + '%';
      thumb.style.opacity = '1';
      fill.style.background = colorStr;
      thumb.style.background = colorStr;
      readout.textContent = String(v);
    }
    paint(flow.factors[factorKey]);

    // Minimaal 1: helemaal naar links geven = 1, nooit 0/leeg via slepen.
    function valAt(clientX) {
      var r = track.getBoundingClientRect();
      var frac = (clientX - r.left) / r.width;
      frac = Math.max(0, Math.min(1, frac));
      return Math.max(1, Math.round(frac * 5)); // 1–5
    }
    function apply(v) { flow.factors[factorKey] = v; paint(v); }

    var dragging = false;
    track.addEventListener('pointerdown', function (e) {
      dragging = true;
      try { track.setPointerCapture(e.pointerId); } catch (err) {}
      apply(valAt(e.clientX));
    });
    track.addEventListener('pointermove', function (e) { if (dragging) apply(valAt(e.clientX)); });
    function end() { dragging = false; }
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);

    return h('div', { class: 'slider' }, [track]);
  }

  function renderFactors() {
    var c = colorForKey(flow.key);
    noteInput = h('input', { class: 'note-input', placeholder: 'notitie (optioneel)', value: flow.note || '' });

    var factorRows = FACTORS.map(function (f) {
      var readout = h('span', { class: 'factor-val' });
      var head = h('div', { class: 'factor-head' }, [
        h('span', { class: 'factor-name', text: f.label }),
        readout
      ]);
      return h('div', { class: 'factor-row' }, [head, buildSlider(f.key, c, readout)]);
    });

    return h('div', { class: 'screen-overlay' }, [
      h('button', { class: 'back-btn', text: '‹ terug', onclick: back }),
      h('div', { class: 'ov-head' }, [
        h('span', { class: 'ov-dot', style: { background: c } }),
        h('div', { class: 'ov-title', style: { color: c }, text: flow.emotion || LABEL[flow.key] }),
        h('div', { class: 'ov-sub', text: LABEL[flow.key].toLowerCase() + ' · ' + fmtTime(flow.ts) })
      ]),
      h('div', { class: 'factors' }, factorRows),
      noteInput,
      h('div', { class: 'confirm-actions' }, [
        h('button', { class: 'btn-skip', text: 'overslaan', onclick: function () { saveAndAdvance(false); } }),
        h('button', { class: 'btn-done', text: 'opslaan', onclick: function () { saveAndAdvance(true); } })
      ])
    ]);
  }

  /* ---------- Laag 4: principes + tools ---------- */
  function renderTools() {
    var c = colorForKey(flow.key);
    return h('div', { class: 'screen-overlay' }, [
      h('button', { class: 'back-btn', text: '‹ terug', onclick: back }),
      h('div', { class: 'ov-head' }, [
        h('span', { class: 'ov-dot', style: { background: c } }),
        h('div', { class: 'ov-title', style: { color: c }, text: flow.emotion || LABEL[flow.key] }),
        h('div', { class: 'ov-sub', text: 'wat past bij deze staat' })
      ]),

      h('div', { class: 'pt-section' }, [
        h('div', { class: 'pt-head', text: 'principes' })
      ].concat(PRINCIPES.map(function (p) {
        return h('div', { class: 'principe-item' }, [
          h('span', { class: 'principe-dot', style: { background: c } }),
          h('span', { class: 'principe-text', text: p })
        ]);
      }))),

      h('div', { class: 'pt-section' }, [
        h('div', { class: 'pt-head', text: 'tools' }),
        h('div', { class: 'tool-list' }, TOOLS.map(function (t) {
          return h('button', { class: 'tool-item' }, [
            h('span', { class: 'tool-icon', style: { background: bg(HUE[flow.key], 0.14) }, text: t.icon }),
            h('span', { class: 'tool-text' }, [
              h('span', { class: 'tool-label', text: t.label }),
              h('span', { class: 'tool-sub', text: t.sub })
            ])
          ]);
        }))
      ]),

      h('div', { class: 'confirm-actions', style: { marginTop: '36px' } }, [
        h('button', { class: 'btn-skip', text: 'overslaan', onclick: finishFlow }),
        h('button', { class: 'btn-done', text: 'klaar', onclick: finishFlow })
      ])
    ]);
  }

  /* ---------- Inzichten ---------- */
  function factorSummary(e) {
    if (!e.factors) return '';
    var parts = [];
    FACTORS.forEach(function (f) {
      var v = e.factors[f.key];
      if (v) parts.push(f.label.toLowerCase() + ' ' + v);
    });
    return parts.join(' · ');
  }
  function computeWeekBars() {
    var dayNames = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      var end = d.getTime() + 86400000;
      var counts = {};
      entries.forEach(function (e) { if (e.ts >= d.getTime() && e.ts < end) counts[e.key] = (counts[e.key] || 0) + 1; });
      days.push({ d: dayNames[d.getDay()], counts: counts, total: Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0) });
    }
    var maxTotal = Math.max.apply(null, [1].concat(days.map(function (x) { return x.total; })));
    return days.map(function (x) {
      return {
        d: x.d,
        segs: EMO.filter(function (e) { return x.counts[e.key]; }).map(function (e) {
          return { c: color(e.hue), h: Math.max(5, Math.round((x.counts[e.key] / maxTotal) * 108)) };
        })
      };
    });
  }
  function computeDagdelen() {
    var weekStart = Date.now() - 7 * 86400000;
    var weekEntries = entries.filter(function (e) { return e.ts >= weekStart; });
    var parts = [
      { name: 'Ochtend', from: 6, to: 12 },
      { name: 'Middag', from: 12, to: 18 },
      { name: 'Avond', from: 18, to: 24 },
      { name: 'Nacht', from: 0, to: 6 }
    ];
    return parts.map(function (p) {
      return {
        name: p.name,
        cells: EMO.map(function (e) {
          var n = weekEntries.filter(function (x) {
            var hr = new Date(x.ts).getHours();
            return x.key === e.key && hr >= p.from && hr < p.to;
          }).length;
          return {
            color: color(e.hue),
            sz: n ? 8 + Math.min(n, 8) * 2 : 4,
            op: n ? 0.35 + Math.min(n / 6, 1) * 0.65 : 0.12
          };
        })
      };
    });
  }
  function computeTlDays() {
    var sorted = entries.slice().sort(function (x, y) { return y.ts - x.ts; });
    var tlDays = [], cur = null;
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i];
      var k = new Date(e.ts).toDateString();
      if (!cur || cur.k !== k) {
        if (tlDays.length >= 7) break;
        cur = { k: k, label: dayLabel(e.ts), items: [] };
        tlDays.push(cur);
      }
      if (cur.items.length < 10) cur.items.push({
        time: fmtTime(e.ts),
        color: colorForKey(e.key),
        label: e.emotion || LABEL[e.key],
        detail: factorSummary(e),
        note: e.note || '',
        hasNote: !!(e.note && e.note.length)
      });
    }
    return tlDays;
  }

  function secHead(txt, margin) {
    return h('div', { class: 'sec-head', style: { margin: margin }, text: txt });
  }
  function renderIns() {
    var box = h('div', { class: 'ins-screen' });

    box.appendChild(secHead('deze week', '0 0 24px'));
    var weekBars = computeWeekBars();
    box.appendChild(h('div', { class: 'week-bars' }, weekBars.map(function (wb) {
      return h('div', { class: 'week-col' }, [
        h('div', { class: 'week-bar' }, wb.segs.map(function (sg) {
          return h('div', { class: 'week-seg', style: { height: sg.h + 'px', background: sg.c } });
        })),
        h('div', { class: 'week-day', text: wb.d })
      ]);
    })));
    box.appendChild(h('div', { class: 'legend' }, EMO.map(function (e) {
      return h('span', { class: 'legend-item' }, [
        h('span', { class: 'legend-dot', style: { background: color(e.hue) } }),
        e.label
      ]);
    })));

    box.appendChild(secHead('per dagdeel', '0 0 4px'));
    box.appendChild(h('div', { class: 'part-headrow' }, [h('span', { class: 'part-spacer' })].concat(
      EMO.map(function (e) { return h('span', { class: 'part-col-head', style: { color: color(e.hue) }, text: e.kort }); })
    )));
    computeDagdelen().forEach(function (dd) {
      box.appendChild(h('div', { class: 'part-row' }, [h('span', { class: 'part-name', text: dd.name })].concat(
        dd.cells.map(function (cl) {
          return h('span', { class: 'part-cell' }, [
            h('span', { class: 'part-dot', style: { width: cl.sz + 'px', height: cl.sz + 'px', background: cl.color, opacity: cl.op } })
          ]);
        })
      )));
    });

    box.appendChild(secHead('tijdlijn', '34px 0 6px'));
    if (entries.length === 0) {
      box.appendChild(h('div', { class: 'tl-empty', text: 'Nog geen logs.' }));
    }
    computeTlDays().forEach(function (day) {
      box.appendChild(h('div', { class: 'tl-daylabel', text: day.label }));
      day.items.forEach(function (it) {
        var item = h('div', { class: 'tl-item' }, [
          h('div', { class: 'tl-row' }, [
            h('span', { class: 'tl-time', text: it.time }),
            h('span', { class: 'tl-dot', style: { background: it.color } }),
            h('span', { class: 'tl-label', text: it.label })
          ])
        ]);
        if (it.detail) item.appendChild(h('div', { class: 'tl-meta', text: it.detail }));
        if (it.hasNote) item.appendChild(h('div', { class: 'tl-note', text: it.note }));
        box.appendChild(item);
      });
    });

    return box;
  }

  /* ---------- Navigatie ---------- */
  function renderNav() {
    return h('div', { class: 'nav' }, [
      h('button', { class: 'nav-btn', style: { color: screen === 'log' ? '#E9EBEA' : '#6C7377' }, text: 'nu',
        onclick: function () { screen = 'log'; render(); } }),
      h('button', { class: 'nav-btn', style: { color: screen === 'ins' ? '#E9EBEA' : '#6C7377' }, text: 'inzichten',
        onclick: function () { screen = 'ins'; render(); } })
    ]);
  }

  /* ---------- Render ---------- */
  var root;
  function render() {
    root.replaceChildren();
    root.appendChild(screen === 'log' ? renderLog() : renderIns());
    root.appendChild(renderNav());
    if (flow) {
      root.appendChild(
        flow.step === 'pick' ? renderPick() :
        flow.step === 'factors' ? renderFactors() : renderTools()
      );
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    root = document.getElementById('app');
    load();
    render();
  });
})();
