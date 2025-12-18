type QueryResult = [any[], any];

interface ConnectionLike {
  query<T = any[]>(sql: string, params?: any[]): Promise<QueryResult>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

export interface DbPool {
  query<T = any[]>(sql: string, params?: any[]): Promise<QueryResult>;
  getConnection(): Promise<ConnectionLike>;
}

class MemoryConnection implements ConnectionLike {
  constructor(private readonly store: MemoryStore) {}

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    return this.store.query(sql, params);
  }

  async beginTransaction(): Promise<void> {}
  async commit(): Promise<void> {}
  async rollback(): Promise<void> {}
  release(): void {}
}

class MemoryStore implements DbPool {
  private users: any[] = [];
  private listings: any[] = [];
  private orders: any[] = [];
  private orderItems: any[] = [];

  constructor() {
    this.users.push(
      { id: 1, email: 'admin@computer.market', password: 'admin', role: 'admin', name: 'Администратор' },
      { id: 2, email: 'demo@computer.market', password: 'demo', role: 'user', name: 'Тестовый пользователь' }
    );
    this.listings.push(
      {
        id: 1,
        ownerId: 1,
        title: 'Игровой ноутбук Falcon X17',
        description: 'RTX 4060, 32 ГБ RAM, SSD 1 ТБ. Отлично подходит для рендеринга и игр.',
        category: 'Ноутбуки',
        price: 180000,
        address: 'Москва, Тверская 12',
        allowDelivery: true,
        pickupOnly: false,
        deliveryCost: 1200,
        hidden: false
      },
      {
        id: 2,
        ownerId: 2,
        title: 'Механическая клавиатура Aurora',
        description: 'Hot-swap, тихие свитчи, RGB. Почти не использовалась.',
        category: 'Периферия',
        price: 8500,
        address: 'Санкт-Петербург, Невский 40',
        allowDelivery: true,
        pickupOnly: false,
        deliveryCost: 400,
        hidden: false
      }
    );
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    const normalized = sql.toLowerCase();
    if (normalized.startsWith('select 1 as ready')) {
      return [[{ ready: 1 }], {}];
    }
    if (normalized.includes('from users where email') && normalized.includes('limit 1')) {
      const email = params[0];
      const found = this.users.filter((u) => u.email === email);
      return [found, {}];
    }
    if (normalized.startsWith('select id, email, role, name from users')) {
      const rows = [...this.users].reverse().map((u) => ({ id: u.id, email: u.email, role: u.role, name: u.name }));
      return [rows, {}];
    }
    if (normalized.startsWith('insert into users')) {
      const [email, password, role, name] = params;
      const id = this.users.length ? Math.max(...this.users.map((u) => u.id)) + 1 : 1;
      this.users.push({ id, email, password, role, name });
      return [[], { insertId: id }];
    }
    if (normalized.startsWith('select id, email, role, name from users where email')) {
      const [email, password] = params;
      const found = this.users.filter((u) => u.email === email && u.password === password);
      return [found.map(({ password: _p, ...rest }) => rest), {}];
    }
    if (normalized.startsWith('update users set role')) {
      const [role, id] = params;
      this.users = this.users.map((u) => (u.id === Number(id) ? { ...u, role } : u));
      return [[], {}];
    }
    if (normalized.startsWith('select * from listings')) {
      return [[...this.listings].sort((a, b) => b.id - a.id), {}];
    }
    if (normalized.startsWith('insert into listings')) {
      const [ownerId, title, description, category, price, address, allowDelivery, pickupOnly, deliveryCost, hidden, imageData] = params;
      const id = this.listings.length ? Math.max(...this.listings.map((l) => l.id)) + 1 : 1;
      this.listings.push({
        id,
        ownerId,
        title,
        description,
        category,
        price,
        address,
        allowDelivery,
        pickupOnly,
        deliveryCost,
        hidden,
        imageData
      });
      return [[], { insertId: id }];
    }
    if (normalized.startsWith('update listings set')) {
      const [title, description, category, price, address, allowDelivery, pickupOnly, deliveryCost, hidden, imageData, id] = params;
      this.listings = this.listings.map((l) =>
        l.id === Number(id)
          ? { ...l, title, description, category, price, address, allowDelivery, pickupOnly, deliveryCost, hidden, imageData }
          : l
      );
      return [[], {}];
    }
    if (normalized.startsWith('delete from listings')) {
      const [id] = params;
      this.listings = this.listings.filter((l) => l.id !== Number(id));
      return [[], {}];
    }
    if (normalized.startsWith('select * from orders')) {
      if (normalized.includes('where userid = ?')) {
        const [userId] = params;
        return [this.orders.filter((o) => o.userId === Number(userId)).sort((a, b) => b.id - a.id), {}];
      }
      return [[...this.orders].sort((a, b) => b.id - a.id), {}];
    }
    if (normalized.startsWith('select * from order_items')) {
      return [[...this.orderItems].sort((a, b) => b.orderId - a.orderId), {}];
    }
    if (normalized.startsWith('insert into orders')) {
      const [userId, status, note] = params;
      const id = this.orders.length ? Math.max(...this.orders.map((o) => o.id)) + 1 : 1;
      this.orders.push({ id, userId, status, note, createdAt: new Date().toISOString() });
      return [[], { insertId: id }];
    }
    if (normalized.startsWith('insert into order_items')) {
      const [orderId, listingId, quantity] = params;
      const id = this.orderItems.length ? Math.max(...this.orderItems.map((o) => o.id)) + 1 : 1;
      this.orderItems.push({ id, orderId, listingId, quantity });
      return [[], { insertId: id }];
    }
    if (normalized.startsWith('update orders set status')) {
      const [status, id] = params;
      this.orders = this.orders.map((o) => (o.id === Number(id) ? { ...o, status } : o));
      return [[], {}];
    }

    return [[[]], {}];
  }

  async getConnection(): Promise<ConnectionLike> {
    return new MemoryConnection(this);
  }
}

export async function createDatabasePool(): Promise<DbPool> {
  const moduleName = 'mysql2/promise';
  try {
    // Dynamically import so build does not fail if mysql2 is unavailable in the environment.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mysql: any = await import(moduleName);
    return mysql.createPool({
      host: process.env['DB_HOST'] ?? 'localhost',
      user: process.env['DB_USER'] ?? 'root',
      password: process.env['DB_PASSWORD'] ?? 'password',
      database: process.env['DB_NAME'] ?? 'computer_market',
      port: Number(process.env['DB_PORT'] ?? 3306),
      waitForConnections: true,
      connectionLimit: 5
    });
  } catch (error) {
    console.warn('mysql2 not available, falling back to in-memory store', error);
    return new MemoryStore();
  }
}
