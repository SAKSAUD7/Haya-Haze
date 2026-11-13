"""Run on every server start (see render.yaml):

    python manage.py boot

* Seeds the demo store, but only into an empty database, so edits made in the admin
  survive restarts.
* Forgets CMS image renditions whose files are gone. On hosts without a persistent disk
  (Render free plan) the media folder resets on every restart; Wagtail then redraws each
  rendition on first request instead of linking to a missing file.
"""
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Prepare the app on start-up: seed an empty database, drop stale image renditions."

    def handle(self, *args, **options):
        if not Product.objects.exists():
            self.stdout.write("Empty database: seeding the demo store.")
            call_command("seed_demo")
        else:
            self.stdout.write("Catalogue present: skipping the demo seed.")

        from wagtail.images import get_image_model

        stale = [
            r.pk
            for r in get_image_model().get_rendition_model().objects.only("id", "file")
            if not default_storage.exists(r.file.name)
        ]
        if stale:
            get_image_model().get_rendition_model().objects.filter(pk__in=stale).delete()
            self.stdout.write(f"Dropped {len(stale)} image rendition(s) whose files were missing.")
