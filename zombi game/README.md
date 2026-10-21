# 🧟 5x5 Zombi Platform Savunması (3D Arcade)

Canlı, renkli ve aksiyon dolu 5x5 satır-sütunlu 3D zombi platform savunma oyunu!

---

## 🎮 Nasıl Oynanır?

1. **`index.html`** dosyasını doğrudan tarayıcınızda (Chrome, Edge, Firefox vb.) çift tıklayarak açabilirsiniz.
2. Açılan ekranda **"OYUNA BAŞLA"** butonuna tıklayın veya klavyeden **Boşluk (Space) / Enter** tuşuna basın.

---

## 🕹️ Kontroller

| Kontrol | Eylem |
|---|---|
| **Fare Hareketi** | 5x5 platform ve zombiler üzerinde nişan alma |
| **Sol Tık** | Hedeflenen zombiye veya hücreye plazma atışı |
| **A / D** veya **Sol / Sağ Ok** | Savunma topunu 5 sütun arasında kaydırma |
| **Boşluk (Space)** | Bulunduğun sütundan ileriye doğru doğrudan ateş etme |
| **1, 2, 3, 4, 5 Tuşları** | 1'den 5'e kadar ilgili sütuna anında odaklanıp ateş etme |
| **P veya Esc** | Oyunu duraklatma (Pause) / Devam etme |
| **Ses Butonu (🔊 / 🔇)** | Müzik ve ses efektlerini açıp kapatma |
| **Mobil / Dokunmatik** | Ekrandaki dokunmatik oklar ve ateş butonu veya zombiye dokunma |

---

## 🌟 Oyun Mekanikleri & Özellikler

1. **5x5 Satır ve Sütun Platformu:**
   - Zombiler 5 sütundan (0..4) ve karşı satırdan (Row 0) platforma adım atar ve size doğru ilerler.
   - Platform canlı neon ızgaralar, renkli efektler ve boşlukta süzülen kristallerle bezenmiştir.

2. **Zombileri Vurma ve Uçuruma Fırlatma (Knockback Physics):**
   - Plazma atışı zombiye çarptığında zombi fizik etkisiyle havaya fırlar ve takla atarak 5x5 platformun kenarlarından uçuruma yuvarlanır!
   - Uçuruma düşüş komik ıslık sesi ve parçacık patlamalarıyla taçlandırılır.

3. **Seviye & Hız Sistemi:**
   - Düşürdüğünüz her zombide seviye atlar, zombilerin platformda ilerleme hızı ve geliş sıklığı artar.
   - Seviye arttıkça platformun renk teması dinamik olarak değişir (Neon Siber, Solar Günbatımı, Asit Ormanı, Kızıl Uçurum vb.).
   - İleri seviyelerde **Hızlı Koşucu Zombiler** ve **Güçlü Tank Zombiler** savaşa katılır!

4. **Hıza Göre Puan Sistemi:**
   - Başlangıç hızındaki zombi 20 puan verir.
   - Zombi hızı her 0,22 arttığında kazanılan puan 20 artar.
   - Puan, zombi ne kadar hızlı olursa olsun en fazla 100 olabilir.

5. **Kaybetme Koşulu (5 Kaçırma Sınırı):**
   - Platformdan kaçıp savunma hattınızı (4. satır) geçen her zombi 1 can eksiltir.
   - Ekranın üst kısmında 5 adet can göstergesi (💚💚💚💚💚) bulunur.
   - **5 zombi kaçırıldığında** oyun sona erer (Game Over) ve skorunuz, seviyeniz ile rekorunuz ekranda gösterilir.

6. **Canlı & Renkli Görseller:**
   - Dinamik degrade neon arka plan animasyonu.
   - Web Audio API ile tamamen kodla üretilmiş 8-bit/synthwave ses efektleri ve arka plan melodisi (harici ses dosyası indirme gerektirmez).
