//+------------------------------------------------------------------+
//|                                              OrionBridge.mq5     |
//|               Orion AutoTrading - ZeroMQ Expert Advisor (MT5)     |
//|                                                                  |
//| INSTALACIÓN:                                                     |
//|  1. Copia este archivo a: MQL5/Experts/OrionBridge.mq5           |
//|  2. Descarga la librería ZeroMQ para MQL5:                       |
//|     https://github.com/dingmaotu/mql-zmq                         |
//|  3. Copia los .dll a: MQL5/Libraries/                            |
//|  4. Copia los .mqh a: MQL5/Include/Zmq/                          |
//|  5. Compila y adjunta al gráfico (cualquier par, cualquier TF)   |
//|  6. Activa "Permitir ejecución de operaciones en vivo"           |
//|  7. Activa "Permitir imports de DLL"                             |
//+------------------------------------------------------------------+
#property copyright "Orion AutoTrading"
#property version   "1.00"

#include <Zmq/Zmq.mqh>
#include <Trade/Trade.mqh>

// ── Parámetros configurables ─────────────────────────────────────
input int    PUSH_PORT   = 5555;
input int    PULL_PORT   = 5556;
input ulong  MAGIC       = 20240101;
input int    DEVIATION   = 10;

// ── Variables globales ────────────────────────────────────────────
Context ctx;
Socket  pullSocket(ctx, ZMQ_PULL);
Socket  pushSocket(ctx, ZMQ_PUSH);
CTrade  trade;
string  g_requestId = "";

//+------------------------------------------------------------------+
//| Inicialización                                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(MAGIC);
   trade.SetDeviationInPoints(DEVIATION);
   
   pullSocket.bind(StringFormat("tcp://*:%d", PUSH_PORT));
   pushSocket.bind(StringFormat("tcp://*:%d", PULL_PORT));
   
   // Timer de 100ms para procesar mensajes incluso sin ticks
   EventSetMillisecondTimer(100);
   
   Print("[OrionBridge] EA MT5 iniciado. Escuchando en puerto ", PUSH_PORT);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Desinicialización                                                |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   pullSocket.unbind(StringFormat("tcp://*:%d", PUSH_PORT));
   pushSocket.unbind(StringFormat("tcp://*:%d", PULL_PORT));
   Print("[OrionBridge] EA detenido.");
}

//+------------------------------------------------------------------+
//| Timer tick                                                       |
//+------------------------------------------------------------------+
void OnTick()
{
   ProcessMessages();
}

//+------------------------------------------------------------------+
//| Timer (100ms) - procesa mensajes incluso sin ticks               |
//+------------------------------------------------------------------+
void OnTimer()
{
   ProcessMessages();
}

//+------------------------------------------------------------------+
//| Procesa mensajes ZeroMQ                                          |
//+------------------------------------------------------------------+
void ProcessMessages()
{
   ZmqMsg message;
   if (!pullSocket.recv(message, true)) return;

   string raw = message.getData();
   if (StringLen(raw) == 0) return;

   Print("[OrionBridge] Recibido: ", raw);

   string action  = JsonGetString(raw, "action");
   string symbol  = JsonGetString(raw, "symbol");
   double lots    = JsonGetDouble(raw, "lots");
   double sl      = JsonGetDouble(raw, "sl");
   double tp      = JsonGetDouble(raw, "tp");
   ulong  ticket  = (ulong)JsonGetDouble(raw, "ticket");
   string comment = JsonGetString(raw, "comment");
   ulong  magic   = (ulong)JsonGetDouble(raw, "magic");
   g_requestId    = JsonGetString(raw, "requestId");
   if (magic == 0) magic = MAGIC;
   if (StringLen(comment) == 0) comment = "Orion";

   trade.SetExpertMagicNumber(magic);

   if (StringLen(symbol) == 0) symbol = _Symbol;

   string response = "";

   if (action == "PING")
   {
      response = WrapJson("{\"status\":\"PONG\",\"message\":\"EA MT5 activo\"}");
   }
   else if (action == "BUY")
   {
      response = ExecuteBuy(symbol, lots, sl, tp, comment, magic);
   }
   else if (action == "SELL")
   {
      response = ExecuteSell(symbol, lots, sl, tp, comment, magic);
   }
   else if (action == "CLOSE")
   {
      response = CloseTicket(ticket, magic);
   }
   else if (action == "CLOSE_ALL")
   {
      response = CloseAllPositions(magic);
   }
   else if (action == "GET_POSITIONS")
   {
      response = GetOpenPositions(magic);
   }
   else if (action == "GET_SYMBOLS")
   {
      response = GetSymbols();
   }
   else if (action == "GET_PRICE")
   {
      response = GetPrice(symbol);
   }
   else
   {
      response = WrapJson("{\"status\":\"ERROR\",\"error\":\"Accion desconocida\"}");
   }

   Print("[OrionBridge] Respuesta: ", response);
   ZmqMsg reply(response);
   pushSocket.send(reply);
}

