/**
 * HackUNIX Avatar Frame — Canvas rendering engine (v2)
 *
 * Triết lý thiết kế: minh hoạ vector nhiều lớp, có chiều sâu:
 *   photo + inner vignette → ring gradient đa stop + gloss 3D →
 *   rim/pinstripe → hoạ tiết procedural (seeded, deterministic) →
 *   arc text → badge nhiều lớp + gloss.
 * Logo HackUNIX luôn là PNG chính chủ → sắc nét ở mọi độ phân giải.
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var TOP = -Math.PI / 2;

  /* ================= Metrics ================= */
  function metrics(S) {
    var c = S / 2;
    var photoR = S * 0.3;
    var outerR = S * 0.42;
    var ringMid = (photoR + outerR) / 2;
    var band = outerR - photoR;
    return { c: c, photoR: photoR, outerR: outerR, ringMid: ringMid, band: band };
  }

  /* ================= Seeded RNG (hoạ tiết cố định, không nhảy lung tung) ================= */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function angleDiff(a, b) {
    var d = Math.abs(((a - b) % TAU + TAU * 1.5) % TAU - Math.PI);
    return d;
  }

  /* ================= Base helpers ================= */
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

  function heart(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.32);
    ctx.bezierCurveTo(-s, -s * 0.28, -s * 0.62, -s * 0.95, 0, -s * 0.35);
    ctx.bezierCurveTo(s * 0.62, -s * 0.95, s, -s * 0.28, 0, s * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function pointOn(c, radius, angle) {
    return { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) };
  }

  /* Gloss 3D trên ring: cung sáng mờ ở góc trên-trái */
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

  /* Confetti chấm màu seeded trên ring; né vùng chữ arc phía trên */
  function confettiRing(ctx, S, m, seed, colors, count, zoneTop) {
    var r = rng(seed);
    var c = m.c;
    for (var i = 0; i < count; i++) {
      var a = r() * TAU;
      if (zoneTop && angleDiff(a, TOP) < zoneTop) continue;
      var rad = m.photoR + m.band * (0.3 + r() * 0.42);
      var size = S * (0.006 + r() * 0.011);
      ctx.save();
      ctx.globalAlpha = 0.55 + r() * 0.45;
      ctx.fillStyle = colors[Math.floor(r() * colors.length)];
      ctx.beginPath();
      ctx.arc(c + rad * Math.cos(a), c + rad * Math.sin(a), size, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /* Mạch điện tử seeded trên ring tối (Midnight) — né vùng chữ arc phía trên */
  function circuitRing(ctx, S, m, seed, color) {
    var r = rng(seed);
    var c = m.c;
    var traces = 9, placed = 0, guard = 0;
    while (placed < traces && guard++ < 60) {
      var rad = m.ringMid + (r() - 0.5) * m.band * 0.5;
      var a0 = r() * TAU;
      var span = 0.16 + r() * 0.34;
      var mid = a0 + span / 2;
      // Bỏ qua nếu mạch đè vùng chữ phía trên (±1.25 rad quanh đỉnh)
      if (angleDiff(mid, TOP) < 1.25 + span / 2) continue;
      placed++;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = S * 0.0065;
      ctx.beginPath();
      ctx.arc(c, c, rad, a0, a0 + span);
      ctx.stroke();
      // nhánh toả là (stub) ở 2 đầu mạch
      [a0, a0 + span].forEach(function (a) {
        var dir = r() > 0.5 ? 1 : -1;
        var r2 = rad + dir * m.band * (0.18 + r() * 0.2);
        ctx.globalAlpha = 0.38;
        ctx.beginPath();
        ctx.moveTo(c + rad * Math.cos(a), c + rad * Math.sin(a));
        ctx.lineTo(c + r2 * Math.cos(a), c + r2 * Math.sin(a));
        ctx.stroke();
        // node chấm tròn + glow
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = color;
        ctx.shadowBlur = S * 0.012;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(c + rad * Math.cos(a), c + rad * Math.sin(a), S * 0.0075, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.restore();
    }
  }

  /* Vòng nguyệt quế (Gold) — thân cành cung mảnh + lá nhỏ thon dọc theo */
  function laurel(ctx, S, m, color) {
    var c = m.c;
    [-1, 1].forEach(function (sign) {
      // Thân cành
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = S * 0.008;
      ctx.beginPath();
      ctx.arc(c, c, m.ringMid, Math.PI / 2 + sign * 0.3, Math.PI / 2 + sign * 1.32, sign < 0);
      ctx.stroke();
      ctx.restore();
      // Lá nhỏ thon, xếp dọc thân cành
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
        // Gân lá sáng
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#FFF6B8';
        ctx.beginPath();
        ctx.ellipse(-leaf * 0.15, -leaf * 0.1, leaf * 0.55, leaf * 0.1, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  /* Chữ chạy vòng cung, có tuỳ chọn bóng & letterspacing */
  function arcText(ctx, text, cx, cy, radius, centerAngle, spread, font, fill, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = font;
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

  /* Sao 4 cánh flanking vùng chữ arc */
  function arcStars(ctx, c, radius, centerAngle, spreadHalf, r, color, alpha) {
    var p1 = pointOn(c, radius, centerAngle - spreadHalf);
    var p2 = pointOn(c, radius, centerAngle + spreadHalf);
    star4(ctx, p1.x, p1.y, r, color, alpha);
    star4(ctx, p2.x, p2.y, r, color, alpha);
  }

  /* Mây nhiều lớp (Sky Poster) — có bóng đổ dưới */
  function cloudPuff(ctx, x, y, r, flip) {
    var blobs = [
      [0, 0.18, 1.15, 0.6],
      [-0.62, 0.3, 0.6, 0.44],
      [0.62, 0.3, 0.6, 0.44],
      [-0.33, -0.18, 0.52, 0.48],
      [0.34, -0.2, 0.55, 0.5],
      [0.02, -0.37, 0.48, 0.45],
    ];
    function pass(dy, style) {
      ctx.fillStyle = style;
      ctx.beginPath();
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        ctx.ellipse(x + b[0] * r, y + (b[1] + dy) * r, b[2] * r, b[3] * r, 0, 0, TAU);
      }
      ctx.fill();
    }
    ctx.save();
    if (flip) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    pass(0.16, 'rgba(46,111,216,0.22)');
    pass(0, '#FFFFFF');
    // highlights mặt mây
    ctx.globalAlpha = 0.85;
    pass(-0.14, '#FFFFFF');
    ctx.restore();
  }

  /* Gloss specular trên badge (vẽ TRƯỚC logo để logo vẫn nét) */
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

  /* Huy hiệu tròn nhiều lớp chứa logo */
  function drawBadge(ctx, x, y, r, opts) {
    opts = opts || {};
    var S = opts.S || r * 8;

    // 1) Bóng đổ tổng thể
    ctx.save();
    ctx.shadowColor = 'rgba(7, 30, 60, 0.42)';
    ctx.shadowBlur = r * 0.4;
    ctx.shadowOffsetY = r * 0.1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = opts.fill;
    ctx.fill();
    ctx.restore();

    // 2) Viền ngoài mảnh (tuỳ chọn)
    if (opts.outerRim) {
      strokeCircle(ctx, x, y, r + S * 0.004, S * 0.006, opts.outerRim);
    }
    // 3) Viền chính (rim)
    if (opts.rim) {
      var rw = opts.rimWidth || S * 0.012;
      strokeCircle(ctx, x, y, r - rw / 2, rw, opts.rim, opts.rimGlow ? { color: opts.rimGlow, blur: S * 0.03 } : null);
    }
    // 4) Vòng trong mảnh
    if (opts.innerRim) {
      pinstripe(ctx, x, y, r * 0.8, S * 0.006, S * 0.03, S * 0.02, opts.innerRim, 0.9);
    }
    // 5) Specular gloss
    badgeGloss(ctx, x, y, r);
    // 6) Logo chính chủ (trắng)
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

  function badgePos(m) {
    return { x: m.c, y: m.c + m.ringMid };
  }

  function font(weight, size) {
    return weight + ' ' + Math.round(size) + 'px "Baloo 2", "Be Vietnam Pro", sans-serif';
  }

  /* ================= Vignette trong mép ảnh (mọi frame) ================= */
  function photoVignette(ctx, S, m) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.c, m.c, m.photoR, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = 'rgba(6, 22, 40, 0.32)';
    ctx.lineWidth = S * 0.045;
    ctx.shadowColor = 'rgba(6, 22, 40, 0.55)';
    ctx.shadowBlur = S * 0.03;
    ctx.beginPath();
    ctx.arc(m.c, m.c, m.photoR - S * 0.018, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /* =====================================================
     6 KHUNG — mỗi khung = 1 ngôn ngữ minh hoạ riêng
     ===================================================== */

  function renderClassic(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    // Ring: 5 stop với sheen giữa thân
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#9BDCFF'], [0.28, '#4DA3FF'], [0.55, '#2E6FD8'], [0.8, '#174CBC'], [1, '#0E3A74']]));
    // Gloss 3D góc trên-trái + chấm lóa nhỏ
    glossArc(ctx, m, Math.PI * 1.04, Math.PI * 1.42, 0.52, 0.55);
    glossArc(ctx, m, Math.PI * 1.46, Math.PI * 1.5, 0.3, 0.35, 0.25);
    // Rim ngoài + pinstripe đứt nét kiểu huy hiệu
    strokeCircle(ctx, c, c, m.outerR - S * 0.008, S * 0.016, '#0A2E5C');
    pinstripe(ctx, c, c, m.outerR - S * 0.036, S * 0.005, S * 0.016, S * 0.02, '#FFFFFF', 0.55);
    // Rim trong: trắng + hairline navy
    strokeCircle(ctx, c, c, m.photoR + S * 0.006, S * 0.012, 'rgba(255,255,255,0.96)');
    strokeCircle(ctx, c, c, m.photoR + S * 0.018, S * 0.004, 'rgba(14,58,116,0.55)');
    // Chữ + sao flanking (thay glyph ★ không đồng nhất giữa các máy)
    var spread = 2.0;
    arcText(ctx, 'CLB MÁY TÍNH HPU', c, c, m.ringMid, TOP, spread,
      font(800, S * 0.0415), '#FFFFFF',
      { shadowColor: 'rgba(9,38,80,0.75)', shadowBlur: S * 0.009, shadowOffsetY: S * 0.004 });
    arcStars(ctx, c, m.ringMid, TOP, spread / 2 + 0.17, S * 0.02, '#FFD964', 0.98);
    // Sparkles thân khung
    var pl = pointOn(c, m.ringMid, Math.PI * 0.84), pr = pointOn(c, m.ringMid, Math.PI * 0.16);
    star4(ctx, pl.x, pl.y, S * 0.018, '#FFFFFF', 0.95);
    star4(ctx, pr.x, pr.y, S * 0.018, '#FFFFFF', 0.95);
    // Badge: trắng rim + thân blue gradient + gloss + logo
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#6FBCFF'], [0.42, '#2E6FD8'], [1, '#0E3A74']]),
      outerRim: '#0A2E5C',
      rim: '#FFFFFF', rimWidth: S * 0.017,
      innerRim: 'rgba(255,255,255,0.55)',
      logo: assets.logo, logoScale: 0.6,
    });
    star4(ctx, b.x, b.y - S * 0.128, S * 0.017, '#FFFFFF', 0.95);
  }

  function renderRecruit(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    // Ring hoàng hôn: vàng → cam → coral
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#FFE879'], [0.3, '#FFB03A'], [0.62, '#FF7A45'], [1, '#FF4D4D']]));
    glossArc(ctx, m, Math.PI * 1.05, Math.PI * 1.45, 0.5, 0.6);
    strokeCircle(ctx, c, c, m.outerR - S * 0.008, S * 0.016, '#8A2A0E');
    pinstripe(ctx, c, c, m.outerR - S * 0.036, S * 0.005, S * 0.014, S * 0.022, '#FFFFFF', 0.6);
    strokeCircle(ctx, c, c, m.photoR + S * 0.006, S * 0.012, 'rgba(255,255,255,0.96)');
    // Confetti lễ hội (né vùng chữ trên)
    confettiRing(ctx, S, m, 20262026, ['#FFFFFF', '#FFE879', '#7DD3FC', '#34D399', '#F9A8D4'], 18, 1.35);
    var spread = 2.35;
    arcText(ctx, 'TUYỂN THÀNH VIÊN 2026', c, c, m.ringMid, TOP, spread,
      font(800, S * 0.0365), '#FFFFFF',
      { shadowColor: 'rgba(122,42,14,0.8)', shadowBlur: S * 0.009, shadowOffsetY: S * 0.004 });
    arcStars(ctx, c, m.ringMid, TOP, spread / 2 + 0.14, S * 0.019, '#FFFFFF', 0.95);
    // Badge xanh đối lập với ring nắng
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#5FB2FF'], [0.45, '#1D5BD8'], [1, '#0E3A74']]),
      outerRim: '#8A2A0E',
      rim: '#FFE879', rimWidth: S * 0.018,
      innerRim: 'rgba(255,232,121,0.6)',
      logo: assets.logo, logoScale: 0.6,
    });
  }

  function renderMidnight(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    // Ring tối — nền cho mạch điện tử
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#26355E'], [0.45, '#141F3D'], [1, '#060C1F']]));
    // Mạch điện tử procedural (seed cố định)
    circuitRing(ctx, S, m, 60210, '#2BE4F0');
    // Gloss cyan mảnh
    glossArc(ctx, m, Math.PI * 1.08, Math.PI * 1.4, 0.3, 0.3, 0.3);
    // Rim neon hai lớp: glow ngoài + lõi sáng
    strokeCircle(ctx, c, c, m.outerR - S * 0.005, S * 0.012, '#2BE4F0',
      { color: 'rgba(43,228,240,0.95)', blur: S * 0.032 });
    strokeCircle(ctx, c, c, m.outerR - S * 0.005, S * 0.004, '#D8FBFF');
    strokeCircle(ctx, c, c, m.photoR + S * 0.004, S * 0.008, 'rgba(125,243,255,0.95)',
      { color: 'rgba(43,228,240,0.85)', blur: S * 0.024 });
    // Chữ neon phát sáng mạnh
    var spread = 1.7;
    arcText(ctx, 'H A C K U N I X', c, c, m.ringMid, TOP, spread,
      font(800, S * 0.037), '#A5F8FF',
      { shadowColor: 'rgba(43,228,240,1)', shadowBlur: S * 0.03 });
    arcStars(ctx, c, m.ringMid, TOP, spread / 2 + 0.15, S * 0.016, '#2BE4F0', 0.9);
    // Badge: kính tối + rim neon + logo phát sáng
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#14214A'], [0.6, '#0A1230'], [1, '#040915']]),
      rim: '#2BE4F0', rimWidth: S * 0.01, rimGlow: 'rgba(43,228,240,0.8)',
      innerRim: 'rgba(43,228,240,0.5)',
      logo: assets.logo, logoScale: 0.6,
      logoGlow: 'rgba(125,243,255,0.75)',
    });
  }

  function renderPoster(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    // Ring trời xanh pastel như poster
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#F4FCFF'], [0.35, '#C4E9FF'], [0.75, '#8ECDF6'], [1, '#5FA8E8']]));
    glossArc(ctx, m, Math.PI * 1.05, Math.PI * 1.45, 0.48, 0.7);
    strokeCircle(ctx, c, c, m.outerR - S * 0.005, S * 0.011, 'rgba(255,255,255,0.98)');
    strokeCircle(ctx, c, c, m.outerR - S * 0.028, S * 0.004, 'rgba(22,66,127,0.3)');
    strokeCircle(ctx, c, c, m.photoR + S * 0.006, S * 0.012, '#FFFFFF');
    // Stitch dashed trắng trên ring
    pinstripe(ctx, c, c, m.ringMid, S * 0.005, S * 0.018, S * 0.024, '#FFFFFF', 0.9);
    // Chữ navy đậm đặc trưng poster
    var spread = 1.55;
    arcText(ctx, 'HACKUNIX', c, c, m.ringMid, TOP, spread,
      font(800, S * 0.049), '#16427F',
      { shadowColor: 'rgba(255,255,255,0.9)', shadowBlur: S * 0.012 });
    arcStars(ctx, c, m.ringMid, TOP, spread / 2 + 0.18, S * 0.018, '#FFFFFF', 0.95);
    // Mây hai bên (2 lớp: bóng + thân + highlight)
    cloudPuff(ctx, c - m.ringMid, c + S * 0.012, S * 0.045, false);
    cloudPuff(ctx, c + m.ringMid, c + S * 0.012, S * 0.045, true);
    // Tim coral + sparkles như poster
    var h1 = pointOn(c, m.ringMid, Math.PI * 0.72), h2 = pointOn(c, m.ringMid, Math.PI * 0.28);
    heart(ctx, h1.x, h1.y, S * 0.016, '#FF6B4A', 0.96);
    heart(ctx, h2.x, h2.y, S * 0.016, '#FF6B4A', 0.96);
    var p1 = pointOn(c, m.ringMid, Math.PI * 0.88), p2 = pointOn(c, m.ringMid, Math.PI * 0.12);
    star4(ctx, p1.x, p1.y, S * 0.02, '#FFFFFF', 0.98);
    star4(ctx, p2.x, p2.y, S * 0.02, '#FFFFFF', 0.98);
    // Badge xanh + rim trắng + gloss
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#57A8FF'], [0.45, '#2E6FD8'], [1, '#16427F']]),
      outerRim: 'rgba(22,66,127,0.45)',
      rim: '#FFFFFF', rimWidth: S * 0.016,
      innerRim: 'rgba(255,255,255,0.6)',
      logo: assets.logo, logoScale: 0.6,
    });
  }

  function renderMinimal(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    // Ring trắng ngà, sheen dọc rõ + bóng mát tách khỏi nền
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.54,
      ringGradient(ctx, S, [[0, '#FFFFFF'], [0.5, '#E9F3FB'], [1, '#BDD6EA']]),
      { color: 'rgba(13,45,80,0.45)', blur: S * 0.024, offsetY: S * 0.006 });
    // Hairline kép cho cảm giác hoàn thiện cao cấp
    strokeCircle(ctx, c, c, m.outerR - S * 0.003, S * 0.005, '#A8C6DE');
    strokeCircle(ctx, c, c, m.photoR + S * 0.004, S * 0.0045, '#FFFFFF');
    strokeCircle(ctx, c, c, m.photoR + S * 0.014, S * 0.003, '#C2DCEC');
    // Badge navy đậm nhỏ, tối giản tuyệt đối, logo to dễ đọc
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.112, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.112, [[0, '#1F4E79'], [0.6, '#122E49'], [1, '#071A2B']]),
      rim: '#FFFFFF', rimWidth: S * 0.013,
      logo: assets.logo, logoScale: 0.68,
    });
  }

  function renderGold(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    // Ring vàng ánh kim nhiều dải (brushed metal giả lập)
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [
        [0, '#FFF8C4'], [0.18, '#F7DE7A'], [0.36, '#E9BE52'], [0.5, '#B87F22'],
        [0.64, '#E9BE52'], [0.8, '#FFF3A0'], [1, '#8A5A00'],
      ]));
    glossArc(ctx, m, Math.PI * 1.05, Math.PI * 1.45, 0.5, 0.65);
    strokeCircle(ctx, c, c, m.outerR - S * 0.008, S * 0.016, '#4A3200');
    pinstripe(ctx, c, c, m.outerR - S * 0.037, S * 0.006, S * 0.012, S * 0.02, '#5C3D00', 0.75);
    strokeCircle(ctx, c, c, m.photoR + S * 0.007, S * 0.012, '#FFFBE0');
    // Nguyệt quế hai bên đáy
    laurel(ctx, S, m, '#5C3D00');
    var spread = 1.9;
    arcText(ctx, 'GOLD MEMBER', c, c, m.ringMid, TOP, spread,
      font(800, S * 0.04), '#3D2B00',
      { shadowColor: 'rgba(255,248,196,0.75)', shadowBlur: S * 0.008, shadowOffsetY: S * 0.002 });
    arcStars(ctx, c, m.ringMid, TOP, spread / 2 + 0.15, S * 0.018, '#4A3200', 0.9);
    // Badge navy + rim vàng + logo
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#27325A'], [0.55, '#131C38'], [1, '#05070F']]),
      outerRim: '#4A3200',
      rim: '#FFE98A', rimWidth: S * 0.017,
      innerRim: 'rgba(255,233,138,0.55)',
      logo: assets.logo, logoScale: 0.6,
    });
    star4(ctx, b.x, b.y - S * 0.132, S * 0.019, '#FFE98A', 0.98);
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
    // Vignette mép ảnh cho chiều sâu
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
    { id: 'classic', name: 'Classic HPU', vi: 'Bản sắc huyền thoại CLB', render: renderClassic },
    { id: 'recruit', name: 'Tuyển TV 2026', vi: 'Sắc cam lễ hội tuyển quân', render: renderRecruit },
    { id: 'midnight', name: 'Midnight Hacker', vi: 'Mạch neon cho dân hacker', render: renderMidnight },
    { id: 'poster', name: 'Sky Poster', vi: 'Đúng chất poster sự kiện', render: renderPoster },
    { id: 'minimal', name: 'Minimal White', vi: 'Tối giản, sạch mọi nền', render: renderMinimal },
    { id: 'gold', name: 'Gold Member', vi: 'Nguyệt quế cho nòng cốt', render: renderGold },
  ];

  global.HXFrames = {
    FRAMES: FRAMES,
    metrics: metrics,
    renderComposite: renderComposite,
  };
})(window);
