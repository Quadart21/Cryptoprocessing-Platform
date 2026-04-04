type TotpOptions = {
  secret: string;
  digits?: number;
  period?: number;
  algorithm?: string;
  timestampMs?: number;
};

type TotpConfig = {
  digits: number;
  period: number;
  algorithm: string;
};

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function parseTotpConfigFromOtpAuth(otpauthUrl: string): TotpConfig {
  try {
    const url = new URL(otpauthUrl);
    const digitsRaw = Number(url.searchParams.get("digits") ?? "6");
    const periodRaw = Number(url.searchParams.get("period") ?? "30");
    const algorithm = normalizeAlgorithm(url.searchParams.get("algorithm") ?? "SHA1");

    return {
      digits: Number.isFinite(digitsRaw) && digitsRaw > 0 ? Math.trunc(digitsRaw) : 6,
      period: Number.isFinite(periodRaw) && periodRaw > 0 ? Math.trunc(periodRaw) : 30,
      algorithm,
    };
  } catch {
    return {
      digits: 6,
      period: 30,
      algorithm: "SHA-1",
    };
  }
}

export async function generateTotpCode({
  secret,
  digits = 6,
  period = 30,
  algorithm = "SHA1",
  timestampMs = Date.now(),
}: TotpOptions): Promise<string> {
  const keyBytes = decodeBase32(secret);
  const keyBuffer = new ArrayBuffer(keyBytes.byteLength);
  new Uint8Array(keyBuffer).set(keyBytes);
  const counter = Math.floor(timestampMs / 1000 / period);
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);

  const high = Math.floor(counter / 2 ** 32);
  const low = counter >>> 0;
  counterView.setUint32(0, high);
  counterView.setUint32(4, low);

  const cryptoApi = globalThis.crypto?.subtle;
  if (!cryptoApi) {
    throw new Error("Web Crypto API недоступен в этом браузере.");
  }

  const key = await cryptoApi.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: normalizeAlgorithm(algorithm) },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await cryptoApi.sign("HMAC", key, counterBuffer));

  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const modulus = 10 ** digits;
  return String(binaryCode % modulus).padStart(digits, "0");
}

export function getTotpSecondsRemaining(period = 30, timestampMs = Date.now()): number {
  const seconds = Math.floor(timestampMs / 1000);
  const mod = seconds % period;
  return mod === 0 ? period : period - mod;
}

function decodeBase32(value: string): Uint8Array {
  const clean = value.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      continue;
    }
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

function normalizeAlgorithm(raw: string): string {
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized === "SHA256") {
    return "SHA-256";
  }
  if (normalized === "SHA512") {
    return "SHA-512";
  }
  return "SHA-1";
}
