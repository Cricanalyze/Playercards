"""Every email FlexoCards sends. Each builder returns subject + render() kwargs."""


def _t(subject, heading, paras, cta=None, details=None, eyebrow="", code=""):
    return {"subject": subject, "heading": heading, "paras": paras, "cta": cta, "details": details, "eyebrow": eyebrow, "code": code}


def welcome(name: str):
    return _t("Welcome to FlexoCards", f"Welcome, {name or 'player'}!",
              ["Your FlexoCards account is ready. Pick your sport, add a photo and stats, and make a player card that looks like you belong on the big stage.",
               "Your Free plan includes 2 card downloads or shares every month. Credits reset on the 1st."],
              ("Create my first card", "/create"), [("Plan", "Free"), ("Cards per month", 2), ("Sports", "60+")], "Account created")


def receipt(plan: str, cycle: str, amount, cards, end: str, payment_id: str):
    return _t(f"Your FlexoCards {plan} plan is active", f"{plan} plan activated",
              ["Thanks for upgrading! Your payment went through and your new plan is ready to use.",
               "Paid plans unlock premium templates, public share links and 6-hour card editing."],
              ("Create a card", "/create"),
              [("Plan", f"{plan} · {'Monthly' if cycle == 'month' else 'Yearly'}"), ("Amount paid", f"₹{amount}"),
               ("Cards per month", cards), ("Active until", end), ("Payment ID", payment_id)], "Payment receipt")


def purchase(item: str, amount, details: list, payment_id: str):
    return _t(f"FlexoCards receipt: {item}", "Purchase complete",
              ["Thanks! Your purchase is ready to use right away.", "Your invoice is available in your dashboard under Payments."],
              ("Create a card", "/create"), [("Item", item), ("Amount paid", f"₹{amount}"), *details, ("Payment ID", payment_id)], "Payment receipt")


def storybook_reminder(until: str):
    return _t("Your FlexoCards Storybook ends soon", "Your storybook ends in 3 days",
              [f"Your Storybook add-on ends on {until}. After that, new cards you download won't be added to it.",
               "Renew now to keep adding cards. Renewing adds time on top of what you have left, so you lose nothing."],
              ("Renew my storybook", "/storybook"), [("Ends on", until)], "Storybook reminder")


def referral_reward(cards: int, friend: str):
    return _t("You earned free FlexoCards credits", f"+{cards} free cards",
              [f"{friend or 'A friend'} joined FlexoCards with your invite link, so you both got {cards} bonus card downloads.",
               "Bonus cards never expire and are used after your monthly credits run out."], ("Create a card", "/create"), eyebrow="Referral reward")


def admin_invite(inviter: str, role: str, expires: str, token: str):
    return _t("You're invited to the FlexoCards admin team", "Join the admin team",
              [f"{inviter or 'A FlexoCards admin'} invited you to help run FlexoCards.",
               "Sign in with this email address to accept. The invitation works once."],
              ("Accept invitation", f"/invite/{token}"), [("Role", role.replace("_", " ").title()), ("Expires", expires)], "Admin invitation")


def blog_published(title: str, slug: str):
    return _t("Your FlexoCards blog post is live", "Your post is published",
              [f"Good news! “{title}” is now live on the FlexoCards blog.", "Share it with your team and friends."],
              ("Read your post", f"/blog/{slug}"), eyebrow="Blog")


def blog_rejected(title: str, note: str):
    return _t("Update on your FlexoCards blog post", "Changes needed",
              [f"An admin reviewed “{title}” and sent it back to you.", "Edit the post and submit it again when it's ready."],
              ("Open my posts", "/write"), [("Admin note", note or "No note added.")], "Blog review")


def blog_author():
    return _t("You can now write for the FlexoCards blog", "You're a blog author",
              ["An admin gave you access to write posts for the FlexoCards blog.", "Your posts are reviewed by an admin before they go live."],
              ("Write a post", "/write/new"), eyebrow="Blog")


def test_email(provider: str, from_name: str):
    return _t("FlexoCards test email", "Your email is working",
              ["This is a test from your FlexoCards admin panel.", "Receipts, sign-in codes, invitations and blog notifications are sent the same way."],
              ("Open admin panel", "/admin/settings"), [("Provider", provider), ("Sender name", from_name)], "Test email")


