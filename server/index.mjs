import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { generateSales } from './sales-data.mjs';

const SERVER_METADATA = {
  name: 'mcp-sales-demo',
  version: '1.0.0',
  description: 'Servidor MCP de ejemplo que entrega ventas sintéticas y permite búsquedas básicas',
  websiteUrl: 'https://localhost',
};

const RESOURCE_URI = 'mcp://ventas/records';

const createServer = () => {
  const server = new McpServer(SERVER_METADATA, {
    capabilities: {
      logging: {},
    },
  });

  const dataset = generateSales(100);

  const buildPayload = (records, extra = {}) => ({
    generatedAt: new Date().toISOString(),
    total: records.length,
    records,
    note: 'Los registros son generados aleatoriamente y no representan ventas reales.',
    ...extra,
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
          text: JSON.stringify(buildPayload(dataset), null, 2),
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
        .max(500)
        .describe('Cantidad de registros a devolver (default 100)')
        .optional(),
    },
    async ({ count }) => {
      const limit = count ?? dataset.length;
      const records =
        limit <= dataset.length ? dataset.slice(0, limit) : generateSales(limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(buildPayload(records), null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'search',
    'Busca ventas por texto libre o filtros exactos',
    {
      query: z
        .string()
        .min(1)
        .describe('Texto libre para buscar en cliente, producto, región o estado')
        .optional(),
      customer: z.string().describe('Nombre exacto del cliente a filtrar').optional(),
      product: z.string().describe('Nombre exacto del producto a filtrar').optional(),
      region: z
        .enum(['Norte', 'Sur', 'Este', 'Oeste', 'Centro'])
        .describe('Región exacta a filtrar')
        .optional(),
      status: z
        .enum(['Completed', 'Pending', 'Cancelled'])
        .describe('Estado de la venta a filtrar')
        .optional(),
      minTotal: z
        .number()
        .describe('Monto total mínimo de la venta')
        .optional(),
      maxTotal: z
        .number()
        .describe('Monto total máximo de la venta')
        .optional(),
      limit: z
        .number()
        .min(1)
        .max(100)
        .describe('Máximo de resultados a devolver (default 20)')
        .optional(),
    },
    async ({
      query,
      customer,
      product,
      region,
      status,
      minTotal,
      maxTotal,
      limit,
    }) => {
      const normalizedQuery = query?.toLowerCase();
      const matches = dataset.filter((sale) => {
        if (customer && sale.customerName !== customer) return false;
        if (product && sale.productName !== product) return false;
        if (region && sale.region !== region) return false;
        if (status && sale.status !== status) return false;
        if (typeof minTotal === 'number' && sale.totalAmount < minTotal) return false;
        if (typeof maxTotal === 'number' && sale.totalAmount > maxTotal) return false;

        if (normalizedQuery) {
          const haystack = `${sale.customerName} ${sale.productName} ${sale.region} ${sale.status}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        }

        return true;
      });

      const capped = matches.slice(0, limit ?? 20);

      const response = buildPayload(capped, {
        query: {
          query: query ?? null,
          customer: customer ?? null,
          product: product ?? null,
          region: region ?? null,
          status: status ?? null,
          minTotal: minTotal ?? null,
          maxTotal: maxTotal ?? null,
          limit: limit ?? 20,
        },
        totalMatches: matches.length,
        returned: capped.length,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
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