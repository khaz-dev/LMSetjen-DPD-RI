from django.contrib import admin
from userauths.models import User, Profile, Admin, OrganizationUnit, Position

class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'date']

class AdminModelAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'department', 'is_super_admin', 'date_created']
    list_filter = ['is_super_admin', 'department', 'date_created']
    search_fields = ['user__email', 'full_name', 'department']

class UserAdmin(admin.ModelAdmin):
    list_display = ['email', 'full_name', 'is_admin', 'is_instructor', 'is_student', 'nip', 'is_active', 'date_joined']
    list_filter = ['is_admin', 'is_instructor', 'is_student', 'is_active', 'external_status', 'jenis_jabatan', 'date_joined']
    search_fields = ['email', 'full_name', 'username', 'nip', 'external_id']
    readonly_fields = ['external_id', 'external_created_at', 'external_updated_at', 'last_sync_date', 'roles', 'role', 'current_role']
    # ✨ PHASE 5: Hide authentication fields since we only use Google/SSO login
    # Users no longer authenticate with password - only via Google/SSO integration
    exclude = ['password', 'otp', 'refresh_token']

class OrganizationUnitAdmin(admin.ModelAdmin):
    list_display = ['name', 'external_id', 'created_at', 'updated_at']
    search_fields = ['name', 'external_id']
    readonly_fields = ['external_id']

class PositionAdmin(admin.ModelAdmin):
    list_display = ['name', 'external_id', 'created_at', 'updated_at']
    search_fields = ['name', 'external_id']
    readonly_fields = ['external_id']

admin.site.register(User, UserAdmin)
admin.site.register(Profile, ProfileAdmin)
admin.site.register(Admin, AdminModelAdmin)
admin.site.register(OrganizationUnit, OrganizationUnitAdmin)
admin.site.register(Position, PositionAdmin)
