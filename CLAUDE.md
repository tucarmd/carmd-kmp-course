# CLAUDE.md

Repo học KMP theo khoá https://phongna-inn.github.io/carmd-kmp-course/ — site tiếng Việt (MkDocs Material) ở `docs/`, deploy GitHub Pages khi push `main`.

## Luật dịch bài (mỗi bài một trang `docs/lessons/NN-<slug>.md`)

1. **Thân bài = dịch sát bản gốc.** Giữ đúng thứ tự mục, câu chữ, ví dụ. Không tự thêm bảng, sơ đồ hay mục mới vào thân bài.
2. **Giữ sơ đồ SVG gốc.** Chép nguyên `<figure class="diagram"><svg class="dg">…`, chỉ dịch chữ trong `<text>`, `<title>`, `<figcaption>`. Không vẽ lại bằng mermaid. Style ở `docs/stylesheets/lesson.css`.
3. **Code giữ nguyên** (tên hàm, chuỗi, output). Đoạn trích: `title="đường/dẫn"` + `hl_lines` đúng dòng `<mark>` của bản gốc; ghi chú bên dưới là list đánh số. TS cạnh Kotlin → `<div class="compare" markdown>`.
4. **Giữ nguyên dạng tương tác của bản gốc:** quiz bấm chọn (`<div class="quiz">`, `data-correct`, `.why`), callout gotcha / bài tự làm / hỏi agent.
5. **Brief cho agent giữ nguyên tiếng Anh** để copy cho agent.
6. **Chỗ khó hiểu → mục `## Appendix` cuối trang** (ghi rõ "không có trong bản gốc"), đánh số `### A1.`, `### A2.`… Được thêm ví dụ đời thường, bảng so sánh TS ↔ Kotlin, ví dụ áp vào app. Ví dụ Kotlin phải **chạy thật** trước khi ghi output.
7. **Cuối trang luôn có `## Sau bài này tự làm được gì`** — checklist `- [ ]`.
8. Thêm bài vào `nav` trong `mkdocs.yml` và bảng tiến độ ở `docs/index.md`; `mkdocs build --strict` phải sạch trước khi commit.

## Nguồn bài và cập nhật

- User dán link một bài (`…/carmd-kmp-course/lessons/NN-….html`) hoặc nói "dịch bài NN" → làm luôn theo luật dịch ở trên, không hỏi lại.
- Không cần user gửi link. Danh sách bài: `gh api repos/phongna-inn/carmd-kmp-course/contents/lessons -q '.[].name'` → URL `https://phongna-inn.github.io/carmd-kmp-course/lessons/<tên>.html`.
- Mỗi trang dịch có frontmatter `source:` (file gốc) và `source_sha:` (commit gốc lúc dịch).
- Kiểm tra bản gốc đã sửa chưa: `gh api "repos/phongna-inn/carmd-kmp-course/commits?path=<source>&per_page=1"` — sha khác `source_sha` thì xem diff (`gh api repos/phongna-inn/carmd-kmp-course/compare/<source_sha>...<sha mới>`), dịch lại đúng phần đổi, cập nhật `source_sha`.

## Git

- Repo của acc **tucarmd** (config local đã set). Commit dạng `docs(lesson-NN): …`.
