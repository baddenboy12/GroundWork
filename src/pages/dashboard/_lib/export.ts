import jsPDF from "jspdf";
import { format } from "date-fns";
import { CATEGORY_LABELS, type LogCategory } from "./constants.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

// ─── Core types ───────────────────────────────────────────────────────────────

type RGB = [number, number, number];

export type Theme = {
  id: string;
  name: string;
  // Cover page
  coverBg: RGB;       // full-bleed cover background
  coverAccent: RGB;   // accent bar / label on cover
  coverTitle: RGB;    // big site-name title
  coverSub: RGB;      // secondary / muted cover text
  // Running header (content pages)
  hdrBg: RGB;
  hdrAccent: RGB;     // 2mm accent strip under header bar
  hdrTitle: RGB;
  hdrSub: RGB;
  // Entry card
  entryBg: RGB;       // card background (light for 'card', dark for 'dark', white for 'plain')
  entryBar: RGB;      // left accent bar / bottom rule color
  entryTitle: RGB;
  entryBody: RGB;
  entryMuted: RGB;
  entryBorder: RGB;   // separator lines
  // Metadata badges
  pillBg: RGB;
  pillText: RGB;
  // Stats box
  statsBg: RGB;
  statsNum: RGB;
  statsSub: RGB;
  // Footer
  ftrBg: RGB;
  ftrText: RGB;
  // Layout variant selectors
  cover: "dark" | "band" | "sidebar";
  entry: "card" | "dark" | "plain";
};

// ─── 20 Themes ────────────────────────────────────────────────────────────────

