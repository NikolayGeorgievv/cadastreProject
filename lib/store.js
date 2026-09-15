/* D1 persistence.

   The row is written before the email goes out, so a mail failure degrades
   to "we have it, nobody was told" rather than "it is gone". email_sent is
   the flag a sweeper cron can query later. */

export async function saveRequest(db, record) {
  if (!db) throw new Error("D1 binding missing");

  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO requests
         (id, created_at, name, phone, email, service, location, identifier,
          message, consent, ip, user_agent, email_sent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .bind(
      id,
      record.submittedAt,
      record.name,
      record.phone,
      record.email || null,
      record.service,
      record.location,
      record.identifier || null,
      record.message,
      record.consent ? 1 : 0,
      record.ip || null,
      record.userAgent || null
    )
    .run();

  return id;
}

export async function markEmailSent(db, id) {
  if (!db) return;
  await db.prepare(`UPDATE requests SET email_sent = 1 WHERE id = ?`).bind(id).run();
}

/* Used by the retention cron. Kept here so every statement that touches the
   table lives in one file. */
export async function deleteOlderThan(db, isoCutoff) {
  if (!db) return 0;
  const res = await db
    .prepare(`DELETE FROM requests WHERE created_at < ?`)
    .bind(isoCutoff)
    .run();
  return res.meta?.changes ?? 0;
}
