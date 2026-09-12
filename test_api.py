import sys
import asyncio
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
from httpx import AsyncClient, ASGITransport
from main import app

async def run_tests():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("1. Testing GET /api/outlets...")
        res = await client.get("/api/outlets")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        outlets = res.json()
        assert len(outlets) >= 6, f"Expected at least 6 outlets, got {len(outlets)}"
        print(f"   [OK] Outlets retrieved successfully: {len(outlets)} outlets")

        print("2. Testing GET /api/categories...")
        res = await client.get("/api/categories")
        assert res.status_code == 200
        cats = res.json()
        assert len(cats) >= 6
        print(f"   ✓ Categories retrieved: {len(cats)} categories")

        print("3. Testing GET /api/menu with Jain filter...")
        res = await client.get("/api/menu?is_jain=true")
        assert res.status_code == 200
        jain_items = res.json()
        assert all(item["is_jain"] == 1 for item in jain_items), "All items should be Jain"
        print(f"   ✓ Jain-friendly menu filtered: {len(jain_items)} items")

        print("4. Testing POST /api/coupons/validate with CAMPUS50...")
        res = await client.post("/api/coupons/validate", json={"code": "CAMPUS50", "subtotal": 150.0})
        assert res.status_code == 200
        coupon_data = res.json()
        assert coupon_data["discount"] == 60.0, f"Expected max discount 60.0, got {coupon_data['discount']}"
        print(f"   ✓ Coupon CAMPUS50 validated: Discount = ₹{coupon_data['discount']}")

        print("5. Testing POST /api/orders (Student placing order)...")
        sample_dish = jain_items[0]
        order_payload = {
            "student_name": "Kavya Patel",
            "student_phone": "+91 98765 11223",
            "delivery_type": "delivery",
            "location_block": "Girls Hostel Block A",
            "location_room": "Room 304",
            "outlet_id": sample_dish["outlet_id"],
            "outlet_name": sample_dish["outlet_name"],
            "items": [
                {
                    "menu_item_id": sample_dish["id"],
                    "item_name": sample_dish["name"],
                    "price": sample_dish["price"],
                    "quantity": 2,
                    "special_notes": "Mild spice please"
                }
            ],
            "coupon_code": "CAMPUS50",
            "payment_method": "cod"
        }
        res = await client.post("/api/orders", json=order_payload)
        assert res.status_code == 200, f"Order creation failed: {res.text}"
        order = res.json()
        order_id = order["id"]
        pin = order["pin"]
        assert order["payment_method"] == "cod", "Payment method must be Cash on Delivery"
        assert "Cash on Delivery" in order["payment_status"], "Payment status must indicate Cash on Delivery"
        print(f"   ✓ COD Order placed: #{order['order_number']}, PIN={pin}, Total=₹{order['total_amount']}, Status={order['payment_status']}")

        print("6. Testing KDS status transition: Pending -> Preparing -> Ready...")
        res = await client.post(f"/api/orders/{order_id}/status", json={"status": "preparing"})
        assert res.status_code == 200 and res.json()["status"] == "preparing"
        res = await client.post(f"/api/orders/{order_id}/status", json={"status": "ready"})
        assert res.status_code == 200 and res.json()["status"] == "ready"
        print("   ✓ KDS status progression verified: Order is now READY")

        print("7. Testing Runner / Vendor delivery with PIN & Cash collection...")
        # Try with wrong PIN first
        res_fail = await client.post(f"/api/orders/{order_id}/status", json={"status": "delivered", "pin": "0000"})
        assert res_fail.status_code == 400, "Wrong PIN should fail"

        # Now with correct PIN
        res_success = await client.post(f"/api/orders/{order_id}/status", json={"status": "delivered", "pin": pin})
        assert res_success.status_code == 200 and res_success.json()["status"] == "delivered"
        assert res_success.json()["payment_status"] == "Paid (Cash Collected)", "Payment status should be Paid (Cash Collected)"
        print("   ✓ Handover verified with student PIN: Order is DELIVERED & Cash Collected")

        print("8. Testing GET /api/stats...")
        res = await client.get("/api/stats")
        assert res.status_code == 200
        stats = res.json()
        assert stats["total_orders"] > 0
        print(f"   ✓ Campus vendor stats: {stats['total_orders']} total orders, ₹{stats['revenue']} revenue")

        print("\nALL 8 AUTOMATED TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    asyncio.run(run_tests())
