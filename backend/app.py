import uuid
import json
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import func, desc
from models import db, User, Machine, Product, Inventory, Transaction, GlobalSponsoredPool
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
jwt = JWTManager(app)
CORS(app)


# ─────────────────────────────────────────────
#  Helper: optional JWT (allows guest access)
# ─────────────────────────────────────────────
def get_current_user_optional():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            return User.query.get(int(identity))
    except Exception:
        pass
    return None


def generate_transaction_id():
    return f"SAH-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4()).upper()[:8]}"


# ─────────────────────────────────────────────
#  API BASE ROUTE
# ─────────────────────────────────────────────
@app.route('/')
def api_root():
    return jsonify({
        'name': 'Sahayaa API',
        'status': 'online',
        'version': '2.0.0',
        'docs': '/api/docs (future)'
    }), 200


@app.route('/api/status')
def status():
    return jsonify({'status': 'ok'}), 200


# ─────────────────────────────────────────────
#  AUTH API
# ─────────────────────────────────────────────
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name', '').strip()
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')
    role = data.get('role', 'user')

    if not all([name, email, password]):
        return jsonify({'error': 'All fields are required'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    hashed_pw = generate_password_hash(password)
    user = User(name=name, email=email, password=hashed_pw, role=role)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'message': 'Registration successful', 'token': token, 'user': user.to_dict()}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 200


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict()), 200


# ─────────────────────────────────────────────
#  MACHINES API
# ─────────────────────────────────────────────
@app.route('/api/machines', methods=['GET'])
def get_machines():
    search = request.args.get('search', '').strip()
    status_filter = request.args.get('status', '')

    query = Machine.query
    if search:
        query = query.filter(
            (Machine.name.ilike(f'%{search}%')) |
            (Machine.location.ilike(f'%{search}%')) |
            (Machine.area.ilike(f'%{search}%'))
        )
    if status_filter:
        query = query.filter_by(status=status_filter)

    machines = query.all()
    return jsonify([m.to_dict() for m in machines]), 200


@app.route('/api/machines/<int:machine_id>', methods=['GET'])
def get_machine(machine_id):
    machine = Machine.query.get_or_404(machine_id)
    data = machine.to_dict()
    # Include product inventory
    inventory = []
    for item in machine.inventory_items:
        inv = item.to_dict()
        inventory.append(inv)
    data['inventory'] = inventory
    return jsonify(data), 200


@app.route('/api/machines/emergency', methods=['GET'])
def emergency_machine():
    """Find nearest available machine (with stock)"""
    machines = Machine.query.filter_by(status='active').all()
    # Prioritize: free zones with stock > regular with stock
    free_with_stock = [m for m in machines if m.is_free_zone and m.get_stock_status() != 'out_of_stock']
    regular_with_stock = [m for m in machines if not m.is_free_zone and m.get_stock_status() != 'out_of_stock']

    if free_with_stock:
        return jsonify({'machine': free_with_stock[0].to_dict(), 'type': 'free_zone'}), 200
    elif regular_with_stock:
        return jsonify({'machine': regular_with_stock[0].to_dict(), 'type': 'regular'}), 200
    else:
        # Fallback suggestions
        return jsonify({
            'machine': None,
            'fallback': [
                'Contact station helpdesk / information counter',
                'Ask at the nearest pharmacy or medical store',
                'Visit the nearest women\'s restroom for assistance',
                'Call Sahayaa helpline: 1800-SAH-HELP'
            ]
        }), 200


@app.route('/api/machines', methods=['POST'])
@jwt_required()
def create_machine():
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    machine = Machine(
        name=data['name'],
        location=data['location'],
        area=data.get('area', ''),
        latitude=data.get('latitude'),
        longitude=data.get('longitude'),
        status=data.get('status', 'active'),
        is_free_zone=data.get('is_free_zone', False)
    )
    db.session.add(machine)
    db.session.commit()
    return jsonify(machine.to_dict()), 201


