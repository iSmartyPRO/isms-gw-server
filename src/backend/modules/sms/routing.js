/*
 * Choosing the phone and SIM for an outgoing message (pure).
 *
 * A candidate is one SIM of a phone the sender may send through:
 *   { deviceId, simRowId, slot, online, deviceEnabled, simActive, sendEnabled, sentToday, dailyLimit }
 * A SIM qualifies when the phone is switched on, the SIM is active with sending
 * on, and today's limit (0 = none) is not used up. Online phones come first,
 * then the SIM with the most room left today (least used when there is no
 * limit), then the lower id so the choice is stable.
 */

export function usable(candidate, planned = 0) {
  if (!candidate.deviceEnabled || !candidate.simActive || !candidate.sendEnabled) return false;
  return !candidate.dailyLimit || candidate.sentToday + planned < candidate.dailyLimit;
}

function room(candidate, planned) {
  return candidate.dailyLimit ? candidate.dailyLimit - candidate.sentToday - planned : Number.MAX_SAFE_INTEGER - candidate.sentToday - planned;
}

/** The best candidate for one message, or null. `planned` counts what this batch already put on each SIM. */
export function pickRoute(candidates, planned = new Map()) {
  let best = null;
  for (const candidate of candidates) {
    const used = planned.get(candidate.simRowId) || 0;
    if (!usable(candidate, used)) continue;
    if (!best) {
      best = { candidate, used };
      continue;
    }
    const a = candidate;
    const b = best.candidate;
    if (a.online !== b.online) {
      if (a.online) best = { candidate, used };
      continue;
    }
    const ra = room(a, used);
    const rb = room(b, best.used);
    if (ra > rb || (ra === rb && a.simRowId < b.simRowId)) best = { candidate, used };
  }
  return best ? best.candidate : null;
}

/**
 * Routes a whole batch: one candidate per recipient (null when nothing is
 * left), spreading the load across SIMs as their room shrinks.
 */
export function planBatch(candidates, count) {
  const planned = new Map();
  const out = [];
  for (let index = 0; index < count; index += 1) {
    const choice = pickRoute(candidates, planned);
    out.push(choice);
    if (choice) planned.set(choice.simRowId, (planned.get(choice.simRowId) || 0) + 1);
  }
  return out;
}
