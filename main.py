import os
import random
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import get_db_connection, init_db
from models import OrderCreate, StatusUpdate, CouponValidateRequest, StockToggleRequest

app = FastAPI(
    title="OFDS JAINITES - Campus Food Delivery API",
    description="Online Food Delivery System backend tailored for campus students and vendors",
    version="1.0.0"
)

# Enable CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure database is created on startup
@app.on_event("startup")
def startup_event():
    init_db()

# --- Outlets & Categories Endpoints ---

@app.get("/api/outlets")
def get_outlets():
    conn = get_db_connection()
    outlets = conn.execute("SELECT * FROM outlets WHERE is_open = 1 ORDER BY rating DESC").fetchall()
    
    result = []
    for row in outlets:
        item = dict(row)
        # Count available menu items
        item_count = conn.execute(
            "SELECT COUNT(*) as count FROM menu_items WHERE outlet_id = ? AND in_stock = 1", 
            (item["id"],)
        ).fetchone()["count"]
        item["total_items"] = item_count
        result.append(item)
    
    conn.close()
    return result

@app.get("/api/categories")
def get_categories():
    conn = get_db_connection()
    categories = conn.execute("SELECT * FROM categories ORDER BY display_order ASC").fetchall()
    conn.close()
    return [dict(c) for c in categories]

# --- Menu Items Endpoint ---

@app.get("/api/menu")
def get_menu(
    outlet_id: Optional[int] = None,
    category_id: Optional[int] = None,
    is_veg: Optional[bool] = None,
    is_jain: Optional[bool] = None,
    search: Optional[str] = None
):
    conn = get_db_connection()
    query = """
    SELECT m.*, o.name as outlet_name, c.name as category_name
    FROM menu_items m
    JOIN outlets o ON m.outlet_id = o.id
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE 1=1
    """
    params = []

    if outlet_id is not None:
        query += " AND m.outlet_id = ?"
        params.append(outlet_id)

    if category_id is not None:
        query += " AND m.category_id = ?"
        params.append(category_id)

    if is_veg is not None:
        query += " AND m.is_veg = ?"
        params.append(1 if is_veg else 0)

    if is_jain is not None and is_jain:
        query += " AND m.is_jain = 1"

    if search:
        query += " AND (LOWER(m.name) LIKE ? OR LOWER(m.description) LIKE ?)"
        term = f"%{search.lower().strip()}%"
        params.extend([term, term])

    query += " ORDER BY m.is_bestseller DESC, m.price ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]

# --- Coupon Validation Endpoint ---

@app.post("/api/coupons/validate")
def validate_coupon(req: CouponValidateRequest):
    conn = get_db_connection()
    code = req.code.upper().strip()
    coupon = conn.execute("SELECT * FROM coupons WHERE UPPER(code) = ?", (code,)).fetchone()
    conn.close()

    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon code")

    coupon = dict(coupon)
    if req.subtotal < coupon["min_order"]:
        raise HTTPException(
            status_code=400,
            detail=f"Order subtotal must be at least ₹{coupon['min_order']} to apply '{code}'"
        )

    # Calculate discount
    discount = 0.0
    if coupon["discount_percent"] and coupon["discount_percent"] > 0:
        discount = (coupon["discount_percent"] / 100.0) * req.subtotal
        if coupon["max_discount"] and discount > coupon["max_discount"]:
            discount = coupon["max_discount"]
    elif coupon["flat_discount"] and coupon["flat_discount"] > 0:
        discount = coupon["flat_discount"]

    discount = min(discount, req.subtotal)

    return {
        "valid": True,
        "code": code,
        "discount": round(discount, 2),
        "description": coupon["description"]
    }

# --- Order Placement & Management ---

@app.post("/api/orders")
def create_order(req: OrderCreate):
    if not req.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    conn = get_db_connection()
    cursor = conn.cursor()

    # Calculate subtotal from database items for security
    subtotal = 0.0
    verified_items = []

    for item in req.items:
        db_item = cursor.execute(
            "SELECT * FROM menu_items WHERE id = ?", (item.menu_item_id,)
        ).fetchone()
        if not db_item:
            conn.close()
            raise HTTPException(status_code=400, detail=f"Item ID {item.menu_item_id} not found")
        
        db_item = dict(db_item)
        if not db_item["in_stock"]:
            conn.close()
            raise HTTPException(status_code=400, detail=f"'{db_item['name']}' is currently out of stock")

        item_total = db_item["price"] * item.quantity
        subtotal += item_total
        verified_items.append({
            "menu_item_id": db_item["id"],
            "item_name": db_item["name"],
            "price": db_item["price"],
            "quantity": item.quantity,
            "special_notes": item.special_notes or ""
        })

    # Discount calculation
    discount = 0.0
    if req.coupon_code:
        code = req.coupon_code.upper().strip()
        coupon = cursor.execute("SELECT * FROM coupons WHERE UPPER(code) = ?", (code,)).fetchone()
        if coupon:
            coupon = dict(coupon)
            if subtotal >= coupon["min_order"]:
                if coupon["discount_percent"] and coupon["discount_percent"] > 0:
                    d = (coupon["discount_percent"] / 100.0) * subtotal
                    if coupon["max_discount"] and d > coupon["max_discount"]:
                        d = coupon["max_discount"]
                    discount = d
                elif coupon["flat_discount"] and coupon["flat_discount"] > 0:
                    discount = coupon["flat_discount"]
                discount = min(discount, subtotal)

    # Delivery Fee: ₹0 for pickup or orders >= ₹150, else ₹10
    delivery_fee = 0.0 if (req.delivery_type == "pickup" or subtotal >= 150.0) else 10.0
    total_amount = round(subtotal - discount + delivery_fee, 2)

    # Generate Order Number and Delivery PIN
    order_number = f"ORD-{random.randint(10000, 99999)}"
    pin = f"{random.randint(1000, 9999)}"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Cash on Delivery order creation
    payment_method = "cod"
    payment_status = "Pending (Cash on Delivery)"

    cursor.execute("""
    INSERT INTO orders (
        order_number, student_name, student_phone, delivery_type, location_block, location_room,
        outlet_id, outlet_name, status, subtotal, discount, delivery_fee, total_amount,
        payment_method, payment_status, pin, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        order_number, req.student_name, req.student_phone, req.delivery_type, req.location_block,
        req.location_room or "", req.outlet_id, req.outlet_name, "pending", subtotal,
        discount, delivery_fee, total_amount, payment_method, payment_status, pin, now, now
    ))

    order_id = cursor.lastrowid

    # Insert items
    for vi in verified_items:
        cursor.execute("""
        INSERT INTO order_items (order_id, menu_item_id, item_name, price, quantity, special_notes)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (order_id, vi["menu_item_id"], vi["item_name"], vi["price"], vi["quantity"], vi["special_notes"]))

    conn.commit()

    # Retrieve full created order
    created_order = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    order_dict = dict(created_order)
    order_dict["items"] = verified_items

    conn.close()
    return order_dict

