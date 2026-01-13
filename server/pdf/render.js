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

  const viewModel = {
    payload,
    feasibilityGroups,
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
