// Bài 03, Appendix A12: bốn mô phỏng bấm được (không có trong bản gốc).
// Mọi chuỗi log khớp bảng "Thực tế xảy ra gì" (mục 4) và A7/A10 của trang.
// Chạy lại sau mỗi lần navigation.instant đổi trang; dataset.ready chặn gắn sự kiện hai lần.
(() => {
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    kids.flat().forEach((c) => c != null && el.append(c));
    return el;
  };
  const once = (el) => { if (!el || el.dataset.ready) return false; el.dataset.ready = "1"; return true; };

  // ---------- 1. Phòng thí nghiệm vòng đời ----------
  const CALLBACKS = ["onCreate", "onStart", "onResume", "onPause", "onStop", "onDestroy"];
  const STAGES = ["không có", "tồn tại", "nhìn thấy", "tương tác"]; // 0..3

  const initLifecycle = () => {
    const root = document.getElementById("l03-life-lab");
    if (!once(root)) return;
    const STEP_MS = 380;
    let s, queue = [], busy = false;

    const fresh = () => ({
      proc: false, inst: 0, nextInst: 1, stage: 0, screen: "launcher",
      field: 0, bundle: null, vm: null, dark: false,
    });

    const phone = h("div", { class: "lab-phone" });
    const bands = h("div", { class: "lab-bands" });
    const chips = h("div", { class: "lab-chips" });
    const log = h("pre", { class: "lab-log" });
    const note = h("p", { class: "lab-note" });
    const buttons = h("div", { class: "lab-buttons" });

    const bandEls = [3, 2, 1].map((i) => h("div", { class: "lab-band", "data-stage": i }, h("span", { text: STAGES[i] })));
    bands.append(bandEls[2]); bandEls[2].append(bandEls[1]); bandEls[1].append(bandEls[0]);
    const chipEls = Object.fromEntries([...CALLBACKS, "onRestart"].map((c) => [c, h("span", { class: "lab-chip", text: c })]));
    CALLBACKS.forEach((c) => chips.append(chipEls[c]));
    chips.append(chipEls.onRestart);
    chipEls.onRestart.classList.add("extra");
    chipEls.onRestart.title = "Callback thứ bảy: có chạy, nhưng app của bài chưa ghi log nó (bài tự làm)";

    const drawPhone = () => {
      phone.replaceChildren();
      phone.classList.toggle("dark", s.dark);
      const bar = h("div", { class: "lab-phone-bar", text: s.proc ? `tiến trình: sống · instance #${s.inst || "–"}` : "tiến trình: chưa chạy" });
      phone.append(bar);
      const body = h("div", { class: "lab-phone-body" });
      if (s.screen === "app") {
        body.append(
          h("div", { class: "lab-app-title", text: "Lesson 03" }),
          h("div", { class: "lab-counter" },
            h("span", { text: "field taps: " }), h("b", { text: String(s.field) })),
          h("div", { class: "lab-counter" },
            h("span", { text: "Bundle taps: " }), h("b", { text: String(s.bundle ?? 0) })),
          h("div", { class: "lab-counter" },
            h("span", { text: "ViewModel taps: " }), h("b", { text: String(s.vm ?? 0) })),
          h("button", { type: "button", class: "lab-tap", text: "+1 tap", onclick: () => { s.field++; s.bundle = (s.bundle ?? 0) + 1; s.vm = (s.vm ?? 0) + 1; draw(); } }),
        );
      } else {
        const label = { launcher: "🏠 Màn hình Home", web: "🌐 Trình duyệt (app khác)", off: "⏻ Màn hình tắt", shade: "" }[s.screen];
        body.append(h("div", { class: "lab-other", text: label }));
      }
      phone.append(body);
    };

    const draw = () => {
      drawPhone();
      bandEls.forEach((el) => el.classList.toggle("on", Number(el.dataset.stage) <= s.stage && s.stage > 0));
      bandEls.forEach((el) => el.classList.toggle("current", Number(el.dataset.stage) === s.stage));
      buttons.querySelectorAll("button").forEach((b) => (b.disabled = busy || !ACTIONS[b.dataset.act].can()));
    };

    const say = (text) => { note.textContent = text; };
    const line = (text, cls = "") => {
      const row = h("span", { class: "lab-line " + cls, text: text + "\n" });
      log.append(row); log.scrollTop = log.scrollHeight;
    };

    // Một bước: tên callback, hàm đổi state, chữ log (nếu khác tên)
    const run = (steps, done) => {
      busy = true; draw();
      steps.forEach(([name, fn, text], i) => queue.push(setTimeout(() => {
        Object.values(chipEls).forEach((c) => c.classList.remove("flash"));
        if (chipEls[name]) chipEls[name].classList.add("flash");
        fn?.();
        if (name === "onRestart") line("(onRestart: có chạy, app bài chưa ghi log)", "muted");
        else if (name !== "-") line("D/Lifecycle: " + (text ?? name), name);
        draw();
      }, STEP_MS * i)));
      queue.push(setTimeout(() => {
        Object.values(chipEls).forEach((c) => c.classList.remove("flash"));
        busy = false; done?.(); draw();
      }, STEP_MS * steps.length));
    };

    const createFresh = (restored) => [
      ["onCreate", () => {
        if (!s.proc) { s.proc = true; }
        s.inst = s.nextInst++; s.stage = 1; s.field = 0; s.screen = "app";
        if (!restored) s.bundle = null;
      }, `onCreate (restored=${restored})`],
      ["onStart", () => { s.stage = 2; }],
      ["onResume", () => { s.stage = 3; }],
    ];
    const goBack = (screen) => [
      ["onPause", () => { s.stage = 2; }],
      ["onStop", () => { s.stage = 1; s.screen = screen; }],
    ];
    const comeBack = () => [
      ["onRestart", null],
      ["onStart", () => { s.stage = 2; s.screen = "app"; }],
      ["onResume", () => { s.stage = 3; }],
    ];
    const recreate = (why) => [
      ...goBack("app"),
      ["onDestroy", () => { s.stage = 0; }, "onDestroy (changingConfigurations=true)"],
      ["-", () => line(`… ${why}: instance #${s.inst} bị huỷ, tạo instance mới …`, "muted")],
      ["onCreate", () => { s.inst = s.nextInst++; s.stage = 1; s.field = 0; }, "onCreate (restored=true)"],
      ["onStart", () => { s.stage = 2; }],
      ["onResume", () => { s.stage = 3; }],
    ];

    const resumed = () => s.stage === 3 && s.screen === "app";
    const stopped = () => s.proc && s.stage === 1;

    const ACTIONS = {
      open: {
        label: "Bấm icon app", can: () => !resumed() && s.screen !== "web" && s.screen !== "off",
        go: () => {
          if (stopped()) { say("Instance cũ vẫn còn (chỉ bị stop), nên chỉ cần onStart → onResume. Không có onCreate."); run(comeBack()); }
          else if (!s.proc && s.bundle != null) { say("Tiến trình đã bị giết lúc ở nền, nhưng Bundle vẫn được hệ điều hành giữ: onCreate với restored=true. ViewModel thì đã mất cùng tiến trình."); s.vm = 0; run(createFresh(true)); }
          else { say("Instance mới hoàn toàn: đi qua cả ba lớp từ ngoài vào trong."); s.vm = 0; run(createFresh(false)); }
        },
      },
      shade: {
        label: "Kéo thanh thông báo", can: resumed,
        go: () => { say("Thanh thông báo đè lên, nhưng app vẫn là Activity trên cùng: không có callback nào (A10, câu 1)."); line("(không có dòng log nào)", "muted"); },
      },
      home: { label: "Bấm Home", can: resumed, go: () => { say("Bị ẩn nhưng còn sống: dừng ở onStop, không có onDestroy."); run(goBack("launcher")); } },
      web: { label: "Mở trang web", can: resumed, go: () => { say("Trình duyệt (một app khác) che app của bạn: y như Home."); run(goBack("web")); } },
      fromWeb: { label: "Back từ trình duyệt", can: () => s.screen === "web" && stopped(), go: () => { say("Quay lại cùng instance: onStart → onResume."); run(comeBack()); } },
      power: { label: "Tắt màn hình", can: resumed, go: () => { say("Tắt màn hình: onPause → onStop, cùng instance."); run(goBack("off")); } },
      unlock: { label: "Mở khoá", can: () => s.screen === "off" && stopped(), go: () => { say("Mở khoá: onStart → onResume, không có onCreate lần hai."); run(comeBack()); } },
      rotate: {
        label: "Xoay máy", can: resumed,
        go: () => { say("Thay đổi cấu hình: instance cũ bị huỷ, instance mới được tạo. Field về 0, Bundle và ViewModel còn."); run(recreate("xoay máy"), () => phone.classList.remove("rot")); phone.classList.add("rot"); },
      },
      darkmode: {
        label: "Bật/tắt dark mode", can: resumed,
        go: () => { say("Dark mode cũng là thay đổi cấu hình: xử lý y như xoay máy (A10, câu 3)."); run([["-", () => { s.dark = !s.dark; }], ...recreate("đổi dark mode")]); },
      },
      kill: {
        label: "Hệ thống giết app ở nền", can: () => stopped() && s.screen !== "app",
        go: () => {
          say("Thiếu RAM: tiến trình bị giết im lặng. Không có onDestroy! Bundle được hệ điều hành giữ, field và ViewModel mất.");
          line("(tiến trình bị giết: không có dòng log nào)", "muted");
          s.proc = false; s.inst = 0; s.stage = 0; s.field = 0; s.vm = null; s.screen = "launcher"; draw();
        },
      },
      back: {
        label: "Back ở màn hình chính", can: resumed,
        go: () => {
          say("Kết thúc thật: onDestroy với changingConfigurations=false. Lần mở sau là onCreate lạnh, mọi số đếm về 0.");
          run([...goBack("launcher"), ["onDestroy", () => { s.stage = 0; s.proc = false; s.inst = 0; s.bundle = null; s.vm = null; s.field = 0; }, "onDestroy (changingConfigurations=false)"]]);
        },
      },
    };

    Object.entries(ACTIONS).forEach(([key, a]) => {
      if (!a.label) return;
      buttons.append(h("button", { type: "button", "data-act": key, text: a.label, onclick: () => { if (!busy && a.can()) a.go(); draw(); } }));
    });
    buttons.append(h("button", {
      type: "button", class: "lab-reset", "data-act": "reset", text: "Reset",
      onclick: () => { queue.forEach(clearTimeout); queue = []; busy = false; s = fresh(); log.textContent = ""; say("Bấm icon app để bắt đầu."); draw(); },
    }));
    ACTIONS.reset = { can: () => true };

    root.append(
      buttons,
      h("div", { class: "lab-grid" },
        h("div", {}, h("div", { class: "lab-cap", text: "Điện thoại" }), phone),
        h("div", {}, h("div", { class: "lab-cap", text: "Activity đang ở vùng nào" }), bands, chips),
        h("div", {}, h("div", { class: "lab-cap", text: "Logcat · tag:Lifecycle" }), log),
      ),
      note,
    );
    s = fresh(); say("Bấm icon app để bắt đầu."); draw();
  };

  // ---------- 2. Game ghép log ----------
  const SCENARIOS = [
    { q: "App chưa chạy. Bạn bấm icon.", a: ["onCreate", "onStart", "onResume"] },
    { q: "App đang mở. Bạn bấm Home.", a: ["onPause", "onStop"] },
    { q: "Sau khi bấm Home, bạn bấm icon mở lại (chỉ tính 6 callback app đang log).", a: ["onStart", "onResume"] },
    { q: "App đang mở. Bạn bấm nút mở trang web.", a: ["onPause", "onStop"] },
    { q: "App đang mở. Bạn xoay máy.", a: ["onPause", "onStop", "onDestroy", "onCreate", "onStart", "onResume"] },
    { q: "App đang mở. Bạn bấm Back ở màn hình chính (Android 16).", a: ["onPause", "onStop", "onDestroy"] },
    { q: "App đang mở. Bạn bật dark mode.", a: ["onPause", "onStop", "onDestroy", "onCreate", "onStart", "onResume"] },
    { q: "App đang mở. Bạn kéo thanh thông báo xuống.", a: [] },
    { q: "Màn hình đang tắt, app ở dưới. Bạn mở khoá.", a: ["onStart", "onResume"] },
    { q: "App ở nền 30 phút, hệ thống giết tiến trình. Ghi lại log lúc bị giết.", a: [] },
  ];

  const initLogGame = () => {
    const root = document.getElementById("l03-log-game");
    if (!once(root)) return;
    let i = 0, picked = [], score = 0, tried = 0;
    const q = h("p", { class: "lab-q" });
    const seq = h("div", { class: "lab-seq" });
    const fb = h("p", { class: "lab-feedback" });
    const sc = h("span", { class: "lab-score" });
    const pad = h("div", { class: "lab-buttons" });

    const show = () => {
      q.textContent = `Tình huống ${i + 1}/${SCENARIOS.length}: ${SCENARIOS[i].q}`;
      seq.replaceChildren(...(picked.length ? picked.map((c) => h("span", { class: "lab-chip on", text: c })) : [h("span", { class: "lab-empty", text: "(chưa chọn gì = không có log)" })]));
      sc.textContent = `Điểm: ${score}/${tried}`;
    };
    CALLBACKS.forEach((c) => pad.append(h("button", { type: "button", text: c, onclick: () => { if (picked.length < 8) { picked.push(c); fb.textContent = ""; show(); } } })));
    pad.append(
      h("button", { type: "button", class: "lab-reset", text: "Xoá 1", onclick: () => { picked.pop(); show(); } }),
      h("button", { type: "button", class: "lab-check", text: "Kiểm tra", onclick: () => {
        const want = SCENARIOS[i].a, ok = want.join() === picked.join();
        tried++; if (ok) score++;
        fb.className = "lab-feedback " + (ok ? "ok" : "err");
        fb.textContent = ok ? "Đúng ✓" : "Chưa đúng. Đáp án: " + (want.length ? want.join(" → ") : "không có dòng log nào");
        show();
      } }),
      h("button", { type: "button", text: "Tình huống tiếp →", onclick: () => { i = (i + 1) % SCENARIOS.length; picked = []; fb.textContent = ""; show(); } }),
    );
    root.append(q, seq, pad, h("div", { class: "lab-row" }, fb, sc));
    show();
  };

  // ---------- 3. Intent đi đâu ----------
  const APPS = [
    { id: "main", app: "Lesson 03", act: "MainActivity", exported: true, filter: ["action MAIN", "category LAUNCHER"] },
    { id: "settings", app: "Lesson 03", act: "SettingsActivity", exported: false, filter: [] },
    { id: "chrome", app: "Chrome", act: "BrowserActivity", exported: true, filter: ["action VIEW", "scheme http, https"] },
    { id: "gmail", app: "Gmail", act: "ComposeActivity", exported: true, filter: ["action SENDTO", "scheme mailto"] },
    { id: "maps", app: "Maps", act: "MapActivity", exported: true, filter: ["action VIEW", "scheme geo"] },
  ];
  const INTENTS = [
    { from: "Launcher", code: "bấm icon \"Lesson 03\" (action MAIN, category LAUNCHER)", kind: "implicit", to: "main",
      why: "Launcher tìm Activity có filter MAIN + LAUNCHER, và exported=\"true\" cho phép một app khác (launcher) mở nó." },
    { from: "Lesson 03", code: "startActivity(Intent(this, SettingsActivity::class.java))", kind: "explicit", to: "settings",
      why: "Explicit: nêu đích danh class, nên không cần intent filter. exported=false vẫn mở được vì gọi từ chính app của mình." },
    { from: "Lesson 03", code: "Intent(Intent.ACTION_VIEW, \"https://developer.android.com\".toUri())", kind: "implicit", to: "chrome",
      why: "Implicit: action VIEW + scheme https khớp filter của Chrome. Đây là nút \"Open a web page\" của bài." },
    { from: "Lesson 03", code: "Intent(Intent.ACTION_SENDTO, \"mailto:team@carmd.com\".toUri())", kind: "implicit", to: "gmail",
      why: "Action SENDTO + scheme mailto khớp filter của Gmail. Giống link <a href=\"mailto:…\"> bên web." },
    { from: "Lesson 03", code: "Intent(Intent.ACTION_VIEW, \"geo:10.77,106.70\".toUri())", kind: "implicit", to: "maps",
      why: "Cùng action VIEW như trang web, nhưng scheme geo chỉ khớp Maps. Hệ điều hành so cả action lẫn dữ liệu." },
    { from: "Chrome", code: "một app khác gọi Intent explicit tới com.example.lesson03.SettingsActivity", kind: "explicit", to: "none",
      why: "SettingsActivity có exported=false: chỉ app của chính nó được mở. App khác gọi vào sẽ nhận SecurityException." },
    { from: "Lesson 03", code: "Intent(Intent.ACTION_VIEW, \"tel:0900000000\".toUri())", kind: "implicit", to: "none",
      why: "Trên máy giả lập này không app nào có filter scheme tel, nên startActivity ném ActivityNotFoundException. App thật nên bắt lỗi này." },
  ];

  const initIntentGame = () => {
    const root = document.getElementById("l03-intent-game");
    if (!once(root)) return;
    let i = 0, score = 0, tried = 0, answered = false;
    const card = h("div", { class: "lab-intent" });
    const apps = h("div", { class: "lab-apps" });
    const fb = h("p", { class: "lab-feedback" });
    const sc = h("span", { class: "lab-score" });

    const appEls = {};
    [...APPS, { id: "none", app: "Không ai mở được", act: "→ lỗi / bị chặn", filter: [] }].forEach((a) => {
      const el = h("button", { type: "button", class: "lab-app" + (a.id === "none" ? " none" : "") },
        h("b", { text: a.app }), h("span", { class: "mono", text: a.act }),
        ...(a.exported !== undefined ? [h("span", { class: "small", text: `exported="${a.exported}"` })] : []),
        ...a.filter.map((f) => h("span", { class: "filter", text: f })),
        ...(a.id !== "none" && a.filter.length === 0 ? [h("span", { class: "small", text: "(không có intent filter)" })] : []),
      );
      el.addEventListener("click", () => pick(a.id));
      appEls[a.id] = el; apps.append(el);
    });

    const show = () => {
      const it = INTENTS[i];
      card.replaceChildren(
        h("div", { class: "small", text: `Intent ${i + 1}/${INTENTS.length} · gửi từ ${it.from}` }),
        h("code", { text: it.code }),
        h("div", { class: "small", text: answered ? `(${it.kind})` : "Bấm vào Activity sẽ được mở:" }),
      );
      Object.values(appEls).forEach((e) => e.classList.remove("right", "wrong"));
      sc.textContent = `Điểm: ${score}/${tried}`;
    };
    const pick = (id) => {
      if (answered) return;
      const it = INTENTS[i], ok = id === it.to;
      answered = true; tried++; if (ok) score++;
      show();
      appEls[it.to].classList.add("right");
      if (!ok) appEls[id].classList.add("wrong");
      fb.className = "lab-feedback " + (ok ? "ok" : "err");
      fb.textContent = (ok ? "Đúng ✓ " : "Chưa đúng. ") + it.why;
    };
    root.append(card, apps, h("div", { class: "lab-row" }, fb, sc),
      h("div", { class: "lab-buttons" }, h("button", { type: "button", text: "Intent tiếp →", onclick: () => { i = (i + 1) % INTENTS.length; answered = false; fb.textContent = ""; show(); } })));
    show();
  };

  // ---------- 4. Thước SDK ----------
  const NAMES = { 21: "5.0", 23: "6.0", 24: "7.0", 26: "8.0", 28: "9", 29: "10", 30: "11", 31: "12", 33: "13", 34: "14", 35: "15", 36: "16", 37: "17" };
  const initSdkLab = () => {
    const root = document.getElementById("l03-sdk-lab");
    if (!once(root)) return;
    const MIN = 21, MAX = 37;
    const v = { device: 34, min: 26, target: 36, compile: 37, guard: true };
    const num = (key, label) => h("label", { class: "lab-field" }, h("span", { text: label }),
      h("input", { type: "number", min: MIN, max: MAX, value: v[key], oninput: (e) => { v[key] = Math.max(MIN, Math.min(MAX, Number(e.target.value) || MIN)); draw(); } }));
    const device = h("input", { type: "range", min: MIN, max: MAX, value: v.device, oninput: (e) => { v.device = Number(e.target.value); draw(); } });
    const deviceLabel = h("b");
    const guard = h("input", { type: "checkbox", checked: "", onchange: (e) => { v.guard = e.target.checked; draw(); } });
    const ruler = h("div", { class: "lab-ruler" });
    const out = h("ul", { class: "lab-verdicts" });

    const draw = () => {
      deviceLabel.textContent = `API ${v.device} (Android ${NAMES[v.device] ?? "?"})`;
      ruler.replaceChildren();
      for (let n = MIN; n <= MAX; n++) {
        const tags = [];
        if (n === v.min) tags.push("min");
        if (n === v.target) tags.push("target");
        if (n === v.compile) tags.push("compile");
        const cell = h("div", { class: "lab-tick" + (n < v.min ? " below" : "") + (n === v.device ? " device" : "") },
          h("span", { class: "n", text: String(n) }), ...tags.map((t) => h("span", { class: "tag-" + t, text: t })));
        ruler.append(cell);
      }
      const items = [];
      const order = v.min <= v.target && v.target <= v.compile;
      if (!order) items.push(["err", `Sai thứ tự: phải có minSdk ≤ targetSdk ≤ compileSdk (đang là ${v.min} / ${v.target} / ${v.compile}). Gradle sẽ cảnh báo hoặc báo lỗi.`]);
      if (v.device < v.min) items.push(["err", `Máy API ${v.device} < minSdk ${v.min}: KHÔNG cài được (INSTALL_FAILED_OLDER_SDK). Trên Google Play, app không hiện với máy này.`]);
      else {
        items.push(["ok", `Máy API ${v.device} ≥ minSdk ${v.min}: cài được.`]);
        const rules = Math.min(v.device, v.target);
        items.push(["info", v.device > v.target
          ? `Máy mới hơn targetSdk: Android ${NAMES[v.device] ?? v.device} vẫn cho app chạy theo luật cũ tới API ${v.target} với những thay đổi chỉ áp khi app target đời mới.`
          : `Máy cũ hơn targetSdk: app chạy theo luật của Android ${NAMES[v.device] ?? v.device} (API ${rules}), vì máy không biết luật nào mới hơn. targetSdk ${v.target} chỉ hứa "app đã sẵn sàng tới API ${v.target}".`]);
        if (v.compile < 37) items.push(["info", `Một API giả định mới có từ API 37: compileSdk ${v.compile} < 37 nên code gọi nó KHÔNG biên dịch được (compiler không biết tên đó).`]);
        else if (v.device >= 37) items.push(["ok", "Gọi API giả định có từ API 37: máy này có, chạy bình thường."]);
        else if (v.guard) items.push(["ok", `Gọi API có từ API 37 bên trong if (Build.VERSION.SDK_INT >= 37): máy API ${v.device} bỏ qua nhánh đó, không crash.`]);
        else items.push(["err", `Gọi API có từ API 37 KHÔNG kiểm tra SDK_INT: máy API ${v.device} crash (NoSuchMethodError) lúc chạy. compileSdk chỉ giúp biên dịch, không thêm API vào máy cũ.`]);
      }
      items.push([v.target >= 31 ? "info" : "warn", v.target >= 31
        ? `targetSdk ${v.target} ≥ 31: mọi Activity có intent filter phải ghi android:exported, nếu không app không cài được (ghi chú 1, mục 2).`
        : `targetSdk ${v.target} < 31: luật exported chưa áp, nhưng Google Play không nhận app target thấp như vậy.`]);
      out.replaceChildren(...items.map(([cls, t]) => h("li", { class: cls, text: t })));
    };

    root.append(
      h("div", { class: "lab-row wrap" }, num("min", "minSdk"), num("target", "targetSdk"), num("compile", "compileSdk")),
      h("div", { class: "lab-row wrap" }, h("label", { class: "lab-field wide" }, h("span", { text: "Máy người dùng: " }), deviceLabel, device)),
      ruler,
      h("label", { class: "lab-field" }, guard, h("span", { text: " Code có kiểm tra Build.VERSION.SDK_INT trước khi gọi API mới" })),
      out,
    );
    draw();
  };

  const init = () => { initLifecycle(); initLogGame(); initIntentGame(); initSdkLab(); };
  if (window.document$) document$.subscribe(init);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
