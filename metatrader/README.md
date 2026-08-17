# OrionBridge - Expert Advisor para MetaTrader 4 y 5

Este directorio contiene los Expert Advisors (EA) necesarios para conectar la
plataforma MetaTrader con el backend de Orion vía el protocolo ZeroMQ.

---

## Archivos

| Archivo             | Plataforma       |
|---------------------|------------------|
| `OrionBridge.mq4`   | MetaTrader 4     |
| `OrionBridge.mq5`   | MetaTrader 5     |

---

## Instalación paso a paso

### 1. Instalar la librería ZeroMQ para MQL

Descarga el proyecto `mql-zmq`:
- 🔗 https://github.com/dingmaotu/mql-zmq/releases

**Para MT4:**
1. Copia los archivos `.dll` de la carpeta `lib/` a:
   `C:\Users\TU_USUARIO\AppData\Roaming\MetaQuotes\Terminal\<ID>\MQL4\Libraries\`
2. Copia los archivos `.mqh` de `Include/Zmq/` a:
   `C:\Users\TU_USUARIO\AppData\Roaming\MetaQuotes\Terminal\<ID>\MQL4\Include\Zmq\`

**Para MT5:**
1. Copia los archivos `.dll` a `MQL5\Libraries\`
2. Copia los archivos `.mqh` a `MQL5\Include\Zmq\`

### 2. Copiar el Expert Advisor

**Para MT4:**
```
C:\...\Terminal\<ID>\MQL4\Experts\OrionBridge.mq4
```

**Para MT5:**
```
C:\...\Terminal\<ID>\MQL5\Experts\OrionBridge.mq5
```

### 3. Compilar el EA en MetaEditor

1. En MetaTrader, presiona `F4` para abrir MetaEditor.
2. Abre `OrionBridge.mq4` o `OrionBridge.mq5`.
3. Presiona `F7` para compilar. No deben haber errores críticos.

### 4. Adjuntar el EA al gráfico

1. En MetaTrader, abre cualquier gráfico (ej. EURUSD en H1).
2. Arrastra el EA desde el panel Navigator → Expert Advisors.
3. En la ventana de configuración:
   - ✅ Activa **"Permitir ejecución de operaciones en vivo"**
   - ✅ Activa **"Permitir imports de DLL"**
4. El EA aparecerá en la esquina del gráfico con un punto verde 🟢.

---

## Habilitar la integración en el Backend

Una vez que el EA esté corriendo en MetaTrader, cambia en tu archivo `.env`:

```env
MT_ENABLED=true
MT_ZMQ_HOST=127.0.0.1    # o la IP de tu VPS
MT_ZMQ_PUSH_PORT=5555
MT_ZMQ_PULL_PORT=5556
```

Luego reinicia el backend con `npm run dev`.

---

## Endpoints disponibles (API)

| Método | Endpoint                   | Descripción                         |
|--------|---------------------------|-------------------------------------|
| GET    | `/api/mt/status`          | Verifica si el EA está conectado    |
| GET    | `/api/mt/positions`       | Lista posiciones abiertas en MT     |
| POST   | `/api/mt/order`           | Ejecuta orden BUY o SELL            |
| DELETE | `/api/mt/positions/:ticket` | Cierra una posición por ticket    |
| DELETE | `/api/mt/positions`       | Cierra TODAS las posiciones abiertas|

### Ejemplo - Ejecutar una orden BUY

```bash
curl -X POST http://localhost:3008/api/mt/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_JWT_TOKEN" \
  -d '{
    "symbol": "EURUSD",
    "type": "buy",
    "lots": 0.01,
    "sl": 1.0800,
    "tp": 1.1100,
    "comment": "Test Orion"
  }'
```

### Respuesta exitosa:
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "ticket": 12345678,
    "symbol": "EURUSD",
    "type": "BUY",
    "lots": 0.01,
    "openPrice": 1.09520
  }
}
```
