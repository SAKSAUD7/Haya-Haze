from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.contrib.filters.admin import RangeDateFilter
from unfold.decorators import display

from .models import NotificationLog


@admin.register(NotificationLog)
class NotificationLogAdmin(ModelAdmin):
    list_display = ["created_at", "channel", "template", "recipient", "reference", "state"]
    list_filter = ["channel", "template", "success", ("created_at", RangeDateFilter)]
    list_filter_submit = True
    search_fields = ["recipient", "reference", "subject"]
    list_per_page = 60
    show_full_result_count = False

    @display(description="Result", label={"Sent": "success", "Failed": "danger"})
    def state(self, obj):
        return "Sent" if obj.success else "Failed"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