export const THEMES: Theme[] = [
  // ── Dark cover + light card entries (8 themes) ──────────────────────────────
  {
    id: "midnight", name: "Midnight",
    coverBg: [18,24,38], coverAccent: [245,158,11], coverTitle: [255,255,255], coverSub: [155,170,205],
    hdrBg: [18,24,38], hdrAccent: [245,158,11], hdrTitle: [255,255,255], hdrSub: [145,160,195],
    entryBg: [245,247,250], entryBar: [245,158,11], entryTitle: [18,24,38], entryBody: [45,55,72], entryMuted: [110,125,150], entryBorder: [200,210,225],
    pillBg: [40,50,70], pillText: [195,210,240],
    statsBg: [28,38,58], statsNum: [245,158,11], statsSub: [145,160,195],
    ftrBg: [18,24,38], ftrText: [95,110,140],
    cover: "dark", entry: "card",
  },
  {
    id: "obsidian", name: "Obsidian",
    coverBg: [8,10,15], coverAccent: [59,130,246], coverTitle: [255,255,255], coverSub: [145,160,200],
    hdrBg: [8,10,15], hdrAccent: [59,130,246], hdrTitle: [255,255,255], hdrSub: [135,150,190],
    entryBg: [244,248,255], entryBar: [59,130,246], entryTitle: [10,20,45], entryBody: [28,42,78], entryMuted: [95,115,165], entryBorder: [190,208,245],
    pillBg: [18,32,68], pillText: [175,200,248],
    statsBg: [16,24,50], statsNum: [99,160,255], statsSub: [135,150,195],
    ftrBg: [8,10,15], ftrText: [85,100,140],
    cover: "dark", entry: "card",
  },
  {
    id: "forest", name: "Forest",
    coverBg: [10,30,18], coverAccent: [74,222,128], coverTitle: [255,255,255], coverSub: [130,190,150],
    hdrBg: [12,35,22], hdrAccent: [74,222,128], hdrTitle: [255,255,255], hdrSub: [120,180,142],
    entryBg: [243,252,247], entryBar: [34,197,94], entryTitle: [12,35,20], entryBody: [22,58,35], entryMuted: [72,125,92], entryBorder: [185,235,208],
    pillBg: [20,52,32], pillText: [155,228,185],
    statsBg: [16,45,26], statsNum: [74,222,128], statsSub: [120,180,142],
    ftrBg: [10,30,18], ftrText: [72,125,92],
    cover: "dark", entry: "card",
  },
  {
    id: "crimson", name: "Crimson",
    coverBg: [36,8,12], coverAccent: [251,191,36], coverTitle: [255,255,255], coverSub: [208,158,165],
    hdrBg: [40,10,15], hdrAccent: [251,191,36], hdrTitle: [255,255,255], hdrSub: [198,148,155],
    entryBg: [255,246,248], entryBar: [220,38,38], entryTitle: [55,10,15], entryBody: [78,24,28], entryMuted: [152,78,88], entryBorder: [255,198,205],
    pillBg: [68,14,20], pillText: [255,178,188],
    statsBg: [52,12,18], statsNum: [251,191,36], statsSub: [198,148,155],
    ftrBg: [36,8,12], ftrText: [145,78,88],
    cover: "dark", entry: "card",
  },
  {
    id: "eclipse", name: "Eclipse",
    coverBg: [18,10,38], coverAccent: [167,139,250], coverTitle: [255,255,255], coverSub: [178,162,222],
    hdrBg: [22,12,46], hdrAccent: [167,139,250], hdrTitle: [255,255,255], hdrSub: [168,152,212],
    entryBg: [250,248,255], entryBar: [139,92,246], entryTitle: [24,12,54], entryBody: [38,22,78], entryMuted: [118,98,172], entryBorder: [212,202,250],
    pillBg: [34,18,74], pillText: [198,182,255],
    statsBg: [26,14,58], statsNum: [167,139,250], statsSub: [168,152,212],
    ftrBg: [18,10,38], ftrText: [108,92,162],
    cover: "dark", entry: "card",
  },
  {
    id: "ember", name: "Ember",
    coverBg: [22,14,8], coverAccent: [249,115,22], coverTitle: [255,255,255], coverSub: [208,162,125],
    hdrBg: [26,16,10], hdrAccent: [249,115,22], hdrTitle: [255,255,255], hdrSub: [198,152,115],
    entryBg: [255,251,246], entryBar: [234,88,12], entryTitle: [30,18,8], entryBody: [54,30,14], entryMuted: [152,102,64], entryBorder: [255,218,192],
    pillBg: [44,24,10], pillText: [255,182,135],
    statsBg: [32,18,8], statsNum: [249,115,22], statsSub: [198,152,115],
    ftrBg: [22,14,8], ftrText: [142,92,55],
    cover: "dark", entry: "card",
  },
  {
    id: "ocean", name: "Ocean",
    coverBg: [5,22,45], coverAccent: [34,211,238], coverTitle: [255,255,255], coverSub: [125,182,222],
    hdrBg: [6,26,55], hdrAccent: [34,211,238], hdrTitle: [255,255,255], hdrSub: [115,172,212],
    entryBg: [242,251,255], entryBar: [6,182,212], entryTitle: [5,28,58], entryBody: [10,42,88], entryMuted: [62,128,172], entryBorder: [182,228,250],
    pillBg: [8,38,78], pillText: [155,218,250],
    statsBg: [7,30,62], statsNum: [34,211,238], statsSub: [115,172,212],
    ftrBg: [5,22,45], ftrText: [62,128,172],
    cover: "dark", entry: "card",
  },
  {
    id: "carbon", name: "Carbon",
    coverBg: [12,12,12], coverAccent: [250,204,21], coverTitle: [255,255,255], coverSub: [175,175,175],
    hdrBg: [18,18,18], hdrAccent: [250,204,21], hdrTitle: [255,255,255], hdrSub: [162,162,162],
    entryBg: [248,248,248], entryBar: [234,179,8], entryTitle: [18,18,18], entryBody: [38,38,38], entryMuted: [112,112,112], entryBorder: [212,212,212],
    pillBg: [32,32,32], pillText: [208,208,208],
    statsBg: [24,24,24], statsNum: [250,204,21], statsSub: [162,162,162],
    ftrBg: [12,12,12], ftrText: [100,100,100],
    cover: "dark", entry: "card",
  },

  // ── Light/band cover + card entries (4 themes) ──────────────────────────────
  {
    id: "executive", name: "Executive",
    coverBg: [255,255,255], coverAccent: [18,18,18], coverTitle: [255,255,255], coverSub: [205,205,205],
    hdrBg: [18,18,18], hdrAccent: [200,158,38], hdrTitle: [255,255,255], hdrSub: [172,172,172],
    entryBg: [252,252,252], entryBar: [18,18,18], entryTitle: [14,14,14], entryBody: [38,38,38], entryMuted: [112,112,112], entryBorder: [212,212,212],
    pillBg: [28,28,28], pillText: [208,208,208],
    statsBg: [244,244,244], statsNum: [18,18,18], statsSub: [118,118,118],
    ftrBg: [18,18,18], ftrText: [148,148,148],
    cover: "band", entry: "card",
  },
  {
    id: "blueprint", name: "Blueprint",
    coverBg: [255,255,255], coverAccent: [37,99,235], coverTitle: [255,255,255], coverSub: [178,198,242],
    hdrBg: [28,56,136], hdrAccent: [147,197,253], hdrTitle: [255,255,255], hdrSub: [178,198,242],
    entryBg: [245,249,255], entryBar: [37,99,235], entryTitle: [14,28,74], entryBody: [22,46,108], entryMuted: [88,118,182], entryBorder: [188,208,250],
    pillBg: [28,56,136], pillText: [188,212,255],
    statsBg: [236,245,255], statsNum: [37,99,235], statsSub: [98,128,188],
    ftrBg: [28,56,136], ftrText: [148,172,228],
    cover: "band", entry: "card",
  },
  {
    id: "arctic", name: "Arctic",
    coverBg: [238,248,255], coverAccent: [14,165,233], coverTitle: [255,255,255], coverSub: [178,215,242],
    hdrBg: [5,142,202], hdrAccent: [186,230,253], hdrTitle: [255,255,255], hdrSub: [178,215,242],
    entryBg: [244,252,255], entryBar: [2,132,199], entryTitle: [4,38,62], entryBody: [10,52,82], entryMuted: [58,128,162], entryBorder: [178,228,252],
    pillBg: [10,118,182], pillText: [198,240,255],
    statsBg: [222,242,254], statsNum: [2,132,199], statsSub: [78,148,192],
    ftrBg: [5,142,202], ftrText: [158,212,242],
    cover: "band", entry: "card",
  },
  {
    id: "sand", name: "Sand",
    coverBg: [255,252,238], coverAccent: [118,74,22], coverTitle: [255,255,255], coverSub: [238,212,178],
    hdrBg: [108,66,20], hdrAccent: [218,162,68], hdrTitle: [255,255,255], hdrSub: [232,202,162],
    entryBg: [255,254,248], entryBar: [182,122,42], entryTitle: [54,34,8], entryBody: [74,48,16], entryMuted: [158,122,68], entryBorder: [250,232,192],
    pillBg: [98,60,16], pillText: [248,222,172],
    statsBg: [254,248,226], statsNum: [152,102,28], statsSub: [162,128,72],
    ftrBg: [108,66,20], ftrText: [218,175,118],
    cover: "band", entry: "card",
  },

  // ── Dark cover + dark card entries (4 themes) ───────────────────────────────
  {
    id: "steel", name: "Steel",
    coverBg: [18,32,52], coverAccent: [249,115,22], coverTitle: [255,255,255], coverSub: [138,172,218],
    hdrBg: [22,40,64], hdrAccent: [249,115,22], hdrTitle: [255,255,255], hdrSub: [128,162,208],
    entryBg: [26,48,78], entryBar: [249,115,22], entryTitle: [222,238,255], entryBody: [182,208,244], entryMuted: [118,152,198], entryBorder: [44,68,102],
    pillBg: [40,66,104], pillText: [178,212,250],
    statsBg: [12,22,38], statsNum: [249,115,22], statsSub: [128,162,208],
    ftrBg: [18,32,52], ftrText: [98,132,178],
    cover: "dark", entry: "dark",
  },
  {
    id: "royal", name: "Royal",
    coverBg: [12,18,75], coverAccent: [251,191,36], coverTitle: [255,255,255], coverSub: [158,172,232],
    hdrBg: [14,22,88], hdrAccent: [251,191,36], hdrTitle: [255,255,255], hdrSub: [152,166,228],
    entryBg: [18,28,98], entryBar: [251,191,36], entryTitle: [228,232,255], entryBody: [188,202,248], entryMuted: [128,146,218], entryBorder: [32,48,128],
    pillBg: [28,42,128], pillText: [182,198,255],
    statsBg: [8,12,54], statsNum: [251,191,36], statsSub: [152,166,228],
    ftrBg: [12,18,75], ftrText: [108,128,208],
    cover: "dark", entry: "dark",
  },
  {
    id: "storm", name: "Storm",
    coverBg: [16,22,36], coverAccent: [99,210,255], coverTitle: [255,255,255], coverSub: [142,172,212],
    hdrBg: [20,28,46], hdrAccent: [56,189,248], hdrTitle: [255,255,255], hdrSub: [132,162,202],
    entryBg: [26,36,56], entryBar: [56,189,248], entryTitle: [212,230,255], entryBody: [172,198,238], entryMuted: [108,142,192], entryBorder: [42,58,88],
    pillBg: [36,52,82], pillText: [162,202,248],
    statsBg: [10,14,26], statsNum: [99,210,255], statsSub: [132,162,202],
    ftrBg: [16,22,36], ftrText: [92,126,176],
    cover: "dark", entry: "dark",
  },
  {
    id: "sage", name: "Sage",
    coverBg: [28,46,30], coverAccent: [186,230,135], coverTitle: [255,255,255], coverSub: [152,198,152],
    hdrBg: [34,54,36], hdrAccent: [186,230,135], hdrTitle: [255,255,255], hdrSub: [144,190,144],
    entryBg: [42,66,44], entryBar: [154,205,92], entryTitle: [232,248,228], entryBody: [192,226,188], entryMuted: [132,182,130], entryBorder: [56,84,58],
    pillBg: [54,82,56], pillText: [182,228,172],
    statsBg: [18,32,20], statsNum: [186,230,135], statsSub: [144,190,144],
    ftrBg: [28,46,30], ftrText: [105,162,105],
    cover: "dark", entry: "dark",
  },

  // ── Sidebar cover + editorial plain entries (4 themes) ──────────────────────
  {
    id: "ink", name: "Ink",
    coverBg: [255,255,255], coverAccent: [10,10,10], coverTitle: [10,10,10], coverSub: [88,88,88],
    hdrBg: [10,10,10], hdrAccent: [198,158,38], hdrTitle: [255,255,255], hdrSub: [178,178,178],
    entryBg: [255,255,255], entryBar: [10,10,10], entryTitle: [10,10,10], entryBody: [32,32,32], entryMuted: [108,108,108], entryBorder: [188,188,188],
    pillBg: [14,14,14], pillText: [218,218,218],
    statsBg: [244,244,244], statsNum: [10,10,10], statsSub: [108,108,108],
    ftrBg: [10,10,10], ftrText: [158,158,158],
    cover: "sidebar", entry: "plain",
  },
  {
    id: "copper", name: "Copper",
    coverBg: [255,255,255], coverAccent: [175,96,28], coverTitle: [255,255,255], coverSub: [244,222,196],
    hdrBg: [42,20,6], hdrAccent: [208,128,48], hdrTitle: [255,255,255], hdrSub: [218,172,128],
    entryBg: [255,255,255], entryBar: [182,102,32], entryTitle: [32,16,4], entryBody: [58,30,10], entryMuted: [152,102,62], entryBorder: [228,198,168],
    pillBg: [48,22,6], pillText: [246,212,172],
    statsBg: [250,240,226], statsNum: [172,92,26], statsSub: [158,108,68],
    ftrBg: [42,20,6], ftrText: [198,152,108],
    cover: "sidebar", entry: "plain",
  },
  {
    id: "dusk", name: "Dusk",
    coverBg: [255,255,255], coverAccent: [152,78,118], coverTitle: [255,255,255], coverSub: [248,218,238],
    hdrBg: [98,44,76], hdrAccent: [232,152,192], hdrTitle: [255,255,255], hdrSub: [244,202,228],
    entryBg: [255,255,255], entryBar: [182,98,142], entryTitle: [48,18,36], entryBody: [76,32,56], entryMuted: [158,98,132], entryBorder: [244,202,228],
    pillBg: [98,44,76], pillText: [255,208,238],
    statsBg: [252,242,250], statsNum: [152,78,118], statsSub: [158,98,132],
    ftrBg: [98,44,76], ftrText: [218,162,198],
    cover: "sidebar", entry: "plain",
  },
  {
    id: "mono", name: "Mono",
    coverBg: [248,248,248], coverAccent: [52,52,52], coverTitle: [22,22,22], coverSub: [108,108,108],
    hdrBg: [52,52,52], hdrAccent: [198,198,198], hdrTitle: [255,255,255], hdrSub: [192,192,192],
    entryBg: [255,255,255], entryBar: [52,52,52], entryTitle: [14,14,14], entryBody: [42,42,42], entryMuted: [118,118,118], entryBorder: [198,198,198],
    pillBg: [52,52,52], pillText: [218,218,218],
    statsBg: [238,238,238], statsNum: [42,42,42], statsSub: [112,112,112],
    ftrBg: [52,52,52], ftrText: [178,178,178],
    cover: "sidebar", entry: "plain",
  },
];

