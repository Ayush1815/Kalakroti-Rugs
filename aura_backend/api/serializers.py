from rest_framework import serializers
from .models import (
    Address,
    Category,
    Coupon,
    CustomerProfile,
    Notification,
    Order,
    PaymentMethod,
    Product,
    ProductImage,
    ProductVariant,
    Review,
    SupportTicket,
    Tag,
    CartItem,
    WishlistItem,
)

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image_url', 'alt_text', 'order']

class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ['id', 'size', 'price', 'discount_price', 'stock_quantity']

class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['id', 'customer_name', 'rating', 'comment', 'created_at']

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'image_url', 'order']

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name']

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_slug = serializers.ReadOnlyField(source='category.slug')
    gallery = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    reviews = ReviewSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    price_display = serializers.ReadOnlyField()
    discounted_price_display = serializers.ReadOnlyField()

    class Meta:
        model = Product
        fields = '__all__'

class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = '__all__'

class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = '__all__'

class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'quantity', 'added_at']

class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = WishlistItem
        fields = ['id', 'product', 'added_at']

class CustomerProfileSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = CustomerProfile
        fields = ['id', 'name', 'email', 'avatar_url', 'phone', 'marketing_opt_in', 'default_address']

    def get_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.username

class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ['id', 'label', 'recipient_name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode', 'country', 'is_default', 'created_at', 'updated_at']

class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id', 'method_type', 'label', 'provider', 'last4', 'is_default', 'created_at']

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'notification_type', 'read', 'created_at']

class SupportTicketSerializer(serializers.ModelSerializer):
    order_id = serializers.CharField(source='order.order_id', read_only=True)

    class Meta:
        model = SupportTicket
        fields = ['id', 'subject', 'message', 'order', 'order_id', 'status', 'created_at', 'updated_at']
