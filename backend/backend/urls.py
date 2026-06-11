"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView

from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from api.media_views import VideoStreamView, EnhancedMediaView
from api import views as api_views

schema_view = get_schema_view(
   openapi.Info(
      title="LMSetjen DPD RI Admin Backend APIs",
      default_version='v1',
      description="This is the API documentation for LMSetjen DPD RI Admin project APIs",
      terms_of_service="https://www.google.com/policies/terms/",
      contact=openapi.Contact(email="destiny@gmail.com"),
      license=openapi.License(name="BSD License"),
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    # Root redirect to API documentation
    path('', RedirectView.as_view(url='api/v1/', permanent=False)),
    
    path('swagger<format>/', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    
    
    path('admin/', admin.site.urls),
    
    # Certificate Validation Route - Serves React SPA
    # In production with Docker/nginx, this is not used (nginx handles routing)
    # In development without Docker, this allows React Router to handle the route
    path('certificate/validate/<str:validation_token>/', api_views.ReactSPACatchAllView.as_view(), name='certificate-validate-spa'),

    path("api/v1/", include("api.urls"))
]

# Enhanced media serving with video streaming support
# Use EnhancedMediaView for both development and production
# This ensures consistent behavior and proper media file serving
urlpatterns += [
    # Video files with streaming support (range requests for seeking)
    re_path(r'^media/(?P<path>.*\.(mp4|webm|avi|mov|mkv|m4v|3gp|flv)$)', 
            VideoStreamView.as_view(), name='video-stream'),
    # All other media files (images, documents, etc.)
    re_path(r'^media/(?P<path>.*)$', 
            EnhancedMediaView.as_view(), name='enhanced-media'),
]

# Static files serving - Always use STATIC_ROOT for both dev and production
# STATIC_ROOT contains collected static files from collectstatic command
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Add debug toolbar URLs in development
if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [
        path('__debug__/', include(debug_toolbar.urls)),
    ] + urlpatterns