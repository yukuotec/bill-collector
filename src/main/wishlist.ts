// Round 19: Purchase Wishlist with Price Tracking
import { getDatabase } from './database';

export interface WishlistItem {
  id: string;
  name: string;
  description: string;
  estimatedPrice: number;
  priority: 'low' | 'medium' | 'high';
  category: string;
  url?: string;
  addedAt: string;
  purchased: boolean;
  purchasedAt?: string;
}

export function addToWishlist(name: string, estimatedPrice: number, priority: 'low' | 'medium' | 'high', category: string, description?: string, url?: string): WishlistItem {
  const db = getDatabase();
  const id = `wish_${Date.now()}`;

  const stmt = db.prepare(`
    INSERT INTO wishlist (id, name, description, estimated_price, priority, category, url, added_at, purchased)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
  stmt.run([id, name, description || '', estimatedPrice, priority, category, url || '', new Date().toISOString()]);
  stmt.free();

  return {
    id,
    name,
    description: description || '',
    estimatedPrice,
    priority,
    category,
    url,
    addedAt: new Date().toISOString(),
    purchased: false,
  };
}

export function getWishlistTotal(): { total: number; byPriority: Record<string, number> } {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT priority, SUM(estimated_price) as total
    FROM wishlist
    WHERE purchased = 0
    GROUP BY priority
  `);

  const byPriority: Record<string, number> = {};
  let total = 0;

  while (stmt.step()) {
    const row = stmt.getAsObject() as { priority: string; total: number };
    byPriority[row.priority] = row.total;
    total += row.total;
  }
  stmt.free();

  return { total, byPriority };
}