//+------------------------------------------------------------------+
//| BUY a mercado                                                    |
//+------------------------------------------------------------------+
string WrapJson(string body)
{
   if (StringLen(g_requestId) == 0) return body;
   int last = StringLen(body) - 1;
   if (last < 0) return body;
   if (StringSubstr(body, last, 1) != "}") return body;
   return StringSubstr(body, 0, last) + StringFormat(",\"requestId\":\"%s\"}", g_requestId);
}

ulong ResolvePositionTicket()
{
   ulong deal = trade.ResultDeal();
   if (deal > 0)
   {
      HistorySelect(TimeCurrent() - 120, TimeCurrent() + 5);
      if (HistoryDealSelect(deal))
         return (ulong)HistoryDealGetInteger(deal, DEAL_POSITION_ID);
   }
   ulong order = trade.ResultOrder();
   if (order > 0 && PositionSelectByTicket(order)) return order;
   return order > 0 ? order : deal;
}

//+------------------------------------------------------------------+
//| BUY a mercado                                                    |
//+------------------------------------------------------------------+
string ExecuteBuy(string sym, double lots, double sl, double tp, string comment, ulong magic)
{
   trade.SetExpertMagicNumber(magic);
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   bool ok = trade.Buy(lots, sym, ask, sl, tp, comment);
   
   if (!ok)
      return WrapJson(StringFormat("{\"status\":\"ERROR\",\"error\":\"Buy fallido. Codigo: %d, %s\"}", (int)trade.ResultRetcode(), trade.ResultRetcodeDescription()));
   
   ulong resTicket = ResolvePositionTicket();
   return WrapJson(StringFormat(
      "{\"status\":\"OK\",\"ticket\":%I64u,\"symbol\":\"%s\",\"type\":\"BUY\",\"lots\":%.2f,\"openPrice\":%.5f,\"magic\":%I64u}",
      resTicket, sym, lots, ask, magic
   ));
}

//+------------------------------------------------------------------+
//| SELL a mercado                                                   |
//+------------------------------------------------------------------+
string ExecuteSell(string sym, double lots, double sl, double tp, string comment, ulong magic)
{
   trade.SetExpertMagicNumber(magic);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   bool ok = trade.Sell(lots, sym, bid, sl, tp, comment);
   
   if (!ok)
      return WrapJson(StringFormat("{\"status\":\"ERROR\",\"error\":\"Sell fallido. Codigo: %d, %s\"}", (int)trade.ResultRetcode(), trade.ResultRetcodeDescription()));
   
   ulong resTicket = ResolvePositionTicket();
   return WrapJson(StringFormat(
      "{\"status\":\"OK\",\"ticket\":%I64u,\"symbol\":\"%s\",\"type\":\"SELL\",\"lots\":%.2f,\"openPrice\":%.5f,\"magic\":%I64u}",
      resTicket, sym, lots, bid, magic
   ));
}

//+------------------------------------------------------------------+
//| Cierra una posición por ticket                                   |
//+------------------------------------------------------------------+
string CloseTicket(ulong ticket, ulong magic)
{
   if (!PositionSelectByTicket(ticket))
      return WrapJson(StringFormat("{\"status\":\"ERROR\",\"error\":\"Ticket %I64u no encontrado\"}", ticket));

   long posMagic = PositionGetInteger(POSITION_MAGIC);
   if (magic > 0 && posMagic != (long)magic)
      return WrapJson("{\"status\":\"ERROR\",\"error\":\"El ticket no pertenece a esta cuenta Orion\"}");

   bool ok = trade.PositionClose(ticket);
   if (!ok)
      return WrapJson(StringFormat("{\"status\":\"ERROR\",\"error\":\"No se pudo cerrar ticket %I64u. Codigo: %d\"}", ticket, (int)trade.ResultRetcode()));
   
   return WrapJson(StringFormat("{\"status\":\"OK\",\"message\":\"Ticket %I64u cerrado\",\"ticket\":%I64u}", ticket, ticket));
}

