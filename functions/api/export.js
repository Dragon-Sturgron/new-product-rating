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

const REMARK_COLUMN_INDEX = 9;
const EXPORT_COLUMN_WIDTHS = [8, 10, 7, 8, 11, 11, 11, 11, 16, 18, 13, 13, 13, 9, 20, 18, 18];

function worksheetXml(rows) {
  const sheetData = rows.map((row, rowIndex) => {
    const r = rowIndex + 1;
    const remarkText = String(row?.[REMARK_COLUMN_INDEX] ?? '');
    const rowAttr = rowIndex === 0
      ? `r="${r}" ht="34" customHeight="1"`
      : (remarkText ? `r="${r}" ht="42" customHeight="1"` : `r="${r}"`);
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${r}`;
      const text = xmlEscape(value);
      const styleIndex = rowIndex === 0 ? 1 : (colIndex === REMARK_COLUMN_INDEX ? 2 : 0);
      return `<c r="${ref}" t="inlineStr" s="${styleIndex}"><is><t xml:space="preserve">${text}</t></is></c>`;
    }).join('');
    return `<row ${rowAttr}>${cells}</row>`;
  }).join('');
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const cols = colCount ? `<cols>${Array.from({ length: colCount }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${EXPORT_COLUMN_WIDTHS[i] || 8}" customWidth="1"/>`).join('')}</cols>` : '';
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
  <fonts count="2">
    <font><sz val="11"/><name val="Microsoft YaHei"/></font>
    <font><b/><sz val="11"/><name val="Microsoft YaHei"/></font>
  </fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`;
}


const SUMMARY_COLUMN_WIDTHS = [13, 16, 10, 15, 15, 15, 15, 20, 11, 30, 18];
const SUMMARY_MAIN_LABELS = ['价格竞争力', '外观设计', '工艺细节', '容量收纳', '背负舒适度、材质触感'];

function summaryStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Microsoft YaHei"/></font>
    <font><b/><sz val="11"/><name val="Microsoft YaHei"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF000000"/></left>
      <right style="thin"><color rgb="FF000000"/></right>
      <top style="thin"><color rgb="FF000000"/></top>
      <bottom style="thin"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="11">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="0"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="0"/></xf>
  </cellXfs>
</styleSheet>`;
}

function scoreRuleLine(gradeRules, maxTotal = 50) {
  const rules = Array.isArray(gradeRules?.rules) ? gradeRules.rules.slice().sort((a, b) => Number(b.min_percent || 0) - Number(a.min_percent || 0)) : [];
  if (!rules.length) return String(gradeRules?.description || '');
  const max = Number(maxTotal) || 50;
  const point = percent => Math.round((max * Number(percent || 0) / 100) * 10) / 10;
  const fmt = value => Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, '');
  const parts = [];
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const lower = point(rule.min_percent);
    if (i === 0) parts.push(`${fmt(max)}-${fmt(lower)}分${rule.label}`);
    else if (i < rules.length - 1) parts.push(`${fmt(point(rules[i - 1].min_percent))}-${fmt(lower)}分${rule.label}`);
    else parts.push(`${fmt(point(rules[i - 1].min_percent))}分以下${rule.label}`);
  }
  return parts.join('、');
}

function compactDateLabel(values = []) {
  const list = Array.from(new Set(values.filter(Boolean))).sort();
  const latest = list[list.length - 1] || '';
  if (!latest) return '';
  const m = String(latest).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(latest);
  return `${Number(m[2])}月${Number(m[3])}日`;
}

function estimateWrappedLines(value, width = 12) {
  const text = String(value ?? '');
  if (!text) return 1;
  const charsPerLine = Math.max(4, Math.floor(Number(width || 12) * 0.9));
  return text.split('\n').reduce((total, part) => {
    const length = Array.from(part || ' ').reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 1 : 0.55), 0);
    return total + Math.max(1, Math.ceil(length / charsPerLine));
  }, 0);
}

function adaptiveRowHeight(values = [], widths = [], { min = 20, max = 90, lineHeight = 16, padding = 8 } = {}) {
  let lines = 1;
  values.forEach((value, index) => {
    lines = Math.max(lines, estimateWrappedLines(value, widths[index] || 12));
  });
  return Math.max(min, Math.min(max, padding + lines * lineHeight));
}

