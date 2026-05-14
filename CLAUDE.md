# TradingView MCP — Instruccions Claude

68 eines per llegir i controlar un gràfic TradingView Desktop en directe via CDP (port 9222).

## Arbre de decisió — Quina eina utilitzar

### "Què hi ha al gràfic ara mateix?"
1. `chart_get_state` → símbol, timeframe, tipus de gràfic, llista de tots els indicadors amb entity IDs
2. `data_get_study_values` → valors numèrics actuals de tots els indicadors visibles (RSI, MACD, BBands, EMAs, etc.)
3. `quote_get` → preu real, OHLC, volum per al símbol actual

### "Quins nivells/línies/etiquetes apareixen?"
Els indicadors Pine personalitzats dibuixen amb `line.new()`, `label.new()`, `table.new()`, `box.new()`. No són visibles a les eines de dades normals. Usar:

1. `data_get_pine_lines` → nivells de preu horitzontals dibuixats per indicadors (deduplicats, ordenats alt→baix)
2. `data_get_pine_labels` → anotacions de text amb preus (ex: "PDH 24550", "Bias Long ✓")
3. `data_get_pine_tables` → dades de taula com a files (ex: estadístiques de sessió, dashboards analítics)
4. `data_get_pine_boxes` → zones de preu / rangs com a parells {high, low}

Usar el paràmetre `study_filter` per filtrar un indicador concret per substring del nom (ex: `study_filter: "Profiler"`).

### "Dona'm dades de preu"
- `data_get_ohlcv` amb `summary: true` → estadístiques compactes (high, low, range, change%, volum mig, últimes 5 barres)
- `data_get_ohlcv` sense summary → totes les barres (usar `count` per limitar, default 100)
- `quote_get` → snapshot puntual del darrer preu

### "Analitza el meu gràfic" (workflow informe complet)
1. `quote_get` → preu actual
2. `data_get_study_values` → lectures de tots els indicadors
3. `data_get_pine_lines` → nivells de preu clau d'indicadors personalitzats
4. `data_get_pine_labels` → nivells etiquetats amb context (ex: "Settlement", "ASN O/U")
5. `data_get_pine_tables` → estadístiques de sessió, taules analítiques
6. `data_get_ohlcv` amb `summary: true` → resum de l'acció del preu
7. `capture_screenshot` → confirmació visual

### "Canvia el gràfic"
- `chart_set_symbol` → canviar ticker (ex: "AAPL", "ES1!", "NYMEX:CL1!")
- `chart_set_timeframe` → canviar resolució (ex: "1", "5", "15", "60", "D", "W")
- `chart_set_type` → canviar estil (Candles, HeikinAshi, Line, Area, Renko, etc.)
- `chart_manage_indicator` → afegir o eliminar estudis (usar nom complet: "Relative Strength Index", no "RSI")
- `chart_scroll_to_date` → saltar a una data (format ISO: "2025-01-15")
- `chart_set_visible_range` → fer zoom a un rang de dates exacte (timestamps unix)

### "Treballa amb Pine Script"
1. `pine_set_source` → injectar codi a l'editor
2. `pine_smart_compile` → compilar amb autodetecció + check d'errors
3. `pine_get_errors` → llegir errors de compilació
4. `pine_get_console` → llegir output de `log.info()`
5. `pine_get_source` → llegir codi actual (AVÍS: pot ser molt gran per scripts complexos)
6. `pine_save` → desar al núvol TradingView
7. `pine_new` → crear indicator/strategy/library en blanc
8. `pine_open` → carregar un script desat pel nom

### "Practica trading amb replay"
1. `replay_start` amb `date: "2025-03-01"` → entrar en mode replay
2. `replay_step` → avançar una barra
3. `replay_autoplay` → autoavanç (definir velocitat amb param `speed` en ms)
4. `replay_trade` amb `action: "buy"/"sell"/"close"` → executar operacions
5. `replay_status` → comprovar posició, P&L, data actual
6. `replay_stop` → tornar a temps real

### "Cribra múltiples símbols"
- `batch_run` amb `symbols: ["ES1!", "NQ1!", "YM1!"]` i `action: "screenshot"` o `"get_ohlcv"`

### "Dibuixa al gràfic"
- `draw_shape` → horizontal_line, trend_line, rectangle, text (passar point + point2 opcional)
- `draw_list` → veure què s'ha dibuixat
- `draw_remove_one` → eliminar per ID
- `draw_clear` → eliminar-ho tot

