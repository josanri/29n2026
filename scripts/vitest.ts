/**
 * Runs Vitest from the project root with an uppercase Windows drive letter.
 *
 * A terminal can open the project as `c:\…` (VS Code does). Vitest then loads its runner from `c:` and the
 * test files load `vitest` from `C:`: two copies, and every file fails with «Cannot read properties of
 * undefined (reading 'config')». `npm test` runs this script, so the path is always the same.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..').replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const result = spawnSync(process.execPath, [join(root, 'node_modules', 'vitest', 'vitest.mjs'), ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
