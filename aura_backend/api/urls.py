from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    ProductViewSet,
    OrderViewSet,
    CouponViewSet,
    account_address_detail,
    account_addresses,
    account_collection,
    account_notifications,
    account_orders,
    account_payment_method_detail,
    account_payment_methods,
    account_profile,
    account_summary,
    account_support_tickets,
    bulk_import_products,
    create_payment,
    login_account,
    public_config,
    register_account,
    social_account,
    verify_payment,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'coupons', CouponViewSet)

urlpatterns = [
    path('config/', public_config, name='public-config'),
    path('auth/register/', register_account, name='auth-register'),
    path('auth/login/', login_account, name='auth-login'),
    path('auth/social/', social_account, name='auth-social'),
    path('account/profile/', account_profile, name='account-profile'),
    path('account/summary/', account_summary, name='account-summary'),
    path('account/collection/', account_collection, name='account-collection'),
    path('account/orders/', account_orders, name='account-orders'),
    path('account/addresses/', account_addresses, name='account-addresses'),
    path('account/addresses/<int:pk>/', account_address_detail, name='account-address-detail'),
    path('account/payment-methods/', account_payment_methods, name='account-payment-methods'),
    path('account/payment-methods/<int:pk>/', account_payment_method_detail, name='account-payment-method-detail'),
    path('account/notifications/', account_notifications, name='account-notifications'),
    path('account/support-tickets/', account_support_tickets, name='account-support-tickets'),
    path('products/bulk-import/', bulk_import_products, name='products-bulk-import'),
    path('', include(router.urls)),
    path('create-payment/', create_payment, name='create-payment'),
    path('verify-payment/', verify_payment, name='verify-payment'),
]
