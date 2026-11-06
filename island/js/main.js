import { TILES, PORTS, SATELLITES, TOUR } from './data.js';
import { loadAplus, loadPorts, loadCharity } from './content.js';

const $ = (selector) => document.querySelector(selector);
const SCENE_TIMEOUT_MS = 15000;
const TOUR_KEY = 'aplus-island-tour-seen';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const clickable = TILES.filter((tile) => tile.status !== 'reserved');
let island = null;
let aplus = null;
let ports = null;
let charity = null;
let contentError = false;
let activeId = null;

/* ---------- 文字清單 ---------- */

function listGroup(title, items) {
  const section = el('section', 'list-group');
  section.append(el('h2', '', title));
  const ul = el('ul');
  for (const node of items) {
    const li = el('li');
    li.append(node);
    ul.append(li);
  }
  section.append(ul);
  return section;
}

function listButton(text, kind, id) {
  const button = el('button', 'list-item', text);
  button.type = 'button';
  button.dataset.id = id;
  button.addEventListener('click', () => {
    setDrawer(false);
    pick(kind, id);
  });
  return button;
}

function listLink(sat) {
  const link = el('a', 'list-item', sat.name);
  link.href = sat.link;
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

function buildList() {
  const home = clickable.filter((tile) => tile.status === 'full');
  const land = clickable.filter((tile) => tile.status === 'empty');
  $('#list-body').append(
    listGroup('精神之塔', home.map((tile) => listButton(tile.name, 'tile', tile.id))),
    listGroup('功能區', land.map((tile) => listButton(tile.name, 'tile', tile.id))),
    listGroup('飛艇停靠站', PORTS.map((port) => listButton(port.name, 'port', port.id))),
    listGroup('衛星', SATELLITES.map(listLink)),
  );
}

function setDrawer(open) {
  $('#list').classList.toggle('is-open', open);
  $('#list-toggle').setAttribute('aria-expanded', String(open));
}

/* ---------- 卡片 ---------- */

function openCard(node, wide) {
  const card = $('#card');
  const body = $('#card-body');
  body.replaceChildren(node);
  body.scrollTop = 0;
  card.classList.toggle('is-wide', wide);
  card.hidden = false;
  $('#card-close').focus({ preventScroll: true });
  syncInset();
}

function closeCard() {
  $('#card').hidden = true;
  activeId = null;
  markActive();
  island?.select(null);
  syncInset();
}

function syncInset() {
  if (!island) return;
  const card = $('#card');
  if (card.hidden) {
    island.setInset(0, 0);
    return;
  }
  const rect = card.getBoundingClientRect();
  if (window.matchMedia('(min-width: 900px)').matches) island.setInset(rect.width + 24, 0);
  else island.setInset(0, Math.min(rect.height, window.innerHeight * 0.5));
}

function markActive() {
  document.querySelectorAll('.list-item[data-id]').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.id === activeId);
  });
}

function simpleCard(tile) {
  const wrap = el('div', 'simple');
  wrap.append(el('h2', 'card-title', tile.name), el('p', 'simple-line', tile.line));
  const links = tile.links || [{ label: '前往', href: tile.link }];
  const row = el('div', 'card-buttons');
  for (const { label, href } of links) {
    const button = el('a', 'button', label);
    button.href = href;
    button.target = '_blank';
    button.rel = 'noopener';
    row.append(button);
  }
  wrap.append(row);
  return wrap;
}

function portCard(port) {
  const wrap = el('div', 'simple');
  const data = ports?.[port.id];
  if (!data) {
    wrap.append(el('h2', 'card-title', port.name), el('p', 'simple-line', '資料載入失敗，請重新整理。'));
    return wrap;
  }
  wrap.append(el('h2', 'card-title', data.title));
  const dl = el('dl', 'port');
  dl.append(el('dt', '', data.addressLabel));
  for (const line of data.address) dl.append(el('dd', '', line));
  dl.append(el('dt', '', data.hoursLabel));
  for (const line of data.hours) dl.append(el('dd', '', line));
  wrap.append(dl);
  for (const line of data.notes) wrap.append(el('p', 'note', line));
  return wrap;
}

function personBlock(person) {
  const block = el('article', 'person');
  if (person.tag) block.append(el('p', 'person-tag', person.tag));
  block.append(el('h4', 'person-name', person.name));
  const ul = el('ul', 'person-titles');
  for (const title of person.titles) ul.append(el('li', '', title));
  block.append(ul);
  if (person.motto) block.append(el('p', 'person-motto', person.motto));
  return block;
}

function originPanel(data) {
  const panel = el('div');
  for (const motto of data.mottos) panel.append(el('p', 'motto', motto));
  panel.append(el('h3', 'section-title', data.originTitle));
  for (const line of data.origin) panel.append(el('p', 'prose', line));
  return panel;
}

