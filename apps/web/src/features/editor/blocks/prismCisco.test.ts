import { describe, expect, it } from 'vitest';
import { grammarFor, highlightToHtml } from './codeHighlight.ts';
import { CODE_LANGUAGES } from './codeLanguages.ts';
import { codeLanguage } from '../../ai/mdBlocks.ts';

describe('Cisco IOS-XE, NX-OS, and IOS-XR syntax highlighting', () => {
  it('registers Cisco languages in CODE_LANGUAGES and resolves aliases', () => {
    expect(CODE_LANGUAGES).toContain('Cisco IOS-XE');
    expect(CODE_LANGUAGES).toContain('Cisco NX-OS');
    expect(CODE_LANGUAGES).toContain('Cisco IOS-XR');

    expect(grammarFor('Cisco IOS-XE')).toBe('cisco-ios-xe');
    expect(grammarFor('Cisco NX-OS')).toBe('cisco-nx-os');
    expect(grammarFor('Cisco IOS-XR')).toBe('cisco-ios-xr');

    expect(codeLanguage('ios-xe')).toBe('Cisco IOS-XE');
    expect(codeLanguage('nx-os')).toBe('Cisco NX-OS');
    expect(codeLanguage('ios-xr')).toBe('Cisco IOS-XR');
  });

  it('highlights Cisco IOS-XE configuration', () => {
    const cfg = [
      '!',
      'hostname CSR1000V',
      'interface GigabitEthernet1',
      ' description WAN Uplink to ISP',
      ' ip address 192.168.10.1 255.255.255.0',
      ' no shutdown',
      'router bgp 65001',
      ' neighbor 192.168.10.2 remote-as 65002',
    ].join('\n');

    const html = highlightToHtml(cfg, 'Cisco IOS-XE');
    expect(html).toContain('token comment');
    expect(html).toContain('token section-keyword keyword');
    expect(html).toContain('token interface-name class-name');
    expect(html).toContain('token ipv4 number');
    expect(html).toContain('token action important');
    expect(html).toContain('WAN Uplink to ISP');
  });

  it('highlights Cisco NX-OS configuration', () => {
    const cfg = [
      'feature bgp',
      'feature nv overlay',
      'nv overlay evpn',
      'vpc domain 10',
      '  peer-keepalive destination 10.1.1.2 source 10.1.1.1',
      'interface nve1',
      '  no shutdown',
      '  member vni 10010',
      '    ingress-replication protocol bgp',
    ].join('\n');

    const html = highlightToHtml(cfg, 'Cisco NX-OS');
    expect(html).toContain('token feature-keyword keyword');
    expect(html).toContain('token interface-name class-name');
    expect(html).toContain('token ipv4 number');
    expect(html).toContain('token action important');
  });

  it('highlights Cisco IOS-XR configuration including RPL', () => {
    const cfg = [
      'prefix-set PRIVATE-NETS',
      '  10.0.0.0/8 le 32,',
      '  172.16.0.0/12 le 32',
      'end-set',
      '!',
      'route-policy PASS-PRIVATE',
      '  if destination in PRIVATE-NETS then',
      '    set local-preference 200',
      '    pass',
      '  else',
      '    drop',
      '  endif',
      'end-policy',
      'interface Bundle-Ether10',
      '  ipv4 address 10.20.30.1 255.255.255.252',
      'commit',
    ].join('\n');

    const html = highlightToHtml(cfg, 'Cisco IOS-XR');
    expect(html).toContain('token rpl-block keyword');
    expect(html).toContain('token rpl-control important');
    expect(html).toContain('token interface-name class-name');
    expect(html).toContain('token ipv4 number');
    expect(html).toContain('token action important');
  });
});

