| Endpoint | Muestras | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Error % | Throughput (req/s) |
|---|---|---|---|---|---|---|---|
| POST /auth/login | 5 | 377 | 827 | 827 | 827 | 0.00 | 0.65 |
| GET /progreso/semanal | 18 | 168 | 574 | 814 | 814 | 0.00 | 0.32 |
| GET /micro-pausas/hoy | 25 | 161 | 179 | 181 | 186 | 0.00 | 0.50 |
| GET /sueno/recomendacion | 8 | 80 | 91 | 91 | 91 | 0.00 | 0.17 |
| PATCH /micro-pausas/{id} | 13 | 1905 | 2173 | 2206 | 2206 | 23.08 | 0.25 |
|  | 9 | NaN | NaN | NaN | NaN | 100.00 | NaN |
| POST /registros-sueno | 8 | 1019 | 1141 | 1141 | 1141 | 0.00 | 0.17 |
| POST /bloques | 12 | 1394 | 1589 | 1652 | 1652 | 0.00 | 0.25 |
| DELETE /bloques/{id} | 11 | 1395 | 1570 | 1580 | 1580 | 0.00 | 0.26 |
| TOTAL | 109 | 552 | 1905 | 1948 | 2173 | 11.01 | NaN |

Umbrales (§19.5):
- ❌ Tasa de error < 1 %: 11.01
- ❌ p95 lecturas (GET) ≤ 500 ms: 814.00
- ❌ p95 escrituras ≤ 800 ms: 2206.00
- ✅ p95 POST /auth/login ≤ 1500 ms: 827.00
