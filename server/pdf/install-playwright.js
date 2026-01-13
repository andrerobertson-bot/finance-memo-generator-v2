import { execSync } from 'node:child_process';

// Ensure Chromium is installed at build time (Render / Docker).
// If you prefer faster builds, you can remove this and instead run the
// install in your Dockerfile.
try {
  execSync('npx playwright install chromium', { stdio: 'inherit' });
} catch (err) {
  // Some environments restrict browser download during npm install.
  // The Dockerfile also installs browsers; this keeps local dev resilient.
  console.warn('Playwright browser install failed during postinstall. Continuing.');
}
