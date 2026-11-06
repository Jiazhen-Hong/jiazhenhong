const root = document.documentElement;
const themeColor = document.querySelector('meta[name="theme-color"]');
const themeButton = document.querySelector(".theme-x");
const pageNav = document.querySelector("header.nav");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function syncThemeControls() {
  const light = root.dataset.theme === "light";
  if (themeColor) themeColor.content = light ? "#F5F5F3" : "#101820";
  if (themeButton) themeButton.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
}

if (themeButton) {
  themeButton.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    const applyTheme = () => {
      root.dataset.theme = nextTheme;
      try { window.localStorage.setItem("dcode-theme", nextTheme); } catch (_) {}
      syncThemeControls();
    };
    if (document.startViewTransition && !prefersReducedMotion.matches) document.startViewTransition(applyTheme);
    else applyTheme();
  });
}

function updateNavigation() {
  if (!pageNav) return;
  pageNav.classList.toggle("scrolled", window.scrollY > 8);
  pageNav.classList.toggle("top", window.scrollY <= 8);
}

window.addEventListener("scroll", updateNavigation, { passive: true });
syncThemeControls();
updateNavigation();

const symbols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789_".split("");
const grid = document.querySelector("#spellerGrid");
const decoded = document.querySelector("#decodedText");
const statusText = document.querySelector("#replayStatus");
const replayButton = document.querySelector("#replayButton");
const repeatSlider = document.querySelector("#repeatSlider");
const repeatValue = document.querySelector("#repeatValue");
const modelSelect = document.querySelector("#modelSelect");
const heroTypedText = document.querySelector("#heroTypedText");
const calibrationRace = document.querySelector(".calibration-race");

const heroMessage = "THOUGHTS\nINTO\nWORDS";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let heroTypingTimer = null;
let heroTypingIndex = 0;
let heroDeleting = false;

function scheduleHeroTyping(delay) {
  heroTypingTimer = window.setTimeout(updateHeroTyping, delay);
}

function updateHeroTyping() {
  if (reducedMotion.matches) {
    heroTypedText.textContent = heroMessage;
    return;
  }

  if (!heroDeleting) {
    heroTypingIndex += 1;
    heroTypedText.textContent = heroMessage.slice(0, heroTypingIndex);

    if (heroTypingIndex < heroMessage.length) {
      const typedCharacter = heroMessage[heroTypingIndex - 1];
      scheduleHeroTyping(typedCharacter === "\n" ? 260 : 72);
    } else {
      heroDeleting = true;
      scheduleHeroTyping(1800);
    }
    return;
  }

  heroTypingIndex -= 1;
  heroTypedText.textContent = heroMessage.slice(0, heroTypingIndex);

  if (heroTypingIndex > 0) {
    scheduleHeroTyping(34);
  } else {
    heroDeleting = false;
    scheduleHeroTyping(520);
  }
}

function startHeroTyping() {
  if (heroTypingTimer) window.clearTimeout(heroTypingTimer);
  heroTypingTimer = null;
  heroTypingIndex = reducedMotion.matches ? heroMessage.length : 0;
  heroDeleting = false;
  heroTypedText.textContent = reducedMotion.matches ? heroMessage : "";
  if (!reducedMotion.matches) scheduleHeroTyping(450);
}

reducedMotion.addEventListener("change", startHeroTyping);
startHeroTyping();

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

function updateSelectionSpeed() {
  const flashesPerSelection = Number(repeatSlider.value);
  const calibrationCycle = 2.8 + (flashesPerSelection - 4) * 0.36;
  repeatValue.textContent = flashesPerSelection;
  calibrationRace.style.setProperty("--calibration-cycle", `${calibrationCycle.toFixed(2)}s`);
}

repeatSlider.addEventListener("input", updateSelectionSpeed);
updateSelectionSpeed();
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
