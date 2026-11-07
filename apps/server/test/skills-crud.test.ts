import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

process.env.NC_DATA_DIR = mkdtempSync(join(tmpdir(), 'nc-skills-crud-test-'));
process.env.NC_SCHEDULER = '0';

let db: typeof import('../src/db.ts');
let skills: typeof import('../src/ai/skills.ts');
let H: Record<string, (ctx: any, body: any) => any>;
let newId: () => string;
const ids = {} as Record<string, string>;
const ctx = (userId: string) => ({ userId, setCookie: () => {} });

beforeAll(async () => {
  ({ newId } = await import('@nc/shared/ids.ts'));
  await import('../src/app.ts');
  H = (await import('../src/api/handlers.ts')).handlers as any;
  await import('../src/api/modules/ai.ts');
  const seed = await import('../src/seed.ts');
  db = await import('../src/db.ts');
  skills = await import('../src/ai/skills.ts');
  ids.A = newId();
  seed.createUser(ids.A, 'alice@skills.dev', 'Alice');
  ids.space = seed.createWorkspace(ids.A, 'Skills Workspace').space.id;
});

describe('Skills CRUD and Enable/Disable in Library', () => {
  it('creates a new custom skill with title, description, and instructions', async () => {
    const res = await H.aiCreateSkill(ctx(ids.A), {
      spaceId: ids.space,
      title: 'Cisco Routing Validator',
      description: 'Checks OSPF and BGP configurations for common errors',
      instructions: 'Examine routing protocols and ensure all neighbor statements have matching AS numbers.',
      icon: '🌐',
    });
    expect(res).toHaveProperty('pageId');
    ids.createdSkillPage = res.pageId;

    const list = await H.aiListSkills(ctx(ids.A), { spaceId: ids.space });
    const found = list.enabled.find((s: any) => s.id === res.pageId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Cisco Routing Validator');
    expect(found.description).toBe('Checks OSPF and BGP configurations for common errors');
    expect(found.instructions).toContain('Examine routing protocols');
    expect(found.enabled).toBe(true);
    expect(found.builtin).toBe(false);
  });

  it('updates an existing custom skill', async () => {
    const updateRes = await H.aiUpdateSkill(ctx(ids.A), {
      spaceId: ids.space,
      skillId: ids.createdSkillPage,
      name: 'Cisco Advanced Routing Validator',
      description: 'Updated description for OSPF, EIGRP and BGP validation',
      instructions: 'Updated instructions: Also check MTU mismatch and timer settings.',
      icon: '⚡',
    });
    expect(updateRes.ok).toBe(true);

    const list = await H.aiListSkills(ctx(ids.A), { spaceId: ids.space });
    const found = list.enabled.find((s: any) => s.id === ids.createdSkillPage);
    expect(found).toBeDefined();
    expect(found.name).toBe('Cisco Advanced Routing Validator');
    expect(found.description).toBe('Updated description for OSPF, EIGRP and BGP validation');
    expect(found.instructions).toContain('Also check MTU mismatch');
  });

  it('toggles enable and disable for a custom skill', async () => {
    // Disable skill
    await H.aiSetSkillEnabled(ctx(ids.A), {
      spaceId: ids.space,
      skillId: ids.createdSkillPage,
      enabled: false,
    });

    let list = await H.aiListSkills(ctx(ids.A), { spaceId: ids.space });
    expect(list.enabled.some((s: any) => s.id === ids.createdSkillPage)).toBe(false);
    expect(list.discover.some((s: any) => s.id === ids.createdSkillPage)).toBe(true);

    // Re-enable skill
    await H.aiSetSkillEnabled(ctx(ids.A), {
      spaceId: ids.space,
      skillId: ids.createdSkillPage,
      enabled: true,
    });

    list = await H.aiListSkills(ctx(ids.A), { spaceId: ids.space });
    expect(list.enabled.some((s: any) => s.id === ids.createdSkillPage)).toBe(true);
  });

  it('toggles enable and disable for a builtin skill', async () => {
    // Disable builtin cisco_explain
    await H.aiSetSkillEnabled(ctx(ids.A), {
      spaceId: ids.space,
      skillId: 'builtin:cisco_explain',
      enabled: false,
    });

    let list = await H.aiListSkills(ctx(ids.A), { spaceId: ids.space });
    expect(list.enabled.some((s: any) => s.id === 'builtin:cisco_explain')).toBe(false);
    expect(list.discover.some((s: any) => s.id === 'builtin:cisco_explain')).toBe(true);

    // Re-enable builtin cisco_explain
    await H.aiSetSkillEnabled(ctx(ids.A), {
      spaceId: ids.space,
      skillId: 'builtin:cisco_explain',
      enabled: true,
    });

    list = await H.aiListSkills(ctx(ids.A), { spaceId: ids.space });
    expect(list.enabled.some((s: any) => s.id === 'builtin:cisco_explain')).toBe(true);
  });

  it('updates a builtin skill (customizes into an editable user skill)', async () => {
    const res = await H.aiUpdateSkill(ctx(ids.A), {
      spaceId: ids.space,
      skillId: 'builtin:proofread',
      name: 'Customized Proofread',
      description: 'Custom proofreading rules for technical documentation',
      instructions: 'Check grammar with strict passive-voice warnings.',
    });
    expect(res.ok).toBe(true);
    expect(res.skillId).toBeDefined();

    const list = await H.aiListSkills(ctx(ids.A), { spaceId: ids.space });
    // Customized proofread appears in enabled
    const custom = list.enabled.find((s: any) => s.id === res.skillId);
    expect(custom).toBeDefined();
    expect(custom.name).toBe('Customized Proofread');
    expect(custom.description).toBe('Custom proofreading rules for technical documentation');
    expect(custom.instructions).toContain('strict passive-voice');
    // Original builtin proofread is disabled/replaced
    expect(list.enabled.some((s: any) => s.id === 'builtin:proofread')).toBe(false);

    ids.customizedBuiltinId = res.skillId;
  });

  it('deletes a custom skill', async () => {
    const delRes = await H.aiDeleteSkill(ctx(ids.A), {
      spaceId: ids.space,
      skillId: ids.createdSkillPage,
    });
    expect(delRes.ok).toBe(true);

    const list = await H.aiListSkills(ctx(ids.A), { spaceId: ids.space });
    expect(list.enabled.some((s: any) => s.id === ids.createdSkillPage)).toBe(false);
    expect(list.discover.some((s: any) => s.id === ids.createdSkillPage)).toBe(false);
  });

  it('deletes a customized builtin skill and restores the default builtin skill', async () => {
    const delRes = await H.aiDeleteSkill(ctx(ids.A), {
      spaceId: ids.space,
      skillId: ids.customizedBuiltinId,
    });
    expect(delRes.ok).toBe(true);

    const list = await H.aiListSkills(ctx(ids.A), { spaceId: ids.space });
    // Custom skill is gone
    expect(list.enabled.some((s: any) => s.id === ids.customizedBuiltinId)).toBe(false);
    // Original builtin proofread is restored
    expect(list.enabled.some((s: any) => s.id === 'builtin:proofread')).toBe(true);
  });
});

