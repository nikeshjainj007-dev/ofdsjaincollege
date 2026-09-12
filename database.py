import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "campus_food.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Outlets / Canteens
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS outlets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        tagline TEXT,
        category TEXT,
        rating REAL DEFAULT 4.5,
        review_count INTEGER DEFAULT 120,
        prep_time TEXT DEFAULT '15-20 mins',
        location TEXT NOT NULL,
        image_url TEXT,
        is_open INTEGER DEFAULT 1
    );
    """)

    # Menu Categories
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT,
        display_order INTEGER DEFAULT 0
    );
    """)

    # Menu Items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outlet_id INTEGER NOT NULL,
        category_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        is_veg INTEGER DEFAULT 1,
        is_jain INTEGER DEFAULT 0,
        is_bestseller INTEGER DEFAULT 0,
        spicy_level INTEGER DEFAULT 1,
        image_url TEXT,
        in_stock INTEGER DEFAULT 1,
        FOREIGN KEY(outlet_id) REFERENCES outlets(id),
        FOREIGN KEY(category_id) REFERENCES categories(id)
    );
    """)

    # Coupons
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_percent REAL,
        flat_discount REAL DEFAULT 0,
        max_discount REAL,
        min_order REAL DEFAULT 0,
        description TEXT
    );
    """)

    # Orders
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        student_name TEXT NOT NULL,
        student_phone TEXT NOT NULL,
        delivery_type TEXT NOT NULL DEFAULT 'delivery',
        location_block TEXT NOT NULL,
        location_room TEXT,
        outlet_id INTEGER NOT NULL,
        outlet_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        delivery_fee REAL DEFAULT 10,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'upi',
        payment_status TEXT NOT NULL DEFAULT 'completed',
        pin TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(outlet_id) REFERENCES outlets(id)
    );
    """)

    # Order Items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        menu_item_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        special_notes TEXT,
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
    );
    """)

    # Check if data exists; if empty, seed it
    cursor.execute("SELECT COUNT(*) as count FROM outlets;")
    if cursor.fetchone()["count"] == 0:
        seed_data(cursor)

    conn.commit()
    conn.close()

