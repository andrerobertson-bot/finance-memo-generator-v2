import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { renderFinanceMemoPdf } from './pdf/render.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '25mb' }));

app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    maxAge: '1h',
  })
);

app.get('/health', (req, res) => res.json({ ok: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const KeyValueRow = z.object({
  key: z.string().optional().default(''),
  value: z.string().optional().default(''),
});

const PayloadSchema = z
  .object({
    meta: z
      .object({
        referenceNumber: z.string().optional().default(''),
        memoTitle: z.string().optional().default('Finance Memorandum'),
        preparedFor: z.string().optional().default(''),
        preparedBy: z.string().optional().default(''),
        date: z.string().optional().default(''),
      })
      .default({}),

    cover: z
      .object({
        headline: z.string().optional().default('Construction Finance'),
        subheadline: z.string().optional().default(''),
      })
      .default({}),

    partiesToLoan: z
      .array(
        z.object({
          name: z.string().optional().default(''),
          role: z.string().optional().default(''),
          entityType: z.string().optional().default(''),
        })
      )
      .optional()
      .default([]),

    execSummary: z.array(KeyValueRow).optional().default([]),

    proposal: z
      .object({
        synopsis: z.string().optional().default(''),
        existingFacilities: z.string().optional().default(''),
        consultants: z.string().optional().default(''),
      })
      .default({}),

    salesMarketing: z
      .object({
        salesStrategy: z.string().optional().default(''),
        marketingStrategy: z.string().optional().default(''),
        presalesSummary: z.string().optional().default(''),
      })
      .default({}),

    presales: z
      .array(
        z.object({
          buyer: z.string().optional().default(''),
          lot: z.string().optional().default(''),
          price: z.string().optional().default(''),
          deposit: z.string().optional().default(''),
          status: z.string().optional().default(''),
        })
      )
      .optional()
      .default([]),

    lots: z
      .array(
        z.object({
          stage: z.string().optional().default(''),
          lot: z.string().optional().default(''),
          size: z.string().optional().default(''),
          price: z.string().optional().default(''),
          status: z.string().optional().default(''),
        })
      )
      .optional()
      .default([]),

    property: z
      .object({
        address: z.string().optional().default(''),
        securityDescription: z.string().optional().default(''),
        zoning: z.string().optional().default(''),
        area: z.string().optional().default(''),
        titles: z.string().optional().default(''),
        planning: z.string().optional().default(''),
        services: z.string().optional().default(''),
        notes: z.string().optional().default(''),
      })
      .default({}),

    feasibilityRows: z
      .array(
        z.object({
          group: z.string().optional().default(''),
          label: z.string().optional().default(''),
          amount: z.string().optional().default(''),
          notes: z.string().optional().default(''),
        })
      )
      .optional()
      .default([]),

    funding: z
      .object({
        rows: z
          .array(
            z.object({
              label: z.string().optional().default(''),
              amount: z.string().optional().default(''),
            })
          )
          .optional()
          .default([]),
        notes: z.string().optional().default(''),
      })
      .default({}),

    security: z
      .object({
        rows: z
          .array(
            z.object({
              name: z.string().optional().default(''),
              details: z.string().optional().default(''),
            })
          )
          .optional()
          .default([]),
        notes: z.string().optional().default(''),
      })
      .default({}),

    borrowers: z
      .array(
        z.object({
          name: z.string().optional().default(''),
          entityType: z.string().optional().default(''),
          abn: z.string().optional().default(''),
          role: z.string().optional().default(''),
          address: z.string().optional().default(''),
          notes: z.string().optional().default(''),
        })
      )
      .optional()
      .default([]),

    guarantors: z
      .array(
        z.object({
          fullName: z.string().optional().default(''),
          relationship: z.string().optional().default(''),
          netWorth: z.string().optional().default(''),
          bio: z.string().optional().default(''),
        })
      )
      .optional()
      .default([{ fullName: '', relationship: '', netWorth: '', bio: '' }]),

    financials: z
      .object({
        companyAssets: z
          .array(
            z.object({
              label: z.string().optional().default(''),
              amount: z.string().optional().default(''),
            })
          )
          .optional()
          .default([]),
        companyLiabilities: z
          .array(
            z.object({
              label: z.string().optional().default(''),
              amount: z.string().optional().default(''),
            })
          )
          .optional()
          .default([]),
        individuals: z
          .array(
            z.object({
              name: z.string().optional().default(''),
              rows: z
                .array(
                  z.object({
                    type: z.string().optional().default(''),
                    label: z.string().optional().default(''),
                    amount: z.string().optional().default(''),
                  })
                )
                .optional()
                .default([]),
              notes: z.string().optional().default(''),
            })
          )
          .optional()
          .default([]),
      })
      .default({}),

    professionalContacts: z
      .object({
        solicitor: z
          .object({
            name: z.string().optional().default(''),
            firm: z.string().optional().default(''),
            email: z.string().optional().default(''),
            phone: z.string().optional().default(''),
          })
          .default({}),
        accountant: z
          .object({
            name: z.string().optional().default(''),
            firm: z.string().optional().default(''),
            email: z.string().optional().default(''),
            phone: z.string().optional().default(''),
          })
          .default({}),
      })
      .default({}),

    legal: z
      .object({
        confidentialityHeading: z.string().optional().default('CONFIDENTIALITY & DISCLAIMER'),
        confidentialityBody: z.string().optional().default(''),
        disclaimerBody: z.string().optional().default(''),
        contactName: z.string().optional().default(''),
        contactEmail: z.string().optional().default(''),
        contactPhone: z.string().optional().default(''),
      })
      .default({}),

    recommendation: z
      .object({
        heading: z.string().optional().default('RECOMMENDATION'),
        body: z.string().optional().default(''),
        annexuresHeading: z.string().optional().default('ANNEXURES'),
        annexuresIntro: z.string().optional().default(''),
        annexuresList: z.string().optional().default(''),
      })
      .default({}),

    footers: z
      .object({
        confidentiality: z
          .string()
          .optional()
          .default('This document is strictly private & confidential and the property of Global Capital Commercial'),
        right: z.string().optional().default(''),
      })
      .default({}),
  })
  // Allow extra top-level keys sent from the UI (e.g. new sections) without hard failing.
  .passthrough();

app.post(
  '/api/generate',
  upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'propertyImages', maxCount: 6 },
  ]),
  async (req, res) => {
    try {
      const payloadRaw = req.body?.payload;
      const payload = PayloadSchema.parse(payloadRaw ? JSON.parse(payloadRaw) : {});

      const files = /** @type {Record<string, Express.Multer.File[]>} */ (req.files || {});
      const coverImage = files.coverImage?.[0] || null;
      const logo = files.logo?.[0] || null;
      const propertyImages = files.propertyImages || [];

      const pdfBuffer = await renderFinanceMemoPdf({ payload, coverImage, logo, propertyImages });

      const safeName = (payload.meta.referenceNumber || 'finance-memo').replace(/[^a-z0-9_-]+/gi, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error(err);
      res.status(400).json({ ok: false, error: err?.message || 'Failed to generate PDF' });
    }
  }
);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Finance Memo Generator running on port ${PORT}`);
});
