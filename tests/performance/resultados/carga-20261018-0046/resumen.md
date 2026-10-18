| Endpoint | Muestras | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Error % | Throughput (req/s) |
|---|---|---|---|---|---|---|---|
| POST /auth/login | 100 | 2334 | 8121 | 8956 | 10200 | 6.00 | 0.79 |
| GET /progreso/semanal | 1334 | 5014 | 8814 | 9364 | 9929 | 50.22 | 2.21 |
| GET /micro-pausas/hoy | 1998 | 5640 | 8998 | 9589 | 10064 | 46.00 | 3.32 |
| PATCH /micro-pausas/{id} | 552 | 13560 | 15001 | 15002 | 15003 | 93.48 | 0.91 |
| GET /sueno/recomendacion | 657 | 2943 | 5009 | 5017 | 5076 | 40.64 | 1.11 |
| POST /bloques | 989 | 12462 | 15001 | 15002 | 15003 | 61.68 | 1.64 |
| POST /registros-sueno | 648 | 8552 | 12805 | 13685 | 14522 | 35.19 | 1.08 |
| DELETE /bloques/{id} | 369 | 13104 | 15001 | 15001 | 15002 | 40.92 | 0.62 |
| TOTAL | 6647 | 5653 | 14905 | 15001 | 15002 | 50.65 | 10.88 |

Umbrales (§19.5):
- ❌ Tasa de error < 1 %: 50.65
- ❌ p95 lecturas (GET) ≤ 500 ms: 9589.00
- ❌ p95 escrituras ≤ 800 ms: 15002.00
- ❌ p95 POST /auth/login ≤ 1500 ms: 8956.00
