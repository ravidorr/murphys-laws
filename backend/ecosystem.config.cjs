/**
 * PM2 Ecosystem Configuration
 *
 * CRITICAL: The interpreter path must match the Node.js version used to
 * compile native modules (better-sqlite3). Mismatches cause MODULE_VERSION
 * errors and 502 Bad Gateway responses.
 *
 * IMPORTANT: The system Node.js (/usr/bin/node) must be a symlink to this
 * version, as PM2 may ignore the interpreter setting in some cases.
 *
 * NOTE: Frontend is served directly by Nginx from /root/murphys-laws/web/dist
 * No Vite preview server is needed in production.
 *
 * See: shared/docs/PREVENTING-502-ERRORS.md
 */
module.exports = {
  apps: [
    {
      name: 'murphys-api',
      // Run backend TypeScript entrypoint through local tsx CLI.
      script: './node_modules/tsx/dist/cli.mjs',
      args: './src/server/api-server.ts',
      // CRITICAL: Must match system Node.js version
      interpreter: '/root/.nvm/versions/node/v22.20.0/bin/node',
      cwd: '/root/murphys-laws/backend',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      // Memory and resource limits
      max_memory_restart: '500M',
      // Exponential backoff for restarts
      exp_backoff_restart_delay: 100,
      // Monitoring
      listen_timeout: 10000,
      kill_timeout: 5000
    }
  ]
};
