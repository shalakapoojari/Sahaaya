import os
import uuid
import json
import random
import hashlib
import urllib.request
import urllib.parse
import math
from datetime import datetime, timedelta, date
from flask import Flask, request, jsonify
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, desc, and_, or_

# ─────────────────────────────────────────────
#  APP & CONFIG
# ─────────────────────────────────────────────
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("SQLALCHEMY_DATABASE_URI", "sqlite:///sahayaa.db")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "super-secret-jwt-key")
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "super-secret-flask-key")

db = SQLAlchemy(app)
jwt = JWTManager(app)
CORS(app, resources={r"/*": {"origins": "*"}}, allow_headers=["Content-Type", "Authorization", "X-Session-Id"])


# ─────────────────────────────────────────────
#  MODELS
# ─────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'
    id            = db.Column(db.Integer, primary_key=True)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    name          = db.Column(db.String(100))
    role          = db.Column(db.String(20), default='user')   # 'admin' | 'user'
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, pw):  self.password_hash = generate_password_hash(pw, method='pbkdf2:sha256')
    def check_password(self, pw): return check_password_hash(self.password_hash, pw)

    def to_dict(self):
        return {'id': self.id, 'email': self.email, 'name': self.name, 'role': self.role}


class Machine(db.Model):
    __tablename__ = 'machines'
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(120), nullable=False)
    location    = db.Column(db.String(255))          # human description e.g. "Platform 1, Women's Waiting"
    area        = db.Column(db.String(120))          # city / neighbourhood  – filled by reverse-geocode
    latitude    = db.Column(db.Float, nullable=False)
    longitude   = db.Column(db.Float, nullable=False)
    status      = db.Column(db.String(20), default='active')   # active | inactive | maintenance
    is_free_zone = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    inventory_items = db.relationship('Inventory', backref='machine', lazy=True,
                                      cascade='all, delete-orphan')
    transactions    = db.relationship('Transaction', backref='machine', lazy=True)

    def get_stock_status(self):
        total = sum(i.quantity + i.sponsored_quantity for i in self.inventory_items)
        if total == 0:   return 'out_of_stock'
        if total <= 10:  return 'low_stock'
        return 'in_stock'

    def to_dict(self):
        return {
            'id':           self.id,
            'name':         self.name,
            'location':     self.location,
            'area':         self.area,
            'latitude':     self.latitude,
            'longitude':    self.longitude,
            'status':       self.status,
            'is_free_zone': self.is_free_zone,
            'stock_status': self.get_stock_status(),
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


class Product(db.Model):
    __tablename__ = 'products'
    id           = db.Column(db.Integer, primary_key=True)
    brand        = db.Column(db.String(80))
    name         = db.Column(db.String(120), nullable=False)
    tagline      = db.Column(db.String(200))
    description  = db.Column(db.Text)
    type         = db.Column(db.String(50))       # Regular | XL | Overnight | Ultra | Liner
    price        = db.Column(db.Float, default=45.0)
    color_accent = db.Column(db.String(20))
    image_url    = db.Column(db.String(255))
    logo_url     = db.Column(db.String(255))
    is_active    = db.Column(db.Boolean, default=True)

    inventory_items = db.relationship('Inventory', backref='product', lazy=True)

    def to_dict(self):
        return {
            'id':           self.id,
            'brand':        self.brand,
            'name':         self.name,
            'tagline':      self.tagline,
            'description':  self.description,
            'type':         self.type,
            'price':        self.price,
            'color_accent': self.color_accent,
            'image_url':    self.image_url,
            'logo_url':     self.logo_url,
        }


class Inventory(db.Model):
    __tablename__ = 'inventory'
    id                 = db.Column(db.Integer, primary_key=True)
    machine_id         = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False)
    product_id         = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity           = db.Column(db.Integer, default=0)      # paid/regular stock
    sponsored_quantity = db.Column(db.Integer, default=0)      # donated/free stock
    last_restocked     = db.Column(db.DateTime)
    updated_at         = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                 self.id,
            'machine_id':         self.machine_id,
            'product_id':         self.product_id,
            'product_name':       self.product.name if self.product else '',
            'brand':              self.product.brand if self.product else '',
            'quantity':           self.quantity,
            'sponsored_quantity': self.sponsored_quantity,
            'last_restocked':     self.last_restocked.isoformat() if self.last_restocked else None,
        }


class Transaction(db.Model):
    __tablename__ = 'transactions'
    id             = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.String(40), unique=True)
    session_id     = db.Column(db.String(80))
    machine_id     = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=True)
    product_id     = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    amount         = db.Column(db.Float, default=0.0)
    quantity       = db.Column(db.Integer, default=1)
    unit_price     = db.Column(db.Float, default=0.0)
    grand_total    = db.Column(db.Float, default=0.0)
    type           = db.Column(db.String(30))   # purchase | free_claim | sponsor_match | subscription_use | physical_delivery
    payment_method = db.Column(db.String(30))   # cash | upi | card | subscription | sponsored | free
    status         = db.Column(db.String(20), default='completed')
    notes          = db.Column(db.Text)
    timestamp      = db.Column(db.DateTime, default=datetime.utcnow)

    product = db.relationship('Product', foreign_keys=[product_id])

    def to_dict(self):
        return {
            'id':             self.id,
            'transaction_id': self.transaction_id,
            'session_id':     self.session_id,
            'machine_id':     self.machine_id,
            'machine_name':   self.machine.name if self.machine else 'Sahayaa Pod',
            'product_id':     self.product_id,
            'product_name':   self.product.name if self.product else '',
            'amount':         self.amount,
            'quantity':       self.quantity,
            'type':           self.type,
            'payment_method': self.payment_method,
            'status':         self.status,
            'timestamp':      self.timestamp.isoformat() if self.timestamp else None,
        }


class AnonymousSession(db.Model):
    __tablename__ = 'anonymous_sessions'
    id              = db.Column(db.Integer, primary_key=True)
    session_id      = db.Column(db.String(80), unique=True, nullable=False)
    device_hash     = db.Column(db.String(32))
    area            = db.Column(db.String(120))
    total_donated   = db.Column(db.Integer, default=0)
    total_sponsored = db.Column(db.Integer, default=0)
    total_received  = db.Column(db.Integer, default=0)
    last_claim_date = db.Column(db.String(30))
    badges          = db.Column(db.String(255), default='')
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'session_id':       self.session_id,
            'area':             self.area,
            'total_donated':    self.total_donated,
            'total_sponsored':  self.total_sponsored,
            'total_received':   self.total_received,
            'last_claim_date':  self.last_claim_date,
            'badges':           [b for b in self.badges.split(',') if b] if self.badges else [],
        }


class NeedSignal(db.Model):
    __tablename__ = 'need_signals'
    id              = db.Column(db.Integer, primary_key=True)
    session_id      = db.Column(db.String(80), nullable=False)
    area            = db.Column(db.String(120))
    user_lat        = db.Column(db.Float)
    user_lng        = db.Column(db.Float)
    nearest_machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=True)
    brand           = db.Column(db.String(80))
    product_type    = db.Column(db.String(50))
    product_id      = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    qty             = db.Column(db.Integer, default=1)
    status          = db.Column(db.String(20), default='open')   # open | matched | expired | fulfilled
    sponsored_by    = db.Column(db.String(80))
    sponsor_method  = db.Column(db.String(30))   # digital | physical | subscription
    fulfilled_at    = db.Column(db.DateTime)
    expires_at      = db.Column(db.DateTime)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    nearest_machine = db.relationship('Machine', foreign_keys=[nearest_machine_id])
    product         = db.relationship('Product', foreign_keys=[product_id])

    def to_dict(self):
        machine_info = None
        if self.nearest_machine:
            machine_info = {
                'id':        self.nearest_machine.id,
                'name':      self.nearest_machine.name,
                'location':  self.nearest_machine.location,
                'area':      self.nearest_machine.area,
                'latitude':  self.nearest_machine.latitude,
                'longitude': self.nearest_machine.longitude,
            }
        return {
            'id':               self.id,
            'session_id':       self.session_id[:8] + '...',
            'area':             self.area,
            'user_lat':         self.user_lat,
            'user_lng':         self.user_lng,
            'nearest_machine':  machine_info,
            'brand':            self.brand,
            'product_type':     self.product_type,
            'product_id':       self.product_id,
            'qty':              self.qty,
            'status':           self.status,
            'sponsored_by':     self.sponsored_by[:8] + '...' if self.sponsored_by else None,
            'sponsor_method':   self.sponsor_method,
            'fulfilled_at':     self.fulfilled_at.isoformat() if self.fulfilled_at else None,
            'expires_at':       self.expires_at.isoformat() if self.expires_at else None,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
            'minutes_left':     max(0, int((self.expires_at - datetime.utcnow()).total_seconds() / 60))
                                if self.expires_at and self.status == 'open' else 0,
        }


