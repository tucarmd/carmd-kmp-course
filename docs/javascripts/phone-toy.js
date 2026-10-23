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
