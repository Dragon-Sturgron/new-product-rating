import { getStorage, gradeByScore } from '../_shared/storage.js';

const encoder = new TextEncoder();

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeMaxScore(value) {
  const n = Number.parseInt(value ?? 10, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.max(1, Math.min(100, n));
}
function scoreTypeId(item) {
  return String(item?.score_type || item?.type || 'main').trim() || 'main';
}
function scoreTypeLabel(item) {
  return String(item?.score_type_label || item?.type_label || scoreTypeId(item)).trim() || scoreTypeId(item);
}
function scoreSystemSummaries(items = [], gradeRules) {
  const groups = new Map();
  for (const item of items || []) {
    const id = scoreTypeId(item);
    if (!groups.has(id)) groups.set(id, { id, label: scoreTypeLabel(item), total: 0, max: 0 });
    const group = groups.get(id);
    group.total += Number(item.score || 0);
    group.max += normalizeMaxScore(item.max_score);
  }
  return Array.from(groups.values()).map(group => ({ ...group, text: `${group.total}/${group.max} ${gradeByScore(group.total, group.max, gradeRules)}` }));
}

function columnName(index) {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function worksheetXml(rows) {
  const sheetData = rows.map((row, rowIndex) => {
    const r = rowIndex + 1;
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${r}`;
      const text = xmlEscape(value);
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
    }).join('');
    return `<row r="${r}">${cells}</row>`;
  }).join('');
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const cols = colCount ? `<cols>${Array.from({ length: colCount }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i < 4 ? 18 : 16}" customWidth="1"/>`).join('')}</cols>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  ${cols}
  <sheetData>${sheetData}</sheetData>
</worksheet>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="评分结果" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Microsoft YaHei"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
</styleSheet>`;
}

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function writeU16(arr, value) { arr.push(value & 255, (value >>> 8) & 255); }
function writeU32(arr, value) { arr.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }
function dosTimeDate(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = Math.max(1980, date.getFullYear()) - 1980;
  return { time, date: (year << 9) | (month << 5) | day };
}
function concatUint8(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dt = dosTimeDate();
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = crc32(dataBytes);
    const local = [];
    writeU32(local, 0x04034b50);
    writeU16(local, 20);
    writeU16(local, 0x0800);
    writeU16(local, 0);
    writeU16(local, dt.time);
    writeU16(local, dt.date);
    writeU32(local, crc);
    writeU32(local, dataBytes.length);
    writeU32(local, dataBytes.length);
    writeU16(local, nameBytes.length);
    writeU16(local, 0);
    const localBytes = concatUint8([new Uint8Array(local), nameBytes, dataBytes]);
    localParts.push(localBytes);

    const central = [];
    writeU32(central, 0x02014b50);
    writeU16(central, 20);
    writeU16(central, 20);
    writeU16(central, 0x0800);
    writeU16(central, 0);
    writeU16(central, dt.time);
    writeU16(central, dt.date);
    writeU32(central, crc);
    writeU32(central, dataBytes.length);
    writeU32(central, dataBytes.length);
    writeU16(central, nameBytes.length);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, 0);
    writeU32(central, offset);
    centralParts.push(concatUint8([new Uint8Array(central), nameBytes]));
    offset += localBytes.length;
  }
  const centralStart = offset;
  const centralBytes = concatUint8(centralParts);
  const end = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0);
  writeU16(end, 0);
  writeU16(end, files.length);
  writeU16(end, files.length);
  writeU32(end, centralBytes.length);
  writeU32(end, centralStart);
  writeU16(end, 0);
  return concatUint8([...localParts, centralBytes, new Uint8Array(end)]);
}

function buildXlsx(rows) {
  return createZip([
    { name: '[Content_Types].xml', content: contentTypesXml() },
    { name: '_rels/.rels', content: rootRelsXml() },
    { name: 'xl/workbook.xml', content: workbookXml() },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml() },
    { name: 'xl/styles.xml', content: stylesXml() },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(rows) }
  ]);
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const storage = getStorage(env);
    const scores = await storage.listScores({
      search: url.searchParams.get('search') || '',
      date_from: url.searchParams.get('date_from') || '',
      date_to: url.searchParams.get('date_to') || '',
      limit: '10000'
    });
    const gradeRules = storage.getGradeRules ? await storage.getGradeRules() : undefined;
    const scoreColumns = [];
    const systemColumns = [];
    for (const score of scores) {
      for (const item of score.score_items || []) {
        const key = `${scoreTypeId(item)}::${item.label}`;
        const title = `${scoreTypeLabel(item)}-${item.label}`;
        if (!scoreColumns.some(col => col.key === key)) scoreColumns.push({ key, title });
      }
      for (const system of scoreSystemSummaries(score.score_items || [], gradeRules)) {
        if (!systemColumns.some(col => col.id === system.id)) systemColumns.push({ id: system.id, title: `${system.label}总分` });
      }
    }
    const headers = ['产品图', '款式编码', '季节', '基本售价', ...scoreColumns.map(col => col.title), ...systemColumns.map(col => col.title), '评分人', '评分日期', '备注', '创建时间'];
    const rows = scores.map(score => {
      const values = Object.fromEntries((score.score_items || []).map(item => [`${scoreTypeId(item)}::${item.label}`, item.score]));
      const systems = Object.fromEntries(scoreSystemSummaries(score.score_items || [], gradeRules).map(item => [item.id, item.text]));
      return [
        score.product_image,
        score.style_code,
        score.season,
        score.base_price,
        ...scoreColumns.map(col => values[col.key] ?? ''),
        ...systemColumns.map(col => systems[col.id] ?? ''),
        score.reviewer,
        score.review_date,
        score.remark,
        score.created_at
      ];
    });
    const xlsx = buildXlsx([headers, ...rows]);
    const encodedFilename = encodeURIComponent('评分结果.xlsx');
    return new Response(xlsx, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="score-results.xlsx"; filename*=UTF-8''${encodedFilename}`,
        'cache-control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(e.message || '导出失败', { status: 500 });
  }
}