class Donation(db.Model):
    __tablename__ = 'donations'
    id           = db.Column(db.Integer, primary_key=True)
    session_id   = db.Column(db.String(80))
    brand        = db.Column(db.String(80))
    product_type = db.Column(db.String(50))
    qty          = db.Column(db.Integer, default=1)
    area         = db.Column(db.String(120))
    product_id   = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':           self.id,
            'brand':        self.brand,
            'product_type': self.product_type,
            'qty':          self.qty,
            'area':         self.area,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


class CommunityPool(db.Model):
    __tablename__ = 'community_pool'
    id              = db.Column(db.Integer, primary_key=True)
    total_donated   = db.Column(db.Integer, default=0)
    total_available = db.Column(db.Integer, default=0)
    total_dispensed = db.Column(db.Integer, default=0)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'total_donated':   self.total_donated,
            'total_available': self.total_available,
            'total_dispensed': self.total_dispensed,
        }


class GlobalSponsoredPool(db.Model):
    __tablename__ = 'global_sponsored_pool'
    id         = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), unique=True)
    count      = db.Column(db.Integer, default=0)
    product    = db.relationship('Product')

    def to_dict(self):
        return {
            'product_id':   self.product_id,
            'product_name': self.product.name if self.product else '',
            'count':        self.count,
        }


# Subscription plans are stored in the DB with a per-session record
SUBSCRIPTION_PLANS = {
    'basic':    {'name': 'Basic',    'price_inr': 99,  'pads_per_month': 5,  'description': '5 pads/month'},
    'standard': {'name': 'Standard', 'price_inr': 199, 'pads_per_month': 12, 'description': '12 pads/month'},
    'premium':  {'name': 'Premium',  'price_inr': 299, 'pads_per_month': 20, 'description': '20 pads/month'},
}

class Subscription(db.Model):
    __tablename__ = 'subscriptions'
    id              = db.Column(db.Integer, primary_key=True)
    session_id      = db.Column(db.String(80), unique=True, nullable=False)
    plan            = db.Column(db.String(20), nullable=False)   # basic | standard | premium
    price_paid_inr  = db.Column(db.Integer, default=0)
    pads_remaining  = db.Column(db.Integer, default=0)
    pads_total      = db.Column(db.Integer, default=0)
    status          = db.Column(db.String(20), default='active')  # active | expired | cancelled
    activated_at    = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at      = db.Column(db.DateTime)
    renewed_at      = db.Column(db.DateTime)

    def is_valid(self):
        return self.status == 'active' and self.pads_remaining > 0 \
               and (self.expires_at is None or self.expires_at > datetime.utcnow())

    def to_dict(self):
        plan_info = SUBSCRIPTION_PLANS.get(self.plan, {})
        return {
            'plan':            self.plan,
            'plan_name':       plan_info.get('name', self.plan),
            'price_inr':       self.price_paid_inr,
            'pads_remaining':  self.pads_remaining,
            'pads_total':      self.pads_total,
            'status':          self.status,
            'is_valid':        self.is_valid(),
            'activated_at':    self.activated_at.isoformat() if self.activated_at else None,
            'expires_at':      self.expires_at.isoformat() if self.expires_at else None,
        }


# ─────────────────────────────────────────────
#  HELPER FUNCTIONS
# ─────────────────────────────────────────────
with app.app_context():
    db.create_all()


def generate_transaction_id():
    return f"SAH-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"


def get_device_hash(session_id):
    return hashlib.sha256(session_id.encode()).hexdigest()[:16]


