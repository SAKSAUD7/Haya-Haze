from django.contrib import admin, messages
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from unfold.admin import ModelAdmin
from unfold.contrib.filters.admin import ChoicesDropdownFilter
from unfold.contrib.import_export.forms import ExportForm, ImportForm
from unfold.decorators import action, display

from . import services
from .models import ServiceablePincode, Shipment
from .providers import PROVIDERS, ShippingError


@admin.register(Shipment)
class ShipmentAdmin(ModelAdmin):
    list_display = ["order", "courier", "awb", "provider", "state", "created_at"]
    list_filter = [("status", ChoicesDropdownFilter), "provider"]
    search_fields = ["awb", "order__number"]
    list_select_related = ["order"]
    autocomplete_fields = ["order"]
    readonly_fields = ["raw"]
    actions = ["refresh_tracking"]

    @display(description="Status", label={"Delivered": "success", "Returned to origin": "danger", "Cancelled": "danger"})
    def state(self, obj):
        return obj.get_status_display()

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if "status" in form.changed_data:
            # A manual status edit moves the order too, exactly as a courier webhook would.
            status, obj.status = obj.status, form.initial.get("status", obj.status)
            Shipment.objects.filter(pk=obj.pk).update(status=obj.status)
            services.apply_tracking_update(obj.awb, status)

    @action(description="Refresh tracking from courier")
    def refresh_tracking(self, request, queryset):
        updated = 0
        for shipment in queryset.exclude(awb=""):
            provider = PROVIDERS.get(shipment.provider)
            if not provider or not provider.is_configured():
                continue
            try:
                status = provider.track(shipment.awb).get("status")
            except ShippingError as exc:
                self.message_user(request, f"{shipment.awb}: {exc}", messages.WARNING)
                continue
            if status and services.apply_tracking_update(shipment.awb, status):
                updated += 1
        self.message_user(request, f"{updated} shipment(s) updated.")


class PincodeResource(resources.ModelResource):
    class Meta:
        model = ServiceablePincode
        import_id_fields = ["pincode"]
        fields = ["pincode", "city", "state", "is_serviceable", "cod_available", "standard_days", "express_days"]
        skip_unchanged = True


@admin.register(ServiceablePincode)
class ServiceablePincodeAdmin(ImportExportModelAdmin, ModelAdmin):
    resource_classes = [PincodeResource]
    import_form_class = ImportForm
    export_form_class = ExportForm
    list_display = ["pincode", "city", "state", "is_serviceable", "cod_available", "standard_days", "express_days"]
    list_editable = ["is_serviceable", "cod_available"]
    list_filter = ["is_serviceable", "cod_available", "state"]
    search_fields = ["pincode", "city"]
    list_per_page = 100
    show_full_result_count = False
