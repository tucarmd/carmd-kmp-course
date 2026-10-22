// Câu hỏi ôn: bấm một đáp án → tô đúng/sai, hiện giải thích. Chạy lại sau mỗi lần navigation.instant đổi trang.
document$.subscribe(() => {
  document.querySelectorAll(".quiz").forEach((quiz) => {
    const feedback = quiz.querySelector(".feedback");
    quiz.querySelectorAll(".opt").forEach((opt) => {
      opt.addEventListener("click", () => {
        const right = opt.hasAttribute("data-correct");
        opt.classList.add(right ? "right" : "wrong");
        if (right) quiz.querySelector(".opt[data-correct]").classList.add("right");
        feedback.textContent = right ? "Đúng ✓" : "Chưa đúng, thử lại.";
        if (right) quiz.classList.add("answered");
      });
    });
  });
});