def haversine_km(lat1, lon1, lat2, lon2):
    """Accurate Haversine distance in km."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def reverse_geocode(lat, lng):
    """
    Dynamic reverse-geocoding via Nominatim (OpenStreetMap).
    Returns a human-readable area name.
    """
    url = (
        f"https://nominatim.openstreetmap.org/reverse"
        f"?lat={lat}&lon={lng}&format=json&addressdetails=1"
    )
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Sahayaa/3.0 sahayaa@example.com'})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode())
        addr = data.get('address', {})
        # Preference order for area name
        area = (addr.get('suburb') or addr.get('neighbourhood') or
                addr.get('city_district') or addr.get('town') or
                addr.get('city') or addr.get('state_district') or
                addr.get('state') or 'Unknown Area')
        city = addr.get('city') or addr.get('town') or addr.get('state') or ''
        return area, city
    except Exception:
        return 'Unknown Area', ''


def find_nearest_machine_with_stock(lat, lng, product_id=None, qty=1):
    MAX_DISTANCE_KM = 50000   # 🔥 Allow global distance for deployment testing

    machines = Machine.query.filter_by(status='active').all()
    best, best_dist = None, float('inf')

    for m in machines:
        if not m.latitude or not m.longitude:
            continue

        dist = haversine_km(lat, lng, m.latitude, m.longitude)

        if dist > MAX_DISTANCE_KM:
            continue   # 🚫 ignore far machines

        inv = (Inventory.query.filter_by(machine_id=m.id, product_id=product_id).first()
               if product_id else None)

        has_stock = (inv and (inv.quantity >= qty or inv.sponsored_quantity >= qty)) \
                    if inv else (m.get_stock_status() != 'out_of_stock')

        if has_stock and dist < best_dist:
            best, best_dist = m, dist

    return best, best_dist


def can_claim_today(session_id):
    anon = AnonymousSession.query.filter_by(session_id=session_id).first()
    if anon and anon.last_claim_date:
        last = datetime.fromisoformat(anon.last_claim_date)
        if datetime.utcnow().date() == last.date():
            return False, last
    return True, None


def award_badges(anon):
    badges = set(b for b in anon.badges.split(',') if b) if anon.badges else set()
    if anon.total_donated >= 1:   badges.add('first_donor')
    if anon.total_donated >= 5:   badges.add('donor')
    if anon.total_donated >= 20:  badges.add('generous_donor')
    if anon.total_sponsored >= 1: badges.add('supporter')
    if anon.total_sponsored >= 10: badges.add('hero_supporter')
    anon.badges = ','.join(badges)


def get_or_create_session(session_id):
    anon = AnonymousSession.query.filter_by(session_id=session_id).first()
    if not anon:
        anon = AnonymousSession(session_id=session_id,
                                device_hash=get_device_hash(session_id))
        db.session.add(anon)
        db.session.flush()
    return anon


def get_community_pool():
    pool = CommunityPool.query.first()
    if not pool:
        pool = CommunityPool()
        db.session.add(pool)
        db.session.flush()
    return pool


# ─────────────────────────────────────────────
#  STATUS
# ─────────────────────────────────────────────

@app.route('/')
def api_root():
    return jsonify({'name': 'Sahayaa API', 'status': 'online', 'version': '4.0.0'}), 200


@app.route('/api/status')
def status():
    return jsonify({'status': 'ok', 'time': datetime.utcnow().isoformat()}), 200


# ─────────────────────────────────────────────
#  AUTH / SESSION
# ─────────────────────────────────────────────

@app.route('/api/auth/session', methods=['POST'])
def create_session():
    data = request.get_json() or {}
    session_id = data.get('session_id') or str(uuid.uuid4())
    anon = get_or_create_session(session_id)
    db.session.commit()
    return jsonify(anon.to_dict()), 200


@app.route('/api/auth/me', methods=['GET'])
def get_session():
    sid = request.headers.get('X-Session-Id')
    if not sid:
        return jsonify({'error': 'Session ID required'}), 400
    anon = AnonymousSession.query.filter_by(session_id=sid).first()
    if not anon:
        return jsonify({'error': 'Session not found'}), 404
    result = anon.to_dict()
    # Attach subscription info if any
    sub = Subscription.query.filter_by(session_id=sid).first()
    result['subscription'] = sub.to_dict() if sub else None
    return jsonify(result), 200


# Admin JWT login
@app.route('/api/auth/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    password = data.get('password', '')
    user = User.query.filter_by(email=email, role='admin').first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401
    token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=12))
    return jsonify({'token': token, 'user': user.to_dict()}), 200


# ─────────────────────────────────────────────
#  MACHINES
# ─────────────────────────────────────────────

@app.route('/api/machines', methods=['GET'])
def list_machines():
    search = request.args.get('search', '').strip()
    status_filter = request.args.get('status', '')
    area_filter = request.args.get('area', '')
    q = Machine.query
    if search:
        q = q.filter(or_(
            Machine.name.ilike(f'%{search}%'),
            Machine.location.ilike(f'%{search}%'),
            Machine.area.ilike(f'%{search}%')
        ))
    if status_filter:
        q = q.filter_by(status=status_filter)
    if area_filter:
        q = q.filter(Machine.area.ilike(f'%{area_filter}%'))
    return jsonify([m.to_dict() for m in q.all()]), 200


@app.route('/api/machines', methods=['POST'])
def create_machine():
    """
    Create a new pod/machine.
    Latitude & longitude are REQUIRED. Area is reverse-geocoded dynamically.
    """
    data = request.get_json() or {}

    lat = data.get('latitude')
    lng = data.get('longitude')
    if lat is None or lng is None:
        return jsonify({'error': 'latitude and longitude are required'}), 400

    lat, lng = float(lat), float(lng)

    # Dynamic area from real coordinates
    location_desc = data.get('location', '').strip()
    area, city = reverse_geocode(lat, lng)
    if not location_desc:
        location_desc = area

    machine = Machine(
        name=data.get('name', f'Pod @ {area}'),
        location=location_desc,
        area=area,
        latitude=lat,
        longitude=lng,
        status=data.get('status', 'active'),
        is_free_zone=bool(data.get('is_free_zone', False)),
    )
    db.session.add(machine)
    db.session.flush()

    # Provision inventory for every existing product
    for p in Product.query.filter_by(is_active=True).all():
        db.session.add(Inventory(
            machine_id=machine.id,
            product_id=p.id,
            quantity=int(data.get('initial_quantity', 20)),
            sponsored_quantity=0,
        ))

    db.session.commit()
    result = machine.to_dict()
    result['inventory'] = [i.to_dict() for i in machine.inventory_items]
    return jsonify({'success': True, 'machine': result}), 201


@app.route('/api/machines/<int:machine_id>', methods=['GET'])
def get_machine(machine_id):
    m = Machine.query.get_or_404(machine_id)
    d = m.to_dict()
    d['inventory'] = [i.to_dict() for i in m.inventory_items]
    return jsonify(d), 200


@app.route('/api/machines/<int:machine_id>', methods=['PUT'])
def update_machine(machine_id):
    m = Machine.query.get_or_404(machine_id)
    data = request.get_json() or {}

    if 'name'        in data: m.name        = data['name']
    if 'location'    in data: m.location    = data['location']
    if 'status'      in data: m.status      = data['status']
    if 'is_free_zone' in data: m.is_free_zone = bool(data['is_free_zone'])

    # If coordinates changed, re-geocode
    new_lat = data.get('latitude')
    new_lng = data.get('longitude')
    if new_lat is not None and new_lng is not None:
        m.latitude, m.longitude = float(new_lat), float(new_lng)
        area, _ = reverse_geocode(m.latitude, m.longitude)
        m.area = area

    db.session.commit()
    return jsonify({'success': True, 'machine': m.to_dict()}), 200


@app.route('/api/machines/<int:machine_id>', methods=['DELETE'])
def delete_machine(machine_id):
    m = Machine.query.get_or_404(machine_id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'success': True}), 200


@app.route('/api/machines/nearest', methods=['POST'])
def get_nearest_machine():
    data = request.get_json() or {}
    lat = data.get('lat')
    lng = data.get('lng')
    product_id = data.get('product_id')
    if lat is None or lng is None:
        return jsonify({'error': 'Location required'}), 400
    lat, lng = float(lat), float(lng)
    machine, dist = find_nearest_machine_with_stock(lat, lng, product_id)
    if machine:
        return jsonify({'machine': machine.to_dict(), 'distance_km': round(dist, 2)}), 200
    return jsonify({'machine': None, 'message': 'No machines with stock nearby'}), 404


@app.route('/api/machines/emergency', methods=['GET'])
def emergency_machine():
    machines = Machine.query.filter_by(status='active').all()
    free_ok = [m for m in machines if m.is_free_zone and m.get_stock_status() != 'out_of_stock']
    reg_ok  = [m for m in machines if not m.is_free_zone and m.get_stock_status() != 'out_of_stock']
    if free_ok:
        return jsonify({'machine': free_ok[0].to_dict(), 'type': 'free_zone'}), 200
    if reg_ok:
        return jsonify({'machine': reg_ok[0].to_dict(), 'type': 'regular'}), 200
    return jsonify({
        'machine': None,
        'fallback': [
            'Contact station helpdesk / information counter',
            'Ask at the nearest pharmacy or medical store',
            'Visit the nearest women\'s restroom for assistance',
            'Call Sahayaa helpline: 1800-SAH-HELP',
        ]
    }), 200


# ─────────────────────────────────────────────
#  PRODUCTS
# ─────────────────────────────────────────────

@app.route('/api/products', methods=['GET'])
def get_products():
    brand = request.args.get('brand')
    ptype = request.args.get('type')
    q = Product.query.filter_by(is_active=True)
    if brand: q = q.filter_by(brand=brand)
    if ptype: q = q.filter_by(type=ptype)
    return jsonify([p.to_dict() for p in q.all()]), 200


@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.get_json() or {}
    p = Product(
        brand=data.get('brand'),
        name=data.get('name'),
        tagline=data.get('tagline'),
        description=data.get('description'),
        type=data.get('type'),
        price=float(data.get('price', 45)),
        color_accent=data.get('color_accent'),
        image_url=data.get('image_url'),
        logo_url=data.get('logo_url'),
    )
    db.session.add(p)
    db.session.flush()
    # Provision in all machines
    for m in Machine.query.all():
        db.session.add(Inventory(machine_id=m.id, product_id=p.id, quantity=0))
    db.session.commit()
    return jsonify({'success': True, 'product': p.to_dict()}), 201


@app.route('/api/products/<int:pid>', methods=['PUT'])
def update_product(pid):
    p = Product.query.get_or_404(pid)
    data = request.get_json() or {}
    for field in ('brand', 'name', 'tagline', 'description', 'type',
                  'color_accent', 'image_url', 'logo_url'):
        if field in data: setattr(p, field, data[field])
    if 'price' in data: p.price = float(data['price'])
    if 'is_active' in data: p.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify({'success': True, 'product': p.to_dict()}), 200


@app.route('/api/products/brands', methods=['GET'])
def get_brands():
    brands = db.session.query(
        Product.brand,
        func.min(Product.tagline),
        func.min(Product.color_accent),
        func.min(Product.image_url)
    ).filter(Product.brand != None)\
     .group_by(Product.brand)\
     .all()

    return jsonify([{
        'id': b[0].lower().replace(' ', '_'),   # unique brand id
        'name': b[0],
        'tagline': b[1],
        'color': b[2],
        'logo_url': b[3]
    } for b in brands]), 200


@app.route('/api/products/types', methods=['GET'])
def get_product_types():
    rows = db.session.query(Product.type).filter(
        Product.is_active == True, Product.type.isnot(None)
    ).distinct().all()
    return jsonify([r[0] for r in rows]), 200


# ─────────────────────────────────────────────
#  INVENTORY (Admin management)
# ─────────────────────────────────────────────

@app.route('/api/inventory', methods=['GET'])
def get_all_inventory():
    machine_id = request.args.get('machine_id', type=int)
    q = Inventory.query
    if machine_id: q = q.filter_by(machine_id=machine_id)
    return jsonify([i.to_dict() for i in q.all()]), 200


@app.route('/api/inventory/machine/<int:machine_id>', methods=['GET'])
def get_machine_inventory(machine_id):
    items = Inventory.query.filter_by(machine_id=machine_id).all()
    return jsonify([i.to_dict() for i in items]), 200


@app.route('/api/inventory', methods=['POST'])
def set_inventory():
    """Set or update inventory for a machine-product pair."""
    data = request.get_json() or {}
    machine_id  = int(data['machine_id'])
    product_id  = int(data['product_id'])
    quantity    = int(data.get('quantity', 0))
    spon_qty    = int(data.get('sponsored_quantity', -1))

    if quantity < 0:
        return jsonify({'error': 'Quantity cannot be negative'}), 400

    item = Inventory.query.filter_by(machine_id=machine_id, product_id=product_id).first()
    if item:
        item.quantity = quantity
        if spon_qty >= 0: item.sponsored_quantity = spon_qty
        item.last_restocked = datetime.utcnow()
    else:
        item = Inventory(machine_id=machine_id, product_id=product_id,
                         quantity=quantity,
                         sponsored_quantity=max(0, spon_qty) if spon_qty >= 0 else 0,
                         last_restocked=datetime.utcnow())
        db.session.add(item)

    db.session.commit()
    return jsonify(item.to_dict()), 200


@app.route('/api/inventory/<int:inv_id>', methods=['PUT'])
def update_inventory_item(inv_id):
    """Partial update of a single inventory row (used by admin panel)."""
    item = Inventory.query.get_or_404(inv_id)
    data = request.get_json() or {}
    if 'quantity' in data:
        item.quantity = max(0, int(data['quantity']))
    if 'sponsored_quantity' in data:
        item.sponsored_quantity = max(0, int(data['sponsored_quantity']))
    item.last_restocked = datetime.utcnow()
    db.session.commit()
    return jsonify(item.to_dict()), 200


@app.route('/api/inventory/bulk', methods=['POST'])
def bulk_update_inventory():
    """
    Bulk-update inventory for a machine.
    Body: { machine_id, items: [{product_id, quantity, sponsored_quantity}] }
    """
    data = request.get_json() or {}
    machine_id = int(data.get('machine_id', 0))
    items_data = data.get('items', [])

    Machine.query.get_or_404(machine_id)
    updated = []
    for row in items_data:
        product_id = int(row['product_id'])
        qty     = int(row.get('quantity', 0))
        spon    = int(row.get('sponsored_quantity', 0))
        item = Inventory.query.filter_by(machine_id=machine_id, product_id=product_id).first()
        if item:
            item.quantity = max(0, qty)
            item.sponsored_quantity = max(0, spon)
            item.last_restocked = datetime.utcnow()
        else:
            item = Inventory(machine_id=machine_id, product_id=product_id,
                             quantity=max(0, qty), sponsored_quantity=max(0, spon),
                             last_restocked=datetime.utcnow())
            db.session.add(item)
        updated.append(item)

    db.session.commit()
    return jsonify({'success': True, 'updated': [i.to_dict() for i in updated]}), 200


# ─────────────────────────────────────────────
#  SUBSCRIPTIONS
# ─────────────────────────────────────────────

@app.route('/api/subscriptions/plans', methods=['GET'])
def get_plans():
    return jsonify([
        {'id': k,
         'name': v['name'],
         'price_inr': v['price_inr'],
         'pads_per_month': v['pads_per_month'],
         'description': v['description']}
        for k, v in SUBSCRIPTION_PLANS.items()
    ]), 200


@app.route('/api/subscriptions', methods=['POST'])
def create_subscription():
    """
    Subscribe a session to a pad plan.
    In a real deployment, payment gateway confirmation would be verified here.
    """
    data = request.get_json() or {}
    session_id = data.get('session_id')
    plan_id    = data.get('plan')

    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400
    if plan_id not in SUBSCRIPTION_PLANS:
        return jsonify({'error': f'Invalid plan. Choose from: {list(SUBSCRIPTION_PLANS.keys())}'}), 400

    plan = SUBSCRIPTION_PLANS[plan_id]

    # Cancel any existing active subscription first
    existing = Subscription.query.filter_by(session_id=session_id).first()
    if existing:
        existing.status = 'cancelled'

    sub = Subscription(
        session_id=session_id,
        plan=plan_id,
        price_paid_inr=plan['price_inr'],
        pads_remaining=plan['pads_per_month'],
        pads_total=plan['pads_per_month'],
        status='active',
        activated_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    db.session.add(sub)
    db.session.commit()
    return jsonify({'success': True, 'subscription': sub.to_dict()}), 201


@app.route('/api/subscriptions/<string:session_id>', methods=['GET'])
def get_subscription(session_id):
    sub = Subscription.query.filter_by(session_id=session_id).first()
    if not sub:
        return jsonify({'subscription': None}), 200
    # Auto-expire check
    if sub.expires_at and sub.expires_at < datetime.utcnow():
        sub.status = 'expired'
        db.session.commit()
    return jsonify({'subscription': sub.to_dict()}), 200


@app.route('/api/subscriptions/cancel', methods=['POST'])
def cancel_subscription():
    data = request.get_json() or {}
    sid = data.get('session_id')
    sub = Subscription.query.filter_by(session_id=sid, status='active').first()
    if not sub:
        return jsonify({'error': 'No active subscription found'}), 404
    sub.status = 'cancelled'
    db.session.commit()
    return jsonify({'success': True, 'message': 'Subscription cancelled'}), 200


# ─────────────────────────────────────────────
#  DISPENSE (with mode selection)
# ─────────────────────────────────────────────

@app.route('/api/dispense/check', methods=['POST'])
def check_dispense_eligibility():
    data = request.get_json() or {}
    session_id = data.get('session_id')
    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400

    can_claim, last_claim = can_claim_today(session_id)
    next_claim = (last_claim + timedelta(days=1)) if last_claim else None

    # Check subscription
    sub = Subscription.query.filter_by(session_id=session_id, status='active').first()
    sub_valid = sub.is_valid() if sub else False

    # Check if pool has donated pads available for this session's area
    pool = CommunityPool.query.first()
    donated_available = (pool.total_available > 0) if pool else False

    return jsonify({
        'can_claim':          can_claim,
        'last_claim_date':    last_claim.isoformat() if last_claim else None,
        'next_claim_time':    next_claim.isoformat() if next_claim else None,
        'subscription':       sub.to_dict() if sub else None,
        'subscription_valid': sub_valid,
        'donated_pads_available': donated_available,
        'available_modes': _available_modes(can_claim, sub_valid, donated_available),
    }), 200


def _available_modes(can_claim, sub_valid, donated_available):
    """Return the list of dispense modes available to the user."""
    modes = [{'id': 'pay', 'label': 'Buy Now', 'description': 'Pay full price in ₹'}]
    if sub_valid:
        modes.append({'id': 'subscription', 'label': 'Use Subscription',
                      'description': 'Deduct 1 pad from your plan'})
    if donated_available:
        modes.append({'id': 'community', 'label': 'Community Pad (Free)',
                      'description': 'From donated community pool'})
    modes.append({'id': 'sponsor_request', 'label': 'Request a Sponsor',
                  'description': 'Ask someone in the Live Care network to sponsor you'})
    return modes


@app.route('/api/dispense', methods=['POST'])
def dispense_product():
    """
    Dispense a product.
    mode: 'pay' | 'subscription' | 'community' | 'sponsor_request'
    """
    data = request.get_json() or {}
    session_id = data.get('session_id')
    product_id = data.get('product_id')
    quantity   = int(data.get('quantity', 1))
    lat        = data.get('lat')
    lng        = data.get('lng')
    machine_id = data.get('machine_id')
    mode       = data.get('mode', 'pay')   # pay | subscription | community | sponsor_request

    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400
    if not product_id:
        return jsonify({'error': 'Product ID required'}), 400

    product = Product.query.get(int(product_id))
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    anon = get_or_create_session(session_id)

    # ── SPONSOR REQUEST mode ──────────────────────────────
    if mode == 'sponsor_request':
        return _create_sponsor_request(session_id, anon, data, product, quantity, lat, lng)

    # ── Daily claim limit check (for non-subscription, non-pay modes) ──
    if mode in ('community',):
        can_claim, last_claim = can_claim_today(session_id)
        if not can_claim:
            next_claim = last_claim + timedelta(days=1)
            return jsonify({
                'error': 'Daily free-claim limit reached',
                'next_claim_time': next_claim.isoformat()
            }), 429

    # ── SUBSCRIPTION mode ─────────────────────────────────
    if mode == 'subscription':
        sub = Subscription.query.filter_by(session_id=session_id, status='active').first()
        if not sub or not sub.is_valid():
            return jsonify({'error': 'No valid subscription found'}), 400
        if sub.pads_remaining < quantity:
            return jsonify({'error': f'Only {sub.pads_remaining} pads left in subscription'}), 400

        machine, dist_km = _resolve_machine(machine_id, lat, lng, product.id, quantity)
        if not machine:
            return jsonify({'error': 'No machines with stock found near you'}), 404

        inv = Inventory.query.filter_by(machine_id=machine.id, product_id=product.id).first()
        inv.quantity = max(0, inv.quantity - quantity)
        sub.pads_remaining -= quantity

        txn = Transaction(
            transaction_id=generate_transaction_id(),
            session_id=session_id,
            machine_id=machine.id,
            product_id=product.id,
            amount=0,
            quantity=quantity,
            unit_price=0,
            grand_total=0,
            type='subscription_use',
            payment_method='subscription',
            status='completed',
            notes=f'Plan: {sub.plan}',
        )
        db.session.add(txn)
        anon.last_claim_date = datetime.utcnow().isoformat()
        anon.total_received += quantity
        db.session.commit()

        return jsonify({
            'success': True,
            'transaction_id': txn.transaction_id,
            'machine': machine.to_dict(),
            'product': product.to_dict(),
            'amount': 0,
            'subscription_pads_remaining': sub.pads_remaining,
            'message': f'Pad dispensed via your {sub.plan.title()} plan at {machine.name} 🎁',
        }), 200

    # ── COMMUNITY POOL mode (donated pads) ───────────────
    if mode == 'community':
        pool = get_community_pool()
        if pool.total_available < quantity:
            return jsonify({'error': 'Community pool is currently empty. Please try another mode.'}), 400

        pool_item = GlobalSponsoredPool.query.filter_by(product_id=product.id).first()
        # Fallback: deduct from any pool item
        if not pool_item or pool_item.count < quantity:
            pool_item = GlobalSponsoredPool.query.filter(
                GlobalSponsoredPool.count >= quantity
            ).first()
        if not pool_item:
            return jsonify({'error': 'Community stock unavailable for this product'}), 400

        pool_item.count -= quantity
        pool.total_available -= quantity
        pool.total_dispensed += quantity

        machine, _ = _resolve_machine(machine_id, lat, lng, product.id, quantity)

        txn = Transaction(
            transaction_id=generate_transaction_id(),
            session_id=session_id,
            machine_id=machine.id if machine else None,
            product_id=product.id,
            amount=0,
            quantity=quantity,
            type='free_claim',
            payment_method='community_pool',
            status='completed',
        )
        db.session.add(txn)
        anon.last_claim_date = datetime.utcnow().isoformat()
        anon.total_received += quantity
        db.session.commit()

        msg = (f'Your pad is ready at {machine.name} 🎁' if machine
               else 'Pad dispatched from community pool 🎁')
        return jsonify({
            'success': True,
            'transaction_id': txn.transaction_id,
            'machine': machine.to_dict() if machine else None,
            'product': product.to_dict(),
            'amount': 0,
            'message': msg,
        }), 200

    # ── PAY mode ─────────────────────────────────────────
    machine, dist_km = _resolve_machine(machine_id, lat, lng, product.id, quantity)
    if not machine:
        return jsonify({
            'error': 'No machines with stock found near you',
            'suggestion': 'Try the community pool or request a sponsor via Live Care',
        }), 404

    inv = Inventory.query.filter_by(machine_id=machine.id, product_id=product.id).first()
    is_free_zone = machine.is_free_zone
    has_sponsored = inv and inv.sponsored_quantity >= quantity

    if is_free_zone:
        inv.quantity = max(0, inv.quantity - quantity)
        amount, pay_method, txn_type = 0, 'free', 'free_claim'
    elif has_sponsored:
        inv.sponsored_quantity -= quantity
        amount, pay_method, txn_type = 0, 'sponsored', 'free_claim'
    else:
        if not inv or inv.quantity < quantity:
            return jsonify({'error': 'Insufficient stock at this machine'}), 400
        inv.quantity -= quantity
        amount = product.price * quantity
        pay_method = data.get('payment_method', 'upi')
        txn_type = 'purchase'

    txn = Transaction(
        transaction_id=generate_transaction_id(),
        session_id=session_id,
        machine_id=machine.id,
        product_id=product.id,
        amount=amount,
        quantity=quantity,
        unit_price=product.price,
        grand_total=amount,
        type=txn_type,
        payment_method=pay_method,
        status='completed',
    )
    db.session.add(txn)
    anon.total_received += quantity
    db.session.commit()

    return jsonify({
        'success': True,
        'transaction_id': txn.transaction_id,
        'machine': machine.to_dict(),
        'product': product.to_dict(),
        'quantity': quantity,
        'amount': amount,
        'distance_km': round(dist_km, 2),
        'message': f'Your pad is ready at {machine.name} 🎁',
    }), 200


def _resolve_machine(machine_id, lat, lng, product_id, qty):
    """Return (machine, dist_km) with stock, preferring explicitly given machine_id."""
    if machine_id:
        m = Machine.query.get(int(machine_id))
        if m:
            inv = Inventory.query.filter_by(machine_id=m.id, product_id=product_id).first()
            if inv and (inv.quantity >= qty or inv.sponsored_quantity >= qty):
                dist = 0 if not lat or not lng else haversine_km(lat, lng, m.latitude, m.longitude)
                return m, dist
    if lat and lng:
        return find_nearest_machine_with_stock(float(lat), float(lng), product_id, qty)
    # No location — return any machine with stock
    machines = Machine.query.filter_by(status='active').all()
    for m in machines:
        inv = Inventory.query.filter_by(machine_id=m.id, product_id=product_id).first()
        if inv and (inv.quantity >= qty or inv.sponsored_quantity >= qty):
            return m, 0
    return None, float('inf')


def _create_sponsor_request(session_id, anon, data, product, quantity, lat, lng):
    """Create a NeedSignal from a dispense sponsor-request flow."""
    area = data.get('area', '')
    if not area and lat and lng:
        area, _ = reverse_geocode(float(lat), float(lng))

    nearest_machine = None
    if lat and lng:
        nearest_machine, _ = find_nearest_machine_with_stock(
            float(lat), float(lng), product.id, 1)

    # Check 15-min cooldown
    recent = NeedSignal.query.filter(
        NeedSignal.session_id == session_id,
        NeedSignal.status == 'open',
        NeedSignal.created_at >= datetime.utcnow() - timedelta(minutes=15),
    ).first()
    if recent:
        return jsonify({'error': 'You already have an active sponsor request. Wait 15 minutes.'}), 429

    expires = datetime.utcnow() + timedelta(minutes=30)
    signal = NeedSignal(
        session_id=session_id,
        area=area,
        user_lat=float(lat) if lat else None,
        user_lng=float(lng) if lng else None,
        nearest_machine_id=nearest_machine.id if nearest_machine else None,
        brand=product.brand,
        product_type=product.type,
        product_id=product.id,
        qty=min(quantity, 3),
        status='open',
        expires_at=expires,
    )
    db.session.add(signal)
    db.session.commit()

    return jsonify({
        'success': True,
        'mode': 'sponsor_request',
        'signal': signal.to_dict(),
        'message': 'Your sponsor request has been posted to the Live Care network 💝',
    }), 201


# ─────────────────────────────────────────────
#  DONATE
# ─────────────────────────────────────────────

@app.route('/api/donate', methods=['POST'])
def create_donation():
    data = request.get_json() or {}
    session_id   = data.get('session_id')
    brand        = data.get('brand')
    product_type = data.get('product_type')
    qty          = max(1, min(50, int(data.get('qty', 1))))
    lat          = data.get('lat')
    lng          = data.get('lng')

    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400

    area = data.get('area', '')
    if not area and lat and lng:
        area, _ = reverse_geocode(float(lat), float(lng))

    product = (Product.query.filter_by(brand=brand, type=product_type).first()
               or Product.query.filter_by(type=product_type).first()
               or Product.query.first())

    donation = Donation(
        session_id=session_id,
        brand=brand,
        product_type=product_type,
        qty=qty,
        area=area,
        product_id=product.id if product else None,
    )
    db.session.add(donation)

    pool = get_community_pool()
    pool.total_donated   += qty
    pool.total_available += qty

    if product:
        pi = GlobalSponsoredPool.query.filter_by(product_id=product.id).first()
        if pi:
            pi.count += qty
        else:
            db.session.add(GlobalSponsoredPool(product_id=product.id, count=qty))

    anon = get_or_create_session(session_id)
    anon.total_donated += qty
    if area and not anon.area:
        anon.area = area
    award_badges(anon)

    db.session.commit()

    today = datetime.utcnow().date()
    today_total = db.session.query(func.sum(Donation.qty)).filter(
        func.date(Donation.created_at) == today
    ).scalar() or 0

    return jsonify({
        'success': True,
        'donation': donation.to_dict(),
        'pool': pool.to_dict(),
        'impact': {
            'your_total_donated': anon.total_donated,
            'donated_today_all': today_total,
            'pool_available':    pool.total_available,
            'message': f'Thank you! Your {qty} pad(s) will help someone in need 💝',
        }
    }), 201


@app.route('/api/donate/impact', methods=['GET'])
def get_donation_impact():
    pool = CommunityPool.query.first() or CommunityPool()
    today = datetime.utcnow().date()
    today_total = db.session.query(func.sum(Donation.qty)).filter(
        func.date(Donation.created_at) == today
    ).scalar() or 0

    # Per-product breakdown
    breakdown = []
    for pi in GlobalSponsoredPool.query.all():
        breakdown.append({
            'product_id':   pi.product_id,
            'product_name': pi.product.name if pi.product else '',
            'brand':        pi.product.brand if pi.product else '',
            'available':    pi.count,
        })

    return jsonify({
        'total_donated':   pool.total_donated,
        'total_dispensed': pool.total_dispensed,
        'total_available': pool.total_available,
        'donated_today':   today_total,
        'people_helped':   Transaction.query.filter(
            Transaction.type.in_(['free_claim', 'sponsor_match'])
        ).count(),
        'product_breakdown': breakdown,
    }), 200


# ─────────────────────────────────────────────
#  LIVE CARE NETWORK
# ─────────────────────────────────────────────

@app.route('/api/livecare/signals', methods=['GET'])
def get_live_signals():
    # Expire old signals
    expired = NeedSignal.query.filter(
        NeedSignal.status == 'open',
        NeedSignal.expires_at < datetime.utcnow()
    ).all()
    for s in expired:
        s.status = 'expired'
    if expired:
        db.session.commit()

    area = request.args.get('area', '')
    q = NeedSignal.query.filter_by(status='open')
    if area:
        q = q.filter(NeedSignal.area.ilike(f'%{area}%'))

    signals = q.order_by(desc(NeedSignal.created_at)).limit(30).all()

    # Stats
    total_open = NeedSignal.query.filter_by(status='open').count()
    recent_matched = NeedSignal.query.filter(
        NeedSignal.status == 'matched',
        NeedSignal.fulfilled_at >= datetime.utcnow() - timedelta(minutes=10)
    ).count()

    matched_sample = NeedSignal.query.filter(
        NeedSignal.status == 'matched',
        NeedSignal.fulfilled_at.isnot(None)
    ).limit(50).all()
    avg_resp = None
    if matched_sample:
        times = [(s.fulfilled_at - s.created_at).total_seconds() / 60 for s in matched_sample]
        avg_resp = round(sum(times) / len(times), 1)

    return jsonify({
        'signals':            [s.to_dict() for s in signals],
        'total_open':         total_open,
        'recently_matched':   recent_matched,
        'avg_response_time_mins': avg_resp,
    }), 200


@app.route('/api/livecare/signal', methods=['POST'])
def create_need_signal():
    """
    Post a need signal. Includes user location + dynamically resolved nearest pod.
    """
    data = request.get_json() or {}
    session_id = data.get('session_id')
    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400

    lat = data.get('lat')
    lng = data.get('lng')

    # 15-min rate limit
    recent = NeedSignal.query.filter(
        NeedSignal.session_id == session_id,
        NeedSignal.status == 'open',
        NeedSignal.created_at >= datetime.utcnow() - timedelta(minutes=15)
    ).first()
    if recent:
        return jsonify({'error': 'You already have an active request. Please wait.'}), 429

    area = data.get('area', '')
    if not area and lat and lng:
        area, _ = reverse_geocode(float(lat), float(lng))

    product_id = data.get('product_id')
    nearest_machine = None
    if lat and lng:
        pid = int(product_id) if product_id else None
        nearest_machine, _ = find_nearest_machine_with_stock(float(lat), float(lng), pid, 1)

    expires = datetime.utcnow() + timedelta(minutes=30)
    signal = NeedSignal(
        session_id=session_id,
        area=area,
        user_lat=float(lat) if lat else None,
        user_lng=float(lng) if lng else None,
        nearest_machine_id=nearest_machine.id if nearest_machine else None,
        brand=data.get('brand'),
        product_type=data.get('product_type'),
        product_id=int(product_id) if product_id else None,
        qty=max(1, min(3, int(data.get('qty', 1)))),
        status='open',
        expires_at=expires,
    )
    db.session.add(signal)
    db.session.commit()

    return jsonify({
        'success': True,
        'signal': signal.to_dict(),
        'message': 'Your request is live. A sponsor will reach out shortly 💝',
    }), 201


@app.route('/api/livecare/sponsor/<int:signal_id>', methods=['POST'])
def sponsor_signal(signal_id):
    """
    Sponsor a need signal.
    sponsor_method:
      'digital'      → dispatch from community pool to person's nearest pod
      'physical'     → sponsor physically goes to person / nearest pod
      'subscription' → sponsor uses their subscription pad
    """
    data = request.get_json() or {}
    sponsor_sid = data.get('session_id')
    if not sponsor_sid:
        return jsonify({'error': 'Session ID required'}), 400

    signal = NeedSignal.query.get_or_404(signal_id)
    if signal.status != 'open':
        return jsonify({'error': 'This request is no longer available'}), 400
    if signal.expires_at < datetime.utcnow():
        signal.status = 'expired'
        db.session.commit()
        return jsonify({'error': 'This request has expired'}), 400
    if signal.session_id == sponsor_sid:
        return jsonify({'error': 'You cannot sponsor your own request'}), 400

    method = data.get('sponsor_method', 'digital')   # digital | physical | subscription
    sponsor_anon = get_or_create_session(sponsor_sid)
    pool = get_community_pool()

    amount_paid = 0

    if method == 'digital':
        if pool.total_available < signal.qty:
            return jsonify({'error': 'Community pool is low. Please donate pads first!'}), 400
        pool.total_available -= signal.qty
        pool.total_dispensed += signal.qty

        # Credit nearest machine sponsored stock if available
        if signal.nearest_machine_id and signal.product_id:
            inv = Inventory.query.filter_by(
                machine_id=signal.nearest_machine_id,
                product_id=signal.product_id
            ).first()
            if inv:
                inv.sponsored_quantity += signal.qty

        txn_type = 'sponsor_match'
        pay_method = 'community_pool'

    elif method == 'subscription':
        sub = Subscription.query.filter_by(session_id=sponsor_sid, status='active').first()
        if not sub or not sub.is_valid():
            return jsonify({'error': 'You do not have a valid subscription to use'}), 400
        if sub.pads_remaining < signal.qty:
            return jsonify({'error': f'Only {sub.pads_remaining} pads left in your subscription'}), 400
        sub.pads_remaining -= signal.qty
        txn_type = 'sponsor_match'
        pay_method = 'subscription'

    else:  # physical
        txn_type = 'physical_delivery'
        pay_method = 'physical'

    signal.status       = 'matched'
    signal.sponsored_by = sponsor_sid
    signal.sponsor_method = method
    signal.fulfilled_at = datetime.utcnow()

    sponsor_anon.total_sponsored += signal.qty
    award_badges(sponsor_anon)

    product_id = signal.product_id or 1
    txn = Transaction(
        transaction_id=generate_transaction_id(),
        session_id=sponsor_sid,
        machine_id=signal.nearest_machine_id,
        product_id=product_id,
        amount=amount_paid,
        quantity=signal.qty,
        type=txn_type,
        payment_method=pay_method,
        status='completed',
        notes=f'Sponsored signal #{signal_id} for {signal.area}',
    )
    db.session.add(txn)
    db.session.commit()

    machine_info = None
    if signal.nearest_machine:
        machine_info = {
            'name':     signal.nearest_machine.name,
            'location': signal.nearest_machine.location,
            'area':     signal.nearest_machine.area,
            'latitude': signal.nearest_machine.latitude,
            'longitude': signal.nearest_machine.longitude,
        }

    return jsonify({
        'success': True,
        'message': 'You successfully sponsored this request ❤️',
        'signal': signal.to_dict(),
        'recipient_nearest_machine': machine_info,
        'pool_remaining': pool.total_available,
        'sponsor_method': method,
    }), 200


@app.route('/api/livecare/stats', methods=['GET'])
def get_livecare_stats():
    today = datetime.utcnow().date()
    today_req = NeedSignal.query.filter(func.date(NeedSignal.created_at) == today).count()
    today_ful = NeedSignal.query.filter(
        func.date(NeedSignal.fulfilled_at) == today,
        NeedSignal.status == 'matched'
    ).count()

    top = (db.session.query(AnonymousSession.session_id, AnonymousSession.total_sponsored, AnonymousSession.area)
           .filter(AnonymousSession.total_sponsored > 0)
           .order_by(desc(AnonymousSession.total_sponsored))
           .limit(10).all())

    return jsonify({
        'requests_today':         today_req,
        'fulfilled_today':        today_ful,
        'fulfillment_rate_pct':   round(today_ful / today_req * 100) if today_req else 0,
        'total_all_time':         NeedSignal.query.count(),
        'total_fulfilled':        NeedSignal.query.filter_by(status='matched').count(),
        'top_supporters': [{
            'id':              s.session_id[:8],
            'total_sponsored': s.total_sponsored,
            'area':            s.area or 'Anonymous',
        } for s in top],
    }), 200


# ─────────────────────────────────────────────
#  PHARMACY FINDER (accurate via Overpass + Nominatim)
# ─────────────────────────────────────────────

@app.route('/api/pharmacies/nearby', methods=['POST'])
def find_nearby_pharmacies():
    data = request.get_json() or {}
    lat    = data.get('lat')
    lng    = data.get('lng')
    radius = int(data.get('radius', 2000))   # metres

    if lat is None or lng is None:
        return jsonify({'error': 'Location (lat, lng) required'}), 400

    lat, lng = float(lat), float(lng)

    # Clamp radius to reasonable range
    radius = max(500, min(radius, 10000))

    query = f"""
