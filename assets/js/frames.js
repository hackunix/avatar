/**
 * HackUNIX Avatar Frame — Canvas rendering engine (v3 · kawaii edition)
 *
 * Hai loại khung:
 *   A) Raster kawaii: tranh minh hoạ AI (đã tách nền + khoét lỗ tròn),
 *      ghép với ảnh user bằng phép chiếu hole → photoR. Logo HackUNIX
 *      luôn là PNG chính chủ, vẽ đè lên badge → nét ở mọi độ phân giải.
 *   B) Vector procedural: Classic HPU & Gold Member (huy hiệu, nguyệt quế).
 *
 * Pipeline composite: photo (clip circle + vignette) → frame art → badge.
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var TOP = -Math.PI / 2;

  /* ================= Metrics (đồng nhất mọi độ phân giải) ================= */
  function metrics(S) {
    var c = S / 2;
    var photoR = S * 0.3;
    var outerR = S * 0.42;
    var ringMid = (photoR + outerR) / 2;
    var band = outerR - photoR;
    return { c: c, photoR: photoR, outerR: outerR, ringMid: ringMid, band: band };
  }

  function badgePos(m) {
    return { x: m.c, y: m.c + m.ringMid - m.band * 0.04 };
  }

  function font(weight, size) {
    return weight + ' ' + Math.round(size) + 'px "Baloo 2", "Be Vietnam Pro", sans-serif';
  }

  /* ================= Helpers cơ bản ================= */
  function strokeCircle(ctx, x, y, r, width, style, shadow) {
    ctx.save();
    if (shadow) {
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetX = shadow.offsetX || 0;
      ctx.shadowOffsetY = shadow.offsetY || 0;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.stroke();
    ctx.restore();
  }

  function pinstripe(ctx, x, y, r, width, dashA, dashB, style, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.setLineDash([dashA, dashB]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.stroke();
    ctx.restore();
  }

  function ringGradient(ctx, S, stops) {
    var g = ctx.createLinearGradient(0, 0, S, S);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }

  function radialFill(ctx, x, y, r, stops) {
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }

  function star4(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    var k = r * 0.22;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(k, -k); ctx.lineTo(r, 0); ctx.lineTo(k, k);
    ctx.lineTo(0, r); ctx.lineTo(-k, k); ctx.lineTo(-r, 0); ctx.lineTo(-k, -k);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function pointOn(c, radius, angle) {
    return { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) };
  }

  function glossArc(ctx, m, a0, a1, widthRatio, alpha, blurRatio) {
    var c = m.c;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = m.band * (blurRatio == null ? 0.42 : blurRatio);
    ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.lineWidth = m.band * widthRatio;
    ctx.beginPath();
    ctx.arc(c, c, m.ringMid, a0, a1);
    ctx.stroke();
    ctx.restore();
  }

  function arcText(ctx, text, cx, cy, radius, centerAngle, spread, fontStr, fill, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = fontStr;
    ctx.fillStyle = fill;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (opts.shadowColor) {
      ctx.shadowColor = opts.shadowColor;
      ctx.shadowBlur = opts.shadowBlur || 10;
      ctx.shadowOffsetY = opts.shadowOffsetY || 0;
    }
    var chars = Array.from(text);
    var step = chars.length > 1 ? spread / (chars.length - 1) : 0;
    var a = centerAngle - spread / 2;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch !== ' ') {
        ctx.save();
        ctx.translate(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      a += step;
    }
    ctx.restore();
  }

  function arcStars(ctx, c, radius, centerAngle, spreadHalf, r, color, alpha) {
    var p1 = pointOn(c, radius, centerAngle - spreadHalf);
    var p2 = pointOn(c, radius, centerAngle + spreadHalf);
    star4(ctx, p1.x, p1.y, r, color, alpha);
    star4(ctx, p2.x, p2.y, r, color, alpha);
  }

  /* Specular gloss trên badge (vẽ TRƯỚC logo) */
  function badgeGloss(ctx, x, y, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.96, 0, TAU);
    ctx.clip();
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.05, x - r * 0.35, y - r * 0.45, r * 1.1);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  /* Huy hiệu tròn nhiều lớp chứa logo (dùng cho classic/gold) */
  function drawBadge(ctx, x, y, r, opts) {
    opts = opts || {};
    var S = opts.S || r * 8;

    ctx.save();
    ctx.shadowColor = 'rgba(7, 30, 60, 0.42)';
    ctx.shadowBlur = r * 0.4;
    ctx.shadowOffsetY = r * 0.1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = opts.fill;
    ctx.fill();
    ctx.restore();

    if (opts.outerRim) {
      strokeCircle(ctx, x, y, r + S * 0.004, S * 0.006, opts.outerRim);
    }
    if (opts.rim) {
      var rw = opts.rimWidth || S * 0.012;
      strokeCircle(ctx, x, y, r - rw / 2, rw, opts.rim, opts.rimGlow ? { color: opts.rimGlow, blur: S * 0.03 } : null);
    }
    if (opts.innerRim) {
      pinstripe(ctx, x, y, r * 0.8, S * 0.006, S * 0.03, S * 0.02, opts.innerRim, 0.9);
    }
    badgeGloss(ctx, x, y, r);

    var logo = opts.logo;
    if (logo && logo.complete && logo.naturalWidth > 0) {
      var scale = opts.logoScale || 0.6;
      var lw = r * 2 * scale;
      var lh = lw * (logo.naturalHeight / logo.naturalWidth);
      ctx.save();
      if (opts.logoGlow) {
        ctx.shadowColor = opts.logoGlow;
        ctx.shadowBlur = r * 0.25;
      }
      ctx.drawImage(logo, x - lw / 2, y - lh / 2, lw, lh);
      ctx.restore();
    }
  }

  /* ================= Badge kawaii: die-cut trắng + thân xanh HackUNIX ================= */
  function drawKawaiiBadge(ctx, S, assets) {
    var m = metrics(S);
    var b = badgePos(m);
    var r = S * 0.104;

    // 1) Viền navy ngoài cùng (mēp sticker)
    strokeCircle(ctx, b.x, b.y, r + S * 0.0295, S * 0.005, '#1B2B4A');
    // 2) Viền die-cut trắng dày
    strokeCircle(ctx, b.x, b.y, r + S * 0.0135, S * 0.028, '#FFFFFF',
      { color: 'rgba(7,30,60,0.4)', blur: S * 0.015, offsetY: S * 0.005 });
    // 3) Thân xanh HackUNIX (radial)
    ctx.save();
    ctx.shadowColor = 'rgba(7, 30, 60, 0.42)';
    ctx.shadowBlur = r * 0.32;
    ctx.shadowOffsetY = r * 0.09;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, TAU);
    ctx.fillStyle = radialFill(ctx, b.x, b.y, r, [[0, '#4DA3FF'], [0.5, '#1D5BD8'], [1, '#16427F']]);
    ctx.fill();
    ctx.restore();
    // 4) Rim navy trong cùng
    strokeCircle(ctx, b.x, b.y, r - S * 0.002, S * 0.008, '#0E2E5C');
    // 5) Gloss + logo chính chủ
    badgeGloss(ctx, b.x, b.y, r);
    var logo = assets.logo;
    if (logo && logo.complete && logo.naturalWidth > 0) {
      var lw = r * 2 * 0.64;
      var lh = lw * (logo.naturalHeight / logo.naturalWidth);
      ctx.drawImage(logo, b.x - lw / 2, b.y - lh / 2, lw, lh);
    }
    // 6) Sparkle hồng nhỏ trên mép badge
    star4(ctx, b.x - r * 0.78, b.y - r * 0.82, S * 0.017, '#FF9EC6', 0.98);
    star4(ctx, b.x + r * 0.82, b.y - r * 0.55, S * 0.012, '#FFFFFF', 0.95);
  }

  /* ================= Vignette trong mép ảnh ================= */
  function photoVignette(ctx, S, m) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.c, m.c, m.photoR, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = 'rgba(6, 22, 40, 0.3)';
    ctx.lineWidth = S * 0.045;
    ctx.shadowColor = 'rgba(6, 22, 40, 0.55)';
    ctx.shadowBlur = S * 0.03;
    ctx.beginPath();
    ctx.arc(m.c, m.c, m.photoR - S * 0.018, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /* ================= Raster kawaii frames ================= */
  /**
   * hole: toạ độ + bán kính lỗ tròn (px) đo từ ảnh gốc (assets đã cắt nền/khoét lỗ)
   * scale: hệ số thu phóng thêm để doodle không chạm mép canvas
   */
  var ART_DEFS = {
    candy:     { src: 'assets/img/frames/art-candy.png',     hole: { x: 703,   y: 391,   r: 204.5 }, scale: 0.86 },
    sleepycat: { src: 'assets/img/frames/art-sleepycat.png', hole: { x: 530.5, y: 512.5, r: 311.5 }, scale: 0.95 },
    mint:      { src: 'assets/img/frames/art-mint.png',      hole: { x: 702,   y: 383.5, r: 218.75 }, scale: 0.88 },
    tux:       { src: 'assets/img/frames/art-tux.png',       hole: { x: 708,   y: 383.5, r: 228.75 }, scale: 0.88 },
  };
  var ART_SOURCES = Object.keys(ART_DEFS).map(function (id) { return { id: id, src: ART_DEFS[id].src }; });

  function makeArtRenderer(id) {
    var def = ART_DEFS[id];
    return function (ctx, S, assets) {
      var m = metrics(S);
      var art = assets.frameArts && assets.frameArts[id];
      if (art && art.complete && art.naturalWidth) {
        var scale = (m.photoR / def.hole.r) * def.scale;
        var dw = art.naturalWidth * scale;
        var dh = art.naturalHeight * scale;
        ctx.save();
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(art, m.c - def.hole.x * scale, m.c - def.hole.y * scale, dw, dh);
        ctx.restore();
      } else {
        // Fallback: ring xanh đơn giản nếu art chưa tải xong
        strokeCircle(ctx, m.c, m.c, m.ringMid, m.band * 0.96,
          ringGradient(ctx, S, [[0, '#4DA3FF'], [1, '#1D5BD8']]));
      }
      drawKawaiiBadge(ctx, S, assets);
    };
  }

  /* ================= Classic HPU (vector) ================= */
  function renderClassic(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#9BDCFF'], [0.28, '#4DA3FF'], [0.55, '#2E6FD8'], [0.8, '#174CBC'], [1, '#0E3A74']]));
    glossArc(ctx, m, Math.PI * 1.04, Math.PI * 1.42, 0.52, 0.55);
    glossArc(ctx, m, Math.PI * 1.46, Math.PI * 1.5, 0.3, 0.35, 0.25);
    strokeCircle(ctx, c, c, m.outerR - S * 0.008, S * 0.016, '#0A2E5C');
    pinstripe(ctx, c, c, m.outerR - S * 0.036, S * 0.005, S * 0.016, S * 0.02, '#FFFFFF', 0.55);
    strokeCircle(ctx, c, c, m.photoR + S * 0.006, S * 0.012, 'rgba(255,255,255,0.96)');
    strokeCircle(ctx, c, c, m.photoR + S * 0.018, S * 0.004, 'rgba(14,58,116,0.55)');
    var spread = 2.0;
    arcText(ctx, 'CLB MÁY TÍNH HPU', c, c, m.ringMid, TOP, spread,
      font(800, S * 0.0415), '#FFFFFF',
      { shadowColor: 'rgba(9,38,80,0.75)', shadowBlur: S * 0.009, shadowOffsetY: S * 0.004 });
    arcStars(ctx, c, m.ringMid, TOP, spread / 2 + 0.17, S * 0.02, '#FFD964', 0.98);
    var pl = pointOn(c, m.ringMid, Math.PI * 0.84), pr = pointOn(c, m.ringMid, Math.PI * 0.16);
    star4(ctx, pl.x, pl.y, S * 0.018, '#FFFFFF', 0.95);
    star4(ctx, pr.x, pr.y, S * 0.018, '#FFFFFF', 0.95);
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.112, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.112, [[0, '#6FBCFF'], [0.42, '#2E6FD8'], [1, '#0E3A74']]),
      outerRim: '#0A2E5C',
      rim: '#FFFFFF', rimWidth: S * 0.017,
      innerRim: 'rgba(255,255,255,0.55)',
      logo: assets.logo, logoScale: 0.6,
    });
    star4(ctx, b.x, b.y - S * 0.122, S * 0.017, '#FFFFFF', 0.95);
  }

  /* ================= Gold Member (vector · nguyệt quế) ================= */
  function laurel(ctx, S, m, color) {
    var c = m.c;
    [-1, 1].forEach(function (sign) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = S * 0.008;
      ctx.beginPath();
      ctx.arc(c, c, m.ringMid, Math.PI / 2 + sign * 0.3, Math.PI / 2 + sign * 1.32, sign < 0);
      ctx.stroke();
      ctx.restore();
      var leaves = 9;
      for (var i = 0; i < leaves; i++) {
        var t = i / (leaves - 1);
        var ang = Math.PI / 2 + sign * (0.32 + t * 0.98);
        var rad = m.ringMid;
        var x = c + rad * Math.cos(ang);
        var y = c + rad * Math.sin(ang);
        var leaf = S * 0.0175 * (1 - t * 0.25);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang + Math.PI / 2 + sign * 0.85);
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf, leaf * 0.3, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#FFF6B8';
        ctx.beginPath();
        ctx.ellipse(-leaf * 0.15, -leaf * 0.1, leaf * 0.55, leaf * 0.1, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  function renderGold(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [
        [0, '#FFF8C4'], [0.18, '#F7DE7A'], [0.36, '#E9BE52'], [0.5, '#B87F22'],
        [0.64, '#E9BE52'], [0.8, '#FFF3A0'], [1, '#8A5A00'],
      ]));
    glossArc(ctx, m, Math.PI * 1.05, Math.PI * 1.45, 0.5, 0.65);
    strokeCircle(ctx, c, c, m.outerR - S * 0.008, S * 0.016, '#4A3200');
    pinstripe(ctx, c, c, m.outerR - S * 0.037, S * 0.006, S * 0.012, S * 0.02, '#5C3D00', 0.75);
    strokeCircle(ctx, c, c, m.photoR + S * 0.007, S * 0.012, '#FFFBE0');
    laurel(ctx, S, m, '#5C3D00');
    var spread = 1.9;
    arcText(ctx, 'GOLD MEMBER', c, c, m.ringMid, TOP, spread,
      font(800, S * 0.04), '#3D2B00',
      { shadowColor: 'rgba(255,248,196,0.75)', shadowBlur: S * 0.008, shadowOffsetY: S * 0.002 });
    arcStars(ctx, c, m.ringMid, TOP, spread / 2 + 0.15, S * 0.018, '#4A3200', 0.9);
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.112, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.112, [[0, '#27325A'], [0.55, '#131C38'], [1, '#05070F']]),
      outerRim: '#4A3200',
      rim: '#FFE98A', rimWidth: S * 0.017,
      innerRim: 'rgba(255,233,138,0.55)',
      logo: assets.logo, logoScale: 0.6,
    });
    star4(ctx, b.x, b.y - S * 0.122, S * 0.019, '#FFE98A', 0.98);
  }

  /* ================= Composite pipeline ================= */
  function drawPhoto(ctx, S, image, t) {
    var m = metrics(S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.c, m.c, m.photoR, 0, TAU);
    ctx.clip();

    if (image && image.naturalWidth) {
      var iw = image.naturalWidth, ih = image.naturalHeight;
      var cover = Math.max((m.photoR * 2) / iw, (m.photoR * 2) / ih);
      var k = cover * (t.zoom || 1);
      ctx.translate(m.c + (t.offsetX || 0) * S, m.c + (t.offsetY || 0) * S);
      ctx.rotate(((t.rotation || 0) * Math.PI) / 180);
      ctx.scale(k * (t.flipH ? -1 : 1), k);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih);
    } else {
      var g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#D7EBFF');
      g.addColorStop(1, '#8FC4EF');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(m.c, m.c - S * 0.045, S * 0.093, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(m.c, m.c + S * 0.155, S * 0.155, S * 0.128, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
    photoVignette(ctx, S, m);
  }

  function renderComposite(ctx, S, image, t, frameId, assets, opts) {
    ctx.save();
    opts = opts || {};
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, S, S);
    } else {
      ctx.clearRect(0, 0, S, S);
    }
    t = t || {};
    drawPhoto(ctx, S, image, t);
    var frame = FRAMES.filter(function (f) { return f.id === frameId; })[0] || FRAMES[0];
    frame.render(ctx, S, assets || {});
    ctx.restore();
  }

  var FRAMES = [
    { id: 'candy',     name: 'Kẹo Soda',      vi: 'Bubble tea + jelly hồng',   render: makeArtRenderer('candy') },
    { id: 'sleepycat', name: 'Mèo Ngủ Gật',   vi: 'Boss nấp trên đám mây',     render: makeArtRenderer('sleepycat') },
    { id: 'mint',      name: 'Hành Tinh Mint', vi: 'Tên lửa du hành vũ trụ',    render: makeArtRenderer('mint') },
    { id: 'tux',       name: 'Tux Hacker',     vi: 'Penguin hoodie + mạch điện', render: makeArtRenderer('tux') },
    { id: 'classic',   name: 'Classic HPU',    vi: 'Bản sắc CLB nghiêm túc',    render: renderClassic },
    { id: 'gold',      name: 'Gold Member',    vi: 'Nguyệt quế cho nòng cốt',   render: renderGold },
  ];

  global.HXFrames = {
    FRAMES: FRAMES,
    ART_SOURCES: ART_SOURCES,
    metrics: metrics,
    renderComposite: renderComposite,
  };
})(window);
