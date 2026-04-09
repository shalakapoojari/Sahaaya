from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')  # 'user' or 'admin'
    badges = db.Column(db.String(500), default='')  # comma-separated badge names
    sponsor_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    transactions = db.relationship('Transaction', backref='user', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'badges': self.badges.split(',') if self.badges else [],
            'sponsor_count': self.sponsor_count,
            'created_at': self.created_at.isoformat()
        }


class Machine(db.Model):
    __tablename__ = 'machines'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    location = db.Column(db.String(300), nullable=False)
    area = db.Column(db.String(100), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(20), default='active')  # 'active' or 'inactive'
    is_free_zone = db.Column(db.Boolean, default=False)
    sponsored_pads = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    inventory_items = db.relationship('Inventory', backref='machine', lazy=True, cascade='all, delete-orphan')
    transactions = db.relationship('Transaction', backref='machine', lazy=True)

    def get_stock_status(self):
        total = sum(item.quantity for item in self.inventory_items)
        if total == 0:
            return 'out_of_stock'
        elif total <= 5:
            return 'low_stock'
        elif total <= 10:
            return 'high_demand'
        else:
            return 'available'

    def to_dict(self):
        total_stock = sum(item.quantity for item in self.inventory_items)
        return {
            'id': self.id,
            'name': self.name,
            'location': self.location,
            'area': self.area,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'status': self.status,
            'is_free_zone': self.is_free_zone,
            'sponsored_pads': self.sponsored_pads,
            'stock_status': self.get_stock_status(),
            'total_stock': total_stock,
            'created_at': self.created_at.isoformat()
        }


class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(50), nullable=True)  # 'Regular', 'Super', 'Overnight', etc.
    image_url = db.Column(db.String(300), nullable=True)
    features = db.Column(db.String(500), nullable=True)  # JSON string of features
    brand = db.Column(db.String(100), nullable=True)
    tagline = db.Column(db.String(200), nullable=True)
    color_accent = db.Column(db.String(20), nullable=True)
    descriptor = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    inventory_items = db.relationship('Inventory', backref='product', lazy=True)
    transactions = db.relationship('Transaction', backref='product', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'brand': self.brand,
            'tagline': self.tagline,
            'color_accent': self.color_accent,
            'descriptor': self.descriptor,
            'description': self.description,
            'price': self.price,
            'type': self.type,
            'image_url': self.image_url,
            'features': self.features,
            'created_at': self.created_at.isoformat()
        }


class Inventory(db.Model):
    __tablename__ = 'inventory'
    id = db.Column(db.Integer, primary_key=True)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    sponsored_quantity = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('machine_id', 'product_id', name='unique_machine_product'),
        db.CheckConstraint('quantity >= 0', name='check_non_negative_quantity'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'machine_id': self.machine_id,
            'machine_name': self.machine.name if self.machine else None,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'product_price': self.product.price if self.product else None,
            'quantity': self.quantity,
            'sponsored_quantity': self.sponsored_quantity,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class GlobalSponsoredPool(db.Model):
    __tablename__ = 'global_sponsored_pool'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    count = db.Column(db.Integer, default=0)

    product = db.relationship('Product', backref='global_pool', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'count': self.count
        }


class Transaction(db.Model):
    __tablename__ = 'transactions'
    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.String(50), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # nullable for guest
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, default=1)
    unit_price = db.Column(db.Float, nullable=True)
    type = db.Column(db.String(50), default='purchase')  # 'purchase', 'sponsor_add', 'free_claim'
    sponsored_added = db.Column(db.Boolean, default=False)
    sponsored_price = db.Column(db.Float, default=0.0)
    grand_total = db.Column(db.Float, nullable=True)
    session_id = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), default='completed')  # 'completed', 'failed', 'sponsored'
    payment_method = db.Column(db.String(50), default='simulated')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user_id and self.user else 'Guest',
            'machine_id': self.machine_id,
            'machine_name': self.machine.name if self.machine else None,
            'machine_location': self.machine.location if self.machine else None,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'amount': self.amount,
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'type': self.type,
            'sponsored_added': self.sponsored_added,
            'sponsored_price': self.sponsored_price,
            'grand_total': self.grand_total,
            'session_id': self.session_id,
            'status': self.status,
            'payment_method': self.payment_method,
            'timestamp': self.timestamp.isoformat()
        }
