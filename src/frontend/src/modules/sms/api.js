import api from '../../services/api';

const base = '/app/sms';

export const smsApi = {
  config: () => api.get(`${base}/config`),
  overview: (params) => api.get(`${base}/overview`, { params }),
  segments: (text) => api.post(`${base}/tools/segments`, { text }),
  numbers: (to, country) => api.post(`${base}/tools/numbers`, { to, country }),

  devices: () => api.get(`${base}/devices`),
  device: (id) => api.get(`${base}/devices/${id}`),
  createDevice: (payload) => api.post(`${base}/devices`, payload),
  updateDevice: (id, payload) => api.put(`${base}/devices/${id}`, payload),
  deleteDevice: (id) => api.delete(`${base}/devices/${id}`),
  rotateToken: (id) => api.post(`${base}/devices/${id}/token`),
  refreshDevice: (id) => api.post(`${base}/devices/${id}/refresh`),
  deviceEvents: (id) => api.get(`${base}/devices/${id}/events`),
  access: (id) => api.get(`${base}/devices/${id}/access`),
  saveAccess: (id, entries) => api.put(`${base}/devices/${id}/access`, { entries }),
  subjects: () => api.get(`${base}/subjects`),

  updateSim: (id, payload) => api.put(`${base}/sims/${id}`, payload),
  deleteSim: (id) => api.delete(`${base}/sims/${id}`),

  messages: (params) => api.get(`${base}/messages`, { params }),
  count: (params) => api.get(`${base}/messages/count`, { params }),
  message: (id) => api.get(`${base}/messages/${id}`),
  send: (payload) => api.post(`${base}/messages`, payload),
  cancel: (id) => api.post(`${base}/messages/${id}/cancel`),
  retry: (id) => api.post(`${base}/messages/${id}/retry`),
  markRead: (payload) => api.post(`${base}/messages/read`, payload),
  exportUrl: (params) => {
    const query = new URLSearchParams(Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== ''));
    return `/api${base}/messages/export${query.toString() ? `?${query}` : ''}`;
  },

  threads: (params) => api.get(`${base}/threads`, { params }),
  thread: (deviceId, phone, params) => api.get(`${base}/threads/${deviceId}/${encodeURIComponent(phone)}`, { params }),

  templates: () => api.get(`${base}/templates`),
  createTemplate: (payload) => api.post(`${base}/templates`, payload),
  updateTemplate: (id, payload) => api.put(`${base}/templates/${id}`, payload),
  deleteTemplate: (id) => api.delete(`${base}/templates/${id}`),
};

/** wss://<this portal>/ws/device — the address a phone connects to. */
export function deviceUrl(path = '/ws/device') {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}${path}`;
}

/*
 * Message length on the client — the same rules as modules/sms/phone.js on the
 * server (GSM-7 160/153, UCS-2 70/67), so the counter updates while typing.
 */
const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);
const GSM_EXTENDED = new Set('^{}\\[~]|€\f');

export function smsSegments(text) {
  const value = String(text ?? '');
  let septets = 0;
  let gsm = true;
  for (const char of value) {
    if (GSM_BASIC.has(char)) septets += 1;
    else if (GSM_EXTENDED.has(char)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) {
    const parts = septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153);
    const per = parts > 1 ? 153 : 160;
    return { encoding: 'GSM-7', length: septets, parts, perPart: per, remaining: parts === 0 ? 160 : parts * per - septets };
  }
  const units = value.length;
  const parts = units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67);
  const per = parts > 1 ? 67 : 70;
  return { encoding: 'UCS-2', length: units, parts, perPart: per, remaining: parts * per - units };
}

/** Characters that force UCS-2 (to suggest replacing them). */
export function nonGsmChars(text) {
  const out = new Set();
  for (const char of String(text ?? '')) if (!GSM_BASIC.has(char) && !GSM_EXTENDED.has(char)) out.add(char);
  return [...out];
}

export const STATUS_COLORS = {
  scheduled: '#7950F2',
  queued: '#868E96',
  dispatched: '#4C6EF5',
  accepted: '#1C7ED6',
  sent: '#0CA678',
  delivered: '#2F9E44',
  failed: '#E03131',
  cancelled: '#868E96',
  expired: '#E8590C',
  received: '#00A3E0',
};

export const SIM_COLORS = ['#00A3E0', '#7950F2', '#F59F00', '#E64980', '#0CA678', '#4C6EF5', '#E8590C', '#334155'];
