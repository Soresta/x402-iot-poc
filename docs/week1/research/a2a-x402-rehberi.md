# 🤖 A2A + x402: Agent'lar Nasıl Konuşur ve Birbirine Ödeme Yapar?

> **Kaynaklar:** [A2A Protocol](https://google.github.io/A2A/), [x402 Extensions](https://docs.x402.org/extensions/overview), [x402 HTTP 402](https://docs.x402.org/core-concepts/http-402)

---

## 1. Büyük Resim — 3 Saniyede

```mermaid
graph LR
    A2A["🗣️ A2A\nAgent'lar arası\nİLETİŞİM"]
    X402["💳 x402\nAgent'lar arası\nÖDEME"]
    A2A --- PLUS["➕"]
    PLUS --- X402
    PLUS --> RESULT["🤖💰 Agent Ekonomisi\nAgent'lar birbirini bulur,\nişi halleder, parasını öder"]

    style A2A fill:#42a5f5,color:#fff
    style X402 fill:#66bb6a,color:#fff
    style PLUS fill:#FFE66D,color:#333
    style RESULT fill:#764ba2,color:#fff
```

**Tek cümle:** A2A = agent'ların **konuşma dili**, x402 = agent'ların **cüzdanı**. İkisi birleşince agent'lar hem iş yapabilir hem ödeme alabilir.

---

## 2. A2A Nedir? — Basit Benzetme

**A2A (Agent-to-Agent)** = Google'ın başlattığı, AI agent'ların birbirini **keşfetmesini**, **görev vermesini** ve **sonuç almasını** sağlayan açık standart.

### 🏢 Ofis Benzetmesi

```mermaid
graph TD
    subgraph "🏢 Bir Şirket Düşün"
        CEO["👔 CEO Agent\n(Orkestratör)"]
        DEV["👨‍💻 Yazılımcı Agent"]
        DES["🎨 Tasarımcı Agent"]
        ACC["📊 Muhasebeci Agent"]
    end

    CEO -->|"Logo tasarla"| DES
    CEO -->|"API yaz"| DEV
    CEO -->|"Fatura kes"| ACC
    DES -->|"Logo hazır ✅"| CEO
    DEV -->|"API hazır ✅"| CEO
    ACC -->|"Fatura kesildi ✅"| CEO

    style CEO fill:#764ba2,color:#fff
    style DEV fill:#42a5f5,color:#fff
    style DES fill:#f093fb,color:#fff
    style ACC fill:#66bb6a,color:#fff
```

A2A olmadan bu agent'lar birbirinin **dilini bilmez**. Her biri farklı framework'te (LangGraph, CrewAI, custom) çalışır. A2A hepsine ortak bir dil verir.

> [!TIP]
> **A2A vs MCP farkı:**
> - **MCP** = Agent'ı **araçlara** bağlar (veritabanı, API, dosya sistemi)
> - **A2A** = Agent'ı **diğer agent'lara** bağlar (iletişim, görev delegasyonu)

---

## 3. ⭐ Agent Card — Agent'ın Kartviziti

Her A2A agent'ının bir **Agent Card**'ı vardır. Bu, agent'ın kim olduğunu, ne yapabildiğini ve nasıl erişileceğini anlatan bir JSON dosyasıdır.

### Nerede Bulunur?

```
https://agent.example.com/.well-known/agent.json
```

### Agent Card Yapısı

```mermaid
graph TD
    subgraph "📇 Agent Card"
        ID["🏷️ Kimlik\nname, description, version"]
        SK["🎯 Yetenekler (Skills)\nid, name, description\ninputModes, outputModes"]
        EP["🔗 Endpoint\nurl: https://agent.example.com/a2a/"]
        AU["🔐 Authentication\nschemes: bearer, OAuth"]
        CA["⚡ Capabilities\nstreaming: true\npushNotifications: true"]
    end

    style ID fill:#42a5f5,color:#fff
    style SK fill:#66bb6a,color:#fff
    style EP fill:#FFE66D,color:#333
    style AU fill:#ef5350,color:#fff
    style CA fill:#9c27b0,color:#fff
```

### Gerçek Bir Agent Card Örneği

```json
{
  "name": "weather-agent",
  "description": "Dünya genelinde hava durumu sorgulama agent'ı",
  "url": "https://weather-agent.example.com/a2a/",
  "version": "1.0.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  },
  "defaultInputModes": ["text"],
  "defaultOutputModes": ["text", "data"],
  "skills": [
    {
      "id": "current-weather",
      "name": "Anlık Hava Durumu",
      "description": "Belirtilen şehir için anlık hava durumu verir",
      "inputModes": ["text"],
      "outputModes": ["text", "data"]
    },
    {
      "id": "forecast",
      "name": "5 Günlük Tahmin",
      "description": "5 günlük hava durumu tahmini",
      "inputModes": ["text"],
      "outputModes": ["text", "data"]
    }
  ],
  "authentication": {
    "schemes": ["bearer"]
  }
}
```

### Benzetme: LinkedIn Profili

| Agent Card Alanı | LinkedIn Karşılığı |
|---|---|
| `name` | Profil adı |
| `description` | Hakkımda bölümü |
| `skills` | Yetenekler listesi |
| `url` | İletişim bilgisi |
| `authentication` | Bağlantı isteği / Premium |
| `capabilities` | "Mesajlara açık" durumu |

---

## 4. ⭐ Task Lifecycle — Görev Yaşam Döngüsü

A2A'da tüm işler **Task** (görev) olarak modellenir. Her görev bir durum makinesinden (state machine) geçer.

### Durum Şeması

```mermaid
stateDiagram-v2
    [*] --> submitted : Görev gönderildi

    submitted --> working : Agent işe başladı
    submitted --> rejected : Agent reddetti

    working --> completed : İş bitti ✅
    working --> failed : Hata oluştu ❌
    working --> input_required : Ek bilgi gerekli ❓
    working --> canceled : İptal edildi 🚫

    input_required --> working : Bilgi sağlandı
    input_required --> canceled : İptal edildi

    completed --> [*]
    failed --> [*]
    canceled --> [*]
    rejected --> [*]
```

### Her Durum Ne Anlama Geliyor?

| Durum | Emoji | Anlamı | Gerçek Hayat Karşılığı |
|-------|-------|--------|----------------------|
| **`submitted`** | 📬 | Görev alındı, henüz başlanmadı | Sipariş onaylandı |
| **`working`** | ⚙️ | Agent işi yapıyor | Kargo hazırlanıyor |
| **`input-required`** | ❓ | Agent ek bilgi istiyor | "Hangi beden?" sorusu |
| **`completed`** | ✅ | İş başarıyla bitti | Kargo teslim edildi |
| **`failed`** | ❌ | Hata oluştu | Ürün stokta yok |
| **`canceled`** | 🚫 | Client iptal etti | Sipariş iptal edildi |
| **`rejected`** | 🛑 | Agent görevi reddetti | "Bu işi yapamam" |

### Akış Örneği: Tercüme Görevi

```mermaid
sequenceDiagram
    participant C as 👤 Client Agent
    participant T as 🌍 Tercüman Agent

    C->>T: tasks/send: "Bu metni Türkçeye çevir"
    Note over T: Durum: submitted 📬

    T-->>C: TaskStatusUpdateEvent: working ⚙️
    Note over T: Agent çeviriyor...

    T-->>C: TaskStatusUpdateEvent: input-required ❓
    T-->>C: "Hangi üslup? Resmi mi, günlük mü?"

    C->>T: tasks/send: "Resmi üslup lütfen"
    T-->>C: TaskStatusUpdateEvent: working ⚙️

    T-->>C: TaskArtifactUpdateEvent 📄
    Note over C: Çeviri parçası geldi (streaming)

    T-->>C: TaskStatusUpdateEvent: completed ✅
    T-->>C: Artifacts: ["Çevrilmiş metin..."]
```

### Task'ın Temel Bileşenleri

```mermaid
graph TD
    subgraph "📋 Task Yapısı"
        TID["🆔 taskId\nBenzersiz görev kimliği"]
        CID["🔗 contextId\nİlişkili görevleri gruplar"]
        ST["📊 status\nsubmitted / working / completed..."]
        MSG["💬 messages\nClient ve agent arasındaki mesajlar"]
        ART["📦 artifacts\nÇıktılar: dosya, veri, metin"]
    end

    style TID fill:#42a5f5,color:#fff
    style CID fill:#9c27b0,color:#fff
    style ST fill:#FFE66D,color:#333
    style MSG fill:#f093fb,color:#fff
    style ART fill:#66bb6a,color:#fff
```

---

## 5. ⭐⭐ A2A + x402 Nasıl Birleşir (Compose)?

İşte en önemli kısım. İki protokol birbirini **tamamlar**, **çakışmaz**.

### Katmanlı Yapı

```mermaid
graph TB
    subgraph "🎂 Katmanlı Pasta Gibi Düşün"
        L3["🤖 AI Agent Mantığı\n(LangGraph, CrewAI, custom)"]
        L2["🗣️ A2A — İletişim Katmanı\n(Keşif, görev yönetimi, mesajlaşma)"]
        L1["💳 x402 — Ödeme Katmanı\n(Fiyatlandırma, yetkilendirme, settlement)"]
        L0["⛓️ Blockchain\n(USDC, ETH — gerçek para transferi)"]
    end

    L3 --> L2
    L2 --> L1
    L1 --> L0

    style L3 fill:#764ba2,color:#fff
    style L2 fill:#42a5f5,color:#fff
    style L1 fill:#66bb6a,color:#fff
    style L0 fill:#4ECDC4,color:#fff
```

| Katman | Protokol | Ne Yapar? | Olmasa? |
|--------|----------|-----------|---------|
| İletişim | A2A | Agent'lar birbirini bulur ve konuşur | Agent'lar birbirinin varlığından habersiz |
| Ödeme | x402 | Agent'lar birbirine ödeme yapar | Hizmet bedava olmak zorunda |
| Altyapı | Blockchain | Paranın gerçekten el değiştirmesi | Güven mekanizması yok |

### Anahtar Prensip: A2A Ödemeden Habersiz

```mermaid
graph LR
    subgraph "A2A Protokolü"
        A["Keşif\n(Agent Card)"]
        B["Görev Yönetimi\n(Task Lifecycle)"]
        C["Mesajlaşma\n(Messages)"]
        D["Çıktılar\n(Artifacts)"]
    end

    subgraph "x402 Protokolü"
        E["Fiyat Beyanı\n(402 Response)"]
        F["Ödeme İmzası\n(Payment Payload)"]
        G["Doğrulama\n(Verify)"]
        H["Ödeme\n(Settle)"]
    end

    B -.->|"402 döndüğünde\notomatik devreye girer"| E

    style A fill:#42a5f5,color:#fff
    style B fill:#42a5f5,color:#fff
    style C fill:#42a5f5,color:#fff
    style D fill:#42a5f5,color:#fff
    style E fill:#66bb6a,color:#fff
    style F fill:#66bb6a,color:#fff
    style G fill:#66bb6a,color:#fff
    style H fill:#66bb6a,color:#fff
```

> [!IMPORTANT]
> A2A çekirdek spesifikasyonu **ödeme hakkında hiçbir şey bilmez**. Bilinçli olarak "ödeme agnostik" tasarlanmıştır. x402 bir **uzantı (extension)** olarak ödeme katmanını ekler.

---

## 6. ⭐⭐⭐ Gerçek Senaryo: Agent Bir Agent'ı Kiralar

Bir seyahat planlama agent'ı, hava durumu agent'ına ücretli sorgu yapar:

```mermaid
sequenceDiagram
    participant TA as 🧳 Seyahat Agent
    participant WA as 🌤️ Hava Durumu Agent
    participant F as 🤝 Facilitator
    participant BC as ⛓️ Blockchain

    Note over TA,WA: 1️⃣ KEŞİF (A2A)
    TA->>WA: GET /.well-known/agent.json
    WA-->>TA: Agent Card (yetenekler, fiyat bilgisi)

    Note over TA,WA: 2️⃣ GÖREV GÖNDER (A2A)
    TA->>WA: tasks/send: "İstanbul 5 günlük tahmin"
    Note over WA: status: submitted 📬

    Note over TA,BC: 3️⃣ ÖDEME GEREKLİ (x402 devreye girer!)
    WA-->>TA: HTTP 402 + Payment Required
    Note over TA: "Bu hizmet $0.01 USDC"

    Note over TA,BC: 4️⃣ ÖDEME + YETKİLENDİRME (x402)
    TA->>TA: Ödeme payload'ı oluştur + İmzala
    TA->>WA: tasks/send + PAYMENT-SIGNATURE header

    Note over WA,BC: 5️⃣ DOĞRULAMA (x402)
    WA->>F: /verify "İmza geçerli mi?"
    F-->>WA: "Evet ✅"

    Note over WA,WA: 6️⃣ İŞ YAPILIR (A2A)
    Note over WA: status: working ⚙️
    WA-->>TA: TaskStatusUpdateEvent: working

    Note over WA,BC: 7️⃣ SETTLEMENT (x402)
    WA->>F: /settle "Parayı gönder"
    F->>BC: 0.01 USDC transfer
    BC-->>F: Onaylandı ✅

    Note over TA,WA: 8️⃣ SONUÇ (A2A)
    WA-->>TA: status: completed ✅
    WA-->>TA: Artifact: 5 günlük hava tahmini 🌤️
```

### Adım Adım — Kim Ne Yapıyor?

| Adım | Protokol | Ne Oluyor? |
|------|----------|------------|
| 1. Keşif | **A2A** | Agent Card okunur, yetenekler öğrenilir |
| 2. Görev | **A2A** | Task oluşturulur, `submitted` durumuna geçer |
| 3. 402 Yanıtı | **x402** | "Bu iş ücretli" sinyali verilir |
| 4. İmzalama | **x402** | Client ödeme talimatını imzalar (mandate) |
| 5. Doğrulama | **x402** | Facilitator imzayı kontrol eder |
| 6. İş Yürütme | **A2A** | Task `working` durumunda, agent çalışıyor |
| 7. Ödeme | **x402** | Para blockchain'e yazılır |
| 8. Sonuç | **A2A** | Task `completed`, artifact teslim edilir |

---

## 7. Agent Card + x402 Fiyat Bilgisi

x402 extension'ı sayesinde Agent Card'a ödeme bilgileri de eklenebilir:

```mermaid
graph TD
    subgraph "📇 Zenginleştirilmiş Agent Card"
        ID["🏷️ name: weather-agent"]
        SK["🎯 skills: current-weather, forecast"]
        EP["🔗 url: https://weather.ai/a2a/"]
        PAY["💳 x402 Payment Info\nscheme: exact\nprice: $0.01\nnetwork: Base (EVM)\nasset: USDC"]
    end

    style ID fill:#42a5f5,color:#fff
    style SK fill:#66bb6a,color:#fff
    style EP fill:#FFE66D,color:#333
    style PAY fill:#ff9800,color:#fff
```

Bu sayede keşif aşamasında **fiyat da görülebilir** — agent "bu hizmet kaça?" diye önceden bilir.

---

## 8. Neden İkisi Birlikte Güçlü?

```mermaid
graph TD
    subgraph "🔴 Sadece A2A (Ödeme yok)"
        A1["Agent'lar konuşur ✅"]
        A2["Görev verir ✅"]
        A3["Ama hizmet bedava olmak\nzorunda 😐"]
    end

    subgraph "🔴 Sadece x402 (İletişim yok)"
        B1["Ödeme yapılır ✅"]
        B2["Ama agent'lar birbirini\nnasıl bulacak? 🤷"]
        B3["Görev takibi yok 😐"]
    end

    subgraph "🟢 A2A + x402 (Tam çözüm)"
        C1["Agent'lar birbirini bulur ✅"]
        C2["Görev verir + takip eder ✅"]
        C3["Ücretli hizmet sunar ✅"]
        C4["Ödeme otomatik ✅"]
        C5["İnsan müdahalesi gereksiz ✅"]
    end

    style A1 fill:#ef5350,color:#fff
    style A2 fill:#ef5350,color:#fff
    style A3 fill:#ef5350,color:#fff
    style B1 fill:#ef5350,color:#fff
    style B2 fill:#ef5350,color:#fff
    style B3 fill:#ef5350,color:#fff
    style C1 fill:#66bb6a,color:#fff
    style C2 fill:#66bb6a,color:#fff
    style C3 fill:#66bb6a,color:#fff
    style C4 fill:#66bb6a,color:#fff
    style C5 fill:#66bb6a,color:#fff
```

---

## 9. Büyük Benzetme: Freelancer Platformu

Tüm sistemi bir **freelancer platformu** gibi düşün:

```mermaid
graph TD
    subgraph "🌐 Upwork Benzetmesi"
        PROF["📇 Agent Card = Freelancer Profili\n(Kim? Ne yapıyor? Saat ücreti ne?)"]
        PROJ["📋 Task = Proje / İş İlanı\n(submitted → working → completed)"]
        CHAT["💬 A2A Messages = Mesajlaşma\n(Client ve freelancer arasında)"]
        PAY["💳 x402 = Ödeme Sistemi\n(Escrow, milestone, ödeme)"]
        DEL["📦 Artifacts = Teslim Edilenler\n(Dosya, rapor, tasarım)"]
    end

    PROF --> PROJ
    PROJ --> CHAT
    CHAT --> PAY
    PAY --> DEL

    style PROF fill:#42a5f5,color:#fff
    style PROJ fill:#FFE66D,color:#333
    style CHAT fill:#f093fb,color:#fff
    style PAY fill:#66bb6a,color:#fff
    style DEL fill:#4ECDC4,color:#fff
```

| Upwork | A2A + x402 |
|--------|------------|
| Freelancer profili | Agent Card |
| Proje oluştur | Task `submitted` |
| Freelancer çalışıyor | Task `working` |
| "Ek bilgi lazım" mesajı | Task `input-required` |
| Teslim + Ödeme | Task `completed` + x402 settle |
| Proje iptal | Task `canceled` |

---

## 10. Özet Şeması

```mermaid
graph TB
    subgraph "🗺️ Tam Harita"
        direction TB
        AC["📇 Agent Card\nKim? Ne yapıyor?"]
        TL["📋 Task Lifecycle\nsubmitted → working → completed"]
        A2A2["🗣️ A2A Protokolü\nKeşif + İletişim + Görev"]
        X4022["💳 x402 Protokolü\n402 → İmzala → Doğrula → Öde"]
        FAC["🤝 Facilitator\nDoğrula + Blockchain'e gönder"]
        BC2["⛓️ Blockchain\nPara gerçekten el değiştirir"]
    end

    AC --> A2A2
    TL --> A2A2
    A2A2 -->|"402 döndüğünde"| X4022
    X4022 --> FAC
    FAC --> BC2

    style AC fill:#42a5f5,color:#fff
    style TL fill:#9c27b0,color:#fff
    style A2A2 fill:#667eea,color:#fff
    style X4022 fill:#66bb6a,color:#fff
    style FAC fill:#FFE66D,color:#333
    style BC2 fill:#4ECDC4,color:#fff
```

---

## 🎓 Kavram Sözlüğü

| Terim | Anlamı |
|-------|--------|
| **A2A** | Agent-to-Agent — agent'ların iletişim ve keşif protokolü |
| **Agent Card** | Agent'ın kimliğini, yeteneklerini ve erişim bilgisini gösteren JSON kartvizitidir |
| **Task** | A2A'da iş birimi — bir görevin yaşam döngüsü vardır |
| **TaskState** | Görevin mevcut durumu (submitted, working, completed, failed...) |
| **Artifact** | Görev sonucunda üretilen çıktı (dosya, veri, metin) |
| **contextId** | İlişkili görevleri bir arada tutan kimlik — çok turlu konuşmalar için |
| **Skill** | Agent Card'daki yetenek tanımı — agent'ın ne yapabildiği |
| **x402 Extension** | A2A'ya ödeme katmanı ekleyen uzantı |
| **HTTP 402** | "Bu hizmet ücretli, öde" sinyali |
| **Compose** | İki protokolün birbirini tamamlayarak birlikte çalışması |
| **MCP** | Model Context Protocol — agent'ı araçlara bağlar (A2A'dan farklı) |

---

> [!NOTE]
> Önceki rehberlere de göz at:
> - [Facilitator Rehberi](file:///C:/Users/akifk/.gemini/antigravity/brain/6a5ae049-f8af-47f4-af70-062c50724513/facilitator_rehberi.md) — Facilitator'ın detaylı açıklaması
> - [Mandate & Authorization Rehberi](file:///C:/Users/akifk/.gemini/antigravity/brain/6a5ae049-f8af-47f4-af70-062c50724513/mandate_authorization_settlement_rehberi.md) — Intent vs Cart, Auth ≠ Settlement
