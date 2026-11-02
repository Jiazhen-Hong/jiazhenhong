(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('in-view'));
  }, { threshold: .1 });
  $$('.reveal').forEach((element) => observer.observe(element));

  function canvasContext(canvas) {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  const heroCanvas = $('#heroCanvas');
  const heroStart = performance.now();
  function drawHero(now = 0) {
    const { ctx, w, h } = canvasContext(heroCanvas);
    ctx.clearRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      const base = h * .22 + row * h * .075;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const t = x * .047 + row * 1.6 + (now - heroStart) * .0012;
        const distance = Math.min(1, Math.abs(x - w * .5) / (w * .5));
        const clean = Math.sin(t) * 5 + Math.sin(t * .31) * 7;
        const noise = (Math.sin(t * 6.3) * 5 + Math.sin(t * 12.7) * 2) * Math.max(.12, distance);
        const y = base + clean + noise;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, '#7289aa66');
      gradient.addColorStop(.42, '#4f8cff88');
      gradient.addColorStop(.58, '#64d7e488');
      gradient.addColorStop(1, '#64d7e4bb');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (!reducedMotion) requestAnimationFrame(drawHero);
  }
  drawHero();

  const state = { noise: 65, mask: 50, channels: 14, seed: 3, selected: 'F4' };
  const layouts = {
    8: [['F3',105,92],['F4',195,92],['C3',92,145],['C4',208,145],['P3',107,202],['P4',193,202],['O1',125,234],['O2',175,234]],
    14: [['AF3',105,72],['AF4',195,72],['F7',70,105],['F3',112,105],['F4',188,105],['F8',230,105],['FC5',78,143],['FC6',222,143],['T7',55,170],['T8',245,170],['P7',75,210],['P8',225,210],['O1',125,235],['O2',175,235]],
    19: [['Fp1',120,62],['Fp2',180,62],['F7',72,104],['F3',115,100],['Fz',150,92],['F4',185,100],['F8',228,104],['T7',55,150],['C3',105,150],['Cz',150,145],['C4',195,150],['T8',245,150],['P7',72,202],['P3',115,198],['Pz',150,205],['P4',185,198],['P8',228,202],['O1',125,236],['O2',175,236]],
    22: [['Fp1',120,62],['Fp2',180,62],['F7',70,101],['F3',110,96],['Fz',150,88],['F4',190,96],['F8',230,101],['FC3',106,126],['FC4',194,126],['T7',54,151],['C3',104,150],['Cz',150,145],['C4',196,150],['T8',246,151],['CP3',108,177],['CP4',192,177],['P7',72,204],['P3',116,204],['Pz',150,212],['P4',184,204],['P8',228,204],['Oz',150,239]]
  };
  const layoutNames = { 8: 'SSVEP', 14: 'EPOC X', 19: 'TUH', 22: 'BCI IV 2a' };

  function hash(index, salt = 0) {
    const value = Math.sin((index + 1) * 12.9898 + (salt + 1) * 78.233 + state.seed * 19.19) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  }
  function cleanSignal(t) {
    const shift = state.selected.charCodeAt(0) * .013 + state.seed * .07;
    return Math.sin(t * .48 + shift) * .4 + Math.sin(t * 1.27 + .7) * .18 + Math.sin(t * 2.8 - .2) * .07 + Math.sin(t * .15) * .1;
  }
  function artifact(sample, t, layer = 0) {
    const white = hash(sample, layer) * .68 + hash(sample + 31, layer + 4) * .23;
    const spikeSeed = Math.abs(hash(Math.floor(sample / 23), layer + 9));
    const spike = spikeSeed > .83 ? hash(sample + 47, layer + 12) * (spikeSeed - .83) * 5 : 0;
    const blink = Math.exp(-Math.pow((t % 9) - 4.5, 2) * 2.4) * 1.35;
    return white + spike + blink + Math.sin(t * 9.6 + layer) * .13;
  }
  function trace(ctx, left, right, baseline, amplitude, color, width, alpha, valueAt) {
    ctx.beginPath();
    let sample = 0;
    for (let x = left; x <= right; x += 1.35, sample++) {
      const t = (x - left) / (right - left) * 24;
      const y = baseline - valueAt(t, sample) * amplitude;
      x > left ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.restore();
  }
  function drawSignal() {
    const { ctx, w, h } = canvasContext($('#signalCanvas'));
    const pad = Math.max(22, w * .025), left = pad, right = w - pad, top = 34, bottom = h - 25, baseline = h * .56;
    ctx.fillStyle = '#07162b'; ctx.fillRect(0, 0, w, h);
    for (let i = 1; i < 9; i++) {
      const x = left + (right - left) * i / 9;
      ctx.strokeStyle = '#24446566'; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const y = top + (bottom - top) * i / 4;
      ctx.strokeStyle = '#24446566'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }
    ctx.font = '8px DM Mono, monospace'; ctx.fillStyle = '#8098b7'; ctx.fillText(`CHANNEL · ${state.selected}`, left, 19);
    ctx.fillStyle = '#a99cff'; ctx.fillText(`ARTIFACT · ${state.noise}%`, right - 106, 19);
    const noiseLevel = state.noise / 100;
    for (let layer = 1; layer <= 3; layer++) trace(ctx,left,right,baseline,h*.26,'#9c8cff',.75,.08+noiseLevel*.06,(t,s)=>cleanSignal(t)+artifact(s,t,layer)*noiseLevel*.55);
    trace(ctx,left,right,baseline,h*.26,'#9c8cff',1.05,.72,(t,s)=>cleanSignal(t)+artifact(s,t)*noiseLevel*.72);
    trace(ctx,left,right,baseline,h*.26,'#64d7e4',1.9,.92,(t)=>cleanSignal(t));
  }

  function setFill(input) {
    const percent = (input.value - input.min) / (input.max - input.min) * 100;
    input.style.setProperty('--value', `${percent}%`);
  }
  function renderTokens() {
    const total = 32, hiddenCount = Math.round(total * state.mask / 100);
    const order = [...Array(total).keys()].sort((a,b) => hash(a,20) - hash(b,20));
    const hidden = new Set(order.slice(0,hiddenCount));
    const grid = $('#tokenGrid'); grid.innerHTML = '';
    for (let i=0;i<total;i++) {
      const token = document.createElement('i');
      token.className = hidden.has(i) ? (i % 4 === 0 ? 'masked predicted' : 'masked') : '';
      token.title = hidden.has(i) ? 'Hidden token' : 'Visible token';
      grid.appendChild(token);
    }
    $('#visibleTokens').textContent = `${total-hiddenCount} / ${total}`;
    $('#tokenCaption').textContent = `${state.mask}% hidden`;
  }
  function updatePlayground() {
    $('#noiseValue').textContent = `${state.noise}%`;
    $('#maskValue').textContent = `${state.mask}%`;
    $('#selectedChannel').textContent = state.selected;
    setFill($('#noiseLevel')); setFill($('#maskRatio'));
    drawSignal(); renderTokens();
  }

  function renderInputScalp() {
    const points = layouts[state.channels];
    if (!points.some(([name]) => name === state.selected)) state.selected = points[Math.floor(points.length / 3)][0];
    const group = $('#electrodes'); group.innerHTML = '';
    points.forEach(([name,x,y]) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg','g');
      node.setAttribute('class',`electrode${name===state.selected?' active':''}`);
      node.setAttribute('role','button'); node.setAttribute('tabindex','0'); node.setAttribute('aria-label',`Select ${name}`);
      node.innerHTML = `<circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y+3}" text-anchor="middle">${name}</text>`;
      const select = () => { state.selected = name; updateMapping(); updatePlayground(); };
      node.addEventListener('click',select); node.addEventListener('keydown',(event)=>(event.key==='Enter'||event.key===' ')&&select());
      group.appendChild(node);
    });
  }
  function renderUniversalScalp() {
    const selected = layouts[state.channels].find(([name]) => name === state.selected) || layouts[state.channels][0];
    const [,sx,sy] = selected, group = $('#universalPoints'); group.innerHTML = '';
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i=0;i<348;i++) {
      const radius = Math.sqrt((i+.5)/348)*94, angle = i*golden;
      const x = 150 + Math.cos(angle)*radius, y = 150 + Math.sin(angle)*radius;
      const distance = Math.hypot(x-sx,y-sy), weight = Math.exp(-(distance*distance)/(2*36*36));
      const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx',x.toFixed(2)); dot.setAttribute('cy',y.toFixed(2)); dot.setAttribute('r',(1.25+weight*3.5).toFixed(2));
      dot.setAttribute('fill',weight>.55?`rgba(100,215,228,${(.2+weight*.8).toFixed(2)})`:`rgba(79,140,255,${(.1+weight*.55).toFixed(2)})`);
      group.appendChild(dot);
    }
    $('#targetTitle').textContent = `${state.selected} neighbors`;
  }
  function updateMapping() {
    const name = layoutNames[state.channels];
    $('#montageValue').textContent = `${name} · ${state.channels} ch`;
    $('#layoutTitle').textContent = `${name} · ${state.channels} channels`;
    $$('#channelSelect button').forEach((button) => { const active = +button.dataset.channels===state.channels; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); });
    renderInputScalp(); renderUniversalScalp();
  }

  $('#noiseLevel').addEventListener('input',(event)=>{state.noise=+event.target.value;updatePlayground();});
  $('#maskRatio').addEventListener('input',(event)=>{state.mask=+event.target.value;updatePlayground();});
  $('#resampleButton').addEventListener('click',()=>{state.seed+=1;updatePlayground();});
  $('#resetLab').addEventListener('click',()=>{Object.assign(state,{noise:65,mask:50,seed:3});$('#noiseLevel').value=65;$('#maskRatio').value=50;updatePlayground();});
  $$('#channelSelect button').forEach((button)=>button.addEventListener('click',()=>{state.channels=+button.dataset.channels;state.selected=layouts[state.channels][Math.floor(layouts[state.channels].length/3)][0];updateMapping();updatePlayground();}));
  updateMapping(); updatePlayground();

  const methodData = {
    token:{eyebrow:'LOCATION + SIGNAL',title:'Turn EEG into positioned tokens',text:'Each patch carries signal and scalp location.',why:'The model can read a new headset.',nodes:['EEG','X','z'],small:['many layouts','tokens','shared space'],tag:'(u,v) + STFT'},
    latent:{eyebrow:'MASKED LATENT SPACE',title:'Predict hidden features',text:'A student predicts the teacher at masked positions.',why:'Learn structure beyond raw noise.',nodes:['mask','S','T'],small:['hidden patches','student','EMA teacher'],tag:'ALIGN + REG'},
    clean:{eyebrow:'NOISE-AWARE TARGET',title:'Rebuild clean EEG',text:'The decoder learns from artifact-removed targets.',why:'Keep brain activity, not artifacts.',nodes:['raw','X','clean'],small:['noisy input','decoder','ICA target'],tag:'DiCT LOSS'},
    transfer:{eyebrow:'FROZEN TRANSFER',title:'Reuse the encoder',text:'A linear probe reads frozen EEG-X features.',why:'One encoder supports new tasks.',nodes:['EEG','z','ŷ'],small:['new headset','frozen encoder','task label'],tag:'LINEAR PROBE'}
  };
  $$('.method-tabs button').forEach((button)=>button.addEventListener('click',()=>{
    $$('.method-tabs button').forEach((item)=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active));});
    const data=methodData[button.dataset.stage];
    $('#methodEyebrow').textContent=data.eyebrow;$('#methodTitle').textContent=data.title;$('#methodText').textContent=data.text;$('#methodWhy').textContent=data.why;$('#methodVisual').dataset.stage=button.dataset.stage;$('#methodTag').textContent=data.tag;
    ['A','B','C'].forEach((letter,index)=>{$(`#node${letter}`).textContent=data.nodes[index];$(`#small${letter}`).textContent=data.small[index];});
  }));

  const scenarios = {
    low:{direct:'0.58',dict:'9.26',text:'Direct MSE misses the lost fast patterns.'},
    mixed:{direct:'6.14',dict:'6.74',text:'DiCT balances slow and fast components.'},
    phase:{direct:'13.88',dict:'7.25',text:'DiCT better preserves shape under a phase shift.'}
  };
  let scenario='low';
  function drawDict() {
    const {ctx,w,h}=canvasContext($('#dictCanvas'));
    ctx.fillStyle='#eaf1fb';ctx.fillRect(0,0,w,h);ctx.font='8px DM Mono, monospace';ctx.fillStyle='#66778c';ctx.fillText('TARGET',14,18);ctx.fillText('RECONSTRUCTION',14,h/2+18);ctx.strokeStyle='#b8c7db';ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    const draw=(baseline,target)=>{ctx.beginPath();for(let x=0;x<=w;x+=1.4){const t=x/w*Math.PI*8;let phase=0,low=1,mid=.35,high=.18;if(!target&&scenario==='low'){mid=.06;high=.02;}if(!target&&scenario==='mixed'){low=.55;mid=.35;high=.2;}if(!target&&scenario==='phase')phase=.85;const value=Math.sin(t*.5+phase)*low+Math.sin(t*1.5+phase)*mid+Math.sin(t*3.5+phase)*high;const y=baseline-value*h*.09;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle=target?'#10213c':'#315fb5';ctx.lineWidth=1.5;ctx.stroke();};
    draw(h*.28,true);draw(h*.78,false);
  }
  function updateDict(){const data=scenarios[scenario];$('#directMse').textContent=data.direct;$('#dictMse').textContent=data.dict;$('#dictExplanation').textContent=data.text;drawDict();}
  $$('.scenario-picker button').forEach((button)=>button.addEventListener('click',()=>{scenario=button.dataset.scenario;$$('.scenario-picker button').forEach((item)=>item.classList.toggle('active',item===button));updateDict();}));
  updateDict();

  const results={
    crowd:{metric:'ACCURACY (%)',values:{BioT:77.76,LaBraM:77.28,EEGPT:79.55,CBraMod:78.41,'EEG-X':86.89},note:'TUAB pretraining → a different 14-channel headset.'},
    bci:{metric:'BALANCED ACC. (%)',values:{BioT:27.26,LaBraM:32.44,EEGPT:30.07,CBraMod:30.07,'EEG-X':37.58},note:'TUAB pretraining → 22-channel motor imagery.'},
    ssvep:{metric:'BALANCED ACC. (%)',values:{BioT:42.12,LaBraM:38.89,EEGPT:24.14,CBraMod:41.44,'EEG-X':57.17},note:'TUAB pretraining → an 8-channel SSVEP layout.'}
  };
  let dataset='crowd';
  function renderResults(){const data=results[dataset],values=Object.values(data.values),max=Math.max(...values)*1.06,chart=$('#barChart');chart.innerHTML='';Object.entries(data.values).forEach(([name,value])=>{const row=document.createElement('div');row.className=`bar-row${name==='EEG-X'?' highlight':''}`;row.innerHTML=`<span>${name}</span><div class="bar-track"><div class="bar-fill"></div></div><span>${value.toFixed(2)}</span>`;chart.appendChild(row);requestAnimationFrame(()=>$('.bar-fill',row).style.width=`${value/max*100}%`);});const sorted=values.slice().sort((a,b)=>b-a),best=data.values['EEG-X'];$('#resultValue').textContent=best.toFixed(2);$('#resultDelta').textContent=`+${(best-sorted[1]).toFixed(2)} points`;$('#metricLabel').textContent=data.metric;$('#chartNote').textContent=data.note;}
  $$('.dataset-tabs button').forEach((button)=>button.addEventListener('click',()=>{dataset=button.dataset.dataset;$$('.dataset-tabs button').forEach((item)=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active));});renderResults();}));
  renderResults();

  const bibtex=`@article{foumani2025eegx,\n  title={EEG-X: Device-Agnostic and Noise-Robust Foundation Model for EEG},\n  author={Mohammadi Foumani, Navid and Ghane, Soheila and Nguyen, Nam and Salehi, Mahsa and Webb, Geoffrey I. and Mackellar, Geoffrey},\n  journal={arXiv preprint arXiv:2511.08861},\n  year={2025}\n}`;
  $('#copyCitation').addEventListener('click',()=>{const button=$('#copyCitation');navigator.clipboard.writeText(bibtex).then(()=>{button.textContent='Copied';setTimeout(()=>button.textContent='Copy BibTeX',1400);}).catch(()=>button.textContent='Select citation');});
  addEventListener('resize',()=>{drawSignal();drawDict();if(reducedMotion)drawHero();});
})();
