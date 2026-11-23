/**
 * The positional parameters of every system template must match, one for one,
 * the {{1}}, {{2}} … of its approved counterpart at Meta.
 *
 * Meta counts the parameters it is sent; it does not name them. When the count
 * differs from the body it approved it rejects the whole message (error
 * 132000) — which is what five of these seven templates would have done, since
 * they declared values their text never prints. The values are now read from
 * the body itself, and this check is what keeps the two in step: reword a
 * template without re-registering it at Meta and this fails instead of the
 * customer's message.
 *
 * Needs `npm run build` first, so the function under test is the one that runs
 * in production.
 *
 * Run: npm run check:templates
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const built = join(here, '..', 'dist', 'modules', 'messaging', 'messaging.service.js');

if (!existsSync(built)) {
  console.error('dist is missing — run `npm run build` first.');
  process.exit(1);
}

const { placeholdersOf } = await import(pathToFileURL(built).href);

// Registered at Meta on 2026-11-23 under WABA 1839114450085607, language ar.
const EXPECTED = {
  JOB_WAITING_APPROVAL: ['customerName', 'vehicle', 'plateNumber', 'jobNumber', 'cost'],
  JOB_COMPLETED: ['customerName', 'vehicle', 'plateNumber', 'jobNumber'],
  JOB_DELIVERED: ['customerName', 'vehicle', 'plateNumber', 'jobNumber'],
  SUBSCRIPTION_EXPIRING: ['customerName', 'planName', 'endDate'],
  DOCUMENT_EXPIRING: ['customerName', 'documentTitle', 'plateNumber', 'expiryDate'],
  APPOINTMENT_CONFIRMED: ['date', 'time', 'reference'],
  APPOINTMENT_REMINDER: ['customerName', 'date', 'time', 'reference'],
};

/** The seeded templates, read from the seed so no database is needed. */
function seededTemplates() {
  const source = readFileSync(join(here, '..', 'prisma', 'seed-reference.ts'), 'utf8');
  const start = source.indexOf('const TEMPLATES = [');
  const block = source.slice(start, source.indexOf('\n];', start));

  const pattern =
    /code: '([A-Z_]+)',[\s\S]*?bodyAr:\s*\n?\s*'((?:[^'\\]|\\.)*)'[\s\S]*?bodyEn:\s*\n?\s*'((?:[^'\\]|\\.)*)'/g;

  return Array.from(block.matchAll(pattern), m => ({
    code: m[1],
    bodyAr: m[2].replace(/\\n/g, '\n'),
    bodyEn: m[3].replace(/\\n/g, '\n'),
  }));
}

const templates = seededTemplates();
let failures = 0;

for (const [code, expected] of Object.entries(EXPECTED)) {
  const template = templates.find(t => t.code === code);
  if (!template) {
    console.error(`✗ ${code}: not in the seed`);
    failures++;
    continue;
  }

  const ar = placeholdersOf(template.bodyAr);
  const en = placeholdersOf(template.bodyEn);

  if (ar.join(',') !== expected.join(',')) {
    console.error(`✗ ${code}: Arabic body has [${ar}], Meta expects [${expected}]`);
    failures++;
    continue;
  }

  // Both languages share one approved template at Meta, so they must agree on
  // which value lands in which position.
  if (en.join(',') !== expected.join(',')) {
    console.error(`✗ ${code}: English body has [${en}], Arabic has [${expected}]`);
    failures++;
    continue;
  }

  console.log(`✓ ${code}: ${ar.length} params — ${ar.join(', ')}`);
}

if (templates.length !== Object.keys(EXPECTED).length) {
  console.error(
    `✗ the seed has ${templates.length} templates but ${Object.keys(EXPECTED).length} are registered at Meta`,
  );
  failures++;
}

if (failures) {
  console.error(`\n${failures} template(s) would be rejected by Meta.`);
  process.exit(1);
}
console.log(`\nall ${templates.length} templates line up with Meta.`);
