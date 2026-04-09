import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'sahayaa-secret-key-2024-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'sahayaa-jwt-secret-2024')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', f"sqlite:///{os.path.join(BASE_DIR, 'sahayaa.db')}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEBUG = True
    OVERPASS_URL = os.environ.get('OVERPASS_URL', 'https://overpass-api.de/api/interpreter')
    
