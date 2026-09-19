import { deleteOlderThan } from "../../lib/store.js";

/* Retention sweep.

   The privacy policy states that form submissions are deleted after 12
   months. This is the code that makes that true — without it the policy
   would be a claim rather than a fact.

   Deliberately deletes every row past the cutoff, converted enquiries
   included: this table is the enquiry log, not the contract file. Data that
   became contract or accounting documentation lives elsewhere and has its
   own retention. */

const RETENTION_MONTHS = 12;

export function cutoffIso(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  return cutoff.toISOString();
}

export async function runRetentionSweep(env) {
  const cutoff = cutoffIso();

  try {
    const deleted = await deleteOlderThan(env.DB, cutoff);
    console.log({ event: "retention_sweep", cutoff, deleted });
    return deleted;
  } catch (err) {
    /* Logged, not thrown: a failed sweep is a problem to notice, not a
       reason to retry hard. The next run picks up whatever this one missed,
       since the cutoff is recomputed from scratch each time. */
    console.error({ event: "retention_sweep_failed", cutoff, message: String(err) });
    return 0;
  }
}
