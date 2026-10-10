// PM2 Ecosystem Config — CampusOS
// Coexists with AIMEsays on the same VPS
//
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup  (then run the printed command)
//
// Logs:
//   pm2 logs campusos-api
//   pm2 monit

module.exports = {
  apps: [
    {
      name: 'campusos-api',
      script: './backend/dist/index.js',
      cwd: '/var/www/campusos',
      
      // Process management
      instances: 1,           // Single instance (increase to 'max' for cluster mode)
      exec_mode: 'fork',      // Use 'cluster' for multi-core on production
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      
      // Logging
      log_file: '/var/log/campusos/combined.log',
      out_file: '/var/log/campusos/out.log',
      error_file: '/var/log/campusos/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Graceful restart
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Restart strategy
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ],

  // Deployment config (optional — for pm2 deploy)
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'YOUR_VPS_IP',
      ref: 'origin/main',
      repo: 'git@github.com:YOUR_USERNAME/campusos.git',
      path: '/var/www/campusos',
      'post-deploy': [
        'cd backend && npm install && npm run build',
        'npx prisma migrate deploy',
        'cd ../frontend && npm install && npm run build',
        'pm2 reload ecosystem.config.js --env production'
      ].join(' && ')
    }
  }
}
