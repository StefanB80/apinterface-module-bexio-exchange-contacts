/* Embedded in body.ejs — Feldzuordnung mehrere Abschnitte */
(function () {
  var root = document.getElementById('bec-fmb-root');
  if (!root) return;

  var defNode = document.getElementById('bec-default-map');
  var initNode = document.getElementById('bec-fmb-initial-json');
  var jsonOut = document.getElementById('bec-fmb-json');
  var form = document.getElementById('bec-setup-form');
  var defMap = {};
  try {
    defMap = JSON.parse((defNode && defNode.textContent) || '{}');
  } catch (e1) {
    defMap = {};
  }

  var state = { blocks: [] };
  try {
    var raw = (initNode && initNode.textContent) || '[]';
    var parsed = JSON.parse(raw);
    state.blocks = Array.isArray(parsed) ? parsed : [parsed];
  } catch (e2) {
    state.blocks = [];
  }
  if (!state.blocks.length) {
    state.blocks = [{ id: 'block-1', title: 'Feldzuordnung 1', conditions: [], fieldMapping: {} }];
  }
  state.blocks.forEach(function (b, i) {
    if (!b.fieldMapping) b.fieldMapping = {};
    if (!b.id) b.id = 'block-' + (i + 1);
    if (!b.title) b.title = 'Feldzuordnung ' + (i + 1);
    if (!Array.isArray(b.conditions)) b.conditions = [];
  });

  var mapRefreshers = [];

  function ns() {
    return 'http://www.w3.org/2000/svg';
  }

  function ensureMapArrowMarker(svg, bi) {
    var mid = 'bec-map-arrowhead-' + bi;
    if (svg.querySelector('#' + mid)) return mid;
    var defs = document.createElementNS(ns(), 'defs');
    var marker = document.createElementNS(ns(), 'marker');
    marker.setAttribute('id', mid);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');
    var mpath = document.createElementNS(ns(), 'path');
    mpath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    mpath.setAttribute('fill', '#2563eb');
    marker.appendChild(mpath);
    defs.appendChild(marker);
    svg.insertBefore(defs, svg.firstChild);
    return mid;
  }

  function readMap(bi, tgtKey) {
    var b = state.blocks[bi];
    if (!b || !b.fieldMapping) return '';
    return String(b.fieldMapping[tgtKey] || '').trim();
  }

  function setMap(bi, tgtKey, srcKey) {
    if (!state.blocks[bi]) return;
    if (!state.blocks[bi].fieldMapping) state.blocks[bi].fieldMapping = {};
    state.blocks[bi].fieldMapping[tgtKey] = srcKey || '';
    var hint = document.getElementById('bec_tgt_hint_' + bi + '_' + tgtKey);
    if (hint) hint.textContent = '\u2190 ' + (srcKey || '\u2014');
  }

  function clearMapPathsOnly(svg) {
    Array.prototype.slice.call(svg.childNodes).forEach(function (node) {
      if (node.nodeName === 'path') svg.removeChild(node);
    });
  }

  function initOneBlock(wrap, bi) {
    var svg = document.getElementById('bec-map-svg-' + bi);
    if (!wrap || !svg) return;

    var pickedTgt = null;
    var pickedSrc = null;
    var markerId = ensureMapArrowMarker(svg, bi);
    var markerUrl = 'url(#' + markerId + ')';

    function redrawLines() {
      clearMapPathsOnly(svg);
      var w = wrap.clientWidth;
      var h = wrap.clientHeight;
      if (w < 2 || h < 2) return;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

      wrap.querySelectorAll('.bec-map-tgt:not([disabled])').forEach(function (btn) {
        var tgtKey = btn.getAttribute('data-bec-tgt');
        var srcKey = readMap(bi, tgtKey);
        if (!srcKey) return;
        var srcEl = wrap.querySelector('.bec-map-src[data-bec-src="' + srcKey + '"]:not(.is-disabled)');
        if (!srcEl || !btn) return;
        var wr = wrap.getBoundingClientRect();
        var a = srcEl.getBoundingClientRect();
        var b = btn.getBoundingClientRect();
        var x1 = a.right - wr.left;
        var y1 = a.top + a.height / 2 - wr.top;
        var x2 = b.left - wr.left;
        var y2 = b.top + b.height / 2 - wr.top;
        var mid = (x1 + x2) / 2;
        var d = 'M ' + x1 + ' ' + y1 + ' C ' + mid + ' ' + y1 + ', ' + mid + ' ' + y2 + ', ' + x2 + ' ' + y2;
        var path = document.createElementNS(ns(), 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#2f4fb3');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.85');
        path.setAttribute('marker-end', markerUrl);
        svg.appendChild(path);
      });
    }

    function drawFlashArrowOrdered(firstEl, secondEl, onDone) {
      var w = wrap.clientWidth;
      var h = wrap.clientHeight;
      if (w < 2 || h < 2) {
        if (onDone) onDone();
        return;
      }
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      ensureMapArrowMarker(svg, bi);
      var wr = wrap.getBoundingClientRect();
      var r1 = firstEl.getBoundingClientRect();
      var r2 = secondEl.getBoundingClientRect();
      var cx1 = r1.left + r1.width / 2;
      var cx2 = r2.left + r2.width / 2;
      var x1;
      var y1;
      var x2;
      var y2;
      if (cx1 <= cx2) {
        x1 = r1.right - wr.left;
        y1 = r1.top + r1.height / 2 - wr.top;
        x2 = r2.left - wr.left;
        y2 = r2.top + r2.height / 2 - wr.top;
      } else {
        x1 = r1.left - wr.left;
        y1 = r1.top + r1.height / 2 - wr.top;
        x2 = r2.right - wr.left;
        y2 = r2.top + r2.height / 2 - wr.top;
      }
      var mid = (x1 + x2) / 2;
      var d = 'M ' + x1 + ' ' + y1 + ' C ' + mid + ' ' + y1 + ', ' + mid + ' ' + y2 + ', ' + x2 + ' ' + y2;
      var path = document.createElementNS(ns(), 'path');
      path.setAttribute('id', 'bec-map-flash-path-' + bi);
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#2563eb');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', markerUrl);
      path.setAttribute('opacity', '1');
      svg.appendChild(path);
      setTimeout(function () {
        var fp = svg.querySelector('#bec-map-flash-path-' + bi);
        if (fp) fp.remove();
        if (onDone) onDone();
      }, 520);
    }

    function updateMappedClasses() {
      wrap.querySelectorAll('.bec-map-src').forEach(function (el) {
        el.classList.remove('is-mapped');
      });
      wrap.querySelectorAll('.bec-map-tgt').forEach(function (el) {
        el.classList.remove('is-mapped');
        if (el.disabled) return;
        var tgtKey = el.getAttribute('data-bec-tgt');
        if (readMap(bi, tgtKey)) el.classList.add('is-mapped');
      });
      wrap.querySelectorAll('.bec-map-tgt:not([disabled])').forEach(function (el) {
        var tgtKey = el.getAttribute('data-bec-tgt');
        var sk = readMap(bi, tgtKey);
        if (!sk) return;
        var srcEl = wrap.querySelector('.bec-map-src[data-bec-src="' + sk + '"]');
        if (srcEl && !srcEl.classList.contains('is-disabled')) srcEl.classList.add('is-mapped');
      });
    }

    function refresh() {
      updateMappedClasses();
      redrawLines();
    }

    wrap.querySelectorAll('.bec-map-tgt:not([disabled])').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.getAttribute('data-bec-tgt');
        if (pickedSrc) {
          var srcBtn0 = wrap.querySelector('.bec-map-src[data-bec-src="' + pickedSrc + '"]:not(.is-disabled)');
          if (!srcBtn0) {
            pickedSrc = null;
            wrap.querySelectorAll('.bec-map-src').forEach(function (b) {
              b.classList.remove('is-picked-src');
            });
            return;
          }
          var skDone = pickedSrc;
          pickedSrc = null;
          wrap.querySelectorAll('.bec-map-src').forEach(function (b) {
            b.classList.remove('is-picked-src');
          });
          wrap.querySelectorAll('.bec-map-item').forEach(function (b) {
            b.classList.remove('is-flash-src', 'is-flash-tgt');
          });
          srcBtn0.classList.add('is-flash-src');
          btn.classList.add('is-flash-tgt');
          drawFlashArrowOrdered(srcBtn0, btn, function () {
            setMap(bi, k, skDone);
            wrap.querySelectorAll('.bec-map-item').forEach(function (b) {
              b.classList.remove('is-picked', 'is-picked-src', 'is-flash-src', 'is-flash-tgt');
            });
            pickedTgt = null;
            refresh();
          });
          return;
        }
        if (pickedTgt === k) {
          pickedTgt = null;
          wrap.querySelectorAll('.bec-map-tgt').forEach(function (b) {
            b.classList.remove('is-picked');
          });
          return;
        }
        pickedTgt = k;
        pickedSrc = null;
        wrap.querySelectorAll('.bec-map-tgt').forEach(function (b) {
          b.classList.remove('is-picked');
        });
        wrap.querySelectorAll('.bec-map-src').forEach(function (b) {
          b.classList.remove('is-picked-src');
        });
        btn.classList.add('is-picked');
      });
    });

    wrap.querySelectorAll('.bec-map-src:not(.is-disabled)').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sk = btn.getAttribute('data-bec-src');
        if (pickedTgt) {
          var tgtBtn0 = wrap.querySelector('.bec-map-tgt[data-bec-tgt="' + pickedTgt + '"]');
          if (!tgtBtn0 || tgtBtn0.disabled) return;
          var kDone = pickedTgt;
          pickedTgt = null;
          wrap.querySelectorAll('.bec-map-tgt').forEach(function (b) {
            b.classList.remove('is-picked');
          });
          wrap.querySelectorAll('.bec-map-item').forEach(function (b) {
            b.classList.remove('is-flash-src', 'is-flash-tgt');
          });
          tgtBtn0.classList.add('is-flash-tgt');
          btn.classList.add('is-flash-src');
          drawFlashArrowOrdered(tgtBtn0, btn, function () {
            setMap(bi, kDone, sk);
            wrap.querySelectorAll('.bec-map-item').forEach(function (b) {
              b.classList.remove('is-picked', 'is-picked-src', 'is-flash-src', 'is-flash-tgt');
            });
            pickedSrc = null;
            refresh();
          });
          return;
        }
        if (pickedSrc === sk) {
          pickedSrc = null;
          wrap.querySelectorAll('.bec-map-src').forEach(function (b) {
            b.classList.remove('is-picked-src');
          });
          return;
        }
        pickedSrc = sk;
        pickedTgt = null;
        wrap.querySelectorAll('.bec-map-src').forEach(function (b) {
          b.classList.remove('is-picked-src');
        });
        wrap.querySelectorAll('.bec-map-tgt').forEach(function (b) {
          b.classList.remove('is-picked');
        });
        btn.classList.add('is-picked-src');
      });
    });

    window.addEventListener('resize', redrawLines);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        refresh();
      });
    }
    refresh();
    setTimeout(refresh, 120);
    mapRefreshers[bi] = refresh;
  }

  function collectConditionsFromTable(table) {
    if (!table) return [];
    var rows = [];
    table.querySelectorAll('tbody tr').forEach(function (tr, ri) {
      var joinSel = tr.querySelector('.bec-cond-join');
      var field = tr.querySelector('.bec-cond-field');
      var op = tr.querySelector('.bec-cond-op');
      var val = tr.querySelector('.bec-cond-val');
      var o = {
        field: field ? String(field.value || '').trim() : '',
        op: op ? String(op.value || 'eq') : 'eq',
        value: val ? String(val.value || '') : ''
      };
      if (ri > 0 && joinSel) {
        o.join = joinSel.value === 'or' ? 'or' : 'and';
      }
      rows.push(o);
    });
    return rows;
  }

  function serializeFmb() {
    var blocks = [];
    root.querySelectorAll('.bec-fmb-block').forEach(function (sec, idx) {
      var bi = Number(sec.getAttribute('data-block-index'));
      if (Number.isNaN(bi)) bi = idx;
      var titleIn = sec.querySelector('[data-role="title"]');
      var title = titleIn ? titleIn.value.trim() : 'Feldzuordnung ' + (idx + 1);
      var tbl = sec.querySelector('[data-role="cond-table"]');
      var conds = collectConditionsFromTable(tbl);
      var prev = state.blocks[bi] || {};
      var fmSrc = (prev.fieldMapping && typeof prev.fieldMapping === 'object') ? prev.fieldMapping : {};
      blocks.push({
        id: prev.id || 'block-' + (idx + 1),
        title: title,
        conditions: conds,
        fieldMapping: JSON.parse(JSON.stringify(fmSrc))
      });
    });
    return blocks;
  }

  function wireConditionUi(sec) {
    var tbl = sec.querySelector('[data-role="cond-table"]');
    if (!tbl) return;
    var tbody = tbl.querySelector('tbody');
    function addRow() {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><select class="bec-cond-join" aria-label="Verknuepfung">' +
        '<option value="and">und</option><option value="or">oder</option></select></td>' +
        '<td><select class="bec-cond-field">' +
        tbl.querySelector('.bec-cond-field').innerHTML +
        '</select></td>' +
        '<td><select class="bec-cond-op">' +
        tbl.querySelector('.bec-cond-op').innerHTML +
        '</select></td>' +
        '<td><input type="text" class="bec-cond-val" placeholder="Zahl oder Text" /></td>' +
        '<td><button type="button" class="button secondary small bec-cond-del">−</button></td>';
      tbody.appendChild(tr);
      tr.querySelector('.bec-cond-del').addEventListener('click', function () {
        if (tbody.querySelectorAll('tr').length <= 1) return;
        tr.remove();
        syncDelButtons();
      });
      syncDelButtons();
    }
    function syncDelButtons() {
      var trs = tbody.querySelectorAll('tr');
      trs.forEach(function (tr, i) {
        var del = tr.querySelector('.bec-cond-del');
        if (del) del.disabled = trs.length <= 1;
        var join = tr.querySelector('.bec-cond-join');
        if (join) {
          join.style.visibility = i === 0 ? 'hidden' : 'visible';
        }
      });
    }
    sec.querySelectorAll('.bec-cond-add').forEach(function (btn) {
      btn.addEventListener('click', addRow);
    });
    sec.querySelectorAll('.bec-cond-del').forEach(function (del) {
      del.addEventListener('click', function () {
        var tr = del.closest('tr');
        if (!tr || tbody.querySelectorAll('tr').length <= 1) return;
        tr.remove();
        syncDelButtons();
      });
    });
    syncDelButtons();
  }

  root.querySelectorAll('.bec-fmb-block').forEach(function (sec) {
    var bi = Number(sec.getAttribute('data-block-index'));
    wireConditionUi(sec);
    var wrap = sec.querySelector('.bec-map-wrap');
    if (wrap) initOneBlock(wrap, bi);
  });

  var addBtn = document.getElementById('bec-fmb-add-block');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      var first = root.querySelector('.bec-fmb-block');
      if (!first) return;
      var clone = first.cloneNode(true);
      var n = root.querySelectorAll('.bec-fmb-block').length;
      clone.setAttribute('data-block-index', String(n));
      clone.querySelectorAll('[id^="bec_fmb_title_"]').forEach(function (el) {
        el.id = 'bec_fmb_title_' + n;
      });
      clone.querySelectorAll('.bec-map-wrap').forEach(function (w) {
        w.id = 'bec-map-wrap-' + n;
        w.setAttribute('data-bec-block-index', String(n));
      });
      clone.querySelectorAll('[id^="bec-map-svg-"]').forEach(function (s) {
        s.id = 'bec-map-svg-' + n;
        while (s.firstChild) s.removeChild(s.firstChild);
      });
      clone.querySelectorAll('[id^="bec_tgt_hint_"]').forEach(function (h) {
        var m = h.getAttribute('id').replace(/^bec_tgt_hint_\d+/, 'bec_tgt_hint_' + n);
        h.setAttribute('id', m);
        h.textContent = '\u2190 \u2014';
      });
      var ti = clone.querySelector('[data-role="title"]');
      if (ti) ti.value = 'Feldzuordnung ' + (n + 1);
      var tbody = clone.querySelector('[data-role="cond-table"] tbody');
      if (tbody) {
        tbody.innerHTML = '';
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><span class="muted">—</span></td>' +
          '<td><select class="bec-cond-field">' +
          (first.querySelector('.bec-cond-field') ? first.querySelector('.bec-cond-field').innerHTML : '') +
          '</select></td>' +
          '<td><select class="bec-cond-op">' +
          (first.querySelector('.bec-cond-op') ? first.querySelector('.bec-cond-op').innerHTML : '') +
          '</select></td>' +
          '<td><input type="text" class="bec-cond-val" placeholder="Zahl oder Text" /></td>' +
          '<td><button type="button" class="button secondary small bec-cond-del" disabled>−</button></td>';
        tbody.appendChild(tr);
      }
      state.blocks.push({
        id: 'block-' + (n + 1),
        title: 'Feldzuordnung ' + (n + 1),
        conditions: [],
        fieldMapping: JSON.parse(JSON.stringify(defMap || {}))
      });
      Object.keys(state.blocks[n].fieldMapping || {}).forEach(function (k) {
        var hint = clone.querySelector('#bec_tgt_hint_' + n + '_' + k);
        if (hint) {
          var v = state.blocks[n].fieldMapping[k];
          hint.textContent = '\u2190 ' + (v || '\u2014');
        }
      });
      root.appendChild(clone);
      wireConditionUi(clone);
      var wrap = clone.querySelector('.bec-map-wrap');
      if (wrap) initOneBlock(wrap, n);
    });
  }

  var resetAll = document.getElementById('bec-map-reset-all');
  if (resetAll && defNode) {
    resetAll.addEventListener('click', function () {
      try {
        var def = JSON.parse(defNode.textContent || '{}');
        root.querySelectorAll('.bec-map-wrap').forEach(function (wrap) {
          var bi = Number(wrap.getAttribute('data-bec-block-index'));
          if (!state.blocks[bi]) state.blocks[bi] = { fieldMapping: {} };
          state.blocks[bi].fieldMapping = JSON.parse(JSON.stringify(def));
          Object.keys(def).forEach(function (k) {
            var hint = document.getElementById('bec_tgt_hint_' + bi + '_' + k);
            if (hint) hint.textContent = '\u2190 ' + (def[k] || '\u2014');
          });
          if (typeof mapRefreshers[bi] === 'function') mapRefreshers[bi]();
        });
      } catch (e3) { /* ignore */ }
    });
  }

  function pushJsonToForm() {
    if (!jsonOut) return;
    var blocks = serializeFmb();
    jsonOut.value = JSON.stringify(blocks);
  }

  if (form) {
    form.addEventListener('submit', function () {
      pushJsonToForm();
    });
    pushJsonToForm();
  }
})();
