const MODES = {
  chat: {
    initial: "I WOULD",
    suggestions: ["LIKE", "WANT", "NEED", "PREFER", "LOVE", "RATHER", "ALSO", "HAVE", "ASK", "SAY"],
    language: "Word prediction",
    location: "remote query",
    evidence: 0.84,
    repetitions: "10 / 10"
  },
  assist: {
    initial: "I DO NOT",
    suggestions: ["LIKE THIS FOOD", "NEED SOME WATER", "FEEL COMFORTABLE", "WANT TO REST", "NEED HELP", "FEEL COLD", "HAVE PAIN", "WANT TO LEAVE", "NEED A BREAK", "FEEL TIRED"],
    language: "Intent prediction",
    location: "local inference",
    evidence: 0.76,
    repetitions: "6 / 10"
  }
};

const keys = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").concat(["DW", "DC", "SP", "EN"]);
const state = { mode: "chat", text: MODES.chat.initial, selections: 0, characters: 0, timer: null, flashIndex: -1 };
const keyboard = document.querySelector("#keyboard");
const composedText = document.querySelector("#composedText");
const selectionCount = document.querySelector("#selectionCount");
const charRate = document.querySelector("#charRate");
const languageMode = document.querySelector("#languageMode");
const languageLocation = document.querySelector("#languageLocation");
const evidenceValue = document.querySelector("#evidenceValue");
const evidenceTrack = document.querySelector("#evidenceTrack");
const repetitionValue = document.querySelector("#repetitionValue");
const stopLabel = document.querySelector("#stopLabel");
const lab = document.querySelector(".lab");
const flashButton = document.querySelector("#flashButton");

function renderKeyboard() {
  keyboard.replaceChildren(...keys.map((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = key === "SP" ? "SPACE" : key;
    button.dataset.key = key;
    button.setAttribute("aria-label", key === "SP" ? "Space" : key === "DC" ? "Delete character" : key === "DW" ? "Delete word" : key === "EN" ? "Finish message" : `Letter ${key}`);
    button.addEventListener("click", () => selectKey(key));
    return button;
  }));
}

function renderSuggestions() {
  const list = MODES[state.mode].suggestions;
  [document.querySelector("#leftSuggestions"), document.querySelector("#rightSuggestions")].forEach((column, columnIndex) => {
    column.replaceChildren(...list.slice(columnIndex * 5, columnIndex * 5 + 5).map((suggestion) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = suggestion;
      button.addEventListener("click", () => selectSuggestion(suggestion));
      return button;
    }));
  });
}

function normalizeText(text) { return text.replace(/\s+/g, " ").trim(); }

function selectKey(key) {
  const before = state.text.length;
  if (key === "DC") state.text = state.text.slice(0, -1);
  else if (key === "DW") state.text = state.text.trim().split(" ").slice(0, -1).join(" ");
  else if (key === "SP") state.text += " ";
  else if (key === "EN") state.text += state.text.endsWith(".") ? "" : ".";
  else state.text += state.text.endsWith(" ") || !state.text ? key : key.toLowerCase();
  state.text = normalizeText(state.text);
  recordSelection(Math.max(0, state.text.length - before));
}

function selectSuggestion(suggestion) {
  const before = state.text.length;
  state.text = normalizeText(`${state.text} ${suggestion}`);
  recordSelection(Math.max(1, state.text.length - before));
}

function recordSelection(charactersAdded) {
  state.selections += 1;
  state.characters += charactersAdded;
  const evidence = Math.min(.98, MODES[state.mode].evidence + state.selections * .017);
  updateStats(evidence);
}