export const DEFAULT_THEME_ID = "midnight";

// Per-category pill/bar colours — consistent across themes
const CAT_COLORS: Record<LogCategory, RGB> = {
  inspection: [59, 130, 246],
  maintenance: [245, 158, 11],
  incident: [239, 68, 68],
  audit: [168, 85, 247],
  general: [100, 116, 139],
};

// ─── Document types ───────────────────────────────────────────────────────────

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type GlobalLog = {
  siteName: string;
  title: string;
  content: string;
  category: string;
  authorName: string;
  loggedAt: string;
  location?: string;
  photoUrls: string[];
};

type EntryData = {
  title: string;
  content: string;
  category: string;
  authorName: string;
  loggedAt: string;
  location?: string;
  siteName?: string;   // multi-site only
  photoUrls?: string[];
};

export type ExportOptions = {
  siteName: string;
  siteLocation?: string;
  logs: LogWithAuthor[];
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  theme: Theme;
};

export type GlobalExportOptions = {
  logs: GlobalLog[];
  siteNames: string[];
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  theme: Theme;
};

// ─── Image helpers ────────────────────────────────────────────────────────────

type PhotoInfo = { dataUrl: string; ar: number };

async function fetchPhotoInfo(url: string): Promise<PhotoInfo | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    // Detect natural dimensions to get aspect ratio
    const ar = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth / Math.max(img.naturalHeight, 1));
      img.onerror = () => resolve(4 / 3);
      img.src = dataUrl;
    });
    return { dataUrl, ar };
  } catch {
    return null;
  }
}