//+------------------------------------------------------------------+
//| Cierra todas las posiciones abiertas con nuestro MAGIC            |
//+------------------------------------------------------------------+
string CloseAllPositions(ulong magic)
{
   int closed = 0, errors = 0;
   for (int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if (PositionGetInteger(POSITION_MAGIC) != (long)magic) continue;
      if (trade.PositionClose(ticket)) closed++;
      else errors++;
   }
   return WrapJson(StringFormat("{\"status\":\"OK\",\"message\":\"%d posiciones cerradas, %d errores\"}", closed, errors));
}

//+------------------------------------------------------------------+
//| Retorna JSON con posiciones abiertas                             |
//+------------------------------------------------------------------+
string GetOpenPositions(ulong magic)
{
   string positions = "[";
   bool first = true;
   
   for (int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if (PositionGetInteger(POSITION_MAGIC) != (long)magic) continue;
      
      string sym     = PositionGetString(POSITION_SYMBOL);
      long   posType = PositionGetInteger(POSITION_TYPE);
      string typeStr = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";
      double open    = PositionGetDouble(POSITION_PRICE_OPEN);
      double current = PositionGetDouble(POSITION_PRICE_CURRENT);
      double posLots = PositionGetDouble(POSITION_VOLUME);
      double posSL   = PositionGetDouble(POSITION_SL);
      double posTP   = PositionGetDouble(POSITION_TP);
      double profit  = PositionGetDouble(POSITION_PROFIT);
      string comm    = PositionGetString(POSITION_COMMENT);
      long   posMagic = PositionGetInteger(POSITION_MAGIC);
      
      if (!first) positions += ",";
      positions += StringFormat(
         "{\"ticket\":%I64u,\"symbol\":\"%s\",\"type\":\"%s\",\"lots\":%.2f,\"openPrice\":%.5f,\"currentPrice\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f,\"comment\":\"%s\",\"magic\":%I64d}",
         ticket, sym, typeStr, posLots, open, current, posSL, posTP, profit, comm, posMagic
      );
      first = false;
   }
   
   positions += "]";
   return WrapJson(StringFormat("{\"status\":\"OK\",\"positions\":%s}", positions));
}

//+------------------------------------------------------------------+
//| Retorna JSON con símbolos disponibles en Market Watch            |
//+------------------------------------------------------------------+
string GetSymbols()
{
   string symbols = "[";
   bool first = true;
   int total = SymbolsTotal(true);
   for (int i = 0; i < total && i < 100; i++)
   {
      string sym = SymbolName(i, true);
      if (!first) symbols += ",";
      symbols += StringFormat("\"%s\"", sym);
      first = false;
   }
   symbols += "]";
   return WrapJson(StringFormat("{\"status\":\"OK\",\"symbols\":%s}", symbols));
}

//+------------------------------------------------------------------+
//| Retorna precio actual de un símbolo                               |
//+------------------------------------------------------------------+
string GetPrice(string sym)
{
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double spread = SymbolInfoInteger(sym, SYMBOL_SPREAD);
   double change = 0;
   double high = SymbolInfoDouble(sym, SYMBOL_HIGH);
   double low = SymbolInfoDouble(sym, SYMBOL_LOW);
   double volume = SymbolInfoDouble(sym, SYMBOL_VOLUME);
   return WrapJson(StringFormat(
      "{\"status\":\"OK\",\"symbol\":\"%s\",\"bid\":%.5f,\"ask\":%.5f,\"spread\":%.0f,\"change\":%.2f,\"high\":%.5f,\"low\":%.5f,\"volume\":%.2f}",
      sym, bid, ask, spread, change, high, low, volume
   ));
}

//+------------------------------------------------------------------+
//| Helpers JSON sencillos                                           |
//+------------------------------------------------------------------+
string JsonGetString(string json, string key)
{
   string search = "\"" + key + "\":\"";
   int start = StringFind(json, search);
   if (start < 0) return "";
   start += StringLen(search);
   int end = StringFind(json, "\"", start);
   if (end < 0) return "";
   return StringSubstr(json, start, end - start);
}

double JsonGetDouble(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if (start < 0) return 0.0;
   start += StringLen(search);
   if (StringSubstr(json, start, 1) == "\"") start++;
   int end = start;
   while (end < StringLen(json))
   {
      string ch = StringSubstr(json, end, 1);
      if (ch == "," || ch == "}" || ch == "\"" || ch == "]") break;
      end++;
   }
   return StringToDouble(StringSubstr(json, start, end - start));
}
