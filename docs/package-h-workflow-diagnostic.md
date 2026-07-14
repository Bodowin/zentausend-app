# Paket H – Workflow-Diagnose

Patch: failure
Unit: skipped
Build: skipped
Chromium: skipped
E2E: skipped

## package-h-patch.log
```text
/home/runner/work/zentausend-app/zentausend-app/scripts/apply-family-sync-main.mjs:88
    `      {/* Sync-Status */}\n      <div className="mb-4 flex items-center gap-2 text-[11px]">\n        <span\n          className={\`inline-block h-2 w-2 rounded-full ${\n            loading\n              ? 'animate-pulse bg-gold-500'\n              : pendingSync > 0\n                ? 'bg-gold-500'\n                : online\n                  ? 'bg-mint-400'\n                  : 'bg-fog-600'\n          }\`}\n        />\n        <span className="text-fog-500">\n          {loading\n            ? 'Synchronisiere mit der Cloud…'\n            : codeDenied\n              ? 'Clique-Code ungültig – in Einstellungen erneuern'\n              : pendingSync > 0\n              ? \`${'${pendingSync}'} ${'${pendingSync === 1 ? \'Änderung wartet\' : \'Änderungen warten\'}'} auf Cloud\`\n              : online\n                ? 'Mit Cloud synchronisiert · auf allen Geräten gleich'\n                : cloudEnabled\n                  ? 'Offline – nur dieses Gerät'\n                  : 'Lokal – nur dieses Gerät'}\n        </span>\n      </div>`,
                                                                                                                                                                            ^

SyntaxError: Invalid or unexpected token
    at checkSyntax (node:internal/main/check_syntax:74:5)

Node.js v22.23.1
```
