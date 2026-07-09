import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

type ScryptParams = {
  N: number;
  r: number;
  p: number;
};

@Injectable()
export class PasswordService {
  async createHash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const params = { N: 16384, r: 8, p: 1 };
    const hash = await this.derive(password, salt, 64, params);

    return `scrypt$N=${params.N},r=${params.r},p=${params.p}$${salt}$${hash.toString('hex')}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const parsed = this.parseHash(storedHash);
    if (!parsed) {
      return false;
    }

    const expected = Buffer.from(parsed.hash, 'hex');
    const actual = await this.derive(password, parsed.salt, expected.length, parsed.params);

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private async derive(
    password: string,
    salt: string,
    keyLength: number,
    params: ScryptParams,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        keyLength,
        {
          ...params,
          maxmem: 32 * 1024 * 1024,
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(derivedKey);
        },
      );
    });
  }

  private parseHash(storedHash: string):
    | {
        params: ScryptParams;
        salt: string;
        hash: string;
      }
    | undefined {
    const [algorithm, rawParams, salt, hash] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !rawParams || !salt || !hash) {
      return undefined;
    }

    const params = Object.fromEntries(
      rawParams.split(',').map((part) => {
        const [key, value] = part.split('=');
        return [key, Number(value)];
      }),
    );

    if (!params.N || !params.r || !params.p || !/^[a-f0-9]+$/i.test(hash)) {
      return undefined;
    }

    return {
      params: {
        N: params.N,
        r: params.r,
        p: params.p,
      },
      salt,
      hash,
    };
  }
}
