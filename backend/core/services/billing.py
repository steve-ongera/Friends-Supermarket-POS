"""
core/services/billing.py
Sales-quota / session lock-unlock logic — stackable subscription model.

How the stack works (like mobile data bundles):
  - Each paid subscription purchase = one Subscription row with sales_remaining.
  - ACTIVE  -> currently being consumed.
  - QUEUED  -> paid and waiting in line.
  - EXPIRED -> fully consumed or past hard expiry.

  When a sale is made:
    1. Deduct 1 from the ACTIVE subscription's sales_remaining.
    2. If it hits 0 -> mark EXPIRED, promote oldest QUEUED to ACTIVE.
    3. If no QUEUED exists -> session locks (no quota left at all).

  When a new subscription is purchased (payment confirmed):
    - If no ACTIVE exists -> immediately ACTIVE.
    - If an ACTIVE exists -> joins queue (QUEUED).
    - Either way, the cashier's session stays ACTIVE — no interruption.
"""

from django.db import transaction
from django.utils import timezone

from ..models import SalesSession, Subscription, Package


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_active_subscription(supermarket):
    """Return the current ACTIVE subscription for this supermarket, or None."""
    return (
        Subscription.objects.select_for_update()
        .filter(supermarket=supermarket, status=Subscription.Status.ACTIVE)
        .first()
    )


def _promote_next_queued(supermarket):
    """
    Promote the oldest QUEUED subscription to ACTIVE.
    Returns the newly promoted Subscription, or None if the queue is empty.
    """
    next_sub = (
        Subscription.objects.select_for_update()
        .filter(supermarket=supermarket, status=Subscription.Status.QUEUED)
        .order_by("created_at")
        .first()
    )
    if next_sub:
        next_sub.status = Subscription.Status.ACTIVE
        next_sub.started_at = timezone.now()
        next_sub.save(update_fields=["status", "started_at"])
    return next_sub


def _has_quota(supermarket):
    """
    Returns True if the supermarket has at least one sale available
    (either unlimited ACTIVE sub, or ACTIVE sub with sales_remaining > 0).
    """
    active = (
        Subscription.objects.filter(
            supermarket=supermarket, status=Subscription.Status.ACTIVE
        ).first()
    )
    if not active:
        return False
    if active.is_unlimited:
        return True
    return active.sales_remaining > 0


# ---------------------------------------------------------------------------
# Public API used by views
# ---------------------------------------------------------------------------

def get_or_create_active_session(user):
    """
    Returns the cashier's current ACTIVE or LOCKED session.
    Creates a new one if none exists.

    Session LOCKED means the entire subscription stack is empty (no quota
    anywhere — not just the current bundle exhausted).
    """
    session = (
        SalesSession.objects.filter(
            cashier=user,
            supermarket=user.supermarket,
        )
        .order_by("-started_at")
        .first()
    )

    if session and session.status in (
        SalesSession.Status.ACTIVE, SalesSession.Status.LOCKED
    ):
        # Re-check: if it was LOCKED but a new subscription was purchased
        # in the meantime, reopen it.
        if session.status == SalesSession.Status.LOCKED and _has_quota(user.supermarket):
            session.status = SalesSession.Status.ACTIVE
            session.locked_at = None
            session.save(update_fields=["status", "locked_at"])
        return session

    # No current session — create one.
    # Use the active subscription's package if available, otherwise the
    # first active package as a fallback.
    active_sub = (
        Subscription.objects.filter(
            supermarket=user.supermarket, status=Subscription.Status.ACTIVE
        ).select_related("package").first()
    )
    package = active_sub.package if active_sub else (
        Package.objects.filter(is_active=True).first()
    )

    return SalesSession.objects.create(
        supermarket=user.supermarket,
        cashier=user,
        package=package,
        sales_limit=package.daily_free_sales if package else None,
    )


@transaction.atomic
def register_sale_against_session(session: SalesSession):
    """
    Called after every successful sale.

    1. Increments the session sale counter (audit only).
    2. Deducts 1 from the ACTIVE subscription's sales_remaining.
    3. If that subscription is now exhausted:
         a. Promotes the next QUEUED subscription to ACTIVE (if any).
         b. If none -> locks the session.
    """
    session.increment_sale()

    supermarket = session.supermarket
    active_sub = _get_active_subscription(supermarket)

    if active_sub is None:
        # No subscription at all — lock.
        _lock_session(session)
        return session

    if active_sub.is_unlimited:
        # Unlimited package — never exhausts.
        return session

    exhausted = active_sub.consume_sale()

    if exhausted:
        # Try to promote the next queued subscription.
        promoted = _promote_next_queued(supermarket)
        if not promoted:
            # Queue empty — lock the session.
            _lock_session(session)
        # If promoted: session stays ACTIVE, next sale draws from new sub.

    return session


def _lock_session(session: SalesSession):
    session.status = SalesSession.Status.LOCKED
    session.locked_at = timezone.now()
    session.save(update_fields=["status", "locked_at"])


@transaction.atomic
def add_subscription_to_stack(payment):
    """
    Called from the M-Pesa callback once a SUBSCRIPTION or SESSION_UNLOCK
    payment succeeds.

    - Creates a new Subscription row for the purchased package.
    - If no ACTIVE subscription exists -> activates immediately.
    - If an ACTIVE subscription already exists -> queues it (stack).
    - If the cashier's session was LOCKED -> reopens it (quota now available).

    This is the equivalent of buying a new data bundle on top of an
    existing one — the current bundle keeps running uninterrupted, and
    the new one waits in line.
    """
    supermarket = payment.supermarket
    package = payment.package

    if package is None:
        # Fallback: use the supermarket's first active package.
        package = Package.objects.filter(is_active=True).first()

    if package is None:
        return None  # Nothing to do — no package configured.

    sales_allocated = package.daily_free_sales or 0  # 0 = unlimited handled separately

    has_active = Subscription.objects.filter(
        supermarket=supermarket, status=Subscription.Status.ACTIVE
    ).exists()

    new_status = Subscription.Status.QUEUED if has_active else Subscription.Status.ACTIVE
    started_at = timezone.now() if not has_active else None

    new_sub = Subscription.objects.create(
        supermarket=supermarket,
        package=package,
        sales_allocated=sales_allocated,
        sales_remaining=sales_allocated,
        status=new_status,
        started_at=started_at,
        payment=payment,
    )

    # If any cashier session for this supermarket is currently LOCKED,
    # reopen it — new quota is available.
    if new_status == Subscription.Status.ACTIVE:
        SalesSession.objects.filter(
            supermarket=supermarket,
            status=SalesSession.Status.LOCKED,
        ).update(status=SalesSession.Status.ACTIVE, locked_at=None)

    return new_sub


# ---------------------------------------------------------------------------
# Legacy alias — kept so existing imports in views.py don't break.
# SESSION_UNLOCK payments now go through add_subscription_to_stack too.
# ---------------------------------------------------------------------------

def unlock_new_session(payment):
    """
    Legacy entry point called from mpesa_callback for SESSION_UNLOCK purpose.
    Now delegates to add_subscription_to_stack so the quota is added to the
    stack rather than replacing the current session.
    """
    return add_subscription_to_stack(payment)