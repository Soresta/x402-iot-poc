# 🧭 x402 Facilitator — Comprehensive Guide

> **Source:** [docs.x402.org/core-concepts/facilitator](https://docs.x402.org/core-concepts/facilitator)

---

## 1. What is a Facilitator?

**Facilitator = A service that verifies payments and submits them to the blockchain on behalf of the server.**

The facilitator is an **optional but recommended** intermediary in the x402 protocol. It removes the need for resource servers (sellers) to maintain direct blockchain connectivity.

```mermaid
graph LR
    A["🖥️ Resource Server\n(Seller)"] -->|"Send payment"| F["🤝 Facilitator"]
    F -->|"Verify + Submit"| B["⛓️ Blockchain"]
    style A fill:#FF6B6B,color:#fff
    style F fill:#FFE66D,color:#333
    style B fill:#4ECDC4,color:#fff
```

> [!TIP]
> The facilitator **does not hold funds** and is **not a custodian**. It only performs verification and execution of onchain transactions based on signed payloads provided by clients.

---

## 2. Why Use a Facilitator?

Without a facilitator, the resource server must:
- Run blockchain nodes
- Implement payment verification logic
- Manage gas fees and transaction monitoring

With a facilitator, the server simply says *"verify this payment and settle it"* — all blockchain complexity is abstracted away.

| Benefit | Description |
|---------|-------------|
| **Reduced complexity** | Servers don't interact directly with blockchain nodes |
| **Protocol consistency** | Standardized verify/settle flows across services |
| **Faster integration** | Start accepting payments with minimal blockchain-specific code |

---

## 3. Facilitator Responsibilities

```mermaid
graph TD
    subgraph "🤝 Facilitator — 3 Core Responsibilities"
        V["✅ Verify\nConfirm the client's payment\npayload meets requirements"]
        S["💸 Settle\nSubmit validated payments\nto the blockchain"]
        R["📋 Respond\nReturn verification and\nsettlement results to server"]
    end

    V --> S --> R

    style V fill:#42a5f5,color:#fff
    style S fill:#66bb6a,color:#fff
    style R fill:#FFE66D,color:#333
```

| Responsibility | What it does | Analogy |
|----------------|-------------|---------|
| **Verify** | Checks if the client's payment payload is valid (signature, balance, conditions) | Cashier holding a bill up to the light to check if it's real |
| **Settle** | Submits the verified payment to the blockchain and waits for confirmation | Cashier depositing the money into the register |
| **Respond** | Reports the result back to the server — success or failure | Cashier telling the manager "payment confirmed" |

---

## 4. End-to-End Interaction Flow

This is the complete lifecycle of a paid HTTP request using a facilitator:

```mermaid
sequenceDiagram
    participant C as 👤 Client (Buyer)
    participant S as 🖥️ Server (Seller)
    participant F as 🤝 Facilitator
    participant B as ⛓️ Blockchain

    Note over C,B: PHASE 1 — Discovery
    C->>S: 1. HTTP request (e.g., GET /premium-data)
    S-->>C: 2. 402 Payment Required + PAYMENT-REQUIRED header

    Note over C,B: PHASE 2 — Payment Preparation
    C->>C: 3. Select payment scheme, create Payment Payload, sign it
    C->>S: 4. Retry request with PAYMENT-SIGNATURE header

    Note over C,B: PHASE 3 — Verification
    S->>F: 5. POST /verify (Payment Payload + Payment Details)
    F-->>S: 6. Verification Response ✅

    Note over C,B: PHASE 4 — Fulfillment
    S->>S: 7. If valid → perform work (generate response)

    Note over C,B: PHASE 5 — Settlement
    S->>F: 8. POST /settle (Payment Payload + Payment Details)
    F->>B: 9. Submit transaction to blockchain
    B-->>F: 10. Transaction confirmed ✅
    F-->>S: 11. Payment Execution Response

    Note over C,B: PHASE 6 — Response
    S-->>C: 12. 200 OK + resource + PAYMENT-RESPONSE header
```

### Step-by-Step Breakdown

| Step | Actor | Action | Protocol Element |
|------|-------|--------|-----------------|
| 1 | Client → Server | Initial HTTP request | Standard HTTP |
| 2 | Server → Client | 402 + payment requirements (Base64-encoded) | `PAYMENT-REQUIRED` header |
| 3 | Client | Selects a `paymentDetails` entry, creates payload based on `scheme` | Payment Payload |
| 4 | Client → Server | Retries request with signed payment | `PAYMENT-SIGNATURE` header |
| 5 | Server → Facilitator | Sends payload + details to `/verify` | Facilitator API |
| 6 | Facilitator → Server | Returns verification result | Verification Response |
| 7 | Server | Performs work if verification passed | Business logic |
| 8 | Server → Facilitator | Sends payload + details to `/settle` | Facilitator API |
| 9-10 | Facilitator ↔ Blockchain | Submits tx, waits for confirmation | Onchain settlement |
| 11 | Facilitator → Server | Returns settlement result | Payment Execution Response |
| 12 | Server → Client | Returns resource + settlement receipt | `PAYMENT-RESPONSE` header |

---

## 5. Choosing a Facilitator Path

```mermaid
graph TD
    Q{"What is your goal?"}
    Q -->|"Quick start\n(dev/testnet)"| A["🌐 Public\nx402.org Facilitator"]
    Q -->|"Production\n(mainnet)"| B["🏢 Managed\nFacilitator Provider"]
    Q -->|"Full control"| C["🔧 Self-hosted\nor Self-facilitation"]

    style Q fill:#764ba2,color:#fff
    style A fill:#66bb6a,color:#fff
    style B fill:#42a5f5,color:#fff
    style C fill:#ef5350,color:#fff
```

| Goal | Recommended Path | Notes |
|------|-----------------|-------|
| Fastest testnet/local quickstart | Public `x402.org` facilitator | Free, easy, **dev/testnet only** |
| Managed production deployment | Production facilitator provider | Supports your target network |
| Full operational control | Self-host or self-facilitate | See [self-facilitation example](https://github.com/x402-foundation/x402/tree/main/examples/typescript/servers/self-facilitation) |

> [!WARNING]
> The public `x402.org` facilitator is intended **for development and testnet only**. Do not use it for production mainnet deployments.

---

## 6. Live Facilitators

Multiple facilitators are live in production, supporting various networks:

- **Base** (EVM)
- **Solana** (SVM)
- **Polygon** (EVM)
- **Avalanche** (EVM)
- And more — see [Facilitators directory](https://docs.x402.org/dev-tools/facilitators)

---

## 7. Solana Duplicate Settlement Protection

On Solana, a **race condition** can occur when the same payment transaction is submitted to `/settle` multiple times before the first is confirmed onchain.

```mermaid
graph LR
    C["😈 Malicious Client"] -->|"Submit same payment\n3 times"| F["🤝 Facilitator"]
    F -->|"All return 'success'\n(Solana deduplicates later)"| S["🖥️ Server"]
    S -->|"Grants 3 resources\nbut only 1 payment!"| C

    style C fill:#e53935,color:#fff
    style F fill:#FFE66D,color:#333
    style S fill:#FF6B6B,color:#fff
```

**Mitigation:** The x402 SVM packages include a built-in `SettlementCache`:
- Short-lived in-memory cache (120 seconds)
- Detects and rejects duplicate settlement attempts
- **Enabled by default** in TypeScript and Python
- In Go, a shared `SettlementCache` instance should be passed during registration

> [!CAUTION]
> If you are a merchant settling payments directly (without a facilitator), you **must** implement equivalent duplicate detection yourself.

---

## 8. Restaurant Analogy

```mermaid
graph TD
    subgraph "🍽️ Restaurant Analogy"
        M["👤 Customer\n(Client)"]
        W["👨‍🍳 Waiter\n(Server)"]
        POS["💳 POS Terminal\n(Facilitator)"]
        BK["🏦 Bank\n(Blockchain)"]
    end

    M -->|"1. Asks for menu"| W
    W -->|"2. Shows prices"| M
    M -->|"3. Hands over card"| W
    W -->|"4. Swipes card on POS"| POS
    POS -->|"5. Checks with bank"| BK
    BK -->|"6. Approval received"| POS
    POS -->|"7. Tells waiter 'approved'"| W
    W -->|"8. Serves the meal"| M

    style M fill:#667eea,color:#fff
    style W fill:#f093fb,color:#fff
    style POS fill:#FFE66D,color:#333
    style BK fill:#4ECDC4,color:#fff
```

| Restaurant | x402 Protocol |
|------------|--------------|
| Customer hands over card | Client sends signed payment payload |
| Waiter swipes on POS | Server sends verify request to facilitator |
| POS gets bank approval | Facilitator verifies on blockchain |
| Meal is served | Resource/data is returned |

---

## 9. Summary

```mermaid
graph TB
    subgraph "🔑 Facilitator — Key Takeaways"
        direction TB
        P1["✅ Does NOT hold funds"]
        P2["✅ Only VERIFIES and SUBMITS"]
        P3["✅ SIMPLIFIES server operations"]
        P4["✅ Optional but RECOMMENDED"]
        P5["✅ Multi-network support\n(Base, Solana, Polygon, Avalanche...)"]
    end

    style P1 fill:#4caf50,color:#fff
    style P2 fill:#2196f3,color:#fff
    style P3 fill:#ff9800,color:#fff
    style P4 fill:#9c27b0,color:#fff
    style P5 fill:#00bcd4,color:#fff
```

---

## 📖 Glossary

| Term | Definition |
|------|-----------|
| **Client (Buyer)** | The party requesting access to a paid resource |
| **Server (Seller)** | The party providing the paid resource |
| **Facilitator** | Intermediary service that verifies and settles payments on behalf of the server |
| **Verify** | Checking whether a payment payload is valid (signature, balance, conditions) |
| **Settle** | Submitting a verified payment to the blockchain and waiting for confirmation |
| **402 Payment Required** | HTTP status code signaling "this resource requires payment" |
| **Payment Payload** | The signed payment data package created by the client |
| **PAYMENT-REQUIRED** | HTTP header (server → client) containing Base64-encoded payment requirements |
| **PAYMENT-SIGNATURE** | HTTP header (client → server) containing the Base64-encoded signed payment |
| **PAYMENT-RESPONSE** | HTTP header (server → client) containing the Base64-encoded settlement result |
| **Settlement Cache** | In-memory protection against duplicate settlement (Solana-specific) |
| **Base Sepolia** | Ethereum L2 testnet used for development with x402 |

---

> **Further Reading:**
> - [Client / Server roles](https://docs.x402.org/core-concepts/client-server)
> - [HTTP 402 details](https://docs.x402.org/core-concepts/http-402)
> - [Payment Schemes](https://docs.x402.org/schemes/overview)
