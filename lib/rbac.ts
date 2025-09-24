// Role-Based Access Control utilities
export type Permission =
  | "products:read"
  | "products:write"
  | "products:delete"
  | "orders:read"
  | "orders:write"
  | "orders:delete"
  | "users:read"
  | "users:write"
  | "users:delete"
  | "analytics:read"
  | "payments:read"
  | "payments:write"

export type Role = "admin" | "user" | "moderator"

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    "products:read",
    "products:write",
    "products:delete",
    "orders:read",
    "orders:write",
    "orders:delete",
    "users:read",
    "users:write",
    "users:delete",
    "analytics:read",
    "payments:read",
    "payments:write",
  ],
  moderator: ["products:read", "products:write", "orders:read", "orders:write", "users:read", "analytics:read"],
  user: ["products:read", "orders:read"],
}

export function hasPermission(userRole: Role, permission: Permission): boolean {
  return rolePermissions[userRole]?.includes(permission) || false
}

export function requirePermission(permission: Permission) {
  return (handler: (request: Request, user: any) => Promise<Response>) => {
    return async (request: Request, user: any) => {
      if (!hasPermission(user.role, permission)) {
        return Response.json({ error: "Insufficient permissions" }, { status: 403 })
      }
      return handler(request, user)
    }
  }
}

export function getUserPermissions(role: Role): Permission[] {
  return rolePermissions[role] || []
}
