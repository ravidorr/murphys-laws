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

async function listInReview() {
  const sql = `
    SELECT
      l.id,
      l.title,
      l.text,
      l.status,
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
    console.log(`   Text: ${law.text}`);
    if (attributions.length > 0) {
      const att = attributions[0];
      const contact = att.contact_value ? ` (${att.contact_value})` : '';
      console.log(`   Submitted by: ${att.name}${contact}`);
    }
    console.log('');
  });

  return laws;
}

async function updateStatus(lawId, newStatus) {
  const sql = `UPDATE laws SET status = ? WHERE id = ?`;
  await runSqlJson(sql, [newStatus, lawId]);
  console.log(`✅ Law #${lawId} ${newStatus === 'published' ? 'approved' : 'rejected'}!\n`);
}

async function main() {
  console.log('🔍 Murphy\'s Law Review Tool\n');

  const laws = await listInReview();

  if (laws.length === 0) {
    rl.close();
    return;
  }

  while (true) {
    const action = await question('Enter law ID to review, or "q" to quit: ');

    if (action.toLowerCase() === 'q') {
      console.log('👋 Goodbye!\n');
      rl.close();
      return;
    }

    const lawId = parseInt(action, 10);
    const law = laws.find(l => l.id === lawId);

    if (!law) {
      console.log('❌ Law ID not found in pending review list.\n');
      continue;
    }

    console.log(`\n📝 Reviewing Law #${lawId}:`);
    console.log(`   Title: ${law.title || '(no title)'}`);
    console.log(`   Text: ${law.text}\n`);

    const decision = await question('Approve (a), Reject (r), or Cancel (c)? ');

    if (decision.toLowerCase() === 'a') {
      await updateStatus(lawId, 'published');
    } else if (decision.toLowerCase() === 'r') {
      await updateStatus(lawId, 'rejected');
    } else {
      console.log('⏭️  Skipped.\n');
    }

    // Ask if they want to continue
    const more = await question('Review another? (y/n): ');
    if (more.toLowerCase() !== 'y') {
      console.log('👋 Goodbye!\n');
      rl.close();
      return;
    }

    // Refresh the list
    await listInReview();
  }
}

main().catch(err => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
