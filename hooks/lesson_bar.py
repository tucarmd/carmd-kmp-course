"""Chèn "Bài N/M" + thanh các bài dưới tiêu đề mỗi trang lessons/NN-*.md."""
import html
import re

LESSON = re.compile(r"^lessons/(\d\d)-.+\.md$")
TOTAL = 20  # khoá gốc có 20 bài lõi


def on_page_markdown(markdown, page, config, files):
    m = LESSON.match(page.file.src_uri)
    if not m:
        return markdown
    done = {int(LESSON.match(f.src_uri).group(1)): f for f in files if LESSON.match(f.src_uri)}
    n = int(m.group(1))
    steps = []
    for i in range(1, TOTAL + 1):
        state = "now" if i == n else ("done" if i < n else "todo")
        if i in done:
            stem = done[i].src_uri.split("/")[-1][:-3]
            steps.append(f'<a class="tut__step tut__step--{state}" href="../{stem}/">{i}</a>')
        else:
            steps.append(f'<a class="tut__step tut__step--{state}" title="Chưa dịch">{i}</a>')
    bar = (f'\n<div class="tut"><p class="tut__label">Bài {n}/{TOTAL} của khoá '
           f'<a href="https://phongna-inn.github.io/carmd-kmp-course/">carmd-kmp-course</a></p>\n'
           f'<nav class="tut__bar">{"".join(steps)}</nav></div>\n')
    return re.sub(r"^(# .+\n)", lambda h: h.group(1) + bar, markdown, count=1, flags=re.M)
