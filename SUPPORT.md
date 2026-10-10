# Support

- Bugs and feature requests: open a GitHub issue.
- Questions: [contact@murphys-laws.com](mailto:contact@murphys-laws.com).
- Security issues: see [SECURITY.md](./SECURITY.md).

## Troubleshooting

- Wrong Node version: run `nvm install && nvm use`.
- Hooks fail: run the command named in the hook output. Common checks are
  `npm run lint`, `npm run check:versions`, `npm run check:staged-coverage`,
  `npm run test:web:e2e`, and `npm run audit:full`. Do not bypass hooks.
