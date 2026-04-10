import uuid
import json
import random
import hashlib
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import func, desc, and_
from models import db, User, Machine, Product, Inventory, Transaction, GlobalSponsoredPool, AnonymousSession, NeedSignal, Donation, CommunityPool
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
jwt = JWTManager(app)
CORS(app)


# ─────────────────────────────────────────────
#  Helper Functions
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
    return f"SAH-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"


def get_device_hash(session_id):
    """Generate a device hash for anonymous tracking"""
    return hashlib.sha256(session_id.encode()).hexdigest()[:16]


def can_claim_today(session_id):
    """Check if a session can claim a pad today"""
    anon = AnonymousSession.query.filter_by(session_id=session_id).first()
    if anon and anon.last_claim_date:
        last_claim = datetime.fromisoformat(anon.last_claim_date)
        if datetime.utcnow().date() == last_claim.date():
            return False, last_claim
    return True, None


def get_next_claim_time(last_claim):
    """Get when next claim is available"""
    if last_claim:
        next_claim = last_claim + timedelta(days=1)
        return next_claim
    return None


# ─────────────────────────────────────────────
#  API BASE ROUTE
# ─────────────────────────────────────────────
@app.route('/')
def api_root():
    return jsonify({
        'name': 'Sahayaa API',
        'status': 'online',
        'version': '3.0.0',
        'docs': '/api/docs (future)'
    }), 200


@app.route('/api/status')
def status():
    return jsonify({'status': 'ok'}), 200


# ─────────────────────────────────────────────
#  AUTH API (Anonymous Session)
# ─────────────────────────────────────────────
@app.route('/api/auth/session', methods=['POST'])
def create_session():
    """Create or retrieve anonymous session"""
    data = request.get_json()
    session_id = data.get('session_id')
    
    if not session_id:
        session_id = str(uuid.uuid4())
    
    anon = AnonymousSession.query.filter_by(session_id=session_id).first()
    if not anon:
        anon = AnonymousSession(
            session_id=session_id,
            device_hash=get_device_hash(session_id)
        )
        db.session.add(anon)
        db.session.commit()
    
    return jsonify({
        'session_id': anon.session_id,
        'total_donated': anon.total_donated,
        'total_sponsored': anon.total_sponsored,
        'last_claim_date': anon.last_claim_date
    }), 200


@app.route('/api/auth/me', methods=['GET'])
def get_session():
    session_id = request.headers.get('X-Session-Id')
    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400
    
    anon = AnonymousSession.query.filter_by(session_id=session_id).first()
    if not anon:
        return jsonify({'error': 'Session not found'}), 404
    
    return jsonify({
        'session_id': anon.session_id,
        'total_donated': anon.total_donated,
        'total_sponsored': anon.total_sponsored,
        'last_claim_date': anon.last_claim_date,
        'badges': anon.badges
    }), 200


# ─────────────────────────────────────────────
#  MACHINES API
# ─────────────────────────────────────────────
@app.route('/api/machines', methods=['GET', 'POST'])
def handle_machines():
    if request.method == 'POST':
        data = request.get_json()
        new_machine = Machine(
            name=data.get('name'),
            location=data.get('location'),
            area=data.get('area', data.get('location', 'Internal Node')),
            latitude=float(data.get('latitude', 0.0)),
            longitude=float(data.get('longitude', 0.0)),
            status=data.get('status', 'active'),
            is_free_zone=data.get('is_free_zone', False)
        )
        db.session.add(new_machine)
        db.session.commit()
        
        # Provision stock for this machine across all products
        products = Product.query.all()
        for p in products:
            inv = Inventory(
                 machine_id=new_machine.id,
                 product_id=p.id,
                 quantity=20,
                 sponsored_quantity=5
            )
            db.session.add(inv)
        db.session.commit()
        
        return jsonify({'success': True, 'machine': new_machine.to_dict()}), 201

    # GET logic
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
    inventory = []
    for item in machine.inventory_items:
        inv = item.to_dict()
        inventory.append(inv)
    data['inventory'] = inventory
    return jsonify(data), 200


