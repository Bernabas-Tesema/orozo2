import type { User, UserRole } from './types';

/** People requesting interpretation: hospitals, courts, and other organizations. */
export const CLIENT_ROLE = 'client' as const satisfies UserRole;

/** People operating the service: interpreters, coordinators, and platform admins. */
export const STAFF_ROLES = ['interpreter', 'supervisor', 'platform_admin'] as const satisfies readonly UserRole[];

export function isClient(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === CLIENT_ROLE;
}

export function isStaff(user: Pick<User, 'role'> | null | undefined): boolean {
  return !!user && (STAFF_ROLES as readonly UserRole[]).includes(user.role);
}
