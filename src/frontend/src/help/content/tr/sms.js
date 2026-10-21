export default {
  id: 'sms',
  icon: 'sms',
  title: 'SMS ağ geçidi',
  tagline: 'Kendi Android telefonlarınız ve SIM kartlarınız üzerinden SMS gönderin ve alın.',
  summary: 'SMS ağ geçidi, iSMS GW uygulamasını çalıştıran sıradan Android telefonları ortak bir SMS hizmetine dönüştürür. Bir telefon bağladığınızda tarayıcıdan veya API üzerinden mesaj gönderebilir, gelen SMS’leri sohbetler halinde yanıtlayabilir, her mesajı kuyruktan teslimata kadar izleyebilir ve telefonları ekip arkadaşlarınızla paylaşabilirsiniz. Mesajlar, üçüncü taraf SMS sağlayıcıları olmadan, kendi SIM kartlarınızdan ve operatörünüzün tarifesiyle gönderilir.',
  highlights: [
    {
      icon: '📱',
      title: 'Kendi telefonlarınız ve SIM kartlarınız',
      text: 'Telefonu QR kodla bir dakikada ekleyin; Wi-Fi veya mobil veriyle bağlanır, sabit IP gerekmez.',
    },
    {
      icon: '✉️',
      title: 'Toplu gönderim',
      text: 'Listeyi yapıştırın ya da CSV içe aktarın, şablon seçin, parça sayısını görün ve gönderimi 90 güne kadar ileri tarihe planlayın.',
    },
    {
      icon: '💬',
      title: 'Sohbet görünümünde gelen kutusu',
      text: 'Gelen SMS’ler numaraya göre gruplanır; yanıt, mesajın geldiği SIM karttan gider.',
    },
    {
      icon: '🧭',
      title: 'Otomatik yönlendirme',
      text: 'Ağ geçidi çevrimiçi bir telefonu ve günlük limitinde en çok yeri kalan SIM kartı kendisi seçer.',
    },
    {
      icon: '📊',
      title: 'Tüm durumlar göz önünde',
      text: '“Kuyrukta”dan “Teslim edildi”ye kadar: her mesaj için zaman çizelgesi, filtreler, CSV dışa aktarma, iptal ve yeniden deneme.',
    },
    {
      icon: '🔌',
      title: 'API ve webhook’lar',
      text: 'CRM’inizden, web sitenizden veya ERP’nizden SMS gönderin; gelen mesajlar ve teslim raporları doğrudan sisteminize gelsin.',
    },
  ],
  tips: [
    'Telefonu şarjda tutun ve iSMS GW’yi pil optimizasyonunun dışında bırakın; aksi halde Android uygulamayı uyutabilir.',
    'Her SIM karta anlaşılır bir ad ve renk verin (“Ofis Turkcell”, “Satış Vodafone”); gelen kutusunda, geçmişte ve “Gönderen” listesinde görünür.',
    'Her SIM karta günlük limit koyun: operatörler çok fazla mesaj gönderen numaraları engeller, ağ geçidi ise yükü sizin yerinize dağıtır.',
    '“Referans” alanına (API’de `ref`) sipariş veya talep numaranızı yazın; geçmişte mesajı bununla kolayca bulursunuz.',
    'Sık gönderdiğiniz bir metin mi var? Ortak şablon olarak kaydedin, tüm ekip aynı ifadeyi kullansın.',
    'Bağlantı belirtecini hemen kopyalayın; yalnızca bir kez gösterilir. Kaybettiyseniz telefonun “Bağlantı” sekmesinden yenisini oluşturun.',
  ],
  sections: [
    {
      id: 'how-it-works',
      title: 'Nasıl çalışır',
      body: `Her telefonda ücretsiz **iSMS GW** uygulaması çalışır ([indir](https://github.com/iSmartyPRO/isms-gw-android/releases/latest), Android 8 ve üzeri). Uygulama portalla kalıcı ve güvenli bir bağlantı kurar; bu sayede telefon bir ev modeminin arkasında veya mobil veriyle de çalışabilir.

- Mesajı portalda yazar veya API üzerinden gönderirsiniz.
- Portal mesajı **kuyruğa** alır ve uygun bir telefona iletir.
- Telefon SMS’i seçilen SIM karttan gönderir ve sonucu bildirir: gönderildi, teslim edildi veya başarısız.
- Gelen SMS’ler ters yönde ilerler: telefon onları portala iletir ve **Gelen kutusu**nda görünürler.

Telefon çevrimdışıysa mesajlar kuyrukta bekler ve telefon yeniden bağlanır bağlanmaz gönderilir. Modül [SMS ağ geçidi](/app/sms) altında yer alır ve şu bölümlerden oluşur: **Genel bakış**, **Gelen kutusu**, **Gönder**, **Mesajlar**, **Şablonlar**, **API** ve **Telefonlar**.`,
      note: 'SMS’leri sizin SIM kartlarınız gönderir; bu yüzden operatörünüzün tarifesi ve sınırları geçerlidir. Portal mesajlar için ücret almaz.',
    },
    {
      id: 'add-phone',
      title: 'Telefon ekleme',
      body: `Telefon, [Telefonlar](/app/sms/devices) bölümündeki kısa bir sihirbazla eklenir. iSMS GW yüklü ve varsayılan SMS uygulaması olarak ayarlanmış telefonun kendisi elinizde olmalı.

Sihirbaz **sunucu adresini** \`wss://<portal>/ws/device\`, **bağlantı belirtecini** ve ikisini birden içeren bir **QR kodu** gösterir. Ardından telefonu canlı olarak bekler; telefon bağlanır bağlanmaz SIM kartlarını görürsünüz.`,
      steps: [
        '“Telefonlar”ı açın ve “Telefon ekle”ye tıklayın.',
        'Bir ad girin (örneğin “Ofis Pixel”) ve renk seçin; bu telefonun mesajları her yerde bu renkle işaretlenir.',
        'Telefonda iSMS GW → Ayarlar → SMS sunucusu bölümünü açın. QR kodu tarayın ya da adresi ve belirteci elle girin.',
        'Uygulamada sunucu bağlantısını açın. Sihirbaz bağlantıyı birkaç saniye içinde fark eder.',
        'Telefonun bildirdiği SIM kart listesini kontrol edin ve “Bitti”ye tıklayın ya da doğrudan ilk SMS’inizi gönderin.',
      ],
      note: 'Belirteç yalnızca bir kez gösterilir. Sihirbazı kopyalamadan kapattıysanız telefonu açın ve “Bağlantı” sekmesinden yeni bir belirteç oluşturun.',
    },
    {
      id: 'phone-page',
      title: 'Telefon sayfası ve SIM kartlar',
      body: `Sayfasını açmak için listedeki bir telefona tıklayın. Üstte durum (çevrimiçi veya çevrimdışı, son görülme), bugünün sayaçları ve gönderilen ile alınan mesajların grafiği yer alır. Sekmeler:

- **SIM kartlar** — telefonun tüm SIM ve eSIM’leri, operatör ve numarayla birlikte. Her biri için kendi **adını** ve **rengini** belirleyebilir, **gönderimi** açıp kapatabilir ve **günlük limit** koyabilirsiniz. Çubuk, bugünkü limitin ne kadarının kullanıldığını gösterir.
- **Bağlantı** — sunucu adresi, uygulama sürümü, IP adresi ve **belirteç değiştirme**. Yeni belirteç eskisini anında geçersiz kılar; yenisini uygulamaya girin.
- **Günlük** — telefonun ne zaman bağlanıp koptuğu, belirtecin ne zaman değiştirildiği, hatalar.
- **Ayarlar** — ad, açıklama, renk, **dakikadaki mesaj sayısı** (boş bırakılırsa portalın varsayılanı geçerli olur) ve **Etkin** anahtarı. Devre dışı bırakılan telefon bağlı kalır ama yeni mesaj almaz.`,
      example: {
        title: 'Bir telefon, iki SIM kart',
        body: 'SIM 1 “Ofis Turkcell”: gönderim açık, günde 300 limit, müşteri bildirimleri için. SIM 2 “Kişisel”: gönderim kapalı; portal bu SIM’e gelen SMS’leri gösterir ama otomatik yönlendirme onu asla kullanmaz.',
      },
      note: 'Telefondan çıkarılan bir SIM kart, geçmişiyle birlikte listede pasif olarak kalır ve yeniden takıldığında tekrar etkinleşir.',
    },
    {
      id: 'send',
      title: 'SMS gönderme',
      body: `[Gönder](/app/sms/send) bölümü tek bir mesaj için de toplu gönderim için de kullanılır.

- **Alıcılar** — numaraları virgül, boşluk veya yeni satırla ayırarak yapıştırın ya da bir CSV veya TXT dosyasını **içe aktarın**. Numaralar siz yazarken denetlenir: geçerli olanlar uluslararası biçimde gösterilir, geçersiz ve yinelenen numaralar açıklamasıyla atlanır. Yerel numaralara portalın varsayılan ülke kodu eklenir.
- **Gönderen** — **Otomatik** (ağ geçidi seçer) ya da belirli bir telefon ve SIM kart.
- **Metin** — yazın veya bir **şablon** seçin. Sayaç, karakter ve **SMS parçası** sayısını gösterir.
- **Zamanlama** — hemen ya da en fazla 90 gün sonrasına kadar seçtiğiniz tarih ve saatte.
- **Referans** — sipariş numarası gibi size ait bir etiket. Her mesajla birlikte saklanır, API yanıtlarında ve webhook’larda geri döner.

Göndermeden önce önizlemeyi ve özeti kontrol edin: kaç alıcı, toplam kaç parça.`,
      steps: [
        'Numaraları yapıştırın ya da “İçe aktar”a tıklayıp bir dosya seçin.',
        '“Gönderen”i “Otomatik” bırakın veya bir telefon ve SIM kart seçin.',
        'Metni yazın ya da “Şablon kullan”a tıklayın.',
        'Gerekirse gelişmiş seçenekleri açın: zamanlama ve referans.',
        '“Gönder”e (veya “Planla”ya) tıklayıp onaylayın. Gönderimi “Mesajlar” bölümünden izleyebilirsiniz.',
      ],
      example: {
        title: 'Parçalar ve kodlama',
        body: `Latin harfleriyle (GSM-7) yazılmış bir SMS **160 karakter** alır; daha uzun metin 153’erlik parçalara bölünür. Tek bir emoji, Kiril harfi ya da GSM tablosunda olmayan bir karakter (ör. Türkçedeki **ğ**, **ş**, **ı**) tüm mesajı Unicode’a (UCS-2) geçirir: **70 karakter**, çok parçalı mesajda parça başına 67.

“Siparisiniz hazir” 1 parçadır. Aynı mesaj “Siparişiniz hazır” diye yazılıp 80 karaktere uzarsa 2 parça olur ve iki SMS olarak ücretlendirilir.`,
      },
    },
    {
      id: 'routing',
      title: 'Otomatik yönlendirme ve limitler',
      body: `“Gönderen: Otomatik” seçiliyken her mesajı hangi telefonun ve SIM kartın göndereceğine ağ geçidi karar verir:

- yalnızca gönderim yetkiniz olan, **etkin** ve **çevrimiçi** telefonlar;
- yalnızca gönderimi açık ve **günlük limiti** dolmamış SIM kartlar;
- bunlar arasından **bugün en çok yeri kalan** SIM kart; böylece yük eşit dağılır.

Her telefonun ayrıca bir hızı vardır: **dakikadaki mesaj sayısı** (varsayılan 20). Böylece 1.000 SMS’lik bir gönderim, operatörlerin sevmediği tek bir patlama yerine düzenli olarak gider.

Hiçbir telefon çevrimiçi değilse mesajlar kuyrukta bekler. Kuyruk ömrü (varsayılan 24 saat) içinde hiçbir telefon bağlanmazsa mesajların durumu **Süresi doldu** olur.`,
      note: 'Günlük limiti dolmuş ya da gönderimi kapalı belirli bir SIM kart mı seçtiniz? Mesaj başka bir SIM üzerinden gitmez; herhangi bir SIM uygunsa “Otomatik”i seçin.',
    },
    {
      id: 'inbox',
      title: 'Gelen kutusu ve yanıtlar',
      body: `[Gelen kutusu](/app/sms/inbox), gelen SMS’leri sohbetler halinde toplar: her numara için bir sohbet, iki yönlü yazışmanın tamamıyla birlikte. Okunmamış sohbetler kalın yazılır, menüdeki sayaç kaç tanesinin beklediğini gösterir.

- Telefona göre filtreleyin ya da numara ve metinde arama yapın.
- Bir sohbeti açın ve yanıtınızı alta yazın; yanıt, son mesajın geldiği **aynı SIM karttan** gider ve karşı taraf tanıdık bir numara görür.
- “Tümünü okundu işaretle” sayacı tek seferde sıfırlar.

Bir telefona yalnızca görüntüleme erişiminiz varsa sohbetleri salt okunur açılır.`,
    },
    {
      id: 'messages',
      title: 'Mesaj geçmişi ve durumlar',
      body: `[Mesajlar](/app/sms/messages), telefonlarınızdaki tüm gelen ve giden SMS’lerin tablosudur. Telefona, yöne, durum grubuna (işlemde, tamamlandı, sorunlu) ve döneme göre filtreleyin; numara, metin veya referansla arayın ve gördüklerinizi **CSV olarak dışa aktarın**.

Bir satıra tıklayınca mesaj kartı açılır: metnin tamamı, telefon ve SIM, parça sayısı, deneme sayısı, hata kodu ve **durum zaman çizelgesi**.

- **Planlandı** — zamanını bekliyor.
- **Kuyrukta** — boş bir telefon bekliyor.
- **İletildi** — telefona aktarıldı.
- **Kabul edildi** — telefon mesajı üstlendi.
- **Gönderildi** — SIM karttan çıktı.
- **Teslim edildi** — operatör teslimatı onayladı.
- **Başarısız** — telefon veya operatör gönderemedi; nedeni kartta yazar.
- **İptal edildi** — gönderilmeden önce iptal ettiniz.
- **Süresi doldu** — kuyruk ömrü boyunca hiçbir telefon almadı.

Planlanmış veya kuyrukta bekleyen bir mesaj **iptal edilebilir**; başarısız ya da süresi dolmuş bir mesaj **yeniden denenebilir**.`,
      note: '“Teslim edildi” durumu, operatörün teslim raporu göndermesine bağlıdır. Bazı operatörler göndermez; bu durumda mesaj ulaşmış olsa bile “Gönderildi” olarak kalabilir.',
    },
    {
      id: 'templates',
      title: 'Şablonlar',
      body: `[Şablonlar](/app/sms/templates), sık gönderdiğiniz metinleri saklar: doğrulama kodları, hatırlatmalar, tebrikler. Şablon varsayılan olarak **kişiseldir**; SMS ağ geçidindeki tüm ekip arkadaşlarınızın kullanabilmesi için **Ortak** seçeneğini işaretleyin. Ortak bir şablonu yalnızca yazarı (veya SMS yöneticisi) değiştirebilir.

“Gönder” bölümünde “Şablon kullan” ile bir şablon seçin ya da az önce yazdığınız metni “Şablon olarak kaydet” ile saklayın.`,
    },
    {
      id: 'sharing',
      title: 'Telefonu paylaşma',
      body: `Telefonun sahibi “Paylaş” düğmesiyle ekip arkadaşlarına, gruplara veya rollere erişim verebilir:

- **Görüntüleme** — telefonu, mesajlarını ve sohbetlerini görme.
- **Düzenleme** — buna ek olarak telefon üzerinden SMS gönderme ve sohbetlerde yanıt verme.
- **Yönetim** — buna ek olarak ayarları ve SIM kartları değiştirme, belirteci yenileme, telefonu paylaşma ve silme.

**SMS yöneticisi** iznine sahip kullanıcılar portaldaki tüm telefonları görür ve yönetir.`,
      example: {
        title: 'Destek ekibi',
        body: 'Ofis yöneticisi destek telefonunu ekler ve “Destek” grubuna **Düzenleme** erişimi verir: nöbetçi herkes müşterileri Gelen kutusundan yanıtlar, limitleri ve belirteci ise yalnızca yönetici değiştirebilir.',
      },
    },
    {
      id: 'api',
      title: 'API ve webhook’lar',
      body: `Arayüzde yaptığınız her şey diğer sistemler için de kullanılabilir. Ayrıntılar [API](/app/sms/api) bölümünde:

- Temel adres: \`https://<portal>/api/v1/app/sms\`.
- Yetkilendirme: [Hesap → API belirteçleri](/account/api) bölümünden, SMS ağ geçidine erişimi olan kişisel bir belirteç. Belirteç salt okumayla, belirli telefonlarla ve IP adresleriyle sınırlandırılabilir.
- Hazır örnekler: SMS gönderme, durum sorgulama, gelen kutusunu okuma.

**Webhook’lar** sayesinde bir olay olduğunda portal sisteminizi kendisi çağırır: \`sms.received\`, \`sms.sent\`, \`sms.delivered\`, \`sms.failed\`, \`device.online\`, \`device.offline\`. Her çağrı imzalıdır; sisteminiz çağrının gerçekten portaldan geldiğini doğrulayabilir.`,
      example: {
        title: 'Bir betikten gönderim',
        body: '`POST /api/v1/app/sms/messages` ve gövdesi `{"to": "+905321234567", "text": "Kodunuz: 4821", "ref": "order-1001"}` — yanıt hemen, mesaj kimliği ve `queued` durumuyla gelir; teslimat bilgisi daha sonra `sms.delivered` webhook’uyla ulaşır.',
      },
    },
    {
      id: 'notifications',
      title: 'Bildirimler',
      body: `Modül iki tür bildirim gönderir:

- **Yeni SMS** — telefonu görebilen herkese; varsayılan olarak anlık (push) bildirimle.
- **Telefon çevrimdışı** — telefon, yöneticinin belirlediği süreden (varsayılan 15 dakika) uzun süre çevrimdışı kalırsa telefonu yönetenlere; tüm kanallardan.

Kanalları [Hesap → Bildirimler](/account/notifications) bölümünden değiştirebilirsiniz.`,
    },
  ],
  faq: [
    {
      q: 'Telefon açık ama “çevrimdışı” görünüyor. Neyi kontrol etmeliyim?',
      a: 'iSMS GW’de sunucu bağlantısının açık olduğundan, telefonda internet bulunduğundan ve uygulamanın pil optimizasyonu dışında bırakıldığından emin olun (Samsung’da ayrıca “Uyku modundaki uygulamalar”dan çıkarın, Xiaomi’de “Otomatik başlatma”yı açın). Telefonun “Günlük” sekmesi bağlantının ne zaman ve nasıl koptuğunu gösterir.',
    },
    {
      q: 'Bir mesaj uzun süredir “Kuyrukta”. Neden?',
      a: 'Mesajı alabilecek bir telefon yok: telefonlar çevrimdışı ya da devre dışı, veya tüm SIM kartların günlük limiti dolmuş ya da gönderimi kapalı. Bir telefon çevrimiçi olduğunda ya da limit ertesi gün sıfırlandığında mesaj gönderilir; tabii kuyruk ömrü daha önce dolmazsa.',
    },
    {
      q: 'Mesajım neden birden fazla SMS sayıldı?',
      a: 'Uzun metin parçalara bölünür: bir SMS’e 160 Latin veya 70 Unicode karakter sığar. Tek bir emoji ya da “ş”, “ğ”, “ı” gibi bir harf tüm mesajı Unicode’a geçirir. Kesin parça sayısını metnin altındaki sayaç gösterir.',
    },
    {
      q: 'Belirli bir SIM karttan gönderebilir miyim?',
      a: 'Evet; “Gönderen” alanında telefonu ve SIM kartı seçin. API’de `deviceId` ve `simId` parametrelerini iletin.',
    },
    {
      q: 'Planlanmış mesaj, o anda telefon çevrimdışıysa gider mi?',
      a: 'Planlanan saatte kuyruğa girer ve kuyruk ömrü içinde uygun bir telefon çevrimiçi olur olmaz gönderilir.',
    },
    {
      q: 'Belirteci değiştirdim, telefon artık bağlanmıyor.',
      a: 'Bu beklenen bir durum: eski belirteç anında geçersiz olur. Yenisini iSMS GW → Ayarlar → SMS sunucusu bölümüne girin ya da “Bağlantı” sekmesindeki QR kodu yeniden tarayın.',
    },
    {
      q: '“Telefon ekle” düğmesi yok. Ne yapmalıyım?',
      a: 'Yönetici telefon eklemeyi yalnızca SMS yöneticilerine açmış olabilir ya da kullanıcı başına telefon sınırına ulaşmış olabilirsiniz. Yöneticiden telefonu eklemesini ve sizinle paylaşmasını isteyin.',
    },
  ],
  related: ['api', 'notifications', 'account'],
};
