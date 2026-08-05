#!/usr/bin/env node
/**
 * kintone スペーステンプレート(.sptpl)ファイルを展開し、
 * アプリ定義・フィールド・アプリアクション・カスタマイズJSを
 * 正規化したJSONとして書き出す。
 *
 * Usage: node extract.js <input.sptpl> <output.json>
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const SYSTEM_FIELD_TYPES = new Set([
  'MODIFIER', 'CREATOR', 'MODIFIED_AT', 'CREATED_AT',
  'STATUS', 'STATUS_ASSIGNEE', 'CATEGORY',
]);

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#xff08;/g, '(')
    .replace(/&#xff09;/g, ')')
    .replace(/&#xff1a;/g, ':')
    .replace(/&#xff0a;/g, '*')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node extract.js <input.sptpl> <output.json>');
    process.exit(1);
  }
  const absInput = path.resolve(inputPath);
  if (!fs.existsSync(absInput)) {
    console.error('Input file not found:', absInput);
    process.exit(1);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sptpl-'));
  try {
    execFileSync('unzip', ['-o', '-q', absInput, '-d', tmpDir]);

    const templateJsonPath = path.join(tmpDir, 'space', 'template.json');
    if (!fs.existsSync(templateJsonPath)) {
      throw new Error('space/template.json not found in archive: ' + absInput);
    }
    const raw = JSON.parse(fs.readFileSync(templateJsonPath, 'utf-8'));
    const rootData = raw.data;
    const apps = rootData.apps || [];
    const rawActions = rootData.actions || [];

    const nameByUuid = {};
    for (const a of apps) nameByUuid[a.uuid] = a.info.name;

    const outApps = apps.map((a) => {
      const info = a.info;
      const fieldList = Object.values(a.schema.table.fieldList || {});

      const fields = [];
      const referenceTables = [];
      for (const f of fieldList) {
        if (SYSTEM_FIELD_TYPES.has(f.type)) continue;
        const p = f.properties || {};
        const entry = {
          id: f.id,
          label: f.label,
          type: f.type,
          var: f.var,
          required: p.required === 'true' || p.required === true,
        };
        if (Array.isArray(p.options)) entry.options = p.options.map((o) => o.label);
        if (p.unit) entry.unit = p.unit;
        if (f.type === 'REFERENCE_TABLE') {
          referenceTables.push({ label: f.label, var: f.var });
        } else {
          fields.push(entry);
        }
      }

      const jsFiles = [];
      if (a.jsFiles) {
        for (const group of a.jsFiles) {
          for (const meta of group.jsFileMetas || []) {
            let content = null;
            const filePath = path.join(tmpDir, 'space', meta.internalName);
            if (meta.internalName && fs.existsSync(filePath)) {
              try {
                content = fs.readFileSync(filePath, 'utf-8');
              } catch (e) {
                content = null;
              }
            }
            jsFiles.push({ name: meta.name, jsType: group.jsType, content });
          }
        }
      }

      return {
        uuid: a.uuid,
        name: info.name,
        theme: info.theme,
        description: stripHtml(info.description),
        fields,
        referenceTables,
        jsFiles,
        plugins: (a.plugins || []).map((p) => p.id),
        viewCount: (a.views || []).length,
        reportCount: (a.reports || []).length,
      };
    });

    const actions = rawActions.map((act) => ({
      name: act.name,
      actingAppUuid: act.actingAppId,
      actingAppName: nameByUuid[act.actingAppId] || null,
      targetAppUuid: act.targetAppId,
      targetAppName: nameByUuid[act.targetAppId] || null,
      mappingCount: (act.mappings || []).length,
    }));

    const output = {
      sourceFile: path.basename(absInput),
      appCount: outApps.length,
      apps: outApps,
      actions,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Extracted ${outApps.length} apps -> ${outputPath}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
