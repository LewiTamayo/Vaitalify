| Endpoint | Muestras | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Error % | Throughput (req/s) |
|---|---|---|---|---|---|---|---|
| POST /auth/login | 100 | 359 | 532 | 550 | 912 | 0.00 | 0.84 |
| PATCH /micro-pausas/{id} | 2671 | 1545 | 1759 | 1827 | 2080 | 2.28 | 4.48 |
| GET /micro-pausas/hoy | 5345 | 86 | 98 | 113 | 245 | 0.00 | 9.00 |
| GET /progreso/semanal | 3566 | 93 | 106 | 140 | 574 | 0.00 | 6.01 |
| POST /bloques | 2657 | 1119 | 1287 | 1352 | 1569 | 0.00 | 4.47 |
| GET /sueno/recomendacion | 1776 | 86 | 96 | 111 | 332 | 0.00 | 3.01 |
| DELETE /bloques/{id} | 2643 | 1122 | 1288 | 1351 | 1547 | 0.00 | 4.47 |
| POST /registros-sueno | 1771 | 966 | 1108 | 1163 | 1353 | 0.00 | 3.02 |
| TOTAL | 20529 | 114 | 1497 | 1598 | 1779 | 0.30 | 34.30 |

Umbrales (§19.5):
- ✅ Tasa de error < 1 %: 0.30
- ✅ p95 lecturas (GET) ≤ 500 ms: 140.00
- ❌ p95 escrituras ≤ 800 ms: 1827.00
- ✅ p95 POST /auth/login ≤ 1500 ms: 550.00
