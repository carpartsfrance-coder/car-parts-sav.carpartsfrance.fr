#!/usr/bin/env node
/*
  Migration: importer les fichiers Markdown de admin/docs vers MongoDB
  Utilisation: npm run migrate-docs
*/
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const Documentation = require('../models/documentation');

const docsBaseDir = path.join(__dirname, '../../admin/docs');

function safeDocAbsolutePath(relPath = '') {
  const cleaned = path.normalize(String(relPath).replace(/^\/+/, ''));
  const abs = path.join(docsBaseDir, cleaned);
  if (!abs.startsWith(docsBaseDir)) {
    throw new Error('Chemin en dehors du répertoire docs');
  }
  if (!cleaned.toLowerCase().endsWith('.md')) {
    throw new Error('Seuls les fichiers .md sont autorisés');
  }
  return abs;
}

async function listMarkdownFilesRecursive(dir, basePrefix = '') {
  const out = [];
  let entries = [];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    const rel = path.join(basePrefix, ent.name);
    if (ent.isDirectory()) {
      const nested = await listMarkdownFilesRecursive(abs, rel);
      out.push(...nested);
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) {
      try {
        const st = await fs.promises.stat(abs);
        out.push({
          path: rel.replace(/\\/g, '/'),
          name: ent.name,
          size: st.size,
          mtime: st.mtimeMs
        });
      } catch {}
    }
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

(async function run() {
  try {
    await connectDB();
    console.log('[migrate-docs] Connexion DB OK');
    const list = await listMarkdownFilesRecursive(docsBaseDir, '');
    if (!list || list.length === 0) {
      console.log('[migrate-docs] Aucun fichier .md trouvé dans admin/docs');
      await mongoose.connection.close();
      return;
    }
    let imported = 0;
    for (const f of list) {
      const abs = safeDocAbsolutePath(f.path);
      let content = '';
      try {
        content = await fs.promises.readFile(abs, 'utf8');
      } catch (e) {
        console.warn('[migrate-docs] Lecture échouée pour', f.path, e && e.message ? e.message : e);
        continue;
      }
      const size = Buffer.byteLength(String(content || ''), 'utf8');
      const name = path.basename(f.path);
      await Documentation.updateOne(
        { path: f.path },
        { $set: { path: f.path, name, content, size } },
        { upsert: true }
      );
      imported++;
    }
    console.log(`[migrate-docs] Import terminé: ${imported} documents importés.`);
    await mongoose.connection.close();
  } catch (e) {
    console.error('[migrate-docs] Erreur:', e && e.message ? e.message : e);
    try { await mongoose.connection.close(); } catch {}
    process.exit(1);
  }
})();
