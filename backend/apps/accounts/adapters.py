from allauth.account.adapter import DefaultAccountAdapter


class AccountAdapter(DefaultAccountAdapter):
    """Accounts are created through our own API endpoints; allauth is only used for
    Google sign-in, where a new customer is created on first login."""

    def is_open_for_signup(self, request):
        return True
