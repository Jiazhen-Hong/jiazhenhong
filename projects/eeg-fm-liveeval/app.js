const symbols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789_".split("");
const grid = document.querySelector("#spellerGrid");
const decoded = document.querySelector("#decodedText");
const statusText = document.querySelector("#replayStatus");
const replayButton = document.querySelector("#replayButton");
const repeatSlider = document.querySelector("#repeatSlider");
const repeatValue = document.querySelector("#repeatValue");
const modelSelect = document.querySelector("#modelSelect");

const cells = symbols.map((symbol) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = symbol;
  button.tabIndex = -1;
  grid.appendChild(button);
  return button;
});

const outputs = {
  foundation: "BRAIN",
  scratch: "BJAPN",
  swlda: "BRA1N"
};

let timer = null;
let step = 0;
let flash = 0;

function clearCells() {
  cells.forEach((cell) => cell.classList.remove("flash", "target"));
}

function stopReplay() {
  if (timer) window.clearInterval(timer);
  timer = null;
  replayButton.textContent = "▶ Start replay";
}

function runReplay() {
  stopReplay();
  clearCells();
  step = 0;
  flash = 0;
  decoded.textContent = "_____";
  statusText.textContent = "Flashing";
  replayButton.textContent = "↻ Restart replay";
  const sequence = outputs[modelSelect.value];
  const flashesPerSelection = Number(repeatSlider.value);
  const speed = Math.max(85, 215 - flashesPerSelection * 10);

  timer = window.setInterval(() => {
    clearCells();
    const target = symbols.indexOf("BRAIN"[step]);
    const targetRow = Math.floor(target / 6);
    const targetColumn = target % 6;
    const activeRow = flash % 2 === 0 ? targetRow : (targetRow + flash + 1) % 6;
    const activeColumn = flash % 2 === 1 ? targetColumn : (targetColumn + flash + 2) % 6;

    cells.forEach((cell, index) => {
      if (Math.floor(index / 6) === activeRow || index % 6 === activeColumn) cell.classList.add("flash");
    });
    if (target >= 0) cells[target].classList.add("target");
    flash += 1;

    if (flash >= flashesPerSelection) {
      const visible = sequence.slice(0, step + 1).padEnd(5, "_");
      decoded.textContent = visible;
      step += 1;
      flash = 0;
      statusText.textContent = step < 5 ? `Selection ${step + 1} / 5` : "Complete";
    }

    if (step >= 5) {
      stopReplay();
      clearCells();
      statusText.textContent = "Complete";
    }
  }, speed);
}

repeatSlider.addEventListener("input", () => {
  repeatValue.textContent = repeatSlider.value;
});
replayButton.addEventListener("click", runReplay);
modelSelect.addEventListener("change", () => {
  stopReplay();
  clearCells();
  decoded.textContent = "_____";
  statusText.textContent = "Ready";
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("seen");
  });
}, { threshold: 0.12 });

document.querySelectorAll(".section, .hero-copy, .hero-orbit").forEach((element) => observer.observe(element));
