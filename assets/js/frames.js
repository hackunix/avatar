/**
 * HackUNIX Avatar Frame — Canvas rendering engine (v4 · "Bình Minh" edition)
 *
 * Một họ khung duy nhất, 3 biến thể màu — lấy cảm hứng poster cộng đồng:
 * nền gradient ấm góc cạnh, vòng tròn trắng ở giữa, chữ script uốn quanh viền,
 * dải ruy-băng bo cong dưới đáy (vòng cung chữ), loa phóng thanh, cờ, mây,
 * sparkles + halftone — tất cả VẼ BẰNG CANVAS (không dùng ảnh AI),
 * chữ & logo luôn sắc nét ở mọi độ phân giải.
 *
 * Biến thể (đồng bộ layout, khác bảng màu + thông điệp):
 *   sunrise — Bình Minh  : cam san hô → vàng nắng (bản thường)
 *   ember   — Lửa Hồng   : đỏ thắm → rượu vang, điểm vàng (bản sự kiện)
 *   midnight— Đêm Hội    : nâu đen ấm, chữ vàng kim (bản nòng cốt)
 *
 * Logo HackUNIX trắng là PNG chính chủ, vẽ đè ở mọi biến thể.
 * Pipeline composite: underlay (poster) → photo (clip tròn) → overlay (ruy-băng, trang trí).
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var TOP = -Math.PI / 2;

  /* ================= Metrics (đồng nhất mọi độ phân giải) ================= */
  function metrics(S) {
    var c = S / 2;
    var circleR = S * 0.295;
    var cy = S * 0.475;
    return { c: c, cy: cy, circleR: circleR, photoR: S * 0.262, outerR: circleR, ringMid: (S * 0.262 + circleR) / 2, band: circleR - S * 0.262 };
  }

  /* ================= Helpers cơ bản ================= */
  function star4(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    var k = r * 0.24;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(k, -k); ctx.lineTo(r, 0); ctx.lineTo(k, k);
    ctx.lineTo(0, r); ctx.lineTo(-k, k); ctx.lineTo(-r, 0); ctx.lineTo(-k, -k);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function dot(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function trackedText(ctx, text, cx, y, tracking, fill) {
    var prevAlign = ctx.textAlign, prevBaseline = ctx.textBaseline;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (fill) ctx.fillStyle = fill;
    var chars = Array.from(text), widths = [], total = 0;
    for (var i = 0; i < chars.length; i++) {
      var w = ctx.measureText(chars[i]).width;
      widths.push(w);
      total += w + (i < chars.length - 1 ? tracking : 0);
    }
    var x = cx - total / 2;
    for (var j = 0; j < chars.length; j++) {
      if (chars[j] !== ' ') ctx.fillText(chars[j], x, y);
      x += widths[j] + tracking;
    }
    ctx.textAlign = prevAlign;
    ctx.textBaseline = prevBaseline;
  }

  /** Chữ chạy dọc vòng cung, tiến theo bề rộng ký tự (không rải đều).
   *  dir = +1: cung trên (trái → phải, góc tăng) · dir = -1: cung dưới (trái → phải, góc giảm) */
  function arcTextFlow(ctx, text, cx, cy, radius, centerAngle, tracking, fontStr, fill, shadow, dir, outline) {
    dir = dir == null ? 1 : dir;
    ctx.save();
    ctx.font = fontStr;
    var chars = Array.from(text);
    var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + tracking * (chars.length - 1);
    var a = centerAngle - (dir * total / radius) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < chars.length; i++) {
      var w = widths[i];
      a += dir * (w / 2) / radius;
      if (chars[i] !== ' ') {
        ctx.save();
        ctx.translate(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
        ctx.rotate(a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
        if (shadow) {
          ctx.shadowColor = shadow.color;
          ctx.shadowBlur = shadow.blur || 0;
          ctx.shadowOffsetY = shadow.offsetY || 0;
        }
        if (outline) {
          ctx.lineJoin = 'round';
          ctx.lineWidth = outline.width;
          ctx.strokeStyle = outline.color;
          ctx.strokeText(chars[i], 0, 0);
        }
        ctx.fillStyle = fill;
        ctx.fillText(chars[i], 0, 0);
        ctx.restore();
      }
      a += dir * ((w / 2) + tracking) / radius;
    }
    ctx.restore();
  }

  function arcPath(ctx, cx, cy, r0, r1, a0, a1) {
    /* Vòng cung khép kín (dùng cho dải ruy-băng): a0 → a1 theo chiều tăng góc */
    ctx.beginPath();
    ctx.arc(cx, cy, r1, a0, a1, false);
    ctx.arc(cx, cy, r0, a1, a0, true);
    ctx.closePath();
  }

  /* ================= Nền poster: gradient + tia + sóng + halftone ================= */
  function wavePath(ctx, S, baseY, amp, phase) {
    ctx.beginPath();
    ctx.moveTo(-4, baseY);
    var steps = 24;
    for (var i = 0; i <= steps; i++) {
      var x = (i / steps) * (S + 8) - 4;
      var y = baseY
        + Math.sin(x * 0.021 + phase) * amp * 0.55
        + Math.sin(x * 0.0093 + phase * 1.7) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(S + 4, S + 4);
    ctx.lineTo(-4, S + 4);
    ctx.closePath();
  }

  function paintWaves(ctx, S, p) {
    var waves = [
      { y: 0.700, amp: 0.020, ph: 0.6, fill: p.waveBack },
      { y: 0.778, amp: 0.026, ph: 2.1, fill: p.waveMid },
      { y: 0.862, amp: 0.030, ph: 4.0, fill: p.waveFront },
    ];
    waves.forEach(function (w) {
      wavePath(ctx, S, S * w.y, S * w.amp, w.ph);
      ctx.fillStyle = w.fill;
      ctx.fill();
      /* Viền sáng mép sóng (nét brush tay) */
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = p.waveRim;
      ctx.lineWidth = S * 0.005;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    });
    /* Halftone chấm trên sóng trước */
    ctx.save();
    wavePath(ctx, S, S * 0.862, S * 0.030, 4.0);
    ctx.clip();
    for (var row = 0; row < 5; row++) {
      var y = S * (0.875 + row * 0.032);
      var r = S * (0.0035 + row * 0.0011);
      var gap = S * 0.036;
      var off = (row % 2) * gap * 0.5;
      for (var x = off; x < S; x += gap) {
        dot(ctx, x, y, r, p.halftone, 0.32);
      }
    }
    ctx.restore();
    /* Vệt brush sáng loang trên 2 sóng dưới */
    var brushes = [
      [0.06, 0.845, 0.10, 0.55], [0.30, 0.905, 0.075, 0.5], [0.62, 0.90, 0.085, 0.5],
      [0.86, 0.865, 0.06, 0.55], [0.17, 0.955, 0.11, 0.6], [0.47, 0.968, 0.10, 0.6], [0.75, 0.955, 0.09, 0.6],
    ];
    brushes.forEach(function (b) {
      ctx.save();
      ctx.globalAlpha = b[3];
      ctx.strokeStyle = p.waveRim;
      ctx.lineWidth = S * 0.0075;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(S * b[0], S * b[1]);
      ctx.quadraticCurveTo(S * (b[0] + b[2] / 2), S * (b[1] - 0.012), S * (b[0] + b[2]), S * b[1]);
      ctx.stroke();
      ctx.restore();
    });
  }

  function fanRays(ctx, x, y, rays, a0, a1, len, color, alpha, k) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    k = k || 1;
    for (var i = 0; i < rays; i++) {
      var t = rays === 1 ? 0.5 : i / (rays - 1);
      var a = a0 + (a1 - a0) * t;
      ctx.lineWidth = (1.5 + (i % 3) * 0.9) * k;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * Math.cos(a), y + len * Math.sin(a));
      ctx.stroke();
    }
    ctx.restore();
  }
  var S_LINE = 1.8; /* px @640 — được nhân với S ở nơi gọi */

  /* ================= Mây bo tròn nhiều lớp ================= */
  function drawCloud(ctx, x, y, k, fill, shade) {
    ctx.save();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(x, y + 0.44 * k, 2.0 * k, 0.5 * k, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = fill;
    var bumps = [
      [-1.55, 0.12, 1.05, 0.62], [-0.62, -0.42, 1.05, 0.78], [0.45, -0.45, 1.10, 0.82],
      [1.45, 0.05, 1.05, 0.60], [0.05, 0.18, 1.75, 0.62],
    ];
    bumps.forEach(function (b) {
      ctx.beginPath();
      ctx.ellipse(x + b[0] * k, y + b[1] * k, b[2] * k, b[3] * k, 0, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  /* ================= Loa phóng thanh (góc trái) ================= */
  function drawMegaphone(ctx, S, p) {
    ctx.save();
    ctx.translate(S * 0.140, S * 0.538);
    ctx.rotate(-0.30);
    ctx.scale(0.72, 0.72);

    var u = S / 640; /* đơn vị theo thiết kế 640px */

    /* Thân loa */
    var body = ctx.createLinearGradient(-70 * u, 0, 70 * u, 0);
    body.addColorStop(0, p.megaBack);
    body.addColorStop(0.55, p.megaBody);
    body.addColorStop(1, p.megaFront);
    ctx.beginPath();
    ctx.moveTo(-66 * u, -26 * u);
    ctx.quadraticCurveTo(-10 * u, -44 * u, 52 * u, -50 * u);
    ctx.lineTo(52 * u, 50 * u);
    ctx.quadraticCurveTo(-10 * u, 44 * u, -66 * u, 26 * u);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = p.megaEdge;
    ctx.stroke();

    /* Tay cầm */
    ctx.fillStyle = p.megaBack;
    rr(ctx, -52 * u, 24 * u, 26 * u, 44 * u, 6 * u);
    ctx.fill();
    ctx.strokeStyle = p.megaEdge;
    ctx.lineWidth = 1.6 * u;
    ctx.stroke();
    dot(ctx, -39 * u, 74 * u, 4.5 * u, p.megaEdge, 1);

    /* Miệng loa: vành kem → đỏ → lõi tối */
    ctx.beginPath();
    ctx.ellipse(54 * u, 0, 17 * u, 50 * u, 0, 0, TAU);
    ctx.fillStyle = p.megaRim;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(55.5 * u, 0, 12 * u, 39 * u, 0, 0, TAU);
    ctx.fillStyle = p.megaBody;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(56.5 * u, 0, 6.5 * u, 22 * u, 0, 0, TAU);
    ctx.fillStyle = p.megaEdge;
    ctx.fill();

    /* Nắp sau */
    ctx.beginPath();
    ctx.ellipse(-66 * u, 0, 11 * u, 27 * u, 0, 0, TAU);
    ctx.fillStyle = p.megaBack;
    ctx.fill();
    ctx.strokeStyle = p.megaEdge;
    ctx.lineWidth = 1.6 * u;
    ctx.stroke();

    /* Highlight */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-48 * u, -18 * u);
    ctx.quadraticCurveTo(-5 * u, -32 * u, 40 * u, -37 * u);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /* ================= Cờ lụa tung bay (góc phải) ================= */
  function drawFlag(ctx, S, p) {
    ctx.save();
    ctx.translate(S * 0.858, S * 0.148);

    var u = S / 640;

    /* Cột cờ hơi ngả */
    ctx.rotate(0.06);
    var pole = ctx.createLinearGradient(-4 * u, 0, 5 * u, 0);
    pole.addColorStop(0, p.poleDark);
    pole.addColorStop(0.5, p.pole);
    pole.addColorStop(1, p.poleDark);
    ctx.fillStyle = pole;
    rr(ctx, -4.5 * u, -10 * u, 9 * u, 148 * u, 4.5 * u);
    ctx.fill();

    /* Quả cầu đỉnh */
    var ball = ctx.createRadialGradient(-2.5 * u, -16 * u, 1 * u, 0, -13 * u, 9 * u);
    ball.addColorStop(0, '#FFF3C8');
    ball.addColorStop(0.55, p.pole);
    ball.addColorStop(1, p.poleDark);
    ctx.beginPath();
    ctx.arc(0, -13 * u, 8.5 * u, 0, TAU);
    ctx.fillStyle = ball;
    ctx.fill();

    /* Lá cờ hình lá lượt: bụng trên + bụng dưới gặp nhau ở mũi nhọn bên trái */
    ctx.save();
    ctx.translate(-3 * u, -2 * u);
    var cloth = new Path2D();
    cloth.moveTo(0, -6 * u);
    cloth.bezierCurveTo(-34 * u, -18 * u, -70 * u, -12 * u, -104 * u, -4 * u);
    cloth.bezierCurveTo(-108 * u, -1.5 * u, -108 * u, 2.5 * u, -104 * u, 5 * u);
    cloth.bezierCurveTo(-70 * u, 14 * u, -34 * u, 16 * u, 0, 8 * u);
    cloth.closePath();
    ctx.fillStyle = p.flagCloth;
    ctx.fill(cloth);
    /* Sọc chéo thân cờ (clip theo lá) */
    ctx.save();
    ctx.clip(cloth);
    ctx.fillStyle = p.flagStripe;
    ctx.beginPath();
    ctx.moveTo(0, 3.2 * u);
    ctx.bezierCurveTo(-36 * u, 3.8 * u, -70 * u, 2.4 * u, -110 * u, 2.2 * u);
    ctx.lineTo(-110 * u, 10 * u);
    ctx.bezierCurveTo(-70 * u, 18 * u, -34 * u, 20 * u, 0, 12 * u);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(-42 * u, -6 * u, 40 * u, 3.2 * u, -0.06, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = p.flagEdge;
    ctx.lineWidth = 1.8 * u;
    ctx.lineJoin = 'round';
    ctx.stroke(cloth);
    /* Tua rua nhỏ ở mũi cờ */
    ctx.strokeStyle = p.flagStripe;
    ctx.lineWidth = 2.4 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-104 * u, 0);
    ctx.lineTo(-112 * u, -3 * u);
    ctx.moveTo(-104 * u, 0.5 * u);
    ctx.lineTo(-113 * u, 1 * u);
    ctx.moveTo(-104 * u, 1.5 * u);
    ctx.lineTo(-112 * u, 5 * u);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /* ================= Sparkles rải trên nền ================= */
  var SPARKS = [
    [0.295, 0.125, 0.016], [0.660, 0.082, 0.012], [0.745, 0.205, 0.017],
    [0.130, 0.300, 0.013], [0.908, 0.330, 0.014], [0.375, 0.190, 0.010],
    [0.185, 0.420, 0.011], [0.798, 0.445, 0.010], [0.580, 0.150, 0.009],
  ];
  var DOTS = [
    [0.225, 0.085, 0.005], [0.430, 0.105, 0.004], [0.710, 0.120, 0.004],
    [0.170, 0.380, 0.005], [0.940, 0.415, 0.004], [0.205, 0.335, 0.0035],
    [0.700, 0.115, 0.0035],
    [0.845, 0.225, 0.0045],   ];

  /* ================= Vòng tròn trắng giữa ================= */
  function paintCircle(ctx, S, p) {
    var m = metrics(S);
    ctx.save();
    ctx.shadowColor = p.circleShadow;
    ctx.shadowBlur = S * 0.028;
    ctx.shadowOffsetY = S * 0.011;
    ctx.beginPath();
    ctx.arc(m.c, m.cy, m.circleR, 0, TAU);
    ctx.fillStyle = p.circleFill;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(m.c, m.cy, m.circleR - S * 0.004, 0, TAU);
    ctx.strokeStyle = p.circleEdge;
    ctx.lineWidth = S * 0.0075;
    ctx.stroke();
  }

  /* ================= Vignette trong mép ảnh ================= */
  function photoVignette(ctx, S, m, r, alpha) {
    var pr = r || m.photoR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.c, m.cy, pr, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = 'rgba(40, 12, 8, ' + (alpha == null ? 0.32 : alpha) + ')';
    ctx.lineWidth = S * 0.04;
    ctx.shadowColor = 'rgba(40, 12, 8, 0.5)';
    ctx.shadowBlur = S * 0.028;
    ctx.beginPath();
    ctx.arc(m.c, m.cy, pr - S * 0.016, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /* ================= Photo: clip tròn + vignette ================= */
  function drawPhoto(ctx, S, image, t, photoR) {
    var m = metrics(S);
    var pr = photoR || m.photoR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.c, m.cy, pr, 0, TAU);
    ctx.clip();

    if (image && image.naturalWidth) {
      var iw = image.naturalWidth, ih = image.naturalHeight;
      var cover = Math.max((pr * 2) / iw, (pr * 2) / ih);
      var k = cover * (t.zoom || 1);
      ctx.translate(m.c + (t.offsetX || 0) * S, m.cy + (t.offsetY || 0) * S);
      ctx.rotate(((t.rotation || 0) * Math.PI) / 180);
      ctx.scale(k * (t.flipH ? -1 : 1), k);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih);
    } else {
      var g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#FFE3D2');
      g.addColorStop(1, '#F2A37E');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(m.c, m.cy - S * 0.045, S * 0.082, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(m.c, m.cy + S * 0.135, S * 0.135, S * 0.112, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
    photoVignette(ctx, S, m, pr, 0.32);
  }

  /* ================= Biến thể màu ================= */
  var VARIANTS = {
    sunrise: {
      id: 'sunrise', name: 'Bình Minh', vi: 'Cam san hô · ruy-băng cộng đồng',
      script: 'Học đi đôi với hành, vươn xa!',
      ribbonText: 'HACKUNIX · CLB MÁY TÍNH HPU',
      pal: {
        bg: ['#F65B4C', 0, '#EE7A33', 0.45, '#F5A83B', 0.8, '#F9C550', 1],
        ray: '#FFFFFF', rayAlpha: 0.10,
        waveBack: '#CE4630', waveMid: '#E8713A', waveFront: '#F7B84A', waveRim: '#FFE9BE',
        halftone: '#7E2418',
        cloud: '#FFE9C9', cloudShade: 'rgba(214, 122, 60, 0.55)',
        circleFill: '#FFFFFF', circleEdge: '#B8402A', circleShadow: 'rgba(96, 18, 8, 0.42)',
        script: '#FFFFFF', scriptShadow: { color: 'rgba(112, 22, 10, 0.6)', blur: 10, offsetY: 2 },
        ribbon0: '#9A2A22', ribbon1: '#6E1712', ribbonEdge: '#4E0D09', ribbonPin: '#FFD9A0',
        ribbonText: '#FFE3B3', ribbonEnd: '#5A120D',
        megaBody: '#D64533', megaFront: '#F0644B', megaBack: '#A8241B', megaRim: '#FDEBD0', megaEdge: '#7E1B12',
        flagCloth: '#FDEBD0', flagStripe: '#CE3A2B', flagEdge: '#8E2A1E', pole: '#E8B54B', poleDark: '#8A5E14',
        spark: '#FFE9B3', dot: '#FFF6DE',
        glow: 'rgba(255, 244, 200, 0.30)',
      },
    },
    ember: {
      id: 'ember', name: 'Lửa Hồng', vi: 'Đỏ rượu vang · điểm vàng sự kiện',
      script: 'Cháy hết đam mê!',
      ribbonText: 'HACKUNIX · CLB MÁY TÍNH HPU',
      pal: {
        bg: ['#C62B2B', 0, '#A5162E', 0.45, '#7E1030', 0.8, '#5E0B28', 1],
        ray: '#FFD98A', rayAlpha: 0.08,
        waveBack: '#7E1428', waveMid: '#9E1F2C', waveFront: '#C14A2E', waveRim: '#FFD08A',
        halftone: '#3F0518',
        cloud: '#E8A08A', cloudShade: 'rgba(70, 8, 26, 0.6)',
        circleFill: '#FFFBF4', circleEdge: '#FFD98A', circleShadow: 'rgba(20, 2, 10, 0.55)',
        script: '#FFD98A', scriptShadow: { color: 'rgba(28, 2, 10, 0.7)', blur: 10, offsetY: 2 },
        ribbon0: '#46101E', ribbon1: '#2C0812', ribbonEdge: '#1B040A', ribbonPin: '#FFD98A',
        ribbonText: '#FFD98A', ribbonEnd: '#22060D',
        megaBody: '#E8B54B', megaFront: '#FFD98A', megaBack: '#9E6F1E', megaRim: '#FFF3D0', megaEdge: '#5E3E08',
        flagCloth: '#FFF3D0', flagStripe: '#A5162E', flagEdge: '#4E0D18', pole: '#FFD98A', poleDark: '#6E4A0E',
        spark: '#FFD98A', dot: '#FFE9B3',
        glow: 'rgba(255, 190, 110, 0.22)',
      },
    },
    midnight: {
      id: 'midnight', name: 'Đêm Hội', vi: 'Nâu đen ấm · chữ vàng kim nòng cốt',
      script: 'Trí tuệ · Nhiệt huyết · Cộng đồng',
      ribbonText: 'HACKUNIX · CLB MÁY TÍNH HPU',
      pal: {
        bg: ['#2B1A1E', 0, '#3A2320', 0.45, '#472A22', 0.8, '#2E1C18', 1],
        ray: '#FFB060', rayAlpha: 0.07,
        waveBack: '#1F1316', waveMid: '#2A1B1B', waveFront: '#38241F', waveRim: '#8A5A34',
        halftone: '#0E0708',
        cloud: '#38261F', cloudShade: 'rgba(12, 6, 5, 0.65)',
        circleFill: '#FFFDF6', circleEdge: '#E0B45C', circleShadow: 'rgba(0, 0, 0, 0.6)',
        script: '#F2CE84', scriptShadow: { color: 'rgba(0, 0, 0, 0.75)', blur: 12, offsetY: 2 },
        ribbon0: '#171017', ribbon1: '#0B0709', ribbonEdge: '#000000', ribbonPin: '#E0B45C',
        ribbonText: '#F2CE84', ribbonEnd: '#050203',
        megaBody: '#C97B3A', megaFront: '#E89A4E', megaBack: '#6E4423', megaRim: '#F6E0B8', megaEdge: '#33200F',
        flagCloth: '#F6E0B8', flagStripe: '#B4532A', flagEdge: '#33200F', pole: '#E0B45C', poleDark: '#54401C',
        spark: '#F2CE84', dot: '#FFE9B3',
        glow: 'rgba(255, 150, 70, 0.30)',
        emberOrbit: true,
      },
    },
  };

  /* ================= Factory ================= */
  function makeSunFrame(variantId) {
    var v = VARIANTS[variantId];
    var p = v.pal;

    function underlay(ctx, S) {
      var m = metrics(S);

      /* 1) Nền gradient chéo */
      var g = ctx.createLinearGradient(0, 0, S * 0.38, S);
      g.addColorStop(p.bg[1], p.bg[0]);
      g.addColorStop(p.bg[3], p.bg[2]);
      g.addColorStop(p.bg[5], p.bg[4]);
      g.addColorStop(p.bg[7], p.bg[6]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);

      /* 2) Ánh sáng hắt ấm phía sau vòng tròn */
      var glow = ctx.createRadialGradient(m.c, m.cy, S * 0.05, m.c, m.cy, S * 0.62);
      glow.addColorStop(0, p.glow);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, S, S);

      /* 3) Tia quạt từ 2 góc */
      fanRays(ctx, S * 1.03, -S * 0.03, 9, Math.PI * 0.52, Math.PI * 0.98, S * 0.78, p.ray, p.rayAlpha, S / 640);
      fanRays(ctx, -S * 0.03, S * 0.60, 7, -Math.PI * 0.32, Math.PI * 0.18, S * 0.6, p.ray, p.rayAlpha * 0.8, S / 640);

      /* 4) Sóng nhiều lớp đáy + halftone + vệt brush */
      paintWaves(ctx, S, p);

      /* 5) Mây */
      drawCloud(ctx, S * 0.165, S * 0.150, S * 0.042, p.cloud, p.cloudShade);

      /* 6) Vòng tròn trắng + viền */
      paintCircle(ctx, S, p);
      if (p.emberOrbit) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = p.circleEdge;
        ctx.setLineDash([S * 0.004, S * 0.016]);
        ctx.lineWidth = S * 0.0035;
        ctx.beginPath();
        ctx.arc(m.c, m.cy, m.circleR + S * 0.014, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      /* 7) Chữ script uốn trên vòng tròn (dưới logo) */
      arcTextFlow(ctx, v.script, m.c, m.cy, S * 0.345, TOP, S * 0.0012,
        '600 ' + Math.round(S * 0.046) + 'px "Dancing Script", cursive',
        p.script, p.scriptShadow, 1, { color: 'rgba(64, 12, 6, 0.55)', width: S * 0.009 });

      /* 8) Logo HackUNIX trắng — nóc nhà */
      var logo = assets_logo_ref && assets_logo_ref();
      drawLogoTop(ctx, S, p, logo);
    }

    function overlay(ctx, S, assets) {
      var m = metrics(S);
      var u = S / 640;

      /* 1) Sparkles phủ lên mọi thứ (tránh vùng ảnh) */
      SPARKS.forEach(function (s) { star4(ctx, S * s[0], S * s[1], S * s[2], p.spark, 0.95); });
      DOTS.forEach(function (d) { dot(ctx, S * d[0], S * d[1], S * d[2], p.dot, 0.85); });

      /* 2) Cờ góc phải (đè lên viền circle nếu chạm) */
      drawFlag(ctx, S, p);

      /* 3) Loa góc trái (sticker đè lên viền circle) */
      drawMegaphone(ctx, S, p);

      /* 4) Ruy-băng đáy: vòng cung chữ "HACKUNIX · CLB MÁY TÍNH HPU" */
      var rIn = S * 0.240, bandH = S * 0.062, a0 = Math.PI * 0.135, a1 = Math.PI * 0.865;
      var rMid = rIn + bandH / 2;
      var grad = ctx.createRadialGradient(m.c, m.cy, rIn, m.c, m.cy, rIn + bandH);
      grad.addColorStop(0, p.ribbon0);
      grad.addColorStop(1, p.ribbon1);
      ctx.save();
      ctx.shadowColor = 'rgba(20, 6, 2, 0.5)';
      ctx.shadowBlur = S * 0.012;
      ctx.shadowOffsetY = S * 0.006;
      arcPath(ctx, m.c, m.cy, rIn, rIn + bandH, a0, a1);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
      /* Viền ngoài + 2 đường pinstripe */
      ctx.save();
      ctx.strokeStyle = p.ribbonEdge;
      ctx.lineWidth = S * 0.006;
      arcPath(ctx, m.c, m.cy, rIn, rIn + bandH, a0, a1);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = p.ribbonPin;
      ctx.lineWidth = S * 0.0028;
      ctx.beginPath(); ctx.arc(m.c, m.cy, rIn + bandH * 0.18, a0 + 0.02, a1 - 0.02); ctx.stroke();
      ctx.beginPath(); ctx.arc(m.c, m.cy, rIn + bandH * 0.82, a0 + 0.02, a1 - 0.02); ctx.stroke();
      ctx.restore();
      /* Chữ vòng cung trên ruy-băng (đọc trái → phải) */
      arcTextFlow(ctx, v.ribbonText, m.c, m.cy, rMid, Math.PI / 2, S * 0.004,
        '800 ' + Math.round(S * 0.0165) + 'px "Be Vietnam Pro", sans-serif',
        p.ribbonText, null, -1);
      /* Hai đầu ruy-băng bo tròn + lõi bóng */
      [a0, a1].forEach(function (a) {
        var ex = m.c + rMid * Math.cos(a), ey = m.cy + rMid * Math.sin(a);
        ctx.beginPath();
        ctx.arc(ex, ey, bandH / 2, 0, TAU);
        ctx.fillStyle = p.ribbonEnd;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex, ey, bandH / 2, 0, TAU);
        ctx.strokeStyle = p.ribbonEdge;
        ctx.lineWidth = S * 0.004;
        ctx.stroke();
      });
    }

    /* assets được module nội bộ cung cấp qua closure tạm (xem renderComposite) */
    var assets_logo_ref = null;

    function drawLogoTop(ctx, S, p, logo) {
      if (logo && logo.complete && logo.naturalWidth > 0) {
        var w = S * 0.105;
        var h = w * (logo.naturalHeight / logo.naturalWidth);
        ctx.save();
        ctx.shadowColor = p.scriptShadow ? p.scriptShadow.color : 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = S * 0.012;
        ctx.shadowOffsetY = S * 0.003;
        ctx.drawImage(logo, S / 2 - w / 2, S * 0.064 - h / 2, w, h);
        ctx.restore();
      }
    }

    return {
      id: v.id, name: v.name, vi: v.vi,
      underlay: function (ctx, S, assets) {
        assets_logo_ref = function () { return assets && assets.logo; };
        return underlay(ctx, S);
      },
      render: overlay,
    };
  }

  /* ================= Composite pipeline ================= */
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
    assets = assets || {};
    var frame = FRAMES.filter(function (f) { return f.id === frameId; })[0] || FRAMES[0];
    if (frame.underlay) frame.underlay(ctx, S, assets);
    drawPhoto(ctx, S, image, t, frame.photoR);
    frame.render(ctx, S, assets);
    ctx.restore();
  }

  var FRAMES = [
    makeSunFrame('sunrise'),
    makeSunFrame('ember'),
    makeSunFrame('midnight'),
  ];

  var ART_SOURCES = [];

  global.HXFrames = {
    FRAMES: FRAMES,
    ART_SOURCES: ART_SOURCES,
    metrics: metrics,
    renderComposite: renderComposite,
  };
})(window);
