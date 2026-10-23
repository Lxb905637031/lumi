import { UserRole } from '@prisma/client';

export const adminPermissions = [
  'MODERATION_READ',
  'MODERATION_WRITE',
  'MEDIA_REVIEW_READ',
  'MEDIA_REVIEW_WRITE',
  'REPORT_READ',
  'REPORT_RESOLVE',
  'OPERATIONS_OVERVIEW_READ',
  'AUDIT_READ',
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

const allPermissions = new Set<AdminPermission>(adminPermissions);

const rolePermissions: Record<UserRole, ReadonlySet<AdminPermission>> = {
  [UserRole.USER]: new Set(),
  [UserRole.MODERATOR]: new Set([
    'MODERATION_READ',
    'MODERATION_WRITE',
    'MEDIA_REVIEW_READ',
    'MEDIA_REVIEW_WRITE',
    'REPORT_READ',
    'REPORT_RESOLVE',
    'OPERATIONS_OVERVIEW_READ',
  ]),
  [UserRole.ADMIN]: allPermissions,
};

export function hasAdminPermission(role: UserRole, permission: AdminPermission): boolean {
  return rolePermissions[role].has(permission);
}
