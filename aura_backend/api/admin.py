from django.contrib import admin
from .models import (
    Address,
    Category,
    Collection,
    Coupon,
    CustomerProfile,
    Notification,
    Order,
    PaymentMethod,
    Product,
    ProductImage,
    SupportTicket,
    Tag,
)

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order')
    prepopulated_fields = {'slug': ('name',)}

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'price', 'stock_status', 'is_featured', 'status')
    list_filter = ('category', 'status', 'is_featured', 'is_limited_edition', 'weave_type')
    search_fields = ('title', 'sku', 'description')
    prepopulated_fields = {'slug': ('title',)}
    inlines = [ProductImageInline]
    
    fieldsets = (
        ('Core Information', {
            'fields': ('title', 'slug', 'category', 'collection', 'short_description', 'description')
        }),
        ('Pricing & Inventory', {
            'fields': ('price', 'discount_price', 'sku', 'stock_quantity', 'stock_status')
        }),
        ('Media', {
            'fields': ('main_image', 'hover_image', 'video_url')
        }),
        ('Rug Specifications', {
            'fields': ('size', 'material', 'weave_type', 'knot_density', 'pile_height', 'origin', 'color_palette', 'pattern_style')
        }),
        ('Merchandising', {
            'fields': ('is_featured', 'is_new_arrival', 'is_best_seller', 'is_limited_edition')
        }),
        ('Story & USP', {
            'fields': ('charity_tag', 'craft_story', 'region_story')
        }),
        ('SEO', {
            'fields': ('meta_title', 'meta_description', 'tags')
        }),
        ('Shipping', {
            'fields': ('weight', 'delivery_time')
        }),
        ('Controls', {
            'fields': ('status',)
        }),
    )

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'customer_name', 'status', 'total_amount', 'created_at')
    list_filter = ('status', 'created_at')

admin.site.register(Collection)
admin.site.register(Tag)
admin.site.register(Coupon)

@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone', 'marketing_opt_in', 'updated_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'phone', 'google_sub')

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('recipient_name', 'user', 'city', 'pincode', 'is_default')
    list_filter = ('is_default', 'city', 'state')
    search_fields = ('recipient_name', 'user__email', 'phone', 'pincode')

@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ('label', 'user', 'method_type', 'provider', 'last4', 'is_default')
    list_filter = ('method_type', 'is_default')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'notification_type', 'read', 'created_at')
    list_filter = ('notification_type', 'read')
    search_fields = ('title', 'message', 'user__email')

@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ('subject', 'user', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('subject', 'message', 'user__email')
