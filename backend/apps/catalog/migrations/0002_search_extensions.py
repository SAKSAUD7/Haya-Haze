from django.db import migrations


def enable_trigram(apps, schema_editor):
    # Typo-tolerant search needs pg_trgm. SQLite (local mode) simply skips this.
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")


class Migration(migrations.Migration):
    dependencies = [("catalog", "0001_initial")]
    operations = [migrations.RunPython(enable_trigram, migrations.RunPython.noop)]
