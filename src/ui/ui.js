// DOM-side UI: screens, campaign map, unit palette, HUD bits, results, kill feed, toasts.
import { FACTIONS, UNITS, factionOf } from '../data/factions.js';
import { WEAPONS } from '../data/weapons.js';
import { BIOMES, BIOME_KEYS } from '../data/biomes.js';
import { LEVELS, levelUnlocked } from '../data/levels.js';
import { portrait } from '../render/portraits.js';
import { save } from '../save.js';
import { fmtMoney } from '../util.js';

export const $ = (id) => document.getElementById(id);
const SCREENS = ['scr-menu', 'scr-campaign', 'scr-settings', 'scr-howto', 'scr-results', 'scr-map', 'scr-code'];

export function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
}
export function overlay(id, on) { $(id).classList.toggle('hidden', !on); }

export function bindActions(handlers) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const fn = handlers[b.dataset.act];
    if (fn) { e.preventDefault(); fn(b); }
  });
}

export function buildLogo() {
  const fill = (el, text) => { el.innerHTML = [...text].map((c, i) => `<i style="--i:${i}">${c}</i>`).join(''); };
  fill(document.querySelector('.logo .l1'), 'WOBBLE');
  fill(document.querySelector('.logo .l2'), 'WARFARE');
}

let toastT = 0;
export function toast(msg, good = false) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('good', good);
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 1800);
}

const img = (type, cls = 'pic') => {
  const el = document.createElement('img');
  el.className = cls;
  el.alt = '';
  el.draggable = false;
  const url = portrait(type, (u) => { el.src = u; });
  if (url) el.src = url;
  return el;
};

// ---------------------------------------------------------------- campaign
export function renderCampaign(chapter, onPick, onChapter) {
  const stars = save.stars;
  const total = LEVELS.reduce((s, l) => s + (stars[l.id] || 0), 0);
  $('star-total').textContent = `★ ${total} / ${LEVELS.length * 3}`;
  const tabs = $('chapter-tabs');
  tabs.innerHTML = '';
  FACTIONS.forEach((f, ci) => {
    const first = LEVELS.find((l) => l.chapter === ci && l.index === 0);
    const open = levelUnlocked(first, stars);
    const b = document.createElement('button');
    b.className = 'tab' + (ci === chapter ? ' on' : '') + (open ? '' : ' locked');
    b.style.setProperty('--fc', f.color);
    b.innerHTML = `<span class="dot"></span>${f.name}`;
    b.onclick = () => open ? onChapter(ci) : toast('Finish the previous chapter first');
    tabs.appendChild(b);
  });
  const f = FACTIONS[chapter];
  $('chapter-blurb').textContent = `${f.blurb} Battles use ${f.name} units and every faction you unlocked before.`;
  const grid = $('level-grid');
  grid.innerHTML = '';
  for (const lv of LEVELS.filter((l) => l.chapter === chapter)) {
    const open = levelUnlocked(lv, stars);
    const st = stars[lv.id] || 0;
    const b = document.createElement('button');
    b.className = 'lvl' + (open ? '' : ' locked');
    b.innerHTML = `<div class="num">${f.name.toUpperCase()} ${lv.index + 1}</div><div class="nm">${lv.name}</div>
      <div class="meta"><span>Budget ${fmtMoney(lv.budget)}</span><span class="st">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span></div>`;
    const us = document.createElement('div');
    us.className = 'units';
    for (const [t] of lv.enemy) us.appendChild(img(t, ''));
    b.appendChild(us);
    b.onclick = () => (open ? onPick(lv) : toast('Beat the previous level first'));
    grid.appendChild(b);
  }
}

// ---------------------------------------------------------------- palette
let paletteState = null;
export function renderPalette(opts) {
  // opts: { factions: [ids], faction, selected, onSelect, onFaction, budgetLeft (Infinity for sandbox) }
  paletteState = opts;
  const tabs = $('faction-tabs');
  tabs.innerHTML = '';
  for (const fid of opts.factions) {
    const f = factionOf(fid);
    const b = document.createElement('button');
    b.className = 'tab' + (fid === opts.faction ? ' on' : '');
    b.style.setProperty('--fc', f.color);
    b.innerHTML = `<span class="dot"></span>${f.name}`;
    b.onclick = () => opts.onFaction(fid);
    tabs.appendChild(b);
  }
  const pal = $('palette');
  pal.innerHTML = '';
  const list = opts.units;
  list.forEach((def, i) => {
    const c = document.createElement('div');
    c.className = 'ucard' + (def.key === opts.selected ? ' sel' : '');
    c.dataset.type = def.key;
    c.appendChild(img(def.key));
    c.insertAdjacentHTML('beforeend', `<div class="nm">${def.name}</div><div class="cost">${fmtMoney(def.cost)}</div>${i < 9 ? `<span class="key">${i + 1}</span>` : ''}`);
    c.onclick = () => opts.onSelect(def.key);
    c.onmouseenter = () => unitInfo(def);
    c.onmouseleave = () => unitInfo(opts.selected ? UNITS[opts.selected] : null);
    pal.appendChild(c);
  });
  const er = document.createElement('div');
  er.className = 'ucard erase' + (opts.selected === 'erase' ? ' sel' : '');
  er.innerHTML = '<div class="pic">✕</div><div class="nm">Remove</div><div class="cost">X</div>';
  er.onclick = () => opts.onSelect('erase');
  pal.appendChild(er);
  updateAfford(opts.budgetLeft);
  unitInfo(opts.selected && UNITS[opts.selected] ? UNITS[opts.selected] : null);
}

