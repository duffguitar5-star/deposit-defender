/**
 * Migration Script: cases.json → per-case folders
 *
 * Migrates from single cases.json file to per-case folder structure
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const oldDataFile = path.join(__dirname, '..', '..', 'data', 'cases.json');
const newDataDir = path.join(__dirname, '..', '..', 'data', 'cases');

async function migrate() {
  console.log('Starting migration from cases.json to per-case folders...');

  // Check if old file exists
  if (!fsSync.existsSync(oldDataFile)) {
    console.log('No cases.json found - nothing to migrate.');
    return;
  }

  // Read old data
  const oldData = JSON.parse(await fs.readFile(oldDataFile, 'utf8'));
  const caseIds = Object.keys(oldData);

  console.log(`Found ${caseIds.length} cases to migrate.`);

  // Ensure new data directory exists
  await fs.mkdir(newDataDir, { recursive: true });

  let migratedCount = 0;

  for (const caseId of caseIds) {
    const caseData = oldData[caseId];
    const caseDir = path.join(newDataDir, caseId);

    try {
      // Create case directory
      await fs.mkdir(caseDir, { recursive: true });

      // Write case.json
      const casePath = path.join(caseDir, 'case.json');
      await fs.writeFile(casePath, JSON.stringify(caseData, null, 2), 'utf8');

      // If report exists, write report.json
      if (caseData.analysisReport) {
        const reportPath = path.join(caseDir, 'report.json');
        await fs.writeFile(reportPath, JSON.stringify(caseData.analysisReport, null, 2), 'utf8');
      }

      migratedCount++;
      console.log(`Migrated case: ${caseId}`);
    } catch (error) {
      console.error(`Failed to migrate case ${caseId}:`, error.message);
    }
  }

  console.log(`Migration complete! Migrated ${migratedCount}/${caseIds.length} cases.`);

  // Backup old file
  const backupPath = oldDataFile + '.backup';
  await fs.rename(oldDataFile, backupPath);
  console.log(`Old cases.json backed up to: ${backupPath}`);
}

// Run if called directly
if (require.main === module) {
  migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { migrate };
