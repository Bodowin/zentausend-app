import { describe, expect, it } from 'vitest'
import cloudSource from './lib/cloud.ts?raw'
import identitySource from './lib/playerIdentity.ts?raw'
import statsSource from './components/StatsScreen.tsx?raw'
import supabaseSource from './lib/supabase.ts?raw'

describe('cloud player identity wiring', () => {
  it('syncs identities as part of the normal cloud merge', () => {
    expect(cloudSource).toContain("import { syncPlayerIdentityState } from './playerIdentityCloud'")
    expect(cloudSource).toContain('export async function syncCloudPrerequisites')
    expect(cloudSource).toContain('Promise.all([identityTask(), gamesTask()])')
    expect(cloudSource).toContain('const { identity, fetched } = await syncCloudPrerequisites()')
    expect(cloudSource).toContain('codeDenied: identity.denied')
  })

  it('marks every local identity write dirty and permits clean cloud replacement', () => {
    expect(identitySource).toContain("import { markPlayerIdentityDirty } from './playerIdentitySyncMeta'")
    expect(identitySource).toContain('if (markDirty) markPlayerIdentityDirty()')
    expect(identitySource).toContain('export function replacePlayerIdentityState')
  })

  it('surfaces invalid codes and immediately reloads after profile changes', () => {
    expect(statsSource).toContain('Crew-Code prüfen')
    expect(statsSource).toContain('void reload()')
  })

  it('recreates the Supabase client whenever stored codes change', () => {
    expect(supabaseSource).toContain('const cacheKey = `${code}')
    expect(supabaseSource).toContain("headers['x-clique-code'] = code")
  })
})
