/**
 * HackUNIX Avatar Frame — App logic
 * Upload → Crop/Zoom/Rotate → Chọn khung → Tải về (100% client-side)
 */
(function () {
  'use strict';

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };

  var PREVIEW_SIZE = 1024;
  var MAX_FILE_MB = 10;
  var DEMO_ZOOM = 1.38;   // crop sâu vào mặt demo, bỏ nền minh hoạ bên trong ảnh
  var ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

  /* ================= State ================= */
  var state = {
    img: null,            // HTMLImageElement đang dùng (demo hoặc ảnh user)
    isDemo: true,
    fileName: '',
    zoom: 1,
    offsetX: 0,           // hệ số theo S (tỉ lệ canvas)
    offsetY: 0,
    rotation: 0,
    flipH: false,
    frame: 'classic',
    exportSize: 2048,
    exportFormat: 'png',
  };

  var assets = { logo: null, frameArts: {} };
  var stage = $('#stage');
  var sctx = stage.getContext('2d');

  /* ================= Utils ================= */
  function toast(msg, type) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' toast-' + type : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.className = 'toast'; }, 3400);
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /* Vẽ sparkles bùng lên khi tải thành công */
  function sparkleBurst(anchor) {
    var rect = anchor.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    for (var i = 0; i < 26; i++) {
      var s = document.createElement('span');
      s.className = 'burst-spark';
      var angle = Math.random() * Math.PI * 2;
      var dist = 60 + Math.random() * 110;
      s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      s.style.setProperty('--size', 6 + Math.random() * 12 + 'px');
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      s.style.setProperty('--hue', ['#FFD964', '#FFFFFF', '#7DD3FC', '#FF8A4C'][i % 4]);
      document.body.appendChild(s);
      (function (el) { setTimeout(function () { el.remove(); }, 1100); })(s);
    }
  }

  /* ================= Render pipeline ================= */
  function transform() {
    return {
      zoom: state.zoom,
      offsetX: state.offsetX,
      offsetY: state.offsetY,
      rotation: state.rotation,
      flipH: state.flipH,
    };
  }

  var socialTimer = null;
  function renderStage() {
    window.HXFrames.renderComposite(sctx, PREVIEW_SIZE, state.img, transform(), state.frame, assets);
    clearTimeout(socialTimer);
    socialTimer = setTimeout(renderSocialMocks, 160);
  }

  var rafPending = false;
  function scheduleRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      renderStage();
    });
  }

  function renderSocialMocks() {
    var url;
    try {
      url = stage.toDataURL('image/png');
    } catch (e) {
      return;
    }
    $$('.mock-avatar').forEach(function (img) { img.src = url; });
  }

  function renderFrameThumbs() {
    $$('.frame-item').forEach(function (btn) {
      var canvas = $('canvas', btn);
      var ctx = canvas.getContext('2d');
      var id = btn.getAttribute('data-frame');
      window.HXFrames.renderComposite(ctx, canvas.width, state.img, { zoom: 1.3, offsetX: 0, offsetY: 0.02, rotation: 0, flipH: false }, id, assets);
      btn.classList.toggle('is-active', id === state.frame);
      btn.setAttribute('aria-pressed', id === state.frame ? 'true' : 'false');
    });
  }

  function renderHero() {
    var hero = $('#heroAvatar');
    if (!hero) return;
    var hctx = hero.getContext('2d');
    var zoom = state.isDemo ? DEMO_ZOOM : state.zoom;
    window.HXFrames.renderComposite(hctx, hero.width, state.img, { zoom: zoom, offsetX: 0, offsetY: 0, rotation: 0, flipH: false }, 'candy', assets);
  }

  function renderAll() {
    renderStage();
    renderFrameThumbs();
    renderHero();
    syncEmptyState();
  }

  function syncEmptyState() {
    var empty = $('#emptyState');
    empty.classList.toggle('is-hidden', !!state.img && !state.isDemo);
    $('#fileMeta').textContent = state.img
      ? (state.isDemo ? 'Ảnh mẫu — tải ảnh của bạn lên' : state.fileName)
      : 'Chưa có ảnh nào';
  }

  /* ================= Upload ================= */
  function acceptFile(file) {
    if (!file) return;
    if (ACCEPTED.indexOf(file.type) === -1) {
      toast('Định dạng chưa hỗ trợ — hãy dùng JPG, PNG, WebP hoặc AVIF.', 'error');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast('Ảnh vượt quá ' + MAX_FILE_MB + 'MB (hiện tại ' + formatBytes(file.size) + ').', 'error');
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      state.img = img;
      state.isDemo = false;
      state.fileName = file.name.length > 42 ? file.name.slice(0, 39) + '…' : file.name;
      state.zoom = 1;
      state.offsetX = 0;
      state.offsetY = 0;
      state.rotation = 0;
      state.flipH = false;
      $('#zoomRange').value = 100;
      $('#rotateRange').value = 0;
      $('#zoomValue').textContent = '100%';
      $('#rotateValue').textContent = '0°';
      paintRange($('#zoomRange'));
      paintRange($('#rotateRange'));
      URL.revokeObjectURL(url);
      renderAll();
      toast('Đã tải ảnh lên — kéo để căn chỉnh nhé!', 'success');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast('Không đọc được ảnh — file có thể bị hỏng.', 'error');
    };
    img.src = url;
  }

  function bindUpload() {
    var input = $('#fileInput');
    $('#btnUpload').addEventListener('click', function () { input.click(); });
    $('#btnEmptyUpload').addEventListener('click', function () { input.click(); });
    $('#btnChange').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      acceptFile(input.files && input.files[0]);
      input.value = '';
    });

    var dz = $('#dropZone');
    ['dragenter', 'dragover'].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        e.preventDefault();
        dz.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        e.preventDefault();
        if (evt === 'dragleave' && dz.contains(e.relatedTarget)) return;
        dz.classList.remove('is-dragover');
      });
    });
    dz.addEventListener('drop', function (e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      acceptFile(file);
    });

    // Dán ảnh từ clipboard (Ctrl/Cmd + V)
    window.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image/') === 0) {
          acceptFile(items[i].getAsFile());
          e.preventDefault();
          return;
        }
      }
    });
  }

  /* ================= Crop / Transform ================= */
  /* Thanh range: đổ màu phần đã chọn */
  function paintRange(input) {
    if (!input) return;
    var min = Number(input.min), max = Number(input.max), v = Number(input.value);
    var pct = ((v - min) / (max - min)) * 100;
    input.style.setProperty('--fill', pct + '%');
  }

  function bindCropControls() {
    var zoomRange = $('#zoomRange');
    var rotateRange = $('#rotateRange');

    zoomRange.addEventListener('input', function () {
      state.zoom = clamp(Number(zoomRange.value) / 100, 0.5, 3);
      $('#zoomValue').textContent = zoomRange.value + '%';
      paintRange(zoomRange);
      scheduleRender();
    });
    rotateRange.addEventListener('input', function () {
      state.rotation = Number(rotateRange.value);
      $('#rotateValue').textContent = rotateRange.value + '°';
      paintRange(rotateRange);
      scheduleRender();
    });

    $('#btnFlip').addEventListener('click', function () {
      state.flipH = !state.flipH;
      $('#btnFlip').setAttribute('aria-pressed', String(state.flipH));
      $('#btnFlip').classList.toggle('is-on', state.flipH);
      scheduleRender();
    });
    $('#btnRotate90').addEventListener('click', function () {
      state.rotation = (((state.rotation + 90 + 180) % 360) + 360) % 360 - 180;
      rotateRange.value = state.rotation;
      $('#rotateValue').textContent = state.rotation + '°';
      paintRange(rotateRange);
      scheduleRender();
    });
    $('#btnReset').addEventListener('click', resetTransform);
    $('#btnResetSoft').addEventListener('click', resetTransform);

    /* --- Drag & pinch trên canvas --- */
    var pointers = new Map();
    var lastPinch = 0;

    stage.addEventListener('pointerdown', function (e) {
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stage.classList.add('is-grabbing');
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      var prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      var rect = stage.getBoundingClientRect();
      var unit = PREVIEW_SIZE / rect.width;

      if (pointers.size === 1) {
        state.offsetX += ((e.clientX - prev.x) * unit) / PREVIEW_SIZE;
        state.offsetY += ((e.clientY - prev.y) * unit) / PREVIEW_SIZE;
        clampOffsets();
        scheduleRender();
      } else if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (lastPinch > 0) {
          var delta = dist / lastPinch;
          state.zoom = clamp(state.zoom * delta, 0.5, 3);
          zoomRange.value = Math.round(state.zoom * 100);
          $('#zoomValue').textContent = zoomRange.value + '%';
          paintRange(zoomRange);
          scheduleRender();
        }
        lastPinch = dist;
      }
    });
    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastPinch = 0;
      if (pointers.size === 0) stage.classList.remove('is-grabbing');
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.06 : 0.94;
      state.zoom = clamp(state.zoom * factor, 0.5, 3);
      zoomRange.value = Math.round(state.zoom * 100);
      $('#zoomValue').textContent = zoomRange.value + '%';
      paintRange(zoomRange);
      scheduleRender();
    }, { passive: false });

    paintRange(zoomRange);
    paintRange(rotateRange);

    /* Bàn phím: mũi tên di chuyển, +/- zoom */
    stage.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.02 : 0.008;
      var handled = true;
      switch (e.key) {
        case 'ArrowLeft': state.offsetX -= step; break;
        case 'ArrowRight': state.offsetX += step; break;
        case 'ArrowUp': state.offsetY -= step; break;
        case 'ArrowDown': state.offsetY += step; break;
        case '+': case '=': state.zoom = clamp(state.zoom * 1.05, 0.5, 3); break;
        case '-': case '_': state.zoom = clamp(state.zoom * 0.95, 0.5, 3); break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        clampOffsets();
        zoomRange.value = Math.round(state.zoom * 100);
        $('#zoomValue').textContent = zoomRange.value + '%';
        paintRange(zoomRange);
        scheduleRender();
      }
    });
  }

  function clampOffsets() {
    state.offsetX = clamp(state.offsetX, -0.35, 0.35);
    state.offsetY = clamp(state.offsetY, -0.35, 0.35);
  }

  function resetTransform() {
    state.zoom = 1;
    state.offsetX = 0;
    state.offsetY = 0;
    state.rotation = 0;
    state.flipH = false;
    $('#zoomRange').value = 100;
    $('#rotateRange').value = 0;
    paintRange($('#zoomRange'));
    paintRange($('#rotateRange'));
    $('#zoomValue').textContent = '100%';
    $('#rotateValue').textContent = '0°';
    $('#btnFlip').classList.remove('is-on');
    $('#btnFlip').setAttribute('aria-pressed', 'false');
    scheduleRender();
  }

  /* ================= Frame picker ================= */
  function bindFramePicker() {
    var grid = $('#frameGrid');
    window.HXFrames.FRAMES.forEach(function (frame) {
      var btn = document.createElement('button');
      btn.className = 'frame-item';
      btn.type = 'button';
      btn.setAttribute('data-frame', frame.id);
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Chọn khung ' + frame.name);
      btn.innerHTML =
        '<span class="frame-thumb"><canvas width="220" height="220"></canvas></span>' +
        '<span class="frame-meta"><strong></strong><small></small></span>' +
        '<span class="frame-check" aria-hidden="true">✓</span>';
      $('strong', btn).textContent = frame.name;
      $('small', btn).textContent = frame.vi;
      btn.addEventListener('click', function () {
        state.frame = frame.id;
        renderFrameThumbs();
        renderStage();
      });
      grid.appendChild(btn);
    });
  }

  /* ================= Export ================= */
  function renderExport() {
    var S = state.exportSize;
    var canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    var ctx = canvas.getContext('2d');
    var opts = state.exportFormat === 'jpeg' ? { background: '#10233B' } : null;
    window.HXFrames.renderComposite(ctx, S, state.img, transform(), state.frame, assets, opts);
    return canvas;
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function exportFileName(ext) {
    var stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return 'hackunix-avatar-' + state.frame + '-' + state.exportSize + '-' + stamp + '.' + ext;
  }

  function bindExport() {
    $$('.size-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.exportSize = Number(btn.getAttribute('data-size'));
        $$('.size-pill').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      });
    });

    $('#btnDownloadPng').addEventListener('click', function (e) {
      state.exportFormat = 'png';
      var canvas = renderExport();
      canvas.toBlob(function (blob) {
        if (!blob) { toast('Ôi, trình duyệt không tạo được ảnh.', 'error'); return; }
        triggerDownload(blob, exportFileName('png'));
        sparkleBurst(e.currentTarget);
        toast('Đã tải PNG trong suốt ' + state.exportSize + '×' + state.exportSize + '!', 'success');
      }, 'image/png');
    });

    $('#btnDownloadJpeg').addEventListener('click', function (e) {
      state.exportFormat = 'jpeg';
      var canvas = renderExport();
      canvas.toBlob(function (blob) {
        if (!blob) { toast('Ôi, trình duyệt không tạo được ảnh.', 'error'); return; }
        triggerDownload(blob, exportFileName('jpg'));
        sparkleBurst(e.currentTarget);
        toast('Đã tải JPEG (nền tối) cho nền tảng không hỗ trợ PNG alpha.', 'success');
      }, 'image/jpeg', 0.92);
    });

    $('#btnCopy').addEventListener('click', function () {
      state.exportFormat = 'png';
      var canvas = renderExport();
      canvas.toBlob(function (blob) {
        if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
          toast('Trình duyệt chưa hỗ trợ copy ảnh — hãy dùng nút Tải PNG.', 'error');
          return;
        }
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () {
          toast('Đã copy ảnh vào clipboard — Ctrl/Cmd + V để dán!', 'success');
        }).catch(function () {
          toast('Không copy được — hãy thử nút Tải PNG.', 'error');
        });
      }, 'image/png');
    });
  }

  /* ================= Social preview tabs ================= */
  function bindSocialTabs() {
    $$('.sp-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-target');
        $$('.sp-tab').forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        $$('.mock').forEach(function (panel) {
          panel.classList.toggle('is-active', panel.id === target);
        });
      });
    });
  }

  /* ================= FAQ ================= */
  function bindFaq() {
    $$('.faq-question').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.faq-item');
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* ================= Boot ================= */
  function boot() {
    bindUpload();
    bindCropControls();
    bindFramePicker();
    bindExport();
    bindSocialTabs();
    bindFaq();

    // Logo trắng (asset chính chủ của repo)
    var logo = new Image();
    logo.onload = function () { assets.logo = logo; renderAll(); };
    logo.onerror = function () { toast('Không tải được logo HackUNIX.', 'error'); renderAll(); };
    logo.src = 'HackUNIX_logo_white.png';

    // 4 khung kawaii (raster art đã tách nền + khoét lỗ)
    (window.HXFrames.ART_SOURCES || []).forEach(function (item) {
      var art = new Image();
      art.onload = function () { assets.frameArts[item.id] = art; renderAll(); };
      art.onerror = function () { console.warn('Không tải được art khung: ' + item.src); };
      art.src = item.src;
    });

    // Ảnh mẫu: zoom sâu để chân dung lấp đầy khung, không bị nền tròn bên trong ảnh làm rối
    var demo = new Image();
    demo.onload = function () {
      if (state.isDemo) {
        state.img = demo;
        state.zoom = DEMO_ZOOM;
        $('#zoomRange').value = Math.round(DEMO_ZOOM * 100);
        $('#zoomValue').textContent = Math.round(DEMO_ZOOM * 100) + '%';
        paintRange($('#zoomRange'));
        renderAll();
      }
    };
    demo.src = 'assets/img/demo-avatar.jpg';

    // Đợi font Baloo 2 để canvas vẽ chữ đúng kiểu
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { renderAll(); });
    }
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
