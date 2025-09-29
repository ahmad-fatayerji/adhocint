module.exports = {
  apps: [
    {
      name: "adhocint",
      script: "server.js",
      cwd: "/var/www/adhocint.com/current",
      exec_mode: "cluster",   // enables zero-downtime reloads
      instances: 1,           // increase later if you want
      env: { NODE_ENV: "production", PORT: "3001" },
      watch: false,
      max_restarts: 10,
      exp_backoff_restart_delay: 2000,
    },
  ],
};
