import { ensureSmsSchema } from './schema.js';
import { privateRoutes } from './routes.js';
import { registerJob } from '../../services/scheduler.js';
import { getSettingsView } from '../../services/settings.js';
import { expireQueue, offlineDevices, purgeOld } from './service.js';
import { notifyOffline, logDeviceEvent } from './events.js';
import { ensureSmsKnowledgeBase } from './kbSeed.js';

const enabled = async () => Boolean((await getSettingsView()).modules.sms?.enabled);

registerJob({
  name: 'sms.queue',
  everyMs: 60_000,
  run: async () => {
    if (!(await enabled())) return;
    await expireQueue();
    for (const { row, minutes } of await offlineDevices()) {
      await logDeviceEvent(row.id, 'offline_alert', { minutes });
      await notifyOffline(row, minutes);
    }
  },
});

registerJob({
  name: 'sms.cleanup',
  everyMs: 6 * 3_600_000,
  run: async () => {
    if (await enabled()) await purgeOld();
  },
});

/** SMS gateway: phones with iSMS GW, SIM cards, the send queue, inbox, templates and the API. */
export default {
  id: 'sms',
  schema: async () => {
    await ensureSmsSchema();
    await ensureSmsKnowledgeBase();
  },
  routes: privateRoutes,
};
