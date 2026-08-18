import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AutoTrading API',
      version: '1.0.0',
      description:
        'API de trading automatizado. Incluye autenticación, motor de trading, Lucy IA e indicadores (librería JS, más usados y bloqueo admin). En Swagger pulsa Authorize e introduce el JWT de /api/auth/login.',
    },
    servers: [{ url: 'http://localhost:3008', description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
            error: { type: 'string' },
          },
        },
        RegisterBody: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: { type: 'string', example: 'usuario1' },
            email: { type: 'string', example: 'user@email.com' },
            password: { type: 'string', example: 'password123' },
          },
        },
        LoginBody: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', example: 'user@email.com' },
            password: { type: 'string', example: 'password123' },
          },
        },
        TradeBody: {
          type: 'object',
          required: ['userId', 'symbol', 'type', 'quantity', 'price'],
          properties: {
            userId: { type: 'integer' },
            symbol: { type: 'string', example: 'BTCUSDT' },
            type: { type: 'string', enum: ['buy', 'sell'] },
            quantity: { type: 'number' },
            price: { type: 'number' },
          },
        },
        StrategyBody: {
          type: 'object',
          required: ['name', 'config'],
          properties: {
            userId: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string' },
            config: { type: 'object' },
          },
        },
        IndicatorScript: {
          type: 'object',
          required: ['clientId', 'name', 'source'],
          properties: {
            clientId: { type: 'string', example: 'ema', description: 'Id local del script (hagamos, ema, script_...)' },
            id: { type: 'string', description: 'Alias aceptado de clientId al guardar' },
            name: { type: 'string', example: 'EMA' },
            source: {
              type: 'string',
              example: 'indicator("EMA", { overlay: true })\nplot(ta.ema(close, 20), { title: "EMA 20", color: "#d4a843" })\n',
            },
            enabled: { type: 'boolean', example: true },
          },
        },
        IndicatorRow: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            clientId: { type: 'string', example: 'ema' },
            name: { type: 'string', example: 'EMA' },
            source: { type: 'string' },
            sourceHash: { type: 'string', example: 'a1b2c3...' },
            enabled: { type: 'boolean', example: true },
            blocked: { type: 'boolean', example: false },
          },
        },
        IndicatorSaveBody: {
          type: 'object',
          required: ['scripts'],
          properties: {
            scripts: {
              type: 'array',
              items: { $ref: '#/components/schemas/IndicatorScript' },
            },
          },
        },
        PopularIndicator: {
          type: 'object',
          properties: {
            sourceHash: { type: 'string' },
            name: { type: 'string', example: 'Hagamos Profits 3.0' },
            source: { type: 'string' },
            users: { type: 'integer', example: 3, description: 'Traders distintos que lo tienen' },
            inUse: { type: 'integer', example: 2, description: 'Copias activas en gráfica' },
          },
        },
        InUseIndicator: {
          allOf: [
            { $ref: '#/components/schemas/IndicatorRow' },
            {
              type: 'object',
              properties: {
                userId: { type: 'integer', example: 4 },
                username: { type: 'string', example: 'trader01' },
              },
            },
          ],
        },
        CloneIndicatorBody: {
          type: 'object',
          required: ['sourceHash'],
          properties: {
            sourceHash: { type: 'string', description: 'SHA-256 del código (64 hex)' },
          },
        },
        BlockIndicatorBody: {
          type: 'object',
          properties: {
            sourceHash: { type: 'string', description: 'SHA-256 del código (64 hex). Opcional si envías source' },
            name: { type: 'string', example: 'EMA' },
            source: { type: 'string', description: 'Código del indicador; el servidor calcula el hash si no hay sourceHash' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Registro e inicio de sesión' },
      { name: 'System', description: 'Control del motor: salud de módulos y apagado temporal para usuarios' },
      { name: 'Indicators', description: 'Librería de indicadores JS: guardar, clonar, bloquear y ver los más usados' },
      { name: 'Lucy', description: 'Análisis y señales de Lucy IA' },
      { name: 'Strategies', description: 'Estrategias del usuario' },
      { name: 'Trading Engine', description: 'Órdenes y posiciones multi-broker' },
    ],
    paths: {
      '/api/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Registrar usuario',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterBody' } } },
          },
          responses: { '201': { description: 'Usuario creado' }, '400': { description: 'Error' } },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Iniciar sesión',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginBody' } } },
          },
          responses: { '200': { description: 'Login exitoso' }, '401': { description: 'Credenciales inválidas' } },
        },
      },
      '/api/auth/google': {
        post: {
          tags: ['Auth'],
          summary: 'Iniciar sesión con Google (token de Firebase)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['idToken'],
                  properties: {
                    idToken: { type: 'string' },
                    rememberMe: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Login con Google exitoso' },
            '401': { description: 'Token inválido' },
          },
        },
      },
      '/api/trades/{userId}': {
        get: {
          tags: ['Trades'],
          summary: 'Listar trades de un usuario',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Lista de trades' } },
        },
      },
      '/api/trades': {
        post: {
          tags: ['Trades'],
          summary: 'Crear trade',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TradeBody' } } },
          },
          responses: { '201': { description: 'Trade creado' } },
        },
      },
      '/api/portfolio/{userId}': {
        get: {
          tags: ['Portfolio'],
          summary: 'Obtener portfolio',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Portfolio del usuario' } },
        },
      },
      '/api/strategies': {
        get: {
          tags: ['Strategies'],
          summary: 'Listar estrategias del usuario autenticado',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Lista de estrategias' } },
        },
        post: {
          tags: ['Strategies'],
          summary: 'Crear estrategia',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StrategyBody' } } },
          },
          responses: { '201': { description: 'Estrategia creada' } },
        },
      },
      '/api/strategies/{id}': {
        get: {
          tags: ['Strategies'],
          summary: 'Obtener una estrategia propia',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Estrategia' }, '404': { description: 'No encontrada' } },
        },
        patch: {
          tags: ['Strategies'],
          summary: 'Actualizar nombre, descripción o config',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Estrategia actualizada' } },
        },
        delete: {
          tags: ['Strategies'],
          summary: 'Eliminar estrategia (cierra posición abierta si la hay)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Eliminada' } },
        },
      },
      '/api/strategies/{id}/toggle': {
        patch: {
          tags: ['Strategies'],
          summary: 'Activar/desactivar estrategia',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Estrategia actualizada' }, '409': { description: 'Lucy pendiente' } },
        },
      },
      '/api/lucy/analyze': {
        post: {
          tags: ['Lucy'],
          summary: 'Analizar gráfico',
          security: [{ bearerAuth: [] }],
          requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '200': { description: 'Resultado del análisis' } },
        },
      },
      '/api/lucy/signals/{symbol}': {
        get: {
          tags: ['Lucy'],
          summary: 'Obtener señales',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Señales del símbolo' } },
        },
      },
      '/api/lucy/health': {
        get: {
          tags: ['Lucy'],
          summary: 'Health check de Lucy',
          responses: { '200': { description: 'Estado del servicio Lucy' } },
        },
      },
      '/api/indicators/mine': {
        get: {
          tags: ['Indicators'],
          summary: 'Listar mis indicadores',
          description: 'Devuelve los scripts guardados del usuario autenticado.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Lista de indicadores del usuario',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { type: 'array', items: { $ref: '#/components/schemas/IndicatorRow' } },
                    },
                  },
                },
              },
            },
            '401': { description: 'Sesión no válida' },
          },
        },
        put: {
          tags: ['Indicators'],
          summary: 'Reemplazar mis indicadores',
          description:
            'Sincroniza la librería del usuario. Si un script está bloqueado por admin, se guarda con enabled=false.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IndicatorSaveBody' },
                example: {
                  scripts: [
                    {
                      clientId: 'ema',
                      name: 'EMA',
                      enabled: true,
                      source:
                        'indicator("EMA", { overlay: true })\nplot(ta.ema(close, 20), { title: "EMA 20", color: "#d4a843" })\n',
                    },
                    {
                      clientId: 'rsi',
                      name: 'RSI',
                      enabled: false,
                      source:
                        'indicator("RSI", { overlay: false })\nplot(ta.rsi(close, 14), { title: "RSI", color: "#f0d080" })\n',
                    },
                  ],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Librería guardada',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/IndicatorRow' } },
                    },
                  },
                },
              },
            },
            '401': { description: 'Sesión no válida' },
          },
        },
      },
      '/api/indicators/popular': {
        get: {
          tags: ['Indicators'],
          summary: 'Indicadores más usados por otros traders',
          description: 'Agrupa por código (sourceHash). Excluye los del usuario actual y los bloqueados.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Ranking de indicadores ajenos',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/PopularIndicator' } },
                    },
                  },
                },
              },
            },
            '401': { description: 'Sesión no válida' },
          },
        },
      },
      '/api/indicators/clone': {
        post: {
          tags: ['Indicators'],
          summary: 'Copiar un indicador popular a mi librería',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CloneIndicatorBody' } } },
          },
          responses: {
            '201': {
              description: 'Indicador copiado',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/IndicatorRow' },
                    },
                  },
                },
              },
            },
            '403': { description: 'Indicador bloqueado' },
            '404': { description: 'No se encontró el indicador' },
            '401': { description: 'Sesión no válida' },
          },
        },
      },
      '/api/indicators/in-use': {
        get: {
          tags: ['Indicators'],
          summary: 'Listar indicadores en uso (admin)',
          description: 'Copias con enabled=true, con el username del dueño. Requiere rol admin.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Indicadores activos en el sistema',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/InUseIndicator' } },
                    },
                  },
                },
              },
            },
            '401': { description: 'Sesión no válida' },
            '403': { description: 'Se requiere admin' },
          },
        },
      },
      '/api/indicators/block': {
        post: {
          tags: ['Indicators'],
          summary: 'Bloquear un indicador (admin)',
          description:
            'Bloquea el código para todos los usuarios (enabled=false). Envía sourceHash de 64 hex o el source para calcularlo.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BlockIndicatorBody' },
                example: {
                  name: 'EMA',
                  source:
                    'indicator("EMA", { overlay: true })\nplot(ta.ema(close, 20), { title: "EMA 20", color: "#d4a843" })\n',
                },
              },
            },
          },
          responses: {
            '200': { description: 'Indicador bloqueado' },
            '400': { description: 'Falta sourceHash o source' },
            '401': { description: 'Sesión no válida' },
            '403': { description: 'Se requiere admin' },
          },
        },
      },
      '/api/indicators/unblock': {
        post: {
          tags: ['Indicators'],
          summary: 'Desbloquear un indicador (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sourceHash'],
                  properties: {
                    sourceHash: { type: 'string', description: 'SHA-256 del código (64 hex)' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Indicador desbloqueado' },
            '400': { description: 'sourceHash no válido' },
            '401': { description: 'Sesión no válida' },
            '403': { description: 'Se requiere admin' },
          },
        },
      },
      '/api/system/status': {
        get: {
          tags: ['System'],
          summary: 'Estado de módulos (motor, Lucy, mercado, MT5, indicadores, cuentas)',
          responses: { '200': { description: 'Resumen de salud y flags on/off' } },
        },
      },
      '/api/admin/system': {
        get: {
          tags: ['System'],
          summary: 'Panel de control del motor (admin)',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Módulos, brokers, errores del worker' } },
        },
      },
      '/api/admin/system/{id}': {
        patch: {
          tags: ['System'],
          summary: 'Apagar o activar un módulo para los usuarios',
          description: 'Admin sigue teniendo acceso. ids: trading, worker, lucy, market, mt5, indicators, accounts, jupiter',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
                    schema: { type: 'string', enum: ['trading', 'worker', 'lucy', 'market', 'mt5', 'indicators', 'accounts', 'jupiter'] },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['enabled'],
                  properties: {
                    enabled: { type: 'boolean' },
                    note: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Estado actualizado' },
            '400': { description: 'Módulo desconocido' },
            '403': { description: 'Se requiere admin' },
          },
        },
      },
      '/api/admin/risk': {
        get: {
          tags: ['System'],
          summary: 'Límites y estado del motor de riesgo',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Snapshot de riesgo' } },
        },
        patch: {
          tags: ['System'],
          summary: 'Guardar límites del worker (pérdida diaria, tope de orden, posiciones, racha)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    maxDailyLossUsd: { type: 'number', example: 100 },
                    maxOrderUsd: { type: 'number', example: 50 },
                    maxOpenPositions: { type: 'integer', example: 3 },
                    maxErrorStreak: { type: 'integer', example: 5 },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Límites guardados' } },
        },
      },
      '/api/admin/risk/pause': {
        post: {
          tags: ['System'],
          summary: 'Pausar el worker por riesgo (sigue distinto de apagar el módulo)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object', properties: { reason: { type: 'string' } } },
              },
            },
          },
          responses: { '200': { description: 'Worker pausado' } },
        },
      },
      '/api/admin/risk/resume': {
        post: {
          tags: ['System'],
          summary: 'Reanudar el worker tras una pausa de riesgo',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Worker reanudado' } },
        },
      },
      '/api/jupiter/status': {
        get: {
          tags: ['System'],
          summary: 'Estado de la conexión a Jupiter (precios Solana)',
          responses: { '200': { description: 'Conectado o falta API key' } },
        },
      },
      '/api/jupiter/prices': {
        get: {
          tags: ['System'],
          summary: 'Precios USD de tokens Solana vía Jupiter Price API v3',
          responses: { '200': { description: 'Lista de precios' }, '401': { description: 'Falta API key' } },
        },
      },
      '/api/jupiter/quote': {
        get: {
          tags: ['System'],
          summary: 'Cotización de swap Jupiter (ruta, no ejecuta)',
          parameters: [
            { name: 'input', in: 'query', schema: { type: 'string', example: 'SOL' } },
            { name: 'output', in: 'query', schema: { type: 'string', example: 'USDC' } },
            { name: 'amount', in: 'query', schema: { type: 'number', example: 0.1 } },
          ],
          responses: { '200': { description: 'Ruta y cantidades' } },
        },
      },
      '/api/jupiter/order': {
        get: {
          tags: ['System'],
          summary: 'Armar transacción de swap Jupiter para firmar en Phantom',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'input', in: 'query', schema: { type: 'string', example: 'SOL' } },
            { name: 'output', in: 'query', schema: { type: 'string', example: 'USDC' } },
            { name: 'amount', in: 'query', schema: { type: 'number', example: 0.1 } },
            { name: 'taker', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'transaction base64 + requestId' } },
        },
      },
      '/api/jupiter/execute': {
        post: {
          tags: ['System'],
          summary: 'Enviar swap firmado a Jupiter /execute',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['signedTransaction', 'requestId', 'taker'],
                  properties: {
                    signedTransaction: { type: 'string' },
                    requestId: { type: 'string' },
                    taker: { type: 'string' },
                    input: { type: 'string' },
                    output: { type: 'string' },
                    amount: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Swap confirmado' }, '400': { description: 'Swap fallido' } },
        },
      },
      '/api/admin/integrations/jupiter': {
        patch: {
          tags: ['System'],
          summary: 'Guardar o borrar la API key de Jupiter Portal',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { apiKey: { type: 'string' } },
                },
              },
            },
          },
          responses: { '200': { description: 'Key guardada y ping' }, '403': { description: 'Admin' } },
        },
      },
      '/api/engine/brokers': {
        get: {
          tags: ['Trading Engine'],
          summary: 'Listar brokers registrados y su estado',
          responses: { '200': { description: 'Lista de brokers con estado de conexión' } },
        },
      },
      '/api/engine/price': {
        get: {
          tags: ['Trading Engine'],
          summary: 'Obtener precio actual de un símbolo',
          parameters: [
            { name: 'broker', in: 'query', required: true, schema: { type: 'string', enum: ['binance', 'mt5'] } },
            { name: 'symbol', in: 'query', required: true, schema: { type: 'string', example: 'BTCUSDT' } }
          ],
          responses: { '200': { description: 'Precio actual del símbolo' } },
        },
      },
      '/api/engine/order': {
        post: {
          tags: ['Trading Engine'],
          summary: 'Ejecutar orden unificada (multi-broker)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['broker', 'symbol', 'side'],
                  properties: {
                    broker: { type: 'string', enum: ['binance', 'mt5'] },
                    symbol: { type: 'string', example: 'BTCUSDT' },
                    side: { type: 'string', enum: ['buy', 'sell'] },
                    quantity: { type: 'number', example: 0.001, description: 'Usar para cripto en Binance' },
                    lot: { type: 'number', example: 0.1, description: 'Usar para Forex/CFDs en MT5' },
                    sl: { type: 'number', example: 1.0800, description: 'Stop Loss (opcional)' },
                    tp: { type: 'number', example: 1.1100, description: 'Take Profit (opcional)' },
                    comment: { type: 'string', example: 'Orion Order' }
                  }
                }
              }
            }
          },
          responses: { '201': { description: 'Orden ejecutada con éxito' }, '400': { description: 'Error al procesar orden' } },
        },
      },
      '/api/engine/positions': {
        get: {
          tags: ['Trading Engine'],
          summary: 'Obtener posiciones abiertas (todas o por broker)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'broker', in: 'query', required: false, schema: { type: 'string', enum: ['binance', 'mt5'] } }
          ],
          responses: { '200': { description: 'Lista de posiciones abiertas' } },
        },
      },
      '/api/engine/positions/{broker}/{ticket}': {
        delete: {
          tags: ['Trading Engine'],
          summary: 'Cerrar una posición específica',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'broker', in: 'path', required: true, schema: { type: 'string', enum: ['binance', 'mt5'] } },
            { name: 'ticket', in: 'path', required: true, schema: { type: 'string', example: '123456' } }
          ],
          responses: { '200': { description: 'Posición cerrada con éxito' }, '400': { description: 'Error al cerrar posición' } },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
