import { execSync } from 'child_process';
import { spawn } from 'child_process';

// Ensure node is findable by Turbopack's child processes
const env = { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` };

const port = process.argv[2] || '3001';
const child = spawn(process.execPath, ['node_modules/.bin/next', 'dev', '-p', port], {
  stdio: 'inherit',
  env,
  cwd: import.meta.dirname,
});

child.on('exit', (code) => process.exit(code || 0));
