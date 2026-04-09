from app import app, db
from models import NeedSignal
from datetime import datetime, timedelta
import random

with app.app_context():
    # Only insert if none exist to avoid spamming
    if NeedSignal.query.count() == 0:
        signals = [
            NeedSignal(
                session_id='anon_1',
                area='Andheri',
                lat=19.1197,
                lng=72.8465,
                brand='Whisper',
                product_type='XL',
                product_id=2,
                qty=1,
                status='open',
                expires_at=datetime.utcnow() + timedelta(minutes=45)
            ),
            NeedSignal(
                session_id='anon_2',
                area='Dadar',
                lat=19.0181,
                lng=72.8417,
                brand='Stayfree',
                product_type='Overnight',
                product_id=7,
                qty=2,
                status='open',
                expires_at=datetime.utcnow() + timedelta(minutes=10)
            ),
            NeedSignal(
                session_id='anon_3',
                area='Bandra',
                lat=19.0596,
                lng=72.8397,
                brand='Generic',
                product_type='Regular',
                product_id=1,
                qty=1,
                status='open',
                expires_at=datetime.utcnow() + timedelta(minutes=60)
            )
        ]
        
        for s in signals:
            db.session.add(s)
            
        db.session.commit()
        print("✅ Added mock NeedSignals to Live Care!")
    else:
        print("Signals already exist.")
