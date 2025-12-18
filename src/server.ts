import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { createDatabasePool, type DbPool } from './backend/db';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine();
const poolPromise: Promise<DbPool> = createDatabasePool();
let cachedPool: DbPool | null = null;

async function getPool(): Promise<DbPool> {
  if (!cachedPool) {
    cachedPool = await poolPromise;
  }
  return cachedPool;
}

async function ensureSchema(pool: DbPool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('user','admin') NOT NULL DEFAULT 'user',
        name VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS listings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ownerId INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(12,2) NOT NULL DEFAULT 0,
        address VARCHAR(255) NOT NULL,
        allowDelivery BOOLEAN DEFAULT true,
        pickupOnly BOOLEAN DEFAULT false,
        deliveryCost DECIMAL(12,2) DEFAULT 0,
        hidden BOOLEAN DEFAULT false,
        imageData LONGTEXT,
        FOREIGN KEY(ownerId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        status ENUM('создано','в работе','в доставке','завершено','отменено') DEFAULT 'создано',
        note TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderId INT NOT NULL,
        listingId INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY(listingId) REFERENCES listings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`
  );

  const [existingAdmins] = await pool.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    ['admin@computer.market']
  );

  if ((existingAdmins as any[]).length === 0) {
    await pool.query('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)', [
      'admin@computer.market',
      'admin',
      'admin',
      'Администратор'
    ]);
  }
}

poolPromise.then((pool) => ensureSchema(pool)).catch((err) => console.error('Schema init failed', err));

app.use((req, res, next): void => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});
app.use(express.json());

app.get('/api/health', async (_req, res): Promise<void> => {
  try {
    const pool = await getPool();
    const [ping] = await pool.query('SELECT 1 AS ready');
    res.json({ status: 'ok', db: ping });
  } catch (error) {
    res.status(500).json({ status: 'error', error });
  }
});

app.post('/api/auth/register', async (req, res): Promise<void> => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name) {
    res.status(400).json({ message: 'Заполните все поля' });
    return;
  }
  try {
    const pool = await getPool();
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if ((existing as any[]).length) {
      res.status(409).json({ message: 'Email уже используется' });
      return;
    }

    const [result] = await pool.query(
      'INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)',
      [email, password, 'user', name]
    );
    res.status(201).json({ id: (result as any).insertId, email, name, role: 'user' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка регистрации', error });
  }
});

app.post('/api/auth/login', async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ message: 'Заполните поля' });
    return;
  }
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT id, email, role, name FROM users WHERE email = ? AND password = ? LIMIT 1',
      [email, password]
    );
    const users = rows as any[];
    if (!users.length) {
      res.status(401).json({ message: 'Неверные данные' });
      return;
    }
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка авторизации', error });
  }
});

app.get('/api/users', async (_req, res): Promise<void> => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT id, email, role, name FROM users ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Не удалось загрузить пользователей', error });
  }
});

app.patch('/api/users/:id/role', async (req, res): Promise<void> => {
  const role = req.body?.role;
  if (role !== 'user' && role !== 'admin') {
    res.status(400).json({ message: 'Роль' });
    return;
  }
  try {
    const pool = await getPool();
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params['id']]);
    res.json({ id: Number(req.params['id']), role });
  } catch (error) {
    res.status(500).json({ message: 'Не удалось обновить роль', error });
  }
});

app.get('/api/listings', async (_req, res): Promise<void> => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM listings ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Не удалось получить объявления', error });
  }
});

app.post('/api/listings', async (req, res): Promise<void> => {
  const listing = req.body ?? {};
  if (!listing.ownerId) {
    res.status(401).json({ message: 'Требуется авторизация' });
    return;
  }
  try {
    const pool = await getPool();
    const [result] = await pool.query(
      `INSERT INTO listings
        (ownerId, title, description, category, price, address, allowDelivery, pickupOnly, deliveryCost, hidden, imageData)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        listing.ownerId,
        listing.title,
        listing.description,
        listing.category,
        listing.price,
        listing.address,
        !!listing.allowDelivery,
        !!listing.pickupOnly,
        listing.deliveryCost ?? 0,
        !!listing.hidden,
        listing.imageData ?? null
      ]
    );
    res.status(201).json({ ...listing, id: (result as any).insertId });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка создания объявления', error });
  }
});

app.patch('/api/listings/:id', async (req, res): Promise<void> => {
  const id = req.params['id'];
  const payload = req.body ?? {};
  try {
    const pool = await getPool();
    await pool.query(
      `UPDATE listings SET title = ?, description = ?, category = ?, price = ?, address = ?, allowDelivery = ?,
        pickupOnly = ?, deliveryCost = ?, hidden = ?, imageData = ? WHERE id = ?`,
      [
        payload.title,
        payload.description,
        payload.category,
        payload.price,
        payload.address,
        !!payload.allowDelivery,
        !!payload.pickupOnly,
        payload.deliveryCost ?? 0,
        !!payload.hidden,
        payload.imageData ?? null,
        id
      ]
    );
    res.json({ ...payload, id: Number(id) });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка обновления объявления', error });
  }
});

app.delete('/api/listings/:id', async (req, res): Promise<void> => {
  try {
    const pool = await getPool();
    await pool.query('DELETE FROM listings WHERE id = ?', [req.params['id']]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Не удалось удалить объявление', error });
  }
});

app.get('/api/orders', async (req, res): Promise<void> => {
  const userId = req.query['userId'] as string | undefined;
  const isAdmin = req.query['admin'] === '1';
  try {
    const pool = await getPool();
    const [orders] = await pool.query(
      isAdmin || !userId
        ? 'SELECT * FROM orders ORDER BY id DESC'
        : 'SELECT * FROM orders WHERE userId = ? ORDER BY id DESC',
      isAdmin || !userId ? [] : [userId]
    );
    const [items] = await pool.query(
      'SELECT * FROM order_items ORDER BY orderId DESC'
    );
    const merged = (orders as any[]).map((order) => ({
      ...order,
      items: items
        .filter((i) => i.orderId === order.id)
        .map((i) => ({ listingId: i.listingId, quantity: i.quantity }))
    }));
    res.json(merged);
  } catch (error) {
    res.status(500).json({ message: 'Не удалось загрузить заказы', error });
  }
});

app.post('/api/orders', async (req, res): Promise<void> => {
  const { userId, items, note } = req.body ?? {};
  if (!userId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'Неверные данные заказа' });
    return;
  }
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orderResult] = await connection.query(
      'INSERT INTO orders (userId, status, note) VALUES (?, ?, ?)',
      [userId, 'создано', note ?? null]
    );
    const orderId = (orderResult as any).insertId;
    for (const item of items) {
      await connection.query(
        'INSERT INTO order_items (orderId, listingId, quantity) VALUES (?, ?, ?)',
        [orderId, item.listingId, item.quantity ?? 1]
      );
    }
    await connection.commit();
    res.status(201).json({ id: orderId, userId, items, status: 'создано', note });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Ошибка создания заказа', error });
  } finally {
    connection.release();
  }
});

app.patch('/api/orders/:id/status', async (req, res): Promise<void> => {
  const status = req.body?.status;
  const allowed = ['создано', 'в работе', 'в доставке', 'завершено', 'отменено'];
  if (!allowed.includes(status)) {
    res.status(400).json({ message: 'Неверный статус' });
    return;
  }
  try {
    const pool = await getPool();
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params['id']]);
    res.json({ id: Number(req.params['id']), status });
  } catch (error) {
    res.status(500).json({ message: 'Не удалось обновить статус', error });
  }
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
