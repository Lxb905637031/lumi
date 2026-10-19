import type { ClothingItem, CreateClothingInput, CursorPage } from '@lumi/contracts';
import { request } from '../../services/http-client';

export function listClothingItems(): Promise<ClothingItem[]> {
  return request<CursorPage<ClothingItem>>('/wardrobe/items').then((page) => page.items);
}

export function listClothingPage(cursor?: string): Promise<CursorPage<ClothingItem>> {
  return request('/wardrobe/items?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
}

export function createClothingItem(input: CreateClothingInput): Promise<ClothingItem> {
  return request('/wardrobe/items', { method: 'POST', data: input });
}

export function updateClothingItem(id: string, input: CreateClothingInput): Promise<ClothingItem> {
  return request(`/wardrobe/items/${id}`, { method: 'PATCH', data: input });
}

export function deleteClothingItem(id: string) {
  return request(`/wardrobe/items/${id}`, { method: 'DELETE' });
}
