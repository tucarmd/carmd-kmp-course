// Toy điện thoại mini — chép từ assets/phone-toy.js và script toy của bài 06 khoá gốc.
// PhoneToy.draw(el, screen) vẽ lại el thành một điện thoại hiện `screen`:
//   { title, buttonLabel, buttonEnabled, spinner, status, statusError, rows: [string] }
window.PhoneToy = (() => {
  const text = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value != null) node.textContent = value;
    return node;
  };

  const draw = (el, screen = {}) => {
    el.classList.add("phone");
    el.replaceChildren();
    el.append(text("div", "p-title", screen.title ?? "Device Monitor"));
    const button = text("div", "p-btn", screen.buttonLabel ?? "Scan");
    if (screen.buttonEnabled === false) button.classList.add("off");
    el.append(button);
    const status = text("div", "p-status");
    if (screen.statusError) status.classList.add("err");
    if (screen.spinner) status.append(text("span", "p-spin"));
    status.append(text("span", null, screen.status ?? ""));
    el.append(status);
    (screen.rows ?? []).forEach((row) => el.append(text("div", "p-row", row)));
  };

  return { draw };
})();

// Bài 06, mục 1: cùng các sự kiện điều khiển một màn hình imperative (handler sửa widget)
// và một màn hình declarative (state, rồi render). Handler imperative y hệt code trong bài.
// Chạy lại sau mỗi lần navigation.instant đổi trang; dataset.ready chặn gắn sự kiện hai lần.
const initToy = () => {
  const toy = document.getElementById("toy");
  if (!toy || toy.dataset.ready) return;
  toy.dataset.ready = "1";
  const SAMPLE = ["OBD-II Adapter", "Heart Rate Monitor", "Tire Pressure Sensor"];
  const impEl = document.getElementById("toy-imp");
  const decEl = document.getElementById("toy-dec");
  const stateEl = document.getElementById("toy-state");
  let widgets, state;

  const reset = () => {
    widgets = { buttonEnabled: true, spinner: false, status: "Tap Scan to look for devices.", statusError: false, rows: [] };
    state = { isScanning: false, devices: null };
  };

  const imperative = {
    scan() {
      widgets.buttonEnabled = false;
      widgets.spinner = true;
      widgets.status = "Scanning…";
      widgets.rows = [];
    },
    results(devices) {
      if (devices.length === 0) {
        widgets.status = "No devices found.";
        widgets.statusError = true;
        return;
      }
      widgets.spinner = false;
      widgets.buttonEnabled = true;
      widgets.status = `Devices found: ${devices.length}`;
      widgets.rows = devices;
    },
  };

  const declarative = {
    scan() { state = { isScanning: true, devices: null }; },
    results(devices) { state = { isScanning: false, devices }; },
  };

  const render = (s) => ({
    buttonEnabled: !s.isScanning,
    spinner: s.isScanning,
    status: s.isScanning ? "Scanning…"
      : s.devices === null ? "Tap Scan to look for devices."
      : s.devices.length === 0 ? "No devices found."
      : `Devices found: ${s.devices.length}`,
    statusError: s.devices !== null && s.devices.length === 0,
    rows: s.devices ?? [],
  });

  const draw = () => {
    PhoneToy.draw(impEl, { ...widgets });
    PhoneToy.draw(decEl, render(state));
    stateEl.textContent = "declarative state = " + JSON.stringify(state);
  };

  toy.querySelectorAll("[data-ev]").forEach((button) => {
    button.addEventListener("click", () => {
      const ev = button.dataset.ev;
      if (ev === "reset") reset();
      if (ev === "scan") { imperative.scan(); declarative.scan(); }
      if (ev === "found") { imperative.results(SAMPLE); declarative.results(SAMPLE); }
      if (ev === "none") { imperative.results([]); declarative.results([]); }
      draw();
    });
  });

  reset();
  draw();
};

if (window.document$) document$.subscribe(initToy);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initToy);
else initToy();