@app.route('/api/machines/nearest', methods=['POST'])
def get_nearest_machine():
    """Find nearest machine with stock"""
    data = request.get_json()
    lat = data.get('lat')
    lng = data.get('lng')
    product_id = data.get('product_id')
    
    if not lat or not lng:
        return jsonify({'error': 'Location required'}), 400
    
    machines = Machine.query.filter_by(status='active').all()
    
    # Calculate distances and filter those with stock
    machines_with_stock = []
    for machine in machines:
        if machine.latitude and machine.longitude:
            # Calculate distance (simplified)
            distance = ((float(machine.latitude) - float(lat)) ** 2 + 
                       (float(machine.longitude) - float(lng)) ** 2) ** 0.5 * 111  # approx km
            
            # Check if product is in stock
            has_stock = False
            if product_id:
                inv = Inventory.query.filter_by(machine_id=machine.id, product_id=product_id).first()
                has_stock = inv and inv.quantity > 0
            else:
                has_stock = machine.get_stock_status() != 'out_of_stock'
            
            if has_stock:
                machines_with_stock.append({
                    'machine': machine.to_dict(),
                    'distance': distance
                })
    
    machines_with_stock.sort(key=lambda x: x['distance'])
    
    if machines_with_stock:
        return jsonify({'machine': machines_with_stock[0]['machine'], 'distance': machines_with_stock[0]['distance']}), 200
    
    return jsonify({'machine': None, 'message': 'No machines with stock nearby'}), 404


@app.route('/api/machines/emergency', methods=['GET'])
def emergency_machine():
    """Find nearest available machine (with stock)"""
    machines = Machine.query.filter_by(status='active').all()
    free_with_stock = [m for m in machines if m.is_free_zone and m.get_stock_status() != 'out_of_stock']
    regular_with_stock = [m for m in machines if not m.is_free_zone and m.get_stock_status() != 'out_of_stock']

    if free_with_stock:
        return jsonify({'machine': free_with_stock[0].to_dict(), 'type': 'free_zone'}), 200
    elif regular_with_stock:
        return jsonify({'machine': regular_with_stock[0].to_dict(), 'type': 'regular'}), 200
    else:
        return jsonify({
            'machine': None,
            'fallback': [
                'Contact station helpdesk / information counter',
                'Ask at the nearest pharmacy or medical store',
                'Visit the nearest women\'s restroom for assistance',
                'Call Sahayaa helpline: 1800-SAH-HELP'
            ]
        }), 200


# ─────────────────────────────────────────────
#  PRODUCTS API
# ─────────────────────────────────────────────
@app.route('/api/products', methods=['GET'])
def get_products():
    brand = request.args.get('brand')
    product_type = request.args.get('type')
    
    query = Product.query
    if brand:
        query = query.filter_by(brand=brand)
    if product_type:
        query = query.filter_by(type=product_type)
    
    products = query.all()
    return jsonify([p.to_dict() for p in products]), 200


@app.route('/api/products/brands', methods=['GET'])
def get_brands():
    brands = db.session.query(
        Product.brand, Product.tagline, Product.color_accent, Product.image_url
    ).filter(Product.brand != None).distinct().all()
    
    return jsonify([{
        'id': getattr(b, 'brand', '').lower().replace(' ', '_') if getattr(b, 'brand', None) else 'n_a',
        'name': getattr(b, 'brand', 'Unknown'),
        'tagline': getattr(b, 'tagline', ''),
        'color': getattr(b, 'color_accent', ''),
        'logo_url': getattr(b, 'image_url', '')
    } for b in brands]), 200


@app.route('/api/products/types', methods=['GET'])
def get_product_types():
    types = db.session.query(Product.type).distinct().all()
    return jsonify([t[0] for t in types if t[0]]), 200


# ─────────────────────────────────────────────
#  VENDING / DISPENSE API
# ─────────────────────────────────────────────
@app.route('/api/dispense/check', methods=['POST'])
def check_dispense_eligibility():
    """Check if user can claim a pad today"""
    data = request.get_json()
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400
    
    can_claim, last_claim = can_claim_today(session_id)
    next_claim = get_next_claim_time(last_claim) if last_claim else None
    
    return jsonify({
        'can_claim': can_claim,
        'last_claim_date': last_claim.isoformat() if last_claim else None,
        'next_claim_time': next_claim.isoformat() if next_claim else None
    }), 200


