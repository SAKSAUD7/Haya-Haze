"""Django settings for Haya & Haze.

Everything environment-specific comes from env vars (see .env.example). With no env at
all the project runs in a zero-dependency local mode: SQLite, in-memory cache, eager
Celery and console email.
"""
from datetime import timedelta
from pathlib import Path

import environ
from django.urls import reverse_lazy

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

DEBUG = env.bool("DEBUG", default=True)
SECRET_KEY = env("SECRET_KEY", default="dev-only-insecure-key-change-me-before-deploying-0000")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "backend"])
# Render sets these for every web service; trust its own hostname automatically.
RENDER_HOSTNAME = env("RENDER_EXTERNAL_HOSTNAME", default="")
if RENDER_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_HOSTNAME)
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000").rstrip("/")
BACKEND_URL = env("BACKEND_URL", default=env("RENDER_EXTERNAL_URL", default="http://localhost:8000")).rstrip("/")
# Serve uploaded media from Django itself. Fine for a demo; use S3 (below) for real traffic.
SERVE_MEDIA = env.bool("SERVE_MEDIA", default=DEBUG)

if not DEBUG and SECRET_KEY.startswith("dev-only"):
    raise RuntimeError("Set SECRET_KEY when DEBUG is False.")

INSTALLED_APPS = [
    # Admin theme must come before django.contrib.admin
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    "unfold.contrib.import_export",
    "unfold.contrib.simple_history",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "django.contrib.humanize",
    # Third party
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "import_export",
    "simple_history",
    # Wagtail
    "wagtail.contrib.forms",
    "wagtail.contrib.redirects",
    "wagtail.embeds",
    "wagtail.sites",
    "wagtail.users",
    "wagtail.snippets",
    "wagtail.documents",
    "wagtail.images",
    "wagtail.search",
    "wagtail.admin",
    "wagtail",
    "modelcluster",
    "taggit",
    # Project
    "apps.core",
    "apps.accounts",
    "apps.catalog",
    "apps.inventory",
    "apps.promotions",
    "apps.cart",
    "apps.orders",
    "apps.payments",
    "apps.shipping",
    "apps.reviews",
    "apps.returns",
    "apps.content",
    "apps.notifications",
    "apps.analytics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
    "wagtail.contrib.redirects.middleware.RedirectMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
SITE_ID = 1

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# --- Database / cache -------------------------------------------------------
DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")}
DATABASES["default"]["ATOMIC_REQUESTS"] = False
IS_POSTGRES = DATABASES["default"]["ENGINE"].endswith("postgresql")
if IS_POSTGRES:
    INSTALLED_APPS.append("django.contrib.postgres")
    DATABASES["default"]["CONN_MAX_AGE"] = env.int("CONN_MAX_AGE", default=60)
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REDIS_URL = env("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": REDIS_URL}}
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# --- Auth -------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_ADAPTER = "apps.accounts.adapters.AccountAdapter"
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": env("GOOGLE_CLIENT_ID", default=""),
            "secret": env("GOOGLE_CLIENT_SECRET", default=""),
            "key": "",
        },
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
    }
}

REST_AUTH = {
    "USE_JWT": True,
    "JWT_AUTH_COOKIE": "hh_access",
    "JWT_AUTH_REFRESH_COOKIE": "hh_refresh",
    "JWT_AUTH_HTTPONLY": True,
    "JWT_AUTH_SECURE": not DEBUG,
    "JWT_AUTH_SAMESITE": "Lax",
    "JWT_AUTH_COOKIE_USE_CSRF": True,
    "SESSION_LOGIN": False,
    "TOKEN_MODEL": None,
    "USER_DETAILS_SERIALIZER": "apps.accounts.serializers.UserSerializer",
    "OLD_PASSWORD_FIELD_ENABLED": True,
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# --- DRF --------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["dj_rest_auth.jwt_auth.JWTCookieAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="600/min"),
        "user": env("THROTTLE_USER", default="1200/min"),
        "auth": "20/min",
        "otp": "6/min",
        "checkout": "30/min",
        "forms": "10/min",
        "dj_rest_auth": "30/min",
    },
    "COERCE_DECIMAL_TO_STRING": True,
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
}
SPECTACULAR_SETTINGS = {
    "TITLE": "Haya & Haze API",
    "DESCRIPTION": "Storefront API for the Haya & Haze modest fashion store.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "ENUM_NAME_OVERRIDES": {
        "OrderStatusEnum": "apps.core.schema_enums.ORDER_STATUS",
        "PaymentStatusEnum": "apps.core.schema_enums.PAYMENT_STATUS",
        "ReturnStatusEnum": "apps.core.schema_enums.RETURN_STATUS",
        "ReturnKindEnum": "apps.core.schema_enums.RETURN_KIND",
        "ShipmentStatusEnum": "apps.core.schema_enums.SHIPMENT_STATUS",
        "MediaKindEnum": "apps.core.schema_enums.MEDIA_KIND",
    },
}

