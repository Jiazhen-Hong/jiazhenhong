(() => {
  "use strict";

  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const themeButton = document.querySelector("#themeToggle");

  function syncThemeControl() {
    const light = root.dataset.theme === "light";
    if (themeColor) themeColor.content = light ? "#f4f3ed" : "#1d2926";
    if (themeButton) themeButton.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
  }

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      const apply = () => {
        const next = root.dataset.theme === "light" ? "dark" : "light";
        root.dataset.theme = next;
        try { window.localStorage.setItem("dcode-theme", next); } catch (_) {}
        syncThemeControl();
      };
      if (document.startViewTransition) document.startViewTransition(apply);
      else apply();
    });
  }
  syncThemeControl();

  const COLORS = {
    ink: "#1f2b28",
    paper: "#f6f4ee",
    lime: "#bdd8b1",
    mint: "#a8d2c1",
    coral: "#d98e80",
    blue: "#8aaabd",
    muted: "#909b97",
  };

  const STAGES = [
    {
      pill: "LOCAL OPTIMUM",
      title: "A stable but wrong fit",
      description: "Lloyd updates have stopped. One center covers two clusters while two centers compete for another.",
      move: "LOCAL TRAP",
      loss: 1.0,
    },
    {
      pill: "MISMATCH FOUND",
      title: "Detect OFM and MFO",
      description: "The most dispersed fitted cluster is marked as one-fit-many. The closest center pair is marked as many-fit-one.",
      move: "DETECT",
      loss: 1.0,
    },
    {
      pill: "FISSION",
      title: "Split the overloaded center",
      description: "Two centers are fitted to the selected cluster. The model temporarily expands from k to k + 1 centers.",
      move: "FISSION",
      loss: 0.58,
    },
    {
      pill: "FUSION",
      title: "Merge the redundant pair",
      description: "The detected pair is replaced by its mean. The model returns to exactly k centers.",
      move: "FUSION",
      loss: 0.38,
    },
    {
      pill: "LLOYD UPDATE",
      title: "Relax into a better solution",
      description: "A few Lloyd updates refine the corrected centers. The new solution is accepted only when the objective decreases.",
      move: "RELAX",
      loss: 0.31,
    },
  ];

  const BASE_CENTERS = {
    truth: [
      { x: 0.22, y: 0.29 },
      { x: 0.22, y: 0.72 },
      { x: 0.70, y: 0.30 },
      { x: 0.73, y: 0.70 },
    ],
    bad: [
      { x: 0.22, y: 0.50 },
      { x: 0.64, y: 0.30 },
      { x: 0.76, y: 0.30 },
      { x: 0.73, y: 0.70 },
    ],
  };

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(random) {
    const u = Math.max(random(), 1e-7);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function makePoints(kind = "balanced", count = 92) {
    const random = mulberry32(kind === "balanced" ? 47 : kind === "overlap" ? 91 : 133);
    const spread = kind === "overlap" ? 0.078 : 0.052;
    return BASE_CENTERS.truth.flatMap((center, cluster) => {
      return Array.from({ length: count }, () => {
        const stretchX = kind === "stretched" ? (cluster % 2 ? 1.55 : 0.72) : 1;
        const stretchY = kind === "stretched" ? (cluster % 2 ? 0.68 : 1.45) : 1;
        return {
          x: center.x + gaussian(random) * spread * stretchX,
          y: center.y + gaussian(random) * spread * stretchY,
          truth: cluster,
        };
      });
    });
  }

  function centersForStage(stage, t = 1) {
    const bad = BASE_CENTERS.bad.map((p) => ({ ...p }));
    if (stage < 2) return bad;

    const splitA = { x: 0.22, y: 0.29 };
    const splitB = { x: 0.22, y: 0.72 };
    if (stage === 2) {
      return [
        lerpPoint(bad[0], splitA, t),
        lerpPoint(bad[0], splitB, t),
        bad[1], bad[2], bad[3],
      ];
    }

    const splitCenters = [splitA, splitB, bad[1], bad[2], bad[3]];
    if (stage === 3) {
      const merged = lerpPoint({ x: 0.70, y: 0.30 }, { x: 0.70, y: 0.30 }, t);
      if (t < 0.98) {
        return [
          splitA, splitB,
          lerpPoint(bad[1], merged, t),
          lerpPoint(bad[2], merged, t),
          bad[3],
        ];
      }
      return [splitA, splitB, merged, bad[3]];
    }

    return splitCenters.length
      ? BASE_CENTERS.truth.map((target, index) => {
          const source = [splitA, splitB, { x: 0.70, y: 0.30 }, bad[3]][index];
          return lerpPoint(source, target, t);
        })
      : BASE_CENTERS.truth;
  }

  function lerpPoint(a, b, t) {
    const smooth = t * t * (3 - 2 * t);
    return { x: a.x + (b.x - a.x) * smooth, y: a.y + (b.y - a.y) * smooth };
  }

  function nearest(point, centers) {
    let best = 0;
    let bestDistance = Infinity;
    centers.forEach((center, index) => {
      const distance = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  }

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }

  function plotPoint(point, width, height, padding) {
    return {
      x: padding + point.x * (width - padding * 2),
      y: padding + point.y * (height - padding * 2),
    };
  }

  function drawDiamond(ctx, x, y, size, fill, stroke) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawClusterScene(canvas, points, stage, progress, options = {}) {
    const { ctx, width, height } = setupCanvas(canvas);
    const dark = Boolean(options.dark);
    const padding = options.compact ? 35 : Math.min(72, width * 0.09);
    const centers = centersForStage(stage, progress);
    const palette = dark
      ? ["#8faec0", "#a8d2c1", "#d99b90", "#b9a7c7", "#d8c798"]
      : ["#7996a6", "#7ea999", "#bf8278", "#9b89a8", "#b5a66f"];

    ctx.clearRect(0, 0, width, height);

    if (stage === 1) {
      const ofm = plotPoint(BASE_CENTERS.bad[0], width, height, padding);
      const mfoA = plotPoint(BASE_CENTERS.bad[1], width, height, padding);
      const mfoB = plotPoint(BASE_CENTERS.bad[2], width, height, padding);
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = COLORS.coral;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(ofm.x, ofm.y, Math.min(width, height) * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mfoA.x, mfoA.y);
      ctx.lineTo(mfoB.x, mfoB.y);
      ctx.stroke();
      ctx.restore();
    }

    points.forEach((point, index) => {
      const assigned = nearest(point, centers);
      const pos = plotPoint(point, width, height, padding);
      ctx.globalAlpha = dark ? 0.48 : 0.5;
      ctx.fillStyle = palette[assigned % palette.length];
      ctx.beginPath();
      const r = options.compact ? 1.6 : 1.9;
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (index % 11 === 0 && dark) {
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.globalAlpha = 1;
    centers.forEach((center, index) => {
      const pos = plotPoint(center, width, height, padding);
      if (stage === 1 && (index === 0 || index === 1 || index === 2)) {
        ctx.strokeStyle = COLORS.coral;
        ctx.globalAlpha = 0.26 + Math.sin(performance.now() / 280) * 0.1;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, options.compact ? 20 : 27, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      drawDiamond(ctx, pos.x, pos.y, options.compact ? 13 : 17, dark ? COLORS.paper : COLORS.ink, COLORS.lime);
      ctx.fillStyle = dark ? COLORS.ink : COLORS.paper;
      ctx.font = `700 ${options.compact ? 7 : 8}px ${getComputedStyle(document.documentElement).getPropertyValue("--mono")}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), pos.x, pos.y + 0.5);
    });

    if ((stage === 2 || stage === 3) && progress < 0.92) {
      ctx.save();
      ctx.strokeStyle = stage === 2 ? COLORS.lime : COLORS.coral;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      if (stage === 2) {
        const source = plotPoint(BASE_CENTERS.bad[0], width, height, padding);
        centers.slice(0, 2).forEach((center) => {
          const target = plotPoint(center, width, height, padding);
          ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y); ctx.stroke();
        });
      } else {
        const target = plotPoint({ x: 0.70, y: 0.30 }, width, height, padding);
        [BASE_CENTERS.bad[1], BASE_CENTERS.bad[2]].forEach((center) => {
          const source = plotPoint(center, width, height, padding);
          ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y); ctx.stroke();
        });
      }
      ctx.restore();
    }
  }

  class Demo {
    constructor() {
      this.canvas = document.querySelector("#labCanvas");
      this.lossCanvas = document.querySelector("#lossCanvas");
      this.stage = 0;
      this.progress = 1;
      this.playing = false;
      this.speed = 1;
      this.points = makePoints();
      this.lastTime = performance.now();
      this.hold = 0;

      this.title = document.querySelector("#stageTitle");
      this.description = document.querySelector("#stageDescription");
      this.pill = document.querySelector("#stagePill");
      this.number = document.querySelector("#stageNumber");
      this.lossValue = document.querySelector("#lossValue");
      this.centerCount = document.querySelector("#centerCount");
      this.playButton = document.querySelector("#playButton");
      this.playLabel = document.querySelector("#playLabel");
      this.playIcon = this.playButton.querySelector(".play-icon");

      this.bind();
      this.setStage(0, false);
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }

    bind() {
      this.playButton.addEventListener("click", () => this.toggle());
      document.querySelector("#stepButton").addEventListener("click", () => {
        this.pause();
        this.setStage((this.stage + 1) % STAGES.length, true);
      });
      document.querySelector("#resetButton").addEventListener("click", () => {
        this.pause();
        this.setStage(0, false);
      });
      document.querySelector("#speedSelect").addEventListener("change", (event) => {
        this.speed = Number(event.target.value);
      });
      document.querySelector("#datasetSelect").addEventListener("change", (event) => {
        this.points = makePoints(event.target.value);
        this.setStage(0, false);
      });
      document.querySelectorAll("#stageStrip button").forEach((button) => {
        button.addEventListener("click", () => {
          this.pause();
          this.setStage(Number(button.dataset.stage), true);
        });
      });
    }

    toggle() {
      this.playing ? this.pause() : this.play();
    }

    play() {
      if (this.stage === STAGES.length - 1 && this.progress >= 1) this.setStage(0, false);
      this.playing = true;
      this.hold = 0;
      this.playLabel.textContent = "Pause";
      this.playIcon.classList.add("pause");
    }

    pause() {
      this.playing = false;
      this.playLabel.textContent = "Play sequence";
      this.playIcon.classList.remove("pause");
    }

    setStage(stage, animate) {
      this.stage = stage;
      this.progress = animate && stage > 1 ? 0 : 1;
      this.hold = 0;
      const current = STAGES[stage];
      this.title.textContent = current.title;
      this.description.textContent = current.description;
      this.pill.textContent = current.pill;
      this.number.textContent = String(stage).padStart(2, "0");
      this.centerCount.textContent = stage === 2 && this.progress < 0.98 ? "5" : "4";
      document.querySelectorAll("#stageStrip button").forEach((button, index) => {
        button.classList.toggle("active", index === stage);
      });
      this.updateMetrics();
    }

    updateMetrics() {
      const previous = this.stage > 0 ? STAGES[this.stage - 1].loss : STAGES[0].loss;
      const current = STAGES[this.stage].loss;
      const value = previous + (current - previous) * this.progress;
      this.lossValue.textContent = value.toFixed(3);
      this.centerCount.textContent = this.stage === 2 && this.progress > 0.08 ? "5" : "4";
      this.drawLoss(value);
    }

    drawLoss(currentValue) {
      const { ctx, width, height } = setupCanvas(this.lossCanvas);
      ctx.clearRect(0, 0, width, height);
      const left = 6, right = width - 6, top = 18, bottom = height - 12;
      ctx.strokeStyle = "rgba(8,17,15,.09)";
      ctx.lineWidth = 1;
      [0, 0.5, 1].forEach((p) => {
        const y = top + p * (bottom - top);
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      });
      const values = STAGES.map((stage, index) => index < this.stage ? stage.loss : index === this.stage ? currentValue : null);
      const coords = values.map((value, index) => value == null ? null : ({
        x: left + index * ((right - left) / (STAGES.length - 1)),
        y: top + (1 - (1.08 - value) / 0.86) * (bottom - top),
      }));
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      coords.forEach((point, index) => {
        if (!point) return;
        index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      coords.forEach((point, index) => {
        if (!point) return;
        ctx.fillStyle = index === this.stage ? COLORS.lime : COLORS.ink;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(point.x, point.y, index === this.stage ? 4.5 : 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    }

    frame(time) {
      const delta = Math.min((time - this.lastTime) / 1000, 0.05);
      this.lastTime = time;
      if (this.progress < 1) {
        this.progress = Math.min(1, this.progress + delta * 0.62 * this.speed);
        this.updateMetrics();
      }
      if (this.playing) {
        if (this.progress >= 1) {
          this.hold += delta * this.speed;
          if (this.hold > 1.05) {
            if (this.stage < STAGES.length - 1) {
              this.setStage(this.stage + 1, true);
            } else {
              this.pause();
            }
          }
        }
      }
      drawClusterScene(this.canvas, this.points, this.stage, this.progress);
      requestAnimationFrame(this.frame);
    }
  }

  class HeroDemo {
    constructor() {
      this.canvas = document.querySelector("#heroCanvas");
      this.points = makePoints("balanced", 64);
      this.start = performance.now();
      this.stageLabel = document.querySelector("#heroStage");
      this.moveLabel = document.querySelector("#heroMove");
      this.counter = document.querySelector("#heroCounter");
      this.tracks = [...document.querySelectorAll(".mini-track span")];
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }

    frame(time) {
      const duration = 8000;
      const elapsed = Math.max(0, time - this.start);
      const unit = (elapsed % duration) / duration;
      const raw = unit * 4;
      const heroIndex = Math.min(3, Math.floor(raw));
      const progress = raw - heroIndex;
      const stage = [1, 2, 3, 4][heroIndex];
      drawClusterScene(this.canvas, this.points, stage, progress, { dark: root.dataset.theme !== "light", compact: true });
      this.stageLabel.textContent = STAGES[stage].title;
      this.moveLabel.textContent = STAGES[stage].move;
      this.counter.textContent = `${String(heroIndex + 1).padStart(2, "0")} / 04`;
      this.tracks.forEach((track, index) => track.classList.toggle("active", index <= heroIndex));
      requestAnimationFrame(this.frame);
    }
  }

  function initReveals() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
  }

  function initCopy() {
    const button = document.querySelector("#copyCode");
    const text = `from sklearn.datasets import make_blobs\nfrom ffkm import FFKMeans\n\nX, _ = make_blobs(n_samples=1000, centers=5, random_state=0)\n\nmodel = FFKMeans(\n    n_clusters=5,\n    ofm_method="SD",\n    mfo_method="PD",\n    random_state=0,\n)\n\nlabels = model.fit_predict(X)\nprint(model.history_["inertia"])`;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
        setTimeout(() => { button.textContent = "Copy"; }, 1600);
      } catch {
        button.textContent = "Select code";
      }
    });
  }

  new Demo();
  new HeroDemo();
  initReveals();
  initCopy();
})();
