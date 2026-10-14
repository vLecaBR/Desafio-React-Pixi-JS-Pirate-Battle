import { z } from 'zod';
import { readStored, STORAGE_KEYS, writeStored } from '../persistence/storage.ts';

const playerSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(40),
});

export type LocalPlayer = z.infer<typeof playerSchema>;

const NAMES = [
  'Jack',
  'Morgan',
  'Anne',
  'Silver',
  'Mary',
  'Drake',
  'Grace',
  'Kidd',
  'Bonny',
  'Rackham',
  'Teach',
  'Ching',
] as const;

function createPlayer(): LocalPlayer {
  const index = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return {
    playerId: crypto.randomUUID(),
    playerName: `Captain ${NAMES[index % NAMES.length] ?? 'Jack'}`,
  };
}

let current: LocalPlayer | null = null;

/**
 * Identity of the local player (`pb.player.v1`), created on first use. Used to
 * attribute registered matches and to query the player's history.
 */
export function getLocalPlayer(): LocalPlayer {
  if (!current) {
    current = readStored(STORAGE_KEYS.player, playerSchema) ?? createPlayer();
    writeStored(STORAGE_KEYS.player, current);
  }
  return current;
}

/** Forgets the cached identity (used when local data is reset). */
export function resetLocalPlayerCache(): void {
  current = null;
}
