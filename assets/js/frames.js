/**
 * HackUNIX Avatar Frame — Canvas rendering engine
 * Vẽ khung avatar + ảnh người dùng lên canvas ở mọi độ phân giải.
 * Toàn bộ hiệu ứng là vector (gradient, arc, star) → nét ở 2048px.
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var TOP = -Math.PI / 2;

  /* ---------------- Metrics (đồng nhất mọi độ phân giải) ---------------- */
  function metrics(S) {
    var c = S / 2;
    var photoR = S * 0.3;      // bán kính vùng ảnh (hình tròn)
    var outerR = S * 0.42;     // bán kính ngoài của khung
    var ringMid = (photoR + outerR) / 2;
    var band = outerR - photoR;
    return { c: c, photoR: photoR, outerR: outerR, ringMid: ringMid, band: band };
  }

  /* ---------------- Helpers ---------------- */
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

  /* Sao 4 cánh kiểu "sparkle" giống poster */
  function star4(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    var k = r * 0.22;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(k, -k);
    ctx.lineTo(r, 0);
    ctx.lineTo(k, k);
    ctx.lineTo(0, r);
    ctx.lineTo(-k, k);
    ctx.lineTo(-r, 0);
    ctx.lineTo(-k, -k);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function pointOn(c, radius, angle) {
    return { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) };
  }

  /* Text chạy vòng cung (tâm ở góc centerAngle, trải rộng spread) */
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

  /* Huy hiệu tròn chứa logo trắng ở đáy khung */
  function drawBadge(ctx, x, y, r, opts) {
    opts = opts || {};
    var S = opts.S || r * 8;

    // Đổ bóng + nền huy hiệu
    ctx.save();
    ctx.shadowColor = 'rgba(7, 30, 60, 0.4)';
    ctx.shadowBlur = r * 0.38;
    ctx.shadowOffsetY = r * 0.1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = opts.fill;
    ctx.fill();
    ctx.restore();

    // Viền huy hiệu
    if (opts.rim) {
      strokeCircle(ctx, x, y, r - (opts.rimWidth || S * 0.006) / 2, opts.rimWidth || S * 0.012, opts.rim);
    }

    // Vòng trong mảnh (nếu có)
    if (opts.innerRim) {
      strokeCircle(ctx, x, y, r * 0.82, S * 0.004, opts.innerRim);
    }

    // Logo HackUNIX (trắng)
    var logo = opts.logo;
    if (logo && logo.complete && logo.naturalWidth > 0) {
      var scale = opts.logoScale || 0.62;
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

  /* ================= FRAME RENDERERS ================= */

  function renderClassic(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    // Ring chính
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#6FC4FF'], [0.42, '#3D8BFF'], [1, '#174CBC']]));
    // Viền ngoài & viền trong
    strokeCircle(ctx, c, c, m.outerR - S * 0.009, S * 0.018, '#0E3A74');
    strokeCircle(ctx, c, c, m.photoR + S * 0.007, S * 0.013, 'rgba(255,255,255,0.95)');
    // Text vòng cung + 2 sao
    arcText(ctx, '★ CLB MÁY TÍNH HPU ★', c, c, m.ringMid, TOP, 2.15,
      font(800, S * 0.040), '#FFFFFF',
      { shadowColor: 'rgba(13,55,110,0.65)', shadowBlur: S * 0.008, shadowOffsetY: S * 0.003 });
    // 2 sparkle hai bên
    var pl = pointOn(c, m.ringMid, Math.PI * 0.82), pr = pointOn(c, m.ringMid, Math.PI * 0.18);
    star4(ctx, pl.x, pl.y, S * 0.016, '#FFFFFF', 0.95);
    star4(ctx, pr.x, pr.y, S * 0.016, '#FFFFFF', 0.95);
    // Huy hiệu logo
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#57A8FF'], [0.55, '#2E6FD8'], [1, '#16427F']]),
      rim: '#FFFFFF', rimWidth: S * 0.013,
      logo: assets.logo, logoScale: 0.62,
    });
  }

  function renderRecruit(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#FFD66B'], [0.45, '#FF8A4C'], [1, '#FF5050']]));
    strokeCircle(ctx, c, c, m.outerR - S * 0.009, S * 0.018, '#B4441F');
    strokeCircle(ctx, c, c, m.photoR + S * 0.007, S * 0.013, 'rgba(255,255,255,0.95)');
    arcText(ctx, 'TUYỂN THÀNH VIÊN 2026', c, c, m.ringMid, TOP, 2.55,
      font(800, S * 0.0375), '#FFFFFF',
      { shadowColor: 'rgba(140,45,10,0.6)', shadowBlur: S * 0.008, shadowOffsetY: S * 0.003 });
    var pl = pointOn(c, m.ringMid, Math.PI * 0.80), pr = pointOn(c, m.ringMid, Math.PI * 0.20);
    star4(ctx, pl.x, pl.y, S * 0.02, '#FFFFFF', 0.95);
    star4(ctx, pr.x, pr.y, S * 0.02, '#FFFFFF', 0.95);
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#3D8BFF'], [0.6, '#1D5BD8'], [1, '#0E3A74']]),
      rim: '#FFD66B', rimWidth: S * 0.016,
      logo: assets.logo, logoScale: 0.62,
    });
  }

  function renderMidnight(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#1C2A4E'], [0.5, '#101A35'], [1, '#060C1F']]));
    // Neon cyan rims
    strokeCircle(ctx, c, c, m.outerR - S * 0.006, S * 0.011, '#2BE4F0',
      { color: 'rgba(43,228,240,0.9)', blur: S * 0.03 });
    strokeCircle(ctx, c, c, m.photoR + S * 0.005, S * 0.007, 'rgba(125,240,252,0.95)',
      { color: 'rgba(43,228,240,0.8)', blur: S * 0.022 });
    arcText(ctx, 'H A C K U N I X', c, c, m.ringMid, TOP, 1.85,
      font(800, S * 0.040), '#7DF3FF',
      { shadowColor: 'rgba(43,228,240,0.9)', shadowBlur: S * 0.02 });
    var pl = pointOn(c, m.ringMid, Math.PI), pr = pointOn(c, m.ringMid, 0);
    star4(ctx, pl.x, pl.y, S * 0.015, '#2BE4F0', 0.9);
    star4(ctx, pr.x, pr.y, S * 0.015, '#2BE4F0', 0.9);
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#0E1B33'], [1, '#040915']]),
      rim: '#2BE4F0', rimWidth: S * 0.009,
      logo: assets.logo, logoScale: 0.62,
      logoGlow: 'rgba(43,228,240,0.65)',
    });
  }

  function renderPoster(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#EDF8FF'], [0.4, '#AEDCFB'], [1, '#5FA8E8']]));
    strokeCircle(ctx, c, c, m.outerR - S * 0.006, S * 0.011, 'rgba(255,255,255,0.95)');
    strokeCircle(ctx, c, c, m.photoR + S * 0.006, S * 0.012, '#FFFFFF');
    // Vòng đứt nét kiểu poster
    ctx.save();
    ctx.setLineDash([S * 0.02, S * 0.026]);
    strokeCircle(ctx, c, c, m.ringMid, S * 0.006, 'rgba(255,255,255,0.85)');
    ctx.restore();
    arcText(ctx, 'HACKUNIX', c, c, m.ringMid, TOP, 1.5,
      font(800, S * 0.05), '#16427F');
    // Mây hai bên trên ring
    cloudPuff(ctx, c - m.ringMid, c, S * 0.052);
    cloudPuff(ctx, c + m.ringMid, c, S * 0.052);
    // Sparkles
    var p1 = pointOn(c, m.ringMid, TOP - 0.95), p2 = pointOn(c, m.ringMid, TOP + 0.95);
    star4(ctx, p1.x, p1.y, S * 0.017, '#FFFFFF', 0.95);
    star4(ctx, p2.x, p2.y, S * 0.017, '#FFFFFF', 0.95);
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#3D8BFF'], [0.55, '#2E6FD8'], [1, '#16427F']]),
      rim: '#FFFFFF', rimWidth: S * 0.014,
      logo: assets.logo, logoScale: 0.62,
    });
  }

  function cloudPuff(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.96;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.25, r * 1.15, r * 0.62, 0, 0, TAU);
    ctx.ellipse(x - r * 0.62, y + r * 0.35, r * 0.62, r * 0.42, 0, 0, TAU);
    ctx.ellipse(x + r * 0.62, y + r * 0.35, r * 0.62, r * 0.42, 0, 0, TAU);
    ctx.ellipse(x - r * 0.3, y - r * 0.15, r * 0.55, r * 0.5, 0, 0, TAU);
    ctx.ellipse(x + r * 0.35, y - r * 0.2, r * 0.6, r * 0.52, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function renderMinimal(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    // Nhẫn trắng mảnh, bóng đổ nhẹ — hợp mọi nền
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.44, '#FFFFFF',
      { color: 'rgba(13,45,80,0.42)', blur: S * 0.02, offsetY: S * 0.005 });
    strokeCircle(ctx, c, c, m.outerR - S * 0.003, S * 0.005, '#DDE9F6');
    strokeCircle(ctx, c, c, m.photoR + S * 0.004, S * 0.005, '#FFFFFF');
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.104, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.104, [[0, '#1F4E8C'], [1, '#0F2B46']]),
      rim: '#FFFFFF', rimWidth: S * 0.011,
      logo: assets.logo, logoScale: 0.66,
    });
  }

  function renderGold(ctx, S, assets) {
    var m = metrics(S), c = m.c;
    strokeCircle(ctx, c, c, m.ringMid, m.band * 0.96,
      ringGradient(ctx, S, [[0, '#FFF6B8'], [0.32, '#FFD964'], [0.68, '#E0A83C'], [1, '#7A4E00']]));
    strokeCircle(ctx, c, c, m.outerR - S * 0.008, S * 0.015, '#5C3D00');
    strokeCircle(ctx, c, c, m.photoR + S * 0.007, S * 0.013, '#FFFBE0');
    arcText(ctx, 'GOLD MEMBER', c, c, m.ringMid, TOP, 2.0,
      font(800, S * 0.042), '#3D2B00');
    var pl = pointOn(c, m.ringMid, Math.PI * 0.82), pr = pointOn(c, m.ringMid, Math.PI * 0.18);
    star4(ctx, pl.x, pl.y, S * 0.017, '#5C3D00', 0.85);
    star4(ctx, pr.x, pr.y, S * 0.017, '#5C3D00', 0.85);
    var b = badgePos(m);
    drawBadge(ctx, b.x, b.y, S * 0.122, {
      S: S,
      fill: radialFill(ctx, b.x, b.y, S * 0.122, [[0, '#232F52'], [1, '#070B18']]),
      rim: '#FFD964', rimWidth: S * 0.015,
      logo: assets.logo, logoScale: 0.62,
    });
  }

  /* ================= Composite pipeline ================= */

  /** Vẽ nền ảnh (cover) trong vòng tròn clip */
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
      // Placeholder: silhouette avatar
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
  }

  /**
   * Render toàn bộ composite: ảnh + khung.
   * @param ctx canvas 2d context
   * @param S kích thước vuông (px)
   * @param image HTMLImageElement | null
   * @param t { zoom, offsetX, offsetY, rotation, flipH } offset theo tỉ lệ S
   * @param frameId string
   * @param assets { logo: HTMLImageElement }
   * @param opts { background: string|null } — nền JPEG (thay cho clear trong suốt)
   */
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
    { id: 'classic', name: 'Classic HPU', vi: 'Khung xanh huyền thoại', render: renderClassic },
    { id: 'recruit', name: 'Tuyển TV 2026', vi: 'Chiến dịch tuyển thành viên', render: renderRecruit },
    { id: 'midnight', name: 'Midnight Hacker', vi: 'Neon cyber cho anh em hacker', render: renderMidnight },
    { id: 'poster', name: 'Sky Poster', vi: 'Đúng chất poster sự kiện', render: renderPoster },
    { id: 'minimal', name: 'Minimal White', vi: 'Tối giản, sạch mọi nền', render: renderMinimal },
    { id: 'gold', name: 'Gold Member', vi: 'Dành cho thành viên nòng cốt', render: renderGold },
  ];

  global.HXFrames = {
    FRAMES: FRAMES,
    metrics: metrics,
    renderComposite: renderComposite,
  };
})(window);
