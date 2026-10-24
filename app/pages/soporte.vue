<script setup lang="ts">
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Gift,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  User,
} from '@lucide/vue';

import type {
  Conversation,
  SupportCopilotResponse,
  SupportMessage,
} from '#shared/types';

const { session } = useAuth();
const { db } = useFirebase();

const conversations = ref<Conversation[]>([]);
const selectedId = ref<string | null>(null);
const messages = ref<SupportMessage[]>([]);
const newMessage = ref('');
const sending = ref(false);
const resolving = ref(false);
const resolveConfirmOpen = ref(false);

/// Copiloto IA
const copilotData = ref<SupportCopilotResponse | null>(null);
const loadingCopilot = ref(false);

let unsubConversations: Unsubscribe | null = null;
let unsubMessages: Unsubscribe | null = null;

const selected = computed(() =>
  conversations.value.find((c) => c.id === selectedId.value) ?? null,
);

function startListeners(): void {
  if (!db) {
    console.error('[Soporte] db is null');
    return;
  }

  let convQuery = query(collection(db, 'conversations'));

  if (session.value?.branchId) {
    convQuery = query(
      collection(db, 'conversations'),
      where('branch_id', '==', session.value.branchId),
    );
  }

  unsubConversations = onSnapshot(
    convQuery,
    (snap) => {
      conversations.value = snap.docs
        .filter((d) => d.data().status === 'open')
        .sort(
          (a, b) =>
            ((b.data().last_message_at as Timestamp)?.toMillis?.() ?? 0) -
            ((a.data().last_message_at as Timestamp)?.toMillis?.() ?? 0),
        )
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            memberId: String(data.member_id ?? ''),
            memberName: String(data.member_name ?? ''),
            branchId: String(data.branch_id ?? ''),
            status: 'open' as const,
            createdAt: (data.created_at as Timestamp)?.toMillis?.() ?? Date.now(),
            lastMessageAt:
              (data.last_message_at as Timestamp)?.toMillis?.() ?? Date.now(),
            lastMessagePreview: String(data.last_message_preview ?? ''),
            unreadMember: Number(data.unread_member ?? 0),
            unreadStaff: Number(data.unread_staff ?? 0),
          };
        });

      if (selectedId.value && !conversations.value.find((c) => c.id === selectedId.value)) {
        selectedId.value = null;
        copilotData.value = null;
      }
    },
    (err) => {
      console.error('[Soporte] onSnapshot error:', err);
    },
  );
}

async function loadCopilot(convId: string): Promise<void> {
  loadingCopilot.value = true;
  try {
    const res = await $api<SupportCopilotResponse>(`/api/support/${convId}/copilot`, {
      method: 'POST',
    });
    if (selectedId.value === convId) {
      copilotData.value = res;
    }
  } catch (err) {
    console.error('[Soporte] Error cargando Copiloto IA:', err);
  } finally {
    if (selectedId.value === convId) {
      loadingCopilot.value = false;
    }
  }
}

function selectConversation(id: string): void {
  selectedId.value = id;
  messages.value = [];
  copilotData.value = null;

  if (unsubMessages) {
    unsubMessages();
    unsubMessages = null;
  }

  if (!db) return;

  void loadCopilot(id);

  const msgQuery = query(
    collection(db, 'conversations', id, 'messages'),
    orderBy('created_at', 'asc'),
  );

  let prevCount = 0;
  unsubMessages = onSnapshot(
    msgQuery,
    (snap) => {
      messages.value = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          conversationId: id,
          sender: data.sender === 'staff' ? 'staff' : 'member',
          senderName: String(data.sender_name ?? ''),
          text: String(data.text ?? ''),
          createdAt: (data.created_at as Timestamp)?.toMillis?.() ?? Date.now(),
          read: data.read === true,
        } satisfies SupportMessage;
      });

      const lastMsg = messages.value[messages.value.length - 1];
      if (messages.value.length > prevCount && prevCount > 0 && lastMsg?.sender === 'member') {
        void loadCopilot(id);
      }
      prevCount = messages.value.length;

      // Marcar como leídos en el server
      void $api(`/api/support/${id}/messages`);
    },
    (err) => {
      console.error('[Soporte] messages onSnapshot error:', err);
    },
  );
}

function applySuggestion(text: string): void {
  newMessage.value = text;
}

async function sendMessage(): Promise<void> {
  if (!selectedId.value || !newMessage.value.trim() || sending.value) return;

  sending.value = true;
  try {
    await $api(`/api/support/${selectedId.value}/messages`, {
      method: 'POST',
      body: { text: newMessage.value.trim() },
    });
    newMessage.value = '';
  } finally {
    sending.value = false;
  }
}

