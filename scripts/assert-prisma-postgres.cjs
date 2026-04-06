/**
 * Build guard: fail if datasource `db` is not PostgreSQL (catches wrong cwd or stale copies).
 */
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const s = fs.readFileSync(schemaPath, 'utf8');
const block = s.match(/datasource\s+db\s*\{[\s\S]*?\n\}/);
if (!block || !/provider\s*=\s*"postgresql"/.test(block[0])) {
  console.error(
    '[assert-prisma-postgres] prisma/schema.prisma: datasource db must use provider = "postgresql".',
  );
  process.exit(1);
}