function summaryCellXml(ref, value, style = 0, numeric = false) {
  if (numeric && value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value))) {
    return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function summaryWorksheetXml(dataRows, metadata, hasDrawing) {
  const reviewerText = String(metadata.reviewers || '').split('、').map(item => item.trim()).filter(Boolean).join('、');
  const top1Cells = [
    summaryCellXml('B1', '评分人', 1),
    summaryCellXml('C1', reviewerText, 9),
    summaryCellXml('I1', '评分日期', 1),
    summaryCellXml('J1', metadata.dateLabel || '', 10)
  ].join('');
  const top2Cells = [
    summaryCellXml('G2', metadata.ruleLine || '', 9)
  ].join('');
  const headers = [
    '图片', '款式编码', '价格', '综合评分-\n价格竞争力', '综合评分-\n外观设计', '综合评分-\n工艺细节',
    '综合评分-\n容量收纳', '综合评分-\n背负舒适度、材质触感', '平均分', '备注', '设计师宣讲\n平均分'
  ];
  const headerCells = headers.map((value, i) => summaryCellXml(`${columnName(i)}3`, value, (i === 8 || i === 10) ? 5 : 4)).join('');

  // 评分人和评分规则都按单行显示，不自动换行，因此顶部两行保持紧凑固定高度。
  const top1Height = 22;
  const top2Height = 22;
  const headerHeight = adaptiveRowHeight(headers, SUMMARY_COLUMN_WIDTHS, { min: 34, max: 54, lineHeight: 16, padding: 8 });

  const bodyRows = dataRows.map((row, index) => {
    const r = index + 4;
    const cells = row.values.map((value, i) => {
      const yellow = i === 8 || i === 10;
      const remark = i === 9;
      const style = yellow ? 7 : (remark ? 8 : 6);
      const numeric = [2,3,4,5,6,7,8,10].includes(i);
      return summaryCellXml(`${columnName(i)}${r}`, value, style, numeric);
    }).join('');
    const contentHeight = adaptiveRowHeight(row.values, SUMMARY_COLUMN_WIDTHS, { min: 24, max: 110, lineHeight: 15, padding: 8 });
    const rowHeight = Math.max(56, contentHeight); // product image needs roughly 56pt; longer remarks can expand naturally
    return `<row r="${r}" ht="${rowHeight}" customHeight="1">${cells}</row>`;
  }).join('');
  const cols = `<cols>${SUMMARY_COLUMN_WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  const drawing = hasDrawing ? '<drawing r:id="rId1"/>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  ${cols}
  <sheetData>
    <row r="1" ht="${top1Height}" customHeight="1">${top1Cells}</row>
    <row r="2" ht="${top2Height}" customHeight="1">${top2Cells}</row>
    <row r="3" ht="${headerHeight}" customHeight="1">${headerCells}</row>
    ${bodyRows}
  </sheetData>
  <pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
  ${drawing}
</worksheet>`;
}

function summaryContentTypesXml(images = []) {
  const extensions = new Map();
  for (const image of images) extensions.set(image.ext, image.contentType);
  const imageDefaults = Array.from(extensions.entries()).map(([ext, type]) => `<Default Extension="${ext}" ContentType="${type}"/>`).join('\n  ');
  const drawingOverride = images.length ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageDefaults}
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${drawingOverride}
</Types>`;
}

function summarySheetRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;
}

function summaryDrawingXml(images = []) {
  const anchors = images.map((image, index) => {
    const rid = `rId${index + 1}`;
    const id = index + 1;
    const row = image.dataRowIndex + 3; // zero-based Excel row: data starts at row 4
    return `<xdr:oneCellAnchor>
      <xdr:from><xdr:col>0</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>47625</xdr:rowOff></xdr:from>
      <xdr:ext cx="952500" cy="666750"/>
      <xdr:pic>
        <xdr:nvPicPr><xdr:cNvPr id="${id}" name="产品图 ${id}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
        <xdr:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
        <xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="666750"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln></xdr:spPr>
      </xdr:pic>
      <xdr:clientData/>
    </xdr:oneCellAnchor>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
}

