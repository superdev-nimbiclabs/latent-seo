# LatentSEO - AI-Powered Shopify SEO Automation

LatentSEO is a Shopify app that uses AI to automatically optimize your store's SEO. It generates meta titles, descriptions, and alt text using Google Gemini AI, helping improve your search rankings with minimal effort.

## Features

- **AI Meta Title Generation** - Creates compelling, SEO-optimized titles for products
- **AI Meta Description Generation** - Writes persuasive descriptions within character limits
- **AI Alt Text Generation** - Uses vision AI to describe product images for accessibility
- **SEO Audit** - Scores your store's SEO health and identifies issues
- **Bulk Optimization** - Process thousands of products in background jobs
- **Undo/Revert** - Full history tracking with one-click undo
- **Custom Prompts** - Customize AI behavior with your own instructions
- **Tone Selection** - Choose from Professional, Friendly, Fun, or Luxury tones
- **Theme Extension** - Inject JSON-LD schema markup automatically
- **Usage-Based Billing** - Free, Starter ($9.99), Professional ($29.99), Enterprise ($79.99)

## Tech Stack

- **Framework**: Remix (React Router v7)
- **UI**: Shopify Polaris
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: BullMQ with Redis
- **AI**: Google Gemini 2.0 Flash
- **Hosting**: Fly.io (recommended)
- **Monitoring**: Sentry (optional)

## Prerequisites

- Node.js 20.19+ or 22.12+
- PostgreSQL database
- Redis instance
- Google Gemini API key
- Shopify Partner account

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-org/latent-seo.git
cd latent-seo
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
```env
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
DATABASE_URL=postgresql://user:password@localhost:5432/latentseo
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Setup Database

```bash
npm run setup
```

This runs `prisma generate` and `prisma db push`.

### 4. Start Development

```bash
npm run dev
```

This starts the Shopify CLI development environment with tunneling.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Shopify CLI |
| `npm run build` | Build for production |
| `npm start` | Start production server (web + worker) |
| `npm run worker` | Start just the background worker |
| `npm test` | Run unit and integration tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:perf` | Run performance tests |
| `npm run lint` | Lint code |
| `npm run typecheck` | TypeScript type checking |

## Project Structure

```
latent-seo/
├── app/
│   ├── components/       # React components
│   ├── config/          # Configuration files
│   ├── hooks/           # React hooks
│   ├── lib/             # Utilities (queue, sentry)
│   ├── routes/          # Remix routes
│   ├── services/        # Business logic
│   └── workers/         # BullMQ workers
├── extensions/
│   └── seo-schema-injector/  # Theme app extension
├── prisma/
│   └── schema.prisma    # Database schema
├── tests/
│   ├── integration/     # Route integration tests
│   ├── performance/     # Load tests
│   └── services/        # Unit tests
└── e2e/                 # Playwright E2E tests
```

## Routes

| Route | Description |
|-------|-------------|
| `/app` | Dashboard with stats and quick actions |
| `/app/products` | Product list with SEO status |
| `/app/audit` | SEO audit with health scores |
| `/app/jobs` | Background job status |
| `/app/history` | Optimization history with undo |
| `/app/reports` | Analytics and CSV exports |
| `/app/settings` | App configuration |
| `/app/billing` | Plan management |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

## Deployment

### Deploy to Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`

2. Login: `fly auth login`

3. Create app: `fly apps create latentseo`

4. Set secrets:
```bash
fly secrets set \
  SHOPIFY_API_KEY=xxx \
  SHOPIFY_API_SECRET=xxx \
  GEMINI_API_KEY=xxx \
  DATABASE_URL=xxx \
  REDIS_URL=xxx
```

5. Deploy: `fly deploy`

### Deploy to Shopify

```bash
npm run deploy
```

This pushes configuration and creates the app in the Shopify Partner dashboard.

## Testing

### Unit & Integration Tests
```bash
npm test                    # All tests
npm run test:integration    # Integration only
npm run test:coverage       # With coverage report
```

### E2E Tests
```bash
npm run dev                 # Start dev server first
npm run test:e2e           # Run Playwright tests
npm run test:e2e:ui        # Interactive mode
```

### Performance Tests
```bash
npm run test:perf          # Tests 10k+ product handling
```

## Billing Plans

| Plan | Price | Products/Month | Features |
|------|-------|----------------|----------|
| Free | $0 | 25 | Basic optimization |
| Starter | $9.99 | 100 | + Custom prompts |
| Professional | $29.99 | 500 | + Priority processing |
| Enterprise | $79.99 | Unlimited | + Premium support |

## Error Monitoring

To enable Sentry error tracking, set:

```env
SENTRY_DSN=https://xxx@sentry.io/xxx
```

Errors are automatically captured in routes and the background worker.

## GDPR Compliance

The app handles mandatory Shopify GDPR webhooks:
- `customers/data_request` - Customer data export
- `customers/redact` - Customer data deletion
- `shop/redact` - Complete shop data deletion

See `/app/routes/webhooks.tsx` for implementation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm test`
4. Submit a pull request

## Support

- Email: support@nimbiclabs.com
- GitHub Issues: [Report a bug](https://github.com/your-org/latent-seo/issues)

## License

Proprietary - © 2026 NimbiClabs. All rights reserved.
