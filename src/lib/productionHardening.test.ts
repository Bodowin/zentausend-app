import { describe, expect, it } from 'vitest'
import { evaluateDeviceHealth, type DeviceHealthReport } from './deviceHealth'
import {
  readRuntimeDiagnostics,
  recordRuntimeDiagnostic,
  runtimeDiagnosticSummary,
  sanitizeDiagnosticMessage,
} from './runtimeDiagnostics'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
}

const healthy: DeviceHealthReport = {
  checkedAt: '2026-07-15T10:00:00.000Z',
  storageWritable: true,
  online: true,
  serviceWorkerSupported: true,
  serviceWorkerControlled: true,
  standalone: true,
  persisted: true,
  usageBytes: 1024,
  quotaBytes: 1024 * 1024,
}

describe('production hardening', () => {
  it('redacts family and admin codes from diagnostics', () => {
    const message = sanitizeDiagnosticMessage('Failed for FAMILIE-10000-26 and ADMIN-SECRET-999?token=abc123')
    expect(message).not.toContain('FAMILIE-10000-26')
    expect(message).not.toContain('ADMIN-SECRET-999')
    expect(message).not.toContain('abc123')
    expect(message).toContain('[CODE]')
    expect(message).toContain('[REDACTED]')
  })

  it('keeps only the latest twenty diagnostics', () => {
    const storage = new MemoryStorage()
    for (let index = 0; index < 25; index += 1) {
      recordRuntimeDiagnostic('promise', `failure-${index}`, {}, storage)
    }
    const entries = readRuntimeDiagnostics(storage)
    expect(entries).toHaveLength(20)
    expect(entries[0].message).toBe('failure-5')
    expect(entries[19].message).toBe('failure-24')
    expect(runtimeDiagnosticSummary(storage)).toContain('failure-24')
  })

  it('treats blocked local storage as a hard error and offline as a warning', () => {
    expect(evaluateDeviceHealth(healthy)).toBe('ok')
    expect(evaluateDeviceHealth({ ...healthy, online: false })).toBe('warning')
    expect(evaluateDeviceHealth({ ...healthy, storageWritable: false })).toBe('error')
  })
})
