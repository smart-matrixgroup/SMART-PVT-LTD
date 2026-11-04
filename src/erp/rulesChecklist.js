// ─────────────────────────────────────────────────────────────────
//  Security rules checklist — the live probe on top of the list in
//  rulesBlocks.js.
//
//  The owner deploys rules by hand (npx firebase deploy --only …), so a
//  new collection only works after that one command. Before this file,
//  each page printed its own "deploy the rules" sentence and nobody
//  could see which blocks were still missing. Settings → Rules Status
//  reads the list, probes each collection live, and shows exactly what
//  is not deployed yet.
//
//  A probe is a real read: Firestore refuses a whole collection query
//  when no rule allows it, so "permission-denied" here means the block
//  is missing from the DEPLOYED rules (the repo file can be ahead of
//  what is live).
// ─────────────────────────────────────────────────────────────────
import { collection, limit, query, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { RULES_BLOCKS } from './rulesBlocks.js';

export { DEPLOY_COMMAND, RULES_BLOCKS, pendingBlocks, changedBlocks, RULES_REVISION } from './rulesBlocks.js';

/**
 * Read one document from each collection as the signed-in admin.
 * Returns { [coll]: 'live' | 'blocked' | 'error' | 'offline' }.
 * 'blocked'  → the deployed rules do not allow it (missing block, or the
 *              signed-in email is not in isAdmin()).
 */
export async function probeRulesBlocks(onEach) {
  const results = {};
  await Promise.all(RULES_BLOCKS.map(async block => {
    let state = 'live';
    try {
      await getDocs(query(collection(db, block.coll), limit(1)));
    } catch (err) {
      const code = err?.code || err?.type || '';
      state = code === 'permission-denied' || /permission|insufficient/i.test(String(err?.message))
        ? 'blocked' : 'error';
      if (/unavailable|offline|network|failed-precondition.*offline/i.test(String(err?.message))) state = 'offline';
    }
    results[block.coll] = state;
    if (onEach) onEach(block.coll, state);
  }));
  return results;
}