function summaryDrawingRelsXml(images = []) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${images.map((image, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${image.filename}"/>`).join('\n  ')}
</Relationships>`;
}

async function fetchSummaryImages(dataRows, requestUrl) {
  const images = [];
  for (let i = 0; i < dataRows.length; i += 1) {
    const rawValue = String(dataRows[i].imageUrl || '').trim();
    const raw = rawValue.replace(/^http:\/\/xianglu\.dragon-sturgeon\.cn/i, 'https://xianglu.dragon-sturgeon.cn');
    if (!raw) continue;
    try {
      const target = new URL(raw, requestUrl).toString();
      const response = await fetch(target, { headers: { accept: 'image/png,image/jpeg,image/jpg,*/*;q=0.5' } });
      if (!response.ok) continue;
      const contentTypeRaw = String(response.headers.get('content-type') || '').toLowerCase();
      let ext = '';
      let contentType = '';
      if (contentTypeRaw.includes('png')) { ext = 'png'; contentType = 'image/png'; }
      else if (contentTypeRaw.includes('jpeg') || contentTypeRaw.includes('jpg')) { ext = 'jpg'; contentType = 'image/jpeg'; }
      else {
        const pathname = new URL(target).pathname.toLowerCase();
        if (/\.png$/.test(pathname)) { ext = 'png'; contentType = 'image/png'; }
        else if (/\.jpe?g$/.test(pathname)) { ext = 'jpg'; contentType = 'image/jpeg'; }
        else if (/\.webp$/.test(pathname)) { ext = 'webp'; contentType = 'image/webp'; }
      }
      if (!ext) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) continue;
      const filename = `image${images.length + 1}.${ext}`;
      images.push({ filename, ext, contentType, bytes, dataRowIndex: i });
    } catch (_) {}
  }
  return images;
}

async function buildSummaryXlsx(dataRows, metadata, requestUrl) {
  const images = await fetchSummaryImages(dataRows, requestUrl);
  const files = [
    { name: '[Content_Types].xml', content: summaryContentTypesXml(images) },
    { name: '_rels/.rels', content: rootRelsXml() },
    { name: 'xl/workbook.xml', content: workbookXml() },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml() },
    { name: 'xl/styles.xml', content: summaryStylesXml() },
    { name: 'xl/worksheets/sheet1.xml', content: summaryWorksheetXml(dataRows, metadata, images.length > 0) }
  ];
  if (images.length) {
    files.push({ name: 'xl/worksheets/_rels/sheet1.xml.rels', content: summarySheetRelsXml() });
    files.push({ name: 'xl/drawings/drawing1.xml', content: summaryDrawingXml(images) });
    files.push({ name: 'xl/drawings/_rels/drawing1.xml.rels', content: summaryDrawingRelsXml(images) });
    for (const image of images) files.push({ name: `xl/media/${image.filename}`, content: image.bytes });
  }
  return createZip(files);
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
    let scores = await storage.listScores({
      search: url.searchParams.get('search') || '',
      date_from: url.searchParams.get('date_from') || '',
      date_to: url.searchParams.get('date_to') || '',
      review_link_code: url.searchParams.get('review_link_code') || '',
      limit: '10000'
    });
    const selectedScoreIds = new Set(String(url.searchParams.get('score_ids') || '').split(',').map(item => item.trim()).filter(Boolean));
    const selectedSubmissionIds = new Set(String(url.searchParams.get('submission_ids') || '').split(',').map(item => item.trim()).filter(Boolean));
    if (selectedScoreIds.size || selectedSubmissionIds.size) {
      scores = scores.filter(score => selectedScoreIds.has(String(score.id)) || selectedSubmissionIds.has(String(score.submission_id || '')));
    }
    const gradeRules = storage.getGradeRules ? await storage.getGradeRules() : undefined;
    const fixedScoreColumns = [
      '价格竞争力',
      '外观设计',
      '工艺细节',
      '容量收纳',
      '背负舒适度、材质触感',
      '设计师宣讲'
    ];

    function normalizeExportLabel(value) {
      return String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/，/g, '、')
        .replace(/、/g, '、');
    }
    function findScoreValue(score, label) {
      const target = normalizeExportLabel(label);
      const item = (score.score_items || []).find(entry => normalizeExportLabel(entry.label) === target);
      return item ? item.score : '';
    }
    function findSystemTotal(score, label) {
      const target = normalizeExportLabel(label).replace(/总分$/, '');
      const systems = scoreSystemSummaries(score.score_items || [], gradeRules);
      const item = systems.find(entry => normalizeExportLabel(entry.label) === target || normalizeExportLabel(entry.id) === target);
      return item ? `${item.total}/${item.max}` : '';
    }

    function averageNumbers(values) {
      const nums = values.map(value => Number(value)).filter(value => Number.isFinite(value));
      if (!nums.length) return '';
      const avg = nums.reduce((sum, value) => sum + value, 0) / nums.length;
      return (Math.round((avg + Number.EPSILON) * 10) / 10).toFixed(1);
    }
    function findSystemTotalNumber(score, label) {
      const target = normalizeExportLabel(label).replace(/总分$/, '').replace(/平均分$/, '');
      const systems = scoreSystemSummaries(score.score_items || [], gradeRules);
      const item = systems.find(entry => normalizeExportLabel(entry.label) === target || normalizeExportLabel(entry.id) === target);
      return item ? Number(item.total || 0) : null;
    }
    function scoreDate(score) {
      const raw = String(score.review_date || score.submitted_at || score.created_at || '').trim();
      return raw ? raw.slice(0, 10) : '';
    }
    function buildSummaryGroups(items) {
      const groups = new Map();
      for (const score of items || []) {
        const styleId = String(score.style_id || '').trim();
        const styleCode = String(score.style_code || '').trim();
        const key = styleId ? `id:${styleId}` : `code:${styleCode}`;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            product_image: score.product_image || '',
            style_code: styleCode,
            season: score.season || '',
            base_price: score.base_price ?? '',
            scores: [],
            reviewers: new Set(),
            reviewLinks: new Set(),
            dates: new Set(),
            remarksByReviewer: new Map()
          });
        }
        const group = groups.get(key);
        group.scores.push(score);
        if (!group.product_image && score.product_image) group.product_image = score.product_image;
        if (!group.season && score.season) group.season = score.season;
        if ((group.base_price === '' || group.base_price == null) && score.base_price != null) group.base_price = score.base_price;
        const reviewer = String(score.reviewer || '').trim();
        const reviewLink = String(score.review_link_code || '').trim();
        const date = scoreDate(score);
        const remark = String(score.remark || '').trim();
        if (reviewer) group.reviewers.add(reviewer);
        if (reviewLink) group.reviewLinks.add(reviewLink);
        if (date) group.dates.add(date);
        if (remark) {
          const reviewerLabel = reviewer || '未命名';
          if (!group.remarksByReviewer.has(reviewerLabel)) group.remarksByReviewer.set(reviewerLabel, []);
          const reviewerRemarks = group.remarksByReviewer.get(reviewerLabel);
          if (!reviewerRemarks.includes(remark)) reviewerRemarks.push(remark);
        }
      }
      return Array.from(groups.values());
    }

    const mode = String(url.searchParams.get('mode') || 'detail').toLowerCase();
    let headers;
    let rows;
    let filename;
    let fallbackFilename;

    if (mode === 'summary') {
      
      const groups = buildSummaryGroups(scores);

      // 汇总导出图片：优先从已配置款式(review_styles)读取产品图
      // 避免评分记录中没有 product_image 导致导出无图片
      try {
        const styles = await storage.listStyles({});
        const imageMap = new Map();
        for (const style of (styles || [])) {
          const code = String(
            style.style_code ||
            style.styleCode ||
            style.code ||
            ''
          ).trim();
          if (!code) continue;

          imageMap.set(code, String(
            style.product_image ||
            style.productImage ||
            style.productImageUrl ||
            style.image_url ||
            style.imageUrl ||
            style.image ||
            style.pic ||
            style.photo ||
            ''
          ).trim());
        }
        for (const group of groups) {
          const image = imageMap.get(String(group.style_code || '').trim());
          if (image) {
            group.product_image = image;
          }

          // 兼容历史数据中 http 地址和路径地址
          if (group.product_image) {
            group.product_image = String(group.product_image).trim();
            if (group.product_image.startsWith('http://')) {
              group.product_image = group.product_image.replace(/^http:\/\//i, 'https://');
            }
          }
        }
      } catch (e) {
        console.error('summary export load product images failed', e);
      }

      const summaryRows = groups.map(group => {
        const averageItemNumber = label => {
          const values = group.scores.map(score => findScoreValue(score, label)).filter(value => value !== '' && value != null).map(Number).filter(Number.isFinite);
          if (!values.length) return '';
          return Math.round(((values.reduce((sum, value) => sum + value, 0) / values.length) + Number.EPSILON) * 10) / 10;
        };
        const itemAverages = SUMMARY_MAIN_LABELS.map(label => averageItemNumber(label));
        const validMain = itemAverages.filter(value => value !== '' && value != null && Number.isFinite(Number(value)));
        const totalAverage = validMain.length ? Math.round((validMain.reduce((sum, value) => sum + Number(value), 0) + Number.EPSILON) * 10) / 10 : '';
        const designerAverage = averageItemNumber('设计师宣讲');
        return {
          imageUrl: group.product_image,
          values: [
            '',
            group.style_code,
            group.base_price,
            ...itemAverages,
            totalAverage,
            Array.from(group.remarksByReviewer.entries()).map(([reviewer, remarks]) => `${reviewer}：${remarks.join('；')}`).join('\n'),
            designerAverage
          ]
        };
      });
      const allReviewers = Array.from(new Set(scores.map(score => String(score.reviewer || '').trim()).filter(Boolean)));
      const allDates = scores.map(scoreDate).filter(Boolean);
      const mainMax = (() => {
        const first = groups.flatMap(group => group.scores || [])[0];
        if (!first) return 50;
        const values = SUMMARY_MAIN_LABELS.map(label => {
          const target = normalizeExportLabel(label);
          const item = (first.score_items || []).find(entry => normalizeExportLabel(entry.label) === target);
          return item ? normalizeMaxScore(item.max_score) : 10;
        });
        return values.reduce((sum, value) => sum + Number(value || 0), 0) || 50;
      })();
      const metadata = {
        reviewers: allReviewers.join('、'),
        dateLabel: compactDateLabel(allDates),
        ruleLine: scoreRuleLine(gradeRules, mainMax)
      };
      const xlsx = await buildSummaryXlsx(summaryRows, metadata, request.url);
      filename = '评分结果-汇总平均.xlsx';
      fallbackFilename = 'score-results-summary.xlsx';
      const encodedFilename = encodeURIComponent(filename);
      return new Response(xlsx, {
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
          'cache-control': 'no-store'
        }
      });
    } else {
      headers = [
        '产品图',
        '款式编码',
        '季节',
        '基本售价',
        '价格竞争力',
        '外观设计',
        '工艺细节',
        '容量收纳',
        '背负舒适度、材质触感',
        '备注',
        '设计师宣讲',
        '综合评分总分',
        '独立评分总分',
        '评分人',
        '评分链接',
        '评分日期'
      ];
      rows = scores.map(score => [
        score.product_image,
        score.style_code,
        score.season,
        score.base_price,
        ...fixedScoreColumns.slice(0, 5).map(label => findScoreValue(score, label)),
        score.remark,
        findScoreValue(score, '设计师宣讲'),
        findSystemTotal(score, '综合评分总分'),
        findSystemTotal(score, '独立评分总分'),
        score.reviewer,
        score.review_link_code || '',
        score.review_date || score.created_at || ''
      ]);
      filename = '评分结果.xlsx';
      fallbackFilename = 'score-results.xlsx';
    }

    const xlsx = buildXlsx([headers, ...rows]);
    const encodedFilename = encodeURIComponent(filename);
    return new Response(xlsx, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
        'cache-control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(e.message || '导出失败', { status: 500 });
  }
}


// ===== 汇总平均导出图片目录支持 =====
// 根据款式编码反查已配置款式图片，导出到 ZIP/产品图片目录
async function resolveSummaryStyleImage(styleCode, styles = []) {
    if (!styleCode) return null;

    const item = styles.find(s =>
        String(s.style_code || s.code || s.styleCode || '').trim() === String(styleCode).trim()
    );

    if (!item) return null;

    let url = item.product_image || item.image || item.productImage || '';
    if (!url) return null;

    if (url.startsWith('http://xianglu.dragon-sturgeon.cn')) {
        url = url.replace('http://', 'https://');
    }

    if (url.startsWith('/')) {
        url = 'https://xianglu.dragon-sturgeon.cn' + url;
    }

    return url;
}
