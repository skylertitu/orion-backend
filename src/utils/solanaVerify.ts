import nacl from 'tweetnacl';
import bs58 from 'bs58';

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isSolanaAddress(address: string): boolean {
  if (!SOLANA_ADDRESS_RE.test(address)) return false;
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

export function buildWalletLinkMessage(params: {
  userId: number;
  address: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    'Orion wallet link',
    `user:${params.userId}`,
    `address:${params.address}`,
    `nonce:${params.nonce}`,
    `issued:${params.issuedAt}`,
  ].join('\n');
}

function decodeSignature(signatureEncoded: string): Buffer | null {
  try {
    const b64 = Buffer.from(signatureEncoded, 'base64');
    if (b64.length === 64) return b64;
  } catch {
    /* try base58 */
  }
  try {
    const b58 = Buffer.from(bs58.decode(signatureEncoded));
    if (b58.length === 64) return b58;
  } catch {
    return null;
  }
  return null;
}

export function verifySolanaSignature(address: string, message: string, signatureBase64: string): boolean {
  try {
    const publicKey = bs58.decode(address);
    const signature = decodeSignature(signatureBase64);
    const payload = Buffer.from(message, 'utf8');
    if (publicKey.length !== 32 || !signature) return false;
    return nacl.sign.detached.verify(payload, signature, publicKey);
  } catch {
    return false;
  }
}
