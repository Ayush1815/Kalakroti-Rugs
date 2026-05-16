from decimal import Decimal
import uuid

from django.contrib.auth import authenticate, get_user_model
from django.core import signing
from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify
from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import (
    Address,
    Category,
    Coupon,
    CustomerProfile,
    Notification,
    Order,
    PaymentMethod,
    Product,
    Cart,
    CartItem,
    SupportTicket,
    Tag,
    Wishlist,
    WishlistItem,
)
from .serializers import (
    AddressSerializer,
    CategorySerializer,
    CouponSerializer,
    CustomerProfileSerializer,
    NotificationSerializer,
    OrderSerializer,
    PaymentMethodSerializer,
    ProductSerializer,
    SupportTicketSerializer,
)
import razorpay
from django.conf import settings

AUTH_SALT = 'kalakroti-auth-v1'
TOKEN_MAX_AGE = 60 * 60 * 24 * 30
User = get_user_model()


def issue_auth_token(user):
    return signing.dumps({'uid': user.pk}, salt=AUTH_SALT)


def ensure_customer_profile(user):
    profile, _ = CustomerProfile.objects.get_or_create(user=user)
    return profile


def get_token_user(request):
    auth_header = request.headers.get('Authorization', '')
    token = ''
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
    token = token or request.headers.get('X-Kalakroti-Token', '').strip()
    if not token:
        return None
    try:
        payload = signing.loads(token, salt=AUTH_SALT, max_age=TOKEN_MAX_AGE)
        return User.objects.get(pk=payload['uid'], is_active=True)
    except (signing.BadSignature, signing.SignatureExpired, User.DoesNotExist, KeyError):
        return None


def user_payload(user):
    full_name = user.get_full_name().strip() or user.username
    profile = ensure_customer_profile(user)
    return {
        'id': user.pk,
        'name': full_name,
        'email': user.email,
        'picture': profile.avatar_url,
    }


def set_user_name(user, name):
    if not name:
        return
    parts = name.strip().split(' ', 1)
    user.first_name = parts[0]
    user.last_name = parts[1] if len(parts) > 1 else ''


def normalized_cart_items(data):
    if data.get('items'):
        return [
            {
                'id': int(item.get('product_id') or item.get('id')),
                'qty': max(1, int(item.get('quantity') or item.get('qty') or 1)),
            }
            for item in data.get('items', [])
            if item.get('product_id') or item.get('id')
        ]

    counts = {}
    for product_id in data.get('product_ids', []):
        try:
            pid = int(product_id)
        except (TypeError, ValueError):
            continue
        counts[pid] = counts.get(pid, 0) + 1
    return [{'id': pid, 'qty': qty} for pid, qty in counts.items()]


def price_for(product):
    return product.discount_price if product.discount_price is not None else product.price


def calculate_cart_total(items):
    products = {p.id: p for p in Product.objects.filter(id__in=[item['id'] for item in items])}
    total = Decimal('0.00')
    for item in items:
        product = products.get(item['id'])
        if product:
            total += price_for(product) * item['qty']
    return total, products


def sync_user_collection(user, cart_payload=None, wishlist_payload=None, merge=False):
    cart_payload = cart_payload or []
    wishlist_payload = wishlist_payload or []

    cart_obj, _ = Cart.objects.get_or_create(user=user)
    wishlist_obj, _ = Wishlist.objects.get_or_create(user=user)

    cart_quantities = {}
    if merge:
        cart_quantities.update({item.product_id: item.quantity for item in cart_obj.items.all()})
    for item in cart_payload:
        product_id = item.get('product_id') or item.get('id')
        if not product_id:
            continue
        try:
            product_id = int(product_id)
            quantity = max(1, int(item.get('quantity') or item.get('qty') or 1))
        except (TypeError, ValueError):
            continue
        cart_quantities[product_id] = cart_quantities.get(product_id, 0) + quantity if merge else quantity

    wishlist_ids = set(wishlist_obj.items.values_list('product_id', flat=True)) if merge else set()
    for item in wishlist_payload:
        product_id = item.get('product_id') or item.get('id')
        if not product_id:
            continue
        try:
            wishlist_ids.add(int(product_id))
        except (TypeError, ValueError):
            continue

    valid_cart_products = set(Product.objects.filter(id__in=cart_quantities).values_list('id', flat=True))
    valid_wishlist_products = set(Product.objects.filter(id__in=wishlist_ids).values_list('id', flat=True))

    cart_obj.items.all().delete()
    CartItem.objects.bulk_create([
        CartItem(cart=cart_obj, product_id=pid, quantity=qty)
        for pid, qty in cart_quantities.items()
        if pid in valid_cart_products
    ])

    wishlist_obj.items.all().delete()
    WishlistItem.objects.bulk_create([
        WishlistItem(wishlist=wishlist_obj, product_id=pid)
        for pid in valid_wishlist_products
    ])

    cart_products = Product.objects.filter(id__in=valid_cart_products)
    wishlist_products = Product.objects.filter(id__in=valid_wishlist_products)
    product_map = {product.id: ProductSerializer(product).data for product in list(cart_products) + list(wishlist_products)}

    return {
        'cart': [
            {**product_map[pid], 'qty': qty}
            for pid, qty in cart_quantities.items()
            if pid in product_map
        ],
        'wishlist': [
            product_map[pid]
            for pid in wishlist_ids
            if pid in product_map
        ],
    }

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