function imgFormat(d: string): string {
  return d.startsWith("data:image/png") ? "PNG" : "JPEG";
}

// ─── Photo strip layout (aspect-ratio preserving) ────────────────────────────

const PHOTO_MAX_H = 44; // mm — max height per photo row
const PHOTO_GAP = 3;    // mm between photos horizontally
const PHOTO_ROW_GAP = 4; // mm between rows
const PHOTOS_PER_ROW = 4; // max photos per row

type PhotoStrip = { photos: PhotoInfo[]; widths: number[]; actualH: number; stripH: number };

function calcStrip(photos: PhotoInfo[], areaW: number): PhotoStrip | null {
  if (!photos.length) return null;
  const rawW = photos.map((p) => PHOTO_MAX_H * p.ar);
  const totalRaw = rawW.reduce((s, w) => s + w, 0) + PHOTO_GAP * (photos.length - 1);
  const scale = Math.min(1, areaW / totalRaw);
  const actualH = PHOTO_MAX_H * scale;
  return { photos, widths: rawW.map((w) => w * scale), actualH, stripH: actualH + 8 };
}

// Split photos into multiple rows of up to PHOTOS_PER_ROW each
function calcPhotoRows(photos: PhotoInfo[], areaW: number): PhotoStrip[] {
  if (!photos.length) return [];
  const rows: PhotoStrip[] = [];
  for (let i = 0; i < photos.length; i += PHOTOS_PER_ROW) {
    const chunk = photos.slice(i, i + PHOTOS_PER_ROW);
    const row = calcStrip(chunk, areaW);
    if (row) rows.push(row);
  }
  return rows;
}

// Total height consumed by all photo rows (including gaps between rows)
function totalPhotoRowsHeight(rows: PhotoStrip[]): number {
  if (!rows.length) return 0;
  return rows.reduce((sum, r) => sum + r.stripH, 0) + PHOTO_ROW_GAP * (rows.length - 1);
}

function renderStrip(doc: jsPDF, strip: PhotoStrip, startX: number, y: number): void {
  let px = startX;
  for (let i = 0; i < strip.photos.length; i++) {
    const pw = strip.widths[i];
    try {
      doc.addImage(strip.photos[i].dataUrl, imgFormat(strip.photos[i].dataUrl), px, y, pw, strip.actualH, undefined, "FAST");
    } catch {
      doc.setFillColor(180, 190, 205);
      doc.roundedRect(px, y, pw, strip.actualH, 2, 2, "F");
    }
    px += pw + PHOTO_GAP;
  }
}

function renderPhotoRows(doc: jsPDF, rows: PhotoStrip[], startX: number, y: number): void {
  let py = y;
  for (const row of rows) {
    renderStrip(doc, row, startX, py);
    py += row.stripH + PHOTO_ROW_GAP;
  }
}

// ─── Shared PDF helpers ───────────────────────────────────────────────────────

function periodLabel(from?: string, to?: string): string {
  if (!from && !to) return "All entries";
  if (from && to) return `${from} → ${to}`;
  if (from) return `From ${from}`;
  return `Up to ${to}`;
}

function totalPageCount(doc: jsPDF): number {
  return (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
}

function drawRunningHeader(
  doc: jsPDF,
  pageW: number,
  theme: Theme,
  title: string,
  subtitle: string,
  dateTxt: string,
  margin: number
): void {
  doc.setFillColor(...theme.hdrBg);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFillColor(...theme.hdrAccent);
  doc.rect(0, 26, pageW, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...theme.hdrTitle);
  doc.text(title, margin, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...theme.hdrSub);
  doc.text(subtitle, margin, 21);
  doc.text(dateTxt, pageW - margin, 13, { align: "right" });
}

function drawFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  page: number,
  total: number,
  theme: Theme,
  margin: number
): void {
  doc.setFillColor(...theme.ftrBg);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...theme.ftrText);
  doc.text("LogVault — Confidential field report", margin, pageH - 3.5);
  doc.text(`Page ${page} of ${total}`, pageW - margin, pageH - 3.5, { align: "right" });
}

const CONTENT_Y = 35;  // first entry row on a content page (below 28mm header)

// ─── Cover page renderers ─────────────────────────────────────────────────────

type CoverOpts = {
  reportLabel: string;
  siteTitle: string;
  siteSubtitle?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  logs: EntryData[];
  theme: Theme;
  pageW: number;
  pageH: number;
  margin: number;
  contentW: number;
};

function drawCoverDark(doc: jsPDF, o: CoverOpts): void {
  const { pageW, pageH, margin, contentW, theme } = o;

  doc.setFillColor(...theme.coverBg);
  doc.rect(0, 0, pageW, pageH, "F");
  // Thin top accent bar
  doc.setFillColor(...theme.coverAccent);
  doc.rect(0, 0, pageW, 3, "F");

  let y = 42;
  // Report label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...theme.coverAccent);
  doc.text(o.reportLabel.toUpperCase(), margin, y);
  y += 13;

  // Site title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...theme.coverTitle);
  const titleLines = doc.splitTextToSize(o.siteTitle, contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 10 + 2;

  // Subtitle / site list
  if (o.siteSubtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...theme.coverSub);
    const subLines = doc.splitTextToSize(o.siteSubtitle, contentW);
    doc.text(subLines, margin, y);
    y += subLines.length * 5 + 4;
  }

  // Period + generated
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...theme.coverSub);
  doc.text(`Period: ${periodLabel(o.dateFrom, o.dateTo)}`, margin, y);
  y += 6;
  if (o.category && o.category !== "all") {
    doc.text(`Category: ${CATEGORY_LABELS[o.category as LogCategory] ?? o.category}`, margin, y);
    y += 6;
  }
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, margin, y);

  // Stats box
  drawStatsBox(doc, o.logs, 148, theme, margin, contentW);

  // Cover footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...theme.coverSub);
  doc.text("LogVault — Confidential field report", margin, pageH - 12);
}

