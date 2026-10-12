import { FieldValue, type Transaction } from 'firebase-admin/firestore';

import type { PointsHistoryType } from '#shared/types';

import { db } from './db';

/// Registra un movimiento de puntos en el historial del socio.
/// Debe llamarse DENTRO de una transacción que ya tenga el userDoc leído
/// para calcular el balance correcto.
export function recordPointsHistory(
  tx: Transaction,
  userId: string,
  opts: {
    type: PointsHistoryType;
    delta: number;
    balance: number;
    description: string;
    refId?: string | null;
  },
): void {
  const historyRef = db()
    .collection('users')
    .doc(userId)
    .collection('pointsHistory')
    .doc();

  tx.set(historyRef, {
    type: opts.type,
    delta: opts.delta,
    balance: opts.balance,
    description: opts.description,
    ref_id: opts.refId ?? null,
    created_at: FieldValue.serverTimestamp(),
  });
}