# --- CORS / CSRF / security --------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[FRONTEND_URL])
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[FRONTEND_URL, BACKEND_URL])
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SAMESITE = "Lax"
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
    SECURE_REDIRECT_EXEMPT = [r"^healthz/$"]  # platform health checks arrive over plain HTTP
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_CONTENT_TYPE_NOSNIFF = True

# --- I18N -------------------------------------------------------------------
LANGUAGE_CODE = "en-in"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# --- Static / media ---------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        if DEBUG
        else "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
if env("AWS_STORAGE_BUCKET_NAME", default=""):
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="ap-south-1")
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)
    AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default=None)
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default=None)
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default=None)
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "public, max-age=31536000"}
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024

# --- Email ------------------------------------------------------------------
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Haya & Haze <hello@hayaandhaze.com>")
ADMIN_NOTIFY_EMAIL = env("ADMIN_NOTIFY_EMAIL", default="hello@hayaandhaze.com")
if env("RESEND_API_KEY", default=""):
    INSTALLED_APPS.append("anymail")
    EMAIL_BACKEND = "anymail.backends.resend.EmailBackend"
    ANYMAIL = {"RESEND_API_KEY": env("RESEND_API_KEY")}
elif env("EMAIL_HOST", default=""):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("EMAIL_HOST")
    EMAIL_PORT = env.int("EMAIL_PORT", default=587)
    EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
    EMAIL_USE_TLS = True
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# --- Celery -----------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default=REDIS_URL or "memory://")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default=REDIS_URL or "cache+memory://")
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=not REDIS_URL)
CELERY_TASK_EAGER_PROPAGATES = False
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TIME_LIMIT = 120
CELERY_BEAT_SCHEDULE = {
    "release-expired-reservations": {
        "task": "apps.inventory.tasks.release_expired_reservations",
        "schedule": 120.0,
    },
    "abandoned-cart-recovery": {
        "task": "apps.notifications.tasks.send_abandoned_cart_emails",
        "schedule": 900.0,
    },
    "publish-scheduled-products": {
        "task": "apps.catalog.tasks.publish_scheduled_products",
        "schedule": 300.0,
    },
}

# --- Commerce ---------------------------------------------------------------
STOCK_RESERVATION_MINUTES = env.int("STOCK_RESERVATION_MINUTES", default=20)
ABANDONED_CART_HOURS = env.int("ABANDONED_CART_HOURS", default=4)
CART_COOKIE_NAME = "hh_cart"
CART_COOKIE_AGE = 60 * 60 * 24 * 60

RAZORPAY_KEY_ID = env("RAZORPAY_KEY_ID", default="")
RAZORPAY_KEY_SECRET = env("RAZORPAY_KEY_SECRET", default="")
RAZORPAY_WEBHOOK_SECRET = env("RAZORPAY_WEBHOOK_SECRET", default="")
STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY", default="")
STRIPE_PUBLISHABLE_KEY = env("STRIPE_PUBLISHABLE_KEY", default="")
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET", default="")
# Sandbox payments are only ever available in DEBUG with no Razorpay keys configured.
# Sandbox payments stand in for Razorpay when no keys are set: always in DEBUG, and in a
# deployed demo only when DEMO_PAYMENTS=True is set explicitly. Never with real keys.
PAYMENTS_SANDBOX = not RAZORPAY_KEY_ID and (DEBUG or env.bool("DEMO_PAYMENTS", default=False))

SHIPROCKET_EMAIL = env("SHIPROCKET_EMAIL", default="")
SHIPROCKET_PASSWORD = env("SHIPROCKET_PASSWORD", default="")
SHIPROCKET_PICKUP_LOCATION = env("SHIPROCKET_PICKUP_LOCATION", default="Primary")
SHIPROCKET_WEBHOOK_TOKEN = env("SHIPROCKET_WEBHOOK_TOKEN", default="")

META_PIXEL_ACCESS_TOKEN = env("META_PIXEL_ACCESS_TOKEN", default="")

# --- Wagtail ----------------------------------------------------------------
WAGTAIL_SITE_NAME = "Haya & Haze"
WAGTAILADMIN_BASE_URL = BACKEND_URL
WAGTAILDOCS_EXTENSIONS = ["pdf", "docx", "csv", "xlsx", "zip"]
WAGTAILIMAGES_EXTENSIONS = ["gif", "jpg", "jpeg", "png", "webp", "avif"]
WAGTAILSEARCH_BACKENDS = {"default": {"BACKEND": "wagtail.search.backends.database"}}