async function resolveConversation(): Promise<void> {
  if (!selectedId.value || resolving.value) return;

  resolving.value = true;
  try {
    await $api(`/api/support/${selectedId.value}/resolve`, {
      method: 'POST',
    });
    selectedId.value = null;
    messages.value = [];
    copilotData.value = null;
    resolveConfirmOpen.value = false;
  } finally {
    resolving.value = false;
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return 'Hoy';
  }
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

onMounted(() => {
  startListeners();
});

onBeforeUnmount(() => {
  if (unsubConversations) unsubConversations();
  if (unsubMessages) unsubMessages();
});
</script>

<template>
  <div class="flex h-[calc(100vh-6rem)] gap-6">
    <!-- Lista de conversaciones -->
    <div class="flex w-80 shrink-0 flex-col rounded-2xl border border-stroke bg-surface">
      <div class="flex items-center gap-2 border-b border-stroke p-4">
        <MessageCircle class="h-4 w-4 text-accent" />
        <h2 class="text-sm font-black tracking-tight text-text-primary">
          Soporte
        </h2>
        <span
          v-if="conversations.length"
          class="ml-auto rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent"
        >
          {{ conversations.length }}
        </span>
      </div>

      <div class="flex-1 overflow-y-auto">
        <button
          v-for="conv in conversations"
          :key="conv.id"
          type="button"
          class="flex w-full cursor-pointer items-start gap-3 border-b border-stroke p-4 text-left transition hover:bg-base"
          :class="selectedId === conv.id && 'bg-base'"
          @click="selectConversation(conv.id)"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20"
          >
            <User class="h-5 w-5 text-accent" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="truncate text-sm font-bold text-text-primary">
                {{ conv.memberName }}
              </p>
              <span class="shrink-0 text-[10px] text-text-dim">
                {{ formatDate(conv.lastMessageAt) }}
              </span>
            </div>
            <p class="mt-0.5 truncate text-xs text-text-muted">
              {{ conv.lastMessagePreview || 'Nueva conversación' }}
            </p>
            <div
              v-if="conv.unreadStaff > 0"
              class="mt-1 inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-base"
            >
              {{ conv.unreadStaff }} nuevo{{ conv.unreadStaff > 1 ? 's' : '' }}
            </div>
          </div>
        </button>

        <p
          v-if="conversations.length === 0"
          class="p-8 text-center text-xs text-text-dim"
        >
          Sin conversaciones activas
        </p>
      </div>
    </div>

    <!-- Chat -->
    <div class="flex flex-1 flex-col rounded-2xl border border-stroke bg-surface overflow-hidden">
      <template v-if="selected">
        <!-- Header del chat -->
        <div class="flex items-center justify-between border-b border-stroke p-4">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20"
            >
              <User class="h-5 w-5 text-accent" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <NuxtLink
                  :to="`/socios/${selected.memberId}`"
                  class="text-sm font-bold text-text-primary transition hover:text-accent"
                >
                  {{ selected.memberName }}
                </NuxtLink>
                <span
                  v-if="copilotData"
                  class="rounded-full px-2 py-0.5 text-[10px] font-bold border"
                  :class="
                    copilotData.urgency === 'high'
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'bg-accent/15 text-accent border-accent/30'
                  "
                >
                  {{ copilotData.intentLabel }}
                </span>
              </div>
              <p class="text-[10px] text-text-dim">
                Iniciado {{ formatDate(selected.createdAt) }} · {{ formatTime(selected.createdAt) }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400 transition hover:bg-emerald-500/20"
            :disabled="resolving"
            @click="resolveConfirmOpen = true"
          >
            <CheckCircle2 class="h-3.5 w-3.5" />
            Resolver
          </button>
        </div>

        <!-- Cinta de Contexto del Socio (Copiloto IA) -->
        <div
          v-if="copilotData"
          class="flex flex-wrap items-center gap-3 border-b border-stroke bg-base/60 px-4 py-2 text-[11px]"
        >
          <span class="text-text-muted">
            Plan:
            <strong class="text-text-primary">{{ copilotData.memberContext.planName }}</strong>
            <span
              class="ml-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
              :class="
                copilotData.memberContext.membershipStatus === 'ACTIVE'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/15 text-red-400'
              "
            >
              {{ copilotData.memberContext.membershipStatus === 'ACTIVE' ? 'Activo' : 'Vencido' }}
            </span>
          </span>

          <span v-if="copilotData.memberContext.membershipUntil" class="text-text-muted">
            Vence: <strong class="text-text-primary">{{ copilotData.memberContext.membershipUntil }}</strong>
          </span>

          <span class="flex items-center gap-1 text-text-muted">
            <Gift class="h-3 w-3 text-accent" />
            <strong class="text-accent">{{ copilotData.memberContext.points }} pts</strong>
            <span>(racha {{ copilotData.memberContext.goalStreak }} sem)</span>
          </span>

          <span
            v-if="copilotData.memberContext.churnRiskLevel !== 'low'"
            class="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
            :class="
              copilotData.memberContext.churnRiskLevel === 'high'
                ? 'bg-red-500/15 text-red-400'
                : 'bg-amber-500/15 text-amber-400'
            "
          >
            ⚠️ Riesgo Churn {{ copilotData.memberContext.churnRiskPct }}% ({{ copilotData.memberContext.daysSinceLastVisit }}d sin visita)
          </span>
        </div>

        <!-- Mensajes -->
        <div class="flex-1 overflow-y-auto p-4">
          <div class="space-y-3">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex"
              :class="msg.sender === 'staff' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[70%] rounded-2xl px-4 py-2"
                :class="
                  msg.sender === 'staff'
                    ? 'bg-accent text-base'
                    : 'bg-base text-text-primary'
                "
              >
                <p class="text-sm">{{ msg.text }}</p>
                <p
                  class="mt-1 text-[9px]"
                  :class="msg.sender === 'staff' ? 'text-base/60' : 'text-text-dim'"
                >
                  {{ formatTime(msg.createdAt) }}
                </p>
              </div>
            </div>
          </div>

          <p
            v-if="messages.length === 0"
            class="py-12 text-center text-xs text-text-dim"
          >
            Sin mensajes aún
          </p>
        </div>

        <!-- Barra de Respuestas Sugeridas (Copiloto IA) -->
        <div class="border-t border-stroke bg-base/40 px-4 py-2.5 space-y-2">
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent">
              <Sparkles class="h-3.5 w-3.5" />
              Copiloto IA · Respuestas con contexto del socio (1-click)
            </span>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary cursor-pointer"
              :disabled="loadingCopilot"
              @click="selectedId && loadCopilot(selectedId)"
            >
              <RefreshCw class="h-3 w-3" :class="loadingCopilot && 'animate-spin'" />
              {{ copilotData?.aiPowered ? 'Gemini IA · Regenerar' : 'Regenerar' }}
            </button>
          </div>

          <div v-if="loadingCopilot" class="text-[11px] text-text-dim py-1">
            Analizando ficha del socio y redactando borradores...
          </div>

          <div v-else-if="copilotData?.suggestions?.length" class="flex flex-wrap gap-1.5">
            <button
              v-for="(suggestion, idx) in copilotData.suggestions"
              :key="idx"
              type="button"
              class="text-left text-[11px] leading-snug rounded-xl border border-stroke bg-surface hover:border-accent/60 hover:bg-accent/10 px-3 py-1.5 text-text-primary transition cursor-pointer max-w-full"
              @click="applySuggestion(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>

        <!-- Input -->
        <form
          class="flex items-center gap-3 border-t border-stroke p-4"
          @submit.prevent="sendMessage"
        >
          <input
            v-model="newMessage"
            type="text"
            placeholder="Escribe un mensaje o elige una sugerencia del Copiloto IA..."
            class="flex-1 rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <button
            type="submit"
            class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-accent text-base transition hover:opacity-90 disabled:opacity-50"
            :disabled="!newMessage.trim() || sending"
          >
            <Send class="h-4 w-4" />
          </button>
        </form>
      </template>

      <!-- Estado vacío -->
      <div
        v-else
        class="flex flex-1 flex-col items-center justify-center text-text-dim"
      >
        <MessageCircle class="h-12 w-12 opacity-30" />
        <p class="mt-3 text-sm font-medium">
          Selecciona una conversación
        </p>
      </div>
    </div>

    <!-- Confirmación de resolver — la conversación se borra al cerrar -->
    <UModal
      v-model:open="resolveConfirmOpen"
      title="Resolver conversación"
      :description="`Se cerrará el chat con ${selected?.memberName ?? 'el socio'} y se eliminará el historial de mensajes. Esta acción no se puede deshacer.`"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="resolveConfirmOpen = false"
          />
          <UButton
            label="Resolver y cerrar"
            icon="i-lucide-check-circle-2"
            color="success"
            :loading="resolving"
            @click="resolveConversation"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
