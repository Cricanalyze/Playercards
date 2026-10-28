ROLES = ["super_admin", "admin", "user_manager", "subscription_manager", "moderator", "support", "user"]
DEFAULT_ROLE = "user"
RETIRED_ROLES = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}
STAFF_ROLES = [r for r in ROLES if r != "user"]

PERMISSIONS = {
    "analytics.view": "View dashboard analytics",
    "users.view": "View users",
    "users.manage": "Suspend, edit, soft-delete users",
    "subscriptions.view": "View subscriptions & payments",
    "subscriptions.manage": "Grant, extend, cancel subscriptions",
    "plans.manage": "Create and edit plans",
    "sports.manage": "Configure sports & statistics",
    "templates.manage": "Manage card templates",
    "moderation.manage": "Review moderation reports",
    "audit.view": "View audit logs",
    "admins.manage": "Invite admins & change roles",
}
ALL_PERMS = list(PERMISSIONS)

ROLE_DEFAULTS = {
    "super_admin": ALL_PERMS,
    "admin": [p for p in ALL_PERMS if p != "admins.manage"],
    "user_manager": ["analytics.view", "users.view", "users.manage", "subscriptions.view"],
    "subscription_manager": ["analytics.view", "users.view", "subscriptions.view", "subscriptions.manage", "plans.manage"],
    "moderator": ["users.view", "moderation.manage"],
    "support": ["users.view", "subscriptions.view"],
    "user": [],
}


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


def effective_perms(role: str, custom) -> list:
    if role == "super_admin":
        return ALL_PERMS
    if role == "user":
        return []
    allowed = set(ROLE_DEFAULTS[role]) | ({"admins.manage"} if role == "admin" else set())
    if custom is None:
        return ROLE_DEFAULTS[role]
    return [p for p in custom if p in PERMISSIONS and p in allowed]
