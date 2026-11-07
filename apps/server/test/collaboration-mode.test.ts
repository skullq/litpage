import { describe, it, expect, beforeEach } from 'vitest';
import { db, getRecord, putRecord } from '../src/db.ts';
import { isCollaborationEnabled, policyProblem } from '../src/policy.ts';
import { handlers as coreHandlers } from '../src/api/handlers.ts';
import { applyTransactions } from '../src/records.ts';
import type { SpaceRecord, CollectionRecord, BlockRecord } from '@nc/shared/records.ts';

describe('Collaboration Mode toggle', () => {
  const spaceId = 'test-collab-space';
  const ownerId = 'user-owner';
  const otherId = 'user-other';

  beforeEach(() => {
    db.prepare('DELETE FROM records WHERE space_id = ?').run(spaceId);
    db.prepare('DELETE FROM records WHERE id = ?').run(spaceId);

    const space: SpaceRecord = {
      id: spaceId,
      name: 'Test Collab Space',
      domain: 'collab-test',
      pages: [],
      permissions: [
        { type: 'user_permission', user_id: ownerId, role: 'owner' },
        { type: 'user_permission', user_id: otherId, role: 'editor' },
      ],
      plan_type: 'plus',
      created_by_id: ownerId,
      created_time: Date.now(),
      alive: true,
      settings: {},
    };
    putRecord('space', space);
  });

  it('defaults to collaboration enabled', () => {
    const space = getRecord<SpaceRecord>('space', spaceId);
    expect(isCollaborationEnabled(space)).toBe(true);
    expect(policyProblem(space, 'invite_guest', ownerId)).toBeNull();
    expect(policyProblem(space, 'create_teamspace', ownerId)).toBeNull();
  });

  it('blocks invitations and team creation when collaboration is disabled', () => {
    const space = getRecord<SpaceRecord>('space', spaceId)!;
    space.settings = { collaboration_enabled: false };
    putRecord('space', space);

    const updated = getRecord<SpaceRecord>('space', spaceId);
    expect(isCollaborationEnabled(updated)).toBe(false);

    // policyProblem rejects collaboration actions
    expect(policyProblem(updated, 'invite_guest', ownerId)).toContain('Collaboration is disabled');
    expect(policyProblem(updated, 'create_teamspace', ownerId)).toContain('Collaboration is disabled');
    expect(policyProblem(updated, 'create_group', ownerId)).toContain('Collaboration is disabled');

    // handlers reject member invites
    expect(() => {
      coreHandlers.inviteMembers({ userId: ownerId } as any, {
        spaceId,
        emails: ['newuser@example.com'],
        role: 'editor',
      });
    }).toThrow('Collaboration is disabled');
  });

  it('enforces database person property restrictions when collaboration is disabled', () => {
    const space = getRecord<SpaceRecord>('space', spaceId)!;
    space.settings = { collaboration_enabled: false };
    putRecord('space', space);

    const blockId = 'db-block';
    const colId = 'test-col';
    const pageBlock: BlockRecord = {
      id: blockId,
      space_id: spaceId,
      type: 'collection_view_page',
      parent_id: spaceId,
      parent_table: 'space',
      alive: true,
      permissions: [{ type: 'user_permission', user_id: ownerId, role: 'editor' }],
      collection_id: colId,
      view_ids: [],
    };
    putRecord('block', pageBlock);

    const collection: CollectionRecord = {
      id: colId,
      space_id: spaceId,
      name: 'Tasks',
      schema: {
        title: { name: 'Name', type: 'title' },
      },
      parent_id: blockId,
      parent_table: 'block',
      alive: true,
    };
    putRecord('collection', collection);

    // Attempting to add a 'person' property in collection schema via client transaction
    expect(() => {
      applyTransactions(ownerId, [{
        operations: [{
          pointer: { table: 'collection', id: colId, spaceId },
          path: ['schema', 'assignee'],
          command: 'set',
          args: { name: 'Assignee', type: 'person' },
        }],
      }], undefined, { client: true });
    }).toThrow('Person properties cannot be added when collaboration is disabled');
  });
});
