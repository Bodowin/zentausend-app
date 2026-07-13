import { describe, expect, it } from 'vitest'
import storageSource from './lib/storage.ts?raw'
import backupSource from './lib/backup.ts?raw'
import cloudSource from './lib/cloud.ts?raw'

describe('history integrity wiring', () => {
  it('validates local history before exposing it to statistics', () => {
    expect(storageSource).toContain('validateGameRecordArray(parsed, \'local\')')
    expect(storageSource).toContain('recordHistoryValidation')
  })

  it('validates every imported backup game', () => {
    expect(backupSource).toContain("validateGameRecordArray(root.games, 'backup')")
    expect(backupSource).not.toContain('filter(isGameRecord)')
  })

  it('validates cloud JSON instead of casting it to GameRecord', () => {
    expect(cloudSource).toContain("validateGameRecordArray((data ?? []).map(rowCandidate), 'cloud')")
    expect(cloudSource).not.toContain("as GameRecord['players']")
  })
})
