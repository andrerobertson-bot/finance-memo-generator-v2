import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
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
    options: { omitCover: true },
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

  const coverPdfBuffer = await renderCoverLatexPdf({ payload, coverImage });



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

    const bodyPdfBuffer = Buffer.from(pdf);
    return await mergeCoverAndBody(coverPdfBuffer, bodyPdfBuffer);
  } finally {
    await browser.close();
  }
}


function latexEscape(str) {
  return String(str ?? '')
    .replaceAll('\\', '\\textbackslash{}')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}')
    .replaceAll('%', '\\%')
    .replaceAll('$', '\\$')
    .replaceAll('&', '\\&')
    .replaceAll('#', '\\#')
    .replaceAll('_', '\\_')
    .replaceAll('^', '\\^{}')
    .replaceAll('~', '\\~{}');
}

async function renderCoverLatexPdf({ payload, coverImage }) {
  // Create temp workspace
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-cover-'));
  const latexDir = path.join(__dirname, '..', '..', 'latex');

  // Copy template + fonts into temp dir (fonts are installed in image and also shipped under latex/fonts)
  // We copy the whole latex directory (small) to keep paths stable for tectonic.
  fs.cpSync(latexDir, dir, { recursive: true });

  // Write cover image to temp file
  const coverImagePath = path.join(dir, 'cover-image');
  if (coverImage?.buffer) {
    // keep original extension if present, else png
    const ext = (coverImage.mimetype && coverImage.mimetype.includes('jpeg')) ? '.jpg' :
                (coverImage.mimetype && coverImage.mimetype.includes('png')) ? '.png' :
                (coverImage.originalname && coverImage.originalname.toLowerCase().endsWith('.jpg')) ? '.jpg' :
                (coverImage.originalname && coverImage.originalname.toLowerCase().endsWith('.jpeg')) ? '.jpg' : '.png';
    fs.writeFileSync(coverImagePath + ext, coverImage.buffer);
  } else {
    // fallback: blank 1x1 png would be ideal, but we just let LaTeX fail loudly
  }

  const coverImageFile = fs.readdirSync(dir).find(f => f.startsWith('cover-image'));
  const coverImageRel = coverImageFile ? coverImageFile : '';

  // Defaults matching reference (editable via payload)
  const mainTitle = payload?.cover?.mainTitle || 'Global Capital Commercial';
  const subOne = payload?.cover?.subheadline1 || 'Confidential';
  const subTwo = payload?.cover?.subheadline2 || 'Finance Memorandum';
  const headline = payload?.cover?.headline || 'Construction Finance';
  const projectName = payload?.cover?.projectName || payload?.cover?.preparedFor || 'Warra Project Pty Ltd';
  const amount = payload?.cover?.financeRequired || payload?.loan?.loanAmount || '$50,000,000';
  const ref = payload?.meta?.referenceNumber || 'PRP.17213';
  const date = payload?.meta?.date || '';

  const companyWebsite = payload?.cover?.companyWebsite || 'globalcapital.com.au';
  const companyLine = payload?.cover?.companyLine ||
    'Global Capital Corporation Pty Ltd | ABN 14 097 482 114 | Telephone 612 9222 9100 | info@globalcapital.com.au \\\\ ' +
    'Level 43 Governor Phillip Tower, 1 Farrer Place Sydney NSW Australia 2000 | PO Box R196 Royal Exchange NSW 1225';

  const dataTex = [
    '% Auto-generated. Do not edit.',
    `\\newcommand{\\MainTitle}{${latexEscape(mainTitle)}}`,
    `\\newcommand{\\SubOne}{${latexEscape(subOne)}}`,
    `\\newcommand{\\SubTwo}{${latexEscape(subTwo)}}`,
    `\\newcommand{\\Headline}{${latexEscape(headline)}}`,
    `\\newcommand{\\ProjectName}{${latexEscape(projectName)}}`,
    `\\newcommand{\\LoanAmount}{${latexEscape(amount)}}`,
    `\\newcommand{\\DateLine}{${latexEscape(date)}}`,
    `\\newcommand{\\RefNumber}{${latexEscape(ref)}}`,
    `\\newcommand{\\CompanyWebsite}{${latexEscape(companyWebsite)}}`,
    `\\newcommand{\\CompanyLine}{${latexEscape(companyLine)}}`,
    `\\newcommand{\\CoverImagePath}{${latexEscape(coverImageRel)}}`,
    ''
  ].join('\n');

  fs.writeFileSync(path.join(dir, 'cover-data.tex'), dataTex, 'utf8');

  // Run tectonic inside temp dir
  const result = spawnSync('tectonic', ['-X', 'compile', 'cover.tex', '--outdir', dir], {
    cwd: dir,
    env: process.env,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    const msg = `Tectonic failed (exit ${result.status}).\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`;
    throw new Error(msg);
  }

  const outPdfPath = path.join(dir, 'cover.pdf');
  const pdf = fs.readFileSync(outPdfPath);
  // Clean up best-effort
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  return pdf;
}

async function mergeCoverAndBody(coverPdfBuffer, bodyPdfBuffer) {
  const out = await PDFDocument.create();
  const cover = await PDFDocument.load(coverPdfBuffer);
  const body = await PDFDocument.load(bodyPdfBuffer);

  const [coverPage] = await out.copyPages(cover, [0]);
  out.addPage(coverPage);

  const bodyPages = await out.copyPages(body, body.getPageIndices());
  for (const p of bodyPages) out.addPage(p);

  return Buffer.from(await out.save());
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
