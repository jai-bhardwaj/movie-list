// Role hierarchy: admin > editor > viewer
const ROLE_LEVELS: Record<string, number> = {
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function hasPermission(userRole: string | null, requiredRole: string): boolean {
  if (!userRole) return false;
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 0);
}

// Permissions matrix
export const PERMISSIONS = {
  // Movies
  viewMovies: "viewer",
  addMovie: "editor",
  toggleMovie: "editor",
  reorderMovies: "editor",
  deleteMovie: "admin",
  // Members
  viewMembers: "viewer",
  inviteMember: "admin",
  removeMember: "admin",
  changeRole: "admin",
  // Workspace
  editWorkspace: "admin",
  deleteWorkspace: "admin",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(userRole: string | null, permission: Permission): boolean {
  return hasPermission(userRole, PERMISSIONS[permission]);
}
