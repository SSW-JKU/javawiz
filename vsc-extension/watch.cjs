const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Batch files require a shell on Windows; Unix executes the Gradle wrapper directly.
const windows = process.platform === 'win32';
const root = path.resolve(__dirname, '..');
const build = spawnSync(windows ? './gradlew.bat' : './gradlew',
  ['clean', 'build', '-PexcludeTests'], { cwd: root, stdio: 'inherit', shell: windows });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const watch = spawnSync(windows ? 'tsc.cmd' : 'tsc', ['-watch', '-p', './'],
  { cwd: __dirname, stdio: 'inherit', shell: windows });
if (watch.error) throw watch.error;
process.exit(watch.status ?? 1);
