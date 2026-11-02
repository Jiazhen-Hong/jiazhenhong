(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const observer = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in-view')), { threshold: .1 });
  $$('.reveal').forEach((el) => observer.observe(el));

  function canvasContext(canvas) {
    const ratio = Math.min(devicePixelRatio || 1, 2), rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * ratio)), h = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  const hero = $('#heroCanvas');
  function drawHero(time = 0) {
    const { ctx, w, h } = canvasContext(hero); ctx.clearRect(0, 0, w, h);
    const mid = w * .5;
    for (let row = 0; row < 8; row++) {
      const y0 = h * .22 + row * h * .075; ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const t = x * .055 + row * .8 + time * .001;
        const envelope = x < mid ? 1 : .55 + .45 * Math.cos((x - mid) / Math.max(1, w - mid) * Math.PI / 2);
        const y = y0 + (Math.sin(t) * 5 + Math.sin(t * 2.7) * 2.5 + Math.sin(t * .17) * 4) * envelope;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#71808f66'); g.addColorStop(.45, '#55c7d455'); g.addColorStop(.58, '#f4bd6266'); g.addColorStop(1, '#ff6f61cc');
      ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.stroke();
    }
    if (!reduced) requestAnimationFrame(drawHero);
  }
  drawHero();

  const state = { seq: 30, mask: 50, heads: 8, channels: 14, seed: 3, selected: 0 };
  const montageByChannels = { 2: 'mn8', 14: 'epocx', 32: 'standard32', 64: 'physionet64', 128: 'grosse128', 256: 'standard256' };
  const montages = window.SAMBA_MONTAGES || {};
  function currentMontage() { return montages[montageByChannels[state.channels]]; }
  function rand(i) { const x = Math.sin((i + state.seed * 31) * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function signal(t, row) { return Math.sin(t * (.72 + row * .018) + row) * .48 + Math.sin(t * 2.2 + row * .3) * .2 + Math.sin(t * 6.2) * .07; }

  function setFill(input) { const p = (+input.value - +input.min) / (+input.max - +input.min) * 100; input.style.setProperty('--value', `${p}%`); }
  function maskBlocks(count) {
    const target = Math.round(count * state.mask / 100), masked = new Set(); let guard = 0;
    while (masked.size < target && guard++ < 1000) {
      const start = Math.floor(rand(guard * 7) * count), length = 1 + Math.floor(rand(guard * 11) * Math.max(2, count / 10));
      for (let i = start; i < Math.min(count, start + length) && masked.size < target; i++) masked.add(i);
    }
    return masked;
  }

  function drawSequence() {
    const canvas = $('#sequenceCanvas'), { ctx, w, h } = canvasContext(canvas); ctx.clearRect(0, 0, w, h);
    const rows = 6, panelH = h / 2, blocks = Math.max(16, Math.round(state.seq / 2)), masked = maskBlocks(blocks);
    ctx.font = '8px DM Mono, monospace'; ctx.fillStyle = '#647f85'; ctx.fillText('MASKED INPUT', 7, 13); ctx.fillText('RECONSTRUCTION', 7, panelH + 13);
    ctx.strokeStyle = '#17333d'; ctx.beginPath(); ctx.moveTo(0, panelH); ctx.lineTo(w, panelH); ctx.stroke();
    for (let row = 0; row < rows; row++) {
      for (let panel = 0; panel < 2; panel++) {
        const y0 = 30 + row * (panelH - 38) / rows + panel * panelH; ctx.beginPath();
        for (let x = 0; x <= w; x += 1.5) {
          const t = x / w * state.seq * .9; let v = signal(t, row);
          if (panel === 1) v = v * .96 + Math.sin(t * 2.5 + 1.2) * (state.mask / 100) * .045;
          const y = y0 - v * 13; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = panel ? '#ff6f61' : '#aeb8c4'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    masked.forEach((i) => { const x = i * w / blocks, bw = w / blocks + .5; ctx.fillStyle = '#17353be0'; ctx.fillRect(x, 19, bw, panelH - 25); ctx.strokeStyle = '#55c7d4'; ctx.setLineDash([3, 3]); ctx.strokeRect(x, 19, bw, panelH - 25); ctx.setLineDash([]); });
  }

  function drawDifferentialSignal() {
    const canvas = $('#diffCanvas'), { ctx, w, h } = canvasContext(canvas); ctx.clearRect(0, 0, w, h);
    const rows = [h * .2, h * .5, h * .8], labels = ['x₁', 'λx₂', 'x₁ − λx₂'];
    const residual = .58 / Math.sqrt(state.heads / 2);
    ctx.font = '8px DM Mono, monospace'; ctx.lineWidth = 1;
    rows.forEach((y, index) => {
      ctx.strokeStyle = '#17343d'; ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillStyle = '#69848a'; ctx.fillText(labels[index], 7, y + 3);
    });
    const trace = (row, color, valueAt) => {
      ctx.beginPath();
      for (let x = 30; x <= w; x += 1.5) {
        const t = (x - 30) / Math.max(1, w - 30) * 18;
        const y = rows[row] - valueAt(t) * Math.min(22, h * .105);
        x === 30 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color; ctx.lineWidth = row === 2 ? 1.8 : 1.1; ctx.stroke();
    };
    const neural = (t) => Math.sin(t * .72) * .62 + Math.sin(t * 1.9 + .6) * .22;
    const shared = (t) => Math.sin(t * 6.1) * .34 + Math.sin(t * 10.7 + .4) * .18 + (Math.sin(t * .36) > .78 ? .32 * Math.sin(t * 14) : 0);
    trace(0, '#55c7d4', (t) => neural(t) + shared(t));
    trace(1, '#ffb05c', (t) => shared(t) * .94 + Math.sin(t * 5.6 + 1.1) * .045);
    trace(2, '#edf4f2', (t) => neural(t) + shared(t) * residual + Math.sin(t * (4 + state.heads * .15)) * residual * .07);
    const residualPercent = Math.round(residual * 100);
    $('#headPairCount').textContent = `${state.heads} PAIRED HEADS · ${state.heads * 2} MAMBA BRANCHES`;
    $('#noiseResidual').textContent = `${residualPercent}% synthetic residual`;
  }

  function renderDifferentialHeads() {
    const container = $('#diffHeads'); container.innerHTML = '';
    for (let index = 0; index < state.heads; index++) {
      const head = document.createElement('div'); head.className = 'diff-head-card';
      head.innerHTML = `<span class="mono">H${index + 1}</span><div><i>A</i><i>B</i></div><b>− λ</b><strong>Δ</strong>`;
      container.appendChild(head);
    }
  }

  function updateDifferentialDemo() { renderDifferentialHeads(); drawDifferentialSignal(); }

  function updateGrowth() {
    const ratio = state.seq / 5, quad = ratio * ratio;
    const maxRatio = +$('#seq').max / 5, maxGrowth = maxRatio * maxRatio;
    const sharedLogScale = (value) => Math.log1p(value) / Math.log1p(maxGrowth) * 100;
    $('#tokenCount').textContent = `${(state.seq * 128).toLocaleString()} time steps`;
    $('#transformerGrowth').textContent = `×${quad.toFixed(1)}`; $('#mambaGrowth').textContent = `×${ratio.toFixed(1)}`;
    $('#transformerBar').style.width = `${Math.max(2, sharedLogScale(quad))}%`;
    $('#mambaBar').style.width = `${Math.max(2, sharedLogScale(ratio))}%`;
  }

  const benchmark = {
    sampleRate: 128,
    measuredMax: 2000,
    maxSteps: 600 * 128,
    memory: { points: [[200, 207.20], [2000, 1437.54]], unit: 'MB', decimals: 0 },
    inference: { points: [[200, .28], [2000, .38]], unit: 'ms', decimals: 2 }
  };

  function affineEstimate(points, steps) {
    const [[x1, y1], [x2, y2]] = points;
    const slope = (y2 - y1) / (x2 - x1);
    return Math.max(0, y1 + (steps - x1) * slope);
  }

  function drawResourceChart(canvas, series, currentSteps) {
    const { ctx, w, h } = canvasContext(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = { left: 39, right: 12, top: 19, bottom: 28 };
    const plotW = Math.max(1, w - pad.left - pad.right), plotH = Math.max(1, h - pad.top - pad.bottom);
    const x = (steps) => pad.left + steps / benchmark.maxSteps * plotW;
    const maxValue = affineEstimate(series.points, benchmark.maxSteps) * 1.12;
    const y = (value) => pad.top + plotH - value / maxValue * plotH;
    const boundaryX = x(benchmark.measuredMax);

    ctx.font = '7px DM Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#617b81';
    ctx.strokeStyle = '#17343d';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const value = maxValue * i / 3, yy = y(value);
      ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(w - pad.right, yy); ctx.stroke();
      const label = series.unit === 'MB' ? `${Math.round(value / 100) * 100}` : value.toFixed(1);
      ctx.fillText(label, pad.left - 6, yy + 3);
    }

    ctx.textAlign = 'center';
    [0, 120, 240, 360, 480, 600].forEach((seconds) => {
      const xx = x(seconds * benchmark.sampleRate);
      ctx.fillStyle = '#617b81'; ctx.fillText(`${seconds}s`, xx, h - 8);
    });

    ctx.fillStyle = '#171b24';
    ctx.fillRect(boundaryX, pad.top, w - pad.right - boundaryX, plotH);
    ctx.save();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#ffb05caa';
    ctx.beginPath(); ctx.moveTo(boundaryX, pad.top); ctx.lineTo(boundaryX, pad.top + plotH); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffc17f'; ctx.font = '7px DM Mono, monospace'; ctx.textAlign = 'left';
    ctx.fillText('REPORTED TO 2,000', Math.min(boundaryX + 5, w - 105), pad.top + 9);

    const start = series.points[0], end = series.points[1];
    ctx.strokeStyle = '#55c7d4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x(start[0]), y(start[1])); ctx.lineTo(x(end[0]), y(end[1])); ctx.stroke();

    ctx.save();
    ctx.setLineDash([7, 5]); ctx.strokeStyle = '#ffb05c';
    ctx.beginPath(); ctx.moveTo(x(end[0]), y(end[1])); ctx.lineTo(x(benchmark.maxSteps), y(affineEstimate(series.points, benchmark.maxSteps))); ctx.stroke();
    ctx.restore();

    series.points.forEach(([steps, value]) => {
      ctx.beginPath(); ctx.arc(x(steps), y(value), 3.5, 0, Math.PI * 2); ctx.fillStyle = '#55c7d4'; ctx.fill();
      ctx.strokeStyle = '#0e1017'; ctx.lineWidth = 1; ctx.stroke();
    });

    const currentValue = affineEstimate(series.points, currentSteps);
    ctx.beginPath(); ctx.arc(x(currentSteps), y(currentValue), 5, 0, Math.PI * 2);
    ctx.fillStyle = currentSteps > benchmark.measuredMax ? '#ffb05c' : '#fff2ef'; ctx.fill();
    ctx.strokeStyle = '#0e1017'; ctx.lineWidth = 2; ctx.stroke();
  }

  function updateResourceForecast() {
    const steps = state.seq * benchmark.sampleRate;
    const memory = affineEstimate(benchmark.memory.points, steps);
    const inference = affineEstimate(benchmark.inference.points, steps);
    $('#memoryEstimate').textContent = `${Math.round(memory).toLocaleString()} MB`;
    $('#inferenceEstimate').textContent = `${inference.toFixed(2)} ms`;
    const estimated = steps > benchmark.measuredMax;
    const status = $('#estimateStatus');
    status.classList.toggle('estimated', estimated);
    status.classList.toggle('measured', !estimated);
    status.querySelector('span').textContent = estimated ? 'ESTIMATED' : 'MEASURED RANGE';
    status.querySelector('small').textContent = estimated ? 'Beyond reported resource points' : 'Interpolated between reported resource points';
    drawResourceChart($('#memoryChart'), benchmark.memory, steps);
    drawResourceChart($('#inferenceChart'), benchmark.inference, steps);
  }

  function updatePlay() {
    const montage = currentMontage();
    $('#seqValue').textContent = `${state.seq} s`; $('#maskValue').textContent = `${state.mask}%`; $('#headValue').textContent = state.heads; $('#montageValue').textContent = montage ? `${montage.label} · ${montage.channels} ch` : `${state.channels} ch`; $('#visibleValue').textContent = `${100 - state.mask}%`;
    ['seq','mask','heads'].forEach((id) => setFill($(`#${id}`))); drawSequence(); updateDifferentialDemo(); updateGrowth(); updateResourceForecast(); renderScalps();
  }
  $('#seq').addEventListener('input', (e) => { state.seq = +e.target.value; updatePlay(); });
  $('#mask').addEventListener('input', (e) => { state.mask = +e.target.value; updatePlay(); });
  $('#heads').addEventListener('input', (e) => { state.heads = +e.target.value; updatePlay(); });
  $$('#montageButtons button').forEach((b) => b.addEventListener('click', () => { state.channels = +b.dataset.ch; $$('#montageButtons button').forEach((x) => x.classList.toggle('active', x === b)); state.selected = 0; updatePlay(); }));
  $('#resample').addEventListener('click', () => { state.seed++; drawSequence(); });
  $('#reset').addEventListener('click', () => { Object.assign(state, { seq: 30, mask: 50, heads: 8, channels: 14, seed: 3, selected: 0 }); $('#seq').value = 30; $('#mask').value = 50; $('#heads').value = 8; $$('#montageButtons button').forEach((b) => b.classList.toggle('active', b.dataset.ch === '14')); updatePlay(); });

  const method = {
    tsr: ['SELF-SUPERVISION','Hide meaningful spans','Mask contiguous EEG, then reconstruct it from context.','Learn beyond local interpolation.',['masked EEG','semantic spans','reconstruction']],
    cdse: ['SPATIAL MAPPING','Learn a map between layouts','Pairwise 3D coordinate differences pass through an MLP and softmax to form W.','Project input EEG into a shared target montage.',['input montage','Δ(x,y,z)','target montage']],
    mamba: ['LONG CONTEXT','Subtract shared responses','Paired Mamba branches remove redundant temporal responses.','Keep distinctive dynamics.',['head A','difference Δ','head B']],
    decoder: ['RECONSTRUCTION','Compress and rebuild','A U-shaped decoder restores masked EEG across scales.','Mix global and local context.',['encoder','mediator','decoder']]
  };
  $$('.method-tabs button').forEach((button) => button.addEventListener('click', () => {
    $$('.method-tabs button').forEach((b) => b.classList.toggle('active', b === button)); const d = method[button.dataset.step];
    $('#methodKicker').textContent = d[0]; $('#methodTitle').textContent = d[1]; $('#methodText').textContent = d[2]; $('#methodNote').textContent = d[3]; $('#methodVisual').dataset.step = button.dataset.step;
    ['tag1','tag2','tag3'].forEach((c, i) => $(`.${c}`).textContent = d[4][i]);
  }));

  const svgNS = 'http://www.w3.org/2000/svg';
  const headOutline = '<path d="M48 135c-18 0-22 15-18 31 3 13 12 21 23 19M252 135c18 0 22 15 18 31-3 13-12 21-23 19M137 49l13-21 13 21" fill="none" stroke="#485563" stroke-width="2"/><circle cx="150" cy="150" r="105" fill="#111821" stroke="#485563"/>';

  function projectPoint(point) {
    return { x: 150 + point.x / .105 * 102, y: 150 - point.y / .12 * 100 };
  }

  const methodHeadOutline = '<path d="M48 135c-18 0-22 15-18 31 3 13 12 21 23 19M252 135c18 0 22 15 18 31-3 13-12 21-23 19M137 49l13-21 13 21" fill="none" stroke="#9c7773" stroke-width="2"/><circle cx="150" cy="150" r="105" fill="#f3ebe9" stroke="#9c7773" stroke-width="2"/>';

  function renderMethodTopo(svg, montage, fill) {
    if (!svg || !montage) return;
    svg.innerHTML = methodHeadOutline;
    const radius = montage.points.length <= 14 ? 6.5 : montage.points.length <= 64 ? 4.1 : montage.points.length <= 128 ? 3 : 2.1;
    montage.points.forEach((point) => {
      const projected = projectPoint(point), circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', projected.x); circle.setAttribute('cy', projected.y); circle.setAttribute('r', radius);
      circle.setAttribute('fill', fill); circle.setAttribute('opacity', '.82');
      circle.setAttribute('stroke', '#f7f1ef'); circle.setAttribute('stroke-width', '.55');
      svg.appendChild(circle);
    });
  }

  function renderMethodCdse(montage, target) {
    renderMethodTopo($('#methodInputTopo'), montage, '#3f9daa');
    renderMethodTopo($('#methodTargetTopo'), target, '#e35e51');
    $('#methodInputLabel').textContent = `${montage.label} · ${montage.channels} ch`;
    $('#methodTargetLabel').textContent = `${target.label} · ${target.channels} ch`;
  }

  function electrodeRadius(count) {
    if (count <= 14) return 7;
    if (count <= 64) return 4.3;
    if (count <= 128) return 3.1;
    return 2.25;
  }

  function proxyWeights(inputPoints, targetPoints) {
    const sigma = inputPoints.length <= 2 ? .08 : inputPoints.length <= 14 ? .052 : .038;
    const sigma2 = 2 * sigma * sigma;
    return targetPoints.map((target, targetIndex) => {
      const logits = inputPoints.map((input) => {
        const dx = target.x - input.x, dy = target.y - input.y, dz = target.z - input.z;
        return -(dx * dx + dy * dy + dz * dz) / sigma2;
      });
      const maxLogit = Math.max(...logits);
      const exp = logits.map((value) => Math.exp(value - maxLogit));
      const denominator = exp.reduce((sum, value) => sum + value, 0);
      return { targetIndex, value: exp[state.selected] / denominator };
    });
  }

  function relativeWeights(weights) {
    const values = weights.map((weight) => weight.value), min = Math.min(...values), max = Math.max(...values);
    return weights.map((weight) => ({ ...weight, relative: max === min ? 1 : (weight.value - min) / (max - min) }));
  }

  function weightColor(relative) {
    const hue = 34 - 26 * Math.pow(relative, .78);
    const light = 55 + 9 * relative;
    return `hsl(${hue.toFixed(0)} 88% ${light.toFixed(0)}%)`;
  }

  function makeTitle(text) {
    const title = document.createElementNS(svgNS, 'title');
    title.textContent = text;
    return title;
  }

  function renderInputScalp(svg, montage) {
    svg.innerHTML = headOutline;
    const radius = electrodeRadius(montage.points.length);
    montage.points.forEach((point, index) => {
      const projected = projectPoint(point), selected = index === state.selected;
      const group = document.createElementNS(svgNS, 'g');
      group.setAttribute('class', `electrode input-electrode${selected ? ' active' : ''}`);
      group.setAttribute('data-index', index);
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.setAttribute('aria-label', `Select ${point.name}`);
      group.appendChild(makeTitle(`${point.name} · (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)}) m`));
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', projected.x); circle.setAttribute('cy', projected.y); circle.setAttribute('r', selected ? radius + 1.6 : radius);
      circle.setAttribute('fill', selected ? '#ff6f61' : '#55c7d4'); circle.setAttribute('opacity', selected ? '1' : '.72');
      circle.setAttribute('stroke', selected ? '#fff2ef' : '#0e1017'); circle.setAttribute('stroke-width', selected ? '1.4' : '.6');
      group.appendChild(circle);
      const pick = () => { state.selected = index; renderScalps(); };
      group.addEventListener('click', pick);
      group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); } });
      svg.appendChild(group);
    });
  }

  function renderTargetScalp(svg, targetMontage, weights, selectedName) {
    svg.innerHTML = headOutline;
    weights.forEach((weight) => {
      const point = targetMontage.points[weight.targetIndex], projected = projectPoint(point);
      const visual = .2 + .8 * Math.pow(weight.relative, .45);
      const group = document.createElementNS(svgNS, 'g');
      group.setAttribute('class', 'electrode target-electrode');
      group.setAttribute('data-index', weight.targetIndex);
      group.appendChild(makeTitle(`${point.name}: ${(weight.value * 100).toFixed(2)}% contribution from ${selectedName}`));
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', projected.x); circle.setAttribute('cy', projected.y);
      circle.setAttribute('r', 3.5 + visual * 4.1); circle.setAttribute('fill', weightColor(weight.relative));
      circle.setAttribute('opacity', .45 + visual * .5); circle.setAttribute('stroke', '#16090c'); circle.setAttribute('stroke-width', '.65');
      group.appendChild(circle); svg.appendChild(group);
    });
  }

  function renderProjectionBars(weights) {
    const box = $('#projectionLines'); box.innerHTML = '';
    [...weights].sort((a, b) => b.value - a.value).slice(0, 8).forEach((weight, index) => {
      const line = document.createElement('i'); line.style.top = `${24 + index * 7}%`; line.style.width = `${48 + 42 * weight.relative}%`;
      line.style.opacity = `${.28 + .62 * weight.relative}`; line.style.transform = `rotate(${(index - 3.5) * 3.2}deg)`; line.style.background = `linear-gradient(90deg,transparent,${weightColor(weight.relative)},transparent)`; box.appendChild(line);
    });
  }

  function renderMappingOverlay(weights) {
    const overlay = $('#mappingOverlay'), lab = $('.spatial-lab'), selected = $('#inputScalp .input-electrode.active circle');
    if (!overlay || !lab || !selected) return;
    const labRect = lab.getBoundingClientRect(), sourceRect = selected.getBoundingClientRect();
    overlay.setAttribute('viewBox', `0 0 ${labRect.width} ${labRect.height}`); overlay.innerHTML = '';
    const sourceX = sourceRect.left + sourceRect.width / 2 - labRect.left, sourceY = sourceRect.top + sourceRect.height / 2 - labRect.top;
    [...weights].sort((a, b) => a.value - b.value).forEach((weight) => {
      const target = $(`#targetScalp .target-electrode[data-index="${weight.targetIndex}"] circle`); if (!target) return;
      const targetRect = target.getBoundingClientRect(), targetX = targetRect.left + targetRect.width / 2 - labRect.left, targetY = targetRect.top + targetRect.height / 2 - labRect.top;
      const path = document.createElementNS(svgNS, 'path');
      const bend = Math.max(45, Math.abs(targetX - sourceX) * .32);
      path.setAttribute('d', `M ${sourceX} ${sourceY} C ${sourceX + bend} ${sourceY}, ${targetX - bend} ${targetY}, ${targetX} ${targetY}`);
      const emphasis = Math.pow(weight.relative, .85);
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', weightColor(weight.relative)); path.setAttribute('stroke-width', .45 + emphasis * 2.5); path.setAttribute('opacity', .035 + emphasis * .48);
      overlay.appendChild(path);
    });
  }

  function renderScalps() {
    const montage = currentMontage(), target = montages.target64;
    if (!montage || !target) return;
    state.selected = Math.min(state.selected, montage.points.length - 1);
    const selected = montage.points[state.selected], weights = relativeWeights(proxyWeights(montage.points, target.points));
    renderInputScalp($('#inputScalp'), montage); renderTargetScalp($('#targetScalp'), target, weights, selected.name); renderProjectionBars(weights); renderMethodCdse(montage, target);
    $('#inputMapTitle').textContent = `${montage.label} · ${montage.channels} channels${montage.schematic ? ' · schematic' : ''}`;
    $('#selectedChannel').textContent = selected.name;
    const strongest = [...weights].sort((a, b) => b.value - a.value)[0];
    $('#weightSummary').textContent = `Peak: ${target.points[strongest.targetIndex].name} · ${(strongest.value * 100).toFixed(1)}%`;
    requestAnimationFrame(() => renderMappingOverlay(weights));
  }

  const tasks = {
    eyes:['assets/topography/eyes-state.gif','FRONTAL REGION','Eyes open / closed','The repository reports frontal emphasis, consistent with alpha modulation during eye closure.'],
    driver:['assets/topography/driver-distraction.gif','LEFT TEMPORAL REGION','Driver distraction','The repository reports left temporal emphasis, associated with auditory processing and cognitive control under distraction.'],
    workload:['assets/topography/workload.gif','LEFT FRONTAL REGION','Mental workload','The repository reports left frontal emphasis, linked to stress-related workload processing.'],
    tuab:['assets/topography/tuab.gif','OCCIPITAL REGION','Abnormal EEG','The repository reports occipital dominance for distinguishing abnormal EEG.'],
    motor:['assets/topography/motor-imagery.gif','MOTOR CORTEX','Motor imagery','The learned spatial weights localize around sensorimotor regions during motor imagery.']
  };
  $$('.task-list button').forEach((button)=>button.addEventListener('click',()=>{ $$('.task-list button').forEach((b)=>b.classList.toggle('active',b===button)); const d=tasks[button.dataset.task]; $('#topoImage').src=d[0]; $('#topoImage').alt=`Animated SAMBA spatial weights for ${d[2]}`; $('#topoRegion').textContent=d[1]; $('#topoTitle').textContent=d[2]; $('#topoText').textContent=d[3]; }));

  function copy(button,text,label){navigator.clipboard.writeText(text).then(()=>{button.textContent='Copied';setTimeout(()=>button.textContent=label,1400)}).catch(()=>button.textContent='Select text')}
  if ($('#copyCode')) $('#copyCode').addEventListener('click',()=>copy($('#copyCode'),$('.code-card code').innerText,'Copy'));
  const bib=`@inproceedings{hong2026samba,\n  title={{SAMBA}: Toward an {EEG} Foundation Model via Differential Mamba and Coordinate-Driven Spatial Embedding},\n  author={Hong, Jiazhen and Mackellar, Geoffrey and Ghane, Soheila},\n  booktitle={NeurReps 2026: Symmetry and Geometry in Neural Representations},\n  year={2026},\n  note={Proceedings Track, to appear in Proceedings of Machine Learning Research}\n}`;
  $('#copyCitation').addEventListener('click',()=>copy($('#copyCitation'),bib,'Copy BibTeX'));
  addEventListener('resize',()=>{drawSequence();drawDifferentialSignal();updateResourceForecast();renderScalps();if(reduced)drawHero()});
  updatePlay();
})();
