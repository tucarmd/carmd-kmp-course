// Trò phân loại bấm chọn — chép từ assets/sorter.js của khoá gốc, dịch câu báo điểm.
// Người học xếp từng mục vào một "ngăn" (tầng, thread, vòng đời…) và thấy đúng/sai ngay.
//   <div class="sorter" data-buckets="màn hình|app core|…">
//     <div class="sort-item" data-answer="app core">
//       <span class="sort-label">…</span>
//       <p class="why">Vì sao thuộc ngăn đó, hiện sau khi chọn.</p>
//     </div>
//     <p class="sort-score"></p>
//   </div>
// Chạy lại sau mỗi lần navigation.instant đổi trang; dataset.ready chặn gắn sự kiện hai lần.
const initSorters = () => {
  document.querySelectorAll(".sorter[data-buckets]").forEach((sorter) => {
    if (sorter.dataset.ready) return;
    sorter.dataset.ready = "1";
    const buckets = sorter.dataset.buckets.split("|");
    const items = [...sorter.querySelectorAll(".sort-item")];
    const score = sorter.querySelector(".sort-score");
    let answered = 0;
    let right = 0;

    items.forEach((item) => {
      const choices = document.createElement("div");
      choices.className = "sort-choices";
      buckets.forEach((bucket) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = bucket;
        b.addEventListener("click", () => {
          if (item.classList.contains("answered")) return;
          item.classList.add("answered");
          const ok = bucket === item.dataset.answer;
          b.classList.add(ok ? "picked-right" : "picked-wrong");
          if (!ok) {
            [...choices.children].find((c) => c.textContent === item.dataset.answer)?.classList.add("picked-right");
          }
          answered += 1;
          if (ok) right += 1;
          if (score && answered === items.length) {
            score.textContent = `Đúng ${right} / ${items.length}.` +
              (right === items.length ? "" : " Đọc ghi chú dưới các mục đỏ, rồi mai thử lại.");
            score.classList.add("show");
          }
        });
        choices.appendChild(b);
      });
      item.insertBefore(choices, item.querySelector(".why"));
    });
  });
};
if (window.document$) document$.subscribe(initSorters);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSorters);
else initSorters();
