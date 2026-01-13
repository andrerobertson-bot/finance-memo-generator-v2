import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesDir = path.join(__dirname, '..', 'templates');
const publicDir = path.join(__dirname, '..', '..', 'public');

const env = nunjucks.configure(templatesDir, {
  autoescape: true,
  noCache: true
});

env.addFilter('nl2br', (str) => {
  if (str == null) return '';
  // Convert newlines to <br/> while preserving safe escaping via Nunjucks autoescape
  return String(str).replace(/\n/g, '<br/>');
});



function toDataUrl(file) {
  if (!file) return '';
  const mime = file.mimetype || 'application/octet-stream';
  const b64 = file.buffer.toString('base64');
  return `data:${mime};base64,${b64}`;
}

// Minimal image dimension reader (PNG/JPEG) to support smart cover scaling without extra deps.
function getImageDimensions(file) {
  try {
    if (!file?.buffer || file.buffer.length < 24) return null;
    const b = file.buffer;

    // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width/height at bytes 16-23
    if (
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
      b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A
    ) {
      const w = b.readUInt32BE(16);
      const h = b.readUInt32BE(20);
      if (w && h) return { width: w, height: h };
    }

    // JPEG: scan for SOF marker (0xFFC0..0xFFC3 etc.)
    if (b[0] === 0xFF && b[1] === 0xD8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xFF) { i++; continue; }
        let marker = b[i + 1];
        // Skip padding FFs
        while (marker === 0xFF) { i++; marker = b[i + 1]; }
        // SOI/EOI
        if (marker === 0xD9 || marker === 0xDA) break;
        const len = b.readUInt16BE(i + 2);
        // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
        const isSOF = (
          (marker >= 0xC0 && marker <= 0xC3) ||
          (marker >= 0xC5 && marker <= 0xC7) ||
          (marker >= 0xC9 && marker <= 0xCB) ||
          (marker >= 0xCD && marker <= 0xCF)
        );
        if (isSOF && i + 7 < b.length) {
          const h = b.readUInt16BE(i + 5);
          const w = b.readUInt16BE(i + 7);
          if (w && h) return { width: w, height: h };
        }
        i += 2 + len;
      }
    }
  } catch (_) {
    return null;
  }
  return null;
}

function hasAnyValue(obj) {
  if (obj == null) return false;
  if (typeof obj === 'string') return obj.trim().length > 0;
  if (typeof obj === 'number') return true;
  if (Array.isArray(obj)) return obj.some(hasAnyValue);
  if (typeof obj === 'object') return Object.values(obj).some(hasAnyValue);
  return false;
}

env.addGlobal('hasAnyValue', hasAnyValue);



/**
 * @param {object} args
 * @param {any} args.payload
 * @param {import('multer').File|null} args.coverImage
 * @param {import('multer').File|null} args.logo
 * @param {import('multer').File|null} args.footerLogo
 * @param {import('multer').File[]} args.propertyImages
 */
export async function renderFinanceMemoPdf({ payload, coverImage, logo, footerLogo, propertyImages }) {
  // Group feasibility rows by group name here (Nunjucks can't create dynamic object keys reliably)
  const feasibilityMap = new Map();
  for (const r of (payload?.feasibilityRows || [])) {
    const g = (r?.group && String(r.group).trim()) ? String(r.group).trim() : 'Lines';
    if (!feasibilityMap.has(g)) feasibilityMap.set(g, []);
    feasibilityMap.get(g).push(r);
  }
  const feasibilityGroups = Array.from(feasibilityMap.entries()).map(([name, rows]) => ({ name, rows }));

  // Smart cover scaling:
  // - Default: 'smart'
  // - If aspect ratio matches the cover photo frame (~210mm x 175mm) within tolerance, use 'cover'
  // - Otherwise use 'contain' to guarantee no cropping (safe for baked-in text/logos)
  const coverFitMode = (payload?.cover?.imageFitMode || 'smart');
  let coverFit = 'contain';
  if (coverFitMode === 'cover' || coverFitMode === 'contain') {
    coverFit = coverFitMode;
  } else {
    const dims = getImageDimensions(coverImage);
    const frameRatio = 210 / 175;
    if (dims?.width && dims?.height) {
      const r = dims.width / dims.height;
      const relDiff = Math.abs(r - frameRatio) / frameRatio;
      coverFit = relDiff <= 0.02 ? 'cover' : 'contain';
    } else {
      coverFit = 'contain';
    }
  }

  const viewModel = {
    payload,
    feasibilityGroups,
    coverFit,
    assets: {
      coverImage: toDataUrl(coverImage),
      logo: toDataUrl(logo),
      footerLogo: toDataUrl(footerLogo),
      propertyImages: (propertyImages || []).map(toDataUrl)
    },
    show: {
      meta: hasAnyValue(payload?.meta),
      loan: hasAnyValue(payload?.loan),
      property: hasAnyValue(payload?.property),
      partiesToLoan: (payload?.partiesToLoan || []).some(hasAnyValue),
      guarantors: (payload?.guarantors || []).some(hasAnyValue),
      lots: (payload?.lots || []).some(hasAnyValue),
      feasibility: (payload?.feasibilityRows || []).some(hasAnyValue),
      legal: hasAnyValue(payload?.legal),
      recommendation: hasAnyValue(payload?.recommendation)
    }
  };


  const html = env.render('document.njk', viewModel);

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const context = await browser.newContext({
      // Ensures relative asset URLs resolve
      baseURL: `file://${publicDir}/`
    });

    const page = await context.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });

    // Ensure webfonts are actually loaded before PDF snapshot (critical for pixel-perfect typography)
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (_) {}
      }
    });

    // Wait for images to decode (best-effort)
    await page.evaluate(async () => {
      const imgs = Array.from(document.images || []);
      await Promise.all(imgs.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      }));
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      // For pixel-perfect layouts we must not let Chromium shrink the content area.
      // Footer is rendered inside HTML as a fixed element.
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      displayHeaderFooter: false
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
