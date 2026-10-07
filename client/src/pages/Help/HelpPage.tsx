import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Section {
  title: string;
  paragraphs: string[];
}

const SECTIONS: Section[] = [
  {
    title: "Başlarken",
    paragraphs: [
      "Sol menüden istediğiniz modüle geçebilirsiniz. Çoğu ekranda arama kutusu ve filtrelerle listeyi " +
        "daraltabilir, \"+ Yeni\" butonuyla kayıt ekleyebilirsiniz. Yaptığınız her değişiklik otomatik olarak " +
        "Değişiklik Günlüğü'ne işlenir, bu yüzden ayrıca not tutmanıza gerek yoktur. Verinizi düzenli aralıklarla " +
        "Ayarlar sayfasından yedeklemeniz önerilir."
    ]
  },
  {
    title: "Dashboard",
    paragraphs: [
      "Tüm modüllerin özetini tek ekranda gösterir: toplam switch, envanter, açık görev ve arızalı cihaz sayıları, subnet/IP eşleştirme toplamı.",
      "Kartlara tıklayınca ilgili modüle gidersiniz — örneğin \"Arızalı Cihaz\" kartı sizi doğrudan Envanter'de arızalı filtresi açık şekilde açar.",
      "Ayrıca son tarihi yaklaşan/geçmiş görevleri ve son 5 değişiklik günlüğü kaydını gösterir."
    ]
  },
  {
    title: "Switch Yönetimi",
    paragraphs: [
      "İki sekmeden oluşur: \"Topoloji\" ve \"Detay / Kart\".",
      "Topoloji sekmesinde switch'ler kutu (node) olarak görünür; sürükleyerek konumlandırabilir, bir switch'in kenarından diğerine sürükleyerek bağlantı çizebilirsiniz. Bağlantıyı silmek için üzerine çift tıklayın veya sağ tıklayın. Konum ve bağlantılar otomatik olarak veritabanına kaydedilir.",
      "Detay / Kart sekmesinde her switch için ad, model, yönetim IP, port sayısı, VLAN listesi, konum ve not bilgilerini ekleyip düzenleyebilirsiniz."
    ]
  },
  {
    title: "Envanter",
    paragraphs: [
      "Switch dışındaki tüm cihazların (sunucu, yazıcı, UPS, PC vb.) genel listesidir.",
      "Arama kutusu ve tür/durum filtreleriyle listeyi daraltabilir, \"CSV İndir\" ile Excel'de açılabilecek bir dışa aktarım alabilirsiniz.",
      "Durum alanı aktif/arızalı/yedek/hurda olarak sınıflandırılır; Dashboard'daki \"Arızalı Cihaz\" sayısı buradan gelir."
    ]
  },
  {
    title: "IP / Ağ Planı",
    paragraphs: [
      "Üstte subnet/VLAN tanımları (ad, CIDR, VLAN ID, açıklama), altta IP-cihaz eşleştirme tablosu yer alır.",
      "Bir IP kaydını isterseniz Envanter'deki bir cihaza bağlayabilirsiniz (opsiyonel). Durum alanı (kullanımda/boş/rezerve) ile hangi IP'lerin müsait olduğunu takip edebilirsiniz.",
      "Bir subnet silindiğinde, ona bağlı IP eşleştirmeleri de otomatik silinir."
    ]
  },
  {
    title: "To-Do",
    paragraphs: [
      "Bekliyor / Devam Ediyor / Tamam olmak üzere üç kolonlu bir Kanban panosudur.",
      "Görev kartlarını fare ile sürükleyip kolonlar arasında taşıyabilir, aynı kolon içinde sıralayabilirsiniz — taşıma bitince durum otomatik kaydedilir.",
      "Her görevde başlık, açıklama, öncelik (düşük/orta/yüksek), son tarih ve isteğe bağlı olarak Envanter'den ilgili bir cihaz seçilebilir. Son tarihi geçmiş görevler kırmızı, bugün olanlar turuncu vurgulanır."
    ]
  },
  {
    title: "Notlar / Runbook",
    paragraphs: [
      "Markdown destekli serbest notlar: prosedürler, komut listeleri, kısa dökümantasyon için kullanılır.",
      "Not yazarken \"Düzenle / Önizleme\" sekmeleriyle markdown çıktısını yazarken görebilirsiniz. Virgülle ayrılmış etiketler eklenebilir; bir etikete tıklayınca sadece o etikete sahip notlar listelenir.",
      "Arama kutusu başlık, içerik ve etiketlerde birden arar."
    ]
  },
  {
    title: "Değişiklik Günlüğü",
    paragraphs: [
      "Uygulamadaki her ekleme/düzenleme/silme işlemi buraya otomatik olarak kaydedilir — bu ekran salt okunurdur, buradan kayıt eklenip silinemez.",
      "Tablo adı, işlem türü (oluşturuldu/güncellendi/silindi) ve tarih aralığına göre filtreleyebilir, açıklama metninde arama yapabilirsiniz.",
      "Kayıt sayısı zamanla büyüyeceği için liste sayfalı gelir; altındaki \"Daha Fazla Yükle\" ile eski kayıtlara ulaşabilirsiniz."
    ]
  },
  {
    title: "Ayarlar",
    paragraphs: [
      "Koyu/açık tema tercihinizi buradan değiştirebilirsiniz; tercih tarayıcınızda hatırlanır.",
      "\"JSON Yedek İndir\" tüm verinizi (switch'ler, envanter, IP planı, görevler, notlar, değişiklik günlüğü dahil) tek bir JSON dosyasında indirir. Bu dosyayı başka bir bilgisayara taşıyıp orada \"JSON'dan Geri Yükle\" ile içe aktararak tüm panelinizi aynen taşıyabilirsiniz — makineler arası taşıma için önerilen yöntem budur.",
      "Geri yükleme mevcut tüm veriyi silip dosyadakiyle değiştirir ve geri alınamaz; bu yüzden onay istenir. İşlem tek seferde (hepsi ya da hiçbiri) yapılır, yarıda kalırsa veritabanınız bozulmaz."
    ]
  }
];

function AccordionItem({ section, open, onToggle }: { section: Section; open: boolean; onToggle: () => void }) {
  const panelId = `help-panel-${section.title}`;

  return (
    <section className="rounded-lg border bg-surface overflow-hidden">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left font-medium hover:bg-surface-secondary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span>{section.title}</span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="text-tertiary shrink-0"
            aria-hidden="true"
          >
            ▾
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-1.5">
              {section.paragraphs.map((p, i) => (
                <p key={i} className="text-sm text-secondary">
                  {p}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function HelpPage() {
  const [openTitles, setOpenTitles] = useState<Set<string>>(() => new Set(["Başlarken"]));

  function toggle(title: string) {
    setOpenTitles((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-1">Yardım / Kılavuz</h2>
      <p className="text-sm text-secondary mb-6">
        Panelin modüllerine kısa bir bakış.
      </p>

      <div className="space-y-3">
        {SECTIONS.map((section) => (
          <AccordionItem
            key={section.title}
            section={section}
            open={openTitles.has(section.title)}
            onToggle={() => toggle(section.title)}
          />
        ))}
      </div>
    </div>
  );
}
