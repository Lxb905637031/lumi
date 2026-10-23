import { SetMetadata } from '@nestjs/common';
import type { AdminPermission } from './admin-permissions';

export const PERMISSIONS_KEY = 'admin-permissions';
export const Permissions = (...permissions: AdminPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
