# ADR 001: Event Infrastructure Architecture (Kafka, Redis Pub/Sub, and MongoDB Change Streams)

## Status
Accepted

## Context
MyMate is a on-demand driver hiring platform requiring:
1. High-throughput, sub-second real-time communication between customers and drivers (live GPS tracking, WebSocket push notifications, instant messaging).
2. Mission-critical domain transaction processing with strict auditability, at-least-once delivery, and failure tolerance (payments, booking state machine transitions, driver KYC verification).
3. Immediate cache invalidation and reactive database synchronization without coupling business logic to external event brokers or suffering dual-write inconsistencies.

Rather than forcing a single event broker to serve conflicting trade-offs (e.g. low-latency ephemeral broadcasts vs. durable, replayable financial event logs), MyMate employs a **three-tier event infrastructure**. Each technology owns a specific lifecycle and domain.

---

## Architectural Taxonomy & Ownership Matrix

| Dimension | Tier 1: Apache Kafka | Tier 2: Redis Pub/Sub & Memory Adapter | Tier 3: MongoDB Change Streams |
| :--- | :--- | :--- | :--- |
| **Primary Role** | Distributed Domain Event Streaming | Low-Latency Ephemeral Cluster Fan-out | Database Oplog-Driven Internal Reactivity |
| **Durability** | High (Disk persistence, partition replicas) | None (In-memory, ephemeral buffer) | High (MongoDB replica set oplog) |
| **Replayability** | Yes (Consumer group offsets, log retention) | No (Fire-and-forget) | Partial (Resume tokens within oplog window) |
| **Latency** | Medium (5ms – 25ms, batching/acks) | Ultra-Low (< 1ms) | Low (1ms – 5ms) |
| **Error Handling** | Automatic Dead-Letter Queue (`*.dlq`), retries | Discard on client disconnect | Local process retry / stream recreation |
| **Correlation** | Distributed `X-Correlation-ID` header + payload | Socket session / connection ID | Document `_id` / transaction resume token |

---

## Detailed Component Responsibilities

### 1. Apache Kafka: Mission-Critical Asynchronous Domain Events
- **What it owns:**
  - `mymate.booking.created` — Booking creation and downstream matching triggers.
  - `mymate.payment.completed` — Razorpay webhook & wallet reconciliation, invoice generation, platform fee accounting.
  - `mymate.driver.kyc_status` — Driver onboarding approvals/rejections and compliance audit logging.
  - `mymate.booking.status_changed` — End-to-end trip status lifecycle (confirmed, in-progress, completed, cancelled).
- **Why Kafka:**
  - Guarantees strict partition ordering by entity ID (e.g., `bookingId` or `driverId`).
  - Decouples transactional HTTP request handling from slow downstream side effects (PDF invoice generation, emails, SMS).
  - Built-in Dead-Letter Queue (DLQ) pattern routes unparseable or permanently failing events to `*.dlq` topics without halting consumers.
  - Every message carries `correlationId` in both metadata headers and JSON payload for end-to-end distributed tracing.

### 2. Redis Pub/Sub & Redis Adapter: Real-Time Ephemeral Messaging
- **What it owns:**
  - Horizontal Socket.io scaling via `@socket.io/redis-adapter` across multi-instance backend containers.
  - Ephemeral driver live coordinates (`location_update`) broadcasted to users viewing the live map.
  - Peer-to-peer chat message routing between online driver and passenger sockets.
- **Why Redis:**
  - Ephemeral GPS pings (emitted every 2–5 seconds per active driver) do not require disk persistence or indefinite log retention. Persisting them to Kafka would needlessly bloat storage.
  - Sub-millisecond latency ensures smooth UI map marker interpolation without queuing delay.
  - If a client is offline, real-time socket events are safely discarded; historical messages and booking records remain stored in MongoDB.

### 3. MongoDB Change Streams: Database-Coupled Reactive Invalidation
- **What it owns:**
  - Real-time Redis cache invalidation when driver profiles or ratings change directly in MongoDB.
  - Live metric counters and dashboard aggregation triggers without requiring explicit application publish calls on every database mutation.
- **Why MongoDB Change Streams:**
  - Eliminates the classic **Dual-Write Problem**: if a process updates MongoDB and crashes before emitting an event to an external broker, state becomes inconsistent. Change Streams tail the MongoDB replica set oplog, guaranteeing events only emit after a transaction is committed.
  - Handles changes initiated through database administrative actions, migrations, or batch updates without code changes.

---

## Failure Isolation & Resilience
1. **Kafka Outage:**
   - The application does not fail user-facing requests if Kafka brokers become temporarily unreachable.
   - The Kafka producer employs exponential backoff reconnects and logs non-blocking warnings while core booking and payment database mutations continue transactionally in MongoDB.
2. **Redis Outage:**
   - `ioredis` implements graceful fallback: if Redis is offline in local dev or experiences downtime, WebSocket connections fall back to single-node memory transport, and rate-limiting falls back gracefully to in-memory buckets.
3. **Mongo Change Stream Interruption:**
   - Change Stream listeners store their `resumeToken` and automatically reconnect upon replica set failover or transient network partition.

---

## Consequences
- **Positive:** Clear separation of concerns; high performance under heavy GPS traffic; zero data loss for payments and bookings; complete observability via request-scoped correlation IDs.
- **Trade-off:** Operating three distributed state stores requires monitoring three distinct health endpoints (provable via `GET /health/ready`).