function drawCoverBand(doc: jsPDF, o: CoverOpts): void {
  const { pageW, pageH, margin, contentW, theme } = o;

  // White page background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  // Coloured top band
  const BAND_H = 78;
  doc.setFillColor(...theme.hdrBg);
  doc.rect(0, 0, pageW, BAND_H, "F");
  doc.setFillColor(...theme.hdrAccent);
  doc.rect(0, BAND_H - 2, pageW, 2, "F");

  // In the band
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...theme.hdrSub);
  doc.text(o.reportLabel.toUpperCase(), margin, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...theme.hdrTitle);
  const titleLines = doc.splitTextToSize(o.siteTitle, contentW);
  doc.text(titleLines, margin, 36);

  if (o.siteSubtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...theme.hdrSub);
    doc.text(doc.splitTextToSize(o.siteSubtitle, contentW), margin, 36 + titleLines.length * 9 + 2);
  }

  // Below band — dark text on white
  let y = BAND_H + 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...o.theme.entryBody);
  doc.text(`Period: ${periodLabel(o.dateFrom, o.dateTo)}`, margin, y);
  y += 6;
  if (o.category && o.category !== "all") {
    doc.text(`Category: ${CATEGORY_LABELS[o.category as LogCategory] ?? o.category}`, margin, y);
    y += 6;
  }
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, margin, y);

  drawStatsBox(doc, o.logs, 140, theme, margin, contentW, true);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...theme.entryMuted);
  doc.text("LogVault — Confidential field report", margin, pageH - 12);
}

function drawCoverSidebar(doc: jsPDF, o: CoverOpts): void {
  const { pageW, pageH, margin, contentW: _cw, theme } = o;
  const SIDEBAR_W = 50;
  const CONTENT_X = SIDEBAR_W + 10;
  const rightW = pageW - CONTENT_X - margin;

  // White page
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  // Sidebar fill
  doc.setFillColor(...theme.coverAccent);
  doc.rect(0, 0, SIDEBAR_W, pageH, "F");

  // Vertical text in sidebar: report label rotated
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(o.reportLabel.toUpperCase(), SIDEBAR_W / 2, pageH - 30, { angle: 90, align: "center" });

  // Vertical separator accent line
  doc.setFillColor(...theme.hdrAccent);
  doc.rect(SIDEBAR_W - 2, 0, 2, pageH, "F");

  // Right-side content
  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...theme.coverAccent);
  doc.text(o.reportLabel.toUpperCase(), CONTENT_X, y);
  y += 13;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...theme.entryTitle);
  const titleLines = doc.splitTextToSize(o.siteTitle, rightW);
  doc.text(titleLines, CONTENT_X, y);
  y += titleLines.length * 9 + 4;

  if (o.siteSubtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...theme.entryMuted);
    const subLines = doc.splitTextToSize(o.siteSubtitle, rightW);
    doc.text(subLines, CONTENT_X, y);
    y += subLines.length * 5 + 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...theme.entryMuted);
  doc.text(`Period: ${periodLabel(o.dateFrom, o.dateTo)}`, CONTENT_X, y);
  y += 6;
  if (o.category && o.category !== "all") {
    doc.text(`Category: ${CATEGORY_LABELS[o.category as LogCategory] ?? o.category}`, CONTENT_X, y);
    y += 6;
  }
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, CONTENT_X, y);

  drawStatsBox(doc, o.logs, 148, theme, CONTENT_X, rightW, true);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...theme.entryMuted);
  doc.text("LogVault — Confidential field report", CONTENT_X, pageH - 12);
}

function drawStatsBox(
  doc: jsPDF,
  logs: EntryData[],
  y: number,
  theme: Theme,
  x: number,
  w: number,
  lightBg = false
): void {
  doc.setFillColor(...theme.statsBg);
  doc.roundedRect(x, y, w, 40, 3, 3, "F");

  // Total count
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...theme.statsNum);
  doc.text(String(logs.length), x + 8, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...theme.statsSub);
  doc.text(`total ${logs.length === 1 ? "entry" : "entries"}`, x + 8, y + 30);

  // Category breakdown
  const counts: Partial<Record<LogCategory, number>> = {};
  logs.forEach((l) => { counts[l.category as LogCategory] = (counts[l.category as LogCategory] ?? 0) + 1; });

  let cx = x + 56;
  for (const [cat, cnt] of Object.entries(counts)) {
    if (cx > x + w - 28) break;
    const col = CAT_COLORS[cat as LogCategory] ?? ([100, 116, 139] satisfies RGB);
    doc.setFillColor(...col);
    doc.roundedRect(cx, y + 10, 3, 20, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(lightBg ? 30 : 255, lightBg ? 30 : 255, lightBg ? 30 : 255);
    doc.text(String(cnt), cx + 8, y + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...theme.statsSub);
    doc.text(CATEGORY_LABELS[cat as LogCategory] ?? cat, cx + 8, y + 30);
    cx += 34;
  }
}

// ─── Entry card measurers + renderers ────────────────────────────────────────

const LINE_H = 4.5;
const TITLE_H = 5.5;