from django_filters.rest_framework import DjangoFilterBackend

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'category': ['exact'],
        'category__slug': ['exact'],
        'slug': ['exact'],
        'price': ['gte', 'lte'],
        'material': ['exact'],
        'pattern_style': ['exact'],
        'tags__name': ['exact'],
        'is_featured': ['exact'],
        'is_new_arrival': ['exact'],
        'is_best_seller': ['exact'],
        'size': ['exact', 'icontains'],
        'shape': ['exact', 'icontains'],
        'space': ['exact', 'icontains'],
    }
    search_fields = ['title', 'description', 'origin', 'material', 'category__name', 'tags__name', 'space', 'shape', 'size']
    ordering_fields = ['price', 'created_at', 'title']

class CouponViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Coupon.objects.filter(active=True)
    serializer_class = CouponSerializer
    lookup_field = 'code'

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    lookup_field = 'order_id'


@api_view(['POST'])
def register_account(request):
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''
    name = (request.data.get('name') or '').strip()

    if not email or '@' not in email:
        return Response({'error': 'A valid email is required'}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 6:
        return Response({'error': 'Password must be at least 6 characters'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'An account already exists for this email'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=email[:150], email=email, password=password)
    if name:
        set_user_name(user, name)
        user.save(update_fields=['first_name', 'last_name'])
    ensure_customer_profile(user)

    return Response({'token': issue_auth_token(user), 'user': user_payload(user)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_account(request):
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''
    user = authenticate(username=email, password=password)
    if user is None:
        try:
            candidate = User.objects.get(email__iexact=email, is_active=True)
            if candidate.check_password(password):
                user = candidate
        except User.DoesNotExist:
            user = None

    if user is None:
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'token': issue_auth_token(user), 'user': user_payload(user)})


@api_view(['POST'])
def social_account(request):
    credential = request.data.get('credential') or request.data.get('id_token') or ''
    if not settings.GOOGLE_CLIENT_ID:
        return Response({'error': 'Google sign-in is not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if not credential:
        return Response({'error': 'Missing Google credential'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        payload = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        return Response({'error': 'Google credential could not be verified'}, status=status.HTTP_400_BAD_REQUEST)

    if payload.get('aud') != settings.GOOGLE_CLIENT_ID or payload.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
        return Response({'error': 'Google credential audience or issuer is invalid'}, status=status.HTTP_400_BAD_REQUEST)

    email = (payload.get('email') or '').strip().lower()
    if not email or not payload.get('email_verified'):
        return Response({'error': 'Google account email is not verified'}, status=status.HTTP_400_BAD_REQUEST)

    google_sub = payload.get('sub')
    existing_profile = CustomerProfile.objects.filter(google_sub=google_sub).select_related('user').first()
    if existing_profile:
        user = existing_profile.user
    else:
        user, created = User.objects.get_or_create(username=email[:150], defaults={'email': email})
        if created:
            user.set_unusable_password()

    set_user_name(user, payload.get('name') or email.split('@')[0])
    user.email = email
    user.save()

    profile = ensure_customer_profile(user)
    profile.google_sub = google_sub
    profile.avatar_url = payload.get('picture') or profile.avatar_url
    profile.save(update_fields=['google_sub', 'avatar_url', 'updated_at'])

    return Response({'token': issue_auth_token(user), 'user': user_payload(user)})


@api_view(['GET'])
def public_config(request):
    return Response({
        'google_client_id': settings.GOOGLE_CLIENT_ID,
        'google_sign_in_enabled': bool(settings.GOOGLE_CLIENT_ID),
        'site_url': settings.SITE_URL,
    })


@api_view(['GET', 'POST'])
def account_collection(request):
    user = get_token_user(request)
    if user is None:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if request.method == 'POST':
        payload = sync_user_collection(
            user,
            request.data.get('cart', []),
            request.data.get('wishlist', []),
            merge=bool(request.data.get('merge')),
        )
        return Response(payload)

    return Response(sync_user_collection(user, merge=True))


@api_view(['GET'])
def account_orders(request):
    user = get_token_user(request)
    if user is None:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    orders = Order.objects.filter(Q(user=user) | Q(customer_email__iexact=user.email)).distinct().order_by('-created_at')
    return Response(OrderSerializer(orders, many=True).data)


def require_user(request):
    user = get_token_user(request)
    if user is None:
        return None, Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    return user, None


@api_view(['GET', 'PATCH'])
def account_profile(request):
    user, error = require_user(request)
    if error:
        return error

    profile = ensure_customer_profile(user)
    if request.method == 'PATCH':
        name = (request.data.get('name') or '').strip()
        if name:
            set_user_name(user, name)
            user.save(update_fields=['first_name', 'last_name'])
        profile.phone = request.data.get('phone', profile.phone) or ''
        if 'marketing_opt_in' in request.data:
            profile.marketing_opt_in = bool(request.data.get('marketing_opt_in'))
        profile.save()

    return Response(CustomerProfileSerializer(profile).data)


@api_view(['GET'])
def account_summary(request):
    user, error = require_user(request)
    if error:
        return error

    profile = ensure_customer_profile(user)
    orders = Order.objects.filter(Q(user=user) | Q(customer_email__iexact=user.email)).distinct().order_by('-created_at')
    unread_count = Notification.objects.filter(user=user, read=False).count()
    return Response({
        'profile': CustomerProfileSerializer(profile).data,
        'orders': OrderSerializer(orders[:20], many=True).data,
        'addresses': AddressSerializer(user.addresses.all(), many=True).data,
        'payment_methods': PaymentMethodSerializer(user.payment_methods.all(), many=True).data,
        'notifications': NotificationSerializer(user.notifications.all()[:20], many=True).data,
        'support_tickets': SupportTicketSerializer(user.support_tickets.all()[:20], many=True).data,
        'unread_notifications': unread_count,
    })


@api_view(['GET', 'POST'])
def account_addresses(request):
    user, error = require_user(request)
    if error:
        return error

    if request.method == 'POST':
        serializer = AddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = serializer.save(user=user)
        profile = ensure_customer_profile(user)
        if address.is_default or not profile.default_address:
            profile.default_address = address
            profile.save(update_fields=['default_address', 'updated_at'])
        return Response(AddressSerializer(address).data, status=status.HTTP_201_CREATED)

    return Response(AddressSerializer(user.addresses.all(), many=True).data)


@api_view(['PATCH', 'DELETE'])
def account_address_detail(request, pk):
    user, error = require_user(request)
    if error:
        return error
    try:
        address = user.addresses.get(pk=pk)
    except Address.DoesNotExist:
        return Response({'error': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        address.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = AddressSerializer(address, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    if address.is_default:
        profile = ensure_customer_profile(user)
        profile.default_address = address
        profile.save(update_fields=['default_address', 'updated_at'])
    return Response(AddressSerializer(address).data)


@api_view(['GET', 'POST'])
def account_payment_methods(request):
    user, error = require_user(request)
    if error:
        return error

    if request.method == 'POST':
        serializer = PaymentMethodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        method = serializer.save(user=user)
        return Response(PaymentMethodSerializer(method).data, status=status.HTTP_201_CREATED)

    return Response(PaymentMethodSerializer(user.payment_methods.all(), many=True).data)


@api_view(['DELETE'])
def account_payment_method_detail(request, pk):
    user, error = require_user(request)
    if error:
        return error
    try:
        method = user.payment_methods.get(pk=pk)
    except PaymentMethod.DoesNotExist:
        return Response({'error': 'Payment method not found'}, status=status.HTTP_404_NOT_FOUND)
    method.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'POST'])
def account_notifications(request):
    user, error = require_user(request)
    if error:
        return error
    if request.method == 'POST':
        user.notifications.filter(read=False).update(read=True)
    return Response(NotificationSerializer(user.notifications.all()[:50], many=True).data)


@api_view(['GET', 'POST'])
def account_support_tickets(request):
    user, error = require_user(request)
    if error:
        return error

    if request.method == 'POST':
        serializer = SupportTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save(user=user)
        Notification.objects.create(
            user=user,
            title='Support request received',
            message=f"We received your request: {ticket.subject}",
            notification_type='support',
        )
        return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)

    return Response(SupportTicketSerializer(user.support_tickets.all(), many=True).data)


@api_view(['POST'])
def bulk_import_products(request):
    rows = request.data.get('rows')
    if not isinstance(rows, list):
        return Response({'error': 'Expected a rows array'}, status=status.HTTP_400_BAD_REQUEST)

    imported = 0
    updated = 0
    errors = []

    for idx, row in enumerate(rows, start=1):
        title = (row.get('title') or '').strip()
        if not title:
            errors.append({'row': idx, 'error': 'Missing title'})
            continue
        try:
            price = Decimal(str(row.get('price') or '0'))
        except Exception:
            errors.append({'row': idx, 'error': 'Invalid price'})
            continue

        category_name = (row.get('category') or row.get('category_name') or 'Imported Rugs').strip()
        category_slug = slugify(category_name)
        category, _ = Category.objects.get_or_create(
            slug=category_slug,
            defaults={
                'name': category_name,
                'image_url': row.get('main_image') or '/images/hero-1-bc2ca9.png',
                'order': 99,
            },
        )

        sku = (row.get('sku') or '').strip() or None
        lookup = {'sku': sku} if sku else {'slug': slugify(title)}
        defaults = {
            'category': category,
            'title': title,
            'short_description': row.get('short_description') or '',
            'description': row.get('description') or row.get('short_description') or '',
            'price': price,
            'discount_price': Decimal(str(row['discount_price'])) if row.get('discount_price') else None,
            'sku': sku,
            'stock_quantity': int(row.get('stock_quantity') or row.get('stock') or 1),
            'stock_status': row.get('stock_status') or 'in_stock',
            'main_image': row.get('main_image') or '/images/hero-1-bc2ca9.png',
            'hover_image': row.get('hover_image') or row.get('main_image') or '',
            'size': row.get('size') or '8x10 ft',
            'material': row.get('material') or 'Handwoven Wool',
            'origin': row.get('origin') or 'India',
            'knot_density': row.get('knot_density') or '',
            'pattern_style': row.get('pattern_style') or '',
            'craft_story': row.get('craft_story') or '',
            'status': row.get('status') or 'published',
        }

        product, created = Product.objects.update_or_create(defaults=defaults, **lookup)
        tag_names = [tag.strip() for tag in str(row.get('tags') or '').split(',') if tag.strip()]
        if tag_names:
            product.tags.set([Tag.objects.get_or_create(name=tag)[0] for tag in tag_names])
        imported += int(created)
        updated += int(not created)

    return Response({'imported': imported, 'updated': updated, 'errors': errors})

@api_view(['POST'])
def create_payment(request):
    try:
        items = normalized_cart_items(request.data)
        amount, _ = calculate_cart_total(items)

        if amount <= 0:
            return Response({'error': 'Invalid cart amount'}, status=status.HTTP_400_BAD_REQUEST)

        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            return Response({
                'mode': 'offline',
                'order_id': f"KALA-{uuid.uuid4().hex[:12].upper()}",
                'key_id': '',
                'amount': int(amount * 100),
            })
        
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        order = client.order.create({
            'amount': int(amount * 100),
            'currency': 'INR',
            'payment_capture': '1'
        })
        
        return Response({
            'order_id': order['id'],
            'key_id': settings.RAZORPAY_KEY_ID,
            'amount': order['amount']
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def verify_payment(request):
    try:
        data = request.data
        offline_payment = bool(data.get('offline_payment')) or not (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)

        if not offline_payment:
            params_dict = {
                'razorpay_order_id': data.get('razorpay_order_id'),
                'razorpay_payment_id': data.get('razorpay_payment_id'),
                'razorpay_signature': data.get('razorpay_signature')
            }

            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            client.utility.verify_payment_signature(params_dict)

        items = normalized_cart_items(data)
        total_amount, products = calculate_cart_total(items)
        if total_amount <= 0:
            return Response({'error': 'Invalid cart amount'}, status=status.HTTP_400_BAD_REQUEST)

        customer_details = data.get('customer_details', {})
        user = get_token_user(request)

        with transaction.atomic():
            order = Order.objects.create(
                user=user,
                order_id=data.get('razorpay_order_id') or data.get('order_id') or f"KALA-{uuid.uuid4().hex[:12].upper()}",
                razorpay_payment_id=data.get('razorpay_payment_id') or ('offline' if offline_payment else None),
                customer_name=customer_details.get('name'),
                customer_email=customer_details.get('email') or (user.email if user else ''),
                customer_phone=customer_details.get('phone'),
                shipping_address=customer_details.get('address'),
                city=customer_details.get('city'),
                pincode=customer_details.get('pincode'),
                total_amount=total_amount,
                status='processed'
            )
            for item in items:
                product = products.get(item['id'])
                if not product:
                    continue
                order.items.create(
                    product=product,
                    quantity=item['qty'],
                    price_at_purchase=price_for(product),
                )
                if product.stock_quantity >= item['qty']:
                    product.stock_quantity -= item['qty']
                    if product.stock_quantity == 0:
                        product.stock_status = 'out_of_stock'
                    product.save(update_fields=['stock_quantity', 'stock_status'])

            if user:
                Cart.objects.filter(user=user).delete()

        return Response({'status': 'success', 'order_id': order.order_id})
    except razorpay.errors.SignatureVerificationError:
        return Response({'error': 'Signature verification failed'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
