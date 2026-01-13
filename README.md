# Finance Memorandum Generator (V2)

Fresh rebuild: **Express + Playwright (Chromium) server-side HTML → PDF**.

## What this repo does

- Clean, modern tab UI for editing a Finance Memorandum.
- `POST /api/generate` renders a **25-page A4 PDF** using print CSS (no background-image coordinate mapping).
- Optional blocks do not render when empty.
- Repeatable sections (dynamic row counts):
  - Guarantors (min 1, max 10)
  - Parties to loan
  - Lots / Pricelist
  - Feasibility rows
- Uploads:
  - Cover image (optional)
  - Logo (optional)
  - Property images (0–6)

## Local dev

```bash
npm install
npm run dev
```

Open:
`http://localhost:3000`

Click **Load sample** → **Generate PDF**.

## Deploy on Render (Docker)

1. Create a new **Web Service** on Render.
2. Choose **Docker**.
3. Point it at this repo.
4. No build/start command needed (Dockerfile handles it).
5. Render will set `PORT` automatically.

Health endpoint:
`/health`

## Notes / next upgrade

- The current PDF is a **template skeleton** showing the architecture and dynamic rendering.
- To match a real Finance Memorandum pixel-perfect, replace `server/templates/document.njk` and `public/print.css` section styles/structures.
