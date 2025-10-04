#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '..', 'murphys.db');

function runSqlJson(sql, params = []) {
  return new Promise((resolvePromise, reject) => {
    const finalSql = bindParams(sql, params);
    const args = ['-json', DB_PATH, finalSql];
    execFile('sqlite3', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        const data = stdout.trim() ? JSON.parse(stdout) : [];
        resolvePromise(data);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function bindParams(sql, params) {
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

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

// ============================================
// ANALYTICS
// ============================================

async function showAnalytics() {
  console.log('\n📊 Murphy\'s Law Statistics\n');

  const stats = await runSqlJson(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'published') AS published,
      COUNT(*) FILTER (WHERE status = 'in_review') AS in_review,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
      COUNT(*) AS total
    FROM laws;
  `);

  const votesStats = await runSqlJson(`
    SELECT
      COUNT(*) FILTER (WHERE vote_type = 'up') AS total_upvotes,
      COUNT(*) FILTER (WHERE vote_type = 'down') AS total_downvotes,
      COUNT(DISTINCT voter_identifier) AS unique_voters
    FROM votes;
  `);

  const recentSubmissions = await runSqlJson(`
    SELECT COUNT(*) AS recent
    FROM laws
    WHERE first_seen_file_path = 'web-submission'
    AND datetime(id) > datetime('now', '-7 days');
  `);

  const s = stats[0] || {};
  const v = votesStats[0] || {};
  const r = recentSubmissions[0] || {};

  console.log(`Total Laws:        ${s.total || 0}`);
  console.log(`  Published:       ${s.published || 0}`);
  console.log(`  In Review:       ${s.in_review || 0}`);
  console.log(`  Rejected:        ${s.rejected || 0}`);
  console.log('');
  console.log(`Total Votes:       ${(v.total_upvotes || 0) + (v.total_downvotes || 0)}`);
  console.log(`  Upvotes:         ${v.total_upvotes || 0}`);
  console.log(`  Downvotes:       ${v.total_downvotes || 0}`);
  console.log(`  Unique Voters:   ${v.unique_voters || 0}`);
  console.log('');
  console.log(`Web Submissions (7d): ${r.recent || 0}`);
  console.log('');
}

// ============================================
// REVIEW PENDING LAWS
// ============================================

async function listInReview() {
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

  const laws = await runSqlJson(sql);

  if (laws.length === 0) {
    console.log('\n✅ No laws pending review!\n');
    return [];
  }

  console.log(`\n📋 ${laws.length} law(s) pending review:\n`);

  laws.forEach((law, idx) => {
    const attributions = JSON.parse(law.attributions);
    console.log(`${idx + 1}. Law #${law.id}`);
    console.log(`   Title: ${law.title || '(no title)'}`);
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

async function reviewPendingLaws() {
  const laws = await listInReview();
  if (laws.length === 0) return;

  while (true) {
    const action = await question('Enter law ID to review, or "q" to return: ');

    if (action.toLowerCase() === 'q') {
      return;
    }

    const lawId = parseInt(action, 10);
    const law = laws.find(l => l.id === lawId);

    if (!law) {
      console.log('❌ Law ID not found in pending review list.\n');
      continue;
    }

    await reviewSingleLaw(law);
  }
}

async function reviewSingleLaw(law) {
  console.log(`\n📝 Reviewing Law #${law.id}:`);
  console.log(`   Title: ${law.title || '(no title)'}`);
  console.log(`   Text: ${law.text}\n`);

  const decision = await question('[a]pprove, [r]eject, [e]dit, [n]ote, or [c]ancel? ');

  if (decision.toLowerCase() === 'a') {
    await updateStatus(law.id, 'published');
    console.log(`✅ Law #${law.id} approved and published!\n`);
  } else if (decision.toLowerCase() === 'r') {
    await updateStatus(law.id, 'rejected');
    console.log(`❌ Law #${law.id} rejected!\n`);
  } else if (decision.toLowerCase() === 'e') {
    await editLaw(law);
  } else if (decision.toLowerCase() === 'n') {
    await addNote(law.id);
  } else {
    console.log('⏭️  Skipped.\n');
  }
}

async function updateStatus(lawId, newStatus) {
  const sql = `UPDATE laws SET status = ? WHERE id = ?`;
  await runSqlJson(sql, [newStatus, lawId]);
}

async function editLaw(law) {
  console.log('\n✏️  Edit Law\n');

  const newTitle = await question(`Title [${law.title || 'none'}]: `);
  const newText = await question(`Text [press Enter to keep current]: `);

  const title = newTitle.trim() || law.title;
  const text = newText.trim() || law.text;

  const sql = `UPDATE laws SET title = ?, text = ? WHERE id = ?`;
  await runSqlJson(sql, [title, text, law.id]);

  console.log(`✅ Law #${law.id} updated!\n`);
}

async function addNote(lawId) {
  const note = await question('Enter admin note: ');
  const sql = `UPDATE laws SET admin_notes = ? WHERE id = ?`;
  await runSqlJson(sql, [note.trim(), lawId]);
  console.log(`✅ Note added to Law #${lawId}!\n`);
}

// ============================================
// MANAGE PUBLISHED LAWS
// ============================================

async function managePublishedLaws() {
  console.log('\n📚 Manage Published Laws\n');

  const searchTerm = await question('Search by keyword (or press Enter for all): ');

  let sql;
  let params;

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

  const laws = await runSqlJson(sql, params);

  if (laws.length === 0) {
    console.log('No published laws found.\n');
    return;
  }

  console.log(`Found ${laws.length} law(s):\n`);
  laws.forEach((law, idx) => {
    console.log(`${idx + 1}. Law #${law.id} - ${law.title || '(no title)'}`);
    console.log(`   ${truncate(law.text, 80)}\n`);
  });

  const lawId = await question('Enter law ID to edit, or "q" to return: ');
  if (lawId.toLowerCase() === 'q') return;

  const selectedLaw = laws.find(l => l.id === parseInt(lawId, 10));
  if (!selectedLaw) {
    console.log('Law not found.\n');
    return;
  }

  await editLaw(selectedLaw);
}

// ============================================
// FIND DUPLICATES
// ============================================

async function findDuplicates() {
  console.log('\n🔍 Finding Duplicate Laws...\n');

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

  const duplicates = await runSqlJson(sql);

  if (duplicates.length === 0) {
    console.log('✅ No exact duplicate laws found!\n');
    return;
  }

  console.log(`Found ${duplicates.length} duplicate pair(s):\n`);

  duplicates.forEach((dup, idx) => {
    console.log(`${idx + 1}. Law #${dup.id1} ⟷ Law #${dup.id2}`);
    console.log(`   Text: ${truncate(dup.text1, 80)}\n`);
  });

  const merge = await question('Enter IDs to merge (format: "keep,delete") or "q": ');
  if (merge.toLowerCase() === 'q') return;

  const [keepId, deleteId] = merge.split(',').map(s => parseInt(s.trim(), 10));

  if (!keepId || !deleteId) {
    console.log('❌ Invalid format.\n');
    return;
  }

  await mergeLaws(keepId, deleteId);
}

async function mergeLaws(keepId, deleteId) {
  console.log(`\n🔀 Merging Law #${deleteId} into Law #${keepId}...\n`);

  // Move attributions
  await runSqlJson(`UPDATE attributions SET law_id = ? WHERE law_id = ?`, [keepId, deleteId]);

  // Move votes
  await runSqlJson(`UPDATE votes SET law_id = ? WHERE law_id = ?`, [keepId, deleteId]);

  // Delete the duplicate
  await runSqlJson(`DELETE FROM laws WHERE id = ?`, [deleteId]);

  console.log(`✅ Laws merged successfully!\n`);
}

// ============================================
// MANAGE ATTRIBUTIONS
// ============================================

async function manageAttributions() {
  console.log('\n👤 Manage Attributions\n');

  const lawId = await question('Enter law ID: ');
  const id = parseInt(lawId, 10);

  if (!id) {
    console.log('❌ Invalid law ID.\n');
    return;
  }

  const attributions = await runSqlJson(`
    SELECT id, name, contact_type, contact_value
    FROM attributions
    WHERE law_id = ?;
  `, [id]);

  console.log(`\nAttributions for Law #${id}:\n`);

  if (attributions.length === 0) {
    console.log('  (none)\n');
  } else {
    attributions.forEach((att, idx) => {
      console.log(`${idx + 1}. ${att.name} (${att.contact_type}: ${att.contact_value || 'none'})`);
    });
    console.log('');
  }

  const action = await question('[a]dd, [d]elete, or [q]uit? ');

  if (action.toLowerCase() === 'a') {
    const name = await question('Name: ');
    const contactType = await question('Contact type (email/url/text): ');
    const contactValue = await question('Contact value (optional): ');

    await runSqlJson(`
      INSERT INTO attributions (law_id, name, contact_type, contact_value)
      VALUES (?, ?, ?, ?);
    `, [id, name.trim(), contactType.trim(), contactValue.trim() || null]);

    console.log('✅ Attribution added!\n');
  } else if (action.toLowerCase() === 'd') {
    const attId = await question('Enter attribution ID to delete: ');
    await runSqlJson(`DELETE FROM attributions WHERE id = ?`, [parseInt(attId, 10)]);
    console.log('✅ Attribution deleted!\n');
  }
}

// ============================================
// HELP
// ============================================

function showHelp() {
  console.log(`
┌────────────────────────────────────────────────────────────────┐
│           Murphy's Law CLI - Help Documentation                │
└────────────────────────────────────────────────────────────────┘

🚀 GETTING STARTED
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 REVIEW PENDING LAWS (Option 1)

  How to use:
    1. Select option [1] from main menu
    2. View list of all pending laws
    3. Enter a law ID to review it
    4. Choose an action:
       [a]pprove → Sets status to "published" (visible on site)
       [r]eject  → Sets status to "rejected" (hidden from site)
       [e]dit    → Edit title and text before approving
       [n]ote    → Add internal admin notes
       [c]ancel  → Skip this law
    5. Enter [q] to return to main menu

  Example workflow:
    Select an option: 1
    Enter law ID to review, or "q" to return: 2369
    [a]pprove, [r]eject, [e]dit, [n]ote, or [c]ancel? e
    Title [none]: The Law of Technology
    Text [press Enter to keep current]: <Enter>
    ✅ Law #2369 updated!
    [a]pprove, [r]eject, [e]dit, [n]ote, or [c]ancel? a
    ✅ Law #2369 approved and published!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 VIEW ANALYTICS (Option 2)

  How to use:
    1. Select option [2] from main menu
    2. View statistics automatically displayed
    3. Press any key to return to main menu

  Statistics shown:
    - Total laws by status (published/in_review/rejected)
    - Vote counts (upvotes, downvotes, unique voters)
    - Recent web submissions (last 7 days)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 MANAGE PUBLISHED LAWS (Option 3)

  How to use:
    1. Select option [3] from main menu
    2. Enter a keyword to search (or press Enter for recent 20)
    3. View list of matching published laws
    4. Enter a law ID to edit it
    5. Update title and/or text
    6. Enter [q] to return to main menu

  Use cases:
    - Fix typos in published laws
    - Update law text for clarity
    - Change or add titles

  Example workflow:
    Select an option: 3
    Search by keyword (or press Enter for all): Murphy
    Found 5 law(s):
    1. Law #42 - Murphy's Original Law
       Anything that can go wrong will go wrong.
    Enter law ID to edit, or "q" to return: 42
    Title [Murphy's Original Law]: Murphy's Original Law
    Text [press Enter to keep current]: <Enter>
    ✅ Law #42 updated!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 FIND & MERGE DUPLICATES (Option 4)

  How to use:
    1. Select option [4] from main menu
    2. View list of duplicate pairs (if any)
    3. Enter IDs to merge in format: "keep_id,delete_id"
    4. Confirm the merge
    5. Enter [q] to return to main menu

  When merging:
    - All votes are moved to the kept law
    - All attributions are moved to the kept law
    - The duplicate law is permanently deleted

  Example workflow:
    Select an option: 4
    Found 1 duplicate pair(s):
    1. Law #42 ⟷ Law #128
       Text: Anything that can go wrong will go wrong.
    Enter IDs to merge (format: "keep,delete") or "q": 42,128
    🔀 Merging Law #128 into Law #42...
    ✅ Laws merged successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 MANAGE ATTRIBUTIONS (Option 5)

  How to use:
    1. Select option [5] from main menu
    2. Enter a law ID
    3. View current attributions for that law
    4. Choose an action:
       [a]dd    → Add a new attribution
       [d]elete → Remove an attribution
       [q]uit   → Return to main menu

  Attribution fields:
    - Name (required): Person or source name
    - Contact type: "email", "url", or "text"
    - Contact value (optional): Email address, URL, or other

  Example workflow:
    Select an option: 5
    Enter law ID: 42
    Attributions for Law #42:
    1. Edward A. Murphy Jr. (text: none)
    [a]dd, [d]elete, or [q]uit? a
    Name: John Doe
    Contact type (email/url/text): email
    Contact value (optional): john@example.com
    ✅ Attribution added!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 TIPS & BEST PRACTICES

  • Use Ctrl+C to force quit at any time
  • Law IDs are permanent and auto-incrementing
  • Published laws appear on the website immediately
  • Rejected laws are kept in the database but hidden
  • Always add notes when rejecting laws for future reference
  • Edit laws before approving if titles are missing
  • Check for duplicates periodically to keep database clean
  • Use analytics to monitor submission trends

`);
}

// ============================================
// MAIN MENU
// ============================================

async function showMenu() {
  console.log(`
┌────────────────────────────────────────┐
│   Murphy's Law CLI - Main Menu         │
└────────────────────────────────────────┘

  [1] 📋 Review Pending Laws
  [2] 📊 View Analytics
  [3] 📚 Manage Published Laws
  [4] 🔍 Find & Merge Duplicates
  [5] 👤 Manage Attributions
  [6] ❓ Help
  [q] ❌ Exit
`);
}

async function main() {
  console.log('🔍 Murphy\'s Law Review Tool\n');

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
        console.log('👋 Goodbye!\n');
        rl.close();
        return;
      default:
        console.log('❌ Invalid option. Try again.\n');
    }
  }
}

// ============================================
// HELPERS
// ============================================

function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

// ============================================
// RUN
// ============================================

main().catch(err => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
