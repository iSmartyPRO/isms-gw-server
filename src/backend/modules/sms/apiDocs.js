/*
 * The SMS gateway in the developer portal (api/reference.js): a section and
 * the endpoints integrations use most. Texts: L(ru, en, ky, tr, zh) — ky/zh
 * fall back to English.
 */

const L = (ru, en, ky, tr, zh) => ({ ru, en, ky, tr, zh });
const q = (name, type, desc, extra = {}) => ({ name, type, desc, ...extra });
const b = (name, type, desc, extra = {}) => ({ name, type, desc, ...extra });

export const SMS_SECTION = {
  key: 'sms',
  area: 'sms',
  prefix: ['/app/sms'],
  title: L('SMS-шлюз', 'SMS gateway', undefined, 'SMS ağ geçidi'),
  intro: L(
    'Отправка и приём SMS через подключённые телефоны с iSMS GW: телефоны и SIM-карты, очередь, статусы, диалоги, шаблоны. Токен можно ограничить отдельными телефонами.',
    'Send and receive SMS through connected phones running iSMS GW: phones and SIM cards, the queue, statuses, conversations, templates. A token can be limited to some phones.',
    undefined,
    'iSMS GW çalıştıran bağlı telefonlar üzerinden SMS gönderin ve alın: telefonlar ve SIM kartlar, kuyruk, durumlar, sohbetler, şablonlar. Bir belirteç belirli telefonlarla sınırlandırılabilir.'
  ),
};

const MESSAGE = {
  id: 1842,
  uuid: '1f0c6a52-3a1d-4f8e-9b0e-7c2d4e5f6a7b',
  deviceId: 3,
  deviceName: 'Office Pixel',
  simId: 7,
  slot: 1,
  direction: 'out',
  phone: '+996555123456',
  text: 'Your code: 4821',
  parts: 1,
  encoding: 'GSM-7',
  status: 'queued',
  ref: 'order-1001',
  createdAt: '2026-10-19T09:31:00.000Z',
};

