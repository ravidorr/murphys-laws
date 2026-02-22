#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '..', 'murphys.db');

function runSqlJson(sql: string, params: (string | number | null)[] = []): Promise<unknown[]> {
  return new Promise((resolvePromise, reject) => {
    const finalSql = bindParams(sql, params);
    const args = ['-json', DB_PATH, finalSql];
    execFile('sqlite3', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message)));
      try {
        const data = stdout.trim() ? (JSON.parse(stdout) as unknown[]) : [];
        resolvePromise(data);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function bindParams(sql: string, params: (string | number | null)[]): string {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (typeof v === 'number') return String(v);
    if (v === null || v === undefined) return 'NULL';
    const s = String(v).replace(/'/g, "''");
    return `'${s}'`;
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

interface LawRow {
  id: number;
  title: string | null;
  text: string;
  status?: string;
  admin_notes?: string | null;
  first_seen_file_path?: string;
  attributions: string;
}

async function showAnalytics(): Promise<void> {
  console.log("\nMurphy's Law Statistics\n");

  const stats = (await runSqlJson(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'published') AS published,
      COUNT(*) FILTER (WHERE status = 'in_review') AS in_review,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
      COUNT(*) AS total
    FROM laws;
  `)) as Array<Record<string, number>>;

  const votesStats = (await runSqlJson(`
    SELECT
      COUNT(*) FILTER (WHERE vote_type = 'up') AS total_upvotes,
      COUNT(*) FILTER (WHERE vote_type = 'down') AS total_downvotes,
      COUNT(DISTINCT voter_identifier) AS unique_voters
    FROM votes;
  `)) as Array<Record<string, number>>;

  const recentSubmissions = (await runSqlJson(`
    SELECT COUNT(*) AS recent
    FROM laws
    WHERE first_seen_file_path = 'web-submission'
    AND datetime(id) > datetime('now', '-7 days');
  `)) as Array<Record<string, number>>;

  const s = stats[0] ?? {};
  const v = votesStats[0] ?? {};
  const r = recentSubmissions[0] ?? {};

  console.log(`Total Laws:        ${s.total ?? 0}`);
  console.log(`  Published:       ${s.published ?? 0}`);
  console.log(`  In Review:       ${s.in_review ?? 0}`);
  console.log(`  Rejected:        ${s.rejected ?? 0}`);
  console.log('');
  console.log(`Total Votes:       ${(v.total_upvotes ?? 0) + (v.total_downvotes ?? 0)}`);
  console.log(`  Upvotes:         ${v.total_upvotes ?? 0}`);
  console.log(`  Downvotes:       ${v.total_downvotes ?? 0}`);
  console.log(`  Unique Voters:   ${v.unique_voters ?? 0}`);
  console.log('');
  console.log(`Web Submissions (7d): ${r.recent ?? 0}`);
  console.log('');
}

async function listInReview(): Promise<LawRow[]> {
  const sql = `
    SELECT
      l.id,
      l.title,
      l.text,
      l.status,
      l.admin_notes,
      l.first_seen_file_path,
      COALESCE((
        SELECT json_group_array(json_object(
          'name', a.name,
          'contact_type', a.contact_type,
          'contact_value', a.contact_value
        )) FROM attributions a WHERE a.law_id = l.id
      ), '[]') AS attributions
    FROM laws l
    WHERE l.status = 'in_review'
    ORDER BY l.id DESC;
  `;

  const laws = (await runSqlJson(sql)) as LawRow[];

  if (laws.length === 0) {
    console.log('\nNo laws pending review!\n');
    return [];
  }

  console.log(`\n${laws.length} law(s) pending review:\n`);

  laws.forEach((law, idx) => {
    const attributions = JSON.parse(law.attributions) as Array<{ name: string; contact_value?: string }>;
    console.log(`${idx + 1}. Law #${law.id}`);
    console.log(`   Title: ${law.title ?? '(no title)'}`);
    console.log(`   Text: ${truncate(law.text, 100)}`);
    if (attributions.length > 0) {
      const att = attributions[0];
      const contact = att.contact_value ? ` (${att.contact_value})` : '';
      console.log(`   Submitted by: ${att.name}${contact}`);
    }
    if (law.admin_notes) {
      console.log(`   Notes: ${law.admin_notes}`);
    }
    console.log('');
  });

  return laws;
}

async function reviewPendingLaws(): Promise<void> {
  const laws = await listInReview();
  if (laws.length === 0) return;

  while (true) {
    const action = await question('Enter law ID to review, or "q" to return: ');

    if (action.toLowerCase() === 'q') {
      return;
    }

    const lawId = parseInt(action, 10);
    const law = laws.find((l) => l.id === lawId);

    if (!law) {
      console.log('Law ID not found in pending review list.\n');
      continue;
    }

    await reviewSingleLaw(law);
  }
}

async function reviewSingleLaw(law: LawRow): Promise<void> {
  console.log(`\nReviewing Law #${law.id}:`);
  console.log(`   Title: ${law.title ?? '(no title)'}`);
  console.log(`   Text: ${law.text}\n`);

  const decision = await question('[a]pprove, [r]eject, [e]dit, [n]ote, or [c]ancel? ');

  if (decision.toLowerCase() === 'a') {
    await updateStatus(law.id, 'published');
    console.log(`Law #${law.id} approved and published!\n`);
  } else if (decision.toLowerCase() === 'r') {
    await updateStatus(law.id, 'rejected');
    console.log(`Law #${law.id} rejected!\n`);
  } else if (decision.toLowerCase() === 'e') {
    await editLaw(law);
  } else if (decision.toLowerCase() === 'n') {
    await addNote(law.id);
  } else {
    console.log('Skipped.\n');
  }
}

async function updateStatus(lawId: number, newStatus: string): Promise<void> {
  await runSqlJson(`UPDATE laws SET status = ? WHERE id = ?`, [newStatus, lawId]);
}

async function editLaw(law: LawRow): Promise<void> {
  console.log('\nEdit Law\n');

  const newTitle = await question(`Title [${law.title ?? 'none'}]: `);
  const newText = await question(`Text [press Enter to keep current]: `);

  const title = newTitle.trim() || (law.title ?? '');
  const text = newText.trim() || law.text;

  await runSqlJson(`UPDATE laws SET title = ?, text = ? WHERE id = ?`, [title, text, law.id]);

  console.log(`Law #${law.id} updated!\n`);
}

async function addNote(lawId: number): Promise<void> {
  const note = await question('Enter admin note: ');
  await runSqlJson(`UPDATE laws SET admin_notes = ? WHERE id = ?`, [note.trim(), lawId]);
  console.log(`Note added to Law #${lawId}!\n`);
}

async function managePublishedLaws(): Promise<void> {
  console.log('\nManage Published Laws\n');

  const searchTerm = await question('Search by keyword (or press Enter for all): ');

  let sql: string;
  let params: (string | number | null)[];

  if (searchTerm.trim()) {
    const like = `%${searchTerm.trim()}%`;
    sql = `
      SELECT id, title, text
      FROM laws
      WHERE status = 'published'
      AND (text LIKE ? OR COALESCE(title, '') LIKE ?)
      ORDER BY id DESC
      LIMIT 20;
    `;
    params = [like, like];
  } else {
    sql = `
      SELECT id, title, text
      FROM laws
      WHERE status = 'published'
      ORDER BY id DESC
      LIMIT 20;
    `;
    params = [];
  }

  const laws = (await runSqlJson(sql, params)) as LawRow[];

  if (laws.length === 0) {
    console.log('No published laws found.\n');
    return;
  }

  console.log(`Found ${laws.length} law(s):\n`);
  laws.forEach((law, idx) => {
    console.log(`${idx + 1}. Law #${law.id} - ${law.title ?? '(no title)'}`);
    console.log(`   ${truncate(law.text, 80)}\n`);
  });

  const lawId = await question('Enter law ID to edit, or "q" to return: ');
  if (lawId.toLowerCase() === 'q') return;

  const selectedLaw = laws.find((l) => l.id === parseInt(lawId, 10));
  if (!selectedLaw) {
    console.log('Law not found.\n');
    return;
  }

  await editLaw(selectedLaw);
}

interface DuplicateRow {
  id1: number;
  title1: string | null;
  text1: string;
  id2: number;
  title2: string | null;
  text2: string;
}

async function findDuplicates(): Promise<void> {
  console.log('\nFinding Duplicate Laws...\n');

  const sql = `
    SELECT
      l1.id AS id1,
      l1.title AS title1,
      l1.text AS text1,
      l2.id AS id2,
      l2.title AS title2,
      l2.text AS text2
    FROM laws l1
    JOIN laws l2 ON l1.text = l2.text AND l1.id < l2.id
    WHERE l1.status = 'published' AND l2.status = 'published'
    ORDER BY l1.id;
  `;

  const duplicates = (await runSqlJson(sql)) as DuplicateRow[];

  if (duplicates.length === 0) {
    console.log('No exact duplicate laws found!\n');
    return;
  }

  console.log(`Found ${duplicates.length} duplicate pair(s):\n`);

  duplicates.forEach((dup, idx) => {
    console.log(`${idx + 1}. Law #${dup.id1} and Law #${dup.id2}`);
    console.log(`   Text: ${truncate(dup.text1, 80)}\n`);
  });

  const merge = await question('Enter IDs to merge (format: "keep,delete") or "q": ');
  if (merge.toLowerCase() === 'q') return;

  const parts = merge.split(',').map((s) => parseInt(s.trim(), 10));
  const keepId = parts[0];
  const deleteId = parts[1];

  if (!keepId || !deleteId) {
    console.log('Invalid format.\n');
    return;
  }

  await mergeLaws(keepId, deleteId);
}

async function mergeLaws(keepId: number, deleteId: number): Promise<void> {
  console.log(`\nMerging Law #${deleteId} into Law #${keepId}...\n`);

  await runSqlJson(`UPDATE attributions SET law_id = ? WHERE law_id = ?`, [keepId, deleteId]);
  await runSqlJson(`UPDATE votes SET law_id = ? WHERE law_id = ?`, [keepId, deleteId]);
  await runSqlJson(`DELETE FROM laws WHERE id = ?`, [deleteId]);

  console.log('Laws merged successfully!\n');
}

async function manageAttributions(): Promise<void> {
  console.log('\nManage Attributions\n');

  const lawId = await question('Enter law ID: ');
  const id = parseInt(lawId, 10);

  if (!id) {
    console.log('Invalid law ID.\n');
    return;
  }

  const attributions = (await runSqlJson(
    `
    SELECT id, name, contact_type, contact_value
    FROM attributions
    WHERE law_id = ?;
  `,
    [id]
  )) as Array<{ id: number; name: string; contact_type: string; contact_value: string | null }>;

  console.log(`\nAttributions for Law #${id}:\n`);

  if (attributions.length === 0) {
    console.log('  (none)\n');
  } else {
    attributions.forEach((att, idx) => {
      console.log(`${idx + 1}. ${att.name} (${att.contact_type}: ${att.contact_value ?? 'none'})`);
    });
    console.log('');
  }

  const action = await question('[a]dd, [d]elete, or [q]uit? ');

  if (action.toLowerCase() === 'a') {
    const name = await question('Name: ');
    const contactType = await question('Contact type (email/url/text): ');
    const contactValue = await question('Contact value (optional): ');

    await runSqlJson(
      `
      INSERT INTO attributions (law_id, name, contact_type, contact_value)
      VALUES (?, ?, ?, ?);
    `,
      [id, name.trim(), contactType.trim(), contactValue.trim() || null]
    );

    console.log('Attribution added!\n');
  } else if (action.toLowerCase() === 'd') {
    const attId = await question('Enter attribution ID to delete: ');
    await runSqlJson(`DELETE FROM attributions WHERE id = ?`, [parseInt(attId, 10)]);
    console.log('Attribution deleted!\n');
  }
}

function showHelp(): void {
  console.log(`
+----------------------------------------------------------------+
|           Murphy's Law CLI - Help Documentation                |
+----------------------------------------------------------------+

GETTING STARTED
  To run the CLI:
    $ npm run review

  From the main menu, select an option by entering its number:
    [1] Review Pending Laws
    [2] View Analytics
    [3] Manage Published Laws
    [4] Find & Merge Duplicates
    [5] Manage Attributions
    [6] Help
    [q] Exit

TIPS & BEST PRACTICES

  Use Ctrl+C to force quit at any time
  Law IDs are permanent and auto-incrementing
  Published laws appear on the website immediately
  Rejected laws are kept in the database but hidden
  Always add notes when rejecting laws for future reference
  Edit laws before approving if titles are missing
  Check for duplicates periodically to keep database clean
  Use analytics to monitor submission trends

`);
}

async function showMenu(): Promise<void> {
  console.log(`
+----------------------------------------+
|   Murphy's Law CLI - Main Menu         |
+----------------------------------------+

  [1] Review Pending Laws
  [2] View Analytics
  [3] Manage Published Laws
  [4] Find & Merge Duplicates
  [5] Manage Attributions
  [6] Help
  [q] Exit
`);
}

function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

async function main(): Promise<void> {
  console.log("Murphy's Law Review Tool\n");

  while (true) {
    await showMenu();
    const choice = await question('Select an option: ');

    switch (choice.trim()) {
      case '1':
        await reviewPendingLaws();
        break;
      case '2':
        await showAnalytics();
        break;
      case '3':
        await managePublishedLaws();
        break;
      case '4':
        await findDuplicates();
        break;
      case '5':
        await manageAttributions();
        break;
      case '6':
        showHelp();
        break;
      case 'q':
      case 'Q':
        console.log('Goodbye!\n');
        rl.close();
        return;
      default:
        console.log('Invalid option. Try again.\n');
    }
  }
}

main().catch((err) => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