function measureEntry(
  doc: jsPDF,
  entry: EntryData,
  photoRows: PhotoStrip[],
  theme: Theme,
  contentW: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const titleLines = doc.splitTextToSize(entry.title, contentW - 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const bodyTxt = entry.content.trim() || "(no notes)";
  const bodyLines = doc.splitTextToSize(bodyTxt, contentW - 16);

  const photoH = totalPhotoRowsHeight(photoRows);
  const locationH = entry.location ? 5 : 0;

  if (theme.entry === "plain") {
    return (
      titleLines.length * TITLE_H +   // title
      6 +                              // meta row
      3 +                              // rule
      4 +                              // gap before content
      bodyLines.length * LINE_H +
      locationH +
      photoH +
      8                                // bottom gap
    );
  }
  // card or dark
  return (
    6 +
    titleLines.length * TITLE_H +
    8 +              // badge row
    0.5 +            // separator
    4 +
    bodyLines.length * LINE_H +
    locationH +
    photoH +
    6
  );
}

function drawEntry(
  doc: jsPDF,
  entry: EntryData,
  y: number,
  photoRows: PhotoStrip[],
  theme: Theme,
  config: { margin: number; pageW: number; contentW: number }
): void {
  const { margin, pageW, contentW } = config;
  const catColor: RGB = CAT_COLORS[entry.category as LogCategory] ?? ([100, 116, 139] satisfies RGB);
  const catLabel = CATEGORY_LABELS[entry.category as LogCategory] ?? entry.category;
  const dateStr = format(new Date(entry.loggedAt), "MMM d, yyyy  h:mm a");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const titleLines = doc.splitTextToSize(entry.title, contentW - 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const bodyTxt = entry.content.trim() || "(no notes)";
  const bodyLines = doc.splitTextToSize(bodyTxt, contentW - 16);
  const blockH = measureEntry(doc, entry, photoRows, theme, contentW);

  if (theme.entry === "card" || theme.entry === "dark") {
    // ── Card / dark card ──────────────────────────────────────────────────────
    doc.setFillColor(...theme.entryBg);
    doc.roundedRect(margin, y, contentW, blockH, 2, 2, "F");

    // Left accent bar (category color)
    doc.setFillColor(...catColor);
    doc.roundedRect(margin, y, 3.5, blockH, 1.5, 1.5, "F");

    // Date top-right
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...theme.entryMuted);
    doc.text(dateStr, pageW - margin - 2, y + 9, { align: "right" });

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...theme.entryTitle);
    doc.text(titleLines, margin + 8, y + 9);

    let ey = y + 6 + titleLines.length * TITLE_H;

    // Site pill (multi-site only)
    let pillX = margin + 8;
    if (entry.siteName) {
      doc.setFillColor(...theme.pillBg);
      doc.roundedRect(pillX, ey, 32, 5.5, 1.2, 1.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...theme.pillText);
      doc.text(entry.siteName, pillX + 16, ey + 3.8, { align: "center" });
      pillX += 36;
    }

    // Category pill
    doc.setFillColor(...catColor);
    doc.roundedRect(pillX, ey, 26, 5.5, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(catLabel, pillX + 13, ey + 3.8, { align: "center" });
    pillX += 30;

    // Author
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...theme.entryMuted);
    doc.text(`By ${entry.authorName}`, pillX, ey + 3.8);
    ey += 9;

    // Separator
    doc.setDrawColor(...theme.entryBorder);
    doc.line(margin + 8, ey, pageW - margin - 2, ey);
    ey += 4;

    // Notes
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...theme.entryBody);
    doc.text(bodyLines, margin + 8, ey);
    ey += bodyLines.length * LINE_H + 3;

    // Location
    if (entry.location) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...theme.entryMuted);
      doc.text(`Location: ${entry.location}`, margin + 8, ey);
      ey += 5;
    }

    // Photos (multi-row)
    if (photoRows.length) renderPhotoRows(doc, photoRows, margin + 8, ey);

  } else {
    // ── Plain / editorial ─────────────────────────────────────────────────────
    let ey = y;

    // Title + date on same line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...theme.entryTitle);
    doc.text(titleLines, margin, ey + TITLE_H);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...theme.entryMuted);
    doc.text(dateStr, pageW - margin, ey + TITLE_H, { align: "right" });
    ey += titleLines.length * TITLE_H + 1;

    // Meta row: [Category · Site · By Author]
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const metaParts: string[] = [];
    metaParts.push(catLabel);
    if (entry.siteName) metaParts.push(entry.siteName);
    metaParts.push(`By ${entry.authorName}`);

    let mx = margin;
    metaParts.forEach((part, i) => {
      // Color the category label
      if (i === 0) doc.setTextColor(...catColor);
      else doc.setTextColor(...theme.entryMuted);
      doc.text(part, mx, ey);
      mx += doc.getTextWidth(part) + 1;
      if (i < metaParts.length - 1) {
        doc.setTextColor(...theme.entryBorder);
        doc.text("·", mx, ey);
        mx += doc.getTextWidth("·") + 3;
      }
    });
    ey += 6;

    // Rule
    doc.setDrawColor(...theme.entryBorder);
    doc.line(margin, ey, pageW - margin, ey);
    ey += 4;

    // Notes
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...theme.entryBody);
    doc.text(bodyLines, margin, ey);
    ey += bodyLines.length * LINE_H + 3;

    // Location
    if (entry.location) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...theme.entryMuted);
      doc.text(`Location: ${entry.location}`, margin, ey);
      ey += 5;
    }

    // Photos (multi-row)
    if (photoRows.length) renderPhotoRows(doc, photoRows, margin, ey);
  }
}

// ─── Core PDF render engine ───────────────────────────────────────────────────

type RenderOpts = {
  entries: EntryData[];
  reportLabel: string;
  siteTitle: string;
  siteSubtitle?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  theme: Theme;
  filename: string;
};