// Bài 08, mục 1: cùng một lần quét, do màn hình sở hữu (m02) hoặc do ViewModel sở hữu (m03).
// Chép từ script toy của bài 08 khoá gốc, chỉ dịch chữ trong log. m02 chờ rồi trả hết kết quả một lần;
// m03 đưa từng thiết bị một. Thời gian được làm chậm để kịp bấm giữa lúc quét: 0,7 s mỗi thiết bị,
// timeout 4,2 s và chờ 2,1 s (app thật là 0,3 s, 3 s và 1,5 s).
const initVmToy = () => {
  const toy = document.getElementById("vm-toy");
  if (!toy || toy.dataset.ready) return;
  toy.dataset.ready = "1";
  const SAMPLE = ["OBD-II Adapter", "Heart Rate Monitor", "Tire Pressure Sensor", "Thermometer", "Smart Scale"];
  const STEP = 700, TIMEOUT = 4200, WAIT = 2100;
  const $ = (id) => document.getElementById(id);
  const noOwner = $("vm-toy-noowner");
  let m02, m03, timers = [];

  const log = (id, line) => { const el = $(id); el.textContent += line + "\n"; el.scrollTop = el.scrollHeight; };
  const clearTimers = (owner) => { timers = timers.filter((t) => (t.owner === owner ? (clearTimeout(t.id), false) : true)); };
  const later = (owner, ms, fn) => timers.push({ owner, id: setTimeout(fn, ms) });

  const screenOf = (scan, alive) => {
    if (!alive) return { title: "(màn hình đã mất)", buttonEnabled: false, status: "" };
    if (scan.kind === "idle") return { status: "Tap Scan to look for devices." };
    if (scan.kind === "scanning") return { buttonEnabled: false, spinner: true, status: "Scanning…", rows: scan.found };
    return scan.found.length ? { status: `Devices found: ${scan.found.length}`, rows: scan.found }
      : { status: "No devices found.", statusError: true };
  };
  const draw = () => {
    PhoneToy.draw($("vm-toy-screen"), screenOf(m02.scan, m02.alive));
    PhoneToy.draw($("vm-toy-vm"), screenOf(m03.scan, m03.alive));
  };

  const runScreenScan = () => {
    m02.scan = { kind: "scanning", found: [] };
    later("m02", WAIT, () => {
      m02.scan = { kind: "finished", found: SAMPLE };
      log("vm-toy-log-screen", "chờ xong: lưu kết quả");
      draw();
    });
  };

  const runViewModelScan = () => {
    m03.scan = { kind: "scanning", found: [] };
    SAMPLE.forEach((name, i) => later("m03", STEP * (i + 1), () => {
      m03.scan.found = [...m03.scan.found, name];
      if (!m03.alive) log("vm-toy-log-vm", `  … tìm thấy ${name} (không ai đang xem)`);
      draw();
    }));
    later("m03", TIMEOUT, () => {
      m03.scan = { kind: "finished", found: m03.scan.found };
      log("vm-toy-log-vm", m03.alive ? "timeout: Finished" : "timeout: Finished, cho một màn hình đã mất");
      draw();
    });
  };

  const reset = () => {
    clearTimers("m02"); clearTimers("m03");
    m02 = { alive: true, scan: { kind: "idle" } };
    m03 = { alive: true, scan: { kind: "idle" } };
    $("vm-toy-log-screen").textContent = ""; $("vm-toy-log-vm").textContent = "";
    draw();
  };

  const spin = (el) => { el.classList.add("rotated"); setTimeout(() => el.classList.remove("rotated"), 450); };

  const on = {
    scan() {
      if (m02.alive && m02.scan.kind !== "scanning") { log("vm-toy-log-screen", "scope của màn hình: launch quét"); runScreenScan(); }
      if (m03.alive && m03.scan.kind !== "scanning") { log("vm-toy-log-vm", "viewModelScope: launch quét"); runViewModelScan(); }
    },
    rotate() {
      if (m02.alive) {
        spin($("vm-toy-screen"));
        const wasScanning = m02.scan.kind === "scanning";
        clearTimers("m02");
        // rememberSaveable giữ kết quả đã xong; một lần quét đang chạy thì không lưu được.
        m02.scan = m02.scan.kind === "finished" ? m02.scan : { kind: "idle" };
        log("vm-toy-log-screen", wasScanning ? "Activity bị huỷ: scope của màn hình bị huỷ, mất lần quét" : "Activity bị huỷ: khôi phục kết quả đã lưu");
      }
      if (m03.alive) {
        spin($("vm-toy-vm"));
        log("vm-toy-log-vm", "Activity bị huỷ: ViewModel vẫn còn");
        log("vm-toy-log-vm", `màn hình mới collect uiState: ${m03.scan.kind}${m03.scan.found ? ` (tìm thấy ${m03.scan.found.length})` : ""}`);
      }
    },
    leave() {
      if (m02.alive) {
        m02.alive = false; clearTimers("m02");
        log("vm-toy-log-screen", "màn hình bị huỷ: scope của nó bị huỷ, quét dừng");
      }
      if (m03.alive) {
        m03.alive = false;
        if (noOwner.checked) {
          log("vm-toy-log-vm", "view đã mất, nhưng không ai clear ViewModel");
        } else {
          clearTimers("m03");
          log("vm-toy-log-vm", "owner đã mất: ViewModel bị clear, viewModelScope bị huỷ");
        }
      }
    },
    reset,
  };

  toy.querySelectorAll("[data-ev]").forEach((b) =>
    b.addEventListener("click", () => { on[b.dataset.ev](); draw(); }));
  reset();
};

if (window.document$) document$.subscribe(initVmToy);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initVmToy);
else initVmToy();
