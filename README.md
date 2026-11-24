# 🎌 HackUNIX — Avatar Frame Studio

Web tạo **khung avatar chính chủ của HackUNIX — CLB Máy tính HPU**.
Tải ảnh lên → cắt thông minh → đóng khung → tải PNG nền trong suốt (1024/2048px)
để đăng Facebook, Zalo, Discord, X — chỉ mất khoảng 1 phút.

**Tất cả xử lý chạy 100% trên trình duyệt (Canvas API). Ảnh không bao giờ rời khỏi thiết bị của bạn.**

![Style](https://img.shields.io/badge/style-poster%20xanh%20da%20troi-5CA9EC)
![Stack](https://img.shields.io/badge/stack-vanilla%20HTML%2FCSS%2FJS%20%2B%20Canvas-1D5BD8)
![License](https://img.shields.io/badge/logo-HackUNIX%20chinh%20chu-16427F)

## ✨ Tính năng

- **Upload mọi cách**: kéo-thả, chọn file, hoặc dán từ clipboard (Ctrl/⌘ + V) — JPG, PNG, WebP, AVIF, GIF ≤ 10MB
- **Cắt & căn chỉnh mượt mà**: kéo để di chuyển, cuộn chuột / pinch để thu phóng, xoay −180°…180°, lật ngang, xoay 90°, hỗ trợ bàn phím (←→↑↓, +/−)
- **6 khung avatar** theo 2 chất liệu:
  - **Kawaii sticker** (tranh minh hoạ tách nền + khoét lỗ tròn, ghép bằng Canvas):
    `Kẹo Soda` · `Mèo Ngủ Gật` · `Hành Tinh Mint` · `Tux Hacker`
  - **Vector huy hiệu** (vẽ bằng Canvas API, nét tuyệt đối ở 2048px):
    `Classic HPU` · `Gold Member`
- **Xuất bản chuẩn avatar**: PNG nền trong suốt 1024×1024 / 2048×2048, JPEG nền tối, hoặc **Copy ảnh** vào clipboard
- **Xem thử trên 4 nền tảng**: mock Facebook / Zalo / Discord / X cập nhật trực tiếp theo chỉnh sửa
- **Privacy-first**: không máy chủ, không cookie, không tracking, không watermark, không cần đăng nhập

## 🚀 Chạy thử

Yêu cầu duy nhất: **Node.js ≥ 18** (chỉ để làm static server — app không có dependency).

```bash
node server.mjs
# → http://localhost:3000
```

Hoặc bất kỳ static server nào, ví dụ: `npx serve .` · `python3 -m http.server 3000`

Deploy: chỉ cần host static (GitHub Pages, Vercel, Netlify, Cloudflare Pages…) — trỏ vào thư mục gốc repo.

## 🧱 Cấu trúc

```
├── index.html                  # Toàn bộ markup (one-page)
├── assets/
│   ├── css/styles.css          # Design system (poster-inspired)
│   ├── js/frames.js            # Canvas engine: 6 khung (4 raster kawaii + 2 vector)
│   ├── js/main.js              # Upload · crop · picker · export · social mocks
│   └── img/
│       ├── demo-avatar.jpg     # Ảnh mẫu trong studio
│       └── frames/art-*.png    # 4 khung kawaii (đã tách nền, khoét lỗ tròn trong suốt)
├── HackUNIX_logo_white.png     # Logo chính chủ (asset của repo)
└── server.mjs                  # Zero-dependency static server (0.0.0.0)
```

> 🎨 Design language được chắt lọc từ poster tuyển thành viên của CLB:
> nền gradient xanh trời + lưới mờ + sparkles, typography bo tròn đậm (Baloo 2),
> thẻ trắng bo góc lớn, accent coral/sun-yellow, CTA xanh dương đặc trưng.

## ⚠️ Lưu ý sử dụng logo

Logo HackUNIX (CLB Máy tính HPU) trong repo này là tài sản của CLB.
Vui lòng không chỉnh sửa logo hoặc dùng khung cho mục đích thương mại
khi chưa được sự đồng ý của CLB.

© 2026 HackUNIX — CLB Máy tính HPU.
