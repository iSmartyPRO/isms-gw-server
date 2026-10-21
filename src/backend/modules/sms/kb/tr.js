export default {
  folder: {
    name: "SMS Ağ Geçidi — Rehberler",
    description: "iSMS Gateway için adım adım rehberler: Android telefonları bağlama, SMS gönderme ve alma, API, webhook'lar, güvenlik ve sorun giderme.",
    icon: "compass",
    color: "#F59F00",
  },
  articles: [
    {
      title: "Hızlı başlangıç: 5 dakikada ilk SMS",
      description: "Uygulamayı kurun, telefonu {{HOST}}'ya bağlayın ve ilk mesajınızı önce tarayıcıdan, sonra API üzerinden gönderin.",
      content: `Bu rehber, boş bir hesaptan teslim edilmiş ilk SMS'e kadar sizi adım adım götürür. İhtiyacınız olanlar: Android 8.0 veya üzeri, içinde aktif bir SIM kart bulunan bir telefon ve **https://{{HOST}}** üzerinde bir hesap.

## Kısaca nasıl çalışır?

Ağ geçidi operatörlerle doğrudan konuşmaz. Gönderimi, üzerinde **iSMS GW** uygulaması kurulu olan kendi Android telefonunuz yapar: telefon sunucuyla güvenli bir WebSocket bağlantısı (\`wss://{{HOST}}/ws/device\`) açık tutar, "gönder" komutlarını alır, SMS'i SIM kart üzerinden yollar ve sonucu sunucuya bildirir. Gelen SMS'ler de aynı yolu ters yönde izler. Bağlantıyı telefonun kendisi başlattığı için NAT arkasında, Wi-Fi'da ya da mobil veride sorunsuz çalışır; genel (public) bir IP adresine gerek yoktur.

## Adım 1. iSMS GW'yi kurun

1. Telefonda **https://github.com/iSmartyPRO/isms-gw-android/releases/latest** adresini açın ve APK dosyasını indirin.
2. Android sorduğunda bu kaynaktan uygulama yüklenmesine izin verin.
3. Uygulamayı açın ve karşılama ekranında **iSMS GW'yi varsayılan SMS uygulaması yapın**. Android, SMS'leri güvenilir şekilde gönderme ve okuma yetkisini yalnızca varsayılan SMS uygulamasına verir; bu yüzden bu adım zorunludur.
4. İstenen izinleri verin (SMS, telefon, bildirimler).

## Adım 2. Telefonu portala ekleyin

1. https://{{HOST}} adresinde oturum açın ve **Telefonlar → Telefon ekle**'yi seçin.
2. Telefona anlaşılır bir ad verin, örneğin \`Ofis Samsung A15\`, ve sihirbazı tamamlayın.
3. Sihirbaz size **bağlantı adresini**, \`smsgw_\` ile başlayan kişisel bir **belirteci (token)** ve ikisini birden içeren bir QR kodu gösterir (ilk satırda URL, ikinci satırda belirteç).

> **Önemli:** belirteç yalnızca bir kez gösterilir. Kaybederseniz telefonun sayfasını açıp **Yeni belirteç** düğmesine basın; eski belirteç o anda geçersiz olur.

## Adım 3. Uygulamayı bağlayın

iSMS GW'de **Ayarlar → SMS sunucusu** bölümünü açın:

| Alan | Değer |
|---|---|
| URL | \`wss://{{HOST}}/ws/device\` |
| Belirteç | Sihirbazdaki \`smsgw_…\` değeri (ya da QR kodu okutun) |
| Etkin | açık |

Birkaç saniye içinde tarayıcıdaki sihirbaz **Bağlandı** durumuna geçer ve telefondaki SIM kartları listeler. Hiçbir şey olmuyorsa telefonun internete erişebildiğini ve belirtecin eksiksiz kopyalandığını kontrol edin.

## Adım 4. Tarayıcıdan deneme SMS'i gönderin

1. **Gönder** sayfasını açın.
2. Kendi cep numaranızı girin. Türkiye'deki bir numaraya gönderiyorsanız numarayı mutlaka \`+90\` ile yazın: \`+90 532 123 45 67\`. Başında \`+\` olmayan yerel numaralar (örneğin \`0555 123 456\`) bu portalın varsayılan ülkesine, yani Kırgızistan'a (\`+996\`) göre tamamlanır.
3. Kısa bir metin yazın, SIM seçimini **Otomatik** bırakın ve **Gönder**'e basın.
4. **Mesajlar** sayfasını açın: durum birkaç saniye içinde \`queued → dispatched → accepted → sent → delivered\` sırasıyla ilerler.

## Adım 5. Aynı SMS'i koddan gönderin

**Hesap → API belirteçleri** sayfasında \`sms\` alanı **write** olan bir belirteç oluşturun ve şu isteği çalıştırın:

\`\`\`bash
curl -X POST https://{{HOST}}/api/v1/app/sms/messages \\
  -H "Authorization: Bearer pat_XXXXXXXX_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+905321234567", "text": "API uzerinden merhaba", "ref": "test-1"}'
\`\`\`

Yanıt hemen döner; mesaj \`queued\` durumundadır ve telefon onu birkaç saniye içinde gönderir.

## Sırada ne var?

- Telefonu kesintisiz çalışmaya hazırlayın: ağ geçitlerini en çok pil optimizasyonu öldürür (bkz. *Android telefonu 7/24 çalışmaya hazırlama*).
- İlk toplu gönderimden önce SIM kartlarınıza günlük limit tanımlayın.
- Sisteminizin teslimatları ve yanıtları anında öğrenmesi için bir webhook bağlayın.

> **İpucu:** ağ geçidi için ayrı bir telefon ve SMS paketi olan bir SIM kart kullanın. Cebinizde taşıdığınız, yeniden başlattığınız ve pilinin bitmesine izin verdiğiniz kişisel telefon, "ağ geçidi çalışmayı bıraktı" şikâyetlerinin en yaygın sebebidir.
`,
    },
    {
      title: "Android telefonu 7/24 çalışmaya hazırlama",
      description: "iSMS GW'nin gece gündüz çalışmasını sağlayan varsayılan SMS uygulaması, izinler, pil optimizasyonu ve üreticiye özel ayarlar.",
      content: `Ağ geçidi olarak kullanılan telefon aslında küçük bir sunucudur. Android ise cepte duran telefonların pilini korumak için tasarlanmıştır ve saatlerce arka planda çalışan bir uygulamayı hiç çekinmeden dondurur. Bu kontrol listesi, iSMS GW'nin bağlantısını günün her saatinde açık tutmasını sağlar.

## Temel ayarlar (tüm telefonlar)

1. **Android 8.0 veya üzeri.** Daha eski sürümler desteklenmez.
2. **Varsayılan SMS uygulaması.** *Ayarlar → Uygulamalar → Varsayılan uygulamalar → SMS uygulaması → iSMS GW.* Bu ayar olmadan uygulama güvenilir şekilde SMS gönderemez ve gelen mesajları göremez.
3. **İzinler.** SMS, Telefon, Bildirimler — hepsine izin verin. Android'in "kullanılmayan uygulamaların izinlerini kaldırmasına" izin vermeyin: *Uygulama bilgisi → İzinler → "Kullanılmıyorsa uygulama etkinliğini duraklat"* seçeneğini kapatın.
4. **Pil optimizasyonu kapalı.** *Ayarlar → Uygulamalar → iSMS GW → Pil → Kısıtlanmamış* (bazı telefonlarda: *Pil optimizasyonu → Tüm uygulamalar → iSMS GW → Optimize etme*).
5. **Bildirimi kapatmayın.** Uygulama, kalıcı bir bildirimle ön plan hizmeti olarak çalışır. Bu bildirimi gizlemeyin veya kaydırarak kapatmayın: birçok yazılımda bu, hizmetin önceliğini düşürür.
6. **Arka plan verisi.** Uygulamaya arka plan verisi ve sınırsız mobil veri kullanımı izni verin, Veri tasarrufu modunu kapatın.

## Samsung (One UI)

Samsung, Android'in optimizasyonuna ek olarak kendi uyku listelerini kullanır:

- *Ayarlar → Pil → Arka plan kullanım sınırları*: **Kullanılmayan uygulamaları uyku moduna al** seçeneğini kapatın ve iSMS GW'nin *Uyku moduna alınan uygulamalar* ya da *Derin uyku moduna alınan uygulamalar* listesinde **olmadığından** emin olun. Uygulamayı **Hiçbir zaman uyku moduna alınmayan uygulamalar** listesine ekleyin.
- *Ayarlar → Uygulamalar → iSMS GW → Pil → Kısıtlanmamış*.
- **Uyarlanabilir pil** ve telefonu gece yeniden başlatan **Günlük otomatik optimizasyon** (*Cihaz bakımı → Otomasyon*) seçeneklerini kapatın.

## Xiaomi, Redmi, POCO (MIUI / HyperOS)

- *Ayarlar → Uygulamalar → Uygulamaları yönet → iSMS GW → Otomatik başlatma*: **açık**.
- *Pil tasarrufu*: iSMS GW için **Kısıtlama yok**.
- *Diğer izinler*: **SMS gönder**, **Hizmet SMS'i** ve **Kilit ekranında göster** izinlerini verin. MIUI'de SMS göndermek için ayrı bir izin vardır ve varsayılan olarak reddedilmiştir.
- Son uygulamalar ekranında iSMS GW'yi aşağı çekip **kilitleyin**; böylece "Tümünü temizle" uygulamayı kapatmaz.
- Mesajlar birkaç saat sonra kesiliyorsa geliştirici seçeneklerinden *MIUI optimizasyonu*nu kapatın.

## Huawei ve Honor (EMUI / MagicOS)

- *Ayarlar → Pil → Uygulama başlatma → iSMS GW*: **Otomatik olarak yönet** seçeneğini kapatın, ardından **Otomatik başlatma**, **İkincil başlatma** ve **Arka planda çalıştır** seçeneklerini açın.
- *Güç tasarrufu modu* ve *Ultra güç tasarrufu* modunu kapatın.
- Uygulamayı son uygulamalar ekranında kilitleyin.

## Diğer üreticiler

Oppo, Realme, Vivo, OnePlus ve diğerlerinde benzer ayarlar "otomatik başlatma", "arka plan etkinliği" veya "uygulama dondurma" adlarıyla bulunur. Kural her yerde aynıdır: otomatik başlatmaya izin verin, arka plan etkinliğine izin verin, pil kısıtlaması uygulamayın. *dontkillmyapp.com* sitesinde çoğu model için adım adım talimatlar bulabilirsiniz.

## Güç ve ağ

- **Telefon şarjda kalsın.** Ağ geçidi telefonu şarj cihazında yaşar. Kaliteli bir adaptör kullanın; telefon destekliyorsa şişmeyi önlemek için şarjı %80–85'te durduran pil koruma modunu açın.
- **Kararlı ağ.** Wi-Fi tercih edilir; modem yeniden başlarsa telefonun tekrar bağlanabilmesi için mobil veriyi yedek olarak açık bırakın. Wi-Fi'ı agresif biçimde kesen "mobil veriye geç" türü özellikleri yalnızca bağlantı kopmalarına yol açıyorlarsa kapatın.
- **VPN uygulamaları ve "temizleyiciler" olmasın.** Pil hızlandırıcılar ve antivirüs temizleyiciler arka plandaki uygulamaları kapatır.
- **Güncellemeler.** Gece yapılan otomatik sistem güncellemelerini kapatın ya da planlayın: güncelleme telefonu yeniden başlatır ve uygulamanın yeniden açılması gerekir.

## SIM kart

- Hacminize uygun bir **SMS paketi** olan SIM kart kullanın; standart tarifede mesaj başına ücretlendirme kısa sürede pahalıya patlar.
- SIM kartın PIN kodunu kapatın; aksi halde yeniden başlatmadan sonra telefon PIN bekler ve hiçbir şey göndermez.
- Operatörünüzün sözleşme koşullarının toplu gönderimi engellemediğinden emin olun.

## Yedek telefon

Önemli işler için (tek kullanımlık kodlar, alarmlar) **iki telefon** bağlayın. Otomatik yönlendirme çevrim içi olan herhangi bir telefonu kullanır; biri çevrim dışı kalırsa diğeri göndermeye devam eder. Daha da sağlam bir kurulum için ikinci SIM kartı farklı bir operatörden seçin.

## Sonucu nasıl kontrol edersiniz?

1. Telefonun ekranını kilitleyin ve bir saat bekleyin.
2. Portalda **Telefonlar** sayfasını açın: telefon tüm bu süre boyunca **çevrim içi** görünmeli, günlükte tekrar eden *bağlantı kesildi / bağlandı* kayıtları olmamalıdır.
3. Ekran kapalıyken bir deneme SMS'i gönderin.

> **İpucu:** bir telefon 15 dakika çevrim dışı kaldığında portal, telefonun sahibine bildirim gönderir. Bu bildirimler geceleri geliyorsa sebep neredeyse her zaman pil ya da "uyku moduna alınan uygulamalar" ayarıdır.
`,
    },
    {
      title: "Telefonu sunucuya bağlama",
      description: "Telefon ekleme sihirbazı, bağlantı adresi ve belirteç, QR kod, bağlantı sırasında olanlar, günlük ve belirteç yenileme.",
      content: `Her telefon sunucuya kendi belirteciyle bağlanır. Bu makalede sihirbazı, perde arkasında neler olduğunu ve belirteçlerle birden fazla telefonu nasıl yöneteceğinizi anlatıyoruz.

## Telefon ekleme sihirbazı

**Telefonlar → Telefon ekle** sayfasını açın:

1. **Ad ve renk.** Telefonun nerede durduğunu anlatan bir ad seçin: \`İstanbul ofis · Samsung\`, \`Depo · Redmi\`. Renk, telefonu listelerde ve grafiklerde kolayca ayırt etmenizi sağlar.
2. **Gönderim hızı (isteğe bağlı).** Bir telefon varsayılan olarak **dakikada en fazla 20 mesaj** gönderir. 1 ile 120 arasında kendi değerinizi belirleyebilirsiniz.
3. **Bağlantı bilgileri.** Sihirbaz şunları gösterir:
   - \`wss://{{HOST}}/ws/device\` adresi;
   - yalnızca bu telefona ait \`smsgw_…\` belirteci;
   - ilk satırda URL'yi, ikinci satırda belirteci içeren bir **QR kod**.
4. **Telefonun beklenmesi.** Sayfa canlı olarak bekler; telefon bağlanır bağlanmaz yeşile döner ve SIM kartları gösterir.

## Uygulamadaki ayarlar

iSMS GW'de **Ayarlar → SMS sunucusu** bölümüne gidin, QR kodu okutun ya da URL'yi ve belirteci yapıştırın, ardından bağlantıyı **açın**. Uygulamadaki durum *Bağlandı* olarak değişir.

> **Not:** belirteç yalnızca bir kez gösterilir ve sunucuda sadece özeti (hash) saklanır. Doğrudan uygulamaya ya da bir parola yöneticisine kopyalayın; sohbet uygulamalarında paylaşmayın.

## Bağlantı sırasında neler olur?

1. Telefon, \`Authorization\` başlığında belirteçle birlikte kendi kimliğini, adını ve uygulama sürümünü göndererek \`/ws/device\` adresine bir WebSocket açar.
2. Sunucu belirteci doğrular ve telefonu **çevrim içi** olarak işaretler.
3. Telefon, SIM kartlarının bilgilerini içeren bir \`hello\` mesajı gönderir: yuva, operatör, numara (SIM bildiriyorsa) ve ülke.
4. Telefon, sunucunun henüz onaylamadığı gelen SMS'leri yeniden gönderir; böylece çevrim dışıyken gelen hiçbir mesaj kaybolmaz.
5. Sunucu, kuyrukta bekleyen her şeyi telefonun hızına uygun şekilde telefona iletir.

Telefon sunucuya her 25 saniyede bir ping gönderir. Bağlantı koparsa, giderek artan aralıklarla (2 saniyeden 1 dakikaya kadar) otomatik olarak yeniden bağlanır.

## Telefon sayfası

Bir telefonla ilgili her şey kendi sayfasındadır:

| Bölüm | Neler görür, neler yaparsınız |
|---|---|
| Durum | Çevrim içi / dışı, son görülme, IP adresi, uygulama sürümü, cihaz modeli |
| SIM kartlar | Etiket, renk, gönderim açık/kapalı, günlük limit, bugün gönderilen |
| Ayarlar | Ad, renk, dakika başına hız, etkin / devre dışı |
| Belirteç | **Yeni belirteç** |
| Günlük | Bağlanmalar, bağlantı kopmaları, belirteç değişiklikleri, hatalar (30 gün saklanır) |
| Erişim | Bu telefonu başka kimlerin görüntüleyebildiği, kullanarak gönderebildiği veya yönetebildiği |

**Devre dışı** bırakılan bir telefon hiç bağlanamaz. Telefona dokunmadan onu uzaktan durdurmak istediğinizde bu çok işe yarar.

## Günlük

Bir sorun olduğunda ilk bakılacak yer günlüktür:

- saatte çok sayıda *bağlandı / bağlantı kesildi* çifti — kararsız ağ veya pil optimizasyonu;
- *reddedilen belirteç* — yeni belirteç oluşturduktan sonra uygulamada eskisi kalmış;
- uzun bir boşluk — telefon kapalıydı, internetsizdi ya da sistem tarafından dondurulmuştu.

## Belirteci yenileme

Şu durumlarda telefon sayfasında **Yeni belirteç** düğmesine basın:

- belirteç sızmış olabilir (görüntülü görüşmede ekranda göründü, bir sohbette paylaşıldı);
- telefon kayboldu ya da başka birine verildi;
- ağ geçidini başka bir telefona taşıyorsunuz.

Eski belirteç anında geçersiz olur ve bağlı telefonun **bağlantısı kesilir**. Telefonu geri getirmek için yeni belirteci uygulamaya girin. Kuyrukta bekleyen mesajlar kaybolmaz; telefon yeniden bağlanır bağlanmaz yola çıkarlar (kuyruk süresi içinde; varsayılan 24 saat).

## Birden fazla telefon

Tek bir hesaba çok sayıda telefon ekleyebilirsiniz (varsayılan olarak kişi başına 20'ye kadar). Tipik kurulumlar:

- **Yedeklilik:** farklı operatörlere bağlı iki telefon; otomatik yönlendirme hangisi çevrim içiyse onu kullanır.
- **Kapasite:** her biri kendi hızına ve SIM limitlerine sahip birkaç telefon büyük bir gönderimi paylaşır.
- **Şubeler:** her şehir veya departman için bir telefon, her biri kendi ekibiyle paylaşılır.

Her telefonun kendi belirteci olmalıdır. Aynı belirteci asla iki telefona girmeyin: telefonlar birbirlerini sürekli bağlantıdan düşürür.

## Uygulamayı güncelleme

Yeni APK'yı eskisinin üzerine kurun; ayarlar ve belirteç korunur. Güncellemeden sonra Android'in hizmeti yeniden başlatması için uygulamayı bir kez açın ve portalda telefonun çevrim içi olduğunu kontrol edin.
`,
    },
    {
      title: "SIM kartlar, limitler ve yönlendirme",
      description: "SIM kartları etiketleme, günlük limit belirleme, gönderimi kapatma ve otomatik yönlendirmenin telefon ve SIM seçme mantığı.",
      content: `Bir telefonda bir veya iki SIM kart ya da eSIM profili olabilir. Sunucu bunların her birini tanır ve hangisinin ne kadar, hangi sırayla göndereceğine sizin karar vermenizi sağlar.

## Sunucudaki SIM ayarları

Telefon sayfasında her SIM kartın kendi kartı vardır:

| Ayar | Ne işe yarar |
|---|---|
| **Etiket** | SIM'e verdiğiniz ad: \`Turkcell kurumsal\`, \`Vodafone pazarlama\`. Her yerde yuva numarası yerine gösterilir |
| **Renk** | Listelerde, sohbetlerde ve grafiklerde renk etiketi |
| **Gönderim** | Açık / kapalı. Gönderimi kapalı bir SIM yine SMS **alır**, ancak giden mesajlar için hiç kullanılmaz |
| **Günlük limit** | Bu SIM'in günde kaç mesaj gönderebileceği. \`0\` limitsiz demektir |

Operatör, numara ve ülke bilgisi telefondan gelir. SIM kendi numarasını bildirmiyorsa (çoğu bildirmez), yanıtların hangi numaraya geleceğini iş arkadaşlarınız bilsin diye numarayı etikete ekleyin.

> **Not:** SIM kart **yuvaya** göre seçilir. Kartların yuvalarını değiştirirseniz etiketleri ve limitleri yeniden kontrol edin.

## Günlük limitler: neden ve ne kadar?

Operatörler olağandışı etkinliği yakından izler. Yeni bir SIM'in birden 2.000 aynı mesaj göndermesi spam gibi görünür ve birkaç saat içinde engellenebilir. Günlük limitler sizi buna karşı, ayrıca döngüye girip durmadan gönderen hatalı entegrasyonlara karşı korur.

Makul başlangıç değerleri:

| SIM | Günlük limit |
|---|---|
| Yeni SIM, ilk hafta | 50–100 |
| Aylardır kullanılan bireysel tarife | 200–300 |
| SMS paketli kurumsal tarife | pakete göre, ör. 500–1000 |

Limitleri kademeli olarak artırın. Sayaç her gün sıfırlanır; telefon sayfasında bugün kaç mesaj gönderildiğini görebilirsiniz.

Telefondaki uygulamanın da SIM başına kendi limitleri ve bir hedef filtresi olabilir. Telefon bu ayarlar nedeniyle bir mesajı reddederse mesaj \`PHONE_REJECTED\` hatasıyla başarısız olur — bkz. *Sorun giderme*.

## Telefon başına gönderim hızı

Günlük limitlerden ayrı olarak her telefonun bir **dakika başına hızı** vardır: varsayılan 20 (1–120). Sunucu mesajları telefona bundan daha hızlı vermez. Dolayısıyla tek bir telefondan dakikada 20 hızla gönderilen 300 mesajlık bir toplu gönderim yaklaşık 15 dakika sürer. Bu bilinçli bir tercihtir: düzenli bir akış, ani bir patlamaya göre operatörün spam filtresine takılma ihtimalini çok daha düşük tutar.

## Otomatik yönlendirme

Telefon veya SIM seçmeden gönderdiğinizde (arayüzde **Otomatik**, API'de \`deviceId\` veya \`simId\` olmadan) rotayı sunucu belirler:

1. Kullanarak gönderebileceğiniz telefonları alır (kendi telefonlarınız ve sizinle **gönderme (edit)** veya daha yüksek düzeyde paylaşılanlar).
2. Etkin telefonları ve gönderimi açık, günlük limitinde yer kalmış SIM'leri ayırır.
3. **Çevrim içi** telefonları tercih eder.
4. Bugünkü limitinde **en çok yer kalan** SIM'i seçer.

Toplu gönderimde mesajlar, her SIM'de kalan yere göre dağıtılır; limitleri 300 ve 100 olan iki SIM yükü kabaca 3'e 1 oranında paylaşır.

Limitler tüm gönderimi karşılamaya yetmiyorsa istek, hiçbir mesaj kuyruğa alınmadan \`LIMIT_REACHED\` hatasıyla reddedilir. Böylece yarıda kalmış bir kampanyayla sürpriz şekilde karşılaşmazsınız.

## Rotayı açıkça seçme

- **Telefon:** \`deviceId\` (veya arayüzde telefonu seçin) — sunucu o telefondaki en uygun SIM'i seçer.
- **SIM:** \`GET /devices\` yanıtındaki \`simId\` — tam olarak o kart kullanılır. Yanıtların belirli bir numaraya gelmesi gerektiğinde ya da bir tarife daha ucuz olduğunda kullanışlıdır.

\`\`\`json
{ "to": "+905321234567", "text": "Siparisiniz hazir", "simId": 7 }
\`\`\`

O SIM'in gönderimi kapalıysa \`SIM_DISABLED\`, limiti dolmuşsa \`SIM_LIMIT\` hatası alırsınız.

## Telefon çevrim dışıyken ne olur?

Çevrim dışı bir telefona yönlendirilen mesajlar kuyrukta bekler. Telefon geri geldiğinde normal hızında gönderilirler. Telefon **kuyruk süresi (varsayılan 24 saat)** içinde geri gelmezse mesajlar \`expired\` durumuna geçer. Zamana duyarlı mesajlar için ikinci bir telefon bağlayın; otomatik yönlendirme çevrim içi olanı tercih eder.

## Pratik kurulumlar

- **Pazarlama ve servis mesajları farklı SIM'lerde.** Bültenleri limiti mütevazı bir SIM'e, kodları ve bildirimleri başka bir SIM'e verin. Pazarlama SIM'i engellenirse önemli mesajlar akmaya devam eder.
- **Yanıtlar için tek numara.** Müşterinin yanıt vermesini beklediğiniz mesajlarda belirli bir \`simId\` seçin.
- **Gece molası.** Bir SIM'i hiçbir şey silmeden duraklatmak için **Gönderim**'i kapatın; kuyruktaki mesajlar başka bir SIM'i ya da bu SIM'in geri açılmasını bekler.
`,
    },
    {
      title: "SMS gönderme: tekli, toplu, şablonlar, zamanlama",
      description: "Gönder sayfasıyla ilgili her şey: alıcılar, CSV listeleri, şablonlar, zamanlanmış gönderim, iptal, yeniden deneme ve teslimat takibi.",
      content: `**Gönder** sayfası tek bir deneme mesajından bin alıcılı bir kampanyaya kadar her şeyi kapsar.

## Alıcılar

Numaraları alıcı alanına virgül, noktalı virgül ya da yeni satırla ayırarak yapıştırın:

\`\`\`
+905321234567
0700 112 233
+7 701 555 44 33
\`\`\`

- Yerel numaralar (\`+\` olmadan) portalın varsayılan ülkesine göre tamamlanır; bu portalda varsayılan ülke **KG**'dir. Türkiye numaralarını bu yüzden \`+90\` ile yazın.
- Tekrarlanan numaralar otomatik olarak kaldırılır; sıralama korunur.
- Anlaşılamayan numaralar geçersiz olarak gösterilir ve gönderilmez.
- Tek gönderimde en fazla **1000 alıcı**.

## CSV veya Excel'den içe aktarma

Ayrı bir içe aktarma adımı yoktur: dosyayı açın, telefon numaralarının bulunduğu sütunu kopyalayın ve alana yapıştırın. Her satır bir alıcı olur. 1000'den uzun listeleri birkaç gönderime bölün ya da daha iyisi, döngü ve bekleme süresiyle API'yi kullanın.

## Metin ve parça sayacı

Metnin altında kodlamayı (GSM-7 veya UCS-2), karakter sayısını ve **parça** sayısını görürsünüz. Tek bir SMS'e 160 Latin karakteri ya da 70 Kiril karakteri sığar; daha uzun metinler bölünür. Türkçedeki ğ, ş, ı, İ ve ç harfleri de mesajı 70 karakterlik UCS-2'ye geçirir. Her parça bir SMS olarak ücretlendirilir. Metnin azami uzunluğu 1600 karakterdir. Ayrıntılar için *SMS uzunluğu, kodlamalar ve parçalar* makalesine bakın.

## Şablonlar

**Şablonlar** sık gönderdiğiniz metinleri saklar: "Kodunuz", "Siparişiniz hazır", "Hatırlatma: yarın randevunuz var".

- Bir şablon **kişisel** olabilir ya da portaldaki herkesle **paylaşılabilir**.
- Gönder sayfasında bir şablon seçin ve göndermeden önce metni düzenleyin.
- Parça sayısını kontrol altında tutmak için şablonları kısa ve tek bir kodlamada tutun.

## Rota seçimi

Sunucunun bugün en çok yeri kalan telefonu ve SIM'i seçmesi için **Otomatik**'i bırakın ya da belirli bir telefon veya SIM seçin. Otomatik yönlendirme toplu gönderimi SIM'lere dağıtır. Bkz. *SIM kartlar, limitler ve yönlendirme*.

## Zamanlama

**Daha sonra gönder** seçeneğini açın ve bir tarih ile saat seçin (en fazla 90 gün sonrası). Mesajlar \`scheduled\` durumunu alır ve bekler. Belirlenen saatte \`queued\` durumuna geçer ve telefona gider. Kuyruk süresi (24 saat) oluşturulma anından değil, zamanlanan andan itibaren sayılır.

> **İpucu:** tanıtım mesajlarını alıcının yerel saatiyle gündüze, örneğin 10:00–19:00 arasına zamanlayın. Gece gelen mesajlar insanları rahatsız eder ve operatöre şikâyetle sonuçlanır.

## Teslimatı takip etme

Her mesaj şu durumlardan geçer:

| Durum | Anlamı |
|---|---|
| \`scheduled\` | Zamanlanan saati bekliyor |
| \`queued\` | Kuyrukta, telefonu bekliyor |
| \`dispatched\` | Telefona iletildi, onay bekleniyor |
| \`accepted\` | Telefon mesajı aldığını onayladı |
| \`sent\` | SIM mesajı operatöre gönderdi |
| \`delivered\` | Operatör, mesajın alıcının cihazına teslim edildiğini bildirdi |
| \`failed\` | Gönderilemedi; hata koduna bakın |
| \`cancelled\` | Yola çıkmadan önce bir kullanıcı tarafından iptal edildi |
| \`expired\` | Telefon kuyruk süresinden daha uzun süre çevrim dışı kaldı |

Her operatör teslim raporu döndürmez. Sizinki döndürmüyorsa göreceğiniz son durum \`sent\` olur.

## Mesajlar sayfası

**Mesajlar**, filtrelerle birlikte tüm geçmişi gösterir: yön, durum (veya *bekleyen*, *tamamlanan*, *sorunlu* grupları), telefon, SIM, numara, metin, kendi referansınız, toplu gönderim ve tarih aralığı. Buradan şunları yapabilirsiniz:

- hâlâ \`scheduled\` veya \`queued\` durumundaki bir mesajı **iptal etmek**;
- başarısız olan ya da süresi dolan bir mesajı **yeniden denemek**;
- raporlama veya mutabakat için aynı filtrelerle **CSV'ye aktarmak** (en fazla 50.000 satır).

Her toplu gönderimin bir **toplu gönderim kimliği (batch ID)** vardır; tek bir kampanyanın ilerleyişini görmek için buna göre filtreleyin.

## Gelen kutusu

Yanıtlar **Gelen kutusu**'na düşer; numara ve telefon bazında sohbetlere gruplanır ve okunmamış mesaj sayacıyla gösterilir. Doğrudan sohbetin içinden yanıt verebilirsiniz; yanıt aynı telefondan gider, böylece müşteri aynı numarayı görür.

## Kampanya öncesi kontrol listesi

1. Listeyi kontrol edin: geçerli numaralar, tekrar yok, yalnızca mesaj almayı kabul etmiş kişiler.
2. Metni kontrol edin: mesaj başına parça sayısı, gönderen adı, listeden çıkma ifadesi.
3. SIM limitlerinin toplu gönderimi karşıladığından emin olun.
4. Gönderimi gündüz saatlerine zamanlayın.
5. Gönderimden sonra toplu gönderime göre filtreleyin ve *sorunlu* grubuna bakın.
`,
    },
    {
      title: "SMS uzunluğu, kodlamalar ve parçalar",
      description: "Tek bir harf neden mesajın maliyetini katlayabilir: GSM-7 ve UCS-2, genişletme karakterleri, emojiler ve parçaların nasıl sayıldığı.",
      content: `Bir SMS'in maliyeti mesaj sayısıyla değil, **parça** (segment) sayısıyla hesaplanır. Bir metnin kaç parça tutacağı içindeki karakterlere bağlıdır. Bunu anlamak, toplu gönderimlerde gerçek para tasarrufu sağlar — Türkçe metinlerde ise özellikle.

## İki kodlama

| Kodlama | Ne zaman kullanılır | Tek SMS | Uzun SMS'in her parçası |
|---|---|---|---|
| **GSM-7** | Tüm karakterler GSM alfabesinde (Latin harfleri, rakamlar, yaygın noktalama işaretleri) | 160 karakter | 153 karakter |
| **UCS-2** | En az bir karakter GSM alfabesinin dışında (Kiril, Türkçe ğ ş ı İ ç, Çince, emoji…) | 70 karakter | 67 karakter |

Uzun bir metin parçalara bölünür ve alıcının telefonu parçaları birleştirebilsin diye her parçaya küçük bir başlık eklenir. Parça başına sınırın daha düşük olmasının (160 yerine 153, 70 yerine 67) nedeni budur.

## Örnekler

| Metin | Kodlama | Uzunluk | Parça |
|---|---|---|---|
| 150 Latin karakteri | GSM-7 | 150 | 1 |
| 200 Latin karakteri | GSM-7 | 200 | 2 |
| 70 Kiril karakteri | UCS-2 | 70 | 1 |
| 71 Kiril karakteri | UCS-2 | 71 | 2 |
| 140 Latin karakteri + bir "ş" | UCS-2 | 141 | 3 |

Son satır asıl tuzaktır: GSM alfabesinde olmayan tek bir karakter **tüm** mesajı UCS-2'ye geçirir ve fiyatı üç katına çıkarabilir.

## Türkçe metinler: hangi harf neyi değiştirir?

Türkçe yazan herkes için en önemli kural şudur:

- **ğ, Ğ, ş, Ş, ı, İ, ç** temel GSM alfabesinde **yoktur**. Metinde bunlardan yalnızca biri bile geçse mesajın tamamı UCS-2'ye geçer: tek SMS'e 160 yerine **70** karakter sığar, uzun mesajlarda parça başına 153 yerine **67** karakter kalır.
- **ö, Ö, ü, Ü ve Ç** ise GSM-7 alfabesindedir; tek başlarına kodlamayı değiştirmezler.

Yani "Ürün gönderildi" GSM-7'de kalırken, "Siparişiniz hazır" UCS-2'dir. Gerçek hayatta Türkçe bir cümlede ş, ı veya ğ'den kaçmak neredeyse imkânsız olduğundan, düzgün Türkçeyle yazılmış metinlerin çoğu 70/67 karakter sınırıyla hesaplanmalıdır.

## Genişletme karakterleri çift sayılır

GSM alfabesinin bir genişletme tablosu vardır. Aşağıdaki karakterler GSM-7'de kullanılabilir ama her biri **iki** karakterlik yer kaplar:

\`\`\`
^ { } \\ [ ] ~ | €
\`\`\`

On tane \`€\` işareti içeren bir mesaj, kapasitesinden on karakter kaybeder. Şablonlardaki \`[kod]\` gibi köşeli parantezleri düz kelimelerle ya da normal karakter olan \`( )\` parantezleriyle değiştirmek daha iyidir.

## UCS-2'ye geçiren diğer karakterler

- **Kiril** — Kırgızca ө, ү, ң dahil her türlü Rusça veya Kırgızca metin.
- **Tipografik tırnak ve tireler:** “ ” ‘ ’ « » — … — metin Word'den veya bir web sitesinden kopyalandığında sık sık araya sızarlar.
- **Emojiler.** Her emoji mesajı UCS-2'ye geçirir ve çoğu **iki** birim kaplar; yani 😀 iki karakter sayılır.

Gönder sayfasındaki parça sayacı ve \`POST /api/v1/app/sms/tools/segments\` uç noktası, göndermeden önce kodlamayı ve parça sayısını gösterir:

\`\`\`json
{ "success": true, "segments": { "encoding": "UCS-2", "length": 82, "parts": 2, "perPart": 67, "remaining": 52 } }
\`\`\`

\`remaining\`, yeni bir parça oluşturmadan kaç karakter daha ekleyebileceğinizi söyler.

## Parça tasarrufu nasıl yapılır?

1. **Tipografik karakterleri düz olanlarla değiştirin:** \`« »\` yerine \`"\`, \`—\` yerine \`-\`, \`…\` yerine \`...\`.
2. **Toplu mesajlarda emoji kullanmayın.** Nadiren değer katarlar ama her zaman maliyet çıkarırlar.
3. **Türkçe karakterlerden kaçınmak bir ödünleşimdir.** \`Siparişiniz hazır\` yerine \`Siparisiniz hazir\` yazmak mesajı GSM-7'de tutar ve 2 parçalık bir mesajı 1 parçaya indirebilir. Öte yandan Türkçe karakter kullanılmayan metin, okuyana özensiz ve hatta güvenilmez gelebilir. Kodlar ve teknik bildirimler gibi kısa, işlevsel mesajlarda bu tasarruf mantıklı olabilir; marka imajının önemli olduğu kampanyalarda ise doğru Türkçeyle yazıp parça sayısını metni kısaltarak düşürmek genellikle daha iyidir.
4. **Bağlantıları kısaltın.** Parametreli uzun bir URL tek başına bir parça tutabilir.
5. **Selamlamaları ve tekrarları atın.** "Değerli müşterimiz, size bildirmekten mutluluk duyarız ki…" UCS-2'de tek başına bir parça eder.
6. **Sınıra dikkat edin.** 72 karakterlik bir UCS-2 metin 2 parçadır; iki karakter kısaltmak maliyeti yarıya indirir.

## Kampanya maliyeti

Alıcı sayısını parça sayısıyla çarpın. 1.000 alıcı × 3 parça = paketinizden ve günlük SIM limitlerinizden düşülecek 3.000 SMS. Planlarken limitleri parça olarak hesaplayın: 3 parçalı bir mesaj operatör için de üç SMS'tir ve uzun mesajlardan oluşan bir patlama, spam kurallarını tetiklemeye daha yatkındır.

> **İpucu:** ağ geçidi metninizi değiştirmez. Mesajın GSM-7'de gitmesini istiyorsanız metni göndermeden önce kendi sisteminizde buna göre hazırlayın.

## Alıcı tarafında uzun mesajlar

Modern telefonlar çok parçalı bir SMS'i tek mesaj olarak gösterir. Bazı eski telefonlar veya tuşlu telefonlar parçaları ayrı ayrı ya da karışık sırada gösterebilir; önemli mesajları tek parçada tutmak için bir sebep daha.
`,
    },
    {
      title: "Telefon numarası biçimleri: E.164, varsayılan ülke, kısa numaralar",
      description: "Ağ geçidinin telefon numaralarını nasıl okuduğu, sistemlerinizde hangi biçimi saklamanız gerektiği ve en sık geçersiz alıcıya yol açan hatalar.",
      content: `Her numara, gönderilmeden önce uluslararası **E.164** biçimine dönüştürülür: bir \`+\`, ülke kodu ve ulusal numara; boşluk veya noktalama işareti olmadan — örneğin \`+905321234567\`. Bu makalede dönüşümün nasıl çalıştığını ve sürprizlerden nasıl kaçınacağınızı anlatıyoruz.

## E.164 biçimi

| Bölüm | Örnek |
|---|---|
| \`+\` | her zaman bulunur |
| Ülke kodu | \`90\` (Türkiye), \`996\` (Kırgızistan), \`7\` (Kazakistan, Rusya), \`998\` (Özbekistan) |
| Ulusal numara | baştaki \`0\` veya \`8\` alan öneki olmadan |

E.164 belirsizlik bırakmaz: bu şekilde yazılmış bir numara her yerde aynı anlama gelir. **CRM'inizde, e-ticaret sitenizde veya veritabanınızda numaraları E.164 olarak saklayın**; böylece varsayılan ülkeye asla bağımlı kalmazsınız.

## Ağ geçidinin kabul ettiği biçimler

- \`+905321234567\`, \`+90 532 123 45 67\`, \`+90 (532) 123-45-67\` — boşluklar, parantezler, noktalar ve tireler kaldırılır.
- \`00905321234567\` — \`00\` öneki \`+\` olarak okunur.
- \`05321234567\` — **yerel** numara: varsayılan ülkeye göre tamamlanır.
- \`555123\` — 3–6 haneli **kısa numara** olduğu gibi gönderilir (operatör servisleri, bankalar).

## Varsayılan ülke

\`+\` veya \`00\` olmadan yazılan numaralar **varsayılan ülkenin** yerel numaraları olarak kabul edilir. Bu portalda varsayılan ülke **KG**'dir (Kırgızistan); yani \`0555 123 456\`, \`+996555123456\` olur.

> **Önemli:** Türkiye'ye gönderiyorsanız ya numaraları tam olarak \`+90\` ile yazın ya da her istekte \`country: "TR"\` belirtin. Aksi halde \`0532 123 45 67\` gibi bir numara Kırgızistan numarası olarak yorumlanır ve yanlış numaraya dönüşür ya da geçersiz sayılır.

API'de varsayılan ülkeyi istek başına \`country\` alanıyla değiştirebilirsiniz:

\`\`\`json
{ "to": ["0532 123 45 67", "0505 987 65 43"], "text": "...", "country": "TR" }
\`\`\`

## Ülkelere göre örnekler

| Ülke | Yerel yazım | E.164 |
|---|---|---|
| **Türkiye (TR)** | \`0532 123 45 67\` | \`+905321234567\` |
| Kırgızistan (KG) | \`0555 12 34 56\`, \`0700 112233\` | \`+996555123456\`, \`+996700112233\` |
| Kazakistan (KZ) | \`8 701 555 44 33\` | \`+77015554433\` |
| Rusya (RU) | \`8 (916) 123-45-67\` | \`+79161234567\` |
| Özbekistan (UZ) | \`90 123 45 67\` | \`+998901234567\` |

> **Not:** Kazakistan ve Rusya aynı ülke kodunu (\`+7\`) paylaşır. KZ ülkesiyle \`8 701…\` ve RU ülkesiyle \`8 916…\` doğru dönüştürülür; ancak bir liste iki ülkeyi karışık içeriyorsa her zaman tam \`+7…\` biçimini tercih edin.

## Göndermeden önce listeyi kontrol etme

\`POST /api/v1/app/sms/tools/numbers\` numaraları hiçbir şey göndermeden kontrol eder:

\`\`\`bash
curl -X POST https://{{HOST}}/api/v1/app/sms/tools/numbers \\
  -H "Authorization: Bearer $SMS_TOKEN" -H "Content-Type: application/json" \\
  -d '{"to": "0555123456, +905321234567, 12", "country": "KG"}'
\`\`\`

\`\`\`json
{ "success": true, "valid": ["+996555123456", "+905321234567"], "invalid": [{ "input": "12", "reason": "FORMAT" }], "truncated": false }
\`\`\`

Geçersiz numara nedenleri:

| Neden | Anlamı |
|---|---|
| \`EMPTY\` | Boş satır |
| \`FORMAT\` | Numara değil: harf içeriyor, çok kısa veya çok uzun |
| \`COUNTRY\` | Yerel numara, ancak varsayılan ülke belirlenmemiş |
| \`INVALID\` | O ülke için olası bir numara değil (yanlış uzunluk veya önek) |

Gönderim sırasında geçersiz numaralar \`invalid\` alanında döner, geçerli olanlar yine kuyruğa alınır. Hiçbiri geçerli değilse istek \`NO_RECIPIENTS\` hatasıyla başarısız olur.

## Sık yapılan hatalar

1. **Ülke kodundan sonra baştaki sıfır:** \`+9005321234567\` yanlıştır. \`0\`'ı atın: \`+905321234567\`.
2. **Ülke belirtmeden yerel Türkiye numarası:** \`05321234567\` varsayılan KG ülkesiyle Kırgızistan numarası gibi yorumlanır. \`+90\` kullanın ya da \`country: "TR"\` belirtin. Aynı durum Rusya için de geçerlidir: KG ülkesiyle \`89161234567\` yanlış bir Kırgızistan numarasına dönüşür; \`+7\` kullanın veya \`country: "RU"\` belirtin.
3. **Excel'de sayı olarak saklanan numaralar.** Excel baştaki \`+\` ve \`0\`'ı siler ya da \`9.05321E+11\` gibi gösterir. Yapıştırmadan önce sütunu metin olarak biçimlendirin.
4. **Tek hücrede iki numara:** \`05321234567 / 05059876543\` — ayırın.
5. **Sabit hatlar.** Sabit hat numaralarının çoğu SMS alamaz; operatör başarısızlık bildirir.
6. **Yanlışlıkla yabancı numaralar.** Kısa uluslararası numaralar ücretli (premium) olabilir. Uygulamadaki hedef filtresi beklenmedik ülkeleri engellemeye yardımcı olur.

## Kısa numaralar

3 ile 6 hane arasındaki numaralar değiştirilmeden iletilir. Bunları operatör servisleriyle (bakiye, paketler) veya bankaların kısa numaralarıyla yazışmak için kullanın. Kısa numaraların yalnızca SIM'in kendi şebekesi ve ülkesi içinde çalıştığını, bazılarının da mesaj başına ücret aldığını unutmayın.

## Tekrarlar

Farklı şekillerde yazılmış aynı numara (örneğin \`country: "TR"\` ile gönderilen \`05321234567\` ve \`+90 532 123 45 67\`) tek alıcı olarak tanınır ve bir gönderimde yalnızca bir mesaj alır.
`,
    },
    {
      title: "REST API: belirteçler, ilk istek ve kod örnekleri",
      description: "Bir belirteç oluşturun ve kendi kodunuzdan SMS gönderin, takip edin ve alın; cURL, Python, Node.js ve PHP örnekleriyle.",
      content: `Arayüzde yapabildiğiniz her şey REST API üzerinden de yapılabilir. Entegrasyonların genellikle dört şeye ihtiyacı vardır: mesaj göndermek, durumunu kontrol etmek, yanıtları okumak ve hataları işlemek.

## Temel URL ve kimlik doğrulama

- **Temel URL:** \`https://{{HOST}}/api/v1/app/sms\`
- **Başlık:** \`Authorization: Bearer pat_…\`
- **Biçim:** UTF-8 kodlamalı JSON.

## Belirteç oluşturma

1. **Hesap → API belirteçleri** (\`/account/api\`) sayfasını açın. Bunun için \`api.tokens\` iznine sahip olmanız gerekir; sayfa görünmüyorsa bir yöneticiye başvurun.
2. **Yeni belirteç**'e basın, bir ad verin (\`Mağaza bildirimleri\`) ve **sms** alanını **write** olarak ayarlayın (raporlama araçları için **read**).
3. İsteğe bağlı ama önerilir: belirteci belirli telefonlarla sınırlayın, bir IP izin listesi ve son kullanma tarihi ekleyin.
4. Belirteci kopyalayın — yalnızca bir kez gösterilir.

Yöneticiler tüm belirteçleri **Yönetim → API** (\`/admin/api\`) sayfasından yönetir. Canlı "Dene" konsolu içeren tam başvuru belgesi **/developers** adresindedir.

> **İpucu:** her istek belirtecin sahibi adına çalışır ve tam olarak o kişinin görebildiği telefonları görür. Entegrasyonlar için ayrı bir teknik hesap oluşturun ve ona yalnızca ihtiyaç duyduğu telefonlara erişim verin.

## En sık kullanacağınız uç noktalar

| Yöntem | Yol | Ne yapar |
|---|---|---|
| \`GET\` | \`/devices\` | Bugünkü sayaçlarıyla telefonlar ve SIM'ler |
| \`POST\` | \`/messages\` | Bir veya birden çok SMS gönderir |
| \`GET\` | \`/messages/:id\` | Bir mesaj ve durumu (id veya uuid) |
| \`GET\` | \`/messages\` | Geçmiş; gelenler için \`direction=in\` |
| \`POST\` | \`/messages/:id/cancel\` | Kuyruktaki mesajı iptal eder |
| \`POST\` | \`/messages/:id/retry\` | Yeniden gönderir |
| \`POST\` | \`/messages/read\` | Gelen mesajları okundu olarak işaretler |
| \`POST\` | \`/tools/segments\` | SMS parçalarını sayar |
| \`POST\` | \`/tools/numbers\` | Numaraları doğrular |

## Gönderme

Gövde alanları: \`to\` (metin veya dizi, **zorunlu**), \`text\` (**zorunlu**), \`deviceId\`, \`simId\`, \`sendAt\` (ISO 8601, en fazla 90 gün sonrası), \`ref\` (kendi kimliğiniz, en fazla 64 karakter), \`country\`.

### cURL

\`\`\`bash
curl -X POST https://{{HOST}}/api/v1/app/sms/messages \\
  -H "Authorization: Bearer $SMS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to": ["+905321234567", "+996700112233"], "text": "1001 numarali siparisiniz hazir", "ref": "order-1001"}'
\`\`\`

### Python

\`\`\`python
import os, requests

API = "https://{{HOST}}/api/v1/app/sms"
HEADERS = {"Authorization": f"Bearer {os.environ['SMS_TOKEN']}"}

r = requests.post(f"{API}/messages", headers=HEADERS, timeout=15, json={
    "to": "+905321234567",
    "text": "Kodunuz: 4821",
    "ref": "otp-77812",
})
r.raise_for_status()
msg = r.json()["messages"][0]
print(msg["id"], msg["status"])
\`\`\`

### Node.js (18+)

\`\`\`js
const API = 'https://{{HOST}}/api/v1/app/sms';
const headers = { Authorization: \`Bearer \${process.env.SMS_TOKEN}\`, 'Content-Type': 'application/json' };

const res = await fetch(\`\${API}/messages\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ to: '+905321234567', text: 'Kodunuz: 4821', ref: 'otp-77812' }),
});
const data = await res.json();
if (!data.success) throw new Error(\`\${data.code}: \${data.error}\`);
console.log(data.messages[0].id);
\`\`\`

### PHP

\`\`\`php
<?php
$ch = curl_init('https://{{HOST}}/api/v1/app/sms/messages');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . getenv('SMS_TOKEN'),
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode(['to' => '+905321234567', 'text' => 'Kodunuz: 4821']),
]);
$data = json_decode(curl_exec($ch), true);
echo $data['messages'][0]['status'];
\`\`\`

Yanıt hemen döner:

\`\`\`json
{
  "success": true,
  "batchId": null,
  "segments": { "encoding": "GSM-7", "parts": 1 },
  "messages": [{ "id": 1842, "uuid": "1f0c6a52-…", "phone": "+905321234567", "status": "queued", "ref": "otp-77812" }],
  "invalid": []
}
\`\`\`

## Durumu kontrol etme

\`\`\`bash
curl https://{{HOST}}/api/v1/app/sms/messages/1842 -H "Authorization: Bearer $SMS_TOKEN"
\`\`\`

Durumlar: \`scheduled → queued → dispatched → accepted → sent → delivered\` ya da \`failed\` / \`cancelled\` / \`expired\`. Her mesajı tek tek sorgulamak yerine webhook'ları (\`sms.sent\`, \`sms.delivered\`, \`sms.failed\`) kullanın ya da listeyi kendi referansınıza göre filtreleyin: \`GET /messages?ref=order-1001\`.

## Yanıtları sorgulama (polling) ile alma

Webhook kabul edemiyorsanız gelen mesajları düzenli aralıklarla sorgulayın. İşlediğiniz en büyük \`id\` değerini saklayın ve yalnızca daha yenilerini isteyin; \`sinceId\` kullanıldığında yanıt **artan** sırada gelir:

\`\`\`python
import time
last_id = load_last_id()  # ilk seferde 0
while True:
    r = requests.get(f"{API}/messages", headers=HEADERS, timeout=15,
                     params={"direction": "in", "sinceId": last_id, "limit": 200})
    for m in r.json()["messages"]:
        handle_reply(m["phone"], m["text"])
        last_id = m["id"]
        save_last_id(last_id)
    time.sleep(10)
\`\`\`

## Hatalar

Hatalar \`{ "success": false, "code": "…", "error": "…" }\` biçimindedir.

| HTTP | Kod | Ne yapmalı |
|---|---|---|
| 400 | \`TEXT_REQUIRED\`, \`TEXT_TOO_LONG\` | Metin boş veya 1600 karakterden uzun |
| 400 | \`NO_RECIPIENTS\`, \`TOO_MANY_RECIPIENTS\` | Geçerli numara yok / istek başına 1000'den fazla |
| 400 | \`SEND_AT_INVALID\`, \`SEND_AT_TOO_FAR\` | Hatalı tarih veya 90 günden daha ileri |
| 401 | \`TOKEN_INVALID\`, \`TOKEN_EXPIRED\`, \`TOKEN_REVOKED\` | Belirteci kontrol edin veya değiştirin |
| 403 | \`SCOPE_DENIED\` | Belirtecin \`sms:write\` yetkisi yok |
| 403 | \`IP_NOT_ALLOWED\`, \`TOKEN_LIMITED\` | İzin verilmeyen kaynak IP / telefon belirtecin sınırları dışında |
| 404 | \`SIM_NOT_FOUND\`, \`NOT_FOUND\` | Yanlış kimlik veya erişim yok |
| 409 | \`NO_DEVICE\` | Gönderebileceğiniz telefon yok ya da gönderim her yerde kapalı |
| 409 | \`SIM_DISABLED\`, \`SIM_LIMIT\`, \`LIMIT_REACHED\` | Gönderim kapalı veya günlük limitler dolmuş |
| 429 | \`RATE_LIMITED\` | Çok fazla istek; \`Retry-After\` kadar saniye bekleyin |

Her yanıt \`X-RateLimit-Remaining\` ve \`X-Request-Id\` başlıklarını içerir. İstek kimliğini günlüğe kaydedin — destek sürecini çok hızlandırır.

> **İpucu:** her zaman bir \`ref\` gönderin. İsteğiniz zaman aşımına uğrar ve mesajın kuyruğa alınıp alınmadığından emin olamazsanız, yeniden göndermeden önce \`GET /messages?ref=…\` ile kontrol edin.
`,
    },
    {
      title: "Webhook'lar: olaylar, imzalar ve yeniden denemeler",
      description: "Teslimatları, hataları, yanıtları ve telefon durum değişikliklerini gerçek zamanlı alın ve her isteğin gerçekten ağ geçidinden geldiğini doğrulayın.",
      content: `Webhook, bir şey olduğunda sunucunun sizin URL'nize gönderdiği bir HTTP isteğidir: bir yanıt gelir, bir mesaj teslim edilir, bir telefon çevrim dışı kalır. Sürekli sorgulamaktan (polling) hem daha hızlı hem daha hafiftir.

## Webhook oluşturma

Webhook'ları yöneticiler **Yönetim → API** (\`/admin/api\`) → *Webhook'lar* bölümünden oluşturur:

1. **URL** — HTTPS uç noktanız, ör. \`https://crm.example.com/hooks/sms\`.
2. **Olaylar** — tek tek olaylar, \`sms.*\` grubunun tamamı ya da her şey için \`*\`.
3. **Çalıştıran hesap** — erişim hakları uygulanacak kişi. Webhook yalnızca bu kişinin görebildiği telefonlarla ilgili olayları alır. Doğru telefonlara erişimi olan bir teknik hesap kullanın.
4. İsteğe bağlı olarak, tıpkı bir belirteçte olduğu gibi belirli telefonlarla sınırlayın.
5. **Gizli anahtarı** (\`whsec_…\`) kopyalayın — yalnızca bir kez gösterilir.

Bir \`ping\` olayı göndermek ve sunucunuzun yanıtını hemen görmek için **Test gönder**'e basın.

## Olaylar

| Olay | Ne zaman |
|---|---|
| \`sms.received\` | Telefonlardan birine gelen bir SMS ulaştı |
| \`sms.sent\` | SIM giden mesajı operatöre gönderdi |
| \`sms.delivered\` | Operatör teslimatı onayladı |
| \`sms.failed\` | Bir mesaj başarısız oldu (bkz. \`errorCode\`) |
| \`device.online\` | Bir telefon bağlandı |
| \`device.offline\` | Bir telefonun bağlantısı koptu |

## Yük (payload)

\`\`\`json
{
  "id": "6b0f8a8e-5f3c-4c9e-9a51-2f8d0c7c1e11",
  "type": "sms.delivered",
  "createdAt": "2026-10-19T09:31:09.000Z",
  "data": {
    "message": {
      "id": 1842, "uuid": "1f0c6a52-…", "deviceId": 3, "simId": 7, "slot": 1,
      "direction": "out", "phone": "+905321234567", "text": "Kodunuz: 4821",
      "parts": 1, "status": "delivered", "ref": "otp-77812"
    }
  }
}
\`\`\`

Telefon olayları \`data.message\` yerine \`data.device\` (kimlik, ad, çevrim içi durumu) taşır. Kendi \`ref\` değeriniz her mesaj olayında geri döner; sisteminizde ilgili siparişi veya talebi bulmak için bunu kullanın.

## Teslimat

- \`Content-Type: application/json\` ile \`POST\`.
- Başlıklar: \`X-Portal-Event\`, \`X-Portal-Delivery\`, \`X-Portal-Signature\`; bir yönetici teslimatı elle yeniden gönderdiyse ayrıca \`X-Portal-Redelivery: 1\`.
- **10 saniye** içinde dönen her **2xx** yanıtı başarı sayılır.
- Yeniden denemeler: **1 dk, 5 dk, 30 dk, 2 sa ve 6 sa** sonra; ardından teslimat başarısız olarak işaretlenir. Art arda 20 başarısız teslimattan sonra webhook kendini kapatır.

> **İpucu:** hemen \`200\` döndürün, asıl işi bir arka plan görevinde yapın. Yavaş işleyiciler zaman aşımına, zaman aşımları da yinelenen teslimatlara yol açar.

## İmzayı doğrulama

\`X-Portal-Signature: t=<unix zamanı>,v1=<hex>\`; burada \`v1 = HMAC-SHA256(secret, "<t>.<ham gövde>")\`. İmzayı her zaman JSON ayrıştırmasından önce, isteğin **ham** gövdesi üzerinden hesaplayın ve eski zaman damgalarını (5 dakikadan eski) reddedin.

### Node.js (Express)

\`\`\`js
import crypto from 'node:crypto';
import express from 'express';

const app = express();
app.post('/hooks/sms', express.raw({ type: 'application/json' }), (req, res) => {
  const header = req.get('X-Portal-Signature') || '';
  const { t, v1 } = Object.fromEntries(header.split(',').map((p) => p.split('=', 2)));
  const expected = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(\`\${t}.\${req.body}\`).digest();
  const given = Buffer.from(v1 || '', 'hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  if (!fresh || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return res.sendStatus(401);
  const event = JSON.parse(req.body);
  queue.add(event); // sonra işlenecek
  res.sendStatus(200);
});
\`\`\`

### Python (Flask)

\`\`\`python
import hmac, hashlib, time, os
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["WEBHOOK_SECRET"].encode()

@app.post("/hooks/sms")
def sms_hook():
    raw = request.get_data()
    parts = dict(p.split("=", 1) for p in request.headers.get("X-Portal-Signature", "").split(",") if "=" in p)
    t, v1 = parts.get("t", "0"), parts.get("v1", "")
    expected = hmac.new(SECRET, f"{t}.".encode() + raw, hashlib.sha256).hexdigest()
    if abs(time.time() - int(t)) > 300 or not hmac.compare_digest(expected, v1):
        abort(401)
    event = request.get_json()
    enqueue(event)
    return "", 200
\`\`\`

### PHP

\`\`\`php
<?php
$raw = file_get_contents('php://input');
parse_str(str_replace(',', '&', $_SERVER['HTTP_X_PORTAL_SIGNATURE'] ?? ''), $sig);
$expected = hash_hmac('sha256', ($sig['t'] ?? '') . '.' . $raw, getenv('WEBHOOK_SECRET'));
if (abs(time() - (int)($sig['t'] ?? 0)) > 300 || !hash_equals($expected, $sig['v1'] ?? '')) {
    http_response_code(401);
    exit;
}
$event = json_decode($raw, true);
// $event'i kaydedin ve arka planda işleyin
http_response_code(200);
\`\`\`

## İdempotans

Bir olay iki kez gelebilir; örneğin sunucunuz olayı işlemiş ama çok geç yanıt vermişse ve ağ geçidi yeniden denemişse. Olayın \`id\` değerini saklayın ve daha önce işlediğiniz olayları atlayın:

\`\`\`sql
INSERT INTO sms_events (event_id, payload) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING;
\`\`\`

Konsoldan elle yapılan **Yeniden gönder** işlemi olayın \`id\` değerini korur ve \`X-Portal-Redelivery: 1\` başlığını ekler. Elle yapılan yeniden gönderimlerin tekrar işlenmesini istiyorsanız bu başlığı dikkate alın.

## Olayların sırası

Olaylar sırasız gelebilir: bir yeniden denemeden sonra \`sms.delivered\`, \`sms.sent\`'in önüne geçebilir. Sisteminizde bir mesajın durumunu asla "geriye" almayın; elinizde zaten \`delivered\` varsa sonradan gelen \`sent\`'i yok sayın.

## Özel ağ adresleri

Özel ağlara (10.x, 192.168.x, localhost…) giden webhook'lar varsayılan olarak reddedilir. Herkese açık bir HTTPS adresi kullanın ya da alıcınız iç ağdaysa yöneticiden özel adreslere izin vermesini isteyin.
`,
    },
    {
      title: "Erişim ve ekip çalışması",
      description: "İş arkadaşlarınıza bir telefon için doğru erişim düzeyini verin ve API belirteçlerini belirli telefonlar, IP adresleri ve tarihlerle sınırlayın.",
      content: `Bir telefon onu ekleyen kişiye aittir. Diğer herkes ancak sahibi (veya bir yönetici) telefonu paylaştığında erişim kazanır. Aynı model hem arayüzdeki kullanıcılar hem de API belirteçleri üzerinden çalışan entegrasyonlar için geçerlidir.

## Erişim düzeyleri

| Düzey | Neye izin verir |
|---|---|
| **Görüntüleme (view)** | Telefonun mesajlarını ve sohbetlerini okumak, SIM kartlarını ve durumunu görmek |
| **Gönderme (edit)** | *Görüntüleme*'deki her şey, artı bu telefon üzerinden mesaj **göndermek** |
| **Yönetim (manage)** | *Gönderme*'deki her şey, artı ayarlar, SIM limitleri, belirteç, paylaşım ve telefonu silme |

Sahip her zaman *yönetim* düzeyine sahiptir.

## Telefon paylaşma

Telefon sayfasında **Erişim** bölümünü açın ve şunlardan birini ekleyin:

- bir **kullanıcı** — tek bir kişi;
- bir **grup** — örneğin "Destek"; böylece ekibe katılan yeni kişiler erişimi otomatik olarak alır;
- bir **rol**;
- portaldaki **herkes** — gönderim için nadiren iyi bir fikirdir, *görüntüleme* için bazen işe yarar.

Düzeyi seçin ve kaydedin. Değişiklik anında geçerli olur; telefonu yeniden bağlamaya gerek yoktur.

## Tipik ekip yapıları

| Kim | Düzey |
|---|---|
| Gelen kutusunda müşterilere yanıt veren destek temsilcileri | Destek telefonunda **Gönderme (edit)** |
| Sohbetleri ve raporları okuyan yönetici | **Görüntüleme** |
| Telefonların bakımını yapan BT mühendisi | **Yönetim** |
| Kod gönderen entegrasyon (teknik hesap) | Yalnızca OTP telefonlarında **Gönderme (edit)** |

> **İpucu:** *yönetim* yetkisini mümkün olduğunca az kişiye verin. *Yönetim* yetkisi olan herkes yeni bir belirteç oluşturabilir; bu da uygulamaya yeni belirteç girilene kadar telefonun bağlantısını keser.

## Erişim yönlendirmeyi nasıl etkiler?

Otomatik yönlendirme yalnızca üzerinde **gönderme (edit)** veya **yönetim** yetkiniz olan telefonları kullanır. Sizinle *görüntüleme* düzeyinde paylaşılan bir telefon listelerinizde görünür, ancak mesajlarınız asla onun üzerinden gitmez.

## API belirteçleri: aynı erişim, daha da daraltılmış

Bir belirteç her zaman sahibi adına çalışır ve asla sahibinin sahip olduğundan fazlasını elde edemez. Bunun üzerine belirteci daha da daraltabilirsiniz:

\`\`\`
sahibin hakları ∩ belirteç alanları ∩ telefon sınırları ∩ IP listesi, son kullanma, istek sınırı
\`\`\`

### Alan ve düzey

- \`sms: read\` — telefonları, mesajları ve sohbetleri okuma (raporlama, BI, gelen mesajları sorgulama).
- \`sms: write\` — ek olarak gönderme, iptal etme ve yeniden deneme.

### Belirli telefonlarla sınırlama

Belirteç ayarlarında **kaynak sınırları → SMS telefonları** (\`sms.devices\`) seçeneğini açın ve telefonları işaretleyin. Belirteç, sahibinin daha fazla telefona erişimi olsa bile artık yalnızca bu telefonlarla çalışır:

- başka bir telefonu kullanma denemesi \`TOKEN_LIMITED\` ile reddedilir;
- otomatik yönlendirme yalnızca izin verilen telefonlar arasından seçim yapar;
- mesaj listeleri yalnızca bu telefonların mesajlarını içerir.

Bir e-ticaret entegrasyonuna, başka bir telefondaki destek sohbetlerini açığa çıkarmadan "bildirimler" telefonuna erişim vermenin doğru yolu budur.

### IP izin listesi

Sunucularınızın istek gönderdiği adresleri veya IPv4 ağlarını girin, ör. \`203.0.113.10\` veya \`10.0.0.0/8\`. Başka herhangi bir yerden gelen istekler \`403 IP_NOT_ALLOWED\` alır. Entegrasyonunuz sabit IP'li bir sunucuda çalışıyorsa bunu her zaman ayarlayın.

### Son kullanma tarihi

30, 90 veya 365 gün, belirli bir tarih ya da süresiz seçeneklerinden birini seçin. Süresi dolan belirteç o günün sonunda \`401 TOKEN_EXPIRED\` ile çalışmayı bırakır. Kısa ömürlü belirteçler yükleniciler ve testler için idealdir.

### İstek sınırı

Bu belirteç için dakika başına istek sayısı (portal varsayılanı 120). Bu sınır SMS'leri değil, API çağrılarını sınırlar; SMS hızını her telefonun kendi hızı belirler.

## Teknik hesaplar

Her entegrasyon için ayrı bir hesap oluşturun, ör. \`svc-shop\`, \`svc-1c\`, \`svc-monitoring\`:

1. Yalnızca ihtiyaç duyduğu telefonları, yeterli olan en düşük düzeyde paylaşın.
2. Gerekli alan ve sınırlarla belirtecini oluşturun (bir yönetici başka bir hesap adına belirteç oluşturabilir).
3. Bir çalışan ayrıldığında hiçbir şey bozulmaz: entegrasyon onun kişisel hesabına bağlı değildir.

## Erişimleri gözden geçirme

Üç ayda bir telefonların **Erişim** sekmelerini ve belirteç listesini gözden geçirin:

- ayrılan veya rolü değişen kişileri çıkarın;
- aylardır kullanılmayan belirteçleri iptal edin (konsol boşta kalan belirteçleri gösterir);
- dış iş ortaklarının belirteçlerinde son kullanma tarihi olduğundan emin olun.
`,
    },
    {
      title: "Operatör engellemesinden kaçınma",
      description: "Numaralarınız spam olarak engellenmeden sıradan SIM kartlar üzerinden uzun süre nasıl gönderim yapılır.",
      content: `Ağ geçidi sıradan SIM kartlar üzerinden gönderir. Operatörler şebekelerini spam'e karşı korur ve spam gönderen biri gibi davranan bir SIM kısıtlanır ya da engellenir — bazen birkaç saat içinde. Aşağıdaki uygulamalar numaralarınızı sağlıklı tutar.

## 1. Temposu insan gibi olsun

- Sıradan SIM'ler için telefon hızını varsayılan **dakikada 20** değerinde veya daha düşük tutun. Hızı 60 ve üzerine çıkarmak ani engellemelerin yaygın bir nedenidir.
- Her SIM'de **günlük limit** kullanın. Limitler, döngüye girip durmadan gönderen entegrasyon hatalarına karşı güvenlik ağınızdır.
- Büyük hacimleri tek seferde göndermek yerine birkaç saate veya güne yayın.

## 2. Yeni SIM kartları ısıtın

Geçmişi olmayan yepyeni bir SIM'in hemen yüzlerce mesaj göndermesi klasik bir spam örüntüsüdür.

| Dönem | Günlük limit |
|---|---|
| 1–3. günler | 20–50, çoğunlukla yanıt verecek kişilere |
| 4–7. günler | 100 |
| 2. hafta | 200 |
| Sonrası | Başarısızlık oranını izleyerek kademeli artırın |

Olağan kullanım işe yarar: gelen mesajlar, yanıtlar, ara sıra yapılan aramalar ve mobil veri kullanımı SIM'in gerçek bir abone gibi görünmesini sağlar.

## 3. Birebir aynı toplu metinlerden kaçının

Bayt bayt aynı binlerce mesajı tespit etmek kolaydır. Kişiselleştirin:

- alıcının adı, sipariş numarası, tarih veya tutar;
- tanıtım metinleri için birkaç şablon varyantı.

Kişiselleştirme yanıt oranını da artırır.

## 4. İçeriğe dikkat edin

Operatör filtreleri şunlara tepki verir:

- herkese açık kısaltma servislerinden alınmış kısa bağlantılar (kendi alan adınızı kullanın);
- dolandırıcılıkta sık geçen kelimeler: "kazandınız", "ödül", "acil", "kartınız bloke edildi";
- büyük harfler ve çok sayıda ünlem işareti;
- sizi hiç tanımayan birine giden ilk mesajdaki bağlantılar.

Her zaman mesajı **kimin** yazdığını belirtin: "Aidar Klinik: randevunuz yarın saat 10:00'da".

## 5. Listeden çıkma imkânı verin

Tanıtım mesajlarına kısa bir satır ekleyin, örneğin: "Listeden çıkmak için RET yazıp yanıtlayın". Bu yanıtları işleyin (**Gelen kutusu**'na ve \`sms.received\` webhook'ları olarak gelirler) ve bu numaraları listelerinizden çıkarın. Listeden çıkamayan kişiler operatöre şikâyet eder — ve şikâyetler engellenmenin en hızlı yoludur.

## 6. Günün saatine saygı gösterin

Tanıtım mesajlarını yerel saatle gündüz, kabaca **09:00–20:00** arasında gönderin. Kampanyalar için zamanlanmış gönderimi kullanın. İşlemsel mesajlar — kodlar, sipariş güncellemeleri, uyarılar — insanlar onları beklediği için her saatte gidebilir.

## 7. Trafiği ayırın

- **Pazarlama** ve **işlemsel** trafiği farklı SIM'lere koyun.
- Önemli mesajlar için en az iki SIM (tercihen farklı operatörlerden) bulundurun.
- Pazarlama SIM'i engellenirse kodlar ve bildirimler çalışmaya devam eder.

## 8. Listelerinizi temizleyin

- Sürekli başarısız olan numaraları (\`PHONE_FAILED\`) çıkarın: bunlar genellikle kapatılmış hatlar veya sabit hatlardır.
- Numara veritabanı satın almayın. Birçok ülkede yasa dışı olmasının yanı sıra şikâyete ve başarısız gönderimlere yol açar.
- Kampanyadan önce numaraları \`POST /tools/numbers\` ile doğrulayın.

## 9. Yerel kurallara uyun ve onay alın

**Türkiye'de** ticari SMS gönderimi sıkı biçimde düzenlenmiştir:

- **6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun** uyarınca ticari elektronik ileti göndermek için alıcının **önceden onayı** gerekir. Onay, sonradan ispatlanabilecek şekilde alınmalı ve saklanmalıdır.
- Ticari ileti onayları **İYS'ye (İleti Yönetim Sistemi)** kaydedilmelidir; İYS'de onayı bulunmayan numaralara ticari ileti gönderilmemelidir. Alıcı onayını İYS üzerinden de geri çekebilir, bu yüzden gönderim öncesi listenizi güncel tutun.
- İletide gönderenin kimliği açıkça yer almalı ve alıcıya listeden ücretsiz ve kolay çıkış imkânı sunulmalıdır.
- Telefon numaraları ve mesaj içerikleri kişisel veridir; bunların işlenmesi ve saklanması **KVKK (6698 sayılı Kişisel Verilerin Korunması Kanunu)** kapsamındadır.

Diğer ülkelerde de durum benzerdir: Kırgızistan, Kazakistan, Rusya ve Özbekistan dahil çoğu ülkede SMS'e uygulanan kişisel veri ve reklam mevzuatı vardır (alıcı onayı, gönderen kimliği, listeden çıkma, sessiz saatler). Gönderim yaptığınız her ülkenin kurallarını kontrol edin ve her kişinin nasıl ve ne zaman onay verdiğinin kaydını tutun.

## 10. Sinyalleri okuyun

| Sinyal | Anlamı | Ne yapmalı |
|---|---|---|
| Bir SIM'in başarısızlık oranı artıyor | Operatör kısıtlaması veya engelleme başlıyor | SIM'i duraklatın, limitini düşürün |
| Mesajlar \`sent\` oluyor ama hiç \`delivered\` olmuyor | Operatör tarafında filtreleme | İçeriği değiştirin, yavaşlayın |
| SIM elle bile hiç gönderemiyor | Engellenmiş | Operatörle iletişime geçin, trafiği başka bir SIM'e taşıyın |
| Çok sayıda "kimsiniz?" yanıtı | Gönderen belirsiz | Mesajın başına adınızı ekleyin |

> **İpucu:** çok büyük hacimler için (günde on binlerce) sıradan SIM kartlar doğru araç değildir. Operatörünüzle kurumsal bir SMS paketi veya resmi bir toplu SMS hizmeti hakkında görüşün.
`,
    },
    {
      title: "Kullanım senaryoları ve entegrasyon tarifleri",
      description: "Tek kullanımlık kodlar, sipariş bildirimleri, randevu hatırlatmaları, çift yönlü destek ve izleme uyarıları için hazır kalıplar.",
      content: `Bu tarifler, yaygın senaryoların ağ geçidi üzerine nasıl kurulacağını gösterir. Hepsi aynı API'yi kullanır: göndermek için \`POST /messages\`, almak için webhook'lar veya sorgulama (polling).

## 1. Tek kullanımlık kodlar (OTP / 2FA)

**Amaç:** kullanıcı giriş veya onay kodunu saniyeler içinde alır.

1. Arka uç bir kod üretir ve kodun özetini (hash) bir geçerlilik süresiyle saklar (ör. 5 dakika).
2. SMS'i benzersiz bir \`ref\` ile gönderir:

\`\`\`python
requests.post(f"{API}/messages", headers=HEADERS, timeout=10, json={
    "to": user_phone,
    "text": f"Kodunuz: {code}. Bu kodu kimseye vermeyin.",
    "ref": f"otp-{attempt_id}",
})
\`\`\`

3. Bu \`ref\` ile gelen \`sms.failed\` webhook'u, kullanıcıya hemen başka bir kanal (e-posta, arama) önermeniz gerektiğini söyler.

İyi uygulamalar:

- Metni kısa ve GSM-7'de tutun ki tek parça olsun. Yukarıdaki örnek metin bilinçli olarak ş, ı, ğ içermez.
- Sisteminizde telefon numarası ve IP başına deneme sayısını sınırlayın; giriş formunuz üzerinden yapılan SMS bombardımanı para kaybettirir ve SIM'inizin engellenmesine yol açabilir.
- Kodlar için en az **iki telefon** kullanın; otomatik yönlendirme çevrim içi olana geçer.
- OTP'leri zamanlamayın ve kuyruğu kısa tutun: bir saat sonra gelen kod işe yaramaz. Bir dakika sonra hâlâ kuyrukta bekleyen kodları iptal etmeyi (\`POST /messages/:id/cancel\`) düşünün.

## 2. E-ticaret sitesi, 1C veya CRM'den sipariş bildirimleri

**Amaç:** müşteri "sipariş alındı", "kargoya verildi", "teslim almaya hazır" bildirimlerini alır.

- Gönderimi sisteminizdeki durum değişikliğiyle tetikleyin.
- \`ref\` olarak sipariş numarası + durum kullanın, ör. \`order-1001-shipped\`. Bu, yinelenen gönderimleri kolayca fark etmenizi sağlar ve webhook'larda geri döner.
- Metinleri kendi tarafınızda yer tutuculu şablonlarda saklayın: ad, numara, tutar, teslim alma adresi.

**1C** için isteği bir arka plan görevinden SSL üzerinden (\`OpenSSLSecureConnection\`) \`HTTPConnection\` ile gönderin: yöntem \`POST\`, yol \`/api/v1/app/sms/messages\`, başlıklar \`Authorization: Bearer pat_…\` ve \`Content-Type: application/json\`, gövde:

\`\`\`json
{ "to": "+905321234567", "text": "1001 numaralı siparişiniz teslim almaya hazır", "ref": "order-1001-ready" }
\`\`\`

Teslimat durumunu daha sonra gösterebilmek için dönen mesaj \`id\` değerini belgenin yanında saklayın.

## 3. Randevu hatırlatmaları

**Amaç:** klinik, kuaför veya servis merkezinde gelmeyen müşteri sayısını azaltmak.

Zamanlanmış gönderimi kullanın — kendi cron göreviniz gerekmez:

\`\`\`json
{
  "to": "+905321234567",
  "text": "Aidar Klinik: Yarın 10:30'da Dr. Kaya ile randevunuz var. Onay için 1, iptal için 2 yazın.",
  "sendAt": "2026-10-20T07:00:00Z",
  "ref": "visit-5531"
}
\`\`\`

Randevu iptal edilir veya ertelenirse \`POST /messages/:id/cancel\` çağırın ve yeni bir hatırlatma oluşturun. "1" veya "2" yanıtları \`sms.received\` olarak gelir; bunları telefon numarası ve son hatırlatmanın tarihine göre randevuyla eşleştirin.

## 4. Çift yönlü destek masası

**Amaç:** müşteriler bir numaraya yazar, temsilciler yanıtlar, her şey tek bir yerde durur.

- Temsilciler **Gelen kutusu**'nda çalışır: numara bazında sohbetler, okunmamış sayaçları, aynı telefondan yanıtlar.
- Destek telefonunu destek grubuyla **gönderme (edit)** düzeyinde paylaşın.
- Sohbetleri bir yardım masası (helpdesk) sistemine yansıtmak için \`sms.received\` olayına bir webhook abone edin ve telefon numarasına göre talep oluşturun veya güncelleyin. Temsilcilerin yardım masasından verdiği yanıtlar, destek telefonunun \`deviceId\` değeriyle \`POST /messages\` üzerinden geri gider; böylece müşteri her zaman aynı numarayı görür.
- Gelen kutusu sayaçlarının doğru kalması için talep açıldığında mesajları \`POST /messages/read\` ile okundu olarak işaretleyin.

## 5. İzleme uyarıları

**Amaç:** internet veya izleme paneli erişilemez olduğunda mühendis SMS alır.

SMS tam da diğer kanallar çöktüğünde işe yarar. Zabbix'ten, Prometheus Alertmanager'dan veya basit bir betikten gönderin:

\`\`\`bash
#!/bin/sh
# /usr/local/bin/sms-alert "<numara>" "<metin>"
curl -s -X POST https://{{HOST}}/api/v1/app/sms/messages \\
  -H "Authorization: Bearer $SMS_TOKEN" -H "Content-Type: application/json" \\
  -d "$(jq -n --arg to "$1" --arg text "$2" '{to:$to, text:($text|.[0:300])}')"
\`\`\`

İpuçları:

- Uyarıları gruplayın ve sınırlayın (ör. her sorun için 15 dakikada en fazla bir SMS); aksi halde sürekli inip kalkan bir servis günlük limitinizi tüketir.
- Ağ geçidi telefonlarının kendisi için \`device.offline\` olayına abone olun ve e-posta veya mesajlaşma uygulamasıyla uyarı gönderin — çevrim dışı bir telefon hakkında SMS gönderemezsiniz.

## 6. Ödeme veya teslimatların iki adımlı onayı

Kuryeye veya alıcıya bir kod gönderin ve yanıtı SMS olarak kabul edin: \`sms.received\` size numarayı ve metni verir; kodu kontrol edip siparişi güncelleyin. Bu yöntem müşteri tarafında mobil uygulama olmadan da çalışır.

## Webhook mu, sorgulama mı?

| | Webhook'lar | Sorgulama (polling) |
|---|---|---|
| Hız | Anında | N saniyede bir |
| Gereksinim | Herkese açık bir HTTPS uç noktası | Hiçbir şey |
| Yük | Minimum | Sürekli istekler |
| En uygun olduğu yer | CRM'ler, yardım masaları, botlar | Betikler, NAT arkasındaki iç sistemler |
`,
    },
    {
      title: "Sorun giderme",
      description: "Telefon çevrim dışıyken, mesajlar takıldığında, hata koduyla başarısız olduğunda ya da yanıtlar ve teslim raporları gelmediğinde ne yapmalı.",
      content: `Sorunların çoğu üç şeye dayanır: telefon bağlantısını koruyamıyordur, SIM gönderemiyordur ya da numara veya metin hatalıdır. Önce tabloya bakın, sonra durumunuza uygun adımları izleyin.

## Hızlı başvuru

| Belirti | En olası neden | İlk adım |
|---|---|---|
| Telefon çevrim dışı | İnternet yok, uygulama kapatılmış, yanlış belirteç | Uygulamayı açın, *SMS sunucusu* durumuna ve hataya bakın |
| Mesajlar \`queued\`'da kalıyor | Telefon çevrim dışı ya da hız sınırı onları bekletiyor | Telefonun durumunu ve dakika başına hızını kontrol edin |
| Mesajlar \`accepted\`'da kalıyor | Telefon mesajı aldıktan sonra bağlantıyı kaybetti | Yeniden bağlanmasını bekleyin; telefonun kendi geçmişine bakın |
| \`failed\` · \`PHONE_REJECTED\` | Telefon reddetti: hedef filtresi, uygulamadaki SIM limiti, SIM yok | Uygulamanın filtresini ve limitlerini kontrol edin |
| \`failed\` · \`PHONE_FAILED\` | Operatör veya radyo hatası | Bakiyeyi, sinyali, SMS paketini kontrol edin; elle deneyin |
| \`failed\` · \`NO_ACK\` | Telefondan 60 sn içinde onay gelmedi, 3 kez | Ağ kararlılığını ve uygulama sürümünü kontrol edin |
| \`expired\` · \`EXPIRED\` | Telefon 24 saatten uzun süre çevrim dışı kaldı | Telefonu çevrim içi yapın, yeniden deneyin |
| Gelen mesaj yok | iSMS GW varsayılan SMS uygulaması değil | Yeniden varsayılan yapın |
| \`delivered\` durumu yok | Operatör teslim raporu göndermiyor | O operatör için \`sent\`'i son durum kabul edin |
| Yinelenen mesajlar | Kodunuz isteği yeniden deniyor | \`ref\` kullanın ve yeniden göndermeden önce kontrol edin |

## Telefon çevrim dışı

1. **Uygulama çalışıyor mu?** iSMS GW'yi açın. Ağ geçidi hizmetinin bildirimi yoksa sistem uygulamayı kapatmıştır. *Android telefonu 7/24 çalışmaya hazırlama* makalesindeki adımları uygulayın.
2. *Ayarlar → SMS sunucusu* bölümünde **hataya bakın**:
   - \`HTTP 401\` — belirteç yanlış veya değiştirilmiş. Güncel belirteci portaldan kopyalayın (ya da **Yeni belirteç**'e basın) ve girin.
   - \`HTTP 403\` — telefon portalda **devre dışı**. Telefon sayfasından etkinleştirin.
   - zaman aşımı veya DNS hatası — internet yok. Telefonun tarayıcısında herhangi bir web sitesini açmayı deneyin.
3. **URL'yi kontrol edin**: tam olarak \`wss://{{HOST}}/ws/device\` olmalı.
4. Telefon sayfasındaki **günlüğe bakın**. Sık yeniden bağlanmalar Wi-Fi uykusuna veya pil optimizasyonuna işaret eder.

## Kuyrukta takılan mesajlar

- Telefon çevrim içiyken \`queued\` durumu genellikle telefonun bir toplu gönderimi kendi hızında işlediği anlamına gelir: dakikada 20 hızla 300 mesaj 15 dakika sürer.
- SIM'in gönderimi kapalıysa veya günlük limiti dolmuşsa mesajlar başka bir SIM'i ya da ertesi günü bekler.
- Kuyruk süresi içinde yola çıkmayan mesajlar \`expired\` olur. Sorunu giderdikten sonra bunları **yeniden deneyebilirsiniz**.

## \`accepted\` durumunda takılan mesajlar

Telefon mesajı aldı ama durum raporu hiç gelmedi. Durum raporları yalnızca telefon bağlıyken iletilir ve tekrarlanmaz; bu nedenle yanlış anda yaşanan bir bağlantı kopması mesajı \`accepted\` durumunda bırakır. Telefonu açın ve SMS'in gönderilenler klasöründe olup olmadığına bakın. Genellikle gönderilmiştir; portalın sadece bundan haberi yoktur.

## Hata koduna göre başarısız mesajlar

- **\`PHONE_REJECTED\`** — uygulama mesajı göndermeden önce reddetti. Nedenleri: numara uygulamadaki **hedef filtresi** tarafından engellenmiş (başka ülke, ücretli numara aralığı), uygulamada tanımlı **günlük limit** dolmuş, SIM yuvası boş veya uygulamada devre dışı. Hata metni nedeni gösterir.
- **\`PHONE_FAILED\`** — Android göndermeyi denedi, ancak radyo veya operatör reddetti. Bakiyeyi veya SMS paketini, sinyal gücünü, uçak modunu, SIM'in SMS gönderip gönderemediğini (aynı SIM'den elle deneyin) ve operatörün SIM'i spam nedeniyle engelleyip engellemediğini kontrol edin.
- **\`NO_ACK\`** — sunucu mesajı telefona üç kez iletti ve her seferinde 60 saniye içinde onay alamadı. Genellikle bağlantı yarı ölüdür (Wi-Fi uykuda). Telefon daha sonra mesajı aslında gönderdiğini bildirirse durum otomatik olarak \`sent\` veya \`delivered\` olarak düzeltilir. Çift gönderimi önlemek için yeniden denemeden önce telefonu kontrol edin.
- **\`EXPIRED\`** — telefon kuyruk süresinden daha uzun süre çevrim dışı kaldı. Bağlantıyı düzeltin, ardından **yeniden deneyin**.

## Gelen mesaj yok

1. iSMS GW **varsayılan SMS uygulaması** olmalıdır. Bazı sistem güncellemeleri ve başka mesajlaşma uygulamaları bu rolü sessizce geri alır.
2. Xiaomi'de *Hizmet SMS'i* ve *Bildirimler* izinlerini kontrol edin.
3. Telefon çevrim dışıyken gelen SMS'ler yeniden bağlandığında iletilir — telefon, sunucu onaylayana kadar bunları yeniden gönderir.
4. Webhook kullanıyorsanız **Yönetim → API → Webhook'lar** bölümündeki teslimat günlüğüne bakın: olay geliyor olabilir, ancak uç noktanız hata döndürüyordur.

## Teslim raporları gelmiyor

Bazı operatörler ve bazı hedefler (özellikle yurt dışı) teslim raporu döndürmez. Ayrıca rapor geldiği anda telefonun bağlantısı kesikse rapor kaybolur. Mesaj \`sent\` durumundaysa ve alıcı mesajı aldığını doğruluyorsa her şey tasarlandığı gibi çalışıyordur.

## Yinelenen mesajlar

- **Sizin tarafınızda:** bir zaman aşımı kodunuzun yeniden göndermesine yol açar. Her zaman \`ref\` gönderin ve zaman aşımında önce \`GET /messages?ref=…\` ile kontrol edin.
- **Webhook'lar:** bir olayın iki kez gelmesi tasarım gereğidir. Olay \`id\` değerine göre tekilleştirin.
- **\`NO_ACK\` sonrası yeniden deneme:** ilk deneme aslında gönderilmiş olabilir. Yeniden denemeden önce telefonun geçmişine bakın.

## Pil katilleri

Gündüz her şey çalışıyor ama gece duruyorsa, sebep neredeyse kesinlikle güç yönetimidir: Samsung'da *Uyku moduna alınan uygulamalar*, Xiaomi'de *Pil tasarrufu*, Huawei'de *Uygulama başlatma*, otomatik gece yeniden başlatmaları ya da bir "temizleyici" uygulama. Telefon hazırlama makalesine yeniden göz atın.

## Destek için bilgi toplama

- Mesajın \`id\` veya \`uuid\` değeri, durumu ve hata metni.
- Telefonun adı ve sorunun yaşandığı zaman.
- API yanıtının \`X-Request-Id\` değeri.
- Uygulamadaki *Ayarlar → SMS sunucusu* ekranının görüntüsü.
`,
    },
    {
      title: "Güvenlik kontrol listesi",
      description: "Belirteçleri, telefonları ve webhook'ları nasıl güvende tutarsınız; bir telefon veya belirteç kaybolduğunda ne yapmalısınız.",
      content: `Bir SMS ağ geçidi şirketiniz adına mesaj gönderebilir ve çoğu zaman kişisel veri ile onay kodları içeren yanıtları okuyabilir. Ona bir e-posta sunucusuna gösterdiğiniz özenin aynısını gösterin.

## Belirteçler

İlgilenmeniz gereken gizli bilgiler şunlardır:

| Gizli bilgi | Biçim | Sağladığı yetki |
|---|---|---|
| Telefon bağlantı belirteci | \`smsgw_…\` | **O telefon olarak** bağlanma hakkı |
| API belirteci | \`pat_…\` | **Bir kişi adına** API erişimi |
| Webhook gizli anahtarı | \`whsec_…\` | Webhook isteklerini imzalama (ve sahteleme) yeteneği |

Kontrol listesi:

- [ ] Belirteçler bir gizli bilgi yöneticisinde veya ortam değişkenlerinde saklanır; kaynak kodda, Git'te, taleplerde veya sohbetlerde **asla** bulunmaz.
- [ ] Her entegrasyonun **kendine ait** bir API belirteci vardır; böylece birini diğerlerini bozmadan iptal edebilirsiniz.
- [ ] Her belirteç işini gören **en düşük düzeydedir**: raporlar için \`read\`, \`write\` yalnızca gönderenler için.
- [ ] Belirteçler ihtiyaç duydukları **telefonlarla sınırlıdır** (\`sms.devices\`).
- [ ] Sunuculardan kullanılan belirteçlerde **IP izin listesi** vardır.
- [ ] Yükleniciler ve testler için verilen belirteçlerin **son kullanma tarihi** vardır.
- [ ] Belirteçler düzenli olarak (ör. yılda bir) ve erişimi olan biri ayrıldığında hemen **yenilenir**.

## Hesaplar ve erişim

- [ ] Entegrasyonlar kişisel hesaplarla değil, **ayrı teknik hesaplarla** çalışır.
- [ ] Telefonlar tek tek kişilerle değil **gruplarla** paylaşılır; gruptan çıkan kişinin erişimi otomatik olarak kalkar.
- [ ] *Yönetim* yetkisi mümkün olduğunca az kişiye verilir.
- [ ] Erişimler üç ayda bir gözden geçirilir: ayrılan kişiler, boşta kalan belirteçler, dış iş ortakları.
- [ ] Telefonlarda *yönetim* yetkisi olan hesaplar ve yöneticiler güçlü, benzersiz parolalar kullanır.

## Webhook'lar

- [ ] Uç nokta yalnızca **HTTPS** kullanır.
- [ ] Her istek ham gövde üzerinden HMAC imzasıyla **doğrulanır**; eski zaman damgalı istekler reddedilir.
- [ ] Olaylar \`id\` değerine göre **tekilleştirilir**.
- [ ] Webhook, yalnızca ihtiyaç duyduğu telefonları gören bir teknik hesap adına çalışır.
- [ ] Gizli anahtar sızmış olabilirse değiştirilir (**Yeni gizli anahtar**); yenisi hemen alıcı tarafa iletilir.

## Telefon

- [ ] Telefon birinin kişisel cihazı değil, ağ geçidine **ayrılmış** bir cihazdır.
- [ ] Ekran kilidi PIN ile korunur; kişisel hesap ve gereksiz uygulama yoktur.
- [ ] Fiziksel olarak güvenli bir yerdedir: açık bir masa değil, kilitli bir oda veya dolap.
- [ ] Otomatik yeniden başlatmalar için SIM PIN'i kapalıdır — bu yüzden telefonun fiziksel güvenliği daha da önemlidir.
- [ ] Uygulamanın **yerel web paneli ve API'si** internete açık değildir: uygulama güvenlik duvarını *Yalnızca LAN* modunda tutun ya da yalnızca portal bağlantısını kullanıyorsanız yerel sunucuyu kapatın.
- [ ] Uygulamadaki **hedef filtresi**, hiç göndermediğiniz ülkeleri ve ücretli numara aralıklarını engeller — bir belirteç sızarsa kötüye kullanıma karşı koruma sağlar.
- [ ] SIM'lerde günlük limitler tanımlıdır — her türlü hatanın veya kötüye kullanımın zararını sınırlar.

## Ağ

- Hem API hem de telefon bağlantısı için yalnızca \`https://\` ve \`wss://\` adreslerini kullanın.
- HTTP istemcinizde sertifika doğrulamasını "çalışsın diye" kapatmayın.

## Veriler

- Gelen SMS'ler çoğu zaman bankalardan ve servislerden gelen kodları içerir. Bir telefonu kimlerin **görüntüleyebileceğini** sınırlayın.
- Mesajlar varsayılan olarak **365 gün** saklanır, ardından silinir. Daha uzun saklamanız gerekenleri dışa aktarın ve ihtiyacınızdan fazlasını tutmayın.
- CSV dışa aktarımları kişisel veri içerir: bunları KVKK'ya uygun şekilde saklayın ve paylaşın.

## Telefon kaybolursa veya çalınırsa

1. Telefon sayfasını açın ve **Yeni belirteç**'e basın — kayıp telefon artık bağlanamaz.
2. Ya da telefonu tamamen **devre dışı bırakın**.
3. SIM kartı operatör üzerinden kapattırın ve yenisini isteyin.
4. Kayıptan sonra o telefondan gönderilmiş bir şey olup olmadığını **Mesajlar** sayfasından kontrol edin.
5. Yeni bir belirteçle yedek telefonu kurun; SIM etiketlerini ve limitlerini geri yükleyin.

## API belirteci sızdıysa

1. Belirteci *Hesap → API belirteçleri* (veya *Yönetim → API*) sayfasından **iptal edin** — anında çalışmayı bırakır.
2. Belirtecin **istek günlüğünü** inceleyin: hangi IP adreslerinden kullanıldı ve ne gönderildi.
3. **Mesajlar** sayfasında beklenmedik gönderimlere bakın ve hâlâ kuyrukta olanları iptal edin.
4. Daha sıkı sınırlarla (telefonlar, IP listesi, son kullanma tarihi) yeni bir belirteç oluşturun ve entegrasyonu güncelleyin.

> **İpucu:** bu iki prosedürü, kimin ne yapacağını isimleriyle belirterek şimdiden iç çalışma kılavuzunuza yazın. Bir olay anında talimat aramaya vakit olmaz.
`,
    },
  ],
};
