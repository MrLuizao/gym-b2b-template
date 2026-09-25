import type { PartnerProvider } from '#shared/types';

export const PARTNER_LABELS: Record<PartnerProvider, string> = {
  wellhub: 'WELLHUB',
  totalpass: 'TOTALPASS',
};

export interface PartnerValidation {
  ok: boolean;
  /// Id del visitante dentro del agregador — llave del dedupe diario.
  externalId?: string;
  name?: string;
  /// Tier del convenio (Basic/Flex/…) — define cuánto paga por visita.
  tier?: string;
  error?: string;
}

/// Punto único de verificación: el agregador es quien decide si el
/// token/QR del usuario es válido hoy. `PARTNER_VALIDATION=mock`
/// (default dev) acepta tokens de ≥6 chars como "Usuario demo"; con
/// credenciales reales se conectan las funciones por proveedor.
export async function validatePartnerToken(
  provider: PartnerProvider,
  token: string,
): Promise<PartnerValidation> {
  if (!token || token.length < 6) {
    return { ok: false, error: 'Token vacío o incompleto' };
  }

  const real =
    provider === 'wellhub'
      ? process.env.WELLHUB_API_KEY
      : process.env.TOTALPASS_API_KEY;
  if (!real || process.env.PARTNER_VALIDATION === 'mock') {
    return mockValidate(provider, token);
  }

  /// TODO real: Wellhub Partner API (check-in de token) y TotalPass
  /// TP-Token — ambos entregan credenciales tras el convenio. Cada uno
  /// valida el token del día del usuario y devuelve su id + tier.
  return {
    ok: false,
    error: `Integración ${provider} sin implementar — activa mock`,
  };
}

function mockValidate(
  provider: PartnerProvider,
  token: string,
): PartnerValidation {
  return {
    ok: true,
    externalId: `${provider.slice(0, 2)}-${token.slice(-8).toLowerCase()}`,
    name: 'Visitante demo',
    tier: 'MOCK',
  };
}
