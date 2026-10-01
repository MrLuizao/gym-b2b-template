import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

export interface SupportAlert {
  conversationId: string;
  memberName: string;
  preview: string;
}

/// Estado global (singleton a nivel módulo) — el badge del menú y la
/// página /soporte comparten el mismo listener.
const unreadCount = ref(0);
const lastAlert = ref<SupportAlert | null>(null);
const initialized = ref(false);
let unsubscribe: Unsubscribe | null = null;
let started = false;
let alertTimer: ReturnType<typeof setTimeout> | null = null;

/// Beep corto con Web Audio — no requiere asset. Los browsers bloquean
/// AudioContext hasta el primer gesto del usuario: si falla, solo se
/// pierde el sonido, el toast sigue saliendo.
function beep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    /* autoplay bloqueado */
  }
}

export function useSupportUnread() {
  const { session } = useAuth();
  const { db } = useFirebase();

  function start(): void {
    if (started || !db || !import.meta.client) return;
    started = true;

    const base = collection(db, 'conversations');
    const q = session.value?.branchId
      ? query(base, where('branch_id', '==', session.value.branchId))
      : query(base);

    const prev = new Map<string, number>();

    unsubscribe = onSnapshot(q, (snap) => {
      let total = 0;
      for (const d of snap.docs) {
        const data = d.data();
        if (data.status !== 'open') continue;
        const unread = Number(data.unread_staff ?? 0);
        total += unread;

        const was = prev.get(d.id) ?? 0;
        if (initialized.value && unread > was) {
          lastAlert.value = {
            conversationId: d.id,
            memberName: String(data.member_name ?? 'Socio'),
            preview: String(data.last_message_preview ?? ''),
          };
          beep();
          if (alertTimer) clearTimeout(alertTimer);
          alertTimer = setTimeout(() => {
            lastAlert.value = null;
          }, 8000);
        }
        prev.set(d.id, unread);
      }
      unreadCount.value = total;
      initialized.value = true;
    });
  }

  function dismissAlert(): void {
    lastAlert.value = null;
    if (alertTimer) clearTimeout(alertTimer);
  }

  return {
    unreadCount: readonly(unreadCount),
    lastAlert: readonly(lastAlert),
    start,
    dismissAlert,
  };
}