def seed_data(cursor):
    # Seed Categories
    categories = [
        (1, "All Meals & Thalis", "🍲", 1),
        (2, "South Indian Tiffins", "🥞", 2),
        (3, "Maggi & Quick Bites", "🍜", 3),
        (4, "Jain Specials", "🌿", 4),
        (5, "Rolls & Sandwiches", "🥪", 5),
        (6, "Beverages & Shakes", "🧃", 6),
        (7, "Desserts & Sweets", "🍨", 7),
    ]
    cursor.executemany("INSERT INTO categories (id, name, icon, display_order) VALUES (?, ?, ?, ?)", categories)

    # Seed Outlets
    outlets = [
        (
            1,
            "Central Food Court",
            "central-food-court",
            "Wholesome Thalis, Biryani, Curries & Fresh Rotis",
            "Meals & Combos",
            4.6,
            380,
            "15-20 mins",
            "Academic Block A, Ground Floor",
            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
            1
        ),
        (
            2,
            "South Express Tiffin",
            "south-express",
            "Crispy Ghee Dosas, Fluffy Idlis & Filter Coffee",
            "South Indian",
            4.8,
            510,
            "10-15 mins",
            "Campus Food Court Counter #3",
            "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=600&auto=format&fit=crop&q=80",
            1
        ),
        (
            3,
            "Chai & Maggi Hub",
            "chai-maggi-hub",
            "Student Adda: Double Cheese Maggi, Bun Maska & Chai",
            "Snacks & Tea",
            4.7,
            740,
            "10-12 mins",
            "Amphitheater Lawn Side",
            "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&auto=format&fit=crop&q=80",
            1
        ),
        (
            4,
            "Jain Zaika (Pure Veg & Jain)",
            "jain-zaika",
            "100% Satvik & Jain Friendly: No Onion, No Garlic Specials",
            "Jain Special",
            4.9,
            420,
            "15-25 mins",
            "Student Activity Center, 1st Floor",
            "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80",
            1
        ),
        (
            5,
            "Night Owl Canteen",
            "night-owl-canteen",
            "Midnight Cravings: Cheesy Wraps, Frappes & Loaded Fries",
            "Late Night Hub",
            4.7,
            620,
            "15-20 mins",
            "Near Boys Hostel Block 1",
            "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80",
            1
        ),
        (
            6,
            "Juice Junction & Shakes",
            "juice-junction",
            "Cold Pressed Juices, Protein Bowls & Thick Shakes",
            "Healthy & Fresh",
            4.6,
            290,
            "8-12 mins",
            "Sports Complex Promenade",
            "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80",
            1
        ),
    ]
    cursor.executemany("""
    INSERT INTO outlets (id, name, slug, tagline, category, rating, review_count, prep_time, location, image_url, is_open)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, outlets)

    # Seed Menu Items
    menu_items = [
        # Central Food Court (outlet 1)
        (1, 1, "Student Executive Thali", "Paneer butter masala, yellow dal tadka, jeera rice, 3 butter rotis, salad, gulab jamun", 130.0, 1, 0, 1, 1, "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&auto=format&fit=crop&q=80", 1),
        (1, 1, "Royal Veg Dum Biryani", "Layered aromatic basmati rice cooked with fresh veggies and spices, served with raita and mirchi ka salan", 120.0, 1, 0, 1, 2, "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80", 1),
        (1, 1, "Amritsari Chole Bhature", "2 giant puffed bhatures served with spiced Punjabi chole, pickled onions and green chili", 95.0, 1, 0, 1, 2, "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80", 1),
        (1, 1, "Homestyle Rajma Chawal Bowl", "Slow cooked spiced red kidney beans served over steamed fragrant basmati rice", 85.0, 1, 0, 0, 1, "https://images.unsplash.com/photo-1626777553635-be32398555e7?w=500&auto=format&fit=crop&q=80", 1),
        (1, 5, "Paneer Tikka Kathi Roll", "Smoky marinated paneer cubes rolled in flaky paratha with mint mayonnaise", 90.0, 1, 0, 0, 2, "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80", 1),

        # South Express Tiffin (outlet 2)
        (2, 2, "Crispy Butter Masala Dosa", "Golden crisp dosa roasted with butter, stuffed with spiced potato mash, served with sambar & coconut chutneys", 75.0, 1, 0, 1, 1, "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=500&auto=format&fit=crop&q=80", 1),
        (2, 2, "Ghee Podi Roast Dosa", "Crisp crepe sprinkled generously with fragrant spicy gun-powder (podi) and pure desi ghee", 85.0, 1, 0, 1, 2, "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80", 1),
        (2, 2, "Steamed Idli-Vada Combo", "Two pillow-soft steamed rice idlis and one crispy medu vada, served piping hot with sambar", 55.0, 1, 0, 1, 1, "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80", 1),
        (2, 2, "Cheese Onion Uttapam", "Thick savory fermented pancake topped with chopped onions, green chilies, and melted cheese", 85.0, 1, 0, 0, 1, "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=500&auto=format&fit=crop&q=80", 1),
        (2, 6, "Degree Filter Coffee", "Authentic South Indian chicory-brewed filter coffee served frothed in traditional dabarah", 30.0, 1, 1, 1, 0, "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80", 1),

        # Chai & Maggi Hub (outlet 3)
        (3, 3, "Double Cheese Masala Maggi", "Classic noodles cooked with special spice mix and smothered in a double dose of gooey cheese", 65.0, 1, 0, 1, 1, "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80", 1),
        (3, 3, "Peri-Peri Tadka Maggi", "Fiery peri-peri seasoned Maggi tossed with crunchy peppers, butter and oregano herbs", 55.0, 1, 0, 1, 3, "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80", 1),
        (3, 6, "Kulhad Ginger Cardamom Chai", "Strong aromatic tea brewed with freshly crushed ginger, green cardamom and milk in terracotta cup", 25.0, 1, 1, 1, 0, "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80", 1),
        (3, 3, "Mumbai Bun Maska with Jam", "Soft warm bakery bun generously layered with butter and mixed fruit jam", 40.0, 1, 1, 0, 0, "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=80", 1),
        (3, 3, "Crispy Punjabi Samosas (2 pcs)", "Flaky golden crust stuffed with spiced potato and pea filling, served with sweet tamarind & mint dip", 35.0, 1, 0, 1, 1, "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80", 1),

        # Jain Zaika (outlet 4)
        (4, 4, "Jain Special Shahi Paneer Thali", "No onion, no garlic rich cashew gravy paneer, yellow moong dal, steamed jeera rice, 3 phulkas, papad", 145.0, 1, 1, 1, 1, "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80", 1),
        (4, 4, "Jain Cheese Pav Bhaji", "Authentic Mumbai bhaji crafted without potatoes or onions using raw banana & tomato reduction, with 2 butter pavs", 95.0, 1, 1, 1, 1, "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=500&auto=format&fit=crop&q=80", 1),
        (4, 4, "Jain Moong Dal Khichdi Bowl", "Comforting yellow moong and rice tempered with pure desi ghee, cumin and hing, served with curd & roasted papad", 100.0, 1, 1, 1, 0, "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80", 1),
        (4, 5, "Jain Corn & Cheese Grilled Sandwich", "Crushed sweet corn, capsicum, cilantro, and mozzarella in toasted white/brown bread with Jain green chutney", 85.0, 1, 1, 0, 1, "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80", 1),
        (4, 4, "Jain Paneer Kathi Frankie", "Tender cottage cheese cubes in tomato-spice glaze wrapped in a whole-wheat paratha without onion/garlic", 90.0, 1, 1, 0, 2, "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80", 1),

        # Night Owl Canteen (outlet 5)
        (5, 5, "Midnight Cheesy Paneer Wrap", "Crisp paratha rolled with spiced paneer cubes, chipotle sauce, melted cheddar and crisp greens", 105.0, 1, 0, 1, 2, "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80", 1),
        (5, 5, "Double Decker Veg Club Sandwich", "Triple slice toasted bread layered with fresh veggies, herb cheese spread, grilled paneer and chips", 95.0, 1, 0, 1, 1, "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80", 1),
        (5, 3, "Crispy Peri-Peri Fries with Cheese Dip", "Deep fried golden potato batons tossed in spicy peri-peri dust with warm jalapeño cheese sauce", 75.0, 1, 0, 1, 2, "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&auto=format&fit=crop&q=80", 1),
        (5, 6, "Iced Caramel Cold Coffee", "Bold espresso blended with creamy milk, vanilla ice cream and buttery caramel drizzle", 80.0, 1, 1, 1, 0, "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=80", 1),
        (5, 1, "Spicy Schezwan Fried Rice", "Wok-tossed rice with crunchy vegetables in fiery house-made schezwan chili sauce", 95.0, 1, 0, 0, 3, "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=80", 1),

        # Juice Junction & Shakes (outlet 6)
        (6, 6, "Fresh Sweet Watermelon Juice", "Hydrating pure cold-pressed watermelon with a hint of black salt and mint", 50.0, 1, 1, 1, 0, "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=80", 1),
        (6, 6, "Mango Alphonso Thick Shake", "Real Alphonso mango pulp blended with chilled milk, topped with rich vanilla scoop", 85.0, 1, 1, 1, 0, "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&auto=format&fit=crop&q=80", 1),
        (6, 6, "Nutella Chocolate Brownie Shake", "Decadent dark chocolate and Nutella milkshake blended with chunks of fudgy brownie", 95.0, 1, 1, 1, 0, "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=500&auto=format&fit=crop&q=80", 1),
        (6, 6, "Detox Green ABC Juice", "Nutritious blend of crisp apple, fresh beetroot, and sweet carrot with a splash of lemon", 70.0, 1, 1, 0, 0, "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80", 1),
        (6, 7, "Sizzling Brownie with Ice Cream", "Warm chocolate brownie on a sizzling cast iron skillet, drenched in hot chocolate fudge & vanilla", 99.0, 1, 1, 1, 0, "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=80", 1),
    ]

    cursor.executemany("""
    INSERT INTO menu_items (outlet_id, category_id, name, description, price, is_veg, is_jain, is_bestseller, spicy_level, image_url, in_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, menu_items)

    # Seed Coupons
    coupons = [
        ("CAMPUS50", 50.0, 0.0, 60.0, 120.0, "50% OFF up to ₹60 on orders above ₹120 for all students!"),
        ("FIRSTJAINITE", 0.0, 40.0, 40.0, 100.0, "Flat ₹40 OFF on your first campus order above ₹100!"),
        ("NIGHTOWL", 20.0, 0.0, 50.0, 150.0, "20% OFF on midnight study snacks above ₹150!"),
        ("CHAI10", 0.0, 10.0, 10.0, 40.0, "Flat ₹10 OFF on chai & evening snacks!"),
    ]
    cursor.executemany("""
    INSERT INTO coupons (code, discount_percent, flat_discount, max_discount, min_order, description)
    VALUES (?, ?, ?, ?, ?, ?)
    """, coupons)

    # Seed a couple sample orders
    sample_orders = [
        (
            "ORD-98214",
            "Ananya Sharma",
            "+91 98765 43210",
            "delivery",
            "Girls Hostel Block A",
            "Room 312",
            4,
            "Jain Zaika (Pure Veg & Jain)",
            "delivered",
            245.0,
            40.0,
            10.0,
            215.0,
            "upi",
            "completed",
            "4892",
            "2026-09-06 14:15:00",
            "2026-09-06 14:38:00"
        ),
        (
            "ORD-98215",
            "Rohan Mehta",
            "+91 98111 22334",
            "delivery",
            "Boys Hostel Block 1",
            "Room 208",
            3,
            "Chai & Maggi Hub",
            "preparing",
            155.0,
            0.0,
            10.0,
            165.0,
            "upi",
            "completed",
            "7134",
            "2026-09-06 17:30:00",
            "2026-09-06 17:35:00"
        )
    ]
    cursor.executemany("""
    INSERT INTO orders (
        order_number, student_name, student_phone, delivery_type, location_block, location_room,
        outlet_id, outlet_name, status, subtotal, discount, delivery_fee, total_amount,
        payment_method, payment_status, pin, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_orders)

    # Add items for sample orders
    cursor.execute("""
    INSERT INTO order_items (order_id, menu_item_id, item_name, price, quantity, special_notes)
    VALUES 
    (1, 16, 'Jain Special Shahi Paneer Thali', 145.0, 1, 'Extra butter on phulkas please'),
    (1, 18, 'Jain Moong Dal Khichdi Bowl', 100.0, 1, 'Well cooked and mild spice'),
    (2, 11, 'Double Cheese Masala Maggi', 65.0, 2, 'Extra cheese'),
    (2, 13, 'Kulhad Ginger Cardamom Chai', 25.0, 1, 'Less sugar');
    """)

if __name__ == "__main__":
    init_db()
    print("Database initialized and seeded successfully at:", DB_PATH)