@app.route('/api/machines/<int:machine_id>', methods=['PUT'])
@jwt_required()
def update_machine(machine_id):
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    machine = Machine.query.get_or_404(machine_id)
    data = request.get_json()
    machine.name = data.get('name', machine.name)
    machine.location = data.get('location', machine.location)
    machine.area = data.get('area', machine.area)
    machine.status = data.get('status', machine.status)
    machine.is_free_zone = data.get('is_free_zone', machine.is_free_zone)
    machine.latitude = data.get('latitude', machine.latitude)
    machine.longitude = data.get('longitude', machine.longitude)
    db.session.commit()
    return jsonify(machine.to_dict()), 200


@app.route('/api/machines/<int:machine_id>', methods=['DELETE'])
@jwt_required()
def delete_machine(machine_id):
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    machine = Machine.query.get_or_404(machine_id)
    db.session.delete(machine)
    db.session.commit()
    return jsonify({'message': 'Machine deleted'}), 200


# ─────────────────────────────────────────────
#  PRODUCTS API
# ─────────────────────────────────────────────
@app.route('/api/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([p.to_dict() for p in products]), 200


@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get_or_404(product_id)
    return jsonify(product.to_dict()), 200


@app.route('/api/products', methods=['POST'])
@jwt_required()
def create_product():
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    product = Product(
        name=data['name'],
        description=data.get('description', ''),
        price=float(data['price']),
        type=data.get('type', 'Regular'),
        image_url=data.get('image_url', ''),
        features=data.get('features', '')
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@app.route('/api/products/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    product = Product.query.get_or_404(product_id)
    data = request.get_json()
    product.name = data.get('name', product.name)
    product.description = data.get('description', product.description)
    product.price = float(data.get('price', product.price))
    product.type = data.get('type', product.type)
    product.features = data.get('features', product.features)
    db.session.commit()
    return jsonify(product.to_dict()), 200


@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Product deleted'}), 200


# ─────────────────────────────────────────────
#  INVENTORY API
# ─────────────────────────────────────────────
@app.route('/api/inventory', methods=['GET'])
def get_all_inventory():
    items = Inventory.query.all()
    return jsonify([i.to_dict() for i in items]), 200


@app.route('/api/inventory/machine/<int:machine_id>', methods=['GET'])
def get_machine_inventory(machine_id):
    items = Inventory.query.filter_by(machine_id=machine_id).all()
    return jsonify([i.to_dict() for i in items]), 200


@app.route('/api/inventory', methods=['POST'])
@jwt_required()
def set_inventory():
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    machine_id = int(data['machine_id'])
    product_id = int(data['product_id'])
    quantity = int(data['quantity'])

    if quantity < 0:
        return jsonify({'error': 'Quantity cannot be negative'}), 400

    item = Inventory.query.filter_by(machine_id=machine_id, product_id=product_id).first()
    if item:
        item.quantity = quantity
    else:
        item = Inventory(machine_id=machine_id, product_id=product_id, quantity=quantity)
        db.session.add(item)

    db.session.commit()
    return jsonify(item.to_dict()), 200


@app.route('/api/products/brands', methods=['GET'])
def get_brands():
    brands = db.session.query(
        Product.brand, Product.tagline, Product.color_accent
    ).filter(Product.brand != None).distinct().all()
    
    return jsonify([{
        'id': b.brand.lower().replace(' ', '_'),
        'name': b.brand,
        'tagline': b.tagline,
        'color': b.color_accent
    } for b in brands]), 200


# ─────────────────────────────────────────────
#  VENDING / TRANSACTIONS API
# ─────────────────────────────────────────────
@app.route('/api/vend', methods=['POST'])
def vend_product():
    current_user = get_current_user_optional()
    data = request.get_json()
    machine_id = int(data['machine_id'])
    product_id = int(data['product_id'])
    quantity = int(data.get('quantity', 1))
    sponsored_added = bool(data.get('sponsored_added', False))
    sponsored_price = float(data.get('sponsored_price', 0.0))
    session_id = data.get('session_id')

    machine = Machine.query.get(machine_id)
    if not machine or machine.status != 'active':
        return jsonify({'error': 'Machine is not active'}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    # Lock inventory row for update
    inv = Inventory.query.filter_by(
        machine_id=machine_id, product_id=product_id
    ).with_for_update().first()

    if not inv or inv.quantity < quantity:
        return jsonify({'error': f'Only {inv.quantity if inv else 0} packs available'}), 409

    # Determine price
    unit_price = 0.0 if machine.is_free_zone else product.price
    base_amount = unit_price * quantity
    grand_total = base_amount + (sponsored_price if sponsored_added else 0)

    # Deduct inventory
    inv.quantity -= quantity

    # Create transaction
    txn = Transaction(
        transaction_id=generate_transaction_id(),
        user_id=current_user.id if current_user else None,
        machine_id=machine_id,
        product_id=product_id,
        amount=base_amount,
        quantity=quantity,
        unit_price=unit_price,
        type='purchase',
        sponsored_added=sponsored_added,
        sponsored_price=sponsored_price,
        grand_total=grand_total,
        session_id=session_id,
        status='completed',
        payment_method='simulated'
    )
    db.session.add(txn)

    # If user sponsored a pad during checkout, update global pool
    if sponsored_added:
        pool_item = GlobalSponsoredPool.query.filter_by(product_id=product_id).first()
        if pool_item:
            pool_item.count += 1
        else:
            pool_item = GlobalSponsoredPool(product_id=product_id, count=1)
            db.session.add(pool_item)

    # Award badges if user is logged in
    if current_user:
        user_txn_count = Transaction.query.filter_by(user_id=current_user.id).count()
        badges = set(current_user.badges.split(',')) if current_user.badges else set()
        if user_txn_count == 0:
            badges.add('first_use')
        if user_txn_count >= 4:
            badges.add('frequent_user')
        if sponsored_added:
            badges.add('sponsor')
            current_user.sponsor_count += 1
        badges.discard('')
        current_user.badges = ','.join(badges)

    db.session.commit()

    return jsonify({
        'success': True,
        'transaction': txn.to_dict(),
        'remaining_stock': inv.quantity,
        'machine_name': machine.name,
        'product_name': product.name,
        'amount': base_amount
    }), 200


@app.route('/api/sponsor', methods=['POST'])
def sponsor_pad():
    current_user = get_current_user_optional()
    data = request.get_json()
    machine_id = int(data.get('machine_id', 0))
    amount = float(data.get('amount', 45.0))
    product_id = data.get('product_id')

    # Find closest matching product if not specified
    if product_id:
        p = Product.query.get(product_id)
    else:
        p = Product.query.order_by(Product.price).first()

    if not p:
        return jsonify({'error': 'No products available to sponsor'}), 404

    # Increment global pool
    pool_item = GlobalSponsoredPool.query.filter_by(product_id=p.id).first()
    if pool_item:
        pool_item.count += 1
    else:
        pool_item = GlobalSponsoredPool(product_id=p.id, count=1)
        db.session.add(pool_item)

    # If machine provided, also check if we can increment physical sponsored stock
    if machine_id:
        machine = Machine.query.get(machine_id)
        if machine:
            inv = Inventory.query.filter_by(machine_id=machine_id, product_id=p.id).first()
            if inv:
                inv.sponsored_quantity += 1
                machine.sponsored_pads += 1

    # Log sponsorship transaction
    txn = Transaction(
        transaction_id=generate_transaction_id(),
        user_id=current_user.id if current_user else None,
        machine_id=machine_id if machine_id else 1, # default to main pod
        product_id=p.id,
        amount=amount,
        type='sponsor_add',
        grand_total=amount,
        status='sponsored',
        payment_method='simulated'
    )
    db.session.add(txn)

    if current_user:
        current_user.sponsor_count += 1
        badges = set(current_user.badges.split(',')) if current_user.badges else set()
        badges.add('sponsor')
        badges.discard('')
        current_user.badges = ','.join(badges)

    db.session.commit()
    return jsonify({'success': True, 'message': 'Thank you! You sponsored a pad ❤️'}), 200


@app.route('/api/claim-free', methods=['POST'])
def claim_free_pad():
    data = request.get_json()
    machine_id = data.get('machine_id')
    session_id = data.get('session_id')

    # 1. Check specific pod's sponsored stock
    if machine_id:
        invs = Inventory.query.filter(
            Inventory.machine_id == machine_id,
            Inventory.sponsored_quantity > 0
        ).all()
        
        if invs:
            inv = invs[0]
            inv.sponsored_quantity -= 1
            # Log claim
            txn = Transaction(
                transaction_id=generate_transaction_id(),
                machine_id=machine_id,
                product_id=inv.product_id,
                amount=0,
                type='free_claim',
                session_id=session_id,
                status='completed'
            )
            db.session.add(txn)
            db.session.commit()
            return jsonify({
                'success': True, 
                'product_name': inv.product.name,
                'message': 'Your free pad is being dispensed 🎁'
            }), 200

    # 2. Check global pool
    pool_item = GlobalSponsoredPool.query.filter(GlobalSponsoredPool.count > 0).first()
    if pool_item:
        pool_item.count -= 1
        # If machine provided, we deduct from regular stock if available but mark as free
        # or we just dispense if we assume the machine has physical stock matching the pool
        # For simplicity, we assume if it's in the global pool, any active machine can dispense it
        # and we deduct from the FIRST machine that HAS this product in stock
        inv = Inventory.query.filter(
            Inventory.product_id == pool_item.product_id,
            Inventory.quantity > 0
        ).first()

        if inv:
            inv.quantity -= 1
            txn = Transaction(
                transaction_id=generate_transaction_id(),
                machine_id=inv.machine_id,
                product_id=inv.product_id,
                amount=0,
                type='free_claim',
                session_id=session_id,
                status='completed'
            )
            db.session.add(txn)
            db.session.commit()
            return jsonify({
                'success': True,
                'product_name': pool_item.product.name,
                'message': 'Your free pad (from global pool) is being dispensed 🎁'
            }), 200

    return jsonify({
        'success': False,
        'message': 'No sponsored pads nearby right now. Check back soon 💛'
    }), 404


@app.route('/api/transactions', methods=['GET'])
@jwt_required()
def get_transactions():
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    page = request.args.get('page', 1, type=int)
    machine_id = request.args.get('machine_id', type=int)
    per_page = 20
    
    query = Transaction.query
    if machine_id:
        query = query.filter_by(machine_id=machine_id)
        
    txns = query.order_by(desc(Transaction.timestamp)).paginate(page=page, per_page=per_page)
    return jsonify({
        'transactions': [t.to_dict() for t in txns.items],
        'total': txns.total,
        'pages': txns.pages,
        'current_page': page
    }), 200


# ─────────────────────────────────────────────
#  ADMIN INSIGHTS API
# ─────────────────────────────────────────────
@app.route('/api/admin/stats', methods=['GET'])
@jwt_required()
def admin_stats():
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    total_machines = Machine.query.count()
    active_machines = Machine.query.filter_by(status='active').count()
    total_transactions = Transaction.query.count()
    total_revenue = db.session.query(func.sum(Transaction.amount)).scalar() or 0

    # Most used machines
    most_used = db.session.query(
        Machine.name,
        Machine.location,
        func.count(Transaction.id).label('count')
    ).join(Transaction, Machine.id == Transaction.machine_id)\
     .group_by(Machine.id)\
     .order_by(desc('count'))\
     .limit(5).all()

    # Peak usage hours
    peak_hours = db.session.query(
        func.strftime('%H', Transaction.timestamp).label('hour'),
        func.count(Transaction.id).label('count')
    ).group_by('hour').order_by(desc('count')).limit(5).all()

    # Low stock alerts (quantity <= 5)
    low_stock = Inventory.query.filter(Inventory.quantity <= 5).all()
    low_stock_data = []
    for item in low_stock:
        low_stock_data.append({
            'machine': item.machine.name if item.machine else '',
            'product': item.product.name if item.product else '',
            'quantity': item.quantity
        })

    # Monthly transactions for chart
    monthly = db.session.query(
        func.strftime('%Y-%m', Transaction.timestamp).label('month'),
        func.count(Transaction.id).label('count'),
        func.sum(Transaction.amount).label('revenue')
    ).group_by('month').order_by('month').limit(12).all()

    return jsonify({
        'overview': {
            'total_machines': total_machines,
            'active_machines': active_machines,
            'total_transactions': total_transactions,
            'total_revenue': round(float(total_revenue), 2)
        },
        'most_used_machines': [{'name': r.name, 'location': r.location, 'count': r.count} for r in most_used],
        'peak_hours': [{'hour': r.hour, 'count': r.count} for r in peak_hours],
        'low_stock_alerts': low_stock_data,
        'monthly_data': [{'month': r.month, 'count': r.count, 'revenue': float(r.revenue or 0)} for r in monthly]
    }), 200


@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
def get_all_users():
    user_id = get_jwt_identity()
    admin = User.query.get(int(user_id))
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200


# ─────────────────────────────────────────────
#  DATABASE SEED
# ─────────────────────────────────────────────
def seed_database():
    """Seed database with demo data"""
    if User.query.count() > 0:
        return

    # Admin user
    admin = User(
        name='Sahayaa Admin',
        email='admin@sahayaa.in',
        password=generate_password_hash('admin123'),
        role='admin'
    )
    db.session.add(admin)

    # Demo user
    demo_user = User(
        name='Priya Sharma',
        email='priya@example.com',
        password=generate_password_hash('priya123'),
        role='user'
    )
    db.session.add(demo_user)

    # Products (Extensible Brand + Subtype structure)
    products = [
        # Whisper
        Product(brand='Whisper', name='XL Dry', tagline='Gentle everyday protection', color_accent='#E91E8C', descriptor='Extra length, heavy flow', price=45.0, type='XL', description='Trusted protection since 1983'),
        Product(brand='Whisper', name='XXL Overnight', tagline='Gentle everyday protection', color_accent='#E91E8C', descriptor='Full night protection', price=55.0, type='XXL', description='Maximum coverage for peaceful sleep'),
        Product(brand='Whisper', name='Ultra Thin', tagline='Gentle everyday protection', color_accent='#E91E8C', descriptor='Invisible comfort', price=50.0, type='Ultra', description='Discreet and highly absorbent'),
        Product(brand='Whisper', name='With Wings', tagline='Gentle everyday protection', color_accent='#E91E8C', descriptor='Secure fit, active days', price=48.0, type='Wings', description='Reliable stay-in-place design'),
        
        # Nua
        Product(brand='Nua', name='Regular', tagline='Made for real bodies', color_accent='#9C27B0', descriptor='Everyday softness', price=40.0, type='Regular', description='Chemical-free and breathable'),
        Product(brand='Nua', name='Overnight', tagline='Made for real bodies', color_accent='#9C27B0', descriptor='Long coverage, 8h+', price=58.0, type='Overnight', description='Wider back for total security'),
        
        # Stayfree
        Product(brand='Stayfree', name='XL Wings', tagline='Stay confident, stay free', color_accent='#F06292', descriptor='Secure, high flow', price=42.0, type='XL', description='Cottony soft cover for comfort'),
        Product(brand='Stayfree', name='Secure Nights', tagline='Stay confident, stay free', color_accent='#F06292', descriptor='Anti-leak overnight', price=52.0, type='Overnight', description='Designed for heavy night flow'),
    ]
    for p in products:
        db.session.add(p)
    db.session.flush()

    # Machines with realistic Indian locations
    machines_data = [
        {'name': 'CST Station Pod #01', 'location': 'Chhatrapati Shivaji Maharaj Terminus, Platform 1, Women\'s Waiting Room', 'area': 'Mumbai Central', 'lat': 18.9402, 'lon': 72.8355, 'status': 'active', 'is_free': False},
        {'name': 'Andheri Metro Pod #02', 'location': 'Andheri Metro Station, Concourse Level, Women\'s Restroom', 'area': 'Andheri', 'lat': 19.1197, 'lon': 72.8465, 'status': 'active', 'is_free': True},
        {'name': 'Dadar Station Pod #03', 'location': 'Dadar Railway Station, Upper Level, Platform 6', 'area': 'Dadar', 'lat': 19.0181, 'lon': 72.8417, 'status': 'active', 'is_free': False},
        {'name': 'Bandra Station Pod #04', 'location': 'Bandra Station, Women\'s Section, Gate 2', 'area': 'Bandra', 'lat': 19.0596, 'lon': 72.8397, 'status': 'active', 'is_free': False},
        {'name': 'Borivali Station Pod #05', 'location': 'Borivali Station, Platform 3, Women\'s Waiting Area', 'area': 'Borivali', 'lat': 19.2307, 'lon': 72.8567, 'status': 'inactive', 'is_free': False},
        {'name': 'Thane Station Pod #06', 'location': 'Thane Railway Station, Foot Overbridge, Women\'s Corner', 'area': 'Thane', 'lat': 19.1838, 'lon': 72.9680, 'status': 'active', 'is_free': True},
        {'name': 'Seawoods Pod #07', 'location': 'Seawoods Grand Central Mall, Level 2, Food Court Restroom', 'area': 'Navi Mumbai', 'lat': 19.0180, 'lon': 73.0134, 'status': 'active', 'is_free': False},
        {'name': 'Vashi Station Pod #08', 'location': 'Vashi Station, Women\'s First Class Compartment Waiting Area', 'area': 'Vashi', 'lat': 19.0771, 'lon': 72.9985, 'status': 'active', 'is_free': False},
    ]

    machine_objects = []
    for md in machines_data:
        m = Machine(
            name=md['name'], location=md['location'], area=md['area'],
            latitude=md['lat'], longitude=md['lon'],
            status=md['status'], is_free_zone=md['is_free']
        )
        db.session.add(m)
        machine_objects.append(m)
    db.session.flush()

    # Inventory – assign quantities
    import random
    stock_levels = [20, 15, 3, 12, 0, 8, 18, 10]  # preset stock per machine
    for i, machine in enumerate(machine_objects):
        base = stock_levels[i]
        for product in products:
            qty = max(0, base + random.randint(-2, 2))
            # Set some sponsored stock for testing (10% of regular stock or random 0-2)
            spon_qty = random.randint(0, 3) if qty > 0 else 0
            inv = Inventory(
                machine_id=machine.id, 
                product_id=product.id, 
                quantity=qty,
                sponsored_quantity=spon_qty
            )
            db.session.add(inv)
            
            # Seed global pool for some products
            if random.random() > 0.7:
                pool = GlobalSponsoredPool.query.filter_by(product_id=product.id).first()
                if pool:
                    pool.count += random.randint(1, 5)
                else:
                    pool = GlobalSponsoredPool(product_id=product.id, count=random.randint(1, 5))
                    db.session.add(pool)

    # Sample transactions
    import random as rnd
    from datetime import timedelta
    for _ in range(30):
        hours_ago = rnd.randint(1, 720)
        active_machines = [m for m in machine_objects if m.status == 'active']
        m = rnd.choice(active_machines)
        p = rnd.choice(products)
        txn = Transaction(
            transaction_id=generate_transaction_id(),
            user_id=demo_user.id,
            machine_id=m.id,
            product_id=p.id,
            amount=p.price,
            status='completed',
            payment_method='simulated',
            timestamp=datetime.utcnow() - timedelta(hours=hours_ago)
        )
        db.session.add(txn)

    db.session.commit()
    print("✅ Database seeded with demo data!")


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_database()
    app.run(debug=True, port=5000)
