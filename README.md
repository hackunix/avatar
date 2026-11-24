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
- **3 khung avatar** cùng một dòng thiết kế "poster cộng đồng" — gradient ấm góc cạnh, vòng tròn trắng, chữ script tiếng Việt uốn quanh viền, ruy-băng vòng cung dưới đáy, loa + cờ + mây + sparkles vẽ **100% bằng Canvas** (chữ & logo luôn sắc nét ở mọi độ phân giải, không dùng ảnh AI):
  - `Bình Minh` — cam san hô → vàng nắng (bản thường)
  - `Lửa Hồng` — đỏ rượu vang + điểm vàng kim (bản sự kiện)
  - `Đêm Hội` — nâu đen ấm + chữ vàng kim (bản nòng cốt)
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
│   ├── js/frames.js            # Canvas engine: 3 khung poster cộng đồng (Bình Minh · Lửa Hồng · Đêm Hội)
│   ├── js/main.js              # Upload · crop · picker · export · social mocks
│   ├── fonts/dancing-script/   # Dancing Script (vi + latin + latin-ext) — chữ script tiếng Việt, nhúng local
│   └── img/
│       └── demo-avatar.jpg     # Ảnh mẫu trong studio
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
