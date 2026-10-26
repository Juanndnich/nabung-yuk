// Web Crypto API Security Service
// Strictly follows AGENTS.md Rule 4:
// - PBKDF2 100,000 iterations with random salt for PIN hash
// - AES-GCM 256-bit encryption for password-protected backups
// - Failed attempts rate limiting
// - Zero plain PIN stored

export interface PinHashResult {
  hashHex: string;
  saltHex: string;
}

export const securityService = {
  /**
   * Hashes a 4-8 digit PIN using PBKDF2 with SHA-256 and 100,000 iterations
   */
  async hashPin(pin: string, existingSaltHex?: string): Promise<PinHashResult> {
    if (!crypto || !crypto.subtle) {
      throw new Error('Web Crypto API tidak didukung di browser ini.');
    }

    // Generate or use existing salt
    let salt: Uint8Array;
    if (existingSaltHex) {
      salt = new Uint8Array(
        existingSaltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );
    } else {
      salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
    }

    const encoder = new TextEncoder();
    const pinBuffer = encoder.encode(pin);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      pinBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as unknown as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      256
    );

    const hashHex = Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const saltHex = Array.from(salt)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return { hashHex, saltHex };
  },

  /**
   * Verifies an entered PIN against stored hash and salt
   */
  async verifyPin(enteredPin: string, storedHashHex: string, storedSaltHex: string): Promise<boolean> {
    const { hashHex } = await this.hashPin(enteredPin, storedSaltHex);
    return hashHex === storedHashHex;
  },

  /**
   * Calculates lockout duration based on failed attempts count
   */
  calculateLockoutSeconds(failedAttempts: number): number {
    if (failedAttempts < 3) return 0;
    if (failedAttempts === 3) return 30; // 30 seconds
    if (failedAttempts === 4) return 60; // 1 minute
    if (failedAttempts >= 5) return 300; // 5 minutes
    return 0;
  },

  /**
   * Encrypts a string (e.g. JSON backup) with a user password using AES-GCM 256-bit
   */
  async encryptBackup(plainJsonText: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const passBuffer = encoder.encode(password);
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoder.encode(plainJsonText)
    );

    const payload = {
      version: 1,
      format: 'AES-GCM-256',
      salt: Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join(''),
      iv: Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join(''),
      ciphertext: Array.from(new Uint8Array(encryptedData))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
    };

    return JSON.stringify(payload, null, 2);
  },

  /**
   * Decrypts an encrypted backup string with the user password
   */
  async decryptBackup(encryptedJsonString: string, password: string): Promise<string> {
    try {
      const parsed = JSON.parse(encryptedJsonString);
      if (parsed.format !== 'AES-GCM-256' || !parsed.salt || !parsed.iv || !parsed.ciphertext) {
        throw new Error('Format enkripsi tidak dikenali.');
      }

      const salt = new Uint8Array(parsed.salt.match(/.{1,2}/g).map((b: string) => parseInt(b, 16)));
      const iv = new Uint8Array(parsed.iv.match(/.{1,2}/g).map((b: string) => parseInt(b, 16)));
      const ciphertext = new Uint8Array(
        parsed.ciphertext.match(/.{1,2}/g).map((b: string) => parseInt(b, 16))
      );

      const encoder = new TextEncoder();
      const baseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const aesKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ciphertext
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch {
      throw new Error('Password salah atau file backup terenkripsi rusak.');
    }
  },

  /**
   * Requests persistent storage permission
   */
  async checkAndRequestPersistentStorage(): Promise<{ persisted: boolean; canRequest: boolean }> {
    if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.persist) {
      return { persisted: false, canRequest: false };
    }
    const persisted = await navigator.storage.persisted();
    if (persisted) {
      return { persisted: true, canRequest: false };
    }
    const granted = await navigator.storage.persist();
    return { persisted: granted, canRequest: !granted };
  },
};
