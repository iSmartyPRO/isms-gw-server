export default {
  id: 'sms',
  purpose: 'SMS ağ geçidi bu portalın ana ürünüdür: iSMS GW uygulamasını çalıştıran Android telefonları kurumsal bir SMS hizmetine dönüştürür. Çalışanlar kendi SIM kartlarından tarayıcı üzerinden SMS gönderir ve alır, entegrasyonlar aynısını API ve webhook’larla yapar; her mesaj kuyruktan teslimata kadar izlenir. Üçüncü taraf SMS sağlayıcısı gerekmez, operatör tarifesi dışında mesaj başına ücret yoktur.',
  audience: `- **Telefon sahipleri** — telefon ekler, SIM kartları ve limitleri ayarlar, erişim paylaşır.
- **Operatörler ve destek ekibi** — müşterileri Gelen kutusundan yanıtlar, toplu gönderim ve hatırlatma yapar.
- **Geliştiriciler** — CRM, web sitesi, ERP veya izleme sistemlerini API ve webhook’larla bağlar.
- **SMS yöneticileri** — destek ve denetim için portaldaki tüm telefonları ve mesajları görür.`,
  setup: [
    {
      title: 'Modülü açın',
      text: '[Ayarlar → Modüller → SMS ağ geçidi](/admin/settings/sms) bölümünde modülün etkin olduğundan emin olun. Herkesin görmesi gerekmiyorsa menü ve erişim ayarlarından yalnızca ilgili rollere açın.',
    },
    {
      title: 'Telefonları kimin ekleyeceğine karar verin',
      text: '“Kullanıcılar kendi telefonlarını ekleyebilir” açıksa herkes kendi telefonunu “Kullanıcı başına en fazla telefon” sınırına (varsayılan 20) kadar bağlar. Kapalıysa telefonları yalnızca SMS yöneticileri ekler ve ekip arkadaşlarıyla paylaşır.',
    },
    {
      title: 'Gönderim varsayılanlarını belirleyin',
      text: '**Varsayılan ülke** (varsayılan KG) yerel numaralara eklenir; yalnızca uluslararası numaraları kabul etmek için boş bırakın. **Dakikadaki mesaj sayısı** (20), kendi değeri olmayan telefonların hızıdır; operatörlerin SIM kartları engellememesi için düşük tutun.',
    },
    {
      title: 'Kuyruğu ayarlayın',
      text: '**Kuyruk ömrü** (24 sa) — mesajın çevrimdışı bir telefonu süresi dolmadan önce ne kadar bekleyeceği. **Onay zaman aşımı** (60 sn) ve **deneme sayısı** (3) — telefonun mesajı onaylaması için ne kadar bekleneceği ve kaç kez yeniden deneneceği. **En fazla alıcı** (1.000) ve **en uzun metin** (1.600 karakter) tek bir isteği sınırlar.',
    },
    {
      title: 'İzleme ve saklama',
      text: '**Çevrimdışı uyarısı** (15 dk), bir telefon bağlantıyı kaybettiğinde onu yönetenleri bilgilendirir; 0 uyarıyı kapatır. **Saklama süresi** (365 gün) daha eski mesajları otomatik siler; 0 her şeyi süresiz saklar.',
    },
    {
      title: 'İlk telefonu bağlayın',
      text: 'iSMS GW’yi sürekli şarjda ve ağda kalacak bir telefona kurun, pil optimizasyonundan hariç tutun, ardından [Telefonlar](/app/sms/devices) bölümünden ekleyip SIM kartlarına günlük limit koyun.',
    },
  ],
  roles: {
    'sms.admin': 'Sahibi kim olursa olsun portaldaki tüm telefonları, SIM kartları, mesajları ve şablonları görür ve yönetir; kullanıcıların telefon eklemesine izin verilmese bile telefon ekleyebilir. Bu izni her operatöre değil, ağ geçidinin bakımını yapanlara ve denetçilere verin.',
  },
  access: `Telefona erişimi sahibi “Paylaş” düğmesiyle bir kişi, grup, rol veya herkes için belirler:

- **Görüntüleme** — telefonun mesajları ve sohbetleri.
- **Düzenleme** — buna ek olarak telefon üzerinden gönderim ve yanıt.
- **Yönetim** — buna ek olarak ayarlar, SIM kartlar, belirteç yenileme, paylaşım ve silme.

API belirteçleri sahibinin haklarıyla çalışır ve ayrıca salt okuma, belirli telefonlar ve IP adresleriyle daraltılabilir. Webhook’lar yalnızca sahiplerinin görebildiği telefonların olaylarını iletir.`,
  scenarios: [
    {
      title: 'CRM’den müşteri bildirimleri',
      text: 'İkişer SIM kartlı iki ofis telefonu, SIM başına günde 300 limit. CRM sipariş durumlarını API üzerinden otomatik yönlendirmeyle gönderir; yük dört SIM karta dağılır, teslim raporları `sms.delivered` webhook’uyla geri gelir.',
    },
    {
      title: 'SMS ile destek hattı',
      text: 'Destek telefonu “Destek” grubuyla **Düzenleme** yetkisiyle paylaşılır: operatörler Gelen kutusundan aynı numarayla yanıt verir, ekip lideri **Yönetim** yetkisini elinde tutar ve yeni SMS geldiğinde herkes anlık bildirim alır.',
    },
    {
      title: 'İzleme uyarıları',
      text: 'İzleme sistemi, tek bir telefonla sınırlı bir belirteç üzerinden nöbetçi mühendislere alarm gönderir. Telefon çevrimdışı olursa 15 dakika sonra onu yönetenler bilgilendirilir ve izleme sistemine `device.offline` webhook’u gider.',
    },
  ],
  faq: [
    {
      q: 'Portal SMS için ücret ödüyor mu, sağlayıcıyla sözleşme gerekiyor mu?',
      a: 'Hayır. Mesajları telefonlarınızdaki SIM kartlar, operatörünüzün tarifesiyle gönderir. SMS paketi içeren bir tarife seçin ve toplu gönderim kurallarını operatörünüze danışın.',
    },
    {
      q: 'Operatör engellemesinden nasıl kaçınırız?',
      a: '“Dakikadaki mesaj sayısı”nı düşük tutun (10–20), her SIM karta günlük limit koyun, toplu gönderimleri otomatik yönlendirmeyle birden fazla SIM’e dağıtın ve yalnızca mesaj almayı kabul etmiş kişilere yazın.',
    },
    {
      q: 'Telefon çevrimdışıyken mesajlara ne olur?',
      a: 'Kuyrukta bekler ve uygun bir telefon yeniden bağlandığında gönderilir. Kuyruk ömrü dolunca “Süresi doldu” olur ve elle yeniden denenebilir. Gelen SMS’ler telefonda saklanır ve bağlantı kurulunca portala ulaşır.',
    },
    {
      q: 'Bir çalışan ayrıldı. Telefonuyla ne yapmalıyız?',
      a: 'Bir SMS yöneticisi telefonu açar ve yeni sahibine **Yönetim** yetkisi verir ya da belirteci yenileyip telefonu yeniden bağlar. Mesaj geçmişi portalda kalır.',
    },
    {
      q: 'Telefon ile portal arasındaki bağlantı güvenli mi?',
      a: 'Telefon, kendine ait bir belirteçle şifreli bir kanal üzerinden bağlanır; belirteç portalda yalnızca özet (hash) olarak saklanır ve bir kez gösterilir. Belirteç yenilendiğinde eski bağlantı anında kesilir.',
    },
    {
      q: 'Mesajlar ne kadar süre saklanır?',
      a: '“Saklama süresi”nde belirtilen kadar (varsayılan 365 gün). Daha eski mesajlar otomatik silinir; 0 her şeyi saklar. Telefon günlüğü 30 gün tutulur.',
    },
  ],
};