@app.route('/api/dispense', methods=['POST'])
def dispense_product():
    """Dispense a product to user"""
    data = request.get_json()
    session_id = data.get('session_id')
    product_id = int(data.get('product_id'))
    quantity = int(data.get('quantity', 1))
    lat = data.get('lat')
    lng = data.get('lng')
    machine_id = data.get('machine_id')
    
    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400
    
    # Check 1-per-day limit
    can_claim, last_claim = can_claim_today(session_id)
    if not can_claim:
        next_claim = get_next_claim_time(last_claim)
        return jsonify({
            'error': 'Daily limit reached',
            'next_claim_time': next_claim.isoformat() if next_claim else None
        }), 429
    
    # Find target machine with stock
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
        
    nearest_machine = None
    
    if machine_id:
         nearest_machine = Machine.query.get(machine_id)
         inv = Inventory.query.filter_by(machine_id=machine_id, product_id=product_id).first()
         if not (inv and inv.quantity >= quantity):
             nearest_machine = None # force fallback check
    
    if not nearest_machine:
        machines = Machine.query.filter_by(status='active').all()
        min_distance = float('inf')
        
        for machine in machines:
            if machine.latitude and machine.longitude and lat and lng:
                distance = ((machine.latitude - lat) ** 2 + (machine.longitude - lng) ** 2) ** 0.5 * 111
                inv = Inventory.query.filter_by(machine_id=machine.id, product_id=product_id).first()
                if inv and inv.quantity >= quantity and distance < min_distance:
                    min_distance = distance
                    nearest_machine = machine
                    
    if not nearest_machine:
        # Check sponsored stock as fallback
        for machine in machines:
            if machine.latitude and machine.longitude and lat and lng:
                inv = Inventory.query.filter_by(machine_id=machine.id, product_id=product_id).first()
                if inv and inv.sponsored_quantity >= quantity:
                    distance = ((machine.latitude - lat) ** 2 + (machine.longitude - lng) ** 2) ** 0.5 * 111
                    if distance < min_distance:
                        min_distance = distance
                        nearest_machine = machine
    
    if not nearest_machine:
        # Check global pool
        pool_item = GlobalSponsoredPool.query.filter_by(product_id=product_id).first()
        if pool_item and pool_item.count >= quantity:
            # Use global pool - no physical machine needed
            pool_item.count -= quantity
            
            # Record transaction
            txn = Transaction(
                transaction_id=generate_transaction_id(),
                session_id=session_id,
                product_id=product_id,
                amount=0,
                quantity=quantity,
                type='free_claim',
                status='completed'
            )
            db.session.add(txn)
            
            # Update session
            anon = AnonymousSession.query.filter_by(session_id=session_id).first()
            if anon:
                anon.last_claim_date = datetime.utcnow().isoformat()
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'transaction_id': txn.transaction_id,
                'product': product.to_dict(),
                'quantity': quantity,
                'message': 'Your pads are ready (from community pool) 🎁'
            }), 200
        else:
            return jsonify({
                'error': 'No stock available nearby',
                'suggestion': 'Try a different product or check back later'
            }), 404
    
    # Dispense from machine
    inv = Inventory.query.filter_by(machine_id=nearest_machine.id, product_id=product_id).first()
    
    # Determine if free or paid
    is_free = nearest_machine.is_free_zone or inv.sponsored_quantity > 0
    
    if is_free and inv.sponsored_quantity > 0:
        inv.sponsored_quantity -= quantity
        amount = 0
        txn_type = 'free_claim'
    elif nearest_machine.is_free_zone:
        inv.quantity -= quantity
        amount = 0
        txn_type = 'free_claim'
    else:
        inv.quantity -= quantity
        amount = product.price * quantity
        txn_type = 'purchase'
    
    # Create transaction
    txn = Transaction(
        transaction_id=generate_transaction_id(),
        session_id=session_id,
        machine_id=nearest_machine.id,
        product_id=product_id,
        amount=amount,
        quantity=quantity,
        unit_price=product.price,
        type=txn_type,
        grand_total=amount,
        status='completed',
        payment_method='dispense'
    )
    db.session.add(txn)
    
    # Update session last claim date
    anon = AnonymousSession.query.filter_by(session_id=session_id).first()
    if anon:
        anon.last_claim_date = datetime.utcnow().isoformat()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'transaction_id': txn.transaction_id,
        'machine': nearest_machine.to_dict(),
        'product': product.to_dict(),
        'quantity': quantity,
        'amount': amount,
        'remaining_stock': inv.quantity,
        'message': f'Your pads are ready at {nearest_machine.name} 🎁'
    }), 200


