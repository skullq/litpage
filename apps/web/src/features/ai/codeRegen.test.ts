import { describe, expect, it } from 'vitest';
import { records } from '../../lib/store/records.ts';
import { replaceBlocks, replaceBlockWithMarkdown, replaceSelection } from './insert.ts';
import { skillFromLabel } from './skills.ts';

describe('code block regeneration and color scheme preservation', () => {
  it('skillFromLabel recognizes Regenerate code and Korean variants', () => {
    expect(skillFromLabel('Regenerate code')).toBe('code_regenerate');
    expect(skillFromLabel('regenerate code')).toBe('code_regenerate');
    expect(skillFromLabel('코드 전체 재생성')).toBe('code_regenerate');
    expect(skillFromLabel('코드 재생성')).toBe('code_regenerate');
  });

  it('replaceBlocks preserves code language (color scheme) and format when regenerated with fenced code', () => {
    const codeId = 'test-code-1';
    records.mergeRecordMap({
      block: {
        [codeId]: {
          role: 'editor',
          value: {
            id: codeId,
            type: 'code',
            alive: true,
            parent_id: 'page-1',
            parent_table: 'block',
            properties: {
              title: [['interface GigabitEthernet0/1\n ip address 10.0.0.1 255.255.255.0\n no shutdown']],
              language: [['Cisco IOS-XE']],
            },
            format: { code_wrap: true, code_line_numbers: true },
          } as any,
        },
      },
    });

    // AI returns fenced markdown without language tag (or different/default language)
    const aiOutput = '```\ninterface GigabitEthernet0/1\n description Primary Link\n ip address 10.0.0.1 255.255.255.0\n no shutdown\n```';
    const ids = replaceBlocks([codeId], aiOutput);
    expect(ids).toEqual([codeId]);

    const updated = records.get('block', codeId);
    expect(updated).toBeDefined();
    expect(updated?.type).toBe('code');
    // Language must be preserved as Cisco IOS-XE
    expect(updated?.properties?.language).toEqual([['Cisco IOS-XE']]);
    expect(updated?.format?.code_wrap).toBe(true);
    expect(updated?.format?.code_line_numbers).toBe(true);
    expect(updated?.properties?.title?.[0]?.[0]).toContain('description Primary Link');
  });

  it('replaceBlocks preserves code block when AI returns raw unfenced code', () => {
    const codeId = 'test-code-2';
    records.mergeRecordMap({
      block: {
        [codeId]: {
          role: 'editor',
          value: {
            id: codeId,
            type: 'code',
            alive: true,
            parent_id: 'page-1',
            parent_table: 'block',
            properties: {
              title: [['router bgp 65000']],
              language: [['Cisco NX-OS']],
            },
            format: { code_wrap: false },
          } as any,
        },
      },
    });

    const rawOutput = 'router bgp 65000\n neighbor 192.168.1.1 remote-as 65001\n address-family ipv4 unicast';
    const ids = replaceBlocks([codeId], rawOutput);
    expect(ids).toEqual([codeId]);

    const updated = records.get('block', codeId);
    expect(updated?.type).toBe('code');
    expect(updated?.properties?.language).toEqual([['Cisco NX-OS']]);
    expect(updated?.properties?.title?.[0]?.[0]).toBe(rawOutput);
  });

  it('replaceBlockWithMarkdown preserves code language and format', () => {
    const codeId = 'test-code-3';
    records.mergeRecordMap({
      block: {
        [codeId]: {
          role: 'editor',
          value: {
            id: codeId,
            type: 'code',
            alive: true,
            parent_id: 'page-1',
            parent_table: 'block',
            properties: {
              title: [['def hello():\n    pass']],
              language: [['Python']],
            },
            format: { code_line_numbers: true },
          } as any,
        },
      },
    });

    const aiOutput = '```python\ndef hello():\n    print("Hello, world!")\n```';
    const ids = replaceBlockWithMarkdown(codeId, aiOutput);
    expect(ids).toEqual([codeId]);

    const updated = records.get('block', codeId);
    expect(updated?.type).toBe('code');
    expect(updated?.properties?.language).toEqual([['Python']]);
    expect(updated?.format?.code_line_numbers).toBe(true);
    expect(updated?.properties?.title?.[0]?.[0]).toContain('print("Hello, world!")');
  });

  it('replaceSelection preserves code language and format on whole block replacement', () => {
    const codeId = 'test-code-4';
    records.mergeRecordMap({
      block: {
        [codeId]: {
          role: 'editor',
          value: {
            id: codeId,
            type: 'code',
            alive: true,
            parent_id: 'page-1',
            parent_table: 'block',
            properties: {
              title: [['const x = 10;']],
              language: [['TypeScript']],
            },
          } as any,
        },
      },
    });

    const aiOutput = '```ts\nconst x: number = 20;\n```';
    const ids = replaceSelection(codeId, 0, 13, aiOutput);
    expect(ids).toEqual([codeId]);

    const updated = records.get('block', codeId);
    expect(updated?.type).toBe('code');
    expect(updated?.properties?.language).toEqual([['TypeScript']]);
    expect(updated?.properties?.title?.[0]?.[0]).toContain('const x: number = 20;');
  });
});