export const SMS_DOCS = {
  'GET /app/sms/overview': {
    summary: L('Сводка: сегодня, график, телефоны', 'Overview: today, chart, phones', undefined, 'Özet: bugün, grafik, telefonlar'),
    query: [q('days', 'integer', L('Дней в графике (1–90)', 'Days in the chart (1–90)', undefined, 'Grafikteki gün sayısı (1–90)')), q('deviceId', 'integer', L('Только этот телефон', 'Only this phone', undefined, 'Yalnızca bu telefon'))],
    response: { success: true, today: { sent: 120, delivered: 115, failed: 2, received: 34, queued: 3, scheduled: 0, unread: 5 }, period: { days: 14, deliveryRate: 97.4 }, devices: { total: 2, online: 2 } },
  },
  'GET /app/sms/devices': {
    summary: L('Телефоны', 'Phones', undefined, 'Telefonlar'),
    description: L('Телефоны, доступные владельцу токена, с SIM-картами, статусом подключения и счётчиками за сегодня.', 'Phones available to the token owner, with SIM cards, connection state and today’s counters.', undefined, 'Belirteç sahibinin erişebildiği telefonlar; SIM kartlar, bağlantı durumu ve bugünkü sayaçlarla.'),
    response: { success: true, devices: [{ id: 3, name: 'Office Pixel', online: true, appVersion: '1.4.0', level: 'manage', sims: [{ id: 7, slot: 1, carrier: 'MegaCom', number: '+996555000111', sendEnabled: true, dailyLimit: 300, sentToday: 42 }] }] },
  },
  'POST /app/sms/devices': {
    summary: L('Добавить телефон', 'Add a phone', undefined, 'Telefon ekle'),
    description: L('Возвращает токен подключения — он показывается один раз. В приложении iSMS GW: Настройки → SMS-сервер → адрес wss://<портал>/ws/device и этот токен.', 'Returns the connection token — shown once. In iSMS GW: Settings → SMS server → address wss://<portal>/ws/device and this token.', undefined, 'Bağlantı belirtecini döndürür — yalnızca bir kez gösterilir. iSMS GW’de: Ayarlar → SMS sunucusu → adres wss://<portal>/ws/device ve bu belirteç.'),
    body: [b('name', 'string', L('Название', 'Name', undefined, 'Ad'), { required: true }), b('description', 'string', L('Описание', 'Description', undefined, 'Açıklama')), b('color', '#RRGGBB', L('Цвет', 'Colour', undefined, 'Renk')), b('ratePerMinute', 'integer', L('Сообщений в минуту (1–120)', 'Messages per minute (1–120)', undefined, 'Dakikada mesaj (1–120)'))],
    response: { success: true, device: { id: 4, name: 'Warehouse Samsung', online: false }, token: 'smsgw_Ab12Cd34_…' },
  },
  'PUT /app/sms/devices/:id': { summary: L('Изменить телефон', 'Update a phone', undefined, 'Telefonu güncelle'), body: [b('name', 'string', L('Название', 'Name', undefined, 'Ad')), b('enabled', 'boolean', L('Включён (выключенный не принимает подключения)', 'Enabled (a disabled phone cannot connect)', undefined, 'Etkin (devre dışı telefon bağlanamaz)')), b('ratePerMinute', 'integer | null', L('Своя скорость отправки', 'Own sending rate', undefined, 'Kendi gönderim hızı'))] },
  'POST /app/sms/devices/:id/token': { summary: L('Новый токен подключения', 'New connection token', undefined, 'Yeni bağlantı belirteci'), description: L('Старый токен перестаёт работать, телефон отключается.', 'The old token stops working and the phone is disconnected.', undefined, 'Eski belirteç çalışmayı bırakır ve telefonun bağlantısı kesilir.') },
  'POST /app/sms/devices/:id/refresh': { summary: L('Запросить SIM и статистику у телефона', 'Ask the phone for SIMs and statistics', undefined, 'Telefondan SIM ve istatistik iste') },
  'PUT /app/sms/sims/:id': {
    summary: L('Настроить SIM-карту', 'Configure a SIM card', undefined, 'SIM kartı yapılandır'),
    body: [b('label', 'string', L('Своё название', 'Own label', undefined, 'Kendi etiketi')), b('color', '#RRGGBB', L('Цвет', 'Colour', undefined, 'Renk')), b('sendEnabled', 'boolean', L('Отправлять через неё', 'Send through it', undefined, 'Bu SIM ile gönder')), b('dailyLimit', 'integer', L('Лимит в сутки, 0 — без лимита', 'Daily limit, 0 = none', undefined, 'Günlük limit, 0 = yok'))],
  },
  'POST /app/sms/messages': {
    summary: L('Отправить SMS', 'Send SMS', undefined, 'SMS gönder'),
    description: L(
      'Ставит сообщения в очередь и сразу отвечает. Без deviceId и simId шлюз сам выбирает телефон (онлайн) и SIM с наибольшим запасом дневного лимита. Если телефон не в сети, сообщение ждёт его до истечения срока очереди. Статус — GET /app/sms/messages/:id или вебхуки sms.sent / sms.delivered / sms.failed.',
      'Queues the messages and answers at once. Without deviceId and simId the gateway picks an online phone and the SIM with the most room left today. If the phone is offline the message waits for it until the queue time runs out. Status: GET /app/sms/messages/:id or the webhooks sms.sent / sms.delivered / sms.failed.',
      undefined,
      'Mesajları kuyruğa alır ve hemen yanıt verir. deviceId ve simId olmadan ağ geçidi çevrimiçi bir telefon ve bugün en çok yeri kalan SIM’i seçer. Telefon çevrimdışıysa mesaj, kuyruk süresi dolana kadar onu bekler. Durum: GET /app/sms/messages/:id veya sms.sent / sms.delivered / sms.failed webhook’ları.'
    ),
    body: [
      b('to', 'string | string[]', L('Номер или список; в строке — через запятую или с новой строки. Местные номера — со страной по умолчанию', 'A number or a list; in a string separated by commas or new lines. Local numbers use the default country', undefined, 'Numara veya liste; metinde virgül ya da yeni satırla ayrılır. Yerel numaralar varsayılan ülkeyi kullanır'), { required: true }),
      b('text', 'string', L('Текст (длинный разбивается на части)', 'Text (a long one is split into parts)', undefined, 'Metin (uzun metin parçalara bölünür)'), { required: true }),
      b('deviceId', 'integer', L('Через этот телефон', 'Through this phone', undefined, 'Bu telefon üzerinden')),
      b('simId', 'integer', L('Через эту SIM (id из /devices)', 'Through this SIM (id from /devices)', undefined, 'Bu SIM üzerinden (/devices içindeki id)')),
      b('sendAt', 'ISO 8601', L('Отправить позже (до 90 дней)', 'Send later (up to 90 days)', undefined, 'Daha sonra gönder (90 güne kadar)')),
      b('ref', 'string', L('Ваш идентификатор (до 64 символов) — вернётся в ответах и вебхуках', 'Your reference (up to 64 chars) — returned in answers and webhooks', undefined, 'Kendi referansınız (64 karaktere kadar) — yanıtlarda ve webhook’larda döner')),
      b('country', 'ISO 3166', L('Страна для местных номеров в этом запросе', 'Country for local numbers in this request', undefined, 'Bu istekteki yerel numaralar için ülke')),
    ],
    response: { success: true, batchId: null, segments: { encoding: 'GSM-7', parts: 1 }, messages: [MESSAGE], invalid: [] },
  },
  'GET /app/sms/messages': {
    summary: L('Сообщения', 'Messages', undefined, 'Mesajlar'),
    description: L('Новые сверху. Для опроса входящих: direction=in&sinceId=<последний id> — ответ по возрастанию id.', 'Newest first. To poll incoming: direction=in&sinceId=<last id> — the answer is in ascending id order.', undefined, 'En yeniler önce. Gelenleri yoklamak için: direction=in&sinceId=<son id> — yanıt artan id sırasındadır.'),
    query: [
      q('direction', '"in" | "out"', L('Входящие или исходящие', 'Incoming or outgoing', undefined, 'Gelen veya giden')),
      q('status', 'string', L('Статусы через запятую или группы pending, done, problem', 'Statuses, comma-separated, or groups pending, done, problem', undefined, 'Virgülle ayrılmış durumlar veya pending, done, problem grupları')),
      q('deviceId', 'integer', L('Телефон', 'Phone', undefined, 'Telefon')),
      q('simId', 'integer', L('SIM', 'SIM', undefined, 'SIM')),
      q('phone', 'string', L('Номер или его часть', 'Number or part of it', undefined, 'Numara veya bir kısmı')),
      q('q', 'string', L('Поиск по тексту', 'Search in the text', undefined, 'Metinde ara')),
      q('ref', 'string', L('Ваш идентификатор', 'Your reference', undefined, 'Referansınız')),
      q('batchId', 'uuid', L('Рассылка', 'Batch', undefined, 'Toplu gönderim')),
      q('unread', 'boolean', L('Только непрочитанные входящие', 'Unread incoming only', undefined, 'Yalnızca okunmamış gelenler')),
      q('from', 'ISO 8601', L('С даты', 'From', undefined, 'Başlangıç')),
      q('to', 'ISO 8601', L('До даты', 'To', undefined, 'Bitiş')),
      q('sinceId', 'integer', L('Новее этого id (по возрастанию)', 'Newer than this id (ascending)', undefined, 'Bu id’den yeni (artan)')),
      q('before', 'integer', L('Старше этого id (следующая страница)', 'Older than this id (next page)', undefined, 'Bu id’den eski (sonraki sayfa)')),
      q('limit', 'integer', L('До 200, по умолчанию 50', 'Up to 200, default 50', undefined, 'En fazla 200, varsayılan 50')),
    ],
    response: { success: true, messages: [{ ...MESSAGE, direction: 'in', status: 'received', phone: '+905321234567', text: 'Hello!' }], next: 1801 },
  },
  'GET /app/sms/messages/:id': { summary: L('Сообщение и его статус', 'A message and its status', undefined, 'Bir mesaj ve durumu'), description: L('id или uuid. Статусы: scheduled → queued → dispatched → accepted → sent → delivered, либо failed / cancelled / expired.', 'id or uuid. Statuses: scheduled → queued → dispatched → accepted → sent → delivered, or failed / cancelled / expired.', undefined, 'id veya uuid. Durumlar: scheduled → queued → dispatched → accepted → sent → delivered ya da failed / cancelled / expired.'), response: { success: true, message: { ...MESSAGE, status: 'delivered', sentAt: '2026-10-19T09:31:04.000Z', deliveredAt: '2026-10-19T09:31:09.000Z' } } },
  'POST /app/sms/messages/:id/cancel': { summary: L('Отменить сообщение в очереди', 'Cancel a queued message', undefined, 'Kuyruktaki mesajı iptal et') },
  'POST /app/sms/messages/:id/retry': { summary: L('Отправить ещё раз', 'Send again', undefined, 'Yeniden gönder') },
  'POST /app/sms/messages/read': { summary: L('Отметить входящие прочитанными', 'Mark incoming as read', undefined, 'Gelenleri okundu işaretle'), body: [b('ids', 'integer[]', L('Сообщения', 'Messages', undefined, 'Mesajlar')), b('deviceId', 'integer', L('Вместе с phone — весь диалог', 'With phone — the whole conversation', undefined, 'phone ile — tüm sohbet')), b('phone', 'string', L('Номер', 'Number', undefined, 'Numara')), b('all', 'boolean', L('Все', 'All', undefined, 'Tümü'))] },
  'GET /app/sms/messages/export': { summary: L('Выгрузка в CSV', 'Export to CSV', undefined, 'CSV olarak dışa aktar'), description: L('Те же фильтры, что у списка; до 50 000 строк.', 'The same filters as the list; up to 50,000 rows.', undefined, 'Listeyle aynı filtreler; en fazla 50.000 satır.') },
  'GET /app/sms/threads': { summary: L('Диалоги', 'Conversations', undefined, 'Sohbetler'), description: L('Последнее сообщение по каждому номеру и телефону, с числом непрочитанных.', 'The latest message per number and phone, with the unread count.', undefined, 'Her numara ve telefon için son mesaj, okunmamış sayısıyla.') },
  'GET /app/sms/threads/:deviceId/:phone': { summary: L('Переписка с номером', 'Conversation with a number', undefined, 'Bir numarayla yazışma') },
  'GET /app/sms/templates': { summary: L('Шаблоны', 'Templates', undefined, 'Şablonlar') },
  'POST /app/sms/templates': { summary: L('Создать шаблон', 'Create a template', undefined, 'Şablon oluştur'), body: [b('name', 'string', L('Название', 'Name', undefined, 'Ad'), { required: true }), b('text', 'string', L('Текст', 'Text', undefined, 'Metin'), { required: true }), b('shared', 'boolean', L('Виден всем', 'Visible to everyone', undefined, 'Herkese görünür'))] },
  'POST /app/sms/tools/segments': { summary: L('Посчитать части SMS', 'Count SMS parts', undefined, 'SMS parçalarını say'), body: [b('text', 'string', L('Текст', 'Text', undefined, 'Metin'), { required: true })], response: { success: true, segments: { encoding: 'UCS-2', length: 82, parts: 2, perPart: 67, remaining: 52 } } },
  'POST /app/sms/tools/numbers': { summary: L('Проверить и привести номера к E.164', 'Check numbers and bring them to E.164', undefined, 'Numaraları kontrol et ve E.164’e dönüştür'), body: [b('to', 'string | string[]', L('Номера', 'Numbers', undefined, 'Numaralar'), { required: true }), b('country', 'ISO 3166', L('Страна для местных', 'Country for local ones', undefined, 'Yerel numaralar için ülke'))], response: { success: true, valid: ['+996555123456'], invalid: [{ input: '12', reason: 'FORMAT' }], truncated: false } },
};
