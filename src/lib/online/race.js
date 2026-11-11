// Online car race (Hill Climb Racer): pure room logic shared by the API route and the tests.
// A room holds 2-4 racers who all drive the SAME seeded road (world + level). Live car positions are NOT stored here:
// every phone writes its own car to raceRooms/{code}/cars/{uid} (Firestore rules) and the others listen.
// The server only decides who is in the room, when the race starts (one shared start time) and who crossed the line first.
export const MAX_RACERS = 4;
export const MIN_RACERS = 2;
export const COUNTDOWN_MS = 4000;        // lobby → "3,2,1,GO" (everyone starts at the same server time)
export const MIN_RACE_MS = 8000;         // a finish sooner than this after the start is impossible: rejected
export const LAST_CHANCE_MS = 60000;     // after the first finisher, the others have this long to cross the line
export const ROOM_TTL_MS = 3 * 3600_000;
export const WORLDS_MAX = 200, LEVELS_MAX = 40;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const makeCode = (rnd = Math.random) => { let c = ''; for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(rnd() * ALPHABET.length)]; return c; };
export const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
const int = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export const cleanName = (s) => String(s || 'Racer').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || 'Racer';

export function newRaceRoom({ code, uid, name, veh, world, level, now }) {
  return {
    code, host: uid, players: [uid], names: { [uid]: cleanName(name) }, veh: { [uid]: int(veh, 0, 99, 0) },
    world: int(world, 0, WORLDS_MAX, 0), level: int(level, 0, LEVELS_MAX, 0),
    status: 'wait', startAt: null, firstAt: null, results: [], round: 1,
    createdAt: now, expireAt: new Date(now + ROOM_TTL_MS),
  };
}

export function joinRaceRoom(room, { uid, name, veh }) {
  if (room.players.includes(uid)) { room.names[uid] = cleanName(name); room.veh[uid] = int(veh, 0, 99, 0); return room; }   // re-joining after a reload
  if (room.status !== 'wait') throw Object.assign(new Error('This race already started'), { status: 409 });
  if (room.players.length >= MAX_RACERS) throw Object.assign(new Error('Room is full'), { status: 409 });
  room.players.push(uid); room.names[uid] = cleanName(name); room.veh[uid] = int(veh, 0, 99, 0);
  return room;
}

/** Remove a racer. Returns null when the room is now empty (caller deletes it). */
export function leaveRaceRoom(room, uid) {
  if (!room.players.includes(uid)) return room;
  room.players = room.players.filter((p) => p !== uid);
  delete room.names[uid]; delete room.veh[uid];
  if (!room.players.length) return null;
  if (room.host === uid) room.host = room.players[0];
  if (room.status === 'race') settleIfDone(room);
  return room;
}

export function setTrack(room, uid, { world, level }) {
  if (room.host !== uid) throw Object.assign(new Error('Only the host picks the road'), { status: 403 });
  if (room.status !== 'wait') throw Object.assign(new Error('Race already started'), { status: 409 });
  room.world = int(world, 0, WORLDS_MAX, room.world); room.level = int(level, 0, LEVELS_MAX, room.level);
  return room;
}

export function startRace(room, uid, now) {
  if (room.host !== uid) throw Object.assign(new Error('Only the host can start'), { status: 403 });
  if (room.status !== 'wait') throw Object.assign(new Error('Race already started'), { status: 409 });
  if (room.players.length < MIN_RACERS) throw Object.assign(new Error('Wait for at least one more racer'), { status: 409 });
  room.status = 'race'; room.startAt = now + COUNTDOWN_MS; room.firstAt = null; room.results = [];
  return room;
}

/** A racer crossed the line. Time is measured by the SERVER (arrival − shared start), never trusted from the phone. */
export function finishRace(room, uid, now) {
  if (!room.players.includes(uid)) throw Object.assign(new Error('Not in this room'), { status: 403 });
  if (room.status !== 'race') return room;
  if (room.results.some((r) => r.uid === uid)) return room;
  const ms = now - room.startAt;
  if (ms < MIN_RACE_MS) throw Object.assign(new Error('Finish rejected'), { status: 400 });
  room.results.push({ uid, ms, place: room.results.length + 1 });
  if (room.firstAt == null) room.firstAt = now;
  settleIfDone(room);
  return room;
}

/** Everyone who did not finish within LAST_CHANCE_MS of the winner is ranked behind (DNF). Any racer may call it. */
export function closeRace(room, now) {
  if (room.status === 'race' && room.firstAt != null && now - room.firstAt >= LAST_CHANCE_MS) { room.status = 'done'; room.dnf = room.players.filter((p) => !room.results.some((r) => r.uid === p)); }
  return room;
}

function settleIfDone(room) {
  if (room.status === 'race' && room.players.length && room.players.every((p) => room.results.some((r) => r.uid === p))) room.status = 'done';
  if (room.status === 'race' && room.players.length === 1 && room.results.length) room.status = 'done'; // everyone else left after a finish
}

export function rematch(room, uid) {
  if (room.host !== uid) throw Object.assign(new Error('Only the host can restart'), { status: 403 });
  if (room.status !== 'done') throw Object.assign(new Error('Race still running'), { status: 409 });
  room.status = 'wait'; room.startAt = null; room.firstAt = null; room.results = []; room.dnf = []; room.round = (room.round || 1) + 1;
  return room;
}
