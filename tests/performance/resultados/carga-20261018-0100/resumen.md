| Endpoint | Muestras | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Error % | Throughput (req/s) |
|---|---|---|---|---|---|---|---|
| POST /auth/login | 100 | 354 | 526 | 535 | 890 | 0.00 | 0.84 |
| GET /micro-pausas/hoy | 5006 | 168 | 229 | 275 | 350 | 0.00 | 8.41 |
| GET /progreso/semanal | 3337 | 176 | 243 | 292 | 440 | 0.00 | 5.61 |
| PATCH /micro-pausas/{id} | 2505 | 1993 | 2239 | 2328 | 2555 | 2.00 | 4.21 |
| GET /sueno/recomendacion | 1664 | 85 | 118 | 143 | 250 | 0.00 | 2.83 |
| POST /bloques | 2484 | 1428 | 1627 | 1683 | 1862 | 0.00 | 4.20 |
| DELETE /bloques/{id} | 2470 | 1422 | 1625 | 1675 | 1852 | 0.00 | 4.20 |
| POST /registros-sueno | 1656 | 1044 | 1197 | 1244 | 1371 | 0.00 | 2.82 |
| TOTAL | 19222 | 270 | 1922 | 2062 | 2269 | 0.26 | 32.05 |

Umbrales (§19.5):
- ✅ Tasa de error < 1 %: 0.26
- ✅ p95 lecturas (GET) ≤ 500 ms: 292.00
- ❌ p95 escrituras ≤ 800 ms: 2328.00
- ✅ p95 POST /auth/login ≤ 1500 ms: 535.00
