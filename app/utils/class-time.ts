import type { ClassBranchTime, ClassSchedule } from '#shared/types';

/// Horario/sala efectivos de una clase en una sede: override local si existe,
/// si no los valores base de la clase.
export function classTimeAt(
  gymClass: ClassSchedule,
  branchId: string | null | undefined,
): ClassBranchTime {
  const local = branchId ? gymClass.branchTimes?.[branchId] : undefined;
  return {
    startMinutes: local?.startMinutes ?? gymClass.startMinutes,
    endMinutes: local?.endMinutes ?? gymClass.endMinutes,
    room: local?.room ?? gymClass.room,
  };
}
