// Bài 14, Appendix: ba mô phỏng bấm được (không có trong bản gốc).
// Mô hình theo SessionService, AndroidBleConnection và IosBleConnection của bài; chuỗi thông báo lấy từ code của bài.
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
  const SEC = 300; // 1 giây mô phỏng = 300 ms thật

  // ---------- 1. Bảng điều khiển kết nối ----------
  const initCall = () => {
    const root = document.getElementById("l14-call");
    if (!once(root)) return;
    const DEVICES = {
      obd: { name: "OBD-II Adapter", rssi: -48, answers: true },
      scale: { name: "Smart Scale", rssi: -85, answers: false },
    };
    let s, timers = [], clock = null;
    const fresh = () => ({ dev: "obd", state: "Disconnected", t: 0, rssi: -48, deviceOn: true, bt: true, linked: false, alert: "", alertIos: "" });

    const chips = ["Disconnected", "Connecting", "Connected"].map((n) => h("span", { class: "lab-chip", "data-s": n, text: n }));
    const stateRow = h("div", { class: "lab-chips" }, chips);
    const meta = h("p", { class: "small" });
    const alertBox = h("p", { class: "lab-note" });
    const logCore = h("pre", { class: "lab-log short" });
    const logA = h("pre", { class: "lab-log short" });
    const logI = h("pre", { class: "lab-log short" });
    const devBtns = h("div", { class: "lab-buttons" });
    const btns = h("div", { class: "lab-buttons" });

    const stamp = () => `[t=${s.t.toFixed(1).padStart(4)}s] `;
    const put = (el, msg) => { el.textContent += stamp() + msg + "\n"; el.scrollTop = el.scrollHeight; };
    const core = (m) => put(logCore, m), and = (m) => put(logA, m), ios = (m) => put(logI, m);
    const dev = () => DEVICES[s.dev];
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const later = (secs, fn) => timers.push(setTimeout(() => { fn(); draw(); }, secs * SEC));
    const startClock = () => { if (!clock) clock = setInterval(() => { s.t += 0.1; draw(); }, SEC / 10); };
    const stopClock = () => { clearInterval(clock); clock = null; };

    // Mọi lối ra đều qua đây: awaitClose của adapter, rồi finally của service.
    const finish = (why, androidMsg, iosMsg) => {
      clear();
      and("awaitClose { gatt.disconnect(); gatt.close() }");
      ios("awaitClose { link.close() } → cancelPeripheralConnection(peripheral); peripheral = nil");
      s.state = "Disconnected"; s.linked = false;
      core("finally: link = null; state = Disconnected");
      if (why === "ok") core("connect() trả về bình thường: app tự xin, không phải lỗi");
      else if (why === "cancel") core("connect() kết thúc bằng CancellationException: không có alert");
      else {
        core("connect() ném ConnectionException → ViewModel: errorMessage");
        s.alert = androidMsg; s.alertIos = iosMsg;
      }
      later(1, stopClock);
    };

    const fail = (androidMsg, iosMsg) => finish("err", androidMsg, iosMsg);

    // Liên kết đang lên mà mất (tắt thiết bị, ra khỏi tầm sóng): khoảng 1–2 s sau mới có callback.
    const dropSoon = () => {
      if (s.state !== "Connected" || s.dropping) return;
      s.dropping = true;
      later(1.5, () => {
        s.dropping = false;
        if (s.state !== "Connected" || reachable()) return;
        const d = dev().name;
        and("onConnectionStateChange(status=8, newState=0 STATE_DISCONNECTED), linked = true");
        ios("didDisconnectPeripheral(error: CBError.connectionTimeout)");
        core("adapter: close(ConnectionException) → link hỏng → coroutineScope ném lỗi");
        fail(`The link to ${d} was lost (Android status 8).`, `The link to ${d} was lost: The connection has timed out unexpectedly.`);
      });
    };

    const reachable = () => s.deviceOn && s.rssi > -95;

    const ACT = {
      connect: { label: "Connect", can: () => s.state === "Disconnected", go: () => {
        s.alert = ""; s.alertIos = ""; s.t = 0; logCore.textContent = logA.textContent = logI.textContent = "";
        startClock();
        const d = dev().name;
        core(`connect(${d}): có quyền ✓, state đang Disconnected ✓`);
        s.state = "Connecting"; core(`state = Connecting(${d})`);
        if (!s.bt) {
          and("adapter == null || !adapter.isEnabled → throw ConnectionException");
          ios("centralManagerDidUpdateState: .poweredOff → end(with: message(for: .poweredOff))");
          core("adapter ném lỗi trước khi nối");
          s.state = "Disconnected"; core("finally: state = Disconnected");
          core("connect() ném ConnectionException → ViewModel: errorMessage");
          s.alert = s.alertIos = "Bluetooth is off. Turn it on, then connect again.";
          later(1, stopClock);
          return;
        }
        core("coroutineScope { link = launch { giveUp = launch { delay(10 s) }; connection.connect(device).collect { … } } }");
        and("connectGatt(context, false, callback, TRANSPORT_LE)");
        ios("retrievePeripherals(withIdentifiers:) → peripheral = found; manager.connect(found)");
        later(1, () => {
          if (s.state !== "Connecting") return;
          if (!dev().answers || !reachable()) { core("radio im lặng… (giveUp vẫn đang đếm)"); return; }
          s.linked = true; s.state = "Connected";
          and("onConnectionStateChange(status=0 GATT_SUCCESS, newState=2 STATE_CONNECTED) → trySend(Connected)");
          ios("didConnect(peripheral) → feed.changed(Connected)");
          core(`state = Connected(${d}); giveUp.cancel(): hạn 10 s chỉ dành cho lúc kết nối`);
        });
        later(10, () => {
          if (s.state !== "Connecting") return;
          core(`giveUp: throw ConnectionException("${d} didn't answer within 10 seconds.")`);
          and("(chưa có callback nào: trên API 30 của bài, Android tự bỏ sau ~30 s với status=133)");
          ios("(không có delegate call nào: \"Connection attempts never time out\")");
          fail(`${d} didn't answer within 10 seconds.`, `${d} didn't answer within 10 seconds.`);
        });
      } },
      disconnect: { label: "Disconnect", can: () => s.state !== "Disconnected", go: () => {
        core("user: Disconnect → session.disconnect() → link?.cancel()");
        finish("ok");
        ios("didDisconnectPeripheral(error: nil) → guard bỏ qua: chính app đã xin");
      } },
      second: { label: "Màn khác gọi connect()", can: () => s.state !== "Disconnected", go: () => {
        core("connect(Heart Rate Monitor): state không phải Disconnected → throw");
        core("ConnectionException: Another connection is open. Disconnect it first.");
        core("(radio không bị chạm; kết nối đang có giữ nguyên)");
      } },
      power: { label: () => (s.deviceOn ? "Tắt thiết bị" : "Bật thiết bị"), can: () => true, go: () => {
        s.deviceOn = !s.deviceOn;
        core(s.deviceOn ? `${dev().name} bật lại` : `${dev().name} bị tắt nguồn`);
        if (!s.deviceOn) dropSoon();
      } },
      far: { label: "Đi xa (RSSI −12)", can: () => s.rssi > -110, go: () => {
        s.rssi -= 12; core(`đi xa: RSSI ${s.rssi} dBm` + (s.rssi <= -95 ? " (ngoài tầm sóng)" : ""));
        if (s.rssi <= -95) dropSoon();
      } },
      near: { label: "Lại gần", can: () => s.rssi < dev().rssi, go: () => { s.rssi = dev().rssi; core(`lại gần: RSSI ${s.rssi} dBm`); } },
      bt: { label: () => (s.bt ? "Tắt Bluetooth của điện thoại" : "Bật Bluetooth"), can: () => true, go: () => {
        s.bt = !s.bt;
        core(s.bt ? "Bluetooth bật" : "Bluetooth tắt");
        if (!s.bt && s.state !== "Disconnected") {
          const d = dev().name;
          clear();
          and("onConnectionStateChange(status=…, newState=0), linked = " + s.linked + " (status tuỳ máy, chưa kiểm chứng)");
          ios("centralManagerDidUpdateState: .poweredOff, có liên kết → end(with: \"Bluetooth was turned off.\")");
          fail(s.linked ? `The link to ${d} was lost (Android status …).` : "The connection failed (Android status …).", "Bluetooth was turned off.");
        }
      } },
      back: { label: "Back (rời màn hình chi tiết)", can: () => s.state !== "Disconnected", go: () => {
        core("Back → ViewModel bị clear → viewModelScope bị huỷ → session.connect bị huỷ");
        finish("cancel");
        ios("(iOS: ViewModelOwner.deinit → store.clear(), cùng đường đó)");
      } },
      reset: { label: "Reset", can: () => true, go: () => { clear(); stopClock(); s = fresh(); logCore.textContent = logA.textContent = logI.textContent = ""; } },
    };

    Object.entries(DEVICES).forEach(([k, d]) => devBtns.append(h("button", { type: "button", "data-dev": k, text: d.name, onclick: () => {
      if (s.state !== "Disconnected") return;
      s.dev = k; s.rssi = d.rssi; s.alert = ""; draw();
    } })));
    const buttons = Object.entries(ACT).map(([k, a]) => h("button", { type: "button", "data-a": k, class: k === "reset" ? "lab-reset" : "", onclick: () => { if (a.can()) { a.go(); draw(); } } }));
    btns.append(buttons);

    const draw = () => {
      chips.forEach((c) => c.classList.toggle("on", c.dataset.s === s.state));
      chips[1].textContent = s.state === "Connecting" ? `Connecting(${dev().name})` : "Connecting";
      chips[2].textContent = s.state === "Connected" ? `Connected(${dev().name})` : "Connected";
      [...devBtns.children].forEach((b) => { b.classList.toggle("active", b.dataset.dev === s.dev); b.disabled = s.state !== "Disconnected"; });
      buttons.forEach((b) => { const a = ACT[b.dataset.a]; b.textContent = typeof a.label === "function" ? a.label() : a.label; b.disabled = !a.can(); });
      const status = { Disconnected: "Status: not connected", Connecting: "Status: connecting…", Connected: "Status: connected" }[s.state];
      meta.textContent = `t = ${s.t.toFixed(1)} s · RSSI ${s.rssi} dBm · thiết bị ${s.deviceOn ? "bật" : "tắt"} · Bluetooth ${s.bt ? "bật" : "tắt"} · màn hình: "${status}"`;
      if (s.alert) {
        alertBox.className = "lab-note err";
        alertBox.textContent = s.alert === s.alertIos ? `Connection failed: ${s.alert}` : `Connection failed — Android: ${s.alert} · iOS: ${s.alertIos}`;
      } else {
        alertBox.className = "lab-note";
        alertBox.textContent = s.state === "Disconnected" ? "Không có alert." : "";
      }
    };

    root.append(
      h("div", { class: "lab-cap", text: "Thiết bị" }), devBtns,
      h("div", { class: "lab-cap", text: "Thao tác" }), btns,
      h("div", { class: "lab-cap", text: "ConnectionState (SessionService)" }), stateRow, meta, alertBox,
      h("div", { class: "lab-cap", text: "App core: SessionService" }), logCore,
      h("div", { class: "lab-cap", text: "Android: BluetoothGattCallback / awaitClose" }), logA,
      h("div", { class: "lab-cap", text: "iOS: CBCentralManagerDelegate / IosBleConnection" }), logI,
    );
    s = fresh(); draw();
  };

  // ---------- 2. Giữ kết nối ở đâu? ----------
  const initLifetime = () => {
    const root = document.getElementById("l14-lifetime");
    if (!once(root)) return;
    const MODES = {
      remember: "BluetoothGatt trong remember (Activity)",
      screen: "rememberCoroutineScope()",
      vm: "viewModelScope (cách của bài)",
    };
    let s, timers = [];
    const fresh = (mode = "vm") => ({ mode, activity: 1, vm: 1, onScreen: true, state: "Disconnected", nextClient: 6, clients: [], held: null, coro: false });
    const modeBtns = h("div", { class: "lab-buttons" });
    const btns = h("div", { class: "lab-buttons" });
    const lanes = h("div", { class: "lab-lanes" });
    const verdict = h("p", { class: "lab-note" });
    const log = h("pre", { class: "lab-log short" });
    const line = (m) => { log.textContent += m + "\n"; log.scrollTop = log.scrollHeight; };
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    const closeClient = (id) => {
      s.clients = s.clients.filter((c) => c.id !== id);
      line(`  awaitClose → gatt.close(): client ${id} unregisterApp()`);
    };

    const ACT = {
      connect: { label: "Connect", can: () => s.onScreen && s.state === "Disconnected", go: () => {
        const id = s.nextClient++;
        s.clients.push({ id, owner: s.mode === "remember" ? `Activity #${s.activity}` : "adapter (Koin single)" });
        s.state = "Connecting";
        if (s.mode === "remember") { s.held = id; line(`Activity #${s.activity}: gatt = connectGatt(…) → registerApp(): client ${id}. Màn hình giữ gatt.`); }
        else { s.coro = true; line(`${s.mode === "vm" ? "viewModelScope" : "rememberCoroutineScope"}.launch { session.connect(device) } → client ${id}`); }
        timers.push(setTimeout(() => {
          if (s.state !== "Connecting") return;
          s.state = "Connected"; line(`client ${id}: Status: connected`); draw();
        }, 1000));
      } },
      rotate: { label: "Xoay màn hình", can: () => s.onScreen, go: () => {
        line(`Xoay: Activity #${s.activity} bị huỷ, Activity #${s.activity + 1} thế chỗ.`);
        s.activity++;
        if (s.mode === "remember") {
          if (s.held != null) line(`  Activity #${s.activity} không giữ gì: client ${s.held} vẫn đăng ký, không ai đóng được nó.`);
          s.held = null; s.state = "Disconnected";
        } else if (s.mode === "screen") {
          if (s.coro) {
            clear(); s.coro = false;
            line("  composable rời đi → rememberCoroutineScope bị huỷ → session.connect bị huỷ");
            s.clients.forEach((c) => closeClient(c.id));
            line("  Status: not connected (app tự cúp máy)");
          }
          s.state = "Disconnected";
        } else {
          line(`  ViewModel #${s.vm} sống qua lần xoay; coroutine kết nối chạy tiếp. Màn hình mới đọc state: ${s.state === "Disconnected" ? "not connected" : s.state === "Connecting" ? "connecting…" : "connected"}.`);
        }
      } },
      back: { label: "Back (rời hẳn)", can: () => s.onScreen, go: () => {
        s.onScreen = false; clear();
        line("Back: màn hình chi tiết rời back stack.");
        if (s.mode === "vm") {
          line(`  ViewModel #${s.vm} bị clear → viewModelScope bị huỷ`);
          if (s.coro) { s.clients.forEach((c) => closeClient(c.id)); s.coro = false; }
        } else if (s.mode === "screen") {
          if (s.coro) { line("  scope của màn hình bị huỷ"); s.clients.forEach((c) => closeClient(c.id)); s.coro = false; }
        } else {
          if (s.clients.length) line(`  Không ai gọi close(): còn ${s.clients.length} client đăng ký. ~30 s sau: onClientConnectionState() status=133, callback của màn hình đã chết vẫn chạy.`);
        }
        s.state = "Disconnected";
      } },
      reopen: { label: "Mở lại màn hình chi tiết", can: () => !s.onScreen, go: () => {
        s.onScreen = true; s.activity++; s.vm++;
        line(`Mở lại: màn hình mới, ViewModel #${s.vm} mới.`);
      } },
      reset: { label: "Reset", can: () => true, go: () => { clear(); s = fresh(s.mode); log.textContent = ""; } },
    };

    Object.entries(MODES).forEach(([k, label]) => modeBtns.append(h("button", { type: "button", "data-mode": k, text: label, onclick: () => {
      clear(); s = fresh(k); log.textContent = ""; line(`Chế độ: ${label}`); draw();
    } })));
    const buttons = Object.entries(ACT).map(([k, a]) => h("button", { type: "button", "data-a": k, class: k === "reset" ? "lab-reset" : "", text: a.label, onclick: () => { if (a.can()) { a.go(); draw(); } } }));
    btns.append(buttons);

    const lane = (label, on, text) => h("div", { class: "lab-lane" + (on ? " on" : "") }, h("b", { text: label }), h("span", { text }));
    const draw = () => {
      [...modeBtns.children].forEach((b) => b.classList.toggle("active", b.dataset.mode === s.mode));
      buttons.forEach((b) => { b.disabled = !ACT[b.dataset.a].can(); });
      const status = { Disconnected: "Status: not connected", Connecting: "Status: connecting…", Connected: "Status: connected" }[s.state];
      lanes.replaceChildren(
        lane("Màn hình", s.onScreen, s.onScreen ? `Activity #${s.activity} · ${status}` : "đã rời back stack"),
        lane("ViewModel", s.onScreen, s.onScreen ? `DeviceDetailViewModel #${s.vm}` : "đã bị clear"),
        lane("Coroutine kết nối", s.coro, s.mode === "remember" ? "không có: màn hình tự gọi connectGatt" : s.coro ? "đang chạy session.connect" : "không chạy"),
        lane("GATT client đăng ký", s.clients.length > 0, s.clients.length ? s.clients.map((c) => `client ${c.id}` + (s.mode === "remember" && c.id !== s.held ? " (mồ côi)" : "")).join(", ") : "không có"),
      );
      const orphans = s.mode === "remember" ? s.clients.filter((c) => c.id !== s.held).length : 0;
      if (orphans) { verdict.className = "lab-note err"; verdict.textContent = `${orphans} client mồ côi: không object nào trong app còn với tới để close() nó.`; }
      else if (s.mode === "screen" && s.state === "Disconnected" && log.textContent.includes("tự cúp")) { verdict.className = "lab-note warn"; verdict.textContent = "Scope của màn hình quá ngắn: xoay là mất kết nối."; }
      else if (s.mode === "vm" && s.state === "Connected" && s.activity > 1) { verdict.className = "lab-note"; verdict.textContent = "Xoay rồi mà vẫn một client, vẫn connected: kết nối sống trong ViewModel."; }
      else { verdict.className = "lab-note"; verdict.textContent = ""; }
    };

    root.append(h("div", { class: "lab-cap", text: "Giữ kết nối ở đâu" }), modeBtns, h("div", { class: "lab-cap", text: "Thao tác (adapter giả lập: thiết bị trả lời sau ~1 s)" }), btns, lanes, verdict, log);
    s = fresh(); line(`Chế độ: ${MODES.vm}`); draw();
  };

  // ---------- 3. Callback này nghĩa là gì? ----------
  const initCallbacks = () => {
    const root = document.getElementById("l14-callbacks");
    if (!once(root)) return;
    const OUT = ["Connected", "Lỗi: chưa từng lên (failed)", "Lỗi: đang lên thì mất", "Bỏ qua, không làm gì"];
    const Q = [
      { p: "Android", ev: "onConnectionStateChange(gatt, status = 0, newState = 2)  // linked = false", a: 0,
        why: "GATT_SUCCESS + STATE_CONNECTED là tổ hợp duy nhất nghĩa là liên kết đã lên: linked = true; trySend(Connected(device))." },
      { p: "Android", ev: "onConnectionStateChange(gatt, status = 133, newState = 0)  // linked = false", a: 1,
        why: "Chưa từng lên, nên nhánh else: close(ConnectionException(\"The connection failed (Android status 133).\"))." },
      { p: "Android", ev: "onConnectionStateChange(gatt, status = 8, newState = 0)  // linked = true", a: 2,
        why: "linked = true, nên nhánh linked: \"The link to … was lost (Android status 8).\"" },
      { p: "Android", ev: "onConnectionStateChange(gatt, status = 0, newState = 0)  // linked = true", a: 2,
        why: "status là 0 nhưng newState không phải STATE_CONNECTED, nên không vào nhánh đầu. linked = true: với app, mất liên kết mà nó không xin là rớt." },
      { p: "iOS", ev: "centralManager(_:didConnect:)  // peripheral === self.peripheral", a: 0,
        why: "feed?.changed(state: ConnectionStateConnected(device: device))." },
      { p: "iOS", ev: "centralManager(_:didFailToConnect:error:)", a: 1,
        why: "end(with: \"The connection failed: …\"): lần thử không hoàn tất." },
      { p: "iOS", ev: "centralManager(_:didDisconnectPeripheral:error: nil)", a: 3,
        why: "error nil nghĩa là chính app đã gọi cancelPeripheralConnection trong close(); guard let error thoát ra, không ai đang chờ." },
      { p: "iOS", ev: "centralManager(_:didDisconnectPeripheral:error: CBError)  // đang nối", a: 2,
        why: "Có error: việc ngắt không do app. end(with: \"The link to … was lost: …\")." },
      { p: "iOS", ev: "centralManager(_:didConnect:)  // một peripheral adapter đã buông (!==)", a: 3,
        why: "guard peripheral === self.peripheral: callback muộn về object cũ không đổi gì." },
      { p: "iOS", ev: "centralManagerDidUpdateState(_:)  // .poweredOff, đang có liên kết", a: 2,
        why: "peripheral khác nil và state dưới .poweredOn: end(with: \"Bluetooth was turned off.\")." },
    ];
    let i = 0, score = 0, answered = false;
    const scoreEl = h("span", { class: "lab-score" });
    const plat = h("div", { class: "lab-cap" });
    const ev = h("pre", { class: "lab-code" }, h("code"));
    const opts = h("div", { class: "lab-buttons" });
    const fb = h("p", { class: "lab-feedback" });
    const next = h("button", { type: "button", class: "lab-check", text: "Câu tiếp", onclick: () => { i = (i + 1) % Q.length; if (i === 0) score = 0; answered = false; draw(); } });
    const optBtns = OUT.map((o, k) => h("button", { type: "button", "data-k": String(k), text: o, onclick: () => {
      if (answered) return;
      answered = true;
      const q = Q[i];
      if (k === q.a) { score++; fb.className = "lab-feedback ok"; fb.textContent = "Đúng. " + q.why; }
      else { fb.className = "lab-feedback err"; fb.textContent = `Chưa đúng: adapter dịch thành "${OUT[q.a]}". ` + q.why; }
      optBtns.forEach((b, kk) => { b.classList.toggle("active", kk === q.a); });
      draw(true);
    } }));
    opts.append(optBtns);
    const draw = (keep) => {
      const q = Q[i];
      plat.textContent = `Câu ${i + 1}/${Q.length} · ${q.p}`;
      ev.firstChild.textContent = q.ev;
      scoreEl.textContent = `Điểm: ${score}/${Q.length}`;
      if (!keep) { fb.className = "lab-feedback"; fb.textContent = ""; optBtns.forEach((b) => b.classList.remove("active")); }
      optBtns.forEach((b) => { b.disabled = answered; });
      next.disabled = !answered;
    };
    root.append(h("div", { class: "lab-row" }, plat, scoreEl), ev, h("div", { class: "lab-cap", text: "Adapter dịch thành" }), opts, fb, h("div", { class: "lab-buttons" }, next));
    draw();
  };

  const init = () => { initCall(); initLifetime(); initCallbacks(); };
  if (window.document$) document$.subscribe(init);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
