## Local Development

```bash
npm install
npm run dev
```

The application runs on [http://localhost:3000](http://localhost:3000).

## Analytics & Privacy

Google Analytics 4 is wired through `gtag.js` with an in-product consent banner.

1. Copy `.env.example` to `.env.local` and set the measurement ID:

   ```bash
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXX
   ```

2. The consent banner stores your choice in `localStorage` under
   `adhocint-cookie-consent`. You can clear the value to re-trigger the banner.

3. Custom events currently captured:
   - `page_view` for every route change (App Router aware)
   - `cta_click` on hero and services CTAs
   - `contact_submit` when the contact form successfully posts

Update `/src/lib/analytics.ts` if you need additional events or destinations.

## Deployment

Production deploys are handled via the GitHub Action in `.github/workflows/deploy-master.yml`
which builds a standalone Next.js bundle, uploads it to the server via `rsync`, and
restarts the PM2 process.