function leadersPanel(data) {
  const panel = el('div');
  panel.append(
    el('h3', 'section-title', data.founderTitle), personBlock(data.founder),
    el('h3', 'section-title', data.coFounderTitle), personBlock(data.coFounder),
    ...data.leaders.map(personBlock),
  );
  return panel;
}

function charterPanel(data) {
  const panel = el('div');
  panel.append(el('h3', 'section-title', data.charterTitle));
  const ol = el('ol', 'charter');
  for (const line of data.charter) ol.append(el('li', '', line));
  panel.append(ol);
  return panel;
}

function timelinePanel(data) {
  const panel = el('div');
  panel.append(el('h3', 'section-title', data.timelineTitle));
  const list = el('div', 'timeline');
  for (const { year, events } of data.timeline) {
    const row = el('section', 'timeline-year');
    row.append(el('h4', 'timeline-label', year));
    for (const event of events) row.append(el('p', 'timeline-event', event));
    list.append(row);
  }
  panel.append(list);
  return panel;
}

function charityPanel(data) {
  const panel = el('div');
  panel.append(el('h3', 'section-title', data.title));
  for (const line of data.lines) panel.append(el(line.startsWith('支持對象') ? 'h4' : 'p', line.startsWith('支持對象') ? 'timeline-label' : 'prose', line));
  return panel;
}

function homeCard() {
  const wrap = el('div', 'home');
  if (!aplus) {
    wrap.append(el('p', 'simple-line', contentError ? '資料載入失敗，請重新整理。' : '載入中'));
    return wrap;
  }
  wrap.append(el('h2', 'card-title', aplus.title));
  const tabs = [
    ['起源', originPanel(aplus)],
    ['領袖', leadersPanel(aplus)],
    ['典章', charterPanel(aplus)],
    ['大記事', timelinePanel(aplus)],
    ...(charity ? [['公益', charityPanel(charity)]] : []),
  ];
  const tablist = el('div', 'tabs');
  tablist.setAttribute('role', 'tablist');
  const buttons = tabs.map(([label, panel], index) => {
    const button = el('button', 'tab', label);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    panel.setAttribute('role', 'tabpanel');
    panel.className = 'tab-panel';
    panel.hidden = index !== 0;
    button.setAttribute('aria-selected', String(index === 0));
    button.addEventListener('click', () => {
      tabs.forEach(([, other], i) => {
        other.hidden = i !== index;
        buttons[i].setAttribute('aria-selected', String(i === index));
      });
      $('#card-body').scrollTop = 0;
    });
    tablist.append(button);
    return button;
  });
  wrap.append(tablist, ...tabs.map(([, panel]) => panel));
  return wrap;
}

function pick(kind, id) {
  activeId = id;
  markActive();
  island?.select(id);
  if (kind === 'port') {
    openCard(portCard(PORTS.find((port) => port.id === id)), false);
    return;
  }
  const tile = TILES.find((item) => item.id === id);
  if (tile.status === 'full') openCard(homeCard(), true);
  else openCard(simpleCard(tile), false);
}

/* ---------- 第一次進站導覽 ---------- */

function tourSeen() {
  try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return false; }
}

function rememberTour() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* 無痕模式：下次再顯示 */ }
}

function startTour() {
  if (tourSeen()) return;
  let step = 0;
  const tour = $('#tour');
  const finish = () => { tour.hidden = true; rememberTour(); };
  const show = () => {
    $('#tour-count').textContent = `${step + 1} / ${TOUR.length}`;
    $('#tour-text').textContent = TOUR[step];
    $('#tour-next').textContent = step === TOUR.length - 1 ? '開始' : '下一步';
  };
  $('#tour-skip').addEventListener('click', finish);
  $('#tour-next').addEventListener('click', () => {
    step += 1;
    if (step >= TOUR.length) finish();
    else show();
  });
  show();
  tour.hidden = false;
}

/* ---------- 啟動 ---------- */

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function useTextMode() {
  document.body.classList.add('no-3d');
  setDrawer(true);
  $('#stage').hidden = true;
  $('#text-mode-note').hidden = false;
}

async function startScene() {
  if (!webglAvailable()) return false;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('scene timeout')), SCENE_TIMEOUT_MS);
  });
  try {
    const { createIsland } = await Promise.race([import('./scene.js'), timeout]);
    island = createIsland({
      stage: $('#stage'),
      onPick: pick,
      onBackground: closeCard,
    });
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function start() {
  buildList();
  $('#card-close').addEventListener('click', closeCard);
  $('#list-toggle').addEventListener('click', () => {
    setDrawer(!$('#list').classList.contains('is-open'));
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#card').hidden) closeCard();
  });
  window.addEventListener('resize', syncInset);

  try {
    [aplus, ports, charity] = await Promise.all([loadAplus(), loadPorts(PORTS), loadCharity()]);
  } catch (error) {
    console.error(error);
    contentError = true;
  }
  const has3d = await startScene();
  if (!has3d) useTextMode();
  $('#loader').hidden = true;
  if (has3d) startTour();
}

start();