export function updateAfford(left) {
  for (const c of $('palette').children) {
    const def = UNITS[c.dataset.type];
    if (def) c.classList.toggle('poor', def.cost > left);
  }
}

export function unitInfo(def) {
  const el = $('unit-info');
  if (!def) { el.classList.add('hidden'); return; }
  const w = WEAPONS[def.weapon];
  const dmg = w.kind === 'heal' ? `${w.heal}/s heal` : w.kind === 'summon' ? 'raises dead' : `${Math.round(w.dmg * (w.pellets || 1) * (w.burst || 1))}`;
  const range = w.kind === 'melee' ? 'Melee' : `${w.range} m`;
  el.innerHTML = `<h3><span>${def.name}</span><span>${fmtMoney(def.cost)}</span></h3><p>${def.desc}</p>
    <div class="stats"><span>Health <b>${def.hp}</b></span><span>Damage <b>${dmg}</b></span><span>Range <b>${range}</b></span><span>Speed <b>${def.speed ? def.speed.toFixed(1) : 'Static'}</b></span>${def.armor ? `<span>Armour <b>${Math.round(def.armor * 100)}%</b></span>` : ''}${def.shield ? '<span><b>Shield</b></span>' : ''}</div>`;
  el.classList.remove('hidden');
}

// ---------------------------------------------------------------- kill feed
export function feed(ev, team0Name = 'Blue') {
  if (!save.settings.killFeed) return;
  const box = $('feed');
  const k = ev.killer, v = ev.victim;
  const d = document.createElement('div');
  const name = (u) => `<span class="${u.team ? 'r' : 'b'}">${u.def.name}</span>`;
  d.innerHTML = k && k !== v ? `${name(k)}<span class="x">✖</span>${name(v)}` : `${name(v)}<span class="x">✖</span>`;
  box.prepend(d);
  while (box.children.length > 6) box.lastChild.remove();
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 400); }, 3500);
  void team0Name;
}
export function clearFeed() { $('feed').innerHTML = ''; }

// ---------------------------------------------------------------- results
export function showResults(r) {
  // r: { title, cls, stars (null = hide), stats: [[label, value]], mvp: unit|null, next, retry, leaveLabel }
  const panel = document.querySelector('#scr-results .result');
  panel.className = 'panel result ' + r.cls;
  $('res-title').textContent = r.title;
  $('res-stars').innerHTML = r.stars == null ? '' : [0, 1, 2].map((i) => `<span class="${i < r.stars ? 'on' : ''}">★</span>`).join('');
  const mvp = $('res-mvp');
  mvp.innerHTML = '';
  if (r.mvp) {
    mvp.appendChild(img(r.mvp.type, ''));
    mvp.insertAdjacentHTML('beforeend', `<div><div class="lbl">MVP</div><div class="nm">${r.mvp.def.name} · ${r.mvp.kills} kill${r.mvp.kills === 1 ? '' : 's'}</div></div>`);
  }
  $('res-stats').innerHTML = r.stats.map(([a, b]) => `${a}: <b>${b}</b>`).join('<br>');
  $('res-next').classList.toggle('hidden', !r.next);
  $('res-next').textContent = r.nextLabel || 'Next';
  $('res-leave').textContent = r.leaveLabel || 'Levels';
  $('res-retry').textContent = r.retryLabel || 'Retry';
  show('scr-results');
}

// ---------------------------------------------------------------- map picker
export function renderBiomes(current, onPick) {
  const grid = $('biome-grid');
  grid.innerHTML = '';
  for (const k of BIOME_KEYS) {
    const B = BIOMES[k];
    const b = document.createElement('button');
    b.className = 'biome' + (k === current ? ' on' : '');
    b.style.background = B.sky;
    b.innerHTML = `${B.name}<div class="sw"><i style="background:${B.grass[0]}"></i><i style="background:${B.rock}"></i><i style="background:${B.sand}"></i>${B.water !== null ? `<i style="background:${B.waterColor}"></i>` : ''}</div>`;
    if (k === 'alien') b.style.color = '#fff';
    b.onclick = () => onPick(k);
    grid.appendChild(b);
  }
}

// ---------------------------------------------------------------- settings
export function bindSettings(onChange) {
  const s = save.settings;
  const q = $('set-quality'), sh = $('set-shadows'), vol = $('set-volume'), hp = $('set-hp'), fd = $('set-feed'), fps = $('set-fps'), cap = $('set-cap'), cor = $('set-corpses');
  q.value = s.quality; sh.checked = s.shadows; vol.value = s.volume; hp.checked = s.healthBars; fd.checked = s.killFeed; fps.checked = s.fps;
  cap.value = String(s.unitCap); cor.value = String(s.corpses);
  const upd = () => {
    s.quality = q.value; s.shadows = sh.checked; s.volume = +vol.value; s.healthBars = hp.checked; s.killFeed = fd.checked; s.fps = fps.checked;
    s.unitCap = +cap.value; s.corpses = +cor.value;
    onChange();
  };
  for (const el of [q, sh, vol, hp, fd, fps, cap, cor]) el.addEventListener('input', upd);
}

export function setBoot(p) {
  const bar = document.querySelector('.boot-bar i');
  if (bar) bar.style.width = `${Math.round(p * 100)}%`;
}
export function hideBoot() {
  const b = $('boot');
  b.style.opacity = '0';
  setTimeout(() => b.classList.add('hidden'), 300);
}
