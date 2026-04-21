import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, 'hedgyyyboo-frontend');
const nextBin = join(frontendDir, 'node_modules', '.bin', 'next');

const child = spawn(nextBin, ['dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  env: { ...process.env, PATH: `/usr/local/bin:${process.env.PATH || ''}` },
});

child.on('exit', (code) => process.exit(code));
