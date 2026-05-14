from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Cart, Category, Order, Product, Wishlist


class ApiFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(
            name='Woolen Rugs',
            slug='woolen-rugs',
            image_url='/images/hero-1-bc2ca9.png',
        )
        self.product = Product.objects.create(
            category=self.category,
            title='Jaipur Garden Wool Rug',
            slug='jaipur-garden-wool-rug',
            price=Decimal('1000.00'),
            discount_price=Decimal('800.00'),
            stock_quantity=5,
            main_image='/images/hero-1-bc2ca9.png',
        )

    def register(self):
        response = self.client.post('/api/auth/register/', {
            'name': 'Test Client',
            'email': 'client@example.com',
            'password': 'strongpass',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        return response.data['token']

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_account_collection_sync_merges_guest_state(self):
        token = self.register()
        self.auth(token)

        response = self.client.post('/api/account/collection/', {
            'cart': [{'product_id': self.product.id, 'quantity': 2}],
            'wishlist': [{'product_id': self.product.id}],
            'merge': True,
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['cart'][0]['qty'], 2)
        self.assertEqual(response.data['wishlist'][0]['id'], self.product.id)
        self.assertEqual(Cart.objects.get(user__email='client@example.com').items.count(), 1)
        self.assertEqual(Wishlist.objects.get(user__email='client@example.com').items.count(), 1)

    def test_offline_checkout_uses_quantities_and_creates_items(self):
        token = self.register()
        self.auth(token)

        response = self.client.post('/api/verify-payment/', {
            'razorpay_order_id': 'KALA-TEST-001',
            'offline_payment': True,
            'items': [{'product_id': self.product.id, 'quantity': 3}],
            'customer_details': {
                'name': 'Test Client',
                'email': 'client@example.com',
                'phone': '9876543210',
                'address': '1 Craft Street',
                'city': 'Jaipur',
                'pincode': '302001',
            },
        }, format='json')

        self.assertEqual(response.status_code, 200)
        order = Order.objects.get(order_id='KALA-TEST-001')
        self.assertEqual(order.total_amount, Decimal('2400.00'))
        self.assertEqual(order.items.get().quantity, 3)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 2)

    def test_bulk_import_creates_and_updates_products(self):
        payload = {
            'rows': [{
                'title': 'Imported Silk Rug',
                'sku': 'KALA-IMP-001',
                'category': 'Silk Carpets',
                'price': '2500',
                'discount_price': '2100',
                'stock_quantity': '7',
                'main_image': '/images/hero-2-c8798d.png',
                'size': '6x9 ft',
                'material': 'Mulberry Silk',
                'origin': 'Kashmir, India',
                'tags': 'Bedroom,Traditional',
            }]
        }

        created = self.client.post('/api/products/bulk-import/', payload, format='json')
        updated = self.client.post('/api/products/bulk-import/', payload, format='json')

        self.assertEqual(created.status_code, 200)
        self.assertEqual(created.data['imported'], 1)
        self.assertEqual(updated.data['updated'], 1)
        product = Product.objects.get(sku='KALA-IMP-001')
        self.assertEqual(product.material, 'Mulberry Silk')
        self.assertEqual(product.tags.count(), 2)