AUTH_CODE = {
    "verification_code": ("Your FlexoCards verification code", "Verify your email", "Use this code to finish signing in to FlexoCards."),
    "reset_password_code": ("Reset your FlexoCards password", "Reset your password", "Use this code to set a new password for your FlexoCards account."),
}
AUTH_LINK = {
    "magic_link_sign_in": ("Sign in to FlexoCards", "Sign in to FlexoCards", "Tap the button below to sign in. The link works once.", "Sign in"),
    "magic_link_sign_up": ("Finish creating your FlexoCards account", "Finish signing up", "Tap the button below to finish creating your account.", "Finish sign-up"),
    "magic_link_verify": ("Verify your FlexoCards email", "Verify your email", "Tap the button below to verify your email address.", "Verify email"),
    "invitation": ("You're invited to FlexoCards", "You're invited", "You've been invited to join FlexoCards. Tap below to create your account.", "Accept invite"),
}
SECURITY = {
    "password_changed": ("Your FlexoCards password was changed", "Password changed", "The password for your FlexoCards account was just changed."),
    "password_removed": ("Your FlexoCards password was removed", "Password removed", "The password on your FlexoCards account was removed."),
    "primary_email_address_changed": ("Your FlexoCards email was changed", "Email address changed", "The main email address on your FlexoCards account was changed."),
    "new_device_sign_in": ("New sign-in to your FlexoCards account", "New sign-in detected", "Your FlexoCards account was just signed in to from a new device."),
}


def auth_code(slug: str, code: str, minutes=None):
    subject, heading, line = AUTH_CODE.get(slug, ("Your FlexoCards code", "Your code", "Use this code to continue on FlexoCards."))
    return _t(subject, heading, [line, f"This code expires in {minutes or 10} minutes. If you didn't ask for it, you can ignore this email."],
              eyebrow="Security code", code=code)


def auth_link(slug: str, url: str):
    subject, heading, line, label = AUTH_LINK.get(slug, ("FlexoCards account", "Continue to FlexoCards", "Tap the button below to continue.", "Continue"))
    return _t(subject, heading, [line, "If you didn't ask for this, you can ignore this email."], (label, url), eyebrow="Account")


def security_notice(slug: str, subject_fallback: str = "FlexoCards account update"):
    subject, heading, line = SECURITY.get(slug, (subject_fallback, "Account update", "There was a change to your FlexoCards account."))
    return _t(subject, heading, [line, "If this was you, no action is needed. If not, reset your password and contact FlexoCards support right away."],
              ("Open FlexoCards", "/"), eyebrow="Security notice")


SAMPLES = {
    "welcome": ("Welcome (new account)", lambda: welcome("Virat")),
    "verification_code": ("Sign-in / verification code", lambda: auth_code("verification_code", "424242", 10)),
    "reset_password_code": ("Password reset code", lambda: auth_code("reset_password_code", "731905", 10)),
    "magic_link_sign_in": ("Magic sign-in link", lambda: auth_link("magic_link_sign_in", "/sign-in")),
    "password_changed": ("Password changed notice", lambda: security_notice("password_changed")),
    "new_device_sign_in": ("New device sign-in notice", lambda: security_notice("new_device_sign_in")),
    "receipt": ("Payment receipt", lambda: receipt("Pro", "month", 45, 15, "2026-12-01", "pay_SAMPLE12345")),
    "admin_invite": ("Admin invitation", lambda: admin_invite("FlexoCards Owner", "admin", "2026-11-01", "sample-token")),
    "blog_published": ("Blog post published", lambda: blog_published("10 tips for a killer cricket card", "sample-post")),
    "blog_rejected": ("Blog post needs changes", lambda: blog_rejected("My first post", "Please add a cover image and fix the title.")),
    "blog_author": ("Blog access granted", blog_author),
    "purchase": ("Add-on purchase receipt", lambda: purchase("Storybook add-on (90 days)", 69, [("Storybook active until", "2027-02-01")], "pay_SAMPLE12345")),
    "storybook_reminder": ("Storybook ending reminder", lambda: storybook_reminder("2026-12-01")),
    "referral_reward": ("Referral reward", lambda: referral_reward(2, "Rohit")),
}
