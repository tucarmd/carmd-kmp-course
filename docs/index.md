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
| 04 · iOS cơ bản | |