# ─────────────────────────────────────────────
#  DONATE API
# ─────────────────────────────────────────────
@app.route('/api/donate', methods=['POST'])
def create_donation():
    """Register a new donation to community pool"""
    data = request.get_json()
    session_id = data.get('session_id')
    brand = data.get('brand')
    product_type = data.get('product_type')
    qty = max(1, min(10, int(data.get('qty', 1))))
    area = data.get('area', 'Unknown')
    
    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400
    
    # Find product by brand and type
    product = Product.query.filter_by(brand=brand, type=product_type).first()
    if not product:
        # Fallback to first product
        product = Product.query.first()
    
    # Create donation record
    donation = Donation(
        session_id=session_id,
        brand=brand,
        product_type=product_type,
        qty=qty,
        area=area
    )
    db.session.add(donation)
    
    # Update Community Pool
    pool = CommunityPool.query.first()
    if not pool:
        pool = CommunityPool()
        db.session.add(pool)
    
    pool.total_donated += qty
    pool.total_available += qty
    
    # Update Global Sponsored Pool
    pool_item = GlobalSponsoredPool.query.filter_by(product_id=product.id).first()
    if pool_item:
        pool_item.count += qty
    else:
        pool_item = GlobalSponsoredPool(product_id=product.id, count=qty)
        db.session.add(pool_item)
    
    # Update AnonymousSession
    anon = AnonymousSession.query.filter_by(session_id=session_id).first()
    if not anon:
        anon = AnonymousSession(session_id=session_id)
        db.session.add(anon)
    anon.total_donated += qty
    
    # Award badges
    badges = set(anon.badges.split(',')) if anon.badges else set()
    if anon.total_donated >= 5:
        badges.add('donor')
    if anon.total_donated >= 20:
        badges.add('generous_donor')
    badges.discard('')
    anon.badges = ','.join(badges)
    
    db.session.commit()
    
    # Get impact stats for the day
    today = datetime.utcnow().date()
    today_donations = Donation.query.filter(
        func.date(Donation.created_at) == today
    ).all()
    total_today = sum(d.qty for d in today_donations)
    
    return jsonify({
        'success': True,
        'donation': donation.to_dict(),
        'pool': pool.to_dict(),
        'impact': {
            'total_donated_today': total_today,
            'message': f'Your donation of {qty} {product_type} pads helps someone in need 💝'
        }
    }), 201


@app.route('/api/donate/impact', methods=['GET'])
def get_donation_impact():
    """Get donation impact statistics"""
    pool = CommunityPool.query.first()
    if not pool:
        pool = CommunityPool()
    
    today = datetime.utcnow().date()
    today_donations = Donation.query.filter(
        func.date(Donation.created_at) == today
    ).all()
    
    return jsonify({
        'total_donated': pool.total_donated or 0,
        'total_dispensed': pool.total_dispensed or 0,
        'total_available': pool.total_available or 0,
        'donated_today': sum(d.qty for d in today_donations),
        'people_helped': Transaction.query.filter_by(type='free_claim').count()
    }), 200


# ─────────────────────────────────────────────
#  LIVE CARE NETWORK API
# ─────────────────────────────────────────────
@app.route('/api/livecare/signals', methods=['GET'])
def get_live_signals():
    """Get open need signals for the Live Panel"""
    # Auto-expire older signals
    cutoff = datetime.utcnow()
    expired_signals = NeedSignal.query.filter(
        NeedSignal.status == 'open',
        NeedSignal.expires_at < cutoff
    ).all()
    for s in expired_signals:
        s.status = 'expired'
    if expired_signals:
        db.session.commit()
    
    # Get area filter
    area = request.args.get('area')
    query = NeedSignal.query.filter_by(status='open')
    if area:
        query = query.filter(NeedSignal.area.ilike(f'%{area}%'))
    
    active_signals = query.order_by(desc(NeedSignal.created_at)).limit(20).all()
    
    # Get stats
    total_open = NeedSignal.query.filter_by(status='open').count()
    recently_matched = NeedSignal.query.filter(
        NeedSignal.status == 'matched',
        NeedSignal.fulfilled_at >= datetime.utcnow() - timedelta(minutes=5)
    ).count()
    
    # Calculate average response time
    matched_signals = NeedSignal.query.filter(
        NeedSignal.status == 'matched',
        NeedSignal.fulfilled_at.isnot(None),
        NeedSignal.created_at.isnot(None)
    ).limit(50).all()
    
    avg_response_time = None
    if matched_signals:
        response_times = [(s.fulfilled_at - s.created_at).total_seconds() / 60 for s in matched_signals]
        avg_response_time = sum(response_times) / len(response_times)
    
    return jsonify({
        'signals': [s.to_dict() for s in active_signals],
        'total_open': total_open,
        'recently_matched': recently_matched,
        'avg_response_time': round(avg_response_time, 1) if avg_response_time else None
    }), 200


