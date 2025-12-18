import { Component, Signal, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface User {
  id: number;
  email: string;
  password: string;
  role: 'user' | 'admin';
  name: string;
}

interface Listing {
  id: number;
  ownerId: number;
  title: string;
  description: string;
  category: string;
  price: number;
  address: string;
  allowDelivery: boolean;
  pickupOnly: boolean;
  deliveryCost: number;
  hidden: boolean;
  imageData?: string;
}

interface CartItem {
  listingId: number;
  quantity: number;
}

interface Order {
  id: number;
  userId: number;
  items: CartItem[];
  status: 'создано' | 'в работе' | 'в доставке' | 'завершено' | 'отменено';
  createdAt: string;
  note?: string;
}

interface StoredState {
  users: User[];
  listings: Listing[];
  orders: Order[];
  nextIds: {
    user: number;
    listing: number;
    order: number;
  };
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly title = 'Computer Market — фронтенд-прототип';
  readonly categories = [
    'Ноутбуки',
    'Смартфоны',
    'Периферия',
    'Компоненты',
    'Сетевое оборудование',
    'Другое'
  ];

  private readonly storageKey = 'computer-market-sqlite';
  protected readonly users = signal<User[]>([]);
  protected readonly listings = signal<Listing[]>([]);
  protected readonly orders = signal<Order[]>([]);
  protected currentUser = signal<User | null>(null);
  protected cart = signal<CartItem[]>([]);

  protected authForm = { email: '', password: '', name: '' };
  protected newListing: Partial<Listing> = {
    title: '',
    description: '',
    category: this.categories[0],
    price: 0,
    address: '',
    allowDelivery: true,
    pickupOnly: false,
    deliveryCost: 0
  };
  protected searchTerm = '';
  protected categoryFilter = '';
  protected orderNote = '';
  protected forecastDays = 2;
  protected heroStats = signal({ listings: 0, orders: 0, users: 0 });

  protected readonly visibleListings: Signal<Listing[]> = computed(() => {
    const term = this.searchTerm.toLowerCase();
    const category = this.categoryFilter;
    const viewer = this.currentUser();

    return this.listings().filter((listing) => {
      const matchesTerm =
        listing.title.toLowerCase().includes(term) ||
        listing.description.toLowerCase().includes(term);
      const matchesCategory = !category || listing.category === category;
      const canView = !listing.hidden || viewer?.role === 'admin' || viewer?.id === listing.ownerId;
      return matchesTerm && matchesCategory && canView;
    });
  });

  constructor() {
    this.loadState();
    effect(() => {
      this.persistState();
      this.heroStats.set({
        listings: this.listings().length,
        orders: this.orders().length,
        users: this.users().length
      });
    });
  }

  private loadState(): void {
    if (!this.isBrowser()) {
      this.seedData();
      return;
    }
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      const parsed: StoredState = JSON.parse(raw);
      this.users.set(parsed.users ?? []);
      this.listings.set(parsed.listings ?? []);
      this.orders.set(parsed.orders ?? []);
      this.nextIds = { ...parsed.nextIds };
    } else {
      this.seedData();
    }
  }

  private persistState(): void {
    if (!this.isBrowser()) return;
    const payload: StoredState = {
      users: this.users(),
      listings: this.listings(),
      orders: this.orders(),
      nextIds: this.nextIds
    };
    localStorage.setItem(this.storageKey, JSON.stringify(payload));
  }

  private nextIds = { user: 1, listing: 1, order: 1 };

  private seedData(): void {
    const admin: User = {
      id: this.nextIds.user++,
      email: 'admin@computer.market',
      password: 'admin',
      role: 'admin',
      name: 'Администратор'
    };
    const demoUser: User = {
      id: this.nextIds.user++,
      email: 'demo@computer.market',
      password: 'demo',
      role: 'user',
      name: 'Тестовый пользователь'
    };
    const starterListings: Listing[] = [
      {
        id: this.nextIds.listing++,
        ownerId: admin.id,
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
        id: this.nextIds.listing++,
        ownerId: demoUser.id,
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
    ];

    this.users.set([admin, demoUser]);
    this.listings.set(starterListings);
    this.orders.set([]);
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  protected register(): void {
    const { email, password, name } = this.authForm;
    if (!email || !password || !name) return;
    if (this.users().some((u) => u.email === email)) return;
    const user: User = { id: this.nextIds.user++, email, password, role: 'user', name };
    this.users.update((list) => [...list, user]);
    this.currentUser.set(user);
    this.authForm = { email: '', password: '', name: '' };
  }

  protected login(): void {
    const { email, password } = this.authForm;
    const match = this.users().find((u) => u.email === email && u.password === password);
    if (match) {
      this.currentUser.set(match);
      this.authForm = { email: '', password: '', name: '' };
    }
  }

  protected logout(): void {
    this.currentUser.set(null);
    this.cart.set([]);
  }

  protected addListing(): void {
    const owner = this.currentUser();
    if (!owner) return;
    if (!this.newListing.title || !this.newListing.description || !this.newListing.address) return;

    const listing: Listing = {
      id: this.nextIds.listing++,
      ownerId: owner.id,
      title: this.newListing.title!,
      description: this.newListing.description!,
      category: this.newListing.category ?? this.categories[0],
      price: Number(this.newListing.price) || 0,
      address: this.newListing.address!,
      allowDelivery: !!this.newListing.allowDelivery,
      pickupOnly: !!this.newListing.pickupOnly,
      deliveryCost: Number(this.newListing.deliveryCost) || 0,
      hidden: !!this.newListing.hidden,
      imageData: this.newListing.imageData
    };

    this.listings.update((list) => [listing, ...list]);
    this.resetListingForm();
  }

  private resetListingForm(): void {
    this.newListing = {
      title: '',
      description: '',
      category: this.categories[0],
      price: 0,
      address: '',
      allowDelivery: true,
      pickupOnly: false,
      deliveryCost: 0,
      hidden: false,
      imageData: undefined
    };
  }

  protected toggleListingVisibility(listing: Listing): void {
    this.listings.update((items) =>
      items.map((l) => (l.id === listing.id ? { ...l, hidden: !l.hidden } : l))
    );
  }

  protected handleImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.newListing.imageData = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  protected addToCart(listing: Listing): void {
    if (!this.currentUser()) return;
    this.cart.update((items) => {
      const existing = items.find((item) => item.listingId === listing.id);
      if (existing) {
        return items.map((item) =>
          item.listingId === listing.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...items, { listingId: listing.id, quantity: 1 }];
    });
  }

  protected removeFromCart(listingId: number): void {
    this.cart.update((items) => items.filter((item) => item.listingId !== listingId));
  }

  protected listingById(id: number): Listing | undefined {
    return this.listings().find((l) => l.id === id);
  }

  protected cartTotal(): number {
    return this.cart().reduce((total, item) => {
      const listing = this.listings().find((l) => l.id === item.listingId);
      if (!listing) return total;
      return total + listing.price * item.quantity + (listing.deliveryCost ?? 0);
    }, 0);
  }

  protected placeOrder(): void {
    const user = this.currentUser();
    if (!user || this.cart().length === 0) return;
    const order: Order = {
      id: this.nextIds.order++,
      userId: user.id,
      items: this.cart(),
      status: 'создано',
      createdAt: new Date().toISOString(),
      note: this.orderNote
    };
    this.orders.update((items) => [order, ...items]);
    this.cart.set([]);
    this.orderNote = '';
  }

  protected userOrders(): Order[] {
    const user = this.currentUser();
    if (!user) return [];
    if (user.role === 'admin') return this.orders();
    return this.orders().filter((o) => o.userId === user.id);
  }

  protected updateOrderStatus(orderId: number, status: Order['status']): void {
    this.orders.update((items) => items.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }

  protected setRole(userId: number, role: User['role']): void {
    this.users.update((items) => items.map((u) => (u.id === userId ? { ...u, role } : u)));
    if (this.currentUser()?.id === userId) {
      const updated = this.users().find((u) => u.id === userId) ?? null;
      this.currentUser.set(updated);
    }
  }

  protected deleteListing(id: number): void {
    this.listings.update((items) => items.filter((l) => l.id !== id));
    this.cart.update((items) => items.filter((i) => i.listingId !== id));
  }

  protected ownedListings(): Listing[] {
    const user = this.currentUser();
    if (!user) return [];
    if (user.role === 'admin') return this.listings();
    return this.listings().filter((l) => l.ownerId === user.id);
  }

  protected deliveryForecast(listing: Listing): string {
    if (listing.pickupOnly) {
      return 'Только самовывоз';
    }
    const base = this.forecastDays;
    const distanceBias = listing.deliveryCost > 1000 ? 1 : 0;
    return `${base + distanceBias}-4 дня`;
  }
}
