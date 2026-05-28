/* ════════════════════════════════════════
   ChronoWise — Main App Logic
════════════════════════════════════════ */

// ── State ──────────────────────────────
const state = {
  tab: 'clock',
  clockStyle: 'digital',    // 'analog' | 'digital'
  showSeconds: true,
  use24h: false,
  alarms: [],
  worldClocks: [
    { city: 'London',    country: 'United Kingdom', tz: 'Europe/London'     },
    { city: 'New York',  country: 'United States',  tz: 'America/New_York'  },
    { city: 'Tokyo',     country: 'Japan',           tz: 'Asia/Tokyo'        },
    { city: 'Dubai',     country: 'UAE',             tz: 'Asia/Dubai'        },
  ],
  timer: { h: 0, m: 5, s: 0, remaining: 0, running: false, finished: false, interval: null },
  sw:    { running: false, started: 0, elapsed: 0, lapTime: 0, laps: [], interval: null },
  settings: {
    clockStyle: 'digital',
    showSeconds: true,
    use24h: false,
    clockFace: 'gradient',
    alarmSnooze: '5',
    alarmVolume: '80',
    alarmVibrate: true,
    timerSound: 'bell',
    timerVibrate: true,
    nightMode: false,
    nightStart: '22:00',
    nightEnd: '07:00',
    theme: 'purple',
    bedtime: false,
    bedtimeStart: '22:00',
    bedtimeWake: '07:00',
  },
  editingAlarm: null,
  alarmSound: null,
  timerDoneSound: null,
};

// Load persisted data
try {
  const saved = JSON.parse(localStorage.getItem('cw_state') || '{}');
  if (saved.alarms)     state.alarms      = saved.alarms;
  if (saved.worldClocks) state.worldClocks = saved.worldClocks;
  if (saved.settings)  Object.assign(state.settings, saved.settings);
  if (saved.clockStyle) state.clockStyle  = saved.clockStyle;
  if (saved.use24h !== undefined) state.use24h = saved.use24h;
  if (saved.showSeconds !== undefined) state.showSeconds = saved.showSeconds;
} catch {}

function persist() {
  localStorage.setItem('cw_state', JSON.stringify({
    alarms: state.alarms,
    worldClocks: state.worldClocks,
    settings: state.settings,
    clockStyle: state.clockStyle,
    use24h: state.use24h,
    showSeconds: state.showSeconds,
  }));
}

// ── Utilities ──────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };

function pad(n) { return String(n).padStart(2, '0'); }
function fmtMs(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
}
function fmtMsMs(ms) {
  const cs = Math.floor((ms % 1000) / 10);
  return pad(cs);
}

function now() { return new Date(); }

function fmtTime(date, tz, use24 = state.use24h) {
  return date.toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit',
    second: state.showSeconds ? '2-digit' : undefined,
    hour12: !use24
  });
}

function tzOffset(tz) {
  const local = new Date();
  const here  = local.getTime() + local.getTimezoneOffset() * 60000;
  const there = new Date(local.toLocaleString('en-US', { timeZone: tz }));
  const diff  = Math.round((there - local) / 3600000);
  return diff >= 0 ? `+${diff}` : `${diff}`;
}

function toast(msg, duration = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── Audio ──────────────────────────────
function makeBeep(type = 'alarm') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'alarm') {
      const patterns = [[880, .15], [0, .05], [880, .15], [0, .05], [880, .3]];
      let t = ctx.currentTime;
      patterns.forEach(([freq, dur]) => {
        if (freq) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq;
          o.type = 'sine';
          g.gain.setValueAtTime(0.4, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + dur);
          o.start(t); o.stop(t + dur);
        }
        t += dur + 0.02;
      });
    } else {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 660;
      o.type = 'sine';
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.5);
    }
  } catch {}
}

