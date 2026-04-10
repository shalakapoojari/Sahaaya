from app import app, db, Machine, haversine_km
with app.app_context():
    print("Machines:")
    for m in Machine.query.all():
        print(f"ID={m.id}, name={m.name}, lat={m.latitude}, lng={m.longitude}")