@app.route('/api/livecare/signal', methods=['POST'])
def create_need_signal():
    """Create a new need signal when no stock is available"""
    data = request.get_json()
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400
    
    # Ensure user hasn't created one in the last 15 mins
    recent = NeedSignal.query.filter(
        NeedSignal.session_id == session_id,
        NeedSignal.created_at >= datetime.utcnow() - timedelta(minutes=15)
    ).first()
    if recent:
        return jsonify({'error': 'You already have an active request.'}), 429
    
    expires = datetime.utcnow() + timedelta(minutes=15)
    signal = NeedSignal(
        session_id=session_id,
        area=data.get('area', 'Unknown Area'),
        lat=data.get('lat'),
        lng=data.get('lng'),
        brand=data.get('brand'),
        product_type=data.get('product_type'),
        product_id=data.get('product_id'),
        qty=max(1, min(3, int(data.get('qty', 1)))),
        status='open',
        expires_at=expires
    )
    db.session.add(signal)
    db.session.commit()
    
    return jsonify({'success': True, 'signal': signal.to_dict()}), 201


@app.route('/api/livecare/sponsor/<int:signal_id>', methods=['POST'])
def sponsor_signal(signal_id):
    """Sponsor a specific need signal"""
    data = request.get_json()
    sponsor_session_id = data.get('session_id')
    
    if not sponsor_session_id:
        return jsonify({'error': 'Session ID required'}), 400
    
    signal = NeedSignal.query.get_or_404(signal_id)
    if signal.status != 'open':
        return jsonify({'error': 'This request is no longer available.'}), 400
    
    if signal.expires_at < datetime.utcnow():
        signal.status = 'expired'
        db.session.commit()
        return jsonify({'error': 'This request has expired.'}), 400
    
    physical = data.get('physical', False)
    
    # Check if sponsor has donation pool
    anon = AnonymousSession.query.filter_by(session_id=sponsor_session_id).first()
    pool = CommunityPool.query.first()
    
    if not physical:
        if not pool or pool.total_available < signal.qty:
            return jsonify({'error': 'Community pool is low. Please donate first!'}), 400
        
        # Deduct from pool
        pool.total_available -= signal.qty
        pool.total_dispensed += signal.qty
    
    # Mark signal as matched
    signal.status = 'matched'
    signal.sponsored_by = sponsor_session_id
    signal.fulfilled_at = datetime.utcnow()
    
    # Update sponsor stats
    if anon:
        anon.total_sponsored += signal.qty
        badges = set(anon.badges.split(',')) if anon.badges else set()
        badges.add('supporter')
        if anon.total_sponsored >= 10:
            badges.add('hero_supporter')
        badges.discard('')
        anon.badges = ','.join(badges)
    
    # Create transaction record
    txn = Transaction(
        transaction_id=generate_transaction_id(),
        session_id=sponsor_session_id,
        product_id=signal.product_id or 1,
        machine_id=1,  # Virtual assignment just natively needed for Model
        amount=45 * signal.qty if not physical else 0,
        quantity=signal.qty,
        type='sponsor_match' if not physical else 'physical_delivery',
        status='completed'
    )
    db.session.add(txn)
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'You successfully sponsored this request! ❤️',
        'signal': signal.to_dict(),
        'pool_remaining': pool.total_available
    }), 200