function updateStats(evidence = MODES[state.mode].evidence) {
  composedText.textContent = state.text || "START TYPING";
  selectionCount.textContent = state.selections;
  charRate.textContent = state.selections ? (state.characters / state.selections).toFixed(1) : "0.0";
  languageMode.textContent = MODES[state.mode].language;
  languageLocation.textContent = MODES[state.mode].location;
  evidenceValue.textContent = evidence.toFixed(2);
  evidenceTrack.style.width = `${evidence * 100}%`;
  repetitionValue.textContent = MODES[state.mode].repetitions;
  stopLabel.textContent = state.mode === "assist" ? "Adaptive stop" : "Fixed repetitions";
}

function setMode(mode) {
  state.mode = mode;
  state.text = MODES[mode].initial;
  state.selections = 0;
  state.characters = 0;
  lab.classList.toggle("assist-mode", mode === "assist");
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  stopFlashes();
  renderSuggestions();
  updateStats();
}

function stepFlash() {
  const buttons = [...keyboard.querySelectorAll("button")];
  buttons.forEach((button) => button.classList.remove("flash"));
  state.flashIndex = (state.flashIndex + 1) % buttons.length;
  const row = Math.floor(state.flashIndex / 6);
  if (state.flashIndex % 2 === 0) buttons.filter((_, index) => Math.floor(index / 6) === row).forEach((button) => button.classList.add("flash"));
  else buttons.filter((_, index) => index % 6 === state.flashIndex % 6).forEach((button) => button.classList.add("flash"));
}

function toggleFlashes() {
  if (state.timer) stopFlashes();
  else {
    flashButton.classList.add("running");
    flashButton.lastChild.textContent = " Stop flashes";
    stepFlash();
    state.timer = window.setInterval(stepFlash, 380);
  }
}

function stopFlashes() {
  window.clearInterval(state.timer);
  state.timer = null;
  flashButton.classList.remove("running");
  flashButton.lastChild.textContent = " Simulate flashes";
  keyboard.querySelectorAll("button").forEach((button) => button.classList.remove("flash"));
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
document.querySelector("#resetButton").addEventListener("click", () => setMode(state.mode));
flashButton.addEventListener("click", toggleFlashes);

document.querySelectorAll("[data-video]").forEach((button) => button.addEventListener("click", () => {
  const selected = button.dataset.video;
  document.querySelectorAll("[data-video]").forEach((tab) => {
    const active = tab.dataset.video === selected;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  ["chat", "assist"].forEach((name) => {
    const panel = document.querySelector(`#video-${name}`);
    panel.hidden = name !== selected;
    const iframe = panel.querySelector("iframe");
    if (!panel.hidden && !iframe.src && iframe.dataset.src) iframe.src = iframe.dataset.src;
  });
}));

const citation = `@article{hong2026chatbci,\n  title={ChatBCI, a P300 speller BCI with context-driven word prediction leveraging large language models, from concept to evaluation},\n  author={Hong, Jiazhen and Wang, Weinan and Najafizadeh, Laleh},\n  journal={Scientific Reports},\n  volume={16},\n  pages={6379},\n  year={2026},\n  doi={10.1038/s41598-025-25660-7}\n}`;
document.querySelector("#copyCitation").addEventListener("click", async (event) => {
  try {
    await navigator.clipboard.writeText(citation);
    event.currentTarget.textContent = "Copied";
    window.setTimeout(() => { event.currentTarget.textContent = "Copy BibTeX"; }, 1800);
  } catch { event.currentTarget.textContent = "Copy unavailable"; }
});

const root = document.documentElement;
const themeButton = document.querySelector(".theme-toggle");
const savedTheme = localStorage.getItem("chatbci-theme");
if (savedTheme === "light") root.dataset.theme = "light";
function updateThemeLabel() { themeButton.setAttribute("aria-label", root.dataset.theme === "light" ? "Switch to dark theme" : "Switch to light theme"); }
themeButton.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("chatbci-theme", root.dataset.theme);
  updateThemeLabel();
});
updateThemeLabel();

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) { entry.target.classList.add("in-view"); observer.unobserve(entry.target); }
}), { threshold: .08 });
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

renderKeyboard();
renderSuggestions();
updateStats();