@app.get("/api/orders")
def list_orders(
    role: Optional[str] = "student",
    outlet_id: Optional[int] = None,
    status: Optional[str] = None,
    student_phone: Optional[str] = None
):
    conn = get_db_connection()
    query = "SELECT * FROM orders WHERE 1=1"
    params = []

    if outlet_id is not None:
        query += " AND outlet_id = ?"
        params.append(outlet_id)

    if status:
        query += " AND status = ?"
        params.append(status)

    if student_phone:
        query += " AND student_phone = ?"
        params.append(student_phone)

    query += " ORDER BY id DESC LIMIT 50"
    rows = conn.execute(query, params).fetchall()

    orders = []
    for r in rows:
        od = dict(r)
        # Fetch items
        items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (od["id"],)).fetchall()
        od["items"] = [dict(i) for i in items]
        orders.append(od)

    conn.close()
    return orders

@app.get("/api/orders/{order_id}")
def get_order(order_id: int):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = dict(row)
    items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
    order["items"] = [dict(i) for i in items]
    conn.close()
    return order

@app.post("/api/orders/{order_id}/status")
def update_order_status(order_id: int, req: StatusUpdate):
    valid_statuses = ["pending", "confirmed", "preparing", "ready", "en_route", "delivered", "cancelled"]
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    conn = get_db_connection()
    cursor = conn.cursor()
    order = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        conn.close()
        raise HTTPException(status_code=404, detail="Order not found")

    order = dict(order)

    payment_status = order["payment_status"]
    # If completing delivery
    if req.status == "delivered":
        if req.pin and req.pin.strip() and req.pin.strip() != order["pin"].strip():
            conn.close()
            raise HTTPException(status_code=400, detail="Incorrect 4-digit student verification PIN")
        payment_status = "Paid (Cash Collected)"
    elif req.status == "cancelled":
        payment_status = "Cancelled"

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "UPDATE orders SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?",
        (req.status, payment_status, now, order_id)
    )
    conn.commit()

    updated = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    conn.close()
    return dict(updated)

# --- Vendor Management Endpoints ---

@app.post("/api/menu/{item_id}/stock")
def toggle_stock(item_id: int, req: StockToggleRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE menu_items SET in_stock = ? WHERE id = ?", (1 if req.in_stock else 0, item_id))
    conn.commit()
    conn.close()
    return {"success": True, "item_id": item_id, "in_stock": req.in_stock}

@app.get("/api/stats")
def get_stats():
    conn = get_db_connection()
    total_orders = conn.execute("SELECT COUNT(*) as count FROM orders").fetchone()["count"]
    active_orders = conn.execute(
        "SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'confirmed', 'preparing', 'ready', 'en_route')"
    ).fetchone()["count"]
    delivered_orders = conn.execute("SELECT COUNT(*) as count FROM orders WHERE status = 'delivered'").fetchone()["count"]
    revenue = conn.execute("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != 'cancelled'").fetchone()["total"]

    # Top selling items
    top_items = conn.execute("""
    SELECT item_name, SUM(quantity) as qty, SUM(price * quantity) as total_rev
    FROM order_items
    GROUP BY item_name
    ORDER BY qty DESC
    LIMIT 5
    """).fetchall()

    conn.close()
    return {
        "total_orders": total_orders,
        "active_orders": active_orders,
        "delivered_orders": delivered_orders,
        "revenue": round(revenue, 2),
        "top_items": [dict(i) for i in top_items]
    }

# --- Mount Static Files ---
# On Vercel, static files are served directly by the CDN via vercel.json routes.
# Mounting StaticFiles at "/" here would intercept API routes in serverless mode.
# Only mount locally where we need uvicorn to serve the frontend too.
if not os.environ.get("VERCEL"):
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
