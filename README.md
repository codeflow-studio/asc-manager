<div align="center">

# ASC Manager

**A web dashboard for managing multiple Apple App Store Connect accounts.**

View apps, versions, in-app purchases, subscriptions, and Xcode Cloud builds -- all from a single interface.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub issues](https://img.shields.io/github/issues/codeflow-studio/asc-manager)](https://github.com/codeflow-studio/asc-manager/issues)
[![GitHub stars](https://img.shields.io/github/stars/codeflow-studio/asc-manager?style=social)](https://github.com/codeflow-studio/asc-manager)

Built with React 18, Express 5, and the App Store Connect API v2.

[Getting Started](#getting-started) · [Features](#features) · [Contributing](CONTRIBUTING.md) · [Report Bug](https://github.com/codeflow-studio/asc-manager/issues/new?template=bug_report.md) · [Request Feature](https://github.com/codeflow-studio/asc-manager/issues/new?template=feature_request.md)

</div>

---

## Features

- **Multi-account support** -- Add multiple App Store Connect accounts and view all apps in one place
- **App overview** -- See app statuses, icons, and metadata at a glance with filtering and grouping
- **Version management** -- Browse version history, create new versions, and submit for review
- **In-app purchases** -- Create, edit, and manage consumable, non-consumable, and non-renewing subscription products with localizations
- **Auto-renewable subscriptions** -- Manage subscription groups, subscription products, and their localizations
- **Xcode Cloud** -- View build runs, workflows, build actions, issues, and logs with a terminal-style log viewer
- **Fast & cached** -- In-memory API response caching with automatic invalidation on mutations

## Architecture

```
Browser --> Vite (5173) --> /api/* proxy --> Express (3001) --> JWT sign --> App Store Connect API
```

- **Frontend**: React 18 + Tailwind CSS v4, bundled with Vite. URL-based routing via `pushState` (no router library).
- **Backend**: Express 5 API proxy. Generates ES256 JWTs per-request, normalizes JSON:API responses into flat objects, and caches responses in memory (5-minute TTL).

## Getting Started

### Prerequisites

- Node.js 18+
- An [App Store Connect API key](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api) (Issuer ID, Key ID, and private key `.p8` file)

### Install

```bash
git clone https://github.com/codeflow-studio/asc-manager.git
cd asc-manager
npm install
```

### Run

Start both servers in separate terminals:

```bash
# Backend API proxy (port 3001)
npm run server

# Frontend dev server (port 5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and add your first account using the **+** button. Paste your Issuer ID, Key ID, and the contents of your `.p8` private key file.

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
server/
  index.js              Express app entry point
  lib/
    account-store.js    Account CRUD with JSON file persistence
    auth.js             ES256 JWT generation with token caching
    asc-client.js       App Store Connect API fetch wrapper
    cache.js            Generic TTL cache
  routes/
    accounts.js         Account management endpoints
    apps.js             App list, versions, lookup, submit
    products.js         IAP and subscription CRUD with localizations
    xcode-cloud.js      Xcode Cloud builds, workflows, actions, logs

src/
  main.jsx              React entry point
  main.css              Tailwind CSS v4 theme and animations
  api/index.js          Frontend API client functions
  constants/index.js    Status maps, color palettes, product types
  components/
    AppStoreManager.jsx Main orchestrator (state + routing)
    AppDetailPage.jsx   App detail view
    VersionDetailPage.jsx Version detail with build selection
    ProductsPage.jsx    IAP and subscription management
    XcodeCloudPage.jsx  Build runs and workflows
    BuildDetailPage.jsx Build detail with actions and log viewer
    ...                 UI components (TopBar, Sidebar, AppGrid, etc.)
```

## Security

- Private keys are stored in `data/accounts.json` (auto-created, gitignored) and never exposed to the browser
- The `/api/accounts` GET endpoint strips secrets -- only `id`, `name`, and `color` are returned
- `.p8` files are gitignored by default
- JWTs are generated server-side and cached until 2 minutes before expiry

## Roadmap

See the [open issues](https://github.com/codeflow-studio/asc-manager/issues) for a list of proposed features and known issues.

## Contributing

Contributions are what make the open source community amazing. Any contributions you make are **greatly appreciated**.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

## Acknowledgments

- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi) by Apple
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Express](https://expressjs.com)

---

<div align="center">

If you find ASC Manager useful, please consider giving it a star on GitHub!

[![Star on GitHub](https://img.shields.io/github/stars/codeflow-studio/asc-manager?style=social)](https://github.com/codeflow-studio/asc-manager)

</div>
