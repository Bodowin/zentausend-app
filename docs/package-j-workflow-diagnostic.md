# Paket J – Workflow-Diagnose

Patch: failure
Unit: skipped
Build: skipped
Chromium: skipped
E2E: skipped

## package-j-patch.log
```text
file:///home/runner/work/zentausend-app/zentausend-app/scripts/apply-safe-resume.mjs:5
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
                         ^

Error: safe start handler: expected 1 match, found 2
    at replaceOnce (file:///home/runner/work/zentausend-app/zentausend-app/scripts/apply-safe-resume.mjs:5:26)
    at file:///home/runner/work/zentausend-app/zentausend-app/scripts/apply-safe-resume.mjs:270:12
    at update (file:///home/runner/work/zentausend-app/zentausend-app/scripts/apply-safe-resume.mjs:19:16)
    at file:///home/runner/work/zentausend-app/zentausend-app/scripts/apply-safe-resume.mjs:256:1
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5)

Node.js v22.23.1
```
