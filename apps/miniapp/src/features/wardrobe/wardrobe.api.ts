import type { ClothingItem, CreateClothingInput, CursorPage } from '@lumi/contracts';
import { request } from '../../services/http-client';

export function listClothingItems(): Promise<ClothingItem[]> {
  return request<CursorPage<ClothingItem>>('/wardrobe/items').then((page) => page.items);
}

export function createClothingItem(input: CreateClothingInput): Promise<ClothingItem> {
  return request('/wardrobe/items', { method: 'POST', data: input });
}
