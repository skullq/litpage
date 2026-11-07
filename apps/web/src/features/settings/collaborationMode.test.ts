import { describe, it, expect, beforeEach } from 'vitest';

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as any;
}

import { isCollaborationEnabled } from './spaceSettings.ts';
import { normalizeSettingsKey } from './SettingsModal.tsx';
import { personalMode } from '../database/viewState.ts';
import { records } from '../../lib/store/records.ts';
import type { SpaceRecord, BlockRecord, CollectionViewRecord } from '@nc/shared/records.ts';

describe('Web Collaboration Mode', () => {
  const spaceId = 'web-test-space';
  const blockId = 'web-test-db-block';
  const viewId = 'web-test-view';

  beforeEach(() => {
    (records as any).resetForTests?.();
  });

  it('normalizes settings navigation keys based on collaboration mode', () => {
    const spaceWithCollab = {
      id: spaceId,
      name: 'Collab Workspace',
      domain: 'collab-ws',
      pages: [],
      permissions: [{ type: 'user_permission', user_id: 'u1', role: 'editor' }],
      plan_type: 'plus',
      created_by_id: 'u1',
      created_time: Date.now(),
      alive: true,
      settings: { collaboration_enabled: true },
    } as any as SpaceRecord;

    expect(isCollaborationEnabled(spaceWithCollab)).toBe(true);
    expect(normalizeSettingsKey('members', { admin: true, owner: true, enterprise: false, collaboration: true })).toBe('members');
    expect(normalizeSettingsKey('teamspaces', { admin: true, owner: true, enterprise: false, collaboration: true })).toBe('teamspaces');
    expect(normalizeSettingsKey('identity', { admin: true, owner: true, enterprise: false, collaboration: true })).toBe('identity');

    const spaceWithoutCollab: SpaceRecord = {
      ...spaceWithCollab,
      settings: { collaboration_enabled: false },
    };

    expect(isCollaborationEnabled(spaceWithoutCollab)).toBe(false);
    // When collaboration is disabled, collaboration-only sections redirect to 'general'
    expect(normalizeSettingsKey('members', { admin: true, owner: true, enterprise: false, collaboration: false })).toBe('general');
    expect(normalizeSettingsKey('teamspaces', { admin: true, owner: true, enterprise: false, collaboration: false })).toBe('general');
    expect(normalizeSettingsKey('identity', { admin: true, owner: true, enterprise: false, collaboration: false })).toBe('general');
  });

  it('disables database personalMode when collaboration is turned off', () => {
    const spaceWithoutCollab = {
      id: spaceId,
      name: 'Single User Workspace',
      domain: 'single-ws',
      pages: [],
      permissions: [{ type: 'user_permission', user_id: 'u1', role: 'editor' }],
      plan_type: 'plus',
      created_by_id: 'u1',
      created_time: Date.now(),
      alive: true,
      settings: { collaboration_enabled: false },
    } as any as SpaceRecord;

    const block: BlockRecord = {
      id: blockId,
      space_id: spaceId,
      type: 'collection_view_page',
      parent_id: spaceId,
      parent_table: 'space',
      alive: true,
      permissions: [{ type: 'user_permission', user_id: 'u1', role: 'editor' }],
      view_ids: [viewId],
    } as any;

    const view: CollectionViewRecord = {
      id: viewId,
      space_id: spaceId,
      type: 'table',
      name: 'Table View',
      parent_id: blockId,
      parent_table: 'block',
      alive: true,
    } as any;

    records.mergeRecordMap({
      space: { [spaceId]: { value: spaceWithoutCollab } },
      block: { [blockId]: { value: block } },
      collection_view: { [viewId]: { value: view } },
    } as any);

    // When collaboration is disabled, personalMode must be false so changes save directly
    expect(personalMode(view)).toBe(false);
  });
});
