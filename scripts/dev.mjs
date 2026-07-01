// מריץ שרת ולקוח במקביל לפיתוח מקומי (ללא תלות חיצונית)
import { spawn } from 'child_process';

const procs = [
  { name: 'server', cmd: 'npm', args: ['--prefix', 'server', 'run', 'dev'], color: '\x1b[32m' },
  { name: 'client', cmd: 'npm', args: ['--prefix', 'client', 'run', 'dev'], color: '\x1b[36m' },
];

const children = procs.map((p) => {
  const child = spawn(p.cmd, p.args, { cwd: new URL('..', import.meta.url).pathname, shell: false });
  const tag = `${p.color}[${p.name}]\x1b[0m`;
  child.stdout.on('data', (d) => process.stdout.write(`${tag} ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`${tag} ${d}`));
  child.on('exit', (code) => console.log(`${tag} exited (${code})`));
  return child;
});

const kill = () => children.forEach((c) => c.kill('SIGTERM'));
process.on('SIGINT', () => { kill(); process.exit(0); });
process.on('SIGTERM', () => { kill(); process.exit(0); });
