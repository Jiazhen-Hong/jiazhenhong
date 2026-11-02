(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('in-view'));
  }, { threshold: 0.12 });
  $$('.reveal').forEach((el) => observer.observe(el));

  const glow = $('.cursor-glow');
  if (glow) addEventListener('pointermove', (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  });

  function fitCanvas(canvas) {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width: rect.width, height: rect.height };
  }

  // Hero signal animation
  const heroCanvas = $('#heroCanvas');
  let heroStart = performance.now();
  function drawHero(now = 0) {
    const { ctx, width: w, height: h } = fitCanvas(heroCanvas);
    ctx.clearRect(0, 0, w, h);
    const mid = w * 0.5;
    for (let row = 0; row < 9; row++) {
      const y0 = h * 0.2 + row * h * 0.075;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const t = x * 0.045 + row * 1.7 + (now - heroStart) * 0.0015;
        const clean = Math.sin(t) * 5 + Math.sin(t * 0.36) * 7;
        const noise = x < mid ? Math.sin(t * 4.3) * 4 + (Math.sin(t * .15) > .94 ? 12 : 0) : Math.sin(t * 1.7) * 1.2;
        const amp = Math.max(.2, Math.abs(x - mid) / (w * .5));
        const y = y0 + (clean + noise) * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(170,178,181,.45)');
      g.addColorStop(.48, 'rgba(255,106,61,.28)');
      g.addColorStop(.52, 'rgba(117,212,216,.25)');
      g.addColorStop(1, 'rgba(117,212,216,.65)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (!reducedMotion) requestAnimationFrame(drawHero);
  }
  drawHero();

  // EEG playground
  const labState = { noise: 38, mask: 50, patch: 128, channels: 14, seed: 1, selected: 'F4' };
  const electrodeLayouts = {
    8: [['F3',105,92],['F4',195,92],['C3',92,145],['C4',208,145],['P3',107,202],['P4',193,202],['O1',125,234],['O2',175,234]],
    14: [['AF3',105,72],['AF4',195,72],['F7',70,105],['F3',112,105],['F4',188,105],['F8',230,105],['FC5',78,143],['FC6',222,143],['T7',55,170],['T8',245,170],['P7',75,210],['P8',225,210],['O1',125,235],['O2',175,235]],
    19: [['Fp1',120,62],['Fp2',180,62],['F7',72,104],['F3',115,100],['Fz',150,92],['F4',185,100],['F8',228,104],['T7',55,150],['C3',105,150],['Cz',150,145],['C4',195,150],['T8',245,150],['P7',72,202],['P3',115,198],['Pz',150,205],['P4',185,198],['P8',228,202],['O1',125,236],['O2',175,236]],
    22: [['Fp1',120,62],['Fp2',180,62],['F7',70,101],['F3',110,96],['Fz',150,88],['F4',190,96],['F8',230,101],['FC3',106,126],['FC4',194,126],['T7',54,151],['C3',104,150],['Cz',150,145],['C4',196,150],['T8',246,151],['CP3',108,177],['CP4',192,177],['P7',72,204],['P3',116,204],['Pz',150,212],['P4',184,204],['P8',228,204],['Oz',150,239]]
  };

  function seeded(i, seed = labState.seed) {
    const value = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function cleanSignal(t, channelShift = 0) {
    return Math.sin(t * .82 + channelShift) * .44 + Math.sin(t * 2.35 + .8) * .22 + Math.sin(t * 5.7) * .08;
  }

  function drawSignal(canvas, kind) {
    const { ctx, width: w, height: h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += w / 8) { ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, h - 5); ctx.stroke(); }

    const tokenCount = Math.max(8, Math.round(4096 / labState.patch));
    const hiddenCount = Math.round(tokenCount * labState.mask / 100);
    const hidden = new Set([...Array(tokenCount).keys()].sort((a, b) => seeded(a + 80) - seeded(b + 80)).slice(0, hiddenCount));
    if (kind === 'raw') {
      hidden.forEach((i) => {
        ctx.fillStyle = 'rgba(255,106,61,.065)';
        ctx.fillRect(i * w / tokenCount, 5, w / tokenCount - 2, h - 10);
      });
    }
    ctx.beginPath();
    for (let x = 0; x <= w; x += 1.5) {
      const t = x / w * 24;
      let v = cleanSignal(t, labState.selected.charCodeAt(0) * .03);
      if (kind === 'raw') {
        const n = labState.noise / 100;
        v += n * (Math.sin(t * 17) * .13 + Math.sin(t * 30.5) * .08);
        const blink = Math.exp(-Math.pow((t % 8) - 4, 2) * 3.2);
        v += n * blink * 1.25;
      } else if (kind === 'recon') {
        const difficulty = (labState.mask / 100) * .25 + (labState.noise / 100) * .12;
        v = v * (1 - difficulty * .18) + Math.sin(t * 2.1 + 1.4) * difficulty * .1;
      }
      const y = h / 2 - v * h * .32;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = kind === 'raw' ? '#aeb4b5' : kind === 'target' ? '#75d4d8' : '#ff6a3d';
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  function renderScalp() {
    const group = $('#electrodes');
    group.innerHTML = '';
    const points = electrodeLayouts[labState.channels];
    if (!points.some((p) => p[0] === labState.selected)) labState.selected = points[Math.floor(points.length / 3)][0];
    points.forEach(([name, x, y]) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      node.setAttribute('class', `electrode${name === labState.selected ? ' active' : ''}`);
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', `Select ${name} electrode`);
      node.innerHTML = `<circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y + 3}" text-anchor="middle">${name}</text>`;
      const select = () => { labState.selected = name; updateLab(); };
      node.addEventListener('click', select);
      node.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && select());
      group.appendChild(node);
    });
  }

  function renderTokens() {
    const tokenCount = Math.max(8, Math.round(4096 / labState.patch));
    const hiddenCount = Math.round(tokenCount * labState.mask / 100);
    const hiddenOrder = [...Array(tokenCount).keys()].sort((a, b) => seeded(a + 150) - seeded(b + 150));
    const hidden = new Set(hiddenOrder.slice(0, hiddenCount));
    const grid = $('#tokenGrid');
    grid.style.gridTemplateColumns = `repeat(${Math.min(8, tokenCount)},1fr)`;
    grid.innerHTML = '';
    for (let i = 0; i < tokenCount; i++) {
      const token = document.createElement('i');
      token.className = hidden.has(i) ? (i % 3 === 0 ? 'token predicted' : 'token masked') : 'token visible';
      token.title = hidden.has(i) ? 'Masked token' : 'Visible token';
      grid.appendChild(token);
    }
    $('#visibleTokens').textContent = `${tokenCount - hiddenCount} / ${tokenCount}`;
    $('#tokenCaption').textContent = `${labState.mask}% hidden`;
  }

  function setRangeFill(input) {
    const p = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--value', `${p}%`);
  }

  function updateLab() {
    $('#noiseValue').textContent = `${labState.noise}%`;
    $('#maskValue').textContent = `${labState.mask}%`;
    $('#patchValue').textContent = `${labState.patch} samples`;
    $('#channelValue').textContent = `${labState.channels} ch`;
    $('#selectedChannel').textContent = labState.selected;
    $('#layoutStatus').textContent = `${labState.channels} → universal map`;
    ['noiseLevel', 'maskRatio', 'patchSize'].forEach((id) => setRangeFill($(`#${id}`)));
    drawSignal($('#rawCanvas'), 'raw');
    drawSignal($('#targetCanvas'), 'target');
    drawSignal($('#reconCanvas'), 'recon');
    renderScalp();
    renderTokens();
  }

  $('#noiseLevel').addEventListener('input', (e) => { labState.noise = +e.target.value; updateLab(); });
  $('#maskRatio').addEventListener('input', (e) => { labState.mask = +e.target.value; updateLab(); });
  $('#patchSize').addEventListener('input', (e) => { labState.patch = +e.target.value; updateLab(); });
  $$('#channelSelect button').forEach((button) => button.addEventListener('click', () => {
    $$('#channelSelect button').forEach((b) => b.classList.toggle('active', b === button));
    labState.channels = +button.dataset.channels;
    updateLab();
  }));
  $('#resampleButton').addEventListener('click', () => { labState.seed += 1; updateLab(); });
  $('#resetLab').addEventListener('click', () => {
    Object.assign(labState, { noise: 38, mask: 50, patch: 128, channels: 14, seed: 1, selected: 'F4' });
    $('#noiseLevel').value = 38; $('#maskRatio').value = 50; $('#patchSize').value = 128;
    $$('#channelSelect button').forEach((b) => b.classList.toggle('active', b.dataset.channels === '14'));
    updateLab();
  });
  updateLab();

  const pipelineData = {
    tokenizer: { eyebrow: 'DEVICE VARIABILITY', title: 'Position, not device identity', text: 'Each channel receives an embedding from its scalp coordinates. Nearby electrodes get similar representations, even when headset names and layouts differ.', takeaway: 'A pretrained model can understand a new 8-, 14-, or 22-channel layout without relearning every channel from scratch.', tags: ['F4 · (u,v)', 'P7 · (u,v)', 'Cz · (u,v)'], nodes: ['EEG', 'X', 'z'], small: ['variable layout', 'EEG-X', 'shared space'] },
    latent: { eyebrow: 'LATENT SELF-PREDICTION', title: 'Learn what the hidden signal means', text: 'A student sees masked tokens. A teacher sees the complete sample. A predictor learns to match the teacher representation at hidden positions.', takeaway: 'The target lives in a learned feature space, where small raw-signal details and artifacts matter less.', tags: ['MASK 50%', 'EMA TEACHER', 'ALIGN + REG'], nodes: ['x̄', 'S', 'T'], small: ['masked tokens', 'student', 'teacher target'] },
    raw: { eyebrow: 'NOISE-AWARE RECONSTRUCTION', title: 'Reconstruct the clean target', text: 'The decoder receives student features and predicted masked features, but its target is artifact-removed EEG rather than the original noisy recording.', takeaway: 'The representation is rewarded for keeping neural information, not for reproducing eye, muscle, heart, or line artifacts.', tags: ['RAW EEG', 'ICA + ICLABEL', 'DiCT LOSS'], nodes: ['x', 'X', 'x̂'], small: ['noisy input', 'decoder', 'clean target'] },
    downstream: { eyebrow: 'FROZEN TRANSFER', title: 'Reuse the encoder anywhere', text: 'After pretraining, the tokenizer and student encoder are frozen. A simple classifier learns a new task from their representations.', takeaway: 'One foundation model supports emotion, workload, abnormal EEG, motor imagery, SSVEP, and other tasks across devices.', tags: ['FROZEN', 'LINEAR PROBE', 'NEW DEVICE'], nodes: ['EEG', 'z', 'ŷ'], small: ['new sample', 'frozen encoder', 'task label'] }
  };

  $$('.pipeline-tab').forEach((tab) => tab.addEventListener('click', () => {
    $$('.pipeline-tab').forEach((t) => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
    const stage = tab.dataset.stage, data = pipelineData[stage];
    $('#pipelineEyebrow').textContent = data.eyebrow;
    $('#pipelineTitle').textContent = data.title;
    $('#pipelineText').textContent = data.text;
    $('#pipelineTakeaway').textContent = data.takeaway;
    $('#pipelineVisual').dataset.stage = stage;
    ['tag-a','tag-b','tag-c'].forEach((c, i) => $(`.${c}`).textContent = data.tags[i]);
    ['input-node','core-node','output-node'].forEach((c, i) => { $(`.${c} span`).textContent = data.nodes[i]; $(`.${c} small`).textContent = data.small[i]; });
  }));

  // DiCT comparison
  const scenarios = {
    low: { direct: '0.58', dict: '9.26', text: 'Direct MSE looks small because the large slow wave dominates, even though faster components are missing.' },
    mixed: { direct: '6.14', dict: '6.74', text: 'With more frequency content restored, the structured DiCT error becomes comparable to the direct error.' },
    phase: { direct: '13.88', dict: '7.25', text: 'A phase shift produces a large pointwise penalty, while DiCT better recognizes the preserved temporal structure.' }
  };
  let scenario = 'low';
  function drawDict() {
    const canvas = $('#dictCanvas');
    const { ctx, width: w, height: h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '9px DM Mono, monospace';
    ctx.fillStyle = '#777'; ctx.fillText('TARGET', 10, 20); ctx.fillText('RECONSTRUCTION', 10, h / 2 + 20);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    const draw = (y0, target) => {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 1.5) {
        const t = x / w * Math.PI * 8;
        let phase = 0, low = 1, mid = .35, high = .18;
        if (!target && scenario === 'low') { mid = .06; high = .02; }
        if (!target && scenario === 'mixed') { low = .55; mid = .35; high = .2; }
        if (!target && scenario === 'phase') phase = .85;
        const v = Math.sin(t * .5 + phase) * low + Math.sin(t * 1.5 + phase) * mid + Math.sin(t * 3.5 + phase) * high;
        const y = y0 - v * h * .09;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = target ? '#111' : '#a84226'; ctx.lineWidth = 1.5; ctx.stroke();
    };
    draw(h * .30, true); draw(h * .79, false);
  }
  function updateDict() { const s = scenarios[scenario]; $('#directMse').textContent = s.direct; $('#dictMse').textContent = s.dict; $('#dictExplanation').textContent = s.text; drawDict(); }
  $$('.scenario-picker button').forEach((button) => button.addEventListener('click', () => { scenario = button.dataset.scenario; $$('.scenario-picker button').forEach((b) => b.classList.toggle('active', b === button)); updateDict(); }));
  updateDict();

  // Cross-domain results from EEG-X Table 3
  const results = {
    crowd: { values: { BioT: 77.76, LaBraM: 77.28, EEGPT: 79.55, CBraMod: 78.41, 'EEG-X': 86.89 }, note: 'EEG-X transfers from a clinical 19-channel montage to a consumer 14-channel headset.' },
    bci: { values: { BioT: 27.26, LaBraM: 32.44, EEGPT: 30.07, CBraMod: 30.07, 'EEG-X': 37.58 }, note: 'EEG-X adapts to a 22-channel motor-imagery setup with only a linear probe.' },
    ssvep: { values: { BioT: 42.12, LaBraM: 38.89, EEGPT: 24.14, CBraMod: 41.44, 'EEG-X': 57.17 }, note: 'Location embeddings preserve useful spatial relationships in the very different 8-channel SSVEP layout.' }
  };
  let dataset = 'crowd';
  function renderChart() {
    const data = results[dataset], values = Object.values(data.values), max = Math.max(...values) * 1.08;
    const chart = $('#barChart'); chart.innerHTML = '';
    Object.entries(data.values).forEach(([name, value]) => {
      const row = document.createElement('div'); row.className = `bar-row${name === 'EEG-X' ? ' highlight' : ''}`;
      row.innerHTML = `<span class="name">${name}</span><div class="bar-track"><div class="bar-fill"></div></div><span class="value">${value.toFixed(2)}</span>`;
      chart.appendChild(row);
      requestAnimationFrame(() => $('.bar-fill', row).style.width = `${value / max * 100}%`);
    });
    const sorted = values.slice().sort((a, b) => b - a), best = data.values['EEG-X'];
    $('#resultValue').textContent = best.toFixed(2);
    $('#resultDelta').textContent = `+${(best - sorted[1]).toFixed(2)} points over the strongest baseline`;
    $('#chartNote').textContent = data.note;
  }
  $$('.dataset-tabs button').forEach((tab) => tab.addEventListener('click', () => { dataset = tab.dataset.dataset; $$('.dataset-tabs button').forEach((t) => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); }); renderChart(); }));
  renderChart();

  function copyText(button, text, defaultLabel) {
    navigator.clipboard.writeText(text).then(() => { button.textContent = 'Copied'; setTimeout(() => button.textContent = defaultLabel, 1400); }).catch(() => { button.textContent = 'Select text'; });
  }
  $('#copyCode').addEventListener('click', () => copyText($('#copyCode'), $('.code-card code').innerText, 'Copy'));
  const bibtex = `@article{foumani2025eegx,\n  title={EEG-X: Device-Agnostic and Noise-Robust Foundation Model for EEG},\n  author={Mohammadi Foumani, Navid and Ghane, Soheila and Nguyen, Nam and Salehi, Mahsa and Webb, Geoffrey I. and Mackellar, Geoffrey},\n  journal={arXiv preprint arXiv:2511.08861},\n  year={2025}\n}`;
  $('#copyCitation').addEventListener('click', () => copyText($('#copyCitation'), bibtex, 'Copy BibTeX'));

  addEventListener('resize', () => { updateLab(); drawDict(); if (reducedMotion) drawHero(); });
})();
