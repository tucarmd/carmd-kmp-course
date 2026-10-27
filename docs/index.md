# Học KMP · CarMD

Bản tiếng Việt của khoá [carmd-kmp-course](https://phongna-inn.github.io/carmd-kmp-course/), viết lại cho dễ hiểu và nhanh nắm bài hơn.
Code, tên hàm và lệnh giữ nguyên tiếng Anh như khoá gốc.

!!! info "Bản dịch không chính thức"
    Nội dung gốc thuộc về tác giả khoá [phongna-inn/carmd-kmp-course](https://github.com/phongna-inn/carmd-kmp-course). Đây là bản dịch cá nhân để học, có chỗ nào khác bản gốc thì theo bản gốc.

## Khoá này làm gì

Xây **một** app, Native Device Monitor, chạy Android và iOS trên code Kotlin Multiplatform (KMP) dùng chung:

- xin quyền Bluetooth và xử lý mọi câu trả lời của người dùng;
- quét thiết bị BLE, lọc theo tên;
- kết nối thiết bị, xem service / characteristic, đọc giá trị, nhận notify;
- hiện pin, mạng, trạng thái Bluetooth của máy;
- chạy ngầm, ghi log trạng thái theo chu kỳ.

Màn hình viết native (Compose trên Android, SwiftUI trên iOS). Phần còn lại là Kotlin dùng chung.

## Cách học

- **Bài 01–04:** chương trình nháp, mỗi bài một folder trong `scratch/lesson-XX/`.
- **Từ bài 05:** một app duy nhất trong `app/`, mỗi bài thêm một milestone (`m00` → `m15`), xong bài thì `git tag`.

## Tiến độ

| Bài | Xong |
|---|---|
| [01 · Kotlin cho dev TypeScript](lessons/01-kotlin-cho-dev-typescript.md) | |
| [02 · Swift cho dev TypeScript](lessons/02-swift-cho-dev-typescript.md) | |
| [03 · Android cơ bản](lessons/03-android-co-ban.md) | |
| [04 · iOS cơ bản](lessons/04-ios-co-ban.md) | |
| [05 · Giải phẫu project KMP](lessons/05-giai-phau-project-kmp.md) · m00 | |
| [06 · UI declarative: thành phần, state, layout](lessons/06-ui-declarative-thanh-phan.md) · m01 | |
| [07 · UI declarative: danh sách, bất đồng bộ, điều hướng](lessons/07-ui-declarative-danh-sach.md) · m02 | |
| [08 · ViewModel dùng chung](lessons/08-viewmodel-dung-chung.md) · m03 | |
| [09 · Kotlin↔Swift với SKIE](lessons/09-kotlin-swift-voi-skie.md) · m04 | |
| [10 · Lục giác: app core, port, adapter](lessons/10-luc-giac.md) · m05 | |
| [11 · Kiểm thử app core + Koin](lessons/11-kiem-thu-va-koin.md) · m06 | |
| [12 · Quyền truy cập](lessons/12-quyen-truy-cap.md) · m07 | |
| [13 · BLE: khái niệm và quét](lessons/13-ble-khai-niem-va-quet.md) · m08 | |
| [14 · BLE: kết nối](lessons/14-ble-ket-noi.md) · m09 | |
| [15 · BLE: khám phá và đọc](lessons/15-ble-kham-pha-va-doc.md) · m10 | |
| [16 · BLE: notify, ngắt kết nối, lỗi](lessons/16-ble-notify-ngat-ket-noi-loi.md) · m11 | |
| [17 · Trạng thái máy và kho log](lessons/17-trang-thai-may-va-kho-log.md) · m12 | |
| [18 · Giám sát nền: dựng nó](lessons/18-giam-sat-nen.md) · m13 | |
| [19 · Giám sát nền: bảng hành vi](lessons/19-bang-hanh-vi-nen.md) · m14 | |
| [20 · Tích hợp và kiểm tra đầu cuối](lessons/20-tich-hop-va-kiem-tra-cuoi.md) · m15 | |
| [E1 · API client với Ktor](lessons/e1-api-client-voi-ktor.md) · e1 | |
| [E2 · Camera và media](lessons/e2-camera-va-media.md) · e2 | |
| [E3 · Kable: thư viện thay thế](lessons/e3-kable-thu-vien-thay-the.md) · e3 | |
