// 讀 data/*.txt 並拆段。這裡只切行、分組，絕不修改任何一個字。

async function loadLines(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const text = await res.text();
  return text.split(/\r?\n/).filter((line) => line !== '' && !line.startsWith('#'));
}

function between(lines, start, end) {
  const from = lines.indexOf(start);
  const to = end ? lines.indexOf(end) : lines.length;
  if (from < 0 || to < 0 || to <= from) throw new Error(`找不到段落：${start}`);
  return lines.slice(from + 1, to);
}

const HONORIFIC = /(小姐|⼩姐|先生|先⽣|賢伉儷)$/;
const isMotto = (line) => line.startsWith('座右銘：');

function person(lines, hasTag) {
  const body = hasTag ? lines.slice(1) : lines;
  return {
    tag: hasTag ? lines[0] : null,
    name: body[0],
    titles: body.slice(1).filter((line) => !isMotto(line)),
    motto: body.find(isMotto) ?? null,
  };
}

// 協辦人之後的區段：協辦人本人沒有標題行，其餘每組以「標題行＋姓名行」開頭。
function splitLeaders(lines) {
  const starts = [];
  for (let i = 1; i < lines.length - 1; i++) {
    if (HONORIFIC.test(lines[i + 1])) starts.push(i);
  }
  const groups = [];
  starts.forEach((start, i) => {
    groups.push(person(lines.slice(start, starts[i + 1] ?? lines.length), true));
  });
  return { coFounder: person(lines.slice(0, starts[0]), false), leaders: groups };
}

function splitTimeline(lines) {
  const years = [];
  for (const line of lines) {
    if (/^\d{4}年$/.test(line)) years.push({ year: line, events: [] });
    else years[years.length - 1].events.push(line);
  }
  return years;
}

export async function loadAplus() {
  const lines = await loadLines('data/aplus.txt');
  const head = lines.slice(0, lines.indexOf('系統起源'));
  const { coFounder, leaders } = splitLeaders(between(lines, '系統協辦人', '系統榮譽典章'));
  return {
    title: head[0],
    mottos: head.slice(1),
    originTitle: '系統起源',
    origin: between(lines, '系統起源', '系統創辦人'),
    founderTitle: '系統創辦人',
    founder: person(between(lines, '系統創辦人', '系統協辦人'), false),
    coFounderTitle: '系統協辦人',
    coFounder,
    leaders,
    charterTitle: '系統榮譽典章',
    charter: between(lines, '系統榮譽典章', '大記事'),
    timelineTitle: '大記事',
    timeline: splitTimeline(between(lines, '大記事', null)),
  };
}

export async function loadPorts(ports) {
  const lines = await loadLines('data/service.txt');
  const sourceTitles = ports.map((port) => port.source);
  const result = {};
  for (const port of ports) {
    const start = lines.indexOf(port.source);
    if (start < 0) throw new Error(`找不到據點：${port.source}`);
    let end = start + 1;
    while (end < lines.length && !sourceTitles.includes(lines[end]) && lines[end] !== '海外據點') end++;
    const block = lines.slice(start + 1, end);
    const hoursAt = block.indexOf('營業時間');
    result[port.id] = {
      title: port.source,
      addressLabel: block[0],
      address: block.slice(1, hoursAt),
      hoursLabel: block[hoursAt],
      hours: block.slice(hoursAt + 1).filter((line) => !line.startsWith('※')),
      notes: block.slice(hoursAt + 1).filter((line) => line.startsWith('※')),
    };
  }
  return result;
}
