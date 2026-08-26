# Future live-score sync architecture (v0.4+)

Scorer v0.3 establishes stable match IDs so cloud sync can be added without replacing the offline app.

1. Offline-first scorekeeper remains authoritative and can keep scoring without connectivity.
2. Optional account enables cloud team profiles, history and live publishing.
3. Each live match receives a short code / QR and a read-only spectator channel.
4. One scorekeeper has write access by default; spectators are read-only.
5. A realtime backend such as Supabase or Firebase broadcasts compact score-state updates to website and app viewers.
6. A future Scorer website consumes the same match state for live team pages and final results.
7. Matches can be private/link-only/public; photos remain private unless explicitly published.
