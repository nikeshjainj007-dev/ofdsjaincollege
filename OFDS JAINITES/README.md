# OFDS JAINITES - Campus Online Food Delivery System 🍔🎓

A modern, responsive, full-stack food delivery web application built specifically for campus students, faculty, and canteen vendors at **Jainites Campus**.

Students can browse on-campus food courts, customize dishes, filter for Pure Veg & Jain-friendly meals, apply campus discount vouchers, select hostel rooms or academic blocks for 15-minute express delivery (or counter pick-up to skip long queues), and track their orders live with secure delivery PIN verification.

Payment is exclusively configured for **Cash on Delivery (COD)**, eliminating digital transaction failures and allowing students to pay cash directly when hot food is handed over at their room or counter.

---

## 🌟 Key Features

### 1. 🎓 Student Experience
- **Campus Delivery Spots**: Express delivery to Boys Hostel Block 1 & 2, Girls Hostel Block A & B, Academic Tech Park, Central Library, Amphitheater Lawn.
- **Skip-the-Queue Counter Pickup**: Order ahead and pick up directly at the canteen counter without waiting in line during short lecture breaks.
- **Dietary & Special Filters**:
  - 🌱 **Pure Veg**
  - 🌿 **Jain Specials (100% Satvik, No Onion, No Garlic)**
  - 🔥 **Campus Bestsellers**
  - 💰 **Budget Meals (Under ₹70)**
  - 🌶️ **Spicy Picks**
- **Smart Campus Coupons**: Pre-loaded coupons like `CAMPUS50`, `FIRSTJAINITE`, and `NIGHTOWL`.
- **Payment Method**: **100% Cash on Delivery (COD)** — Pay exact cash upon room or counter handover.
- **Sticky Active Order Banner**: While browsing, students see their current live order status and total cash to pay.
- **Live Order Tracking**: Interactive 4-step progress stepper:
  1. `Order Placed (Pending)`
  2. `Cooking in Kitchen (In Kitchen)`
  3. `Ready for Pickup / Out for Delivery`
  4. `Delivered & Paid (Cash Collected) 🎉`
- **Verification PIN**: 4-digit security PIN displayed for student handover verification.

### 2. 👨‍🍳 Canteen Kitchen Display System (KDS / Vendor Portal)
- Switch roles via the top navigation bar to **👨‍🍳 Vendor / Kitchen KDS**.
- **Live Audio Alert**: Sound chime notifies kitchen staff immediately when a new student order is placed.
- **4-Column Live Kanban Board**:
  1. **🔔 Incoming / Pending**: View order ticket, student contact, room destination, item list, and cash to collect. One-click `👨‍🍳 Accept & Start Cooking` or `✕ Cancel Order`.
  2. **🍳 Cooking in Kitchen**: Shows preparation time. One-click `🔔 Mark Ready for Pickup / Runner`.
  3. **🚴 Ready / Dispatch**: Orders waiting for runner dispatch or student counter pickup. One-click `✅ Mark Delivered & Cash Collected`.
  4. **🎉 Delivered & Paid Today**: History of completed orders with confirmed cash collections.
- **Real-Time Stock Management**: Toggle items between *In-Stock* and *Sold-Out* to instantly prevent students from ordering dishes with finished ingredients.
- Live kitchen revenue, active ticket metrics, and top-selling items analytics.

### 3. 🚴 Campus Delivery Runner Dashboard
- Switch roles to **🚴 Runner Portal**.
- View orders ready for delivery, target hostel block, and room number.
- Claim delivery tickets and initiate dispatch.
- 4-digit PIN verification to confirm student handover and cash collection.

---

## 🚀 Quick Start Guide

### Starting the Server

Run either the batch file or powershell script:
```powershell
# In PowerShell:
.\run.ps1

# Or in Windows CMD:
run.bat
```

Alternatively, you can run directly with `uv`:
```bash
uv run --with fastapi,uvicorn python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Then open your browser at:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 🧪 Step-by-Step Testing Workflow

1. **Place a Student Order**:
   - Open [http://localhost:8000](http://localhost:8000).
   - In **🎓 Student Portal**, add items (e.g. *Double Cheese Maggi* and *Kulhad Chai* from Chai & Maggi Hub).
   - Open tray, enter coupon `CAMPUS50`, and click **Apply**.
   - Click **Proceed to Checkout**, review the **Cash on Delivery** summary, and click **Confirm & Place Order**.
   - Note the **4-digit Delivery PIN** and the sticky active order banner at the top of the page.

2. **Accept & Cook as Canteen Vendor**:
   - In the top navigation bar, click **👨‍🍳 Vendor / Kitchen KDS**.
   - The new order appears in the **🔔 Incoming / Pending** column with a cash collection badge.
   - Click **Accept & Start Cooking**. The order moves to the **Cooking in Kitchen** column.
   - Switch back to the **Student Portal** or check the live tracker to see the status updated to *Cooking in Kitchen 🍳* in real-time!

3. **Complete & Collect Cash**:
   - In the Vendor view, click **Mark Ready for Pickup**, then **Mark Delivered & Cash Collected**.
   - The student's screen automatically updates to *Delivered & Paid 🎉* and marks payment status as *Paid (Cash Collected)*.
