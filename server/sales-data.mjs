const CUSTOMERS = [
  'Acme Corp',
  'Globex',
  'Initech',
  'Soylent',
  'Umbrella',
  'Stark Industries',
  'Wayne Enterprises',
  'Wonka Industries',
  'Oscorp',
  'Tyrell Corp'
];

const PRODUCTS = [
  'MCP Gateway',
  'MCP Analytics Suite',
  'MCP Pro License',
  'MCP Starter Pack',
  'MCP Monitoring',
  'MCP Security Add-on',
  'MCP Mobile',
  'MCP Integrations Bundle'
];

const REGIONS = ['Norte', 'Sur', 'Este', 'Oeste', 'Centro'];
const STATUSES = ['Completed', 'Pending', 'Cancelled'];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (items) => items[randomInt(0, items.length - 1)];

const randomDateWithinDays = (days) => {
  const now = new Date();
  const pastOffset = randomInt(0, days);
  const date = new Date(now);
  date.setDate(now.getDate() - pastOffset);
  date.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59), 0);
  return date;
};

export const generateSales = (count = 100) => {
  return Array.from({ length: count }, (_, index) => {
    const quantity = randomInt(1, 25);
    const unitPrice = randomInt(50, 750);
    const status = randomItem(STATUSES);

    return {
      id: `SALE-${String(index + 1).padStart(4, '0')}`,
      customerName: randomItem(CUSTOMERS),
      productName: randomItem(PRODUCTS),
      region: randomItem(REGIONS),
      quantity,
      unitPrice,
      totalAmount: Number((quantity * unitPrice).toFixed(2)),
      saleDate: randomDateWithinDays(120).toISOString(),
      status
    };
  });
};