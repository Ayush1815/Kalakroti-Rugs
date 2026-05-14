from django.db import models
import django.utils.timezone
from django.utils.text import slugify
from django.contrib.auth.models import User

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    image_url = models.URLField(help_text="Main visual for category cards")
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']
        verbose_name_plural = "Categories"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Collection(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True)

    def __str__(self):
        return self.name

class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    def __str__(self):
        return self.name

class Product(models.Model):
    STATUS_CHOICES = [('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')]
    STOCK_STATUS = [('in_stock', 'In Stock'), ('out_of_stock', 'Out of Stock'), ('limited', 'Limited Edition')]
    WEAVE_CHOICES = [('hand_knotted', 'Hand-Knotted'), ('hand_tufted', 'Hand-Tufted'), ('machine_made', 'Machine-Made')]

    # 1. Core Information
    category = models.ForeignKey(Category, related_name='products', on_delete=models.SET_NULL, null=True)
    collection = models.ForeignKey(Collection, related_name='products', on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    short_description = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True, help_text="Long-form storytelling & craftsmanship details")
    
    # 2. Pricing & Inventory
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="Base Price")
    discount_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    sku = models.CharField(max_length=50, unique=True, null=True, blank=True)
    stock_quantity = models.PositiveIntegerField(default=1)
    stock_status = models.CharField(max_length=20, choices=STOCK_STATUS, default='in_stock')

    # 3. Media (Primary)
    main_image = models.URLField(default="http://localhost:8000/images/silk_carpets.jpg", help_text="Hero shot")
    hover_image = models.URLField(blank=True, null=True, help_text="Image for swap effect")
    video_url = models.URLField(blank=True, null=True, help_text="Optional lifestyle/weaving video")

    # 4. Specifications (Rug-Specific)
    size = models.CharField(max_length=100, default="8x10 ft", help_text="e.g. 8x10 ft")
    shape = models.CharField(max_length=50, blank=True, null=True, help_text="e.g. Rectangle, Round, Runner")
    space = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. Living Room, Bedroom, Office")
    material = models.CharField(max_length=255, default="High-Land Wool", help_text="e.g. Silk / Highland Wool")
    weave_type = models.CharField(max_length=50, choices=WEAVE_CHOICES, default='hand_knotted')
    knot_density = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. 1.2M knots/sqm")
    pile_height = models.CharField(max_length=50, blank=True, null=True)
    origin = models.CharField(max_length=255, default="Traditional Workshop", help_text="e.g. Tabriz, Iran")
    color_palette = models.CharField(max_length=255, blank=True, null=True, help_text="Primary colors separated by commas")
    pattern_style = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. Floral / Geometric")

    # 5. Merchandising & Flags
    is_featured = models.BooleanField(default=False)
    is_new_arrival = models.BooleanField(default=False)
    is_best_seller = models.BooleanField(default=False)
    is_limited_edition = models.BooleanField(default=False)
    
    # 6. Story & USP
    charity_tag = models.CharField(max_length=255, blank=True)
    craft_story = models.TextField(blank=True, help_text="The story of the artisan or technique")
    region_story = models.TextField(blank=True, help_text="Geographic heritage details")

    # 7. SEO
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.TextField(blank=True)
    tags = models.ManyToManyField(Tag, blank=True)

    # 8. Shipping
    weight = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    delivery_time = models.CharField(max_length=100, blank=True, default="7-14 Business Days")

    # 9. Controls
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='published')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['sku']),
            models.Index(fields=['status']),
        ]

    @property
    def price_display(self):
        return f"₹{self.price:,.2f}"

    @property
    def discounted_price_display(self):
        if self.discount_price:
            return f"₹{self.discount_price:,.2f}"
        return self.price_display

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        if not self.sku:
            import uuid
            self.sku = str(uuid.uuid4().hex)[:12].upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
        
    def __repr__(self):
        return f"<Product {self.title} ({self.sku})>"

class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='gallery', on_delete=models.CASCADE)
    image_url = models.URLField()
    alt_text = models.CharField(max_length=255, blank=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

class ProductVariant(models.Model):
    product = models.ForeignKey(Product, related_name='variants', on_delete=models.CASCADE)
    size = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    stock_quantity = models.PositiveIntegerField(default=1)
    
    def __str__(self):
        return f"{self.product.title} - {self.size}"

class Review(models.Model):
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    customer_name = models.CharField(max_length=100)
    rating = models.PositiveIntegerField(default=5)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.customer_name} - {self.product.title} ({self.rating})"

class Coupon(models.Model):
    code = models.CharField(max_length=20, unique=True)
    discount_percent = models.IntegerField()
    active = models.BooleanField(default=True)
    def __str__(self): return self.code

class CustomerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer_profile')
    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)
    avatar_url = models.URLField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    marketing_opt_in = models.BooleanField(default=False)
    default_address = models.ForeignKey('Address', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['google_sub']),
            models.Index(fields=['marketing_opt_in']),
        ]

    def __str__(self):
        return self.user.email or self.user.username

class Address(models.Model):
    LABEL_CHOICES = [('home', 'Home'), ('work', 'Work'), ('other', 'Other')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=20, choices=LABEL_CHOICES, default='home')
    recipient_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=10)
    country = models.CharField(max_length=100, default='India')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', '-updated_at']
        indexes = [
            models.Index(fields=['user', 'is_default']),
            models.Index(fields=['pincode']),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            Address.objects.filter(user=self.user).exclude(pk=self.pk).update(is_default=False)

    def __str__(self):
        return f"{self.recipient_name} - {self.city}"

class PaymentMethod(models.Model):
    TYPE_CHOICES = [('upi', 'UPI'), ('card', 'Card'), ('netbanking', 'Net Banking'), ('wallet', 'Wallet')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payment_methods')
    method_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    label = models.CharField(max_length=100)
    provider = models.CharField(max_length=100, blank=True)
    last4 = models.CharField(max_length=4, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_default', '-created_at']
        indexes = [models.Index(fields=['user', 'is_default'])]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            PaymentMethod.objects.filter(user=self.user).exclude(pk=self.pk).update(is_default=False)

    def __str__(self):
        return f"{self.label} ({self.method_type})"

class Notification(models.Model):
    TYPE_CHOICES = [('order', 'Order'), ('wishlist', 'Wishlist'), ('support', 'Support'), ('system', 'System')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=160)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='system')
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'read']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.title

class SupportTicket(models.Model):
    STATUS_CHOICES = [('open', 'Open'), ('in_review', 'In Review'), ('resolved', 'Resolved')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets')
    subject = models.CharField(max_length=160)
    message = models.TextField()
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.subject

class Order(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('processed', 'Processed'), ('shipped', 'Shipped'), ('delivered', 'Delivered'), ('cancelled', 'Cancelled'), ('returned', 'Returned')]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    order_id = models.CharField(max_length=100, unique=True) # Razorpay Order ID
    razorpay_payment_id = models.CharField(max_length=100, blank=True, null=True)
    customer_name = models.CharField(max_length=200)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=20, blank=True, null=True)
    shipping_address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    pincode = models.CharField(max_length=10, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return f"Order {self.order_id}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    quantity = models.PositiveIntegerField(default=1)
    price_at_purchase = models.DecimalField(max_digits=12, decimal_places=2)
    
    def __str__(self):
        return f"{self.quantity}x {self.product.title if self.product else 'Unknown'} in Order {self.order.order_id}"

class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True, related_name='cart')
    session_id = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['cart', 'product'], name='unique_cart_product')
        ]

class Wishlist(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True, related_name='wishlist')
    session_id = models.CharField(max_length=255, null=True, blank=True)

class WishlistItem(models.Model):
    wishlist = models.ForeignKey(Wishlist, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['wishlist', 'product'], name='unique_wishlist_product')
        ]
