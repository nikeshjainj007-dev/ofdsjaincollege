/**
 * OFDS JAINITES - Campus Food Delivery System
 * Fully Functional Frontend Application Engine (100% Cash on Delivery)
 */

class CampusFoodApp {
  constructor() {
    // Application State
    this.outlets = [];
    this.categories = [];
    this.menuItems = [];
    this.cart = {}; // { itemId: { item, quantity, notes } }
    this.activeOutletId = null;
    this.activeCategoryId = null;
    this.dietFilter = 'all';
    this.searchQuery = '';
    
    this.deliveryType = 'delivery'; // 'delivery' | 'pickup'
    this.deliveryLocation = {
      block: 'Boys Hostel Block 1',
      room: 'Room 204'
    };
    this.appliedCoupon = null;
    
    this.currentRole = 'student'; // 'student' | 'vendor' | 'runner'
    this.activeOrderId = localStorage.getItem('ofds_active_order_id') || null;
    this.orders = [];
    this.kdsOutletFilter = 'all';
    this.pollInterval = null;
    this.knownOrderIds = new Set();
    this.lastOrderCount = 0;

    // Initialize
    this.init();
  }

  async init() {
    this.updateLocationDisplay();
    await this.fetchOutlets();
    await this.fetchCategories();
    await this.fetchMenu();
    await this.fetchOrders();
    this.loadSavedCart();
    this.renderAll();

    // Check active order on startup
    if (this.activeOrderId) {
      this.syncActiveOrderBanner();
    }

    // Start background order poller for live status updates
    this.startOrderPolling();
  }

  // ==================== API CALLS ====================
  async fetchOutlets() {
    try {
      const res = await fetch('/api/outlets');
      if (res.ok) this.outlets = await res.json();
    } catch (e) {
      console.error('Failed to fetch outlets:', e);
    }
  }

