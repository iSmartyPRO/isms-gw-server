import { query } from '../../config/database.js';
import { ensureAclTable } from '../shared/acl.js';

/*
 * Tables of the SMS gateway (idempotent, runs on every start).
 *
 *   sms_devices        phones running iSMS GW, with their connection token
 *   sms_device_acl     who may read / send / manage a phone (modules/shared/acl.js)
 *   sms_sims           SIM cards and eSIM profiles each phone reported
 *   sms_messages       incoming and outgoing messages, the send queue
 *   sms_device_events  connection journal of a phone
 *   sms_templates      message templates
 */
export async function ensureSmsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS sms_devices (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      color VARCHAR(16),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      token_hash CHAR(64) NOT NULL UNIQUE,
      token_prefix VARCHAR(24) NOT NULL,
      token_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      device_uid VARCHAR(100),
      phone_name VARCHAR(120),
      app_version VARCHAR(40),
      online BOOLEAN NOT NULL DEFAULT FALSE,
      connected_at TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ,
      last_ip VARCHAR(64),
      offline_notified BOOLEAN NOT NULL DEFAULT TRUE,
      rate_per_minute INTEGER,
      stats JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ensureAclTable('sms_device_acl', 'sms_devices');

  await query(`
    CREATE TABLE IF NOT EXISTS sms_sims (
      id SERIAL PRIMARY KEY,
      device_id INTEGER NOT NULL REFERENCES sms_devices(id) ON DELETE CASCADE,
      sim_id INTEGER NOT NULL,
      slot SMALLINT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      embedded BOOLEAN NOT NULL DEFAULT FALSE,
      carrier VARCHAR(80),
      display_name VARCHAR(80),
      number VARCHAR(40),
      country VARCHAR(8),
      phone_label VARCHAR(60),
      phone_color VARCHAR(7),
      phone_send BOOLEAN NOT NULL DEFAULT TRUE,
      phone_receive BOOLEAN NOT NULL DEFAULT TRUE,
      icc_tail VARCHAR(8),
      label VARCHAR(60),
      color VARCHAR(7),
      send_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      daily_limit INTEGER NOT NULL DEFAULT 0,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (device_id, sim_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sms_messages (
      id BIGSERIAL PRIMARY KEY,
      uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
      device_id INTEGER REFERENCES sms_devices(id) ON DELETE CASCADE,
      sim_row_id INTEGER REFERENCES sms_sims(id) ON DELETE SET NULL,
      slot SMALLINT NOT NULL DEFAULT 0,
      direction VARCHAR(3) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      text TEXT NOT NULL,
      parts SMALLINT NOT NULL DEFAULT 1,
      encoding VARCHAR(8),
      status VARCHAR(16) NOT NULL,
      error TEXT,
      error_code VARCHAR(32),
      ref VARCHAR(64),
      batch_id UUID,
      source VARCHAR(16) NOT NULL DEFAULT 'web',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      device_message_id BIGINT,
      attempts SMALLINT NOT NULL DEFAULT 0,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      send_after TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      dispatched_at TIMESTAMPTZ,
      accepted_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS sms_messages_device_idx ON sms_messages (device_id, id DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS sms_messages_thread_idx ON sms_messages (device_id, phone, id DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS sms_messages_queue_idx ON sms_messages (device_id, id) WHERE status IN ('queued', 'scheduled', 'dispatched')`);
  await query(`CREATE INDEX IF NOT EXISTS sms_messages_created_idx ON sms_messages (created_at)`);
  // "Today" counters per phone and per SIM (daily limits); the SIM index also serves ON DELETE SET NULL.
  await query(`CREATE INDEX IF NOT EXISTS sms_messages_device_created_idx ON sms_messages (device_id, created_at)`);
  await query(`CREATE INDEX IF NOT EXISTS sms_messages_sim_created_idx ON sms_messages (sim_row_id, created_at) WHERE sim_row_id IS NOT NULL`);
  await query(`CREATE INDEX IF NOT EXISTS sms_messages_batch_idx ON sms_messages (batch_id) WHERE batch_id IS NOT NULL`);
  // A message the phone reported once is stored once, even when the phone re-sends it after a reconnect.
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_phone_msg_key ON sms_messages (device_id, direction, device_message_id) WHERE device_message_id IS NOT NULL`
  );

  await query(`
    CREATE TABLE IF NOT EXISTS sms_device_events (
      id BIGSERIAL PRIMARY KEY,
      device_id INTEGER NOT NULL REFERENCES sms_devices(id) ON DELETE CASCADE,
      kind VARCHAR(32) NOT NULL,
      detail JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS sms_device_events_idx ON sms_device_events (device_id, id DESC)`);

  await query(`
    CREATE TABLE IF NOT EXISTS sms_templates (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      text TEXT NOT NULL,
      shared BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // After a restart no phone is connected yet; they reconnect within seconds.
  await query(`UPDATE sms_devices SET online = FALSE WHERE online`);
  // Messages handed to a phone that never acknowledged them go back to the queue.
  await query(`UPDATE sms_messages SET status = 'queued', updated_at = NOW() WHERE status = 'dispatched'`);
}
