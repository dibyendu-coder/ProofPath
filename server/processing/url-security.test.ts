import { describe, expect, it } from 'vitest';
import {
  validateResolvedAddresses,
  validateRetrievalUrl,
} from './url-security.js';

describe('URL destination guard', () => {
  it('accepts a conventional public URL and address', () => {
    expect(() =>
      validateRetrievalUrl(new URL('https://jobs.example.org/opening')),
    ).not.toThrow();
    expect(
      validateResolvedAddresses([{ address: '8.8.8.8', family: 4 }]),
    ).toMatchObject({ address: '8.8.8.8' });
    expect(
      validateResolvedAddresses([
        { address: '2606:4700:4700::1111', family: 6 },
      ]),
    ).toMatchObject({ family: 6 });
  });

  it.each([
    'http://localhost/jobs',
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://0x7f.1/',
    'http://[::1]/',
    'http://169.254.169.254/',
    'http://metadata.google.internal/',
    'http://service.local/',
    'http://intranet/',
    'https://jobs.example.org:444/',
    'https://user:pass@jobs.example.org/',
    'file:///etc/passwd',
    'https://bad_host.example/',
  ])('rejects an unsafe URL: %s', (raw) => {
    expect(() => validateRetrievalUrl(new URL(raw))).toThrow();
  });

  it.each([
    ['127.0.0.1', 4],
    ['10.1.2.3', 4],
    ['192.168.1.1', 4],
    ['169.254.169.254', 4],
    ['100.100.100.200', 4],
    ['168.63.129.16', 4],
    ['::1', 6],
    ['fc00::1', 6],
    ['fe80::1', 6],
    ['::ffff:127.0.0.1', 6],
    ['2001:db8::1', 6],
    ['2002:c0a8:101::1', 6],
  ] as const)('rejects nonpublic DNS address %s', (address, family) => {
    expect(() => validateResolvedAddresses([{ address, family }])).toThrow();
  });

  it('rejects the whole DNS set when one answer is private', () => {
    expect(() =>
      validateResolvedAddresses([
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]),
    ).toThrow();
  });
});
