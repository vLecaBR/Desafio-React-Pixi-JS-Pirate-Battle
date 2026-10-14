import { setupWorker } from 'msw/browser';
import { getLocalPlayer } from '../data/player.ts';
import { MockDb } from './db.ts';
import { createHandlers } from './handlers.ts';

/** Shared mock database (also used by the Network Lab reset actions). */
export const mockDb = new MockDb();

export const worker = setupWorker(...createHandlers(mockDb, getLocalPlayer));