# --- Unfold admin -----------------------------------------------------------
UNFOLD = {
    "SITE_TITLE": "Haya & Haze Admin",
    "SITE_HEADER": "Haya & Haze",
    "SITE_SUBHEADER": "Store management",
    "SITE_SYMBOL": "styler",
    "SITE_URL": FRONTEND_URL,
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "BORDER_RADIUS": "10px",
    "DASHBOARD_CALLBACK": "apps.analytics.dashboard.dashboard_callback",
    "STYLES": [lambda request: "/static/admin-brand.css"],
    "COLORS": {
        # Warm mocha scale built around #7B4F3A / #C8A882
        "primary": {
            "50": "250 246 242",
            "100": "245 237 228",
            "200": "232 213 196",
            "300": "212 184 160",
            "400": "200 168 130",
            "500": "166 124 94",
            "600": "123 79 58",
            "700": "99 62 48",
            "800": "74 44 42",
            "900": "61 43 31",
            "950": "38 26 19",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "Overview",
                "items": [
                    {"title": "Dashboard", "icon": "dashboard", "link": reverse_lazy("admin:index")},
                    {"title": "Orders", "icon": "receipt_long", "link": reverse_lazy("admin:orders_order_changelist"),
                     "badge": "apps.analytics.dashboard.pending_orders_badge"},
                    {"title": "Returns", "icon": "assignment_return", "link": reverse_lazy("admin:returns_returnrequest_changelist"),
                     "badge": "apps.analytics.dashboard.pending_returns_badge"},
                ],
            },
            {
                "title": "Catalogue",
                "collapsible": True,
                "items": [
                    {"title": "Products", "icon": "checkroom", "link": reverse_lazy("admin:catalog_product_changelist")},
                    {"title": "Collections", "icon": "collections_bookmark", "link": reverse_lazy("admin:catalog_collection_changelist")},
                    {"title": "Categories", "icon": "category", "link": reverse_lazy("admin:catalog_category_changelist")},
                    {"title": "Inventory", "icon": "inventory_2", "link": reverse_lazy("admin:catalog_variant_changelist")},
                    {"title": "Stock movements", "icon": "swap_vert", "link": reverse_lazy("admin:inventory_stockmovement_changelist")},
                    {"title": "Back-in-stock requests", "icon": "notifications_active", "link": reverse_lazy("admin:inventory_backinstockrequest_changelist")},
                ],
            },
            {
                "title": "Customers",
                "collapsible": True,
                "items": [
                    {"title": "Customers", "icon": "group", "link": reverse_lazy("admin:accounts_user_changelist")},
                    {"title": "Reviews", "icon": "reviews", "link": reverse_lazy("admin:reviews_review_changelist"),
                     "badge": "apps.analytics.dashboard.pending_reviews_badge"},
                    {"title": "Contact inbox", "icon": "inbox", "link": reverse_lazy("admin:core_contactmessage_changelist")},
                ],
            },
            {
                "title": "Marketing",
                "collapsible": True,
                "items": [
                    {"title": "Coupons", "icon": "sell", "link": reverse_lazy("admin:promotions_coupon_changelist")},
                    {"title": "Gift cards", "icon": "card_giftcard", "link": reverse_lazy("admin:promotions_giftcard_changelist")},
                    {"title": "Abandoned carts", "icon": "remove_shopping_cart", "link": reverse_lazy("admin:cart_cart_changelist")},
                    {"title": "Subscribers", "icon": "mail", "link": reverse_lazy("admin:promotions_subscriber_changelist")},
                    {"title": "Announcements", "icon": "campaign", "link": reverse_lazy("admin:core_announcement_changelist")},
                ],
            },
            {
                "title": "Fulfilment",
                "collapsible": True,
                "items": [
                    {"title": "Shipments", "icon": "local_shipping", "link": reverse_lazy("admin:shipping_shipment_changelist")},
                    {"title": "Serviceable pincodes", "icon": "pin_drop", "link": reverse_lazy("admin:shipping_serviceablepincode_changelist")},
                    {"title": "Payments", "icon": "payments", "link": reverse_lazy("admin:payments_payment_changelist")},
                ],
            },
            {
                "title": "Content & settings",
                "collapsible": True,
                "items": [
                    {"title": "Content (CMS)", "icon": "edit_document", "link": "/cms/"},
                    {"title": "Store settings", "icon": "settings", "link": reverse_lazy("admin:core_sitesettings_changelist")},
                    {"title": "Staff & roles", "icon": "admin_panel_settings", "link": reverse_lazy("admin:auth_group_changelist")},
                    {"title": "Email log", "icon": "outgoing_mail", "link": reverse_lazy("admin:notifications_notificationlog_changelist")},
                ],
            },
        ],
    },
}

# --- Logging / Sentry -------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {"django.server": {"level": "WARNING"}},
}
if env("SENTRY_DSN", default=""):
    import sentry_sdk

    sentry_sdk.init(dsn=env("SENTRY_DSN"), traces_sample_rate=0.1, send_default_pii=False)
