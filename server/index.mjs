import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { generateSales } from './sales-data.mjs';

const SERVER_METADATA = {
  name: 'mcp-sales-demo',
  version: '1.0.0',
  description:
    'Servidor MCP de ejemplo que entrega ventas sintéticas, soporta búsquedas y recupera detalles bajo demanda',
  websiteUrl: 'https://localhost',
};

const RESOURCE_URI = 'mcp://ventas/records';
const DATA_NOTE = 'Los registros son generados aleatoriamente y no representan ventas reales.';

const DATASET = generateSales(100);
const SALES_BY_ID = new Map(DATASET.map((record) => [record.id, record]));

const buildPayload = (records, extra = {}) => ({
  generatedAt: new Date().toISOString(),
  total: records.length,
  records,
  note: DATA_NOTE,
  ...extra,
});

const searchSchema = {
  query: z
    .string()
    .min(1)
    .describe('Texto libre para buscar en cliente, producto, región o estado'),
  filters: z
    .object({
      customer: z.string().optional().describe('Nombre exacto del cliente'),
      product: z.string().optional().describe('Nombre exacto del producto'),
      region: z
        .enum(['Norte', 'Sur', 'Este', 'Oeste', 'Centro'])
        .optional()
        .describe('Región exacta a filtrar'),
      status: z
        .enum(['Completed', 'Pending', 'Cancelled'])
        .optional()
        .describe('Estado de la venta a filtrar'),
      minTotal: z.number().optional().describe('Monto total mínimo de la venta'),
      maxTotal: z.number().optional().describe('Monto total máximo de la venta'),
    })
    .partial()
    .optional(),
  limit: z
    .number()
    .min(1)
    .max(100)
    .describe('Máximo de resultados a devolver (default 20)')
    .optional(),
};

const fetchSchema = {
  id: z.string().min(1).describe('ID principal devuelto por search'),
  ids: z
    .array(z.string().min(1))
    .min(1)
    .max(50)
    .describe('Lista adicional de IDs devueltos por search')
    .optional(),
};

const createServer = () => {
  const server = new McpServer(SERVER_METADATA, {
    capabilities: {
      logging: {},
    },
  });

  server.resource(
    'sales-dataset',
    RESOURCE_URI,
    {
      mimeType: 'application/json',
      name: 'Ventas aleatorias',
      description: 'Listado sintético de ventas para pruebas MCP',
    },
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: 'application/json',
          text: JSON.stringify(buildPayload(DATASET, { totalAvailable: DATASET.length }), null, 2),
        },
      ],
    }),
  );

  server.tool(
    'list-sales',
    'Devuelve un lote de ventas aleatorias pre-generadas',
    {
      count: z
        .number()
        .min(1)
        .max(DATASET.length)
        .describe('Cantidad de registros a devolver (default 100)')
        .optional(),
    },
    async ({ count }) => {
      const limit = Math.min(count ?? DATASET.length, DATASET.length);
      const records = DATASET.slice(0, limit);
      const payload = buildPayload(records, {
        limit,
        totalAvailable: DATASET.length,
        source: 'list-sales',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Se devuelven ${payload.total} registros sintéticos (máximo ${payload.totalAvailable}).`,
          },
        ],
        structuredContent: payload,
      };
    },
  );

  server.tool(
    'search',
    'Busca ventas por texto libre o filtros exactos',
    searchSchema,
    async ({ query, filters, limit }) => {
      const normalizedQuery = query.toLowerCase();
      const {
        customer = undefined,
        product = undefined,
        region = undefined,
        status = undefined,
        minTotal = undefined,
        maxTotal = undefined,
      } = filters ?? {};

      const matches = DATASET.filter((sale) => {
        if (customer && sale.customerName !== customer) return false;
        if (product && sale.productName !== product) return false;
        if (region && sale.region !== region) return false;
        if (status && sale.status !== status) return false;
        if (typeof minTotal === 'number' && sale.totalAmount < minTotal) return false;
        if (typeof maxTotal === 'number' && sale.totalAmount > maxTotal) return false;

        const haystack = `${sale.customerName} ${sale.productName} ${sale.region} ${sale.status}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      });

      const capped = matches.slice(0, limit ?? 20);
      const results = capped.map((sale) => ({
        id: sale.id,
        title: `${sale.customerName} · ${sale.productName}`,
        snippet: `Estado ${sale.status} · Total USD ${sale.totalAmount.toFixed(2)} · Región ${sale.region}`,
        uri: `${RESOURCE_URI}#${sale.id}`,
        score: 1,
      }));

      const structuredContent = {
        results,
        totalMatches: matches.length,
        returned: results.length,
        note: DATA_NOTE,
        query: {
          query,
          filters: filters ?? null,
          limit: limit ?? null,
        },
      };

      const summary =
        results.length === 0
          ? 'No se encontraron ventas para los filtros solicitados.'
          : `Coincidencias encontradas: ${matches.length}. Se devuelven los primeros ${results.length}.`;

      return {
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
        structuredContent,
      };
    },
  );

  server.tool(
    'fetch',
    'Recupera detalles completos de ventas por ID',
    fetchSchema,
    async ({ ids, id }) => {
      const requestedIds = [id, ...(ids ?? [])];
      const uniqueIds = [...new Set(requestedIds)];
      const records = [];
      const missing = [];

      uniqueIds.forEach((saleId) => {
        const sale = SALES_BY_ID.get(saleId);
        if (sale) {
          records.push(sale);
        } else {
          missing.push(saleId);
        }
      });

      const structuredContent = {
        records,
        missing: missing.length > 0 ? missing : undefined,
        note: DATA_NOTE,
      };

      const messageParts = [];
      if (records.length > 0) {
        messageParts.push(`Se devolvieron ${records.length} registro(s) solicitado(s).`);
      }
      if (missing.length > 0) {
        messageParts.push(`IDs no encontrados: ${missing.join(', ')}.`);
      }

      return {
        content: messageParts.length
          ? [
              {
                type: 'text',
                text: messageParts.join(' '),
              },
            ]
          : [],
        structuredContent,
      };
    },
  );

  return server;
};

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: '*',
    exposedHeaders: ['Mcp-Session-Id'],
  }),
);

app.post('/mcp', async (req, res) => {
  const server = createServer();

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error al manejar la solicitud MCP:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

app.get('/mcp', (_, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed. Usa POST para interactuar con este servidor MCP.',
    },
    id: null,
  });
});

app.delete('/mcp', (_, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed en modo stateless.',
    },
    id: null,
  });
});

const PORT = process.env.PORT
  ? Number(process.env.PORT)
  : process.env.MCP_PORT
  ? Number(process.env.MCP_PORT)
  : 3333;

const serverInstance = app.listen(PORT, () => {
  console.log(`Servidor MCP de ventas escuchando en http://localhost:${PORT}/mcp`);
});

const shutdown = () => {
  console.log('Cerrando servidor MCP...');
  serverInstance.close(() => {
    console.log('Servidor MCP detenido.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