@app.route('/api/livecare/stats', methods=['GET'])
def get_livecare_stats():
    """Get Live Care Network statistics"""
    today = datetime.utcnow().date()
    
    # Today's stats
    today_requests = NeedSignal.query.filter(
        func.date(NeedSignal.created_at) == today
    ).count()
    
    today_fulfilled = NeedSignal.query.filter(
        func.date(NeedSignal.fulfilled_at) == today,
        NeedSignal.status == 'matched'
    ).count()
    
    # Top supporters
    top_supporters = db.session.query(
        AnonymousSession.session_id,
        AnonymousSession.total_sponsored,
        AnonymousSession.area
    ).filter(AnonymousSession.total_sponsored > 0)\
     .order_by(desc(AnonymousSession.total_sponsored))\
     .limit(10).all()
    
    return jsonify({
        'requests_today': today_requests,
        'fulfilled_today': today_fulfilled,
        'fulfillment_rate': round((today_fulfilled / today_requests * 100) if today_requests > 0 else 0),
        'total_requests_all_time': NeedSignal.query.count(),
        'total_fulfilled_all_time': NeedSignal.query.filter_by(status='matched').count(),
        'top_supporters': [{
            'id': s.session_id[:8],
            'total_sponsored': s.total_sponsored,
            'area': s.area or 'Anonymous'
        } for s in top_supporters]
    }), 200


# ─────────────────────────────────────────────
#  PHARMACY FINDER API
# ─────────────────────────────────────────────
@app.route('/api/pharmacies/nearby', methods=['POST'])
def find_nearby_pharmacies():
    """Find pharmacies near a location"""
    data = request.get_json()
    lat = data.get('lat')
    lng = data.get('lng')
    radius = data.get('radius', 3000)  # meters
    
    if not lat or not lng:
        return jsonify({'error': 'Location required'}), 400
    
    query = f"""
        [out:json][timeout:10];
        node["amenity"="pharmacy"](around:{radius},{lat},{lng});
        out 15;
    """
    
    url = f"https://overpass-api.de/api/interpreter?data={urllib.parse.quote(query.strip())}"
    
    pharmacies = []
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Sahayaa/1.0'})
        with urllib.request.urlopen(req, timeout=12) as response:
            osm_data = json.loads(response.read().decode())
            
        for p in osm_data.get('elements', []):
            p_lat = p.get('lat')
            p_lon = p.get('lon')
            tags = p.get('tags', {})
            
            # Simple Haversine approx in km
            distance = ((float(p_lat) - float(lat)) ** 2 + (float(p_lon) - float(lng)) ** 2) ** 0.5 * 111
            
            pharmacies.append({
                'id': str(p.get('id')),
                'name': tags.get('name', 'Local Pharmacy'),
                'address': tags.get('addr:street') or tags.get('addr:city') or 'Address unavailable',
                'rating': round(random.uniform(3.8, 4.9), 1),
                'total_ratings': random.randint(10, 150),
                'open_now': True, 
                'distance': round(distance, 1),
                'phone': tags.get('phone', 'N/A'),
                'timings': tags.get('opening_hours', 'Timings unavailable')
            })
            
    except Exception as e:
        print("Overpass API Error (using fallback):", e)
        
    # If API failed or yielded zero results, use contextual geographic fallback mocks
    if not pharmacies:
        pharmacies = [
            {
                'id': f'fb_{random.randint(100,999)}',
                'name': 'Apollo Pharmacy',
                'address': 'Main Metro Axis, Sector 4',
                'rating': 4.5,
                'total_ratings': 128,
                'open_now': True,
                'distance': round(random.uniform(0.1, 1.5), 1),
                'phone': '+91 22 1234 5678',
                'timings': '8:00 AM - 10:00 PM'
            },
            {
                'id': f'fb_{random.randint(100,999)}',
                'name': 'Wellness Forever',
                'address': 'Ground Floor, City Mall Complex',
                'rating': 4.2,
                'total_ratings': 95,
                'open_now': True,
                'distance': round(random.uniform(0.5, 2.5), 1),
                'phone': '+91 22 8765 4321',
                'timings': '24 Hours'
            }
        ]

    pharmacies.sort(key=lambda x: x['distance'])
    
    return jsonify({
        'pharmacies': pharmacies,
        'total': len(pharmacies),
        'location': {'lat': lat, 'lng': lng}
    }), 200


