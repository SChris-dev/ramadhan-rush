import React, { useEffect, useRef, useState } from 'react';
import './index.css';

// --- AUDIO ENGINE (WEB AUDIO API) ---
const sfx = {
  ctx: null,
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  play(freq, type, dur, vol=0.1) {
    if(!this.ctx) return;
    if(this.ctx.state === 'suspended') this.ctx.resume();
    try {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(); osc.stop(this.ctx.currentTime + dur);
    } catch(e) {}
  },
  playNoise(dur, vol=0.1) {
    if(!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * dur; const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
      const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
      const gain = this.ctx.createGain(); gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
      noise.connect(gain); gain.connect(this.ctx.destination); noise.start();
    } catch(e){}
  },
  tap() { this.play(800, 'sine', 0.1, 0.05); },
  coin() { this.play(1200, 'square', 0.1, 0.05); setTimeout(()=>this.play(1600, 'square', 0.15, 0.05), 100); },
  hit() { this.play(150, 'sawtooth', 0.3, 0.2); setTimeout(()=>this.play(100, 'sawtooth', 0.3, 0.2), 100); },
  jump() { this.play(400, 'sine', 0.1, 0.1); setTimeout(()=>this.play(600, 'sine', 0.2, 0.1), 100); },
  wrong() { this.play(200, 'square', 0.2, 0.15); setTimeout(()=>this.play(150, 'square', 0.3, 0.15), 150); },
  win() { this.play(440, 'triangle', 0.1, 0.1); this.play(554, 'triangle', 0.1, 0.1); setTimeout(()=>this.play(659, 'triangle', 0.2, 0.1), 100); },
  water() { this.playNoise(0.2, 0.1); },
  angry() { this.play(100, 'sawtooth', 0.4, 0.2); },
  instrument(emoji) {
    if(emoji==='🛢️') this.play(150, 'triangle', 0.2, 0.2);
    else if(emoji==='🪵') this.play(800, 'square', 0.1, 0.1);
    else if(emoji==='🍲') this.play(1200, 'sine', 0.2, 0.1);
    else if(emoji==='🥁') this.playNoise(0.2, 0.2);
    else this.tap();
  }
};

// --- KONSTANTA & CONFIG ---
const CANVAS_WIDTH = 800; const CANVAS_HEIGHT = 600; const BASE_LIVES = 5;

const DIFFICULTIES = {
  EASY:   { id: 'KASUAL', name: 'KASUAL', multStart: 0.6, multGrow: 0.04, timeMult: 1.3 },
  PAHALA: { id: 'PAHALA', name: 'PAHALA 🌟', multStart: 1.8, multGrow: 0.25, timeMult: 0.7, desc: 'Tantangan Ekstrem Mode Sultan' }
};

const MINIGAMES = [
  { id: 'TAKJIL', name: 'WAR TAKJIL', baseDur: 6000, inst: 'Tap Takjil! Hindari Basi!', instPahala: 'Takjil Bergerak! Cepat Tap!' },
  { id: 'SAHUR', name: 'PATROLI SAHUR', baseDur: 7000, inst: 'Tap Sesuai Irama Bawah!', instPahala: '4 Jalur Ekstrem! Fokus!' },
  { id: 'TARAWIH', name: 'TAHAN KANTUK', baseDur: 6000, inst: 'Spam Tap Biar Melek!', instPahala: 'Awas Kebablasan Nyaring!' },
  { id: 'SHAF', name: 'SUSUN SHAF', baseDur: 5500, inst: 'Tap Barisan Kosong!', instPahala: 'Celah Shaf Bergeser!' },
  { id: 'SARUNG', name: 'PERANG SARUNG', baseDur: 8000, inst: 'Tap Lompat! Injak Musuh!', instPahala: 'Lari Cepat! Musuh Brutal!' },
  { id: 'MOKEL', name: 'PEMBASMI MOKEL', baseDur: 7000, inst: 'Tap Godaan! Biarkan Ibadah!', instPahala: 'Gelembung Liar Melayang!' },
  { id: 'MASAK', name: 'MASAK TAKJIL', baseDur: 8000, inst: 'Pilih Bahan Sesuai Pesanan!', instPahala: '3 Bahan & Tombol Acak!' },
  { id: 'SEMPROT', name: 'SEMPROT AIR', baseDur: 7000, inst: 'Semprot yg ngantuk! Jaga isi air!', instPahala: 'Ngantuk parah! Cepat semprot!' },
  { id: 'BUKBER', name: 'BUKBER SERVE', baseDur: 18000, inst: 'Sajikan ke meja!', instPahala: 'Meja Sultan! Menu Banyak!' }
];

const SCENERIES = ['MOSQUE', 'NIGHT_MARKET', 'STREET', 'VILLAGE'];

const ASSETS = {
  takjil_good: ['🍧', '🍌', '🥟', '🥤', '🥥', '🍮', '🍉', '🍡'], takjil_bad: ['🤢', '🦠', '🪰'], takjil_rival: ['🏃‍♂️', '🛵'],
  sahur_notes: ['🛢️', '🪵', '🍲', '🥁'], tarawih_sleep: '😴', tarawih_awake: '😳', tarawih_fan: '🌀', shaf_jamaah: '🧍‍♂️',
  sarung_player: '🏃‍♂️', sarung_enemy: ['🥷', '👦', '😈'], sarung_weapon: '🧣',
  mokel_bad: ['🍜', '🍺', '🚬', '🍗'], mokel_good: ['📖', '📿', '🕌', '🤲'], masak_items: ['🍧', '🍌', '🥥', '🥟', '🧊', '🍯', '🍓', '🍵'],
  bukber_items: ['🍗', '🍚', '🥤', '🍛', '🥘', '🍡', '🍉', '☕']
};

const SHOP_ITEMS = [
  { id: 'cons_life', type: 'cons', name: 'Nyawa Darurat', icon: '💚', cost: 100, desc: '+1 Nyawa utk 1 run (Maks 5)' },
  { id: 'cons_double', type: 'cons', name: 'Koin Ganda', icon: '💎', cost: 300, desc: '2x Koin di run berikutnya (Maks 1)' },
  { id: 'fx_star', type: 'fx', name: 'Bintang Berkah', icon: '⭐', cost: 500, desc: 'Efek tap bintang' },
  { id: 'fx_sparkle', type: 'fx', name: 'Percikan Nur', icon: '✨', cost: 500, desc: 'Efek tap sultan' },
  { id: 'fx_moon', type: 'fx', name: 'Aura Bulan', icon: '��', cost: 600, desc: 'Efek tap bulan sabit' },
  { id: 'fx_ketupat', type: 'fx', name: 'Aura Ketupat', icon: '🟩', cost: 600, desc: 'Efek tap ketupat' },
  { id: 'fx_fire', type: 'fx', name: 'Api Semangat', icon: '🔥', cost: 700, desc: 'Efek tap membara' },
  { id: 'fx_love', type: 'fx', name: 'Cinta Ramadhan', icon: '💖', cost: 700, desc: 'Efek tap penuh cinta' },
  { id: 'fx_water', type: 'fx', name: 'Tetesan Wudhu', icon: '💧', cost: 700, desc: 'Efek tap menyegarkan' }
];

const getInitialSave = () => {
  try { return JSON.parse(localStorage.getItem('ramadhanRushV7')) || { bankedScore: 0, ownedItems: ['fx_none'], equipped: { fx: null }, consumables: { cons_life: 0, cons_double: 0 } }; }
  catch(e) { return { bankedScore: 0, ownedItems: ['fx_none'], equipped: { fx: null }, consumables: { cons_life: 0, cons_double: 0 } }; }
};

