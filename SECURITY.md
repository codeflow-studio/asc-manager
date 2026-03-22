# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ASC Manager, please report it responsibly.

**Do not open a public issue.** Instead, email **hello@codeflow.studio** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge your report within 48 hours and aim to release a fix within 7 days for critical issues.

## Security Considerations

ASC Manager handles sensitive credentials (App Store Connect API keys). Keep in mind:

- **Private keys** are stored locally in `data/accounts.json` (gitignored) and never sent to the browser
- **JWTs** are generated server-side and cached until 2 minutes before expiry
- The `/api/accounts` GET endpoint strips secrets -- only `id`, `name`, and `color` are returned
- `.p8` files are gitignored by default

## Best Practices

When running ASC Manager:

- Run behind a reverse proxy (nginx, Caddy) with HTTPS in production
- Restrict network access to trusted users -- the dashboard has no built-in authentication
- Keep dependencies up to date with `npm audit`
- Never commit `data/accounts.json` or `.p8` key files to version control
