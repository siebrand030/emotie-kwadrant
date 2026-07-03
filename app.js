/* Emotie Kwadrant — herbouw van de design handoff als vanilla-JS PWA.
   Logica 1-op-1 geport uit "Emotie Kwadrant.dc.html". */
(function () {
  'use strict';

  var KEY = 'emokwadrant.entries.v1';
  var EMO = [
    { key: 'forceren', label: 'Forceren', kort: 'FOR', desc: 'actie vanuit frustratie', hue: 25 },
    { key: 'bouwen',   label: 'Bouwen',   kort: 'BOU', desc: 'werken aan iets waardevols', hue: 150 },
    { key: 'wegzakken',label: 'Wegzakken',kort: 'WEG', desc: 'vermijden, scrollen, uitstellen', hue: 290 },
    { key: 'opladen',  label: 'Opladen',  kort: 'OPL', desc: 'bewuste rust, zonder onrust', hue: 220 }
  ];
  var HUE = {}, LABEL = {};
  EMO.forEach(function (e) { HUE[e.key] = e.hue; LABEL[e.key] = e.label; });

  function color(hue) { return 'oklch(72% 0.085 ' + hue + ')'; }
  function bg(hue, t) { return 'oklch(72% 0.085 ' + hue + ' / ' + t + ')'; }
  function line(hue) { return 'oklch(72% 0.085 ' + hue + ' / 0.3)'; }
  function colorForKey(k) { return color(HUE[k]); }

  /* ---------- State + persistentie ---------- */
  var entries = [];
  var screen = 'log';      // 'log' | 'ins'
  var pendingId = null;    // entry in bevestigingsscherm

  function load() {
    try { entries = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { entries = []; }
    if (!Array.isArray(entries)) entries = [];
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch (e) {}
  }
  function pend() {
    for (var i = 0; i < entries.length; i++) if (entries[i].id === pendingId) return entries[i];
    return null;
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

  /* ---------- Acties ---------- */
  function tap(key) {
    var entry = { id: 'e-' + Date.now() + '-' + Math.floor(Math.random() * 1e6), key: key, ts: Date.now(), intensity: 0, note: '' };
    entries.push(entry);
    persist();
    pendingId = entry.id;
    render();
  }
  function setInt(n) {
    var p = pend();
    if (!p) return;
    p.intensity = p.intensity === n ? 0 : n;
    persist();
    updateIntens();
  }
  function close(saveNote) {
    var p = pend();
    if (p && saveNote && noteInput) {
      p.note = (noteInput.value || '').trim();
      persist();
    }
    pendingId = null;
    noteInput = null;
    intensContainer = null;
    render();
  }

  /* ---------- Logscherm ---------- */
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
          onclick: function () { tap(e.key); }
        }, [
          h('span', { class: 'tile-label', style: { color: color(e.hue) }, text: e.label }),
          h('span', { class: 'tile-desc', text: e.desc })
        ]);
      }))
    ]);
  }

  /* ---------- Inzichtenscherm ---------- */
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
        label: LABEL[e.key],
        dots: e.intensity ? new Array(e.intensity + 1).join('•') : '',
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

    // deze week
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

    // per dagdeel
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

    // tijdlijn
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
            h('span', { class: 'tl-label', text: it.label }),
            h('span', { class: 'tl-dots', style: { color: it.color }, text: it.dots })
          ])
        ]);
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

  /* ---------- Bevestigingsscherm ---------- */
  var noteInput = null;
  var intensContainer = null;

  function intensButtons(p) {
    var c = colorForKey(p.key);
    return [1, 2, 3, 4, 5].map(function (n) {
      var on = p.intensity === n;
      return h('button', {
        class: 'intens-btn',
        style: {
          border: '1px solid ' + (on ? c : 'rgba(255,255,255,.16)'),
          background: on ? c : 'transparent',
          color: on ? '#0B0C0D' : '#9AA0A3'
        },
        text: String(n),
        onclick: function () { setInt(n); }
      });
    });
  }
  function updateIntens() {
    var p = pend();
    if (!p || !intensContainer) return;
    intensContainer.replaceChildren.apply(intensContainer, intensButtons(p));
  }
  function renderConfirm(p) {
    var c = colorForKey(p.key);
    intensContainer = h('div', { class: 'intens' }, intensButtons(p));
    noteInput = h('input', { class: 'note-input', placeholder: 'notitie (optioneel)', value: p.note || '' });
    return h('div', { class: 'confirm' }, [
      h('span', { class: 'confirm-dot', style: { background: c } }),
      h('div', { class: 'confirm-title', style: { color: c }, text: LABEL[p.key] }),
      h('div', { class: 'confirm-time', text: 'gelogd om ' + fmtTime(p.ts) }),
      intensContainer,
      noteInput,
      h('div', { class: 'confirm-actions' }, [
        h('button', { class: 'btn-skip', text: 'overslaan', onclick: function () { close(false); } }),
        h('button', { class: 'btn-done', text: 'klaar', onclick: function () { close(true); } })
      ])
    ]);
  }

  /* ---------- Render ---------- */
  var root;
  function render() {
    root.replaceChildren();
    root.appendChild(screen === 'log' ? renderLog() : renderIns());
    root.appendChild(renderNav());
    var p = pend();
    if (p) root.appendChild(renderConfirm(p));
  }

  document.addEventListener('DOMContentLoaded', function () {
    root = document.getElementById('app');
    load();
    render();
  });
})();
