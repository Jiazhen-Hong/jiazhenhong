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
      const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#6c858a77'); g.addColorStop(.45, '#61d5dd44'); g.addColorStop(.55, '#61d5dd55'); g.addColorStop(1, '#61d5ddaa');
      ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.stroke();
    }
    if (!reduced) requestAnimationFrame(drawHero);
  }
  drawHero();

  const state = { seq: 30, mask: 50, heads: 8, channels: 14, seed: 3, selected: 0 };
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
        ctx.strokeStyle = panel ? '#ff745c' : '#91a7aa'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    masked.forEach((i) => { const x = i * w / blocks, bw = w / blocks + .5; ctx.fillStyle = '#20373ee8'; ctx.fillRect(x, 19, bw, panelH - 25); ctx.strokeStyle = '#55747d'; ctx.setLineDash([3, 3]); ctx.strokeRect(x, 19, bw, panelH - 25); ctx.setLineDash([]); });
  }

  function updateGrowth() {
    const ratio = state.seq / 5, quad = ratio * ratio;
    $('#tokenCount').textContent = `${(state.seq * 128).toLocaleString()} time steps`;
    $('#transformerGrowth').textContent = `×${quad.toFixed(1)}`; $('#mambaGrowth').textContent = `×${ratio.toFixed(1)}`;
    $('#transformerBar').style.width = `${Math.max(2, Math.min(100, quad / 576 * 100))}%`;
    $('#mambaBar').style.width = `${Math.max(2, Math.min(100, ratio / 24 * 100))}%`;
  }

  function updatePlay() {
    $('#seqValue').textContent = `${state.seq} s`; $('#maskValue').textContent = `${state.mask}%`; $('#headValue').textContent = state.heads; $('#montageValue').textContent = `${state.channels} ch`; $('#visibleValue').textContent = `${100 - state.mask}%`;
    ['seq','mask','heads'].forEach((id) => setFill($(`#${id}`))); drawSequence(); updateGrowth(); renderScalps();
  }
  $('#seq').addEventListener('input', (e) => { state.seq = +e.target.value; updatePlay(); });
  $('#mask').addEventListener('input', (e) => { state.mask = +e.target.value; updatePlay(); });
  $('#heads').addEventListener('input', (e) => { state.heads = +e.target.value; updatePlay(); });
  $$('#montageButtons button').forEach((b) => b.addEventListener('click', () => { state.channels = +b.dataset.ch; $$('#montageButtons button').forEach((x) => x.classList.toggle('active', x === b)); state.selected = 0; updatePlay(); }));
  $('#resample').addEventListener('click', () => { state.seed++; drawSequence(); });
  $('#reset').addEventListener('click', () => { Object.assign(state, { seq: 30, mask: 50, heads: 8, channels: 14, seed: 3, selected: 0 }); $('#seq').value = 30; $('#mask').value = 50; $('#heads').value = 8; $$('#montageButtons button').forEach((b) => b.classList.toggle('active', b.dataset.ch === '14')); updatePlay(); });

  const method = {
    tsr: ['SELF-SUPERVISION','Hide meaningful temporal spans','Temporal Semantic Random masking removes contiguous segments rather than isolated samples, forcing the model to use longer-range neural context.','Learn structure that remains useful beyond local waveform interpolation.',['masked EEG','semantic spans','reconstruction']],
    cdse: ['SPATIAL GENERALIZATION','Map one montage into another','CDSE builds pairwise 3D coordinate differences between input and target electrodes, then learns a soft spatial projection.','Transfer representations across heterogeneous headsets without treating channel names as fixed identities.',['input montage','Δ(x,y,z)','target montage']],
    mamba: ['LONG-SEQUENCE MODELING','Subtract redundant state-space views','Multiple Mamba heads process the sequence. Differential combinations suppress common responses and preserve more distinctive temporal information.','Model long EEG with linear sequence scaling while emphasizing salient dynamics.',['head A','difference Δ','head B']],
    decoder: ['MULTI-SCALE RECONSTRUCTION','Compress, mediate, and rebuild','A U-shaped encoder-decoder combines downsampling, Mamba blocks, upsampling, and skip connections to reconstruct the masked EEG.','Mix global context with local temporal detail across several resolutions.',['encoder','mediator','decoder']]
  };
  $$('.method-tabs button').forEach((button) => button.addEventListener('click', () => {
    $$('.method-tabs button').forEach((b) => b.classList.toggle('active', b === button)); const d = method[button.dataset.step];
    $('#methodKicker').textContent = d[0]; $('#methodTitle').textContent = d[1]; $('#methodText').textContent = d[2]; $('#methodNote').textContent = d[3]; $('#methodVisual').dataset.step = button.dataset.step;
    ['tag1','tag2','tag3'].forEach((c, i) => $(`.${c}`).textContent = d[4][i]);
  }));

  function points(count, phase = 0) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const ring = Math.floor(Math.sqrt(i)), ringStart = ring * ring, inRing = i - ringStart, nRing = Math.max(1, 2 * ring + 1);
      const radius = 18 + ring / Math.max(1, Math.sqrt(count)) * 95, a = phase + inRing / nRing * Math.PI * 2 + ring * .7;
      out.push([150 + Math.cos(a) * radius * .88, 148 + Math.sin(a) * radius, i]);
    }
    return out;
  }
  function scalp(svg, pts, interactive) {
    svg.innerHTML = '<path d="M48 135c-18 0-22 15-18 31 3 13 12 21 23 19M252 135c18 0 22 15 18 31-3 13-12 21-23 19M137 49l13-21 13 21" fill="none" stroke="#294851" stroke-width="2"/><circle cx="150" cy="150" r="105" fill="#092029" stroke="#294851"/>';
    pts.forEach(([x,y,i]) => { const g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class', `dot${interactive && i === state.selected ? ' active' : ''}`); g.innerHTML = `<circle cx="${x}" cy="${y}" r="${interactive ? 7 : 3.5}" fill="${interactive && i === state.selected ? '#ff745c' : '#61d5dd'}" opacity="${interactive && i !== state.selected ? '.72' : '1'}"/>`; if (interactive) { g.setAttribute('role','button'); g.setAttribute('tabindex','0'); const pick=()=>{state.selected=i;renderScalps()}; g.addEventListener('click',pick); g.addEventListener('keydown',(e)=>(e.key==='Enter'||e.key===' ')&&pick()); } svg.appendChild(g); });
  }
  function renderProjection(inputPts, targetPts) {
    const box = $('#projectionLines'); box.innerHTML = ''; const chosen = inputPts[state.selected] || inputPts[0];
    targetPts.map((p) => ({ p, d: Math.hypot(p[0]-chosen[0],p[1]-chosen[1]) })).sort((a,b)=>a.d-b.d).slice(0,8).forEach((item,i) => { const line=document.createElement('i'); line.style.top=`${24+i*7}%`; line.style.width=`${55+Math.max(0,35-item.d/4)}%`; line.style.opacity=`${.75-i*.07}`; line.style.transform=`rotate(${(i-3.5)*4}deg)`; box.appendChild(line); });
  }
  function renderScalps() { const inputPts=points(Math.min(state.channels,64),.4), targetPts=points(64,.1); scalp($('#inputScalp'),inputPts,true); scalp($('#targetScalp'),targetPts,false); renderProjection(inputPts,targetPts); $('#inputMapTitle').textContent=`${state.channels} channels`; }

  const tasks = {
    eyes:['assets/topography/eyes-state.gif','FRONTAL REGION','Eyes open / closed','The repository reports frontal emphasis, consistent with alpha modulation during eye closure.'],
    driver:['assets/topography/driver-distraction.gif','LEFT TEMPORAL REGION','Driver distraction','The repository reports left temporal emphasis, associated with auditory processing and cognitive control under distraction.'],
    workload:['assets/topography/workload.gif','LEFT FRONTAL REGION','Mental workload','The repository reports left frontal emphasis, linked to stress-related workload processing.'],
    tuab:['assets/topography/tuab.gif','OCCIPITAL REGION','Abnormal EEG','The repository reports occipital dominance for distinguishing abnormal EEG.'],
    motor:['assets/topography/motor-imagery.gif','MOTOR CORTEX','Motor imagery','The learned spatial weights localize around sensorimotor regions during motor imagery.']
  };
  $$('.task-list button').forEach((button)=>button.addEventListener('click',()=>{ $$('.task-list button').forEach((b)=>b.classList.toggle('active',b===button)); const d=tasks[button.dataset.task]; $('#topoImage').src=d[0]; $('#topoImage').alt=`Animated SAMBA spatial weights for ${d[2]}`; $('#topoRegion').textContent=d[1]; $('#topoTitle').textContent=d[2]; $('#topoText').textContent=d[3]; }));

  function copy(button,text,label){navigator.clipboard.writeText(text).then(()=>{button.textContent='Copied';setTimeout(()=>button.textContent=label,1400)}).catch(()=>button.textContent='Select text')}
  $('#copyCode').addEventListener('click',()=>copy($('#copyCode'),$('.code-card code').innerText,'Copy'));
  const bib=`@inproceedings{hong2026samba,\n  title={{SAMBA}: Toward an {EEG} Foundation Model via Differential Mamba and Coordinate-Driven Spatial Embedding},\n  author={Hong, Jiazhen and Mackellar, Geoffrey and Ghane, Soheila},\n  booktitle={NeurReps 2026: Symmetry and Geometry in Neural Representations},\n  year={2026},\n  note={Proceedings Track, to appear in Proceedings of Machine Learning Research}\n}`;
  $('#copyCitation').addEventListener('click',()=>copy($('#copyCitation'),bib,'Copy BibTeX'));
  addEventListener('resize',()=>{drawSequence();renderScalps();if(reduced)drawHero()});
  updatePlay();
})();