  async fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) this.categories = await res.json();
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
  }

  async fetchMenu() {
    try {
      let url = '/api/menu?';
      if (this.activeOutletId) url += `outlet_id=${this.activeOutletId}&`;
      if (this.activeCategoryId) url += `category_id=${this.activeCategoryId}&`;
      if (this.dietFilter === 'veg') url += `is_veg=true&`;
      if (this.dietFilter === 'jain') url += `is_jain=true&`;
      if (this.searchQuery) url += `search=${encodeURIComponent(this.searchQuery)}&`;

      const res = await fetch(url);
      if (res.ok) {
        let items = await res.json();
        // Client-side quick filters
        if (this.dietFilter === 'bestseller') items = items.filter(i => i.is_bestseller);
        if (this.dietFilter === 'budget') items = items.filter(i => i.price <= 70);
        if (this.dietFilter === 'spicy') items = items.filter(i => i.spicy_level >= 2);
        this.menuItems = items;
      }
    } catch (e) {
      console.error('Failed to fetch menu:', e);
    }
  }

  async fetchOrders() {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const newOrders = await res.json();
        
        // Check for new pending orders to alert vendor
        if (this.orders.length > 0 && newOrders.length > this.orders.length) {
          const incomingPending = newOrders.filter(o => o.status === 'pending' && !this.knownOrderIds.has(o.id));
          if (incomingPending.length > 0) {
            this.playBellChime();
            const alertDot = document.getElementById('navVendorAlert');
            if (alertDot) alertDot.style.display = 'inline-block';
            this.showToast(`🔔 New Order Received: #${incomingPending[0].order_number}`, 'success');
          }
        }

        this.orders = newOrders;
        newOrders.forEach(o => this.knownOrderIds.add(o.id));
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    }
  }

  async fetchStats() {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
    return null;
  }

  // ==================== RENDERING ====================
  renderAll() {
    this.renderOutlets();
    this.renderCategoryNav();
    this.renderDishes();
    this.renderCart();
  }

  renderOutlets() {
    const grid = document.getElementById('outletsGrid');
    if (!grid) return;

    grid.innerHTML = this.outlets.map(outlet => {
      const isSelected = this.activeOutletId === outlet.id;
      return `
        <article class="outlet-card ${isSelected ? 'selected' : ''}" onclick="app.filterByOutlet(${outlet.id})">
          <div class="outlet-img-wrap">
            <img src="${outlet.image_url}" alt="${outlet.name}" loading="lazy">
            <span class="outlet-badge-overlay">${outlet.category}</span>
            <span class="outlet-prep-badge">⏱️ ${outlet.prep_time}</span>
          </div>
          <div class="outlet-body">
            <div class="outlet-top-row">
              <h3 class="outlet-name">${outlet.name}</h3>
              <span class="rating-badge">★ ${outlet.rating.toFixed(1)}</span>
            </div>
            <p class="outlet-tagline">${outlet.tagline}</p>
            <div class="outlet-footer">
              <span class="outlet-loc">📍 ${outlet.location}</span>
              <span class="outlet-action">${isSelected ? 'Viewing Menu ✓' : 'Explore Menu →'}</span>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  renderCategoryNav() {
    const nav = document.getElementById('categoryNav');
    if (!nav) return;

    let html = `
      <button class="cat-btn ${this.activeCategoryId === null ? 'active' : ''}" onclick="app.filterByCategory(null)">
        <span>✨</span> All Items
      </button>
    `;

    html += this.categories.map(cat => `
      <button class="cat-btn ${this.activeCategoryId === cat.id ? 'active' : ''}" onclick="app.filterByCategory(${cat.id})">
        <span>${cat.icon}</span> ${cat.name}
      </button>
    `).join('');

    nav.innerHTML = html;
  }

  renderDishes() {
    const grid = document.getElementById('dishesGrid');
    const title = document.getElementById('menuTitle');
    const subtitle = document.getElementById('menuSubtitle');
    if (!grid) return;

    if (this.activeOutletId) {
      const outlet = this.outlets.find(o => o.id === this.activeOutletId);
      if (outlet) {
        title.innerHTML = `Menu: ${outlet.name} <button class="btn-link" style="margin-left:12px; font-size:0.85rem;" onclick="app.filterByOutlet(null)">Show All Canteens ✕</button>`;
        subtitle.textContent = `${outlet.tagline} • Serving at ${outlet.location}`;
      }
    } else {
      title.textContent = 'Popular Campus Dishes';
      subtitle.textContent = 'Handcrafted meals, quick snacks, hot Maggi and refreshing beverages';
    }

    if (this.menuItems.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px dashed var(--border-light);">
          <div style="font-size: 3rem; margin-bottom: 8px;">🔍</div>
          <h3>No matching campus dishes found</h3>
          <p style="color: var(--text-muted); margin-top: 4px;">Try clearing filters or search terms.</p>
          <button class="btn btn-primary" style="margin-top: 14px;" onclick="app.resetFilters()">Clear Filters</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.menuItems.map(item => {
      const inCartQty = this.cart[item.id] ? this.cart[item.id].quantity : 0;
      
      let spicyIcons = '';
      if (item.spicy_level === 1) spicyIcons = '🌶️';
      else if (item.spicy_level === 2) spicyIcons = '🌶️🌶️';
      else if (item.spicy_level >= 3) spicyIcons = '🌶️🌶️🌶️';

      return `
        <article class="dish-card">
          <div class="dish-img-wrap">
            <img src="${item.image_url}" alt="${item.name}" loading="lazy">
            <div class="dish-badges">
              <span class="badge-diet" title="${item.is_veg ? 'Pure Veg' : 'Non Veg'}">
                <span class="badge-diet-dot"></span>
              </span>
              ${item.is_jain ? '<span class="badge-jain">🌿 Jain Special</span>' : ''}
              ${item.is_bestseller ? '<span class="badge-bestseller">🔥 Bestseller</span>' : ''}
            </div>
          </div>
          <div class="dish-body">
            <span class="dish-outlet-tag">${item.outlet_name}</span>
            <h4 class="dish-name">${item.name}</h4>
            <p class="dish-desc">${item.description}</p>
            <div class="dish-footer">
              <div class="dish-price-wrap">
                <span class="dish-price">₹${item.price.toFixed(0)}</span>
                ${spicyIcons ? `<span title="Spice Level" style="margin-left: 6px; font-size: 0.75rem;">${spicyIcons}</span>` : ''}
              </div>

              <div class="dish-action-slot">
                ${!item.in_stock ? `
                  <span style="font-size:0.75rem; font-weight:700; color:var(--accent-red); background:#fee2e2; padding:4px 8px; border-radius:6px;">Sold Out</span>
                ` : inCartQty > 0 ? `
                  <div class="qty-stepper">
                    <button onclick="app.updateCartItem(${item.id}, -1)">−</button>
                    <span class="qty-count">${inCartQty}</span>
                    <button onclick="app.updateCartItem(${item.id}, 1)">+</button>
                  </div>
                ` : `
                  <button class="btn-add-tray" onclick="app.addToCart(${item.id})">
                    + Add to Tray
                  </button>
                `}
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // ==================== CART ACTIONS ====================
  addToCart(itemId) {
    const item = this.menuItems.find(i => i.id === itemId);
    if (!item) return;

    // Check if cart already has items from another outlet
    const cartItemIds = Object.keys(this.cart);
    if (cartItemIds.length > 0) {
      const existingOutletId = this.cart[cartItemIds[0]].item.outlet_id;
      if (existingOutletId !== item.outlet_id) {
        const existingOutletName = this.cart[cartItemIds[0]].item.outlet_name;
        if (confirm(`Your tray currently contains items from "${existingOutletName}". Would you like to clear your tray to add dishes from "${item.outlet_name}"?`)) {
          this.cart = {};
        } else {
          return;
        }
      }
    }

    if (this.cart[itemId]) {
      this.cart[itemId].quantity += 1;
    } else {
      this.cart[itemId] = {
        item: item,
        quantity: 1,
        specialNotes: ''
      };
    }

    this.playChime();
    this.saveCart();
    this.renderDishes();
    this.renderCart();
    this.showToast(`Added "${item.name}" to tray`, 'success');
  }

  updateCartItem(itemId, delta) {
    if (!this.cart[itemId]) return;
    this.cart[itemId].quantity += delta;
    if (this.cart[itemId].quantity <= 0) {
      delete this.cart[itemId];
    }
    this.saveCart();
    this.renderDishes();
    this.renderCart();
  }

  renderCart() {
    const countBadge = document.getElementById('cartCountBadge');
    const mobileCount = document.getElementById('mobileCartCount');
    const mobileTotal = document.getElementById('mobileCartTotal');
    const mobileBar = document.getElementById('mobileCartBar');
    const emptyState = document.getElementById('cartEmptyState');
    const cartBody = document.getElementById('cartItemsContainer');
    const cartFooter = document.getElementById('cartFooter');
    const cartItemsList = document.getElementById('cartItemsList');
    const cartSubtitle = document.getElementById('cartItemsSubtitle');
    const cartOutletNotice = document.getElementById('cartOutletName');

    const itemKeys = Object.keys(this.cart);
    const totalCount = itemKeys.reduce((acc, id) => acc + this.cart[id].quantity, 0);

    // Update badges
    if (countBadge) countBadge.textContent = totalCount;
    if (mobileCount) mobileCount.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

    if (totalCount === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (cartBody) cartBody.style.display = 'none';
      if (cartFooter) cartFooter.style.display = 'none';
      if (cartSubtitle) cartSubtitle.textContent = '0 items';
      if (mobileBar) mobileBar.classList.remove('visible');
      this.appliedCoupon = null;
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (cartBody) cartBody.style.display = 'flex';
    if (cartFooter) cartFooter.style.display = 'block';
    if (cartSubtitle) cartSubtitle.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;
    if (mobileBar) mobileBar.classList.add('visible');

    const firstEntry = this.cart[itemKeys[0]];
    if (!firstEntry || !firstEntry.item) {
      this.cart = {};
      this.saveCart();
      this.renderCart();
      return;
    }
    const firstItem = firstEntry.item;
    if (cartOutletNotice) cartOutletNotice.textContent = firstItem.outlet_name;

    // Render items list
    let subtotal = 0;
    cartItemsList.innerHTML = itemKeys.map(id => {
      const entry = this.cart[id];
      if (!entry || !entry.item) return '';
      const itemTotal = entry.item.price * entry.quantity;
      subtotal += itemTotal;

      return `
        <div class="cart-item-row">
          <div class="cart-item-info">
            <span class="cart-item-name">${entry.item.name}</span>
            <span class="cart-item-unit-price">₹${entry.item.price.toFixed(0)} each</span>
          </div>
          <div class="cart-item-actions">
            <div class="qty-stepper">
              <button onclick="app.updateCartItem(${entry.item.id}, -1)">−</button>
              <span class="qty-count">${entry.quantity}</span>
              <button onclick="app.updateCartItem(${entry.item.id}, 1)">+</button>
            </div>
            <span class="cart-item-total">₹${itemTotal.toFixed(0)}</span>
          </div>
        </div>
      `;
    }).join('');

    // Delivery Fee: ₹0 for pickup or orders >= ₹150, else ₹10
    const deliveryFee = (this.deliveryType === 'pickup' || subtotal >= 150) ? 0 : 10;
    
    // Discount
    let discount = 0;
    if (this.appliedCoupon) {
      discount = this.appliedCoupon.discount;
    }

    const grandTotal = Math.max(0, subtotal - discount + deliveryFee);

    // Update bill breakdown
    document.getElementById('billSubtotal').textContent = `₹${subtotal.toFixed(2)}`;
    
    const discRow = document.getElementById('billDiscountRow');
    const discAmt = document.getElementById('billDiscount');
    if (discount > 0) {
      discRow.style.display = 'flex';
      discAmt.textContent = `-₹${discount.toFixed(2)}`;
    } else {
      discRow.style.display = 'none';
    }

    const delivFeeEl = document.getElementById('billDeliveryFee');
    delivFeeEl.textContent = deliveryFee === 0 ? 'FREE (Campus Offer)' : `₹${deliveryFee.toFixed(2)}`;

    document.getElementById('billGrandTotal').textContent = `₹${grandTotal.toFixed(2)}`;
    document.getElementById('checkoutBtnAmount').textContent = `₹${grandTotal.toFixed(2)} →`;
    if (mobileTotal) mobileTotal.textContent = `₹${grandTotal.toFixed(2)}`;

    // Update delivery location in cart drawer
    const locSummary = document.getElementById('cartLocSummary');
    const locBox = document.getElementById('cartLocBox');
    if (this.deliveryType === 'pickup') {
      if (locBox) locBox.style.display = 'none';
    } else {
      if (locBox) locBox.style.display = 'block';
      if (locSummary) locSummary.textContent = `${this.deliveryLocation.block}, ${this.deliveryLocation.room}`;
    }
  }

  toggleCart(open) {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartBackdrop');
    if (open) {
      drawer.classList.add('open');
      backdrop.classList.add('open');
    } else {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
    }
  }

  setDeliveryType(type) {
    this.deliveryType = type;
    const btnDeliv = document.getElementById('btnTypeDelivery');
    const btnPick = document.getElementById('btnTypePickup');
    if (type === 'delivery') {
      btnDeliv.classList.add('active');
      btnPick.classList.remove('active');
    } else {
      btnPick.classList.add('active');
      btnDeliv.classList.remove('active');
    }
    this.renderCart();
  }

  // ==================== COUPONS ====================
  async applyCoupon() {
    const input = document.getElementById('couponInput');
    const feedback = document.getElementById('couponFeedback');
    const code = input.value.trim();

    if (!code) {
      feedback.textContent = 'Please enter a coupon code';
      feedback.className = 'coupon-feedback error';
      return;
    }

    const itemKeys = Object.keys(this.cart);
    const subtotal = itemKeys.reduce((acc, id) => acc + (this.cart[id].item.price * this.cart[id].quantity), 0);

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, subtotal: subtotal })
      });

      const data = await res.json();
      if (res.ok) {
        this.appliedCoupon = data;
        feedback.textContent = `🎉 Coupon '${data.code}' applied! Saved ₹${data.discount}`;
        feedback.className = 'coupon-feedback success';
        this.showToast(`Saved ₹${data.discount} with ${data.code}`, 'success');
        this.renderCart();
      } else {
        this.appliedCoupon = null;
        feedback.textContent = data.detail || 'Invalid coupon code';
        feedback.className = 'coupon-feedback error';
        this.renderCart();
      }
    } catch (e) {
      feedback.textContent = 'Failed to validate coupon';
      feedback.className = 'coupon-feedback error';
    }
  }

  fillCoupon(code) {
    document.getElementById('couponInput').value = code;
    this.applyCoupon();
  }

  // ==================== CHECKOUT & PLACEMENT (100% COD) ====================
  openCheckoutModal() {
    this.toggleCart(false);

    const itemKeys = Object.keys(this.cart);
    if (itemKeys.length === 0) {
      this.showToast('Your food tray is empty! Please add dishes first.', 'error');
      return;
    }

    const firstEntry = this.cart[itemKeys[0]];
    if (!firstEntry || !firstEntry.item) {
      this.cart = {};
      this.saveCart();
      this.renderCart();
      this.showToast('Cart data was reset. Please re-add dishes.', 'error');
      return;
    }

    let subtotal = itemKeys.reduce((acc, id) => {
      const e = this.cart[id];
      return acc + (e && e.item ? (e.item.price * e.quantity) : 0);
    }, 0);

    const deliveryFee = (this.deliveryType === 'pickup' || subtotal >= 150) ? 0 : 10;
    const discount = this.appliedCoupon ? this.appliedCoupon.discount : 0;
    const grandTotal = Math.max(0, subtotal - discount + deliveryFee);

    const finalAmountEl = document.getElementById('checkoutFinalAmount');
    if (finalAmountEl) finalAmountEl.textContent = `₹${grandTotal.toFixed(2)}`;
    
    // Update location text
    const locText = document.getElementById('checkoutLocText');
    if (locText) {
      if (this.deliveryType === 'pickup') {
        locText.textContent = `🏃 Self Pickup at ${firstEntry.item.outlet_name} Counter`;
      } else {
        const block = (this.deliveryLocation && this.deliveryLocation.block) ? this.deliveryLocation.block : 'Boys Hostel Block 1';
        const room = (this.deliveryLocation && this.deliveryLocation.room) ? this.deliveryLocation.room : 'Room 204';
        locText.textContent = `📍 ${block}, ${room}`;
      }
    }

    this.openModal('checkoutModal');
  }

  async submitOrder() {
    const btn = document.getElementById('btnPlaceOrder');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Placing Campus Order... ⏳</span>';
    }

    try {
      const studentNameInput = document.getElementById('checkoutStudentName');
      const studentPhoneInput = document.getElementById('checkoutStudentPhone');
      const studentName = (studentNameInput && studentNameInput.value.trim()) || 'Campus Student';
      const studentPhone = (studentPhoneInput && studentPhoneInput.value.trim()) || '+91 98765 43210';

      const itemKeys = Object.keys(this.cart);
      if (itemKeys.length === 0) {
        alert('Your campus food tray is empty! Please add dishes before placing an order.');
        return;
      }

      let firstItem = null;
      const itemsPayload = [];

      for (const id of itemKeys) {
        const entry = this.cart[id];
        if (entry && entry.item) {
          if (!firstItem) firstItem = entry.item;
          itemsPayload.push({
            menu_item_id: parseInt(entry.item.id || id),
            item_name: entry.item.name,
            price: Number(entry.item.price),
            quantity: Number(entry.quantity || 1),
            special_notes: entry.specialNotes || ''
          });
        }
      }

      if (!firstItem || itemsPayload.length === 0) {
        alert('Cart items are not properly loaded. Please clear tray and re-add dishes.');
        this.cart = {};
        this.saveCart();
        this.renderCart();
        return;
      }

      const locBlock = (this.deliveryLocation && this.deliveryLocation.block) ? this.deliveryLocation.block : 'Boys Hostel Block 1';
      const locRoom = (this.deliveryLocation && this.deliveryLocation.room) ? this.deliveryLocation.room : 'Room 204';

      const payload = {
        student_name: studentName,
        student_phone: studentPhone,
        delivery_type: this.deliveryType || 'delivery',
        location_block: this.deliveryType === 'pickup' ? 'Campus Canteen Counter' : locBlock,
        location_room: this.deliveryType === 'pickup' ? 'Pickup Counter' : locRoom,
        outlet_id: parseInt(firstItem.outlet_id),
        outlet_name: firstItem.outlet_name,
        items: itemsPayload,
        coupon_code: this.appliedCoupon ? this.appliedCoupon.code : null,
        payment_method: 'cod'
      };

      console.log('Placing Order with Payload:', payload);

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const orderData = await res.json();
      console.log('Order API Response:', res.status, orderData);

      if (res.ok) {
        this.cart = {};
        this.appliedCoupon = null;
        this.saveCart();
        this.renderDishes();
        this.renderCart();
        this.closeModal('checkoutModal');

        this.showToast(`Order #${orderData.order_number} confirmed! Cash on Delivery`, 'success');
        this.playSuccessChime();

        // Save active order in state & localStorage
        this.activeOrderId = orderData.id;
        localStorage.setItem('ofds_active_order_id', orderData.id);

        // Refresh orders list
        await this.fetchOrders();
        this.syncActiveOrderBanner();

        // Open live tracker immediately
        this.openTrackerModal(orderData);
      } else {
        let errMsg = 'Could not place order.';
        if (typeof orderData.detail === 'string') {
          errMsg = orderData.detail;
        } else if (Array.isArray(orderData.detail)) {
          errMsg = orderData.detail.map(d => `${d.loc ? d.loc.slice(1).join('.') : ''}: ${d.msg}`).join('\n');
        }
        alert(errMsg);
      }
    } catch (e) {
      console.error('Error in submitOrder:', e);
      alert('Error placing order: ' + (e.message || e));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Confirm & Place Order (Cash on Delivery) 🚀</span>';
      }
    }
  }

  // ==================== LIVE STUDENT TRACKING & ACTIVE BANNER ====================
  async syncActiveOrderBanner() {
    const banner = document.getElementById('studentActiveOrderBanner');
    if (!this.activeOrderId) {
      if (banner) banner.style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`/api/orders/${this.activeOrderId}`);
      if (!res.ok) {
        if (banner) banner.style.display = 'none';
        return;
      }

      const order = await res.json();
      if (!banner) return;

      const orderNoEl = document.getElementById('activeBannerOrderNo');
      const statusEl = document.getElementById('activeBannerStatus');
      const amountEl = document.getElementById('activeBannerAmount');

      if (orderNoEl) orderNoEl.textContent = `#${order.order_number}`;
      if (amountEl) amountEl.textContent = `₹${order.total_amount.toFixed(2)}`;

      let statusLabel = 'Order Placed (Pending)';
      let statusClass = 'status-pending';

      if (order.status === 'preparing') {
        statusLabel = 'Cooking in Kitchen 🍳';
        statusClass = 'status-preparing';
      } else if (order.status === 'ready') {
        statusLabel = order.delivery_type === 'pickup' ? 'Ready for Counter Pickup 🏃' : 'Ready for Dispatch 🚴';
        statusClass = 'status-ready';
      } else if (order.status === 'en_route') {
        statusLabel = 'Runner on the Way 🚴';
        statusClass = 'status-en_route';
      } else if (order.status === 'delivered') {
        statusLabel = 'Delivered & Paid 🎉';
        statusClass = 'status-delivered';
      } else if (order.status === 'cancelled') {
        statusLabel = 'Order Cancelled ❌';
        statusClass = 'status-cancelled';
      }

      if (statusEl) {
        statusEl.textContent = statusLabel;
        statusEl.className = `badge-status ${statusClass}`;
      }

      banner.style.display = 'block';

      // If delivered or cancelled, remove after 10 mins or allow student to dismiss
      if (order.status === 'delivered' || order.status === 'cancelled') {
        setTimeout(() => {
          if (this.activeOrderId === order.id) {
            this.activeOrderId = null;
            localStorage.removeItem('ofds_active_order_id');
            if (banner) banner.style.display = 'none';
          }
        }, 30000);
      }
    } catch (e) {}
  }

  async openTrackerModal(order) {
    if (!order && this.activeOrderId) {
      const res = await fetch(`/api/orders/${this.activeOrderId}`);
      if (res.ok) order = await res.json();
    }
    if (!order) return;

    this.activeOrderId = order.id;
    localStorage.setItem('ofds_active_order_id', order.id);
    this.renderTrackerContent(order);
    this.openModal('trackerModal');
  }

  renderTrackerContent(order) {
    const container = document.getElementById('trackerModalContent');
    if (!container) return;

    // Status mapping: 0=pending, 1=preparing, 2=en_route/ready, 3=delivered
    const statuses = ['pending', 'preparing', 'en_route', 'delivered'];
    let currentIdx = statuses.indexOf(order.status);
    if (order.status === 'confirmed') currentIdx = 0;
    if (order.status === 'ready') currentIdx = 2;
    if (currentIdx === -1) currentIdx = 0;

    const fillPercent = Math.min(100, Math.max(0, (currentIdx / 3) * 100));

    let etaText = '15-20 Mins';
    let statusMessage = 'Canteen received your order. Waiting for chef to accept.';
    
    if (order.status === 'preparing') {
      etaText = '10-12 Mins';
      statusMessage = 'The canteen chef is currently cooking your hot food! 🔥';
    } else if (order.status === 'ready') {
      etaText = order.delivery_type === 'pickup' ? 'Ready for Pickup!' : 'Awaiting Runner Pickup';
      statusMessage = order.delivery_type === 'pickup' 
        ? 'Your food is packed and waiting for you at the counter!' 
        : 'Food is prepared! Ready for campus runner pickup.';
    } else if (order.status === 'en_route') {
      etaText = '3-5 Mins (Arriving)';
      statusMessage = 'Your runner has picked up the food and is en route to your hostel room!';
    } else if (order.status === 'delivered') {
      etaText = 'Delivered 🎉';
      statusMessage = 'Order handover complete! Cash payment collected. Enjoy your meal!';
    } else if (order.status === 'cancelled') {
      etaText = 'Cancelled';
      statusMessage = 'This order was cancelled by the canteen.';
    }

    const itemsSummary = order.items ? order.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ') : '';

    container.innerHTML = `
      <div class="tracker-hero">
        <div>
          <span class="tracker-eta-label">Estimated Delivery ETA</span>
          <div class="tracker-eta-time">${etaText}</div>
          <div class="tracker-eta-dest">📍 ${order.location_block} • ${order.location_room}</div>
        </div>
        <div class="tracker-pin-card">
          <span class="tracker-pin-label">VERIFICATION PIN</span>
          <div class="tracker-pin-number">${order.pin}</div>
          <span style="font-size:0.65rem; color:#cbd5e1;">Share with runner</span>
        </div>
      </div>

      <div class="live-sync-notice">
        <span class="live-pulse"></span>
        <span>${statusMessage} (Updates automatically in real-time)</span>
      </div>

      <!-- Stepper Line -->
      <div class="tracker-stepper">
        <div class="stepper-line">
          <div class="stepper-line-fill" style="width: ${fillPercent}%;"></div>
        </div>

        <div class="step-node ${currentIdx >= 0 ? 'active' : ''}">
          <div class="step-circle">1</div>
          <span class="step-label">Order Placed</span>
        </div>
        <div class="step-node ${currentIdx >= 1 ? 'active' : ''}">
          <div class="step-circle">2</div>
          <span class="step-label">In Kitchen</span>
        </div>
        <div class="step-node ${currentIdx >= 2 ? 'active' : ''}">
          <div class="step-circle">3</div>
          <span class="step-label">${order.delivery_type === 'pickup' ? 'Ready at Counter' : 'En Route'}</span>
        </div>
        <div class="step-node ${currentIdx >= 3 ? 'active' : ''}">
          <div class="step-circle">4</div>
          <span class="step-label">Delivered & Paid</span>
        </div>
      </div>

      <!-- Runner / Canteen Contact Card -->
      <div class="runner-contact-card">
        <div class="runner-profile">
          <div class="runner-avatar">🚴</div>
          <div>
            <div class="runner-name">Campus Delivery Runner Rahul #4</div>
            <div class="runner-desc">Assigned to ${order.location_block} • ${order.outlet_name}</div>
          </div>
        </div>
        <a href="tel:+919876500012" class="btn btn-sm btn-outline">📞 Call Runner</a>
      </div>

      <!-- Order Details Summary with Cash on Delivery Highlight -->
      <div style="background:#f8fafc; border:1px solid var(--border-light); border-radius:12px; padding:16px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;">
          <strong style="font-size:1rem;">Order #${order.order_number}</strong>
          <span style="font-weight:800; font-size:1.1rem; color:#065f46; background:#d1fae5; padding:4px 10px; border-radius:6px;">
            💵 Pay Cash: ₹${order.total_amount.toFixed(2)}
          </span>
        </div>
        <div style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
          <strong>Canteen:</strong> ${order.outlet_name}<br>
          <strong>Items:</strong> ${itemsSummary}<br>
          <strong>Payment Mode:</strong> 💵 Cash on Delivery (${order.payment_status})
        </div>
      </div>
    `;
  }

  async refreshCurrentTracking() {
    if (!this.activeOrderId) return;
    const res = await fetch(`/api/orders/${this.activeOrderId}`);
    if (res.ok) {
      const order = await res.json();
      this.renderTrackerContent(order);
      this.syncActiveOrderBanner();
      this.showToast('Order status updated', 'success');
    }
  }

  // ==================== MY ORDERS HISTORY ====================
  async openOrdersModal() {
    await this.fetchOrders();
    const list = document.getElementById('studentOrdersList');
    if (!list) return;

    if (this.orders.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:40px 20px;">
          <p style="color:var(--text-muted);">No campus orders placed yet.</p>
        </div>
      `;
    } else {
      list.innerHTML = this.orders.map(o => `
        <div style="background:#f8fafc; border:1px solid var(--border-light); border-radius:12px; padding:16px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:1rem;">#${o.order_number}</strong>
              <span class="badge-status status-${o.status}">${o.status}</span>
            </div>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px;">
              ${o.outlet_name} • 📍 ${o.location_block}, ${o.location_room}
            </p>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
              ${o.created_at} • 💵 Cash on Delivery: <strong>₹${o.total_amount.toFixed(0)}</strong>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="btn btn-sm btn-primary" onclick="app.openTrackerModal(app.orders.find(ord => ord.id === ${o.id}))">
              Track Status 📍
            </button>
          </div>
        </div>
      `).join('');
    }

    this.openModal('ordersModal');
  }

  // ==================== ROLE SWITCHER & KDS / RUNNER ====================
  switchRole(role) {
    this.currentRole = role;
    const studentView = document.getElementById('studentView');
    const vendorView = document.getElementById('vendorView');
    const runnerView = document.getElementById('runnerView');
    const tabStudent = document.getElementById('tabStudent');
    const tabVendor = document.getElementById('tabVendor');
    const tabRunner = document.getElementById('tabRunner');
    const searchBar = document.getElementById('headerSearchBar');
    const locPill = document.getElementById('headerLocationPill');

    // Update active tabs
    [tabStudent, tabVendor, tabRunner].forEach(t => t && t.classList.remove('active'));
    studentView.style.display = 'none';
    vendorView.style.display = 'none';
    runnerView.style.display = 'none';

    if (role === 'student') {
      tabStudent.classList.add('active');
      studentView.style.display = 'block';
      if (searchBar) searchBar.style.display = 'flex';
      if (locPill) locPill.style.display = 'flex';
    } else if (role === 'vendor') {
      tabVendor.classList.add('active');
      vendorView.style.display = 'block';
      if (searchBar) searchBar.style.display = 'none';
      if (locPill) locPill.style.display = 'none';
      // Dismiss alert dot
      const alertDot = document.getElementById('navVendorAlert');
      if (alertDot) alertDot.style.display = 'none';
      this.initVendorView();
    } else if (role === 'runner') {
      tabRunner.classList.add('active');
      runnerView.style.display = 'block';
      if (searchBar) searchBar.style.display = 'none';
      if (locPill) locPill.style.display = 'none';
      this.initRunnerView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async initVendorView() {
    await this.fetchOrders();
    const stats = await this.fetchStats();
    this.renderVendorStats(stats);
    this.renderKdsOrders();
    this.renderStockTable();
  }

  renderVendorStats(stats) {
    const container = document.getElementById('vendorStats');
    if (!container || !stats) return;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-title">Active Kitchen Orders</div>
        <div class="stat-value" style="color:var(--primary);">${stats.active_orders}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Delivered & Cash Collected</div>
        <div class="stat-value" style="color:var(--accent-emerald);">${stats.delivered_orders}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Total Cash Revenue</div>
        <div class="stat-value">₹${stats.revenue.toFixed(0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Total Campus Orders</div>
        <div class="stat-value">${stats.total_orders}</div>
      </div>
    `;
  }

  renderKdsOrders() {
    const outletSelect = document.getElementById('kdsOutletSelect');
    const outletFilter = outletSelect ? outletSelect.value : 'all';
    
    let ordersToFilter = this.orders;
    if (outletFilter !== 'all') {
      ordersToFilter = ordersToFilter.filter(o => o.outlet_id === parseInt(outletFilter));
    }

    const pending = ordersToFilter.filter(o => o.status === 'pending' || o.status === 'confirmed');
    const preparing = ordersToFilter.filter(o => o.status === 'preparing');
    const ready = ordersToFilter.filter(o => o.status === 'ready' || o.status === 'en_route');
    const delivered = ordersToFilter.filter(o => o.status === 'delivered');

    document.getElementById('pendingCount').textContent = pending.length;
    document.getElementById('preparingCount').textContent = preparing.length;
    document.getElementById('readyCount').textContent = ready.length;
    document.getElementById('deliveredCount').textContent = delivered.length;

    // Card Template Generator
    const renderCard = (o, stage) => `
      <div class="kds-card">
        <div class="kds-card-top">
          <span class="kds-ord-no">#${o.order_number}</span>
          <span class="kds-time">⏱️ ${o.created_at.split(' ')[1] || ''}</span>
        </div>
        
        <div class="kds-student-dest">
          📍 ${o.location_block} • ${o.location_room}
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
            👤 ${o.student_name} (${o.student_phone})
          </div>
        </div>

        <div class="kds-cash-badge">
          <span>💵 Collect Cash:</span>
          <span>₹${o.total_amount.toFixed(0)} (COD)</span>
        </div>

        <div class="kds-items-list">
          ${o.items.map(i => `
            <div class="kds-item-line">
              <span><strong>${i.quantity}x</strong> ${i.item_name}</span>
            </div>
            ${i.special_notes ? `<div class="kds-item-notes">Note: "${i.special_notes}"</div>` : ''}
          `).join('')}
        </div>

        <div class="kds-actions">
          ${stage === 'pending' ? `
            <button class="btn btn-sm btn-primary" onclick="app.updateOrderStatus(${o.id}, 'preparing')">
              👨‍🍳 Accept & Start Cooking
            </button>
            <button class="btn btn-sm btn-danger-outline" onclick="app.cancelOrder(${o.id})">
              ✕ Cancel Order
            </button>
          ` : stage === 'preparing' ? `
            <button class="btn btn-sm btn-primary" onclick="app.updateOrderStatus(${o.id}, 'ready')">
              🔔 Mark Ready for Pickup / Runner
            </button>
          ` : stage === 'ready' ? `
            <button class="btn btn-sm btn-success" onclick="app.updateOrderStatus(${o.id}, 'delivered')">
              ✅ Mark Delivered & Cash Collected
            </button>
            <button class="btn btn-sm btn-outline" onclick="app.updateOrderStatus(${o.id}, 'en_route')">
              🚴 Dispatch with Runner
            </button>
          ` : `
            <div style="font-size:0.8rem; font-weight:700; color:var(--accent-emerald-dark); text-align:center; padding:4px;">
              ✓ Handover & Cash Received
            </div>
          `}
        </div>
      </div>
    `;

    document.getElementById('kdsPendingList').innerHTML = pending.length > 0 
      ? pending.map(o => renderCard(o, 'pending')).join('') 
      : '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px;">No incoming orders</p>';

    document.getElementById('kdsPreparingList').innerHTML = preparing.length > 0 
      ? preparing.map(o => renderCard(o, 'preparing')).join('') 
      : '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px;">Kitchen clear</p>';

    document.getElementById('kdsReadyList').innerHTML = ready.length > 0 
      ? ready.map(o => renderCard(o, 'ready')).join('') 
      : '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px;">No orders waiting</p>';

    document.getElementById('kdsDeliveredList').innerHTML = delivered.length > 0 
      ? delivered.slice(0, 10).map(o => renderCard(o, 'delivered')).join('') 
      : '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px;">No completed orders yet</p>';
  }

  async renderStockTable() {
    const container = document.getElementById('stockTableContainer');
    if (!container) return;

    container.innerHTML = `
      <table class="stock-table">
        <thead>
          <tr>
            <th>Dish Name</th>
            <th>Canteen</th>
            <th>Price</th>
            <th>Availability</th>
          </tr>
        </thead>
        <tbody>
          ${this.menuItems.slice(0, 15).map(item => `
            <tr>
              <td><strong>${item.name}</strong></td>
              <td>${item.outlet_name}</td>
              <td>₹${item.price.toFixed(0)}</td>
              <td>
                <label class="switch">
                  <input type="checkbox" ${item.in_stock ? 'checked' : ''} onchange="app.toggleItemStock(${item.id}, this.checked)">
                  <span class="slider"></span>
                </label>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async toggleItemStock(itemId, inStock) {
    try {
      const res = await fetch(`/api/menu/${itemId}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ in_stock: inStock })
      });
      if (res.ok) {
        this.showToast(`Updated stock status`, 'success');
        await this.fetchMenu();
        this.renderDishes();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async updateOrderStatus(orderId, status, pin = null) {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status, pin: pin, role: this.currentRole })
      });

      const data = await res.json();
      if (res.ok) {
        this.showToast(`Order status updated to '${status.toUpperCase()}'`, 'success');
        await this.fetchOrders();
        
        if (this.currentRole === 'vendor') {
          const stats = await this.fetchStats();
          this.renderVendorStats(stats);
          this.renderKdsOrders();
        }
        if (this.currentRole === 'runner') this.initRunnerView();
        
        // Sync active banner & tracker
        this.syncActiveOrderBanner();
        if (this.activeOrderId === orderId) this.renderTrackerContent(data);
      } else {
        alert(data.detail || 'Failed to update order status');
      }
    } catch (e) {
      alert('Error updating order status');
    }
  }

  async cancelOrder(orderId) {
    if (confirm('Are you sure you want to cancel this campus order?')) {
      await this.updateOrderStatus(orderId, 'cancelled');
    }
  }

  // ==================== RUNNER VIEW ====================
  async initRunnerView() {
    await this.fetchOrders();
    const list = document.getElementById('runnerOrdersList');
    if (!list) return;

    // Filter for orders ready or en_route
    const activeDeliveries = this.orders.filter(o => 
      (o.status === 'ready' || o.status === 'en_route') && o.delivery_type === 'delivery'
    );

    if (activeDeliveries.length === 0) {
      list.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:60px 20px; background:white; border-radius:16px; border:1px dashed var(--border-light);">
          <div style="font-size:3rem; margin-bottom:8px;">🚴</div>
          <h3>All Campus Deliveries Completed</h3>
          <p style="color:var(--text-muted);">New orders ready at canteen will appear here automatically.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = activeDeliveries.map(o => `
      <div class="runner-card">
        <div class="runner-card-top">
          <strong style="font-size:1.05rem;">Order #${o.order_number}</strong>
          <span class="badge-status status-${o.status}">${o.status}</span>
        </div>

        <div class="runner-room-badge">
          <span>📍 Deliver to:</span>
          <strong>${o.location_block} - ${o.location_room}</strong>
        </div>

        <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px; line-height:1.5;">
          <strong>Student:</strong> ${o.student_name} (${o.student_phone})<br>
          <strong>Canteen:</strong> ${o.outlet_name}<br>
          <div class="kds-cash-badge" style="margin-top:8px;">
            <span>💵 Collect Cash:</span>
            <span>₹${o.total_amount.toFixed(0)} (Cash on Delivery)</span>
          </div>
        </div>

        <div style="border-top:1px dashed var(--border-light); padding-top:12px; margin-top:auto;">
          ${o.status === 'ready' ? `
            <button class="btn btn-primary btn-sm" style="width:100%;" onclick="app.updateOrderStatus(${o.id}, 'en_route')">
              🚴 Pick Up from Canteen & Start Delivery
            </button>
          ` : `
            <div>
              <label style="font-size:0.78rem; font-weight:700; color:var(--text-secondary);">Enter Student's 4-Digit PIN to Complete:</label>
              <div class="runner-pin-group">
                <input type="text" maxlength="4" placeholder="e.g. ${o.pin}" id="runnerPin_${o.id}">
                <button class="btn btn-primary btn-sm" onclick="app.confirmRunnerHandover(${o.id})">Verify & Deliver</button>
              </div>
            </div>
          `}
        </div>
      </div>
    `).join('');
  }

  confirmRunnerHandover(orderId) {
    const input = document.getElementById(`runnerPin_${orderId}`);
    if (!input || !input.value.trim()) {
      alert('Please enter the 4-digit student delivery PIN');
      return;
    }
    this.updateOrderStatus(orderId, 'delivered', input.value.trim());
  }

  // ==================== FILTERS & SEARCH ====================
  filterByOutlet(outletId) {
    this.activeOutletId = outletId;
    this.renderOutlets();
    this.fetchMenu().then(() => this.renderDishes());
  }

  filterByCategory(categoryId) {
    this.activeCategoryId = categoryId;
    this.renderCategoryNav();
    this.fetchMenu().then(() => this.renderDishes());
  }

  setDietFilter(type) {
    this.dietFilter = type;
    document.querySelectorAll('.filter-chips-wrapper .chip').forEach(c => c.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    this.fetchMenu().then(() => this.renderDishes());
  }

  handleSearch(val) {
    this.searchQuery = val;
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    this.fetchMenu().then(() => this.renderDishes());
  }

  clearSearch() {
    this.searchQuery = '';
    const input = document.getElementById('globalSearchInput');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    this.fetchMenu().then(() => this.renderDishes());
  }

  resetFilters() {
    this.activeOutletId = null;
    this.activeCategoryId = null;
    this.dietFilter = 'all';
    this.clearSearch();
    this.renderAll();
  }

  resetView() {
    this.resetFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== LOCATION MODAL ====================
  openLocationModal() {
    this.openModal('locationModal');
  }

  handleBlockChange(val) {
    const roomInput = document.getElementById('locRoomInput');
    if (val.includes('Hostel')) {
      roomInput.placeholder = 'e.g. Room 204';
    } else if (val.includes('Academic')) {
      roomInput.placeholder = 'e.g. 2nd Floor Lab / Class 301';
    } else {
      roomInput.placeholder = 'e.g. Near Big Screen / Bench 4';
    }
  }

  saveLocation() {
    const block = document.getElementById('locBlockSelect').value;
    const room = document.getElementById('locRoomInput').value.trim() || 'Room 101';
    this.deliveryLocation = { block, room };
    this.updateLocationDisplay();
    this.closeModal('locationModal');
    this.renderCart();
    this.showToast(`Delivery spot set to: ${block}, ${room}`, 'success');
  }

  updateLocationDisplay() {
    const display = document.getElementById('currentLocationDisplay');
    if (display) display.textContent = `${this.deliveryLocation.block}, ${this.deliveryLocation.room}`;
  }

  // ==================== BACKGROUND POLLING (LIVE SYNC) ====================
  startOrderPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      await this.fetchOrders();

      if (this.currentRole === 'vendor') {
        this.renderKdsOrders();
      } else if (this.currentRole === 'runner') {
        this.initRunnerView();
      }

      // Sync student active banner & tracker modal
      if (this.activeOrderId) {
        this.syncActiveOrderBanner();

        const trackerModal = document.getElementById('trackerModal');
        if (trackerModal && trackerModal.classList.contains('open')) {
          const res = await fetch(`/api/orders/${this.activeOrderId}`);
          if (res.ok) {
            const ord = await res.json();
            this.renderTrackerContent(ord);
          }
        }
      }
    }, 2500);
  }

  refreshAllData() {
    if (this.currentRole === 'vendor') this.initVendorView();
    if (this.currentRole === 'runner') this.initRunnerView();
    this.showToast('Data refreshed', 'success');
  }

  // ==================== LOCAL STORAGE CART ====================
  saveCart() {
    try {
      localStorage.setItem('ofds_cart', JSON.stringify(this.cart));
    } catch (e) {}
  }

  loadSavedCart() {
    try {
      const saved = localStorage.getItem('ofds_cart');
      if (saved) this.cart = JSON.parse(saved);
    } catch (e) {}
  }

  // ==================== MODAL UTILITIES ====================
  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }

  playSuccessChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.06, ctx.currentTime + (i * 0.08));
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i * 0.08) + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + (i * 0.08));
        osc.stop(ctx.currentTime + (i * 0.08) + 0.25);
      });
    } catch (e) {}
  }

  playBellChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }
}

// Instantiate and expose globally
const app = new CampusFoodApp();
window.app = app;
