# x402-iot-poc

> **Durum: yapım aşamasında (WIP).** Bu, iki yazılım agent'ının bir IoT senaryosunda
> birbirine otonom olarak ödeme yaptığı, uçtan uca çalışan bir kanıt-of-concept'tir.
> Ödemeler **yalnızca testnet** (Base Sepolia) üzerinde yapılır — gerçek para yoktur.

## Ne / Neden

- **Ne:** Bir satıcı "device twin" agent'ı, bir alıcı agent'ına HTTP üzerinden veri/hizmet satar.
  Ödeme, [x402](https://www.x402.org) ile (HTTP 402 → imzalı ödeme başlığı → facilitator settle eder);
  yetkilendirme, AP2-tarzı imzalı bir *mandate* ile; keşif, A2A Agent Card ile yapılır.
- **Neden:** Makinelerin kullanım başına ödeme yaptığı "agentic payments" alanını, çalışan bir örnekle,
  açıkça ve dürüstçe göstermek.

## Yığın

Cloudflare Workers · Durable Objects · KV · (ileride) Workers AI · x402 · Base Sepolia (testnet) · TypeScript

## Hızlı başlangıç

> _Buraya, numaralı ve kopyala-yapıştır çalışan adımlar gelecek (W4 hedefi:
> senden başkası README'den tek başına ≤15 dakikada kurabilmeli)._

```bash
# yapım aşamasında
```

## Mimari

> _Buraya bir Mermaid sequence diyagramı gelecek: keşif → mandate → x402 settlement → teslim._

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| _(W2'de doldurulacak)_ | |

## SSS

> _Lansmandan gelen gerçek sorularla doldurulacak._

## Lisans

[MIT](./LICENSE). Bu depo, ücretli bir staj denemesi sırasında açık kaynak olarak geliştirilmektedir.
