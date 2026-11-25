export function countSupporters(items: {participantId?: string; participant?: {id:string}}[]): number {
  return new Set(items.map(item=>item.participantId ?? item.participant?.id).filter((id): id is string => !!id)).size;
}
