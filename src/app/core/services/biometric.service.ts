import { Injectable } from '@angular/core';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';

/**
 * Biometric unlock service. Stores the user's password under the platform
 * keystore/keychain after first successful login so subsequent launches can
 * prompt fingerprint/face and silently re-authenticate.
 *
 * TODO(phase-2): wire into the splash → login flow.
 */
@Injectable({ providedIn: 'root' })
export class BiometricService {
  private readonly credentialServer = 'com.curtis.client';

  /** Returns the biometry type available on this device, or null. */
  async available(): Promise<BiometryType | null> {
    try {
      const res = await NativeBiometric.isAvailable();
      return res.isAvailable ? res.biometryType : null;
    } catch {
      return null;
    }
  }

  /** Prompt for biometric verification. Resolves on success, rejects on cancel/failure. */
  async verify(reason: string): Promise<void> {
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'CurTIS',
      subtitle: 'Confirm it is you',
      description: reason,
    });
  }

  /** Persist credentials to the native keystore for next launch. */
  async setCredentials(username: string, password: string): Promise<void> {
    await NativeBiometric.setCredentials({
      username,
      password,
      server: this.credentialServer,
    });
  }

  /** Read stored credentials (after verify). Returns null if none. */
  async getCredentials(): Promise<{ username: string; password: string } | null> {
    try {
      const creds = await NativeBiometric.getCredentials({ server: this.credentialServer });
      return { username: creds.username, password: creds.password };
    } catch {
      return null;
    }
  }

  async deleteCredentials(): Promise<void> {
    try {
      await NativeBiometric.deleteCredentials({ server: this.credentialServer });
    } catch {
      // no-op if nothing stored
    }
  }
}