[out:json][timeout:15];
(
  node["amenity"="pharmacy"](around:{radius},{lat},{lng});
  way["amenity"="pharmacy"](around:{radius},{lat},{lng});
);
out center 20;
"""
    url = f"https://overpass-api.de/api/interpreter?data={urllib.parse.quote(query.strip())}"

    pharmacies = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Sahayaa/3.0 sahayaa@example.com'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            osm = json.loads(resp.read().decode())

        for elem in osm.get('elements', []):
            tags = elem.get('tags', {})
            # Support both node (lat/lon) and way (center)
            p_lat = elem.get('lat') or (elem.get('center') or {}).get('lat')
            p_lon = elem.get('lon') or (elem.get('center') or {}).get('lon')
            if not p_lat or not p_lon:
                continue

            dist_km = haversine_km(lat, lng, float(p_lat), float(p_lon))

            # Build address from OSM tags
            addr_parts = [
                tags.get('addr:housenumber', ''),
                tags.get('addr:street', ''),
                tags.get('addr:suburb', '') or tags.get('addr:city', ''),
            ]
            address = ', '.join(p for p in addr_parts if p) or 'Address unavailable'

            pharmacies.append({
                'id':           str(elem.get('id')),
                'name':         tags.get('name') or tags.get('brand') or 'Pharmacy',
                'address':      address,
                'distance_km':  round(dist_km, 2),
                'phone':        tags.get('phone') or tags.get('contact:phone') or None,
                'timings':      tags.get('opening_hours') or 'Timings unavailable',
                'lat':          float(p_lat),
                'lng':          float(p_lon),
                'source':       'osm',
            })

    except Exception as e:
        app.logger.warning(f"Overpass API error: {e}")

    pharmacies.sort(key=lambda x: x['distance_km'])

    return jsonify({
        'pharmacies': pharmacies,
        'total':      len(pharmacies),
        'radius_m':   radius,
        'location':   {'lat': lat, 'lng': lng},
        'source':     'openstreetmap',
    }), 200


# ─────────────────────────────────────────────
#  STATS & INSIGHTS
# ─────────────────────────────────────────────

@app.route('/api/stats/overview', methods=['GET'])
def get_overview_stats():
    pool = CommunityPool.query.first()
    total_dispensed = Transaction.query.filter(
        Transaction.type.in_(['purchase', 'free_claim', 'sponsor_match', 'subscription_use'])
    ).count()
    total_donated_pads = db.session.query(func.sum(Donation.qty)).scalar() or 0
    cities = db.session.query(Machine.area).distinct().count()
    people_helped = db.session.query(
        Transaction.session_id
    ).filter(Transaction.session_id.isnot(None)).distinct().count()

    return jsonify({
        'total_pads_dispensed':  total_dispensed,
        'total_donations':       Donation.query.count(),
        'total_donated_pads':    int(total_donated_pads),
        'pool_available':        pool.total_available if pool else 0,
        'cities_covered':        cities,
        'people_helped':         people_helped,
        'active_machines':       Machine.query.filter_by(status='active').count(),
        'total_machines':        Machine.query.count(),
        'active_subscribers':    Subscription.query.filter_by(status='active').count(),
    }), 200


@app.route('/api/stats/leaderboard', methods=['GET'])
def get_leaderboard():
    top = (db.session.query(AnonymousSession)
           .filter(or_(AnonymousSession.total_donated > 0, AnonymousSession.total_sponsored > 0))
           .order_by(desc(AnonymousSession.total_donated + AnonymousSession.total_sponsored))
           .limit(20).all())

    return jsonify([{
        'id':             a.session_id[:8],
        'total_donated':  a.total_donated,
        'total_sponsored': a.total_sponsored,
        'total_impact':   a.total_donated + a.total_sponsored,
        'area':           a.area or 'Anonymous',
        'badges':         [b for b in a.badges.split(',') if b] if a.badges else [],
    } for a in top]), 200


# ─────────────────────────────────────────────
#  TRANSACTIONS
# ─────────────────────────────────────────────

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    sid        = request.headers.get('X-Session-Id')
    machine_id = request.args.get('machine_id', type=int)
    page       = request.args.get('page', 1, type=int)
    per_page   = 20

    q = Transaction.query
    if sid:        q = q.filter_by(session_id=sid)
    if machine_id: q = q.filter_by(machine_id=machine_id)
    paged = q.order_by(desc(Transaction.timestamp)).paginate(
        page=page, per_page=per_page, error_out=False)

    return jsonify({
        'transactions':  [t.to_dict() for t in paged.items],
        'total':         paged.total,
        'pages':         paged.pages,
        'current_page':  page,
    }), 200


# ─────────────────────────────────────────────
#  ADMIN API
# ─────────────────────────────────────────────

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    total_machines  = Machine.query.count()
    active_machines = Machine.query.filter_by(status='active').count()
    total_txns      = Transaction.query.count()
    total_revenue   = db.session.query(func.sum(Transaction.amount)).scalar() or 0

    most_used = (db.session.query(Machine.name, Machine.location,
                                  func.count(Transaction.id).label('txn_count'))
                 .join(Transaction, Machine.id == Transaction.machine_id)
                 .group_by(Machine.id)
                 .order_by(desc('txn_count'))
                 .limit(5).all())

    low_stock = Inventory.query.filter(Inventory.quantity <= 5).all()

    today = datetime.utcnow().date()
    today_txns = Transaction.query.filter(
        func.date(Transaction.timestamp) == today
    ).count()
    today_rev = db.session.query(func.sum(Transaction.amount)).filter(
        func.date(Transaction.timestamp) == today
    ).scalar() or 0

    return jsonify({
        'overview': {
            'total_machines':   total_machines,
            'active_machines':  active_machines,
            'total_txns':       total_txns,
            'total_revenue_inr': round(float(total_revenue), 2),
            'today_txns':       today_txns,
            'today_revenue_inr': round(float(today_rev), 2),
            'active_subscribers': Subscription.query.filter_by(status='active').count(),
        },
        'most_used_machines': [
            {'name': r.name, 'location': r.location, 'txn_count': r.txn_count}
            for r in most_used
        ],
        'low_stock_alerts': [{
            'inventory_id': i.id,
            'machine_id':   i.machine_id,
            'machine_name': i.machine.name if i.machine else '',
            'product_id':   i.product_id,
            'product_name': i.product.name if i.product else '',
            'quantity':     i.quantity,
            'sponsored':    i.sponsored_quantity,
        } for i in low_stock],
    }), 200


@app.route('/api/admin/machines', methods=['GET'])
def admin_list_machines():
    """Full machine listing with complete inventory for admin panel."""
    machines = Machine.query.order_by(Machine.id).all()
    result = []
    for m in machines:
        d = m.to_dict()
        d['inventory'] = [i.to_dict() for i in m.inventory_items]
        d['transaction_count'] = Transaction.query.filter_by(machine_id=m.id).count()
        result.append(d)
    return jsonify(result), 200


@app.route('/api/admin/donations', methods=['GET'])
def admin_donations():
    page = request.args.get('page', 1, type=int)
    paged = Donation.query.order_by(desc(Donation.created_at)).paginate(
        page=page, per_page=30, error_out=False)
    return jsonify({
        'donations': [d.to_dict() for d in paged.items],
        'total': paged.total,
        'pages': paged.pages,
    }), 200


@app.route('/api/admin/pool', methods=['GET'])
def admin_pool():
    pool = CommunityPool.query.first() or CommunityPool()
    items = GlobalSponsoredPool.query.all()
    return jsonify({
        'pool': pool.to_dict(),
        'product_breakdown': [i.to_dict() for i in items],
    }), 200


# ─────────────────────────────────────────────
#  GEOCODE HELPER ENDPOINT (for frontend)
# ─────────────────────────────────────────────

@app.route('/api/geocode/reverse', methods=['POST'])
def geocode_reverse():
    data = request.get_json() or {}
    lat = data.get('lat')
    lng = data.get('lng')
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400
    area, city = reverse_geocode(float(lat), float(lng))
    return jsonify({'area': area, 'city': city}), 200


# ─────────────────────────────────────────────
#  DATABASE SEED
# ─────────────────────────────────────────────

def seed_database():
    if Product.query.count() > 0:
        return

    products = [
        Product(brand='Whisper',   name='Regular',      tagline='Gentle everyday protection',
                color_accent='#E91E8C', price=45.0,  type='Regular',   is_active=True,
                description='Trusted daily protection'),
        Product(brand='Whisper',   name='XL Wings',     tagline='Extra coverage for heavy days',
                color_accent='#E91E8C', price=50.0,  type='XL',        is_active=True,
                description='For heavy flow days'),
        Product(brand='Whisper',   name='Overnight',    tagline='Sleep peacefully all night',
                color_accent='#E91E8C', price=55.0,  type='Overnight', is_active=True,
                description='8+ hours overnight protection'),
        Product(brand='Whisper',   name='Ultra Thin',   tagline='Invisible comfort',
                color_accent='#E91E8C', price=48.0,  type='Ultra',     is_active=True,
                description='Discreet and ultra-absorbent'),

        Product(brand='Stayfree',  name='Regular',      tagline='Stay confident all day',
                color_accent='#F06292', price=42.0,  type='Regular',   is_active=True,
                description='Cottony soft cover'),
        Product(brand='Stayfree',  name='XL Wings',     tagline='Secure fit with anti-leak wings',
                color_accent='#F06292', price=48.0,  type='XL',        is_active=True,
                description='Anti-leak side wings'),
        Product(brand='Stayfree',  name='Secure Nights',tagline='Worry-free sleep',
                color_accent='#F06292', price=52.0,  type='Overnight', is_active=True,
                description='For peaceful nights'),

        Product(brand='Sofy',      name='Body Fit',     tagline='Perfectly shaped for you',
                color_accent='#FF80AB', price=44.0,  type='Regular',   is_active=True,
                description='Anatomically shaped'),
        Product(brand='Sofy',      name='Anti-Bacterial',tagline='Germ-protection with neem',
                color_accent='#FF80AB', price=49.0,  type='XL',        is_active=True,
                description='With neem extract'),

        Product(brand='Carefree',  name='Panty Liners', tagline='Fresh all day, every day',
                color_accent='#4FC3F7', price=35.0,  type='Liner',     is_active=True,
                description='Daily freshness liner'),
        Product(brand='Carefree',  name='Ultra Thin',   tagline='Invisible protection',
                color_accent='#4FC3F7', price=40.0,  type='Ultra',     is_active=True,
                description='Light flow days'),
    ]
    for p in products:
        db.session.add(p)
    db.session.flush()

    # Mumbai-area machines with real coordinates — area set dynamically on first run
    # (reverse_geocode will be called at runtime, not at seed)
    machines_seed = [
        dict(name='CST Station Pod',    location="Platform 1, Women's Waiting Room",
             lat=18.9402, lon=72.8355, is_free=False),
        dict(name='Andheri Metro Pod',  location='Concourse Level, Women\'s Restroom',
             lat=19.1197, lon=72.8465, is_free=True),
        dict(name='Dadar Station Pod',  location='Upper Level, Platform 6',
             lat=19.0181, lon=72.8417, is_free=False),
        dict(name='Bandra Station Pod', location='Gate 2, Women\'s Section',
             lat=19.0596, lon=72.8397, is_free=False),
        dict(name='Thane Station Pod',  location='Foot Overbridge, Women\'s Corner',
             lat=19.1838, lon=72.9680, is_free=True),
        dict(name='Seawoods Pod',       location='Level 2, Food Court Restroom',
             lat=19.0180, lon=73.0134, is_free=False),
    ]

    machine_objs = []
    for md in machines_seed:
        # Dynamically geocode the area for each seeded machine
        area, _ = reverse_geocode(md['lat'], md['lon'])
        m = Machine(
            name=md['name'], location=md['location'], area=area,
            latitude=md['lat'], longitude=md['lon'],
            status='active', is_free_zone=md['is_free']
        )
        db.session.add(m)
        machine_objs.append(m)
    db.session.flush()

    for machine in machine_objs:
        for product in products:
            qty  = random.randint(8, 30)
            spon = random.randint(0, 5) if machine.is_free_zone else random.randint(0, 2)
            db.session.add(Inventory(
                machine_id=machine.id, product_id=product.id,
                quantity=qty, sponsored_quantity=spon,
                last_restocked=datetime.utcnow()
            ))

    pool = CommunityPool(total_donated=200, total_available=60, total_dispensed=140)
    db.session.add(pool)

    # Seed global sponsored pool
    for p in products[:4]:
        db.session.add(GlobalSponsoredPool(product_id=p.id, count=5))

    # Seed admin user
    admin = User(email='admin@sahayaa.in', name='Admin', role='admin')
    admin.set_password('admin123')
    db.session.add(admin)

    db.session.commit()
    print("✅ Sahayaa DB seeded — areas resolved via live reverse-geocoding")


# ─────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_database()
    app.run(debug=True, port=5001)
