module.exports = {
  apps: [
    {
      name: 'murphys-api',
      script: 'scripts/api-server.mjs',
      cwd: '/root/murphys-laws',
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
    },
    {
      name: 'murphys-frontend',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 5175',
      cwd: '/root/murphys-laws',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      error_file: 'logs/frontend-error.log',
      out_file: 'logs/frontend-out.log',
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