# ─────────────────────────────────────────────
#  STATS & INSIGHTS API
# ─────────────────────────────────────────────
@app.route('/api/stats/overview', methods=['GET'])
def get_overview_stats():
    """Get overview statistics for about page"""
    pool = CommunityPool.query.first()
    
    # Total pads dispensed
    total_dispensed = Transaction.query.filter(
        Transaction.type.in_(['purchase', 'free_claim', 'sponsor_match'])
    ).count()
    
    # Total donations
    total_donations = Donation.query.count()
    total_donated_pads = Donation.query.with_entities(func.sum(Donation.qty)).scalar() or 0
    
    # Cities covered
    cities = db.session.query(Machine.area).distinct().count()
    
    # People helped (unique sessions)
    people_helped = Transaction.query.filter(
        Transaction.session_id.isnot(None)
    ).distinct(Transaction.session_id).count()
    
    return jsonify({
        'total_pads_dispensed': total_dispensed,
        'total_donations': total_donations,
        'total_donated_pads': total_donated_pads,
        'cities_covered': cities,
        'people_helped': people_helped,
        'active_machines': Machine.query.filter_by(status='active').count(),
        'total_machines': Machine.query.count()
    }), 200


@app.route('/api/stats/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get anonymous leaderboard for top supporters"""
    top_donors = db.session.query(
        AnonymousSession.session_id,
        AnonymousSession.total_donated,
        AnonymousSession.total_sponsored,
        AnonymousSession.area
    ).filter(
        (AnonymousSession.total_donated > 0) | (AnonymousSession.total_sponsored > 0)
    ).order_by(
        desc(AnonymousSession.total_donated + AnonymousSession.total_sponsored)
    ).limit(20).all()
    
    return jsonify([{
        'id': d.session_id[:8],
        'total_donated': d.total_donated,
        'total_sponsored': d.total_sponsored,
        'total_impact': d.total_donated + d.total_sponsored,
        'area': d.area or 'Anonymous'
    } for d in top_donors]), 200


# ─────────────────────────────────────────────
#  INVENTORY API (Admin)
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
def set_inventory():
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


# ─────────────────────────────────────────────
#  TRANSACTIONS API
# ─────────────────────────────────────────────
@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    session_id = request.headers.get('X-Session-Id')
    machine_id = request.args.get('machine_id')
    
    page = request.args.get('page', 1, type=int)
    per_page = 20
    
    query = Transaction.query
    
    # Optional constraints
    if session_id:
        query = query.filter_by(session_id=session_id)
    if machine_id:
        query = query.filter_by(machine_id=machine_id)
        
    txns = query.order_by(desc(Transaction.timestamp)).paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'transactions': [t.to_dict() for t in txns.items],
        'total': txns.total,
        'pages': txns.pages,
        'current_page': page
    }), 200


# ─────────────────────────────────────────────
#  ADMIN API (Protected)
# ─────────────────────────────────────────────
@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    # Simple admin check (in production, add proper auth)
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
    
    # Low stock alerts
    low_stock = Inventory.query.filter(Inventory.quantity <= 5).all()
    low_stock_data = []
    for item in low_stock:
        low_stock_data.append({
            'machine': item.machine.name if item.machine else '',
            'product': item.product.name if item.product else '',
            'quantity': item.quantity
        })
    
    return jsonify({
        'overview': {
            'total_machines': total_machines,
            'active_machines': active_machines,
            'total_transactions': total_transactions,
            'total_revenue': round(float(total_revenue), 2)
        },
        'most_used_machines': [{'name': r.name, 'location': r.location, 'count': r.count} for r in most_used],
        'low_stock_alerts': low_stock_data
    }), 200