async function renderReport(opts: RenderOpts): Promise<void> {
  const { entries, reportLabel, siteTitle, siteSubtitle, dateFrom, dateTo, category, theme, filename } = opts;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  // Pre-fetch all photos in parallel
  const allUrls = Array.from(new Set(entries.flatMap((e) => e.photoUrls ?? [])));
  const photoMap = new Map<string, PhotoInfo | null>();
  await Promise.all(allUrls.map(async (url) => {
    photoMap.set(url, await fetchPhotoInfo(url));
  }));

  // ── Cover page ──────────────────────────────────────────────────────────────
  const coverOpts: CoverOpts = {
    reportLabel, siteTitle, siteSubtitle,
    dateFrom, dateTo, category, logs: entries,
    theme, pageW, pageH, margin, contentW,
  };
  if (theme.cover === "band") drawCoverBand(doc, coverOpts);
  else if (theme.cover === "sidebar") drawCoverSidebar(doc, coverOpts);
  else drawCoverDark(doc, coverOpts);

  // ── Entry pages ─────────────────────────────────────────────────────────────
  doc.addPage();
  let y = CONTENT_Y;

  for (const entry of entries) {
    const photos = (entry.photoUrls ?? [])
      .map((u) => photoMap.get(u) ?? null)
      .filter((p): p is PhotoInfo => p !== null);

    const photoAreaW = theme.entry === "plain" ? contentW : contentW - 16;
    const photoRows = calcPhotoRows(photos, photoAreaW);
    const blockH = measureEntry(doc, entry, photoRows, theme, contentW);

    if (y + blockH > pageH - 14) {
      doc.addPage();
      y = CONTENT_Y;
    }

    drawEntry(doc, entry, y, photoRows, theme, { margin, pageW, contentW });
    y += blockH + (theme.entry === "plain" ? 6 : 4);

    // For plain style: draw a light bottom rule between entries
    if (theme.entry === "plain") {
      doc.setDrawColor(...theme.entryBorder);
      doc.setLineWidth(0.25);
      doc.line(margin, y - 4, pageW - margin, y - 4);
      doc.setLineWidth(0.2);
    }
  }

  // ── Running headers + footers on content pages ───────────────────────────────
  const total = totalPageCount(doc);
  const now = new Date();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    drawRunningHeader(doc, pageW, theme, siteTitle, reportLabel, `Generated: ${format(now, "MMM d, yyyy")}`, margin);
    drawFooter(doc, pageW, pageH, i - 1, total - 1, theme, margin);
  }

  doc.save(filename);
}

// ─── Public export functions ──────────────────────────────────────────────────

export async function exportFullReportPDF({
  siteName, siteLocation, logs, dateFrom, dateTo, category, theme,
}: ExportOptions): Promise<void> {
  const entries: EntryData[] = logs.map((l) => ({
    title: l.title,
    content: l.content,
    category: l.category,
    authorName: l.authorName,
    loggedAt: l.loggedAt,
    location: l.location,
    photoUrls: l.photoUrls,
  }));

  await renderReport({
    entries,
    reportLabel: "Field Log Report",
    siteTitle: siteName,
    siteSubtitle: siteLocation,
    dateFrom, dateTo, category, theme,
    filename: `${siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-report-${format(new Date(), "yyyy-MM-dd")}.pdf`,
  });
}

export async function exportGlobalFullReportPDF({
  logs, siteNames, dateFrom, dateTo, category, theme,
}: GlobalExportOptions): Promise<void> {
  const entries: EntryData[] = logs.map((l) => ({
    title: l.title,
    content: l.content,
    category: l.category,
    authorName: l.authorName,
    loggedAt: l.loggedAt,
    location: l.location,
    siteName: l.siteName,
    photoUrls: l.photoUrls,
  }));

  const siteTitle = siteNames.length === 1 ? siteNames[0] : `${siteNames.length} Sites`;
  const siteSubtitle = siteNames.length > 1
    ? siteNames.slice(0, 6).join(", ") + (siteNames.length > 6 ? ` +${siteNames.length - 6} more` : "")
    : undefined;

  await renderReport({
    entries,
    reportLabel: "Multi-Site Field Log Report",
    siteTitle,
    siteSubtitle,
    dateFrom, dateTo, category, theme,
    filename: `logvault-multi-site-report-${format(new Date(), "yyyy-MM-dd")}.pdf`,
  });
}

// ─── Summary Table PDF exports ────────────────────────────────────────────────

