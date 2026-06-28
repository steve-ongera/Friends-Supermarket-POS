"""
core/services/billing.py
Sales-quota / session lock-unlock logic.
"""

from django.utils import timezone

from ..models import SalesSession, Subscription


def get_or_create_active_session(user):
    """
    Returns the cashier's current ACTIVE session, or creates a new one
    (snapshotting the supermarket's package quota) if none exists.
    A LOCKED session is returned as-is so the caller can prompt for payment.
    """
    session = (
        SalesSession.objects.filter(cashier=user, supermarket=user.supermarket)
        .order_by("-started_at")
        .first()
    )
    if session and session.status in (SalesSession.Status.ACTIVE, SalesSession.Status.LOCKED):
        return session

    subscription = Subscription.objects.select_related("package").get(supermarket=user.supermarket)
    package = subscription.package

    return SalesSession.objects.create(
        supermarket=user.supermarket,
        cashier=user,
        package=package,
        sales_limit=package.daily_free_sales,
    )


def register_sale_against_session(session: SalesSession):
    """Increments the session's sale counter; flips to LOCKED if quota is hit."""
    session.increment_sale()
    return session


def unlock_new_session(payment):
    """
    Called from the M-Pesa callback once a SESSION_UNLOCK payment succeeds.
    Creates a fresh ACTIVE session for the cashier who initiated the payment.
    Uses the package stored on the payment (i.e. the one the user selected
    in the modal and actually paid for). Falls back to the supermarket's
    current subscription package if no package was specified.
    """
    user = payment.initiated_by

    if payment.package is not None:
        package = payment.package
    else:
        subscription = Subscription.objects.select_related("package").get(
            supermarket=payment.supermarket
        )
        package = subscription.package

    new_session = SalesSession.objects.create(
        supermarket=payment.supermarket,
        cashier=user,
        package=package,
        sales_limit=package.daily_free_sales,
        unlocked_by_payment=payment,
    )
    return new_session