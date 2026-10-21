import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { query, withTransaction } from '../../config/database.js';

/*
 * Guides for the knowledge base, written once per database: one folder per
 * language (modules/sms/kb/<lang>.js) with articles in Markdown. Edited or
 * deleted articles are never brought back; a new SEED_VERSION adds only the
 * articles a folder does not have yet (matched by title).
 */

const SEED_KEY = 'sms_kb_seeded';
const SEED_VERSION = '1';
const here = join(dirname(fileURLToPath(import.meta.url)), 'kb');

/** The portal's own host name for the examples in the guides ({{HOST}}), from FRONTEND_URL. */
export function portalHost(url = process.env.FRONTEND_URL) {
  try {
    const host = new URL(String(url || '')).host;
    return host && !/^(localhost|127\.)/.test(host) ? host : 'sms.example.com';
  } catch {
    return 'sms.example.com';
  }
}
const withHost = (text, host) => String(text ?? '').replaceAll('{{HOST}}', host);

async function packs() {
  const files = readdirSync(here).filter((name) => /^[a-z]{2}\.js$/.test(name)).sort();
  const out = [];
  for (const name of files) out.push({ lang: name.slice(0, 2), ...(await import(pathToFileURL(join(here, name)).href)).default });
  // English first, then Russian and Turkish: the order of the folders in the tree.
  const order = ['en', 'ru', 'tr'];
  return out.sort((a, b) => (order.indexOf(a.lang) + 1 || 99) - (order.indexOf(b.lang) + 1 || 99));
}

export async function ensureSmsKnowledgeBase() {
  const tables = await query(`SELECT to_regclass('kb_folders') AS folders`);
  if (!tables.rows[0]?.folders) return;
  const flag = await query(`SELECT value FROM app_settings WHERE key = $1`, [SEED_KEY]);
  if (flag.rows[0]?.value === SEED_VERSION) return;
  const owner = await query(`SELECT id FROM users ORDER BY id LIMIT 1`);
  if (!owner.rows.length) return; // fresh install: after the setup wizard

  const list = await packs();
  const host = portalHost();
  await withTransaction(async (client) => {
    let sort = 0;
    for (const pack of list) {
      sort += 1;
      const found = await client.query(`SELECT id FROM kb_folders WHERE parent_id IS NULL AND name = $1`, [pack.folder.name]);
      let folderId = found.rows[0]?.id;
      if (!folderId) {
        const created = await client.query(
          `INSERT INTO kb_folders (name, description, icon, color, sort, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
          [pack.folder.name, withHost(pack.folder.description, host), pack.folder.icon, pack.folder.color, -100 + sort, owner.rows[0].id]
        );
        folderId = created.rows[0].id;
      }
      let index = 0;
      for (const article of pack.articles) {
        index += 1;
        const exists = await client.query(`SELECT 1 FROM kb_items WHERE folder_id = $1 AND title = $2`, [folderId, article.title]);
        if (exists.rows.length) continue;
        await client.query(
          `INSERT INTO kb_items (folder_id, kind, title, description, content, content_format, sort, created_by, updated_by)
           VALUES ($1, 'article', $2, $3, $4, 'md', $5, $6, $6)`,
          [folderId, article.title, withHost(article.description, host) || null, withHost(article.content, host), index, owner.rows[0].id]
        );
      }
    }
    await client.query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [SEED_KEY, SEED_VERSION]
    );
  });
}