export function exportPDF({ siteName, logs, dateFrom, dateTo, category }: ExportOptions): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header band
  doc.setFillColor(18, 24, 38);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 22, pageW, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(siteName, margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(155, 170, 205);
  const meta: string[] = [];
  if (dateFrom || dateTo) meta.push(`Period: ${dateFrom ?? "start"} → ${dateTo ?? "present"}`);
  if (category && category !== "all") meta.push(`Category: ${CATEGORY_LABELS[category as LogCategory] ?? category}`);
  meta.push(`Exported: ${format(new Date(), "MMM d, yyyy")}`);
  doc.text(meta.join("   •   "), margin, 20);

  // Table
  const colX = [margin, 44, 90, 120, 152, 200, 235];
  const colW = [30, 44, 28, 30, 46, 33, 48];
  const headers = ["Date", "Title", "Category", "Author", "Notes", "Location", "Photos"];
  let y = 32;

  // Header row
  doc.setFillColor(28, 38, 58);
  doc.rect(margin, y - 5, pageW - margin * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(245, 158, 11);
  headers.forEach((h, i) => doc.text(h, colX[i], y));
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let rowAlt = false;

  for (const l of logs) {
    const dateStr = format(new Date(l.loggedAt), "MMM d, yyyy");
    const catLabel = CATEGORY_LABELS[l.category as LogCategory] ?? l.category;
    const notes = l.content.replace(/\n/g, " ").slice(0, 80) + (l.content.length > 80 ? "…" : "");
    const titleTrunc = l.title.slice(0, 40) + (l.title.length > 40 ? "…" : "");

    const rowH = 8;
    if (y + rowH > pageH - 14) {
      doc.addPage();
      y = 18;
    }

    if (rowAlt) {
      doc.setFillColor(240, 244, 252);
      doc.rect(margin, y - 5, pageW - margin * 2, rowH, "F");
    }
    rowAlt = !rowAlt;

    doc.setTextColor(18, 24, 38);
    [dateStr, titleTrunc, catLabel, l.authorName, notes, l.location ?? "", String(l.photoUrls?.length ?? 0)].forEach(
      (val, i) => {
        const txt = doc.splitTextToSize(val, colW[i] - 2);
        doc.text(txt[0] ?? "", colX[i], y);
      }
    );

    doc.setDrawColor(210, 220, 235);
    doc.line(margin, y + 3, pageW - margin, y + 3);
    y += rowH;
  }

  // Footer
  doc.setFillColor(18, 24, 38);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(95, 110, 140);
  doc.text("LogVault — Confidential field report", margin, pageH - 3.5);
  doc.text(`${logs.length} entries`, pageW - margin, pageH - 3.5, { align: "right" });

  doc.save(`${siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-table-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

export function exportGlobalPDF({ logs, siteNames, dateFrom, dateTo, category }: GlobalExportOptions): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header band
  doc.setFillColor(18, 24, 38);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 22, pageW, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  const titleTxt = siteNames.length === 1 ? siteNames[0] : `${siteNames.length} Sites — Multi-Site Export`;
  doc.text(titleTxt, margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(155, 170, 205);
  const meta: string[] = [];
  if (dateFrom || dateTo) meta.push(`Period: ${dateFrom ?? "start"} → ${dateTo ?? "present"}`);
  if (category && category !== "all") meta.push(`Category: ${CATEGORY_LABELS[category as LogCategory] ?? category}`);
  meta.push(`Exported: ${format(new Date(), "MMM d, yyyy")}`);
  doc.text(meta.join("   •   "), margin, 20);

  const colX = [margin, 36, 74, 104, 128, 164, 207, 238];
  const colW = [22, 36, 28, 22, 34, 41, 29, 40];
  const headers = ["Date", "Site", "Title", "Category", "Author", "Notes", "Location", "Photos"];
  let y = 32;

  doc.setFillColor(28, 38, 58);
  doc.rect(margin, y - 5, pageW - margin * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(245, 158, 11);
  headers.forEach((h, i) => doc.text(h, colX[i], y));
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let rowAlt = false;

  for (const l of logs) {
    const dateStr = format(new Date(l.loggedAt), "MMM d, yyyy");
    const catLabel = CATEGORY_LABELS[l.category as LogCategory] ?? l.category;
    const notes = l.content.replace(/\n/g, " ").slice(0, 80) + (l.content.length > 80 ? "…" : "");
    const titleTrunc = l.title.slice(0, 32) + (l.title.length > 32 ? "…" : "");
    const siteTrunc = l.siteName.slice(0, 24) + (l.siteName.length > 24 ? "…" : "");

    const rowH = 8;
    if (y + rowH > pageH - 14) {
      doc.addPage();
      y = 18;
    }

    if (rowAlt) {
      doc.setFillColor(240, 244, 252);
      doc.rect(margin, y - 5, pageW - margin * 2, rowH, "F");
    }
    rowAlt = !rowAlt;

    doc.setTextColor(18, 24, 38);
    [dateStr, siteTrunc, titleTrunc, catLabel, l.authorName, notes, l.location ?? "", String(l.photoUrls?.length ?? 0)]
      .forEach((val, i) => doc.text(val, colX[i], y));

    doc.setDrawColor(210, 220, 235);
    doc.line(margin, y + 3, pageW - margin, y + 3);
    y += rowH;
  }

  // Footer
  doc.setFillColor(18, 24, 38);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(95, 110, 140);
  doc.text("LogVault — Confidential field report", margin, pageH - 3.5);
  doc.text(`${logs.length} entries`, pageW - margin, pageH - 3.5, { align: "right" });

  doc.save(`logvault-multi-site-table-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ─── CSV exports ──────────────────────────────────────────────────────────────

function escCsv(v: string): string {
  return v.includes(",") || v.includes('"') || v.includes("\n")
    ? `"${v.replace(/"/g, '""')}"`
    : v;
}

export function exportCSV({ siteName, logs, dateFrom, dateTo, category }: ExportOptions): void {
  const headers = ["Date & Time", "Title", "Category", "Author", "Notes", "Location", "Photos"];
  const rows = logs.map((l) => [
    format(new Date(l.loggedAt), "yyyy-MM-dd HH:mm"),
    l.title,
    CATEGORY_LABELS[l.category as LogCategory] ?? l.category,
    l.authorName,
    l.content.replace(/\n/g, " "),
    l.location ?? "",
    String(l.photoUrls?.length ?? 0),
  ]);
  const meta = [
    ["LogVault Field Log Export"],
    [`Site: ${siteName}`],
    ...(dateFrom || dateTo ? [[`Period: ${dateFrom ?? "start"} to ${dateTo ?? "present"}`]] : []),
    ...(category && category !== "all" ? [[`Category: ${CATEGORY_LABELS[category as LogCategory] ?? category}`]] : []),
    [`Exported: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
    [`Total entries: ${logs.length}`],
    [],
  ];
  const csv = [...meta, headers, ...rows].map((r) => r.map(escCsv).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `${siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
}

export function exportGlobalCSV({ logs, siteNames, dateFrom, dateTo, category }: GlobalExportOptions): void {
  const headers = ["Date & Time", "Site", "Title", "Category", "Author", "Notes", "Location", "Photos"];
  const rows = logs.map((l) => [
    format(new Date(l.loggedAt), "yyyy-MM-dd HH:mm"),
    l.siteName,
    l.title,
    CATEGORY_LABELS[l.category as LogCategory] ?? l.category,
    l.authorName,
    l.content.replace(/\n/g, " "),
    l.location ?? "",
    String(l.photoUrls?.length ?? 0),
  ]);
  const meta = [
    ["LogVault Multi-Site Export"],
    [`Sites: ${siteNames.join(", ")}`],
    ...(dateFrom || dateTo ? [[`Period: ${dateFrom ?? "start"} to ${dateTo ?? "present"}`]] : []),
    ...(category && category !== "all" ? [[`Category: ${CATEGORY_LABELS[category as LogCategory] ?? category}`]] : []),
    [`Exported: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
    [`Total entries: ${logs.length}`],
    [],
  ];
  const csv = [...meta, headers, ...rows].map((r) => r.map(escCsv).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `logvault-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
}