### "Gestiona alertes"
- `alert_create` → definir alerta de preu (condició: "crossing", "greater_than", "less_than")
- `alert_list` → veure alertes actives
- `alert_delete` → eliminar alertes

### "Navega per la UI"
- `ui_open_panel` → obrir/tancar pine-editor, strategy-tester, watchlist, alerts, trading
- `ui_click` → fer clic en botons per aria-label, text o data-name
- `layout_switch` → carregar un layout desat pel nom
- `ui_fullscreen` → commutar pantalla completa
- `capture_screenshot` → fer captura (regions: "full", "chart", "strategy_tester")

### "TradingView no s'executa"
- `tv_launch` → autodetectar i llançar TradingView amb CDP a Mac/Win/Linux
- `tv_health_check` → verificar que la connexió funciona

## Regles de gestió de context

Aquestes eines poden retornar payloads grans. Seguir aquestes regles per evitar inflar el context:

1. **Sempre `summary: true` a `data_get_ohlcv`** llevat que es necessitin barres individuals
2. **Sempre `study_filter`** a les eines pine quan saps quin indicador vols — no escanegis tots els estudis innecessàriament
3. **Mai `verbose: true`** a eines pine excepte si l'usuari ho demana per raw drawing data amb IDs/colors
4. **Evita `pine_get_source`** en scripts complexos — pot retornar 200KB+. Només llegir-ho si cal editar el codi
5. **Evita `data_get_indicator`** en indicadors protegits/xifrats — els seus inputs són blobs codificats. Usa `data_get_study_values` per valors actuals
6. **Usa `capture_screenshot`** per context visual en comptes de descarregar grans datasets — una captura són ~300KB però et dona el quadre visual complet
7. **Crida `chart_get_state` una sola vegada** al principi per obtenir entity IDs, després referencia'ls — no la repeteixis
8. **Limita les peticions OHLCV** — `count: 20` per anàlisi ràpida, `count: 100` per feina profunda, `count: 500` només quan calgui realment

### Mides d'output (mode compacte)
| Eina | Output típic |
|------|---------------|
| `quote_get` | ~200 bytes |
| `data_get_study_values` | ~500 bytes (tots els indicadors) |
| `data_get_pine_lines` | ~1-3 KB per estudi (nivells deduplicats) |
| `data_get_pine_labels` | ~2-5 KB per estudi (limitat a 50) |
| `data_get_pine_tables` | ~1-4 KB per estudi (files formatades) |
| `data_get_pine_boxes` | ~1-2 KB per estudi (zones deduplicades) |
| `data_get_ohlcv` (summary) | ~500 bytes |
| `data_get_ohlcv` (100 barres) | ~8 KB |
| `capture_screenshot` | ~300 bytes (retorna path al fitxer, no la imatge) |

## Convencions de les eines

- Totes les eines retornen `{ success: true/false, ... }`
- Els entity IDs (de `chart_get_state`) són específics de sessió — no els guardis entre sessions (la sessió CDP s'inicialitza nova en cada connexió)
- Els indicadors Pine han d'estar **visibles** al gràfic perquè les eines de gràfics Pine puguin llegir les seves dades
- `chart_manage_indicator` requereix **noms d'indicador complets**: "Relative Strength Index" no "RSI", "Moving Average Exponential" no "EMA", "Bollinger Bands" no "BB"
- Les captures es desen al directori `screenshots/` amb timestamps
- OHLCV limitat a 500 barres, trades a 20 per petició
- Pine labels limitades a 50 per estudi per defecte (passar `max_labels` per sobreescriure)

## Arquitectura

```
Claude Code ←→ MCP Server (stdio) ←→ CDP (localhost:9222) ←→ TradingView Desktop (Electron)
```

Path de Pine graphics: `study._graphics._primitivesCollection.dwglines.get('lines').get(false)._primitivesDataById`

## Integració amb l'ecosistema

- **Llançament local**: `tv_launch` cobreix l'arrencada automàtica. No hi ha LaunchAgent dedicat (la UI de TradingView és interactiva).
- **Ús des de mercat-obert**: el pipeline V.11.4 pot consultar dades visuals via aquest MCP (capture_screenshot per a l'anàlisi tècnica complementària).
- **Fork**: aquesta és la versió de David Ortega del projecte de LewisWJackson, mantenida localment dins `~/Claude/Eines/tradingview-mcp/`.
