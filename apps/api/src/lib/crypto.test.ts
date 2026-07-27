import { encrypt, decrypt } from './crypto.js';

describe('crypto', () => {
  it('roundtrips a plain string', () => {
    const plaintext = 'my-secret-token-value';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('roundtrips an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('roundtrips unicode characters', () => {
    const unicode = '日本語テスト 🎸🔥 émojis';
    expect(decrypt(encrypt(unicode))).toBe(unicode);
  });

  it('produces iv:authTag:encrypted format', () => {
    const ciphertext = encrypt('test');
    const parts = ciphertext.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/); // 12-byte IV in hex (NIST GCM recommended)
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16-byte auth tag in hex
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('throws on tampered ciphertext', () => {
    const ciphertext = encrypt('sensitive data');
    const parts = ciphertext.split(':');
    // XOR-flip the first ciphertext byte — substituting a constant ('ff') was
    // a no-op tamper 1 run in 256, when the real byte already was 0xff.
    const flipped = (parseInt(parts[2].slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0');
    const tampered = parts[0] + ':' + parts[1] + ':' + flipped + parts[2].slice(2);
    expect(() => decrypt(tampered)).toThrow();
  });
});