// ── Navigation ────────────────────────
function setTab(tab) {
  state.tab = tab;
  $$('.tab-page').forEach(p => p.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  $(`#page-${tab}`)?.classList.add('active');
  $(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');
  $('#fab-alarm').style.display = tab === 'alarm' ? 'flex' : 'none';
}

// ── CLOCK TAB ─────────────────────────
let clockInterval = null;

function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  renderClock();
  clockInterval = setInterval(renderClock, 1000);
}

function renderClock() {
  const d = now();
  const style = state.settings.clockStyle;

  if (style === 'analog') {
    $('#clock-analog').style.display = 'block';
    $('#clock-digital').style.display = 'none';
    renderAnalog(d);
  } else {
    $('#clock-analog').style.display = 'none';
    $('#clock-digital').style.display = 'block';
    renderDigital(d);
  }

  renderWorldClocks();
  checkAlarms(d);
}

function renderDigital(d) {
  const opts = { hour: '2-digit', minute: '2-digit', hour12: !state.use24h };
  if (state.showSeconds) opts.second = '2-digit';
  const parts = d.toLocaleTimeString('en-US', opts).split(':');
  const main = parts.slice(0, 2).join(':');
  let secs = '';
  if (state.showSeconds) {
    const last = parts[2] || '';
    if (!state.use24h) {
      secs = last.replace(/[AP]M/i, '').trim();
    } else {
      secs = last;
    }
  }
  const ampm = !state.use24h ? (d.getHours() < 12 ? 'AM' : 'PM') : '';

  const wrap = $('#clock-digital');
  wrap.innerHTML = `
    <div class="digital-big-time">${main}<span class="digital-seconds">${state.showSeconds ? ':'+pad(d.getSeconds()) : ''}</span></div>
    <div class="digital-date">${d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}${ampm ? ' · ' + ampm : ''}</div>
  `;
}

function renderAnalog(d) {
  const svg = $('#analog-svg');
  if (!svg) return;
  const cx = 100, cy = 100, r = 88;
  const sAngle = (d.getSeconds() / 60) * 360;
  const mAngle = ((d.getMinutes() + d.getSeconds() / 60) / 60) * 360;
  const hAngle = ((d.getHours() % 12 + d.getMinutes() / 60) / 12) * 360;

  function hand(angle, len, width, color) {
    const rad = (angle - 90) * Math.PI / 180;
    const x2 = cx + Math.cos(rad) * len;
    const y2 = cy + Math.sin(rad) * len;
    return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  }

  // tick marks
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * 360 - 90;
    const rad = a * Math.PI / 180;
    const isHour = i % 5 === 0;
    const r1 = isHour ? r - 10 : r - 5;
    const x1 = cx + Math.cos(rad) * r1;
    const y1 = cy + Math.sin(rad) * r1;
    const x2 = cx + Math.cos(rad) * r;
    const y2 = cy + Math.sin(rad) * r;
    ticks += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"
      stroke="${isHour ? '#94A3B8' : '#2A2A50'}" stroke-width="${isHour ? 2 : 1}" stroke-linecap="round"/>`;
  }

  svg.innerHTML = `
    <defs>
      <radialGradient id="dialGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1C1C3A"/>
        <stop offset="100%" stop-color="#13132B"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r+4}" fill="url(#dialGrad)" stroke="#2A2A50" stroke-width="1"/>
    ${ticks}
    ${hand(hAngle, 52, 5, '#F1F5F9')}
    ${hand(mAngle, 70, 3.5, '#F1F5F9')}
    ${hand(sAngle, 76, 1.5, '#A855F7')}
    <circle cx="${cx}" cy="${cy}" r="5" fill="#7C3AED"/>
    <circle cx="${cx}" cy="${cy}" r="2" fill="#F1F5F9"/>
  `;
}

function renderWorldClocks() {
  const list = $('#world-clock-list');
  if (!list) return;
  const d = now();
  list.innerHTML = state.worldClocks.map((wc, i) => {
    const timeStr = d.toLocaleTimeString('en-US', {
      timeZone: wc.tz, hour: '2-digit', minute: '2-digit', hour12: !state.use24h
    });
    const dateStr = d.toLocaleDateString('en-US', { timeZone: wc.tz, weekday: 'short', month: 'short', day: 'numeric' });
    const diff = tzOffset(wc.tz);
    const diffNum = parseInt(diff);
    const diffLabel = diffNum === 0 ? 'Same' : (diffNum > 0 ? `+${diffNum}h` : `${diffNum}h`);
    return `
      <div class="world-clock-item" data-idx="${i}">
        <div class="wc-left">
          <div class="wc-city">${wc.city}</div>
          <div class="wc-country">${wc.country}</div>
          <div class="wc-diff">${diffLabel}</div>
        </div>
        <div class="wc-right">
          <div class="wc-time">${timeStr}</div>
          <div class="wc-date">${dateStr}</div>
        </div>
      </div>`;
  }).join('');

  $$('.world-clock-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = +item.dataset.idx;
      if (confirm(`Remove ${state.worldClocks[idx].city}?`)) {
        state.worldClocks.splice(idx, 1);
        persist();
        renderWorldClocks();
      }
    });
  });
}

// ── ALARM TAB ─────────────────────────
let alarmCheckInterval = null;

function renderAlarms() {
  const list = $('#alarm-list');
  if (!list) return;

  if (state.alarms.length === 0) {
    list.innerHTML = `<div class="text-center text-muted" style="padding:32px 0;font-size:14px;">No alarms set</div>`;
    $('#next-alarm-card').style.display = 'none';
    return;
  }

  // Find next active alarm
  const now_ = now();
  const activeAlarms = state.alarms.filter(a => a.enabled);
  if (activeAlarms.length) {
    const next = getNextAlarm(activeAlarms);
    if (next) {
      $('#next-alarm-card').style.display = 'block';
      const h = next.h, m = next.m;
      const ampm = h < 12 ? 'AM' : 'PM';
      const h12 = state.use24h ? h : (h % 12 || 12);
      $('#next-alarm-time').textContent = `${pad(h12)}:${pad(m)}`;
      $('#next-alarm-ampm').style.display = state.use24h ? 'none' : 'inline';
      $('#next-alarm-ampm').textContent = ' ' + ampm;
      $('#next-alarm-name').textContent = next.label || 'Alarm';
      $('#next-alarm-days').textContent = formatDays(next.days);

      const msUntil = msUntilAlarm(next);
      const hoursUntil = Math.floor(msUntil / 3600000);
      const minsUntil = Math.floor((msUntil % 3600000) / 60000);
      $('#next-alarm-countdown').textContent =
        hoursUntil > 0 ? `in ${hoursUntil}h ${minsUntil}m` : `in ${minsUntil} min`;
    }
  } else {
    $('#next-alarm-card').style.display = 'none';
  }

  list.innerHTML = state.alarms.map((a, i) => {
    const h12 = state.use24h ? a.h : (a.h % 12 || 12);
    const ampm = a.h < 12 ? 'AM' : 'PM';
    return `
      <div class="alarm-item ${a.enabled ? 'active' : ''}" data-idx="${i}">
        <div class="alarm-item-left">
          <div class="alarm-time">${pad(h12)}:${pad(a.m)}<span class="ampm">${state.use24h ? '' : ampm}</span></div>
          <div class="alarm-label-row">
            <span class="alarm-name">${a.label || 'Alarm'}</span>
            <span class="alarm-days">${formatDays(a.days)}</span>
          </div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${a.enabled ? 'checked' : ''} data-idx="${i}" class="alarm-toggle">
          <div class="toggle-track"></div>
          <div class="toggle-thumb"></div>
        </label>
      </div>`;
  }).join('');

  $$('.alarm-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.toggle-switch')) return;
      openAlarmModal(+item.dataset.idx);
    });
  });

  $$('.alarm-toggle').forEach(tog => {
    tog.addEventListener('change', () => {
      const idx = +tog.dataset.idx;
      state.alarms[idx].enabled = tog.checked;
      persist();
      renderAlarms();
      toast(tog.checked ? 'Alarm on' : 'Alarm off');
    });
  });
}

function formatDays(days) {
  if (!days || days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days.map(d => names[d]).join(', ');
}

function msUntilAlarm(alarm) {
  const d = now();
  let target = new Date(d);
  target.setHours(alarm.h, alarm.m, 0, 0);
  if (target <= d) target.setDate(target.getDate() + 1);
  if (alarm.days && alarm.days.length) {
    let tries = 0;
    while (!alarm.days.includes(target.getDay()) && tries < 7) {
      target.setDate(target.getDate() + 1);
      tries++;
    }
  }
  return target - d;
}

function getNextAlarm(alarms) {
  return alarms.reduce((min, a) => {
    const ms = msUntilAlarm(a);
    return (!min || ms < msUntilAlarm(min)) ? a : min;
  }, null);
}

let lastAlarmFired = {};
function checkAlarms(d) {
  state.alarms.forEach((alarm, i) => {
    if (!alarm.enabled) return;
    const key = `${i}_${d.getHours()}_${d.getMinutes()}`;
    if (alarm.h === d.getHours() && alarm.m === d.getMinutes() && d.getSeconds() < 5) {
      if (!lastAlarmFired[key]) {
        lastAlarmFired[key] = true;
        fireAlarm(alarm, i);
      }
    }
  });
}

function fireAlarm(alarm, idx) {
  const overlay = $('#alarm-ring-overlay');
  const d = now();
  const h12 = state.use24h ? alarm.h : (alarm.h % 12 || 12);
  const ampm = alarm.h < 12 ? 'AM' : 'PM';
  $('#ring-time').textContent = `${pad(h12)}:${pad(alarm.m)}${state.use24h ? '' : ' ' + ampm}`;
  $('#ring-name').textContent = alarm.label || 'Alarm';
  overlay.classList.add('active');

  // Repeat beep
  state.alarmSound = setInterval(() => makeBeep('alarm'), 2000);
  makeBeep('alarm');

  // Vibrate
  if (state.settings.alarmVibrate && navigator.vibrate) {
    navigator.vibrate([500, 300, 500, 300, 500]);
  }

  // Dismiss
  $('#ring-dismiss').onclick = () => {
    overlay.classList.remove('active');
    clearInterval(state.alarmSound);
    if (!alarm.days || alarm.days.length === 0) {
      state.alarms[idx].enabled = false;
      persist();
      renderAlarms();
    }
  };

  // Snooze
  $('#ring-snooze').onclick = () => {
    overlay.classList.remove('active');
    clearInterval(state.alarmSound);
    const snooze = parseInt(state.settings.alarmSnooze) || 5;
    const d2 = new Date(Date.now() + snooze * 60000);
    state.alarms.push({ h: d2.getHours(), m: d2.getMinutes(), label: '💤 Snoozed', days: [], enabled: true });
    persist();
    renderAlarms();
    toast(`Snoozed for ${snooze} min`);
  };
}

// Alarm Modal
function openAlarmModal(idx = null) {
  state.editingAlarm = idx;
  const alarm = idx !== null ? state.alarms[idx] : { h: 7, m: 0, label: '', days: [], enabled: true, sound: 'bell' };
  const modal = $('#alarm-modal');

  // Set picker
  setPickerHour(alarm.h);
  setPickerMin(alarm.m);
  $('#alarm-label-input').value = alarm.label || '';
  $$('.day-chip').forEach(chip => {
    const d = +chip.dataset.day;
    chip.classList.toggle('active', alarm.days?.includes(d));
  });
  $$('.sound-option').forEach(o => {
    o.classList.toggle('active', (alarm.sound || 'bell') === o.dataset.sound);
  });

  $('#alarm-modal-title').textContent = idx !== null ? 'Edit Alarm' : 'New Alarm';
  $('#alarm-delete-btn').style.display = idx !== null ? 'block' : 'none';

  modal.classList.add('open');
}

function saveAlarm() {
  const h = getPickerHour();
  const m = getPickerMin();
  const label = $('#alarm-label-input').value.trim();
  const days = $$('.day-chip.active').map(c => +c.dataset.day);
  const sound = $('.sound-option.active')?.dataset.sound || 'bell';

  const alarm = { h, m, label, days, enabled: true, sound };

  if (state.editingAlarm !== null) {
    state.alarms[state.editingAlarm] = alarm;
  } else {
    state.alarms.push(alarm);
  }
  persist();
  renderAlarms();
  closeModal('alarm-modal');
  toast(state.editingAlarm !== null ? 'Alarm updated' : 'Alarm set');
  state.editingAlarm = null;
}

// Picker helpers
function buildPicker(el, values, initial) {
  const inner = el.querySelector('.picker-inner');
  if (!inner) return;
  inner.innerHTML = values.map(v => `<div class="picker-item">${v}</div>`).join('');
  const idx = values.indexOf(String(initial).padStart(2, '0'));
  if (idx >= 0) inner.scrollTop = idx * 46;
  inner.addEventListener('scroll', () => updatePickerHighlight(inner));
  updatePickerHighlight(inner);
}

function updatePickerHighlight(inner) {
  const items = inner.querySelectorAll('.picker-item');
  const center = inner.scrollTop + 80;
  items.forEach((item, i) => {
    const itemTop = i * 46;
    item.classList.toggle('selected', Math.abs(itemTop - inner.scrollTop) < 30);
  });
}

function getPickerValue(drumId) {
  const inner = document.getElementById(drumId)?.querySelector('.picker-inner');
  if (!inner) return 0;
  const idx = Math.round(inner.scrollTop / 46);
  const items = inner.querySelectorAll('.picker-item');
  return parseInt(items[idx]?.textContent || '0');
}

function setPickerTo(drumId, values, value) {
  const inner = document.getElementById(drumId)?.querySelector('.picker-inner');
  if (!inner) return;
  const idx = values.indexOf(String(value).padStart(2, '0'));
  if (idx >= 0) setTimeout(() => { inner.scrollTop = idx * 46; }, 50);
}

const HOURS_24 = Array.from({length: 24}, (_, i) => pad(i));
const HOURS_12 = Array.from({length: 12}, (_, i) => pad(i === 0 ? 12 : i));
const MINS     = Array.from({length: 60}, (_, i) => pad(i));

function initPickers() {
  buildPicker(document.getElementById('picker-hour'), state.use24h ? HOURS_24 : HOURS_12, 7);
  buildPicker(document.getElementById('picker-min'),  MINS, 0);
}
function setPickerHour(h) { setPickerTo('picker-hour', state.use24h ? HOURS_24 : HOURS_12, state.use24h ? h : (h % 12 || 12)); }
function setPickerMin(m)  { setPickerTo('picker-min', MINS, m); }
function getPickerHour()  {
  const v = getPickerValue('picker-hour');
  return state.use24h ? v : v;  // For 12h we'd need AM/PM
}
function getPickerMin()   { return getPickerValue('picker-min'); }

// ── TIMER TAB ─────────────────────────
function renderTimerInput() {
  const { h, m, s } = state.timer;
  $('#timer-input-h').textContent = pad(h);
  $('#timer-input-m').textContent = pad(m);
  $('#timer-input-s').textContent = pad(s);
}

function timerTotalSeconds() { return state.timer.h * 3600 + state.timer.m * 60 + state.timer.s; }

function startTimer() {
  const total = timerTotalSeconds();
  if (total === 0) return;
  if (!state.timer.running) {
    if (state.timer.remaining === 0) state.timer.remaining = total * 1000;
    state.timer.running = true;
    const end = Date.now() + state.timer.remaining;
    state.timer.interval = setInterval(() => {
      state.timer.remaining = end - Date.now();
      if (state.timer.remaining <= 0) {
        state.timer.remaining = 0;
        state.timer.running = false;
        state.timer.finished = true;
        clearInterval(state.timer.interval);
        renderTimerDisplay();
        timerDone();
        return;
      }
      renderTimerDisplay();
    }, 50);
    updateTimerControls();
  }
}

function pauseTimer() {
  state.timer.running = false;
  clearInterval(state.timer.interval);
  updateTimerControls();
}

function resetTimer() {
  state.timer.running = false;
  state.timer.finished = false;
  state.timer.remaining = 0;
  clearInterval(state.timer.interval);
  renderTimerDisplay();
  updateTimerControls();
}

function renderTimerDisplay() {
  const rem = state.timer.remaining;
  const total = timerTotalSeconds() * 1000;
  const frac = total > 0 ? rem / total : 0;
  const h = Math.floor(rem / 3600000);
  const m = Math.floor((rem % 3600000) / 60000);
  const s = Math.floor((rem % 60000) / 1000);
  $('#timer-display-time').textContent = h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;

  // Ring
  const circ = 2 * Math.PI * 96;
  const dash = circ * frac;
  $('#timer-ring-prog').style.strokeDasharray = `${dash} ${circ}`;
}

function updateTimerControls() {
  const running = state.timer.running;
  const hasTime = state.timer.remaining > 0 || timerTotalSeconds() > 0;

  $('#timer-start-btn').innerHTML  = running ? '⏸' : '▶';
  $('#timer-start-btn').className  = `ctrl-btn primary large`;
  $('#timer-reset-btn').style.display = (state.timer.remaining > 0 || state.timer.finished) ? 'flex' : 'none';

  const inputSection = $('#timer-input-section');
  if (running || state.timer.remaining > 0) {
    inputSection.style.display = 'none';
    $('#timer-ring-container').style.display = 'block';
  } else {
    inputSection.style.display = 'block';
    $('#timer-ring-container').style.display = 'none';
  }
}

function timerDone() {
  const overlay = $('#timer-done-overlay');
  overlay.classList.add('active');
  makeBeep('timer');
  if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
  setTimeout(() => overlay.classList.remove('active'), 4000);
}

function adjustTimerField(field, delta) {
  const max = field === 'h' ? 23 : 59;
  state.timer[field] = (state.timer[field] + delta + max + 1) % (max + 1);
  renderTimerInput();
}

// ── STOPWATCH TAB ─────────────────────
function startStopwatch() {
  if (!state.sw.running) {
    state.sw.running = true;
    const startedAt = Date.now() - state.sw.elapsed;
    state.sw.interval = setInterval(() => {
      state.sw.elapsed = Date.now() - startedAt;
      renderSwDisplay();
    }, 33);
    updateSwControls();
  }
}

function pauseStopwatch() {
  state.sw.running = false;
  clearInterval(state.sw.interval);
  updateSwControls();
}

function resetStopwatch() {
  state.sw.running = false;
  state.sw.elapsed = 0;
  state.sw.lapTime = 0;
  state.sw.laps = [];
  clearInterval(state.sw.interval);
  renderSwDisplay();
  renderLaps();
  updateSwControls();
}

function lapStopwatch() {
  if (!state.sw.running) return;
  const lapElapsed = state.sw.elapsed - state.sw.lapTime;
  state.sw.laps.unshift({ n: state.sw.laps.length + 1, split: state.sw.elapsed, lap: lapElapsed });
  state.sw.lapTime = state.sw.elapsed;
  renderLaps();
}

function renderSwDisplay() {
  const ms = state.sw.elapsed;
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  const main = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  $('#sw-time').textContent = main;
  $('#sw-ms').textContent = '.' + pad(cs);
}

function renderLaps() {
  const c = $('#laps-list');
  if (!c) return;
  if (state.sw.laps.length === 0) { c.innerHTML = ''; return; }

  const times = state.sw.laps.map(l => l.lap);
  const best = Math.min(...times);
  const worst = Math.max(...times);

  c.innerHTML = state.sw.laps.map(l => {
    const cls = l.lap === best ? 'best' : l.lap === worst ? 'worst' : '';
    return `<div class="lap-item ${cls}">
      <span class="lap-num">Lap ${l.n}</span>
      <span class="lap-split">${fmtMs(l.split)}</span>
      <span class="lap-time">${fmtMs(l.lap)}.${fmtMsMs(l.lap)}</span>
    </div>`;
  }).join('');
}

function updateSwControls() {
  const running = state.sw.running;
  const hasElapsed = state.sw.elapsed > 0;

  $('#sw-start-btn').innerHTML = running ? '⏸' : '▶';
  $('#sw-lap-btn').disabled = !running;
  $('#sw-lap-btn').style.opacity = running ? '1' : '.4';
  $('#sw-reset-btn').style.display = hasElapsed && !running ? 'flex' : 'none';
}

// ── SETTINGS TAB ─────────────────────
function renderSettings() {
  const s = state.settings;
  // Sync toggles
  const els = {
    'set-show-seconds': s.showSeconds,
    'set-use24h':       s.use24h,
    'set-vibrate':      s.alarmVibrate,
    'set-timer-vib':    s.timerVibrate,
    'set-night':        s.nightMode,
    'set-bedtime':      s.bedtime,
  };
  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  });

  const selEls = {
    'set-snooze':   s.alarmSnooze,
    'set-volume':   s.alarmVolume,
    'set-clock-face': s.clockFace,
    'set-timer-sound': s.timerSound,
    'set-clock-style': s.clockStyle,
  };
  Object.entries(selEls).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

function bindSettingsEvents() {
  const toggleMap = {
    'set-show-seconds': 'showSeconds',
    'set-use24h':       'use24h',
    'set-vibrate':      'alarmVibrate',
    'set-timer-vib':    'timerVibrate',
    'set-night':        'nightMode',
    'set-bedtime':      'bedtime',
  };
  Object.entries(toggleMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      state.settings[key] = el.checked;
      if (key === 'use24h') state.use24h = el.checked;
      if (key === 'showSeconds') state.showSeconds = el.checked;
      persist();
    });
  });

  const selectMap = {
    'set-snooze':      'alarmSnooze',
    'set-volume':      'alarmVolume',
    'set-clock-face':  'clockFace',
    'set-timer-sound': 'timerSound',
    'set-clock-style': v => {
      state.settings.clockStyle = v;
      state.clockStyle = v;
    },
  };
  Object.entries(selectMap).forEach(([id, keyOrFn]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (typeof keyOrFn === 'function') keyOrFn(el.value);
      else state.settings[keyOrFn] = el.value;
      persist();
    });
  });
}

// ── CITY SEARCH ───────────────────────
const CITIES = [
  { city: 'London',         country: 'United Kingdom', tz: 'Europe/London'       },
  { city: 'New York',       country: 'United States',  tz: 'America/New_York'    },
  { city: 'Los Angeles',    country: 'United States',  tz: 'America/Los_Angeles' },
  { city: 'Chicago',        country: 'United States',  tz: 'America/Chicago'     },
  { city: 'Toronto',        country: 'Canada',         tz: 'America/Toronto'     },
  { city: 'São Paulo',      country: 'Brazil',         tz: 'America/Sao_Paulo'   },
  { city: 'Paris',          country: 'France',         tz: 'Europe/Paris'        },
  { city: 'Berlin',         country: 'Germany',        tz: 'Europe/Berlin'       },
  { city: 'Madrid',         country: 'Spain',          tz: 'Europe/Madrid'       },
  { city: 'Rome',           country: 'Italy',          tz: 'Europe/Rome'         },
  { city: 'Amsterdam',      country: 'Netherlands',    tz: 'Europe/Amsterdam'    },
  { city: 'Stockholm',      country: 'Sweden',         tz: 'Europe/Stockholm'    },
  { city: 'Moscow',         country: 'Russia',         tz: 'Europe/Moscow'       },
  { city: 'Istanbul',       country: 'Turkey',         tz: 'Europe/Istanbul'     },
  { city: 'Dubai',          country: 'UAE',            tz: 'Asia/Dubai'          },
  { city: 'Riyadh',         country: 'Saudi Arabia',   tz: 'Asia/Riyadh'         },
  { city: 'Mumbai',         country: 'India',          tz: 'Asia/Kolkata'        },
  { city: 'Delhi',          country: 'India',          tz: 'Asia/Kolkata'        },
  { city: 'Kolkata',        country: 'India',          tz: 'Asia/Kolkata'        },
  { city: 'Dhaka',          country: 'Bangladesh',     tz: 'Asia/Dhaka'          },
  { city: 'Karachi',        country: 'Pakistan',       tz: 'Asia/Karachi'        },
  { city: 'Bangkok',        country: 'Thailand',       tz: 'Asia/Bangkok'        },
  { city: 'Singapore',      country: 'Singapore',      tz: 'Asia/Singapore'      },
  { city: 'Kuala Lumpur',   country: 'Malaysia',       tz: 'Asia/Kuala_Lumpur'   },
  { city: 'Jakarta',        country: 'Indonesia',      tz: 'Asia/Jakarta'        },
  { city: 'Manila',         country: 'Philippines',    tz: 'Asia/Manila'         },
  { city: 'Hong Kong',      country: 'Hong Kong',      tz: 'Asia/Hong_Kong'      },
  { city: 'Shanghai',       country: 'China',          tz: 'Asia/Shanghai'       },
  { city: 'Beijing',        country: 'China',          tz: 'Asia/Shanghai'       },
  { city: 'Seoul',          country: 'South Korea',    tz: 'Asia/Seoul'          },
  { city: 'Tokyo',          country: 'Japan',          tz: 'Asia/Tokyo'          },
  { city: 'Sydney',         country: 'Australia',      tz: 'Australia/Sydney'    },
  { city: 'Melbourne',      country: 'Australia',      tz: 'Australia/Melbourne' },
  { city: 'Auckland',       country: 'Pacific/Auckland', tz: 'Pacific/Auckland'  },
  { city: 'Cairo',          country: 'Egypt',          tz: 'Africa/Cairo'        },
  { city: 'Lagos',          country: 'Nigeria',        tz: 'Africa/Lagos'        },
  { city: 'Nairobi',        country: 'Kenya',          tz: 'Africa/Nairobi'      },
  { city: 'Accra',          country: 'Ghana',          tz: 'Africa/Accra'        },
  { city: 'Johannesburg',   country: 'South Africa',   tz: 'Africa/Johannesburg' },
  { city: 'Abuja',          country: 'Nigeria',        tz: 'Africa/Lagos'        },
  { city: 'Mexico City',    country: 'Mexico',         tz: 'America/Mexico_City' },
  { city: 'Buenos Aires',   country: 'Argentina',      tz: 'America/Argentina/Buenos_Aires' },
  { city: 'Bogotá',         country: 'Colombia',       tz: 'America/Bogota'      },
  { city: 'Lima',           country: 'Peru',           tz: 'America/Lima'        },
  { city: 'Vancouver',      country: 'Canada',         tz: 'America/Vancouver'   },
];

function renderCitySearch(query = '') {
  const list = $('#city-search-list');
  const d = now();
  const filtered = CITIES.filter(c =>
    !query || c.city.toLowerCase().includes(query.toLowerCase()) || c.country.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 20);

  list.innerHTML = filtered.map(c => {
    const t = d.toLocaleTimeString('en-US', { timeZone: c.tz, hour: '2-digit', minute: '2-digit', hour12: true });
    return `<div class="city-list-item" data-tz="${c.tz}" data-city="${c.city}" data-country="${c.country}">
      <div>
        <div class="city-name">${c.city}</div>
        <div class="city-info">${c.country}</div>
      </div>
      <div class="city-time">${t}</div>
    </div>`;
  }).join('');

  $$('.city-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const already = state.worldClocks.find(w => w.tz === item.dataset.tz && w.city === item.dataset.city);
      if (already) { toast('Already added'); return; }
      state.worldClocks.push({ city: item.dataset.city, country: item.dataset.country, tz: item.dataset.tz });
      persist();
      closeModal('city-modal');
      renderWorldClocks();
      toast(`${item.dataset.city} added`);
    });
  });
}

// ── MODAL HELPERS ─────────────────────
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── PWA INSTALL ───────────────────────
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  $('#install-banner').classList.add('visible');
});

// ── DOM READY ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Tab switching
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

  // URL tab param
  const urlTab = new URLSearchParams(location.search).get('tab');
  setTab(urlTab || 'clock');

  // ── Clock tab ─────────────────────
  $$('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.clockStyle = btn.dataset.style;
      persist();
      $$('.style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  const initStyleBtn = $(`.style-btn[data-style="${state.settings.clockStyle}"]`);
  if (initStyleBtn) {
    $$('.style-btn').forEach(b => b.classList.remove('active'));
    initStyleBtn.classList.add('active');
  }

  $('#add-city-btn').addEventListener('click', () => {
    openModal('city-modal');
    renderCitySearch();
    $('#city-search-input').value = '';
    $('#city-search-input').focus();
  });

  $('#city-search-input').addEventListener('input', e => renderCitySearch(e.target.value));

  // ── Alarm tab ──────────────────────
  $('#fab-alarm').addEventListener('click', () => openAlarmModal(null));

  $$('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => {
      if (e.target === o) o.classList.remove('open');
    });
  });

  $('#alarm-cancel').addEventListener('click', () => closeModal('alarm-modal'));
  $('#alarm-save').addEventListener('click', saveAlarm);
  $('#alarm-delete-btn').addEventListener('click', () => {
    if (state.editingAlarm !== null) {
      state.alarms.splice(state.editingAlarm, 1);
      persist();
      renderAlarms();
      closeModal('alarm-modal');
      toast('Alarm deleted');
    }
  });

  $$('.day-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });

  $$('.sound-option').forEach(o => {
    o.addEventListener('click', () => {
      $$('.sound-option').forEach(x => x.classList.remove('active'));
      o.classList.add('active');
    });
  });

  initPickers();

  // ── Timer tab ──────────────────────
  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.dataset.mins);
      state.timer.h = Math.floor(mins / 60);
      state.timer.m = mins % 60;
      state.timer.s = 0;
      state.timer.remaining = 0;
      state.timer.finished = false;
      renderTimerInput();
      updateTimerControls();
    });
  });

  // Spinner up/down
  $$('.spinner-up, .spinner-down').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const delta = btn.classList.contains('spinner-up') ? 1 : -1;
      adjustTimerField(field, delta);
    });
  });

  $('#timer-start-btn').addEventListener('click', () => {
    state.timer.running ? pauseTimer() : startTimer();
  });
  $('#timer-reset-btn').addEventListener('click', resetTimer);
  $('#timer-done-close').addEventListener('click', () => {
    $('#timer-done-overlay').classList.remove('active');
    resetTimer();
  });

  // Timer ring init
  const circ = 2 * Math.PI * 96;
  $('#timer-ring-prog').style.strokeDasharray = `${circ} ${circ}`;
  $('#timer-ring-prog').style.strokeDashoffset = '0';

  renderTimerInput();
  updateTimerControls();

  // ── Stopwatch tab ──────────────────
  $('#sw-start-btn').addEventListener('click', () => {
    state.sw.running ? pauseStopwatch() : startStopwatch();
  });
  $('#sw-lap-btn').addEventListener('click', lapStopwatch);
  $('#sw-reset-btn').addEventListener('click', resetStopwatch);
  renderSwDisplay();
  updateSwControls();

  // ── Settings tab ───────────────────
  renderSettings();
  bindSettingsEvents();

  // Theme swatches
  $$('.theme-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      state.settings.theme = sw.dataset.theme;
      applyTheme(sw.dataset.theme);
      $$('.theme-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      persist();
    });
    if (sw.dataset.theme === state.settings.theme) sw.classList.add('selected');
  });

  // ── Install ────────────────────────
  $('#install-btn')?.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    if (outcome === 'accepted') {
      $('#install-banner').classList.remove('visible');
      toast('App installed!');
    }
    deferredInstall = null;
  });

  // ── Start loops ────────────────────
  renderAlarms();
  startClock();

  // SW registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});

// ── Theme switcher ────────────────────
const THEMES = {
  purple: { primary: '#7C3AED', accent: '#A855F7', 'd': '#5B21B6' },
  blue:   { primary: '#2563EB', accent: '#60A5FA', 'd': '#1E40AF' },
  teal:   { primary: '#0D9488', accent: '#2DD4BF', 'd': '#0F766E' },
  rose:   { primary: '#E11D48', accent: '#FB7185', 'd': '#9F1239' },
};
function applyTheme(name) {
  const t = THEMES[name] || THEMES.purple;
  const r = document.documentElement;
  r.style.setProperty('--primary',   t.primary);
  r.style.setProperty('--accent',    t.accent);
  r.style.setProperty('--primary-d', t.d);
  r.style.setProperty('--primary-l', t.accent);
}
applyTheme((() => { try { return JSON.parse(localStorage.getItem('cw_state') || '{}').settings?.theme || 'purple'; } catch { return 'purple'; } })());
