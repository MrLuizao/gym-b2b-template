/// Etiquetas de turno para mostrar — los valores internos/API siguen siendo
/// MAÑANA | TARDE | NOCHE.
export function shiftLabel(shift: string): string {
  switch (shift) {
    case 'MAÑANA':
      return 'MATUTINO';
    case 'NOCHE':
      return 'NOCTURNO';
    default:
      return 'VESPERTINO';
  }
}
