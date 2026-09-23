import { createHmac } from 'node:crypto';

const QR_SIGNING_KEY =
  process.env.QR_SIGNING_KEY ?? 'prototipo-gym-dev-key';

export function signQrToken(memberId: string, issuedAt: number): string {
  return createHmac('sha256', QR_SIGNING_KEY)
    .update(`${memberId}|${issuedAt}`)
    .digest('hex');
}

export function verifyQrToken(
  memberId: string,
  issuedAt: number,
  signature: string,
): boolean {
  return signQrToken(memberId, issuedAt) === signature;
}