export default function App() {
  const canvasRef = useRef(null); const containerRef = useRef(null); const bgmRef = useRef(null);
  
  const initSave = getInitialSave();
  const [bankedScore, setBankedScore] = useState(initSave.bankedScore);
  const [ownedItems, setOwnedItems] = useState(initSave.ownedItems);
  const [equipped, setEquipped] = useState(initSave.equipped);
  const [consumables, setConsumables] = useState(initSave.consumables || { cons_life: 0, cons_double: 0 });
  
  const [uiState, setUiState] = useState('MENU');
  const [finalScore, setFinalScore] = useState(0);
  const [customSelection, setCustomSelection] = useState(MINIGAMES.map(m=>m.id));

  const engine = useRef({
    screen: 'MENU', score: 0, lives: BASE_LIVES, level: 1, currentGameIndex: 0,
    stateTimer: 0, lastTime: 0, globalTimer: 0,
    pointer: { x: 0, y: 0, justTapped: false },
    entities: [], particles: [], player: {},
    difficulty: DIFFICULTIES.EASY, difficultyMultiplier: 1.0,
    scenery: 'MOSQUE', history: [], isDoubleActive: false,
    isCustomMode: false, availableGames: MINIGAMES.map(m=>m.id)
  });

  const playBGM = () => {
    if (bgmRef.current && (uiState === 'PLAYING' || uiState === 'TRANSITION')) {
       bgmRef.current.volume = 0.25;
       bgmRef.current.play().catch(e => console.log("BGM Play Error", e));
    }
  };

  useEffect(() => {
    if (bgmRef.current) {
      if (uiState === 'PLAYING' || uiState === 'TRANSITION') {
        bgmRef.current.volume = 0.25;
        bgmRef.current.play().catch(e => console.log("Autoplay prevented BGM"));
      } else {
        bgmRef.current.pause();
        bgmRef.current.currentTime = 0;
      }
    }
  }, [uiState]);

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    let requestRef;

    const drawBackground = (ctx, time, mode, scenery) => {
      const isPahala = mode === 'PAHALA';
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      if (isPahala) { grad.addColorStop(0, '#3A2000'); grad.addColorStop(1, '#1A0B00'); } 
      else {
        if(scenery==='NIGHT_MARKET') { grad.addColorStop(0, '#2A0845'); grad.addColorStop(1, '#6441A5'); }
        else if(scenery==='STREET') { grad.addColorStop(0, '#112233'); grad.addColorStop(1, '#224455'); }
        else if(scenery==='VILLAGE') { grad.addColorStop(0, '#001A00'); grad.addColorStop(1, '#003300'); }
        else { grad.addColorStop(0, '#0F3D24'); grad.addColorStop(1, '#082012'); }
      }
      ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.shadowBlur = isPahala ? 50 : 20; ctx.shadowColor = isPahala ? '#FFFFFF' : '#FFC107';
      ctx.fillStyle = isPahala ? '#FFDF00' : '#FFD54F';
      ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 120, 120, 50, 0, Math.PI * 2); ctx.fill();
      if (!isPahala) { ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 135, 110, 45, 0, Math.PI * 2); ctx.fill(); }
      ctx.shadowBlur = 0;

      ctx.fillStyle = isPahala ? 'rgba(255, 223, 0, 0.4)' : 'rgba(255, 255, 255, 0.3)';
      for(let i=0; i<20; i++) {
         const px = (time/15 + i * 80) % CANVAS_WIDTH; const py = (CANVAS_HEIGHT - (time/25 + i * 50) % CANVAS_HEIGHT);
         ctx.beginPath(); ctx.arc(px, py, (i%2)+1, 0, Math.PI*2); ctx.fill();
      }

      ctx.fillStyle = isPahala ? '#1A0B00' : '#000000'; ctx.globalAlpha = 0.6;
      if (scenery === 'MOSQUE' || isPahala) {
         ctx.beginPath(); ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT, 160, Math.PI, 0); ctx.fill();
         ctx.fillRect(CANVAS_WIDTH/2 - 260, CANVAS_HEIGHT - 300, 45, 300);
         ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH/2-260, CANVAS_HEIGHT-300); ctx.lineTo(CANVAS_WIDTH/2-237, CANVAS_HEIGHT-360); ctx.lineTo(CANVAS_WIDTH/2-215, CANVAS_HEIGHT-300); ctx.fill();
         ctx.fillRect(CANVAS_WIDTH/2 + 215, CANVAS_HEIGHT - 300, 45, 300);
         ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH/2+215, CANVAS_HEIGHT-300); ctx.lineTo(CANVAS_WIDTH/2+237, CANVAS_HEIGHT-360); ctx.lineTo(CANVAS_WIDTH/2+260, CANVAS_HEIGHT-300); ctx.fill();
      } else if (scenery === 'NIGHT_MARKET') {
         ctx.fillRect(50, CANVAS_HEIGHT-150, 150, 150); ctx.beginPath(); ctx.moveTo(30, CANVAS_HEIGHT-150); ctx.lineTo(125, CANVAS_HEIGHT-220); ctx.lineTo(220, CANVAS_HEIGHT-150); ctx.fill();
         ctx.fillRect(CANVAS_WIDTH-250, CANVAS_HEIGHT-100, 200, 100); ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH-270, CANVAS_HEIGHT-100); ctx.lineTo(CANVAS_WIDTH-150, CANVAS_HEIGHT-160); ctx.lineTo(CANVAS_WIDTH-30, CANVAS_HEIGHT-100); ctx.fill();
      } else if (scenery === 'STREET') {
         ctx.fillRect(100, CANVAS_HEIGHT-250, 100, 250); ctx.fillRect(150, CANVAS_HEIGHT-300, 50, 50);
         ctx.fillRect(CANVAS_WIDTH-180, CANVAS_HEIGHT-200, 80, 200); ctx.fillRect(CANVAS_WIDTH-200, CANVAS_HEIGHT-400, 20, 400);
      } else if (scenery === 'VILLAGE') {
         ctx.beginPath(); ctx.arc(150, CANVAS_HEIGHT, 200, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(CANVAS_WIDTH-150, CANVAS_HEIGHT, 250, Math.PI, 0); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const addScore = (amount) => { if(!engine.current.isCustomMode) engine.current.score += (amount * (engine.current.isDoubleActive ? 2 : 1)); };

    const startMiniGameInternal = (gameId, isPahala) => {
        engine.current.player = {};
        if (gameId === 'TARAWIH') engine.current.player = { value: 50, kipasActive: false, kipasTimer: 0, kipasRot: 0 };
        else if (gameId === 'SAHUR') engine.current.player = { combo: 0 };
        else if (gameId === 'SHAF') {
          const rows = []; const rowsCount = isPahala ? 4 : 3;
          for(let i=0; i<rowsCount; i++) {
             const possibleX = []; for(let x=100; x<CANVAS_WIDTH-100; x+=80) possibleX.push(x);
             rows.push({ gapX: possibleX[Math.floor(Math.random() * possibleX.length)] });
          }
          engine.current.player = { activeRow: 0, rows: rows };
        } 
        else if (gameId === 'SARUNG') { engine.current.player = { x: 150, y: CANVAS_HEIGHT - 120, vy: 0, isGrounded: true }; }
        else if (gameId === 'MASAK') {
          const targetCount = isPahala ? 3 : 2;
          const tgts = [...ASSETS.masak_items].sort(()=>Math.random()-0.5).slice(0, targetCount);
          let opts = [...tgts];
          while(opts.length < 4) { let rnd = ASSETS.masak_items[Math.floor(Math.random()*ASSETS.masak_items.length)]; if(!opts.includes(rnd)) opts.push(rnd); }
          engine.current.player = { target: tgts, options: opts.sort(()=>Math.random()-0.5), current: [], customerTimer: isPahala ? 3500 : 5000, maxCustomerTimer: isPahala ? 3500 : 5000 };
        }
        else if (gameId === 'SEMPROT') {
          engine.current.player = { water: 100 };
          const peeps = []; const count = 6;
          for(let i=0; i<count; i++) {
              peeps.push({ x: 150 + (i%3)*200 + (Math.random()*40-20), y: 250 + Math.floor(i/3)*150 + (Math.random()*40-20), isSleepy: Math.random() > 0.5, timer: 1000 + Math.random()*2000 });
          }
          engine.current.entities = peeps;
        }
        else if (gameId === 'BUKBER') {
          const count = isPahala ? 4 : 3; const plates = [];
          const items = [...ASSETS.bukber_items].sort(()=>Math.random()-0.5).slice(0, count);
          const startX = CANVAS_WIDTH/2 - ((count-1)*100)/2;
          for(let i=0; i<count; i++) { plates.push({ x: startX + i*100, y: 270, item: items[i], filled: false }); }
          engine.current.player = { plates, pending: [...items].sort(()=>Math.random()-0.5), currentFood: null, servedTables: 0, targetTables: isPahala ? 4 : 3, plateCount: count };
          engine.current.player.currentFood = engine.current.player.pending[0];
        }
    };

    const update = (dt) => {
      const state = engine.current;
      state.globalTimer += dt;
      const isPahala = state.difficulty.id === 'PAHALA';
      const fpsRatio = dt / 16.67; 
      
      if (state.screen === 'MENU') return;
      if (state.screen === 'TRANSITION') { state.stateTimer -= dt; if (state.stateTimer <= 0) {
          state.screen = 'PLAY';
          const currentGame = MINIGAMES[state.currentGameIndex];
          state.stateTimer = currentGame.baseDur * state.difficulty.timeMult;
          if(state.difficulty.id !== 'PAHALA') state.scenery = SCENERIES[Math.floor(Math.random() * SCENERIES.length)];
          startMiniGameInternal(currentGame.id, isPahala);
      } return; }

      if (state.screen === 'PLAY') {
        state.stateTimer -= dt;
        const currentGame = MINIGAMES[state.currentGameIndex];

        state.particles.forEach(p => { p.x += p.vx * fpsRatio; p.y += p.vy * fpsRatio; p.life -= dt; });
        state.particles = state.particles.filter(p => p.life > 0);

        if (state.pointer.justTapped) {
           const fxMap = {'fx_star':'⭐', 'fx_sparkle':'✨', 'fx_ketupat':'🟩', 'fx_moon':'🌙', 'fx_fire':'🔥', 'fx_love':'💖', 'fx_water':'💧'};
           const fxEmoji = fxMap[equipped.fx];
           if(fxEmoji) createParticles(state.pointer.x, state.pointer.y, '#FFF', 3, fxEmoji);
        }

        // --- 1. WAR TAKJIL ---
        if (currentGame.id === 'TAKJIL') {
          if (state.entities.length < 4 + Math.floor(state.difficultyMultiplier) && Math.random() < 0.08) {
             let newX = 80 + Math.random() * (CANVAS_WIDTH - 160); let newY = 150 + Math.random() * (CANVAS_HEIGHT - 280);
             let isOverlapping = false;
             if (!isPahala) { for (let e of state.entities) { if (Math.hypot(e.x - newX, e.y - newY) < 80) { isOverlapping = true; break; } } }
             if (!isOverlapping) {
               const typeRoll = Math.random(); let type = 'good'; let emoji = ASSETS.takjil_good[Math.floor(Math.random() * ASSETS.takjil_good.length)];
               if (typeRoll > 0.75) { type = 'bad'; emoji = ASSETS.takjil_bad[Math.floor(Math.random()*ASSETS.takjil_bad.length)]; }
               else if (typeRoll > 0.60) { type = 'rival'; emoji = ASSETS.takjil_rival[Math.floor(Math.random()*ASSETS.takjil_rival.length)]; }
               state.entities.push({ x: newX, y: newY, baseX: newX, life: (type === 'good' ? 1800 : 2200) / state.difficultyMultiplier, maxLife: (type === 'good' ? 1800 : 2200) / state.difficultyMultiplier, type, emoji, scale: 0, offsetTime: Math.random() * 1000 });
             }
          }
          if (state.pointer.justTapped) {
            for (let i = state.entities.length - 1; i >= 0; i--) {
              let e = state.entities[i];
              if (Math.hypot(e.x - state.pointer.x, e.y - state.pointer.y) < 60) {
                if (e.type === 'good') { addScore(isPahala ? 40 : 20); sfx.coin(); createParticles(e.x, e.y, isPahala?'#FFDF00':'#4CAF50', 10, e.emoji); } 
                else { loseLife(); createParticles(e.x, e.y, '#FF5252', 15, '💥'); }
                state.entities.splice(i, 1); break;
              }
            }
          }
          for (let i = state.entities.length - 1; i >= 0; i--) {
            let e = state.entities[i]; e.life -= dt; if (e.scale < 1) e.scale += 0.15 * fpsRatio;
            if (isPahala) { e.x = e.baseX + Math.sin((state.globalTimer + e.offsetTime)/150) * 50; }
            if (e.life <= 0) { if (e.type === 'good') loseLife(); state.entities.splice(i, 1); }
          }
        }

        // --- 2. PATROLI SAHUR ---
        else if (currentGame.id === 'SAHUR') {
          const trackCount = isPahala ? 4 : 3; const trackWidth = isPahala ? 100 : 130;
          const startOffsets = isPahala ? [-150, -50, 50, 150] : [-130, 0, 130];
          if (Math.random() < 0.035 * state.difficultyMultiplier) {
            const track = Math.floor(Math.random() * trackCount);
            state.entities.push({ x: (CANVAS_WIDTH/2) + startOffsets[track], y: -50, track, emoji: ASSETS.sahur_notes[Math.floor(Math.random() * ASSETS.sahur_notes.length)], vy: (3.5 + state.difficultyMultiplier * (isPahala? 2.5 : 1.8)) });
          }
          if (state.pointer.justTapped) {
             let tappedTrack = -1;
             for(let t=0; t<trackCount; t++) { if (Math.abs(state.pointer.x - ((CANVAS_WIDTH/2) + startOffsets[t])) < trackWidth/2) tappedTrack = t; }
             if (tappedTrack !== -1) {
                let hitNoteIdx = -1; let minHitDist = 120;
                for (let i = 0; i < state.entities.length; i++) {
                  if (state.entities[i].track === tappedTrack) {
                    let dist = Math.abs(state.entities[i].y - (CANVAS_HEIGHT - 120));
                    if (dist < minHitDist) { minHitDist = dist; hitNoteIdx = i; }
                  }
                }
                if (hitNoteIdx !== -1) {
                  addScore((minHitDist < 35) ? (isPahala?50:30) : 10); 
                  sfx.instrument(state.entities[hitNoteIdx].emoji);
                  createParticles(state.entities[hitNoteIdx].x, CANVAS_HEIGHT - 120, isPahala?'#FFDF00':'#4CAF50', 10, '🎵');
                  state.entities.splice(hitNoteIdx, 1); state.player.combo++;
                } else { state.player.combo = 0; sfx.wrong(); }
             }
          }
          for (let i = state.entities.length - 1; i >= 0; i--) {
            state.entities[i].y += state.entities[i].vy * fpsRatio;
            if (state.entities[i].y > CANVAS_HEIGHT - 50) { loseLife(); state.player.combo = 0; state.entities.splice(i, 1); }
          }
        }

        // --- 3. TAHAN KANTUK ---
        else if (currentGame.id === 'TARAWIH') {
          let drainRate = (isPahala ? 0.08 : 0.05) * state.difficultyMultiplier; 
          if (state.player.kipasActive) {
             drainRate *= 2.5; state.player.kipasTimer -= dt; state.player.kipasRot += 0.3 * fpsRatio;
             if (state.player.kipasTimer <= 0) state.player.kipasActive = false;
          } else if (Math.random() < 0.008) { state.player.kipasActive = true; state.player.kipasTimer = 1000; }
          state.player.value -= drainRate * dt; 
          if (state.pointer.justTapped) { sfx.tap(); state.player.value += (isPahala ? 12 : 16); createParticles(CANVAS_WIDTH/2, 250, '#81C784', 3, '💦'); }
          if (state.player.value > 100) state.player.value = 100; if (state.player.value < 0) state.player.value = 0;
          if (isPahala) { if (state.player.value <= 0 || state.player.value >= 100) { loseLife(); state.player.value = 50; state.player.kipasActive = false; } } 
          else { if (state.player.value <= 0) { loseLife(); state.player.value = 60; state.player.kipasActive = false; } }
        }

        // --- 4. SUSUN SHAF ---
        else if (currentGame.id === 'SHAF') {
          const rowsCount = isPahala ? 4 : 3;
          if (isPahala && state.player.activeRow < rowsCount) {
             state.player.rows[state.player.activeRow].gapX += Math.sin(state.globalTimer/300) * 3 * fpsRatio;
             if(state.player.rows[state.player.activeRow].gapX < 150) state.player.rows[state.player.activeRow].gapX = 150;
             if(state.player.rows[state.player.activeRow].gapX > CANVAS_WIDTH-150) state.player.rows[state.player.activeRow].gapX = CANVAS_WIDTH-150;
          }
          if (state.pointer.justTapped && state.player.activeRow < rowsCount) {
             const rowY = (isPahala ? 150 : 200) + (state.player.activeRow * (isPahala ? 80 : 100));
             const gapX = state.player.rows[state.player.activeRow].gapX;
             if (state.pointer.y > rowY - 50 && state.pointer.y < rowY + 50) {
                if (Math.abs(state.pointer.x - gapX) < 65) {
                  addScore(isPahala ? 50 : 40); sfx.coin(); createParticles(gapX, rowY, '#81C784', 15, '✨'); state.player.activeRow++;
                  if(state.player.activeRow >= rowsCount) { addScore(isPahala ? 150 : 100); sfx.win(); state.stateTimer = 0; }
                } else { loseLife(); }
             }
          }
        }

        // --- 5. PERANG SARUNG ---
        else if (currentGame.id === 'SARUNG') {
           let p = state.player; const GROUND_Y = CANVAS_HEIGHT - 120;
           p.vy += 0.8 * fpsRatio; p.y += p.vy * fpsRatio;
           if (p.y >= GROUND_Y) { p.y = GROUND_Y; p.vy = 0; p.isGrounded = true; } else { p.isGrounded = false; }
           if (state.pointer.justTapped && p.isGrounded) { p.vy = -18; sfx.jump(); createParticles(p.x, GROUND_Y + 20, '#FFF', 5, '💨'); }
           if (Math.random() < (isPahala ? 0.05 : 0.03) * state.difficultyMultiplier) {
               const lastEnemy = state.entities[state.entities.length - 1];
               const canSpawn = !lastEnemy || (CANVAS_WIDTH - lastEnemy.x > (isPahala ? 150 : 250));
               if (canSpawn) { state.entities.push({ x: CANVAS_WIDTH + 50, y: GROUND_Y, vx: -(6 + state.difficultyMultiplier * (isPahala ? 4 : 2)), emoji: ASSETS.sarung_enemy[Math.floor(Math.random() * ASSETS.sarung_enemy.length)] }); }
           }
           for (let i = state.entities.length - 1; i >= 0; i--) {
               let e = state.entities[i]; e.x += e.vx * fpsRatio;
               if (Math.abs(p.x - e.x) < 50 && Math.abs(p.y - e.y) < 50) {
                   if (p.vy > 0 && p.y < e.y - 10) { p.vy = -14; addScore(isPahala ? 60 : 30); sfx.hit(); createParticles(e.x, e.y, '#FFC107', 15, '💥'); state.entities.splice(i, 1); }
                   else { loseLife(); createParticles(e.x, e.y, '#FF5252', 10, ASSETS.sarung_weapon); state.entities.splice(i, 1); }
               } else if (e.x < -50) { state.entities.splice(i, 1); }
           }
        }

        // --- 6. PEMBASMI MOKEL ---
        else if (currentGame.id === 'MOKEL') {
           if (state.entities.length < 5 + Math.floor(state.difficultyMultiplier) && Math.random() < 0.06 * state.difficultyMultiplier) {
              const isBad = Math.random() > (isPahala ? 0.4 : 0.6);
              state.entities.push({ x: 80 + Math.random() * (CANVAS_WIDTH - 160), y: CANVAS_HEIGHT + 50, baseX: 80 + Math.random() * (CANVAS_WIDTH - 160), type: isBad ? 'bad' : 'good', emoji: isBad ? ASSETS.mokel_bad[Math.floor(Math.random() * ASSETS.mokel_bad.length)] : ASSETS.mokel_good[Math.floor(Math.random() * ASSETS.mokel_good.length)], vy: -(2 + Math.random() * 2 + state.difficultyMultiplier), offsetTime: Math.random() * 1000 });
           }
           if (state.pointer.justTapped) {
              for (let i = state.entities.length - 1; i >= 0; i--) {
                 let e = state.entities[i];
                 if (Math.hypot(e.x - state.pointer.x, e.y - state.pointer.y) < 55) {
                    if (e.type === 'bad') { addScore(isPahala ? 30 : 15); sfx.hit(); createParticles(e.x, e.y, '#FF5252', 15, '💨'); } 
                    else { loseLife(); createParticles(e.x, e.y, '#FFC107', 15, '⚠️'); }
                    state.entities.splice(i, 1); break;
                 }
              }
           }
           for (let i = state.entities.length - 1; i >= 0; i--) {
              let e = state.entities[i]; e.y += e.vy * fpsRatio; 
              if (isPahala) { e.x = e.baseX + Math.sin((state.globalTimer + e.offsetTime)/200) * 80; } else { e.x += Math.sin(e.y/50) * 1.5 * fpsRatio; }
              if (e.y < -50) { if (e.type === 'bad') loseLife(); state.entities.splice(i, 1); }
           }
        }

        // --- 7. MASAK TAKJIL ---
        else if (currentGame.id === 'MASAK') {
           state.player.customerTimer -= dt;
           if (state.player.customerTimer <= 0) {
               loseLife(); sfx.angry(); createParticles(CANVAS_WIDTH/2, 250, '#FF5252', 20, '😡');
               state.player.target = [...ASSETS.masak_items].sort(()=>Math.random()-0.5).slice(0, isPahala ? 3 : 2);
               let opts = [...state.player.target]; while(opts.length < 4) { let rnd = ASSETS.masak_items[Math.floor(Math.random()*ASSETS.masak_items.length)]; if(!opts.includes(rnd)) opts.push(rnd); }
               state.player.options = opts.sort(()=>Math.random()-0.5); state.player.current = [];
               state.player.customerTimer = state.player.maxCustomerTimer;
           }
           if (state.pointer.justTapped) {
              const btnW = 100; const gap = 15; const totalW = (4 * btnW) + (3 * gap);
              const startX = (CANVAS_WIDTH - totalW) / 2; const btnY = CANVAS_HEIGHT - 130;
              for (let i=0; i<4; i++) {
                 let bx = startX + i * (btnW + gap);
                 if (state.pointer.x > bx && state.pointer.x < bx + btnW && state.pointer.y > btnY && state.pointer.y < btnY + btnW) {
                    state.player.current.push(state.player.options[i]); sfx.tap();
                    createParticles(bx + btnW/2, btnY + btnW/2, '#FFF', 5, state.player.options[i]);
                    if (isPahala) { state.player.options.sort(() => Math.random() - 0.5); }
                    if (state.player.current.length === state.player.target.length) {
                       let sortedTarget = [...state.player.target].sort().join('');
                       let sortedCurrent = [...state.player.current].sort().join('');
                       if (sortedTarget === sortedCurrent) { addScore(isPahala ? 80 : 50); sfx.win(); createParticles(CANVAS_WIDTH/2, 250, '#FFDF00', 20, '💖'); }
                       else { loseLife(); sfx.wrong(); createParticles(CANVAS_WIDTH/2, 250, '#FF5252', 15, '😡'); }
                       state.player.target = [...ASSETS.masak_items].sort(()=>Math.random()-0.5).slice(0, isPahala ? 3 : 2);
                       let opts2 = [...state.player.target]; while(opts2.length < 4) { let rnd = ASSETS.masak_items[Math.floor(Math.random()*ASSETS.masak_items.length)]; if(!opts2.includes(rnd)) opts2.push(rnd); }
                       state.player.options = opts2.sort(()=>Math.random()-0.5); state.player.current = [];
                       state.player.customerTimer = state.player.maxCustomerTimer;
                    }
                 }
              }
           }
        }

        // --- 8. SEMPROT AIR ---
        else if (currentGame.id === 'SEMPROT') {
           state.entities.forEach(e => { e.timer -= dt; if (e.timer <= 0) { e.isSleepy = !e.isSleepy; e.timer = e.isSleepy ? 1500 + Math.random()*1500 : (isPahala ? 800 : 2000) + Math.random()*2000; } });
           if (state.pointer.justTapped) {
              const refillBtn = {x: CANVAS_WIDTH - 150, y: CANVAS_HEIGHT - 80, w: 120, h: 50};
              if (state.pointer.x > refillBtn.x && state.pointer.x < refillBtn.x + refillBtn.w && state.pointer.y > refillBtn.y && state.pointer.y < refillBtn.y + refillBtn.h) {
                 state.player.water = 100; sfx.water(); createParticles(refillBtn.x+60, refillBtn.y+25, '#00FFFF', 15, '💧');
              } else {
                 let hit = false;
                 if (state.player.water >= 20) {
                     for (let e of state.entities) {
                        if (Math.hypot(e.x - state.pointer.x, e.y - state.pointer.y) < 60) {
                           state.player.water -= 20; hit = true; sfx.water(); createParticles(e.x, e.y, '#00FFFF', 10, '💧');
                           if (e.isSleepy) { addScore(isPahala ? 40 : 20); sfx.win(); e.isSleepy = false; e.timer = 2000 + Math.random()*2000; } 
                           else { loseLife(); sfx.angry(); createParticles(e.x, e.y, '#FF5252', 15, '😡'); }
                           break;
                        }
                     }
                 }
                 if (!hit && state.player.water < 20 && state.pointer.y < CANVAS_HEIGHT - 100) sfx.wrong(); 
              }
           }
        }

        // --- 9. BUKBER SERVE ---
        else if (currentGame.id === 'BUKBER') {
           if (state.pointer.justTapped) {
              for (let p of state.player.plates) {
                 if (!p.filled && Math.hypot(p.x - state.pointer.x, p.y - state.pointer.y) < 60) {
                    if (p.item === state.player.currentFood) {
                       p.filled = true; sfx.coin(); createParticles(p.x, p.y, '#FFDF00', 10, '✨');
                       state.player.pending.shift(); state.player.currentFood = state.player.pending[0] || null;
                       if (state.player.pending.length === 0) {
                          state.player.servedTables++;
                          if (state.player.servedTables >= state.player.targetTables) { addScore(isPahala ? 100 : 50); sfx.win(); state.stateTimer = 0; }
                          else {
                             sfx.win();
                             const items = [...ASSETS.bukber_items].sort(()=>Math.random()-0.5).slice(0, state.player.plateCount);
                             state.player.plates.forEach((plate, i) => { plate.item = items[i]; plate.filled = false; });
                             state.player.pending = [...items].sort(()=>Math.random()-0.5); state.player.currentFood = state.player.pending[0];
                          }
                       }
                    } else { loseLife(); sfx.wrong(); createParticles(p.x, p.y, '#FF5252', 15, '❌'); }
                    break;
                 }
              }
           }
        }

        if (state.stateTimer <= 0) {
            if (currentGame.id === 'SHAF' && state.player.activeRow < (isPahala?4:3)) { loseLife(); createParticles(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, '#FF5252', 20, '😡'); }
            else if (currentGame.id === 'BUKBER' && state.player.servedTables < state.player.targetTables) { loseLife(); createParticles(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, '#FF5252', 20, '😡'); }
            if(state.screen !== 'GAMEOVER') nextMiniGame();
        }
      }
      state.pointer.justTapped = false; 
    };

    const draw = (ctx) => {
      const state = engine.current; const isPahala = state.difficulty.id === 'PAHALA';
      drawBackground(ctx, state.globalTimer, state.difficulty.id, state.scenery);

      if (state.screen === 'PLAY' || state.screen === 'TRANSITION') {
        const currentGame = MINIGAMES[state.currentGameIndex];
        const timeRatio = Math.max(0, state.stateTimer / (state.screen === 'PLAY' ? currentGame.baseDur * state.difficulty.timeMult : 2000));
        ctx.fillStyle = timeRatio < 0.3 ? '#FF5252' : (isPahala?'#FFDF00':'#4CAF50');
        ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(0, 0, CANVAS_WIDTH * timeRatio, 12); ctx.shadowBlur = 0;
      }

      if (state.screen === 'MENU' || state.screen === 'GAMEOVER') return;
      const currentGame = MINIGAMES[state.currentGameIndex];

      if (state.screen === 'TRANSITION') {
        ctx.fillStyle = isPahala ? 'rgba(26, 11, 0, 0.85)' : 'rgba(15, 61, 36, 0.85)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.textAlign = 'center'; ctx.font = 'bold 45px "Bungee", cursive';
        ctx.fillStyle = isPahala ? '#FFFFFF' : '#81C784'; ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
        ctx.fillText("SIAP - SIAP!", CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 40);
        ctx.font = 'bold 60px "Bungee", cursive'; ctx.fillStyle = isPahala ? '#FFDF00' : '#FFC107'; ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(currentGame.name, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 30);
        ctx.font = 'bold 26px "Nunito", sans-serif'; ctx.fillStyle = '#FFF'; ctx.shadowBlur = 0;
        ctx.fillText(isPahala ? currentGame.instPahala : currentGame.inst, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 85);
        return;
      }

      if (state.screen === 'PLAY') {
        if (currentGame.id === 'TAKJIL') {
          ctx.fillStyle = isPahala ? 'rgba(255, 223, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)'; ctx.fillRect(50, 100, CANVAS_WIDTH-100, CANVAS_HEIGHT-150);
          state.entities.forEach(e => {
            const size = 65 * e.scale;
            ctx.fillStyle = e.type === 'good' ? (isPahala?'rgba(255,223,0,0.2)':'rgba(76, 175, 80, 0.2)') : 'rgba(255, 82, 82, 0.2)';
            ctx.strokeStyle = e.type === 'good' ? (isPahala?'#FFDF00':'#4CAF50') : '#FF5252';
            ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(e.x - size/2, e.y - size/2, size, size, 16); ctx.fill(); ctx.stroke();
            ctx.font = `${size * 0.6}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.emoji, e.x, e.y);
            ctx.fillStyle = '#FFF'; ctx.fillRect(e.x - size/2, e.y + size/2 + 6, size * (Math.max(0, e.life)/e.maxLife), 5);
          });
        }
        else if (currentGame.id === 'SAHUR') {
          const trackCount = isPahala ? 4 : 3; const startOffsets = isPahala ? [-150, -50, 50, 150] : [-130, 0, 130];
          ctx.strokeStyle = isPahala ? 'rgba(255, 223, 0, 0.2)' : 'rgba(129, 199, 132, 0.2)'; ctx.lineWidth = 4;
          startOffsets.forEach(offset => { ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH/2 + offset, 80); ctx.lineTo(CANVAS_WIDTH/2 + offset, CANVAS_HEIGHT); ctx.stroke(); });
          ctx.strokeStyle = isPahala ? '#FFDF00' : '#81C784'; ctx.shadowBlur = 10; ctx.shadowColor = ctx.strokeStyle;
          ctx.beginPath(); ctx.moveTo(50, CANVAS_HEIGHT - 120); ctx.lineTo(CANVAS_WIDTH - 50, CANVAS_HEIGHT - 120); ctx.stroke(); ctx.shadowBlur = 0;
          ctx.font = '55px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          state.entities.forEach(e => { ctx.fillText(e.emoji, e.x, e.y); });
          ctx.font = '26px "Bungee"'; ctx.fillStyle = state.player.combo > 3 ? (isPahala?'#FFDF00':'#81C784') : '#FFF';
          ctx.fillText(`COMBO: ${state.player.combo}`, CANVAS_WIDTH/2, 100);
        }
        else if (currentGame.id === 'TARAWIH') {
          if (state.player.kipasActive) {
            ctx.save(); ctx.translate(CANVAS_WIDTH - 150, 200); ctx.rotate(state.player.kipasRot);
            ctx.font = '100px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ASSETS.tarawih_fan, 0, 0); ctx.restore();
            ctx.fillStyle = isPahala ? 'rgba(255,223,0,0.1)' : 'rgba(129,199,132,0.1)'; ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH-150, 200); ctx.lineTo(50, 100); ctx.lineTo(50, 400); ctx.fill();
          }
          const isSleepy = isPahala ? (state.player.value < 40 || state.player.value > 80) : state.player.value < 40;
          ctx.font = '130px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(isSleepy ? ASSETS.tarawih_sleep : ASSETS.tarawih_awake, CANVAS_WIDTH/2, 250);
          const meterW = 400; const meterH = 36; const meterX = CANVAS_WIDTH/2 - meterW/2; const meterY = 400;
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(meterX, meterY, meterW, meterH, 18); ctx.fill();
          ctx.strokeStyle = '#FFF'; ctx.lineWidth=2; ctx.stroke();
          if(isPahala) {
             ctx.fillStyle = 'rgba(255,82,82,0.6)'; ctx.beginPath(); ctx.roundRect(meterX, meterY, meterW * 0.3, meterH, 18); ctx.fill();
             ctx.beginPath(); ctx.roundRect(meterX + meterW * 0.7, meterY, meterW * 0.3, meterH, 18); ctx.fill();
          }
          ctx.fillStyle = isSleepy ? '#FF5252' : (isPahala?'#FFDF00':'#4CAF50'); ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
          ctx.beginPath(); ctx.roundRect(meterX+2, meterY+2, Math.max(0,(meterW-4) * (state.player.value/100)), meterH-4, 16); ctx.fill(); ctx.shadowBlur = 0;
        }
        else if (currentGame.id === 'SHAF') {
           const rowsCount = isPahala ? 4 : 3; const rowHeight = isPahala ? 80 : 100; const startY = isPahala ? 150 : 200;
           ctx.strokeStyle = isPahala ? 'rgba(255,223,0,0.1)' : 'rgba(129, 199, 132, 0.1)';
           for(let i=0; i<CANVAS_WIDTH; i+=50) { ctx.beginPath(); ctx.moveTo(i,100); ctx.lineTo(i,CANVAS_HEIGHT); ctx.stroke(); }
           ctx.font = '60px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
           for(let r=0; r<rowsCount; r++) {
              const rowY = startY + (r * rowHeight);
              const isDone = r < state.player.activeRow; const isActive = r === state.player.activeRow;
              ctx.fillStyle = isActive ? (isPahala?'rgba(255,223,0,0.2)':'rgba(76, 175, 80, 0.2)') : 'rgba(255,255,255,0.05)';
              ctx.fillRect(50, rowY - 35, CANVAS_WIDTH-100, 70);
              for(let x=100; x<CANVAS_WIDTH-100; x+=80) {
                 const gapX = state.player.rows[r].gapX;
                 if(Math.abs(x - gapX) < 40 && !isDone) {
                    if(isActive) { ctx.strokeStyle = isPahala ? '#FFDF00' : '#FFC107'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.strokeRect(gapX - 35, rowY - 40, 70, 80); ctx.setLineDash([]); }
                 } else if (Math.abs(x - gapX) >= 40 || isDone) { ctx.fillText(ASSETS.shaf_jamaah, x, rowY); }
              }
           }
        }
        else if (currentGame.id === 'SARUNG') {
           const p = state.player; const GROUND_Y = CANVAS_HEIGHT - 120;
           ctx.fillStyle = isPahala ? '#2B1500' : '#0B1F11'; ctx.fillRect(0, GROUND_Y + 40, CANVAS_WIDTH, CANVAS_HEIGHT);
           ctx.strokeStyle = isPahala ? '#FFDF00' : '#4CAF50'; ctx.lineWidth = 4;
           ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 40); ctx.lineTo(CANVAS_WIDTH, GROUND_Y + 40); ctx.stroke();
           ctx.font = '70px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ASSETS.sarung_player, p.x, p.y);
           state.entities.forEach(e => {
              ctx.fillText(e.emoji, e.x, e.y); ctx.fillStyle = 'rgba(255, 82, 82, 0.2)'; ctx.beginPath(); ctx.arc(e.x, e.y, 40, 0, Math.PI * 2); ctx.fill();
           });
           if(p.isGrounded) { ctx.font = '20px "Nunito"'; ctx.fillStyle = '#FFF'; ctx.globalAlpha = 0.5 + Math.sin(state.globalTimer/100)*0.5; ctx.fillText("TAP UNTUK LOMPAT!", CANVAS_WIDTH/2, GROUND_Y + 80); ctx.globalAlpha = 1; }
        }
        else if (currentGame.id === 'MOKEL') {
           ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
           state.entities.forEach(e => {
              ctx.save(); ctx.translate(e.x, e.y); const isBad = e.type === 'bad';
              const gradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 45);
              gradient.addColorStop(0, isBad ? 'rgba(255, 82, 82, 0.8)' : 'rgba(129, 199, 132, 0.8)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = isBad ? '#FF5252' : '#81C784'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
              if(isBad) { ctx.shadowBlur = 10; ctx.shadowColor = '#FF5252'; } else { ctx.shadowBlur = 20; ctx.shadowColor = '#FFDF00'; }
              ctx.font = '45px Arial'; ctx.fillText(e.emoji, 0, 0); ctx.restore();
           });
        }
        else if (currentGame.id === 'MASAK') {
           ctx.font = '100px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👨‍🍳', 150, 250);
           ctx.fillStyle = '#FF5252'; ctx.fillRect(100, 160, 100, 10);
           ctx.fillStyle = '#81C784'; ctx.fillRect(100, 160, 100 * (Math.max(0, state.player.customerTimer)/state.player.maxCustomerTimer), 10);
           ctx.fillStyle = 'white'; ctx.beginPath(); ctx.roundRect(250, 150, 300, 100, 20); ctx.fill();
           ctx.beginPath(); ctx.moveTo(250, 200); ctx.lineTo(200, 230); ctx.lineTo(260, 240); ctx.fill();
           ctx.font = '50px Arial'; const tX = 250 + 150; 
           state.player.target.forEach((emoji, i) => { const offset = (i - (state.player.target.length-1)/2) * 60; ctx.fillText(emoji, tX + offset, 200); });
           ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(400, 350, 150, 40, 0, 0, Math.PI*2); ctx.fill();
           state.player.current.forEach((emoji, i) => { const offset = (i - (state.player.current.length-1)/2) * 50; ctx.fillText(emoji, 400 + offset, 340); });
           const btnW = 100; const gap = 15; const totalW = (4 * btnW) + (3 * gap);
           const startX = (CANVAS_WIDTH - totalW) / 2; const btnY = CANVAS_HEIGHT - 130;
           for (let i=0; i<4; i++) {
              let bx = startX + i * (btnW + gap);
              ctx.fillStyle = isPahala ? 'rgba(255,223,0,0.2)' : 'rgba(76, 175, 80, 0.2)';
              ctx.strokeStyle = isPahala ? '#FFDF00' : '#81C784'; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.roundRect(bx, btnY, btnW, btnW, 15); ctx.fill(); ctx.stroke();
              ctx.font = '50px Arial'; ctx.fillText(state.player.options[i], bx + btnW/2, btnY + btnW/2);
           }
        }
        else if (currentGame.id === 'SEMPROT') {
           ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(30, 100, 30, 400); ctx.strokeStyle='#FFF'; ctx.strokeRect(30,100,30,400);
           ctx.fillStyle = '#00FFFF'; ctx.shadowBlur = 10; ctx.shadowColor = '#00FFFF';
           ctx.fillRect(30, 500 - (state.player.water/100)*400, 30, (state.player.water/100)*400); ctx.shadowBlur=0;
           ctx.fillStyle = '#0088FF'; ctx.beginPath(); ctx.roundRect(CANVAS_WIDTH - 150, CANVAS_HEIGHT - 100, 120, 60, 15); ctx.fill();
           ctx.strokeStyle='#FFF'; ctx.lineWidth=2; ctx.stroke();
           ctx.fillStyle = '#FFF'; ctx.font = 'bold 22px Nunito'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('REFILL', CANVAS_WIDTH - 90, CANVAS_HEIGHT - 70);
           state.entities.forEach(e => {
              ctx.font = '60px Arial'; ctx.fillText('🧍‍♂️', e.x, e.y);
              if (e.isSleepy) { ctx.font = '40px Arial'; ctx.fillText('😴', e.x, e.y - 40); }
              else { ctx.font = '30px Arial'; ctx.fillText('😳', e.x, e.y - 40); }
           });
        }
        else if (currentGame.id === 'BUKBER') {
           ctx.fillStyle = '#FFF'; ctx.font = 'bold 24px Nunito'; ctx.textAlign='center';
           ctx.fillText(`Meja: ${state.player.servedTables} / ${state.player.targetTables}`, CANVAS_WIDTH/2, 170);
           ctx.fillStyle = isPahala ? '#3A2000' : '#5C4033'; ctx.fillRect(50, 200, CANVAS_WIDTH - 100, 120);
           ctx.strokeStyle = '#3E2723'; ctx.lineWidth=4; ctx.strokeRect(50, 200, CANVAS_WIDTH-100, 120);
           state.player.plates.forEach(p => {
              ctx.fillStyle = '#FFF'; ctx.shadowBlur=5; ctx.shadowColor='rgba(0,0,0,0.3)';
              ctx.beginPath(); ctx.arc(p.x, p.y, 40, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
              ctx.font = '45px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
              if (p.filled) { ctx.globalAlpha = 1; ctx.fillText(p.item, p.x, p.y); }
              else { ctx.globalAlpha = 0.3; ctx.fillText(p.item, p.x, p.y); ctx.globalAlpha = 1; }
           });
           if (state.player.currentFood) {
              ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(CANVAS_WIDTH/2 - 120, CANVAS_HEIGHT - 130, 240, 110, 20); ctx.fill();
              ctx.strokeStyle=isPahala?'#FFDF00':'#81C784'; ctx.stroke();
              ctx.font = 'bold 22px Nunito'; ctx.fillStyle = '#FFF'; ctx.fillText('SAJIKAN:', CANVAS_WIDTH/2, CANVAS_HEIGHT - 100);
              ctx.font = '60px Arial'; ctx.fillText(state.player.currentFood, CANVAS_WIDTH/2, CANVAS_HEIGHT - 50);
           }
        }

        state.particles.forEach(p => {
          ctx.globalAlpha = Math.max(0, p.life / 800);
          if (p.emoji) { ctx.font = `${Math.max(1, p.size * 5)}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(p.emoji, p.x, p.y); }
          else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI*2); ctx.fill(); }
          ctx.globalAlpha = 1;
        });

        // HUD
        ctx.fillStyle = isPahala ? 'rgba(26, 11, 0, 0.8)' : 'rgba(15, 61, 36, 0.8)';
        ctx.fillRect(0, 12, CANVAS_WIDTH, 50); 
        ctx.strokeStyle = isPahala ? '#FFDF00' : '#4CAF50'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(CANVAS_WIDTH, 62); ctx.stroke();
        ctx.font = '26px "Bungee", cursive'; ctx.fillStyle = isPahala ? '#FFDF00' : '#FFC107';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const doubleText = state.isDoubleActive ? ' (2X)' : '';
        const scoreTxt = state.isCustomMode ? 'KUSTOM' : `SKOR: ${Math.floor(state.score)}${doubleText}`;
        ctx.fillText(scoreTxt, 20, 37);
        ctx.fillStyle = '#FF5252'; ctx.textAlign = 'right';
        ctx.font = '26px "Nunito"';
        ctx.fillText(`❤️ x ${state.lives}`, CANVAS_WIDTH - 20, 37);
      }
    };

    const gameLoop = (timestamp) => {
      if (!engine.current.lastTime) engine.current.lastTime = timestamp;
      const dt = timestamp - engine.current.lastTime; engine.current.lastTime = timestamp;
      if (dt < 100) { update(dt); draw(ctx); }
      requestRef = requestAnimationFrame(gameLoop);
    };
    requestRef = requestAnimationFrame(gameLoop);

    const handlePointerDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
      engine.current.pointer.x = (e.clientX - rect.left) * scaleX;
      engine.current.pointer.y = (e.clientY - rect.top) * scaleY;
      engine.current.pointer.justTapped = true;
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    return () => { cancelAnimationFrame(requestRef); canvas.removeEventListener('pointerdown', handlePointerDown); };
  }, [equipped, customSelection]);

  // --- ENGINE HELPERS ---
  const startTransition = () => {
    engine.current.screen = 'TRANSITION'; engine.current.stateTimer = 2000;
    engine.current.entities = []; engine.current.particles = [];
  };

  const nextMiniGame = () => {
    engine.current.level++; engine.current.difficultyMultiplier += engine.current.difficulty.multGrow; 
    let nextIdx;
    const avail = engine.current.availableGames.map(id => MINIGAMES.findIndex(m=>m.id===id)).filter(i=>i!==-1);
    if(avail.length === 0) avail.push(0); 
    if(avail.length > 2) {
       do { nextIdx = avail[Math.floor(Math.random() * avail.length)]; } 
       while (engine.current.history.includes(nextIdx));
    } else { nextIdx = avail[Math.floor(Math.random() * avail.length)]; }
    engine.current.history.push(nextIdx);
    if(engine.current.history.length > 2) engine.current.history.shift();
    engine.current.currentGameIndex = nextIdx; startTransition();
  };

  const loseLife = () => {
    engine.current.lives--; sfx.hit();
    if (containerRef.current) { containerRef.current.classList.remove('shake'); void containerRef.current.offsetWidth; containerRef.current.classList.add('shake'); }
    if (engine.current.lives <= 0) {
      engine.current.screen = 'GAMEOVER'; setFinalScore(Math.floor(engine.current.score));
      if(!engine.current.isCustomMode) {
         const newBank = bankedScore + Math.floor(engine.current.score);
         setBankedScore(newBank); saveData(newBank, ownedItems, equipped, consumables);
      }
      setUiState('GAMEOVER');
    }
  };

  const createParticles = (x, y, color, count, emoji = null) => {
    for(let i=0; i<count; i++) {
      engine.current.particles.push({
        x, y, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15,
        life: 600 + Math.random() * 400, size: Math.random() * 5 + 2, color, emoji: Math.random() > 0.5 ? emoji : null
      });
    }
  };

  const startGame = (diffObj, isCustom = false) => {
    sfx.init(); sfx.tap(); playBGM();
    let startLives = BASE_LIVES; let newCons = { ...consumables }; let doubleActive = false;
    if (!isCustom) {
        if (newCons.cons_life > 0) { startLives += 1; newCons.cons_life -= 1; }
        if (newCons.cons_double > 0) { doubleActive = true; newCons.cons_double -= 1; }
        setConsumables(newCons); saveData(bankedScore, ownedItems, equipped, newCons);
    }
    const avail = isCustom && customSelection.length > 0 ? customSelection : MINIGAMES.map(m=>m.id);
    const firstIdx = MINIGAMES.findIndex(m=>m.id === avail[Math.floor(Math.random() * avail.length)]);
    engine.current = {
      ...engine.current, score: 0, lives: startLives, level: 1, 
      difficulty: diffObj, difficultyMultiplier: diffObj.multStart,
      currentGameIndex: firstIdx !== -1 ? firstIdx : 0, history: [firstIdx], isDoubleActive: doubleActive,
      isCustomMode: isCustom, availableGames: avail
    };
    if(containerRef.current) {
       if(diffObj.id === 'PAHALA') containerRef.current.classList.add('pahala-mode'); else containerRef.current.classList.remove('pahala-mode');
    }
    setUiState('PLAYING'); startTransition();
  };

  const saveData = (bank, owned, eq, cons) => { try { localStorage.setItem('ramadhanRushV7', JSON.stringify({ bankedScore: bank, ownedItems: owned, equipped: eq, consumables: cons })); } catch(e){} };

  const buyItem = (item) => {
    if (bankedScore >= item.cost) {
      const newBank = bankedScore - item.cost;
      if (item.type === 'cons') {
         if(item.id === 'cons_life' && (consumables.cons_life || 0) >= 5) return; 
         if(item.id === 'cons_double' && (consumables.cons_double || 0) >= 1) return; 
         const newCons = { ...consumables, [item.id]: (consumables[item.id] || 0) + 1 };
         setBankedScore(newBank); setConsumables(newCons); saveData(newBank, ownedItems, equipped, newCons);
      } else {
         if (!ownedItems.includes(item.id)) {
            const newOwned = [...ownedItems, item.id];
            setBankedScore(newBank); setOwnedItems(newOwned); saveData(newBank, newOwned, equipped, consumables);
         }
      }
      sfx.init(); sfx.coin();
    }
  };

  const toggleEquip = (item) => {
    sfx.init(); sfx.tap();
    let newEq = { ...equipped };
    if (newEq[item.type] === item.id) newEq[item.type] = null; else newEq[item.type] = item.id;
    setEquipped(newEq); saveData(bankedScore, ownedItems, newEq, consumables);
  };

  return (
    <div className="app-wrapper font-modern" onClick={() => { sfx.init(); playBGM(); }}>
      <audio ref={bgmRef} loop src="/Loonboon (In-Game).mp3" preload="auto" />
      <div className="dot-pattern"></div>

      <div ref={containerRef} className="game-container glass-panel">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="game-canvas" />

        {/* MENU UTAMA */}
        {uiState === 'MENU' && (
          <div className="ui-overlay menu-bg fade-in-up">
            <h1 className="menu-title">RAMADHAN<br/>RUSH</h1>
            <p className="menu-subtitle">- ARCADE KETUPAT -</p>
            <div className="menu-buttons">
              <button onClick={() => {sfx.tap(); setUiState('DIFF_SELECT');}} className="menu-btn-main btn-fresh">MAIN</button>
              <button onClick={() => {sfx.tap(); setUiState('SHOP');}} className="menu-btn-main btn-gold">PASAR SORE</button>
            </div>
            <div className="coin-display">🪙 {bankedScore}</div>
          </div>
        )}

        {/* PILIH KESULITAN */}
        {uiState === 'DIFF_SELECT' && (
          <div className="ui-overlay diff-bg fade-in-up">
            <h2 className="diff-title">PILIH MODE</h2>
            <div className="diff-grid">
              {Object.values(DIFFICULTIES).map(diff => (
                <button key={diff.id} onClick={() => startGame(diff)} className={`diff-card ${diff.id === 'PAHALA' ? 'pahala' : 'kasual'}`}>
                  <span className="diff-card-name">{diff.name}</span>
                  {diff.desc && <span className="diff-card-desc" style={{color:'#FFD54F'}}>{diff.desc}</span>}
                </button>
              ))}
              <button onClick={() => {sfx.tap(); setUiState('CUSTOM_MENU');}} className="diff-card custom-btn">
                 <span className="diff-card-name">KUSTOM</span>
                 <span className="diff-card-desc" style={{color:'white'}}>Pilih Minigame Sendiri</span>
              </button>
            </div>
            <div style={{marginTop:'24px', textAlign:'center'}}>
              {(consumables.cons_life > 0 || consumables.cons_double > 0) && <p className="active-items-text">✨ Item Aktif: {consumables.cons_life>0?'[Nyawa Darurat]':''} {consumables.cons_double>0?'[Koin Ganda]':''}</p>}
              <button onClick={() => {sfx.tap(); setUiState('MENU');}} className="back-link">Kembali</button>
            </div>
          </div>
        )}

        {/* MODE KUSTOM */}
        {uiState === 'CUSTOM_MENU' && (
          <div className="ui-overlay custom-bg" style={{alignItems:'stretch', justifyContent:'flex-start'}}>
            <h2 className="custom-title">MODE KUSTOM</h2>
            <p className="custom-desc">Main seru-seruan tanpa dapat Koin. Pilih minigame-mu!</p>
            <div className="custom-game-list">
               {MINIGAMES.map(mg => (
                  <label key={mg.id} className="custom-game-label">
                     <input type="checkbox" checked={customSelection.includes(mg.id)}
                            onChange={(e) => {
                               sfx.tap();
                               if(e.target.checked) setCustomSelection([...customSelection, mg.id]);
                               else if(customSelection.length > 1) setCustomSelection(customSelection.filter(id => id !== mg.id));
                            }} />
                     <span>{mg.name}</span>
                  </label>
               ))}
            </div>
            <div className="custom-play-buttons">
               <button onClick={() => startGame(DIFFICULTIES.EASY, true)} className="custom-play-btn btn-fresh">MAIN (KASUAL)</button>
               <button onClick={() => startGame(DIFFICULTIES.PAHALA, true)} className="custom-play-btn btn-gold">MAIN (PAHALA)</button>
            </div>
            <button onClick={() => {sfx.tap(); setUiState('MENU');}} className="back-link" style={{marginTop:'16px', textAlign:'center'}}>Kembali ke Menu</button>
          </div>
        )}

        {/* TOKO */}
        {uiState === 'SHOP' && (
          <div className="ui-overlay shop-bg" style={{alignItems:'stretch', justifyContent:'flex-start'}}>
            <div className="shop-header">
               <h2 className="shop-title">PASAR SORE</h2>
               <div className="shop-coins">🪙 {bankedScore}</div>
            </div>
            <div className="shop-grid">
              {SHOP_ITEMS.map(item => {
                const isCons = item.type === 'cons';
                const isOwned = !isCons && ownedItems.includes(item.id);
                const isEquipped = equipped[item.type] === item.id;
                const consCount = isCons ? (consumables[item.id] || 0) : 0;
                let limitReached = false;
                if(item.id === 'cons_life' && consCount >= 5) limitReached = true;
                if(item.id === 'cons_double' && consCount >= 1) limitReached = true;
                return (
                  <div key={item.id} className={`shop-item ${isCons ? 'cons' : 'fx'}`}>
                    <div className="shop-item-info">
                      <div className="shop-item-icon">{item.icon}</div>
                      <div>
                         <div className="shop-item-name">{item.name} {isCons && <span className="shop-item-count">(Punya: {consCount})</span>}</div>
                         <div className="shop-item-desc">{item.desc}</div>
                      </div>
                    </div>
                    <div>
                      {isCons ? (
                         <button onClick={() => buyItem(item)} disabled={bankedScore < item.cost || limitReached} className={`shop-btn ${bankedScore >= item.cost && !limitReached ? 'btn-gold' : 'disabled-look'}`}>
                           {limitReached ? 'MAX' : `${item.cost} 🪙`}
                         </button>
                      ) : !isOwned ? (
                        <button onClick={() => buyItem(item)} disabled={bankedScore < item.cost} className={`shop-btn ${bankedScore >= item.cost ? 'btn-fresh' : 'disabled-look'}`}>
                          {item.cost} 🪙
                        </button>
                      ) : (
                        <button onClick={() => toggleEquip(item)} className={`shop-btn ${isEquipped ? 'equip-active' : 'equip-inactive'}`}>
                          {isEquipped ? 'LEPAS' : 'PAKAI'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => {sfx.tap(); setUiState('MENU');}} className="back-link" style={{marginTop:'24px', textAlign:'center'}}>Kembali ke Menu</button>
          </div>
        )}

        {/* GAMEOVER */}
        {uiState === 'GAMEOVER' && (
          <div className="ui-overlay gameover-bg fade-in-up">
            <h2 className="gameover-title">GAME OVER</h2>
            <p className="gameover-label">{engine.current.isCustomMode ? 'Skor Akhir:' : 'Skor Ibadah Terkumpul:'}</p>
            <div className="gameover-score-box"><p className="gameover-score">{finalScore}</p></div>
            {!engine.current.isCustomMode && <p className="gameover-msg saved">+ Koin Berhasil Disimpan 🪙</p>}
            {engine.current.isCustomMode && <p className="gameover-msg custom">(Mode Kustom tidak menghasilkan koin)</p>}
            <div className="gameover-buttons">
               <button onClick={() => {sfx.tap(); setUiState('MENU');}} className="gameover-btn btn-fresh">MENU</button>
               {!engine.current.isCustomMode && <button onClick={() => {sfx.tap(); setUiState('SHOP');}} className="gameover-btn btn-gold">KE PASAR</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
