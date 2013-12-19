# -*- coding: utf-8 -*-

DEBUG = True
API_DEBUG = DEBUG
TEMPLATE_DEBUG = DEBUG

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'sc_web',
        'USER': 'root',
        'PASSWORD': 'ифрук123',
        'HOST': '',
        'PORT': '',
    }
}

SITE_URL = 'http://localhost:8000'

# GOOGLE_ANALYTICS_ID = ''

# REPO_PATH = ''

# REPO_EDIT_TIMEOUT = 60 # source edit lock timeout
