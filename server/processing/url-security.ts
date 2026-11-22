import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { IntakeError } from '../intake-validation.js';

export type ResolvedAddress = { address: string; family: 4 | 6 };

const blockedIpv4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
  ['168.63.129.16', 32],
] as const)
  blockedIpv4.addSubnet(address, prefix, 'ipv4');

const globallyRoutableIpv6 = new BlockList();
globallyRoutableIpv6.addSubnet('2000::', 3, 'ipv6');
const blockedIpv6 = new BlockList();
for (const [address, prefix] of [
  ['2001::', 32],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
] as const)
  blockedIpv6.addSubnet(address, prefix, 'ipv6');

export function validateRetrievalUrl(url: URL): void {
  if (!['http:', 'https:'].includes(url.protocol))
    throw new IntakeError(
      422,
      'unsafe_url',
      'This URL cannot be retrieved safely.',
    );
  if (url.username || url.password || url.port)
    throw new IntakeError(
      422,
      'unsafe_url',
      'This URL cannot be retrieved safely.',
    );
  const hostname = url.hostname.toLowerCase();
  if (
    hostname.length > 253 ||
    hostname.endsWith('.') ||
    isIP(hostname.replace(/^\[|\]$/g, ''))
  ) {
    throw new IntakeError(
      422,
      'unsafe_url',
      'This URL cannot be retrieved safely.',
    );
  }
  const labels = hostname.split('.');
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        label.length < 1 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    throw new IntakeError(
      422,
      'unsafe_url',
      'This URL cannot be retrieved safely.',
    );
  }
  if (
    [
      'localhost',
      'local',
      'internal',
      'localdomain',
      'lan',
      'intranet',
    ].includes(labels.at(-1) ?? '') ||
    hostname.endsWith('.home.arpa')
  ) {
    throw new IntakeError(
      422,
      'unsafe_url',
      'This URL cannot be retrieved safely.',
    );
  }
}

export function validateResolvedAddresses(
  addresses: ResolvedAddress[],
): ResolvedAddress {
  if (addresses.length === 0) throw new Error('No DNS address');
  for (const { address, family } of addresses) {
    if (
      isIP(address) !== family ||
      (family === 4
        ? blockedIpv4.check(address, 'ipv4')
        : !globallyRoutableIpv6.check(address, 'ipv6') ||
          blockedIpv6.check(address, 'ipv6'))
    ) {
      throw new IntakeError(
        422,
        'unsafe_url',
        'This URL cannot be retrieved safely.',
      );
    }
  }
  return addresses[0];
}

export async function resolveAddresses(
  hostname: string,
): Promise<ResolvedAddress[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address, family }) => ({
    address,
    family: family as 4 | 6,
  }));
}