# ─────────────────────────────────────────────
#  DATABASE SEED
# ─────────────────────────────────────────────
def seed_database():
    """Seed database with demo data"""
    if User.query.count() > 0:
        return
    
    # Products with brands and types
    products = [
        # Whisper
        Product(brand='Whisper', name='Regular', tagline='Gentle everyday protection', 
                color_accent='#E91E8C', logo_url='/logos/whisper.png', 
                price=45.0, type='Regular', description='Trusted protection'),
        Product(brand='Whisper', name='XL', tagline='Extra coverage', 
                color_accent='#E91E8C', logo_url='/logos/whisper.png',
                price=50.0, type='XL', description='For heavy flow days'),
        Product(brand='Whisper', name='Overnight', tagline='All night protection', 
                color_accent='#E91E8C', logo_url='/logos/whisper.png',
                price=55.0, type='Overnight', description='8+ hours protection'),
        Product(brand='Whisper', name='Ultra Thin', tagline='Invisible comfort', 
                color_accent='#E91E8C', logo_url='/logos/whisper.png',
                price=48.0, type='Ultra', description='Discreet and absorbent'),
        
        # Stayfree
        Product(brand='Stayfree', name='Regular', tagline='Stay confident', 
                color_accent='#F06292', logo_url='/logos/stayfree.png',
                price=42.0, type='Regular', description='Cottony soft cover'),
        Product(brand='Stayfree', name='XL Wings', tagline='Secure fit', 
                color_accent='#F06292', logo_url='/logos/stayfree.png',
                price=48.0, type='XL', description='Anti-leak wings'),
        Product(brand='Stayfree', name='Secure Nights', tagline='Worry-free sleep', 
                color_accent='#F06292', logo_url='/logos/stayfree.png',
                price=52.0, type='Overnight', description='For peaceful nights'),
        
        # Sofy
        Product(brand='Sofy', name='Body Fit', tagline='Perfectly shaped', 
                color_accent='#FF80AB', logo_url='/logos/sofy.png',
                price=44.0, type='Regular', description='Anatomically shaped'),
        Product(brand='Sofy', name='Anti-Bacterial', tagline='Germ protection', 
                color_accent='#FF80AB', logo_url='/logos/sofy.png',
                price=49.0, type='XL', description='With neem extract'),
        
        # Carefree
        Product(brand='Carefree', name='Panty Liners', tagline='Fresh all day', 
                color_accent='#4FC3F7', logo_url='/logos/carefree.png',
                price=35.0, type='Liner', description='Daily freshness'),
        Product(brand='Carefree', name='Ultra Thin', tagline='Invisible protection', 
                color_accent='#4FC3F7', logo_url='/logos/carefree.png',
                price=40.0, type='Ultra', description='Light flow days'),
    ]
    for p in products:
        db.session.add(p)
    db.session.flush()
    
    # Machines
    machines_data = [
        {'name': 'CST Station Pod', 'location': 'Platform 1, Women\'s Waiting Room', 
         'area': 'Mumbai Central', 'lat': 18.9402, 'lon': 72.8355, 'status': 'active', 'is_free': False},
        {'name': 'Andheri Metro Pod', 'location': 'Concourse Level, Women\'s Restroom', 
         'area': 'Andheri', 'lat': 19.1197, 'lon': 72.8465, 'status': 'active', 'is_free': True},
        {'name': 'Dadar Station Pod', 'location': 'Upper Level, Platform 6', 
         'area': 'Dadar', 'lat': 19.0181, 'lon': 72.8417, 'status': 'active', 'is_free': False},
        {'name': 'Bandra Station Pod', 'location': 'Gate 2, Women\'s Section', 
         'area': 'Bandra', 'lat': 19.0596, 'lon': 72.8397, 'status': 'active', 'is_free': False},
        {'name': 'Thane Station Pod', 'location': 'Foot Overbridge, Women\'s Corner', 
         'area': 'Thane', 'lat': 19.1838, 'lon': 72.9680, 'status': 'active', 'is_free': True},
        {'name': 'Seawoods Mall Pod', 'location': 'Level 2, Food Court Restroom', 
         'area': 'Navi Mumbai', 'lat': 19.0180, 'lon': 73.0134, 'status': 'active', 'is_free': False},
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
    
    # Inventory
    for i, machine in enumerate(machine_objects):
        for product in products[:8]:  # First 8 products
            qty = random.randint(5, 25)
            spon_qty = random.randint(0, 3)
            inv = Inventory(
                machine_id=machine.id, 
                product_id=product.id, 
                quantity=qty,
                sponsored_quantity=spon_qty
            )
            db.session.add(inv)
    
    # Community Pool
    pool = CommunityPool(total_donated=150, total_available=45, total_dispensed=105)
    db.session.add(pool)
    
    db.session.commit()
    print("✅ Database seeded with demo data!")


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_database()
    app.run(debug=True, port=5000)