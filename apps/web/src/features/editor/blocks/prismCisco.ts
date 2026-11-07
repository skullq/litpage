// Custom PrismJS grammars for Cisco IOS-XE, Cisco NX-OS, and Cisco IOS-XR configuration syntax.
import Prism from 'prismjs';

const sharedCommentsAndStrings: Prism.Grammar = {
  'comment': [
    {
      pattern: /(^|\n)\s*!.*/,
      lookbehind: true,
    },
    {
      pattern: /(^|\n)\s*#.*/,
      lookbehind: true,
    },
    {
      pattern: /(^|\s)remark\s+.*/i,
      lookbehind: true,
      inside: {
        'keyword': /^remark/i,
      },
    },
  ],
  'description-line': {
    pattern: /(^|\s)description\s+[^\r\n]+/i,
    lookbehind: true,
    inside: {
      'keyword': /^description/i,
      'string': /.+/,
    },
  },
  'prompt': {
    pattern: /^(?:[\w/:-]+:)?[\w.-]+(?:\([\w-]+(?:\s+[\w-]+)*\))?[#>]/m,
    alias: 'variable',
  },
  'string': {
    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    greedy: true,
  },
};

const sharedNetworkTokens: Prism.Grammar = {
  'ipv4': {
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\/(?:3[0-2]|[12]?\d))?\b/,
    alias: 'number',
  },
  'ipv6': {
    pattern: /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{0,4}(?:\/(?:12[0-8]|1[01]\d|[1-9]?\d))?\b|\b(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}(?:\/(?:12[0-8]|1[01]\d|[1-9]?\d))?\b|::(?:\/0)?/,
    alias: 'number',
  },
  'mac-address': {
    pattern: /\b[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\b|\b(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}\b/,
    alias: 'constant',
  },
  'route-distinguisher': {
    pattern: /\b\d{1,10}:\d{1,10}\b/,
    alias: 'constant',
  },
  'interface-name': {
    pattern: /\b(?:(?:HundredGigE|FortyGigabitEthernet|FortyGigE|TwentyFiveGigE|TenGigabitEthernet|TenGigE|FiveGigabitEthernet|TwoGigabitEthernet|GigabitEthernet|FastEthernet|Ethernet|Bundle-Ether|Port-channel|port-channel|Loopback|loopback|Tunnel|Vlan|BDI|BVI|MgmtEth|mgmt|nve|pw-ether|Serial|Null|Cellular|Dialer|Virtual-Template|ucse|vasileft|vasiright| Gi|Te|Fa|Eth|Po|Lo|Tu|Vl|BE)\s*\d+(?:\/\w+)*(?:\.\d+)?)\b/i,
    alias: 'class-name',
  },
  'action': {
    pattern: /\b(?:no|default|shutdown|permit|deny|pass|drop|done|commit|activate|deactivate|enable|disable|active|passive)\b/i,
    alias: 'important',
  },
};

// 1. Cisco IOS-XE Grammar
Prism.languages['cisco-ios-xe'] = {
  ...sharedCommentsAndStrings,
  ...sharedNetworkTokens,
  'section-keyword': {
    pattern: /(^|\n)\s*(?:hostname|interface|router\s+(?:ospf|ospfv3|bgp|eigrp|isis|rip)|vrf\s+definition|ip\s+vrf|address-family\s+(?:ipv4|ipv6|vpnv4|vpnv6|l2vpn)|route-map|ip\s+prefix-list|ipv6\s+prefix-list|ip\s+access-list|ipv6\s+access-list|access-list|class-map|policy-map|line\s+(?:con|vty|aux)|vlan|spanning-tree|crypto\s+(?:isakmp|ipsec|ikev2|pki| keyring)|aaa\s+new-model|snmp-server|ntp|logging|archive|redundancy|track|ip\s+sla|bfd-template|template|sdwan|system|omp|vpn)\b/i,
    lookbehind: true,
    alias: 'keyword',
  },
  'keyword': /\b(?:ip|ipv4|ipv6|vrf|forwarding|address|route|ospf|bgp|eigrp|isis|pim|igmp|mpls|ldp|traffic-eng|segment-routing|bfd|neighbor|network|redistribute|remote-as|update-source|next-hop-self|send-community|route-reflector-client|maximum-paths|default-information|originate|passive-interface|router-id|area|metric|distance|administrative-distance|summary-address|aggregate-address|distribute-list|prefix-list|filter-list|route-map|match|set|local-preference|weight|as-path|prepend|community|extcommunity|rt|rd|route-target|export|import|both|encapsulation|dot1Q|isl|native|switchport|mode|access|trunk|allowed|voice|nonegotiate|channel-group|channel-protocol|lacp|pagp|standby|vrrp|glbp|priority|preempt|timers|authentication|md5|key-chain|key|key-string|nat|inside|outside|source|static|list|pool|overload|helper-address|dhcp|excluded-address|default-router|dns-server|domain-name|lease|snooping|arp|inspection|trust|rate-limit|port-security|maximum|violation|restrict|protect|spanning-tree|portfast|bpduguard|bpdufilter|root|guard|loop|mst|rapid-pvst|pvst|etherchannel|load-balance|mtu|ip\s+mtu|tcp\s+mss|bandwidth|delay|duplex|speed|negotiation|auto|media-type|service-policy|input|output|class|police|shape|bandwidth|fair-queue|random-detect| priority|queue-limit|aaa|authentication|authorization|accounting|login|local|group|tacacs\+|radius|enable|secret|password|username|privilege|algorithm-type|scrypt|sha256|service|password-encryption|timestamps|debug|datetime|msec|localtime|show-timezone|logging|buffered|console|monitor|trap|host|source-interface|facility|snmp-server|community|ro|rw|location|contact|enable|traps|ntp|server|peer|master|clock|timezone|summer-time|line|exec-timeout|transport|ssh|telnet|all|none|login|synchronous|domain-lookup|name-server|http|secure-server|scp|version|vty|con|aux|exit|end|exit-address-family)\b/i,
  'protocol-attr': {
    pattern: /\b(?:unicast|multicast|vpnv4|vpnv6|evpn|l2vpn|vpls|point-to-point|multipoint|broadcast|non-broadcast|sham-link|stub|nssa|totally|no-summary|connected|static|rip|ospf|bgp|eigrp|isis|level-1|level-2|level-1-2|wide-metrics-only| full|half|on|off|desirable|auto)\b/i,
    alias: 'builtin',
  },
  'number': /\b0x[\da-fA-F]+\b|\b\d+(?:\.\d+)?\b/,
  'operator': /[+*\/=<>~|-]+/,
  'punctuation': /[{}[\];(),.:]/,
};

// 2. Cisco NX-OS Grammar
Prism.languages['cisco-nx-os'] = {
  ...sharedCommentsAndStrings,
  ...sharedNetworkTokens,
  'feature-keyword': {
    pattern: /(^|\n)\s*(?:feature\s+[\w-]+|nv\s+overlay\s+evpn|vdc\s+[\w-]+|vpc\s+domain|vrf\s+context|evpn|vlan\s+[\d,-]+|interface\s+[\w/.-]+|router\s+(?:ospf|ospfv3|bgp|eigrp|isis|rip)|route-map|ip\s+prefix-list|ip\s+access-list|ipv6\s+access-list|class-map|policy-map|port-profile|hardware\s+access-list|system\s+jumbomtu|fabric\s+forwarding)\b/i,
    lookbehind: true,
    alias: 'keyword',
  },
  'keyword': /\b(?:feature|bgp|ospf|ospfv3|eigrp|isis|pim|msdp|igmp|lacp|vpc|interface-vlan|hsrp|vrrp|lldp|cdp|udld|dhcp|tacacs\+|scheduler|nxapi|bash-shell|scp-server|sftp-server|netconf|restconf|telemetry|vn-segment-vlan-based|nv|overlay|evpn|vdc|vrf|context|member|vni|vn-segment|associate-vrf|suppress-arp|ingress-replication|protocol|mcast-group|multisite|border-gateway|dci-tracking|fabric-tracking|anycast-gateway-mac|fabric|forwarding|mode|anycast-gateway|vpc|domain|peer-keepalive|destination|source|peer-link|peer-switch|peer-gateway|auto-recovery|delay|restore|layer3|peer-router|ip|arp|synchronize|orphan-port|suspend|role|priority|system-priority|system-mac|dual-active|exclude|interface-vlan|port-channel|channel-group|force|lacp|graceful-convergence|suspend-individual|min-links|max-bundle|load-balance|switchport|access|trunk|allowed|native|vlan|spanning-tree|port|type|edge|network|normal|bpduguard|bpdufilter|guard|root|loop|mst|rapid-pvst|mtu|speed|duplex|negotiate|fec|beacon|medium|p2p|bcast|ip|ipv6|address|router|area|passive-interface|network|point-to-point|bfd|neighbor|remote-as|update-source|address-family|unicast|multicast|l2vpn|send-community|extended|both|route-reflector-client|next-hop-self|redistribute|direct|static|route-map|maximum-paths|ebgp|ibgp|retain|route-target|all|rd|auto|import|export|hsrp|version|preempt|timers|track|object|ip\s+route|ipv6\s+route|ip\s+pim|sparse-mode|rp-address|ssm|range|anycast-rp|hardware|profile|tcam|region|copp|system|qos|service-policy|type|queuing|network-qos|match|set|cos|dscp|qos-group|mtu|pause|no-drop|exit|end)\b/i,
  'protocol-attr': {
    pattern: /\b(?:unicast|multicast|l2vpn|evpn|vxlan|active|passive|on|edge|trunk|network|normal|sparse-mode|bi-dir|ssm|direct|static|extend|standard|both|auto)\b/i,
    alias: 'builtin',
  },
  'number': /\b0x[\da-fA-F]+\b|\b\d+(?:\.\d+)?\b/,
  'operator': /[+*\/=<>~|-]+/,
  'punctuation': /[{}[\];(),.:]/,
};

// 3. Cisco IOS-XR Grammar
Prism.languages['cisco-ios-xr'] = {
  ...sharedCommentsAndStrings,
  ...sharedNetworkTokens,
  'rpl-block': {
    pattern: /(^|\n)\s*(?:route-policy|prefix-set|as-path-set|community-set|extcommunity-set\s+(?:rt|soo)|rd-set|policy-map|class-map|group|end-policy|end-set|end-group|end-class-map|end-policy-map)\b/i,
    lookbehind: true,
    alias: 'keyword',
  },
  'rpl-control': {
    pattern: /\b(?:if|then|elseif|else|endif|pass|drop|done|set|apply|unsuppress-route|suppress-route| in |not|and|or|is-empty|ios-regex|dfa-regex|le|ge|eq)\b/i,
    alias: 'important',
  },
  'section-keyword': {
    pattern: /(^|\n)\s*(?:hostname|interface|router\s+(?:static|ospf|ospfv3|bgp|isis|rip|igrp|pim|igmp|msdp|hsrp|vrrp)|vrf|l2vpn|evpn|mpls\s+(?:ldp|traffic-eng|oam)|segment-routing|multicast-routing|bfd|arp|cdp|lldp|lacp|ntp|logging|snmp-server|aaa|Tacacs-server|radius-server|ssh|telnet|line|control-plane|xml\s+agent|netconf-yang\s+agent|grpc|telemetry\s+model-driven)\b/i,
    lookbehind: true,
    alias: 'keyword',
  },
  'keyword': /\b(?:ipv4|ipv6|address|unnumbered|secondary|point-to-point|mtu|bundle|id|mode|lacp|period|short|minimum-active|links|maximum-active|load-balancing|hash|encapsulation|dot1q|second-dot1q|exact|rewrite|ingress|tag|pop|push|translate|symmetric|l2transport|xconnect|group|p2p|neighbor|pw-id|pw-class|bridge|bridge-domain|attachment-circuit|vfi|evpn|evi|bgp|autodiscovery|route-target|import|export|stitching|rd|auto|address-family|unicast|multicast|labeled-unicast|vpnv4|vpnv6|l2vpn|vrf|router-id|area|network|cost|metric|passive|bfd|fast-detect|minimum-interval|multiplier|is-type|level-1|level-2-only|level-1-2|net|point-to-point|metric-style|wide|single-topology|segment-routing|mpls|sr-prefer|prefix-sid|index|absolute|n-flag-clear|explicit-null|ti-lfa|fast-reroute|per-prefix|per-link|remote-as|ebgp-multihop|update-source|next-hop-self|next-hop-unchanged|route-reflector-client|route-policy|in|out|default-originate|send-community-ebgp|send-extended-community-ebgp|additional-paths|receive|send|selection|allocate-label|all|redistribute|connected|static|ospf|isis|aggregate-address|summary-only|maximum-paths|ebgp|ibgp|unequal-cost|label|mode|per-vrf|per-ce|per-prefix|local-preference|med|weight|origin|igp|egp|incomplete|community|additive|delete|extcommunity|rt|soo|aigp|prepend|as-path|rib-has-route|destination|source|protocol|next-hop|tag|path-type|is-local|peeras|med-eq|local-preference-eq|commit|root|exit|end|apply-group|exclude-group)\b/i,
  'protocol-attr': {
    pattern: /\b(?:unicast|multicast|labeled-unicast|vpnv4|vpnv6|l2vpn|evpn|mspw|vpls|vpws|active|passive|on|inherit|level-1|level-2-only|level-1-2|wide|strict-spf|igp|egp|incomplete)\b/i,
    alias: 'builtin',
  },
  'number': /\b0x[\da-fA-F]+\b|\b\d+(?:\.\d+)?\b/,
  'operator': /[+*\/=<>~|-]+/,
  'punctuation': /[{}[\];(),.:]/,
};

