/**
 * ============================================================
 *  بندورة لاستيراد الاستانلس ستيل — app.js
 *  Full PWA Logic + Firebase Integration
 * ============================================================
 *
 *  ⚙️  SETUP: Replace the Firebase config below with your project config.
 *  Get it from: Firebase Console → Project Settings → Your Apps → SDK snippet
 * ============================================================
 */

// ============================================================
//  🔥 FIREBASE CONFIG — استبدل هذه القيم بإعدادات مشروعك
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAeYCJBkvY-hKdeBoq_zWDr8p8ElbCHRKE",
  authDomain: "pn316-df6f3.firebaseapp.com",
  projectId: "pn316-df6f3",
  storageBucket: "pn316-df6f3.firebasestorage.app",
  messagingSenderId: "146162971635",
  appId: "1:146162971635:web:83ead2737cddded1639886",
  measurementId: "G-DM6YCESS39"
};

// ============================================================
//  ⚙️  APP CONFIG
// ============================================================
const APP_CONFIG = {
  // رقم واتساب الأدمن للإشعارات (مع كود الدولة بدون +)
  adminWhatsapp: "201000000000",
  // رقم واتساب لإرسال الرسائل للعملاء (يمكن تغييره)
  whatsappSender: "201000000000",
  currency: "جنيه",
  appName: "بندورة لاستيراد الاستانلس ستيل"
};

// ============================================================
//  GLOBALS
// ============================================================
let db = null, storage = null, auth = null;
let allOrders = [];
let allProducts = [];
let currentOrder = null;
let selectedProduct = null;
let uploadedReceiptFile = null;
let deferredPrompt = null;
let isAdminMode = false;

// ============================================================
//  FIREBASE DYNAMIC IMPORT
// ============================================================
async function initFirebase() {
  try {
    const [
      { initializeApp },
      { getFirestore, collection, addDoc, getDocs, doc, updateDoc,
        onSnapshot, query, orderBy, serverTimestamp, getDoc },
      { getStorage, ref, uploadBytes, getDownloadURL },
      { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js")
    ]);

    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);

    // Attach Firestore helpers globally
    window._fs = {
      collection, addDoc, getDocs, doc, updateDoc,
      onSnapshot, query, orderBy, serverTimestamp, getDoc
    };
    window._stg = { ref, uploadBytes, getDownloadURL };
    window._authFns = { signInWithEmailAndPassword, signOut, onAuthStateChanged };

    return true;
  } catch (err) {
    console.error("Firebase init error:", err);
    return false;
  }
}

// ============================================================
//  INIT APP
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  isAdminMode = urlParams.get('page') === 'admin';

  try {
    const firebaseReady = await initFirebase();

    if (!firebaseReady) {
      console.warn("Running in DEMO mode.");
      loadDemoProducts();
    } else {
      if (isAdminMode) {
        showAdminPage();
        monitorAuthState();
      } else {
        await loadProducts(); // انتظر تحميل المنتجات
      }
    }
  } catch (error) {
    console.error("Initialization error:", error);
    loadDemoProducts(); // في حال حدوث خطأ، اعرض بيانات تجريبية
  } finally {
    hideLoader(); // سيتم إخفاء الشاشة في كل الحالات (نجاح أو فشل)
  }

  // PWA Install
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => document.getElementById('installBanner').classList.add('show'), 3000);
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => console.log('SW registered'))
      .catch(console.error);
  }
});

function hideLoader() {
  setTimeout(() => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hide');
    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 500);
  }, 1200);
}

// ============================================================
//  PWA INSTALL
// ============================================================
window.installApp = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') showToast('✅ تم تثبيت التطبيق!', 'success');
  deferredPrompt = null;
  dismissInstall();
};

window.dismissInstall = () => {
  document.getElementById('installBanner').classList.remove('show');
};

// ============================================================
//  PRODUCTS
// ============================================================
async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  try {
    const { collection, getDocs, query, orderBy } = window._fs;
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts(allProducts);
    updateHeroStats();
  } catch (err) {
    console.warn("Products load error:", err);
    loadDemoProducts();
  }
  hideLoader();
}

function loadDemoProducts() {
  allProducts = [
    { id: 'demo1', name: 'طقم أواني استانلس 12 قطعة', desc: 'طقم كامل من الاستانلس ستيل 18/10 الفاخر، مناسب لجميع أنواع البوتاجازات', price: 2500, unit: 'للطقم', badge: 'الأكثر مبيعاً', emoji: '🥘' },
    { id: 'demo2', name: 'طنجرة ضغط استانلس 10 لتر', desc: 'طنجرة ضغط عالية الجودة بضمان 3 سنوات، موفرة للوقت والطاقة', price: 1800, unit: 'للقطعة', badge: 'جديد', emoji: '🍲' },
    { id: 'demo3', name: 'سيت سكاكين استانلس 6 قطع', desc: 'سكاكين مطبخ احترافية من الاستانلس ستيل الألماني مع حقيبة تخزين', price: 950, unit: 'للسيت', badge: '', emoji: '🔪' },
    { id: 'demo4', name: 'صحون تقديم استانلس (12 قطعة)', desc: 'صحون تقديم أنيقة مناسبة للمطاعم والمنازل، سهلة التنظيف', price: 1200, unit: 'للطقم', badge: 'عرض', emoji: '🍽️' },
    { id: 'demo5', name: 'إبريق شاي استانلس 3 لتر', desc: 'إبريق شاي فاخر بغطاء محكم وقبضة مريحة، مناسب لجميع البوتاجازات', price: 450, unit: 'للقطعة', badge: '', emoji: '🫖' },
    { id: 'demo6', name: 'قدر تبخير استانلس 2 طبق', desc: 'قدر تبخير بطبقتين لطهي صحي أسرع، من الاستانلس ستيل الممتاز', price: 1600, unit: 'للقطعة', badge: 'محدود', emoji: '♨️' },
  ];
  renderProducts(allProducts);
  updateHeroStats();
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  const count = document.getElementById('productsCount');
  document.getElementById('statProducts').textContent = products.length;
  count.textContent = `${products.length} منتج`;

  if (!products.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">لا توجد منتجات متاحة حالياً</div></div>`;
    return;
  }

  grid.innerHTML = products.map((p, i) => `
    <div class="product-card animate-in" style="animation-delay:${i * 0.07}s" onclick="openOrderModal('${p.id}')">
      <div class="product-img-wrap">
        ${p.imageUrl ? `<img class="product-img" src="${p.imageUrl}" alt="${p.name}" loading="lazy" />` :
          `<div class="product-img-placeholder"><span class="icon">${p.emoji || '🥘'}</span></div>`}
        ${p.badge ? `<div class="product-badge">${p.badge}</div>` : ''}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc || ''}</div>
        <div class="product-footer">
          <div class="product-price">
            <span class="price-amount">${p.price ? Number(p.price).toLocaleString('ar-EG') : '—'} ${APP_CONFIG.currency}</span>
            ${p.unit ? `<span class="price-unit">${p.unit}</span>` : ''}
          </div>
          <button class="product-order-btn" onclick="event.stopPropagation(); openOrderModal('${p.id}')">
            🛒 اطلب الآن
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function updateHeroStats() {
  document.getElementById('statProducts').textContent = allProducts.length;
  // Orders count - just a friendly number
  document.getElementById('statOrders').textContent = '500+';
}

// ============================================================
//  ORDER MODAL
// ============================================================
window.openOrderModal = (productId) => {
  selectedProduct = allProducts.find(p => p.id === productId);
  if (!selectedProduct) return;

  // Update modal product info
  document.getElementById('modalProductName').textContent = selectedProduct.name;
  document.getElementById('modalProductPrice').textContent =
    selectedProduct.price ? `${Number(selectedProduct.price).toLocaleString('ar-EG')} ${APP_CONFIG.currency}` : 'السعر عند الطلب';

  const imgEl = document.getElementById('modalProductImg');
  if (selectedProduct.imageUrl) {
    imgEl.innerHTML = `<img src="${selectedProduct.imageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="" />`;
  } else {
    imgEl.textContent = selectedProduct.emoji || '🥘';
  }

  // Reset form
  document.getElementById('orderForm').reset();
  document.getElementById('uploadField').classList.remove('show');
  document.getElementById('depositField').classList.remove('show');
  document.getElementById('businessField').classList.remove('show');
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('uploadArea').classList.remove('has-file');
  uploadedReceiptFile = null;
  clearErrors();
  updateSubmitBtn();

  document.getElementById('orderModal').classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeOrderModal = () => {
  document.getElementById('orderModal').classList.remove('active');
  document.body.style.overflow = '';
};

// Close on overlay click
document.getElementById('orderModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('orderModal')) closeOrderModal();
});

// ============================================================
//  FORM LOGIC
// ============================================================
window.toggleBusinessName = (checkbox) => {
  document.getElementById('businessField').classList.toggle('show', checkbox.checked);
};

window.onPaymentChange = (method) => {
  const uploadField = document.getElementById('uploadField');
  const depositField = document.getElementById('depositField');

  uploadField.classList.toggle('show', method === 'wallet' || method === 'instapay');
  depositField.classList.toggle('show', method === 'cash');

  uploadedReceiptFile = null;
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('uploadArea').classList.remove('has-file');

  // Clear deposit selection
  document.querySelectorAll('input[name="deposit"]').forEach(r => r.checked = false);

  updateSubmitBtn();
};

window.onReceiptUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('⚠️ حجم الصورة أكبر من 5MB', 'error');
    return;
  }

  uploadedReceiptFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('uploadPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('uploadArea').classList.add('has-file');
  };
  reader.readAsDataURL(file);
  updateSubmitBtn();
};

window.updateSubmitBtn = () => {
  const btn = document.getElementById('submitBtn');
  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
  let canSubmit = false;

  if (paymentMethod === 'cash') {
    const deposit = document.querySelector('input[name="deposit"]:checked');
    canSubmit = !!deposit;
  } else if (paymentMethod === 'wallet' || paymentMethod === 'instapay') {
    canSubmit = !!uploadedReceiptFile;
  }

  btn.disabled = !canSubmit;
};

// ============================================================
//  VALIDATION
// ============================================================
function validateOrderForm() {
  let valid = true;
  clearErrors();

  const name = document.getElementById('custName').value.trim();
  if (!name) { showError('errName'); valid = false; }

  const phone1 = document.getElementById('custPhone1').value.trim();
  if (!phone1 || !/^(01)[0-9]{9}$/.test(phone1)) { showError('errPhone1'); valid = false; }

  const address = document.getElementById('custAddress').value.trim();
  if (!address) { showError('errAddress'); valid = false; }

  const qty = parseInt(document.getElementById('custQty').value);
  if (!qty || qty < 1) { showError('errQty'); valid = false; }

  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
  if (!paymentMethod) { showError('errPayment'); valid = false; }

  if ((paymentMethod === 'wallet' || paymentMethod === 'instapay') && !uploadedReceiptFile) {
    showError('errUpload'); valid = false;
  }

  if (paymentMethod === 'cash' && !document.querySelector('input[name="deposit"]:checked')) {
    showError('errDeposit'); valid = false;
  }

  return valid;
}

function showError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(e => e.classList.remove('show'));
}

// ============================================================
//  SUBMIT ORDER
// ============================================================
window.submitOrder = async (event) => {
  event.preventDefault();
  if (!validateOrderForm()) return;

  const btn = document.getElementById('submitBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
    const depositAmount = document.querySelector('input[name="deposit"]:checked')?.value || null;

    let receiptUrl = null;

    // Upload receipt image if exists
    if (uploadedReceiptFile && storage) {
      const { ref, uploadBytes, getDownloadURL } = window._stg;
      const timestamp = Date.now();
      const storageRef = ref(storage, `receipts/${timestamp}_${uploadedReceiptFile.name}`);
      const snap = await uploadBytes(storageRef, uploadedReceiptFile);
      receiptUrl = await getDownloadURL(snap.ref);
    }

    const orderData = {
      customer: {
        name: document.getElementById('custName').value.trim(),
        phone1: document.getElementById('custPhone1').value.trim(),
        phone2: document.getElementById('custPhone2').value.trim() || null,
        business: document.getElementById('isMerchant').checked
          ? document.getElementById('custBusiness').value.trim()
          : null,
        address: document.getElementById('custAddress').value.trim(),
        notes: document.getElementById('custNotes').value.trim() || null,
      },
      product: {
        id: selectedProduct.id,
        name: selectedProduct.name,
        price: selectedProduct.price || null,
        unit: selectedProduct.unit || null,
      },
      qty: parseInt(document.getElementById('custQty').value),
      payment: {
        method: paymentMethod,
        depositAmount: depositAmount,
        receiptUrl: receiptUrl,
      },
      status: 'pending',
      shippingDate: null,
      createdAt: db ? window._fs.serverTimestamp() : new Date().toISOString(),
    };

    let orderId;
    if (db) {
      const { collection, addDoc } = window._fs;
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      orderId = docRef.id.slice(-6).toUpperCase();
    } else {
      // Demo mode
      orderId = Math.random().toString(36).slice(-6).toUpperCase();
      console.log("Demo order:", orderData);
    }

    // Close order modal, show success
    closeOrderModal();
    showSuccessModal(orderId);

  } catch (err) {
    console.error("Order submit error:", err);
    showToast('❌ حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

function showSuccessModal(orderId) {
  document.getElementById('successOrderNum').textContent = `رقم الطلب: #${orderId}`;
  document.getElementById('successModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

window.closeSuccessModal = () => {
  document.getElementById('successModal').classList.remove('active');
  document.body.style.overflow = '';
};

// ============================================================
//  ADMIN PAGE
// ============================================================
function showAdminPage() {
  document.getElementById('store-page').style.display = 'none';
  document.getElementById('admin-auth-page').style.display = 'flex';
  document.getElementById('admin-dashboard-page').style.display = 'none';
  hideLoader();
}

function monitorAuthState() {
  if (!auth) { showAdminPage(); return; }
  const { onAuthStateChanged } = window._authFns;
  onAuthStateChanged(auth, (user) => {
    if (user) {
      showDashboard(user);
    } else {
      showAdminPage();
    }
  });
}

window.adminLogin = async (event) => {
  event.preventDefault();
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('authError');
  errEl.style.display = 'none';
  btn.textContent = '...جاري الدخول';
  btn.disabled = true;

  try {
    if (!auth) throw new Error('Firebase not configured');
    const { signInWithEmailAndPassword } = window._authFns;
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    showDashboard(userCred.user);
  } catch (err) {
    errEl.style.display = 'flex';
    console.error(err);
  } finally {
    btn.textContent = 'دخول';
    btn.disabled = false;
  }
};

window.adminLogout = async () => {
  if (auth) {
    const { signOut } = window._authFns;
    await signOut(auth);
  }
  showAdminPage();
  allOrders = [];
};

function showDashboard(user) {
  document.getElementById('admin-auth-page').style.display = 'none';
  document.getElementById('admin-dashboard-page').style.display = 'block';
  document.getElementById('adminEmailDisplay').textContent = user.email;
  loadAdminOrders();
  loadAdminProducts();
}

// ============================================================
//  ADMIN ORDERS
// ============================================================
async function loadAdminOrders() {
  try {
    if (!db) { renderOrdersTable([]); return; }
    const { collection, query, orderBy, onSnapshot } = window._fs;
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snap) => {
      allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderOrdersTable(allOrders);
      updateAdminStats(allOrders);
    });
  } catch (err) {
    console.error(err);
    renderOrdersTable([]);
  }
}

function updateAdminStats(orders) {
  document.getElementById('statTotal').textContent = orders.length;
  document.getElementById('statPending').textContent = orders.filter(o => o.status === 'pending').length;
  document.getElementById('statAccepted').textContent = orders.filter(o => o.status === 'accepted').length;
  document.getElementById('statShipped').textContent = orders.filter(o => o.status === 'shipped').length;
  document.getElementById('statRejected').textContent = orders.filter(o => o.status === 'rejected').length;
  document.getElementById('tabBadgeOrders').textContent = orders.length;
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">لا توجد طلبات</div></div></td></tr>`;
    return;
  }

  const statusMap = {
    pending:  { label: 'في الانتظار', class: 'status-pending', icon: '⏳' },
    accepted: { label: 'مقبول',       class: 'status-accepted', icon: '✅' },
    shipped:  { label: 'تم الشحن',    class: 'status-shipped',  icon: '🚚' },
    rejected: { label: 'مرفوض',       class: 'status-rejected', icon: '❌' },
  };

  const paymentMap = {
    cash:     '💵 كاش',
    wallet:   '📱 محفظة',
    instapay: '⚡ InstaPay'
  };

  tbody.innerHTML = orders.map((order, i) => {
    const st = statusMap[order.status] || statusMap.pending;
    const date = order.createdAt?.toDate
      ? order.createdAt.toDate().toLocaleDateString('ar-EG')
      : (typeof order.createdAt === 'string' ? new Date(order.createdAt).toLocaleDateString('ar-EG') : '—');

    return `
      <tr>
        <td style="color:var(--steel);font-size:12px;">${i + 1}</td>
        <td style="font-weight:700;">${order.customer?.name || '—'}</td>
        <td dir="ltr">${order.customer?.phone1 || '—'}</td>
        <td>${order.product?.name || '—'}</td>
        <td style="text-align:center;">${order.qty || 1}</td>
        <td>${paymentMap[order.payment?.method] || '—'}</td>
        <td><span class="status-badge ${st.class}">${st.icon} ${st.label}</span></td>
        <td style="font-size:12px;color:var(--steel);">${date}</td>
        <td><button class="btn-view" onclick="openOrderDetail('${order.id}')">عرض</button></td>
      </tr>
    `;
  }).join('');
}

window.filterOrders = () => {
  const search = document.getElementById('searchFilter').value.trim().toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;

  const filtered = allOrders.filter(order => {
    const matchSearch = !search ||
      order.customer?.name?.toLowerCase().includes(search) ||
      order.customer?.phone1?.includes(search);
    const matchStatus = !statusFilter || order.status === statusFilter;
    return matchSearch && matchStatus;
  });

  renderOrdersTable(filtered);
};

// ============================================================
//  ORDER DETAIL
// ============================================================
window.openOrderDetail = (orderId) => {
  currentOrder = allOrders.find(o => o.id === orderId);
  if (!currentOrder) return;
  renderOrderDetail(currentOrder);
  document.getElementById('orderDetailModal').classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeDetailModal = () => {
  document.getElementById('orderDetailModal').classList.remove('active');
  document.body.style.overflow = '';
};

document.getElementById('orderDetailModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('orderDetailModal')) closeDetailModal();
});

function renderOrderDetail(order) {
  const statusMap = {
    pending:  { label: 'في الانتظار', class: 'status-pending', icon: '⏳' },
    accepted: { label: 'مقبول',       class: 'status-accepted', icon: '✅' },
    shipped:  { label: 'تم الشحن',    class: 'status-shipped',  icon: '🚚' },
    rejected: { label: 'مرفوض',       class: 'status-rejected', icon: '❌' },
  };
  const paymentNames = { cash: 'كاش عند الاستلام', wallet: 'محفظة إلكترونية', instapay: 'InstaPay' };
  const st = statusMap[order.status] || statusMap.pending;
  const date = order.createdAt?.toDate
    ? order.createdAt.toDate().toLocaleString('ar-EG')
    : (typeof order.createdAt === 'string' ? new Date(order.createdAt).toLocaleString('ar-EG') : '—');

  const orderId = order.id.slice(-6).toUpperCase();
  const customerPhone = order.customer?.phone1 || '';
  const shippingDate = order.shippingDate || '';

  document.getElementById('orderDetailContent').innerHTML = `
    <!-- Status & ID -->
    <div class="detail-section">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:12px;color:var(--steel);margin-bottom:4px;">رقم الطلب</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold);">#${orderId}</div>
        </div>
        <span class="status-badge ${st.class}">${st.icon} ${st.label}</span>
      </div>
      <div style="font-size:12px;color:var(--steel);margin-top:8px;">📅 ${date}</div>
    </div>

    <!-- Customer Info -->
    <div class="detail-section">
      <div class="detail-title">👤 بيانات العميل</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">الاسم</div><div class="detail-value">${order.customer?.name || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">الهاتف 1</div><div class="detail-value" dir="ltr">${order.customer?.phone1 || '—'}</div></div>
        ${order.customer?.phone2 ? `<div class="detail-item"><div class="detail-label">الهاتف 2</div><div class="detail-value" dir="ltr">${order.customer.phone2}</div></div>` : ''}
        ${order.customer?.business ? `<div class="detail-item"><div class="detail-label">اسم النشاط</div><div class="detail-value">${order.customer.business}</div></div>` : ''}
      </div>
      <div style="margin-top:12px;">
        <div class="detail-label">عنوان الشحن</div>
        <div class="detail-value" style="margin-top:4px;line-height:1.6;">📍 ${order.customer?.address || '—'}</div>
      </div>
      ${order.customer?.notes ? `<div style="margin-top:10px;"><div class="detail-label">ملاحظات</div><div class="detail-value">${order.customer.notes}</div></div>` : ''}
    </div>

    <!-- Product Info -->
    <div class="detail-section">
      <div class="detail-title">📦 المنتج المطلوب</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">المنتج</div><div class="detail-value">${order.product?.name || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">الكمية</div><div class="detail-value">${order.qty || 1}</div></div>
        ${order.product?.price ? `<div class="detail-item"><div class="detail-label">السعر</div><div class="detail-value" style="color:var(--gold);">${Number(order.product.price).toLocaleString('ar-EG')} جنيه</div></div>` : ''}
      </div>
    </div>

    <!-- Payment Info -->
    <div class="detail-section">
      <div class="detail-title">💳 بيانات الدفع</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">وسيلة الدفع</div><div class="detail-value">${paymentNames[order.payment?.method] || '—'}</div></div>
        ${order.payment?.depositAmount ? `<div class="detail-item"><div class="detail-label">جدية الحجز</div><div class="detail-value" style="color:var(--gold);">${order.payment.depositAmount} جنيه</div></div>` : ''}
      </div>
      ${order.payment?.receiptUrl ? `
        <div style="margin-top:12px;">
          <div class="detail-label">صورة الإيصال</div>
          <img src="${order.payment.receiptUrl}" class="payment-img" onclick="window.open('${order.payment.receiptUrl}','_blank')" alt="إيصال الدفع" />
        </div>
      ` : ''}
    </div>

    <!-- Shipping Date -->
    <div class="ship-date-wrap">
      <span class="ship-date-label">📅 تحديد يوم الشحن:</span>
      <input type="date" class="ship-date-input" id="shipDateInput" value="${shippingDate}" />
    </div>

    <!-- Action Buttons -->
    <div class="order-actions">
      <button class="btn-action btn-accept" onclick="updateOrderStatus('${order.id}', 'accepted')">
        ✅ قبول الطلب
      </button>
      <button class="btn-action btn-reject" onclick="updateOrderStatus('${order.id}', 'rejected')">
        ❌ رفض الطلب
      </button>
      <button class="btn-action btn-shipped" onclick="updateOrderStatus('${order.id}', 'shipped')">
        🚚 تم الشحن
      </button>
    </div>

    <!-- WhatsApp Notification -->
    ${order.status === 'accepted' || order.status === 'shipped' ? `
      <div style="padding:0 24px 20px;">
        <a class="btn-whatsapp" href="${buildWhatsAppLink(order)}" target="_blank">
          💬 إرسال إشعار واتساب للعميل
        </a>
      </div>
    ` : ''}
  `;
}

// ============================================================
//  UPDATE ORDER STATUS
// ============================================================
window.updateOrderStatus = async (orderId, newStatus) => {
  const shippingDate = document.getElementById('shipDateInput')?.value || null;

  try {
    if (db) {
      const { doc, updateDoc } = window._fs;
      const orderRef = doc(db, 'orders', orderId);
      const updateData = { status: newStatus };
      if (shippingDate) updateData.shippingDate = shippingDate;
      await updateDoc(orderRef, updateData);
    }

    // Update local
    const idx = allOrders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      allOrders[idx].status = newStatus;
      if (shippingDate) allOrders[idx].shippingDate = shippingDate;
      currentOrder = allOrders[idx];
    }

    const statusNames = { accepted: 'مقبول ✅', rejected: 'مرفوض ❌', shipped: 'تم الشحن 🚚' };
    showToast(`تم تحديث الطلب إلى: ${statusNames[newStatus]}`, 'success');

    renderOrderDetail(currentOrder);
    renderOrdersTable(allOrders);
    updateAdminStats(allOrders);

    // Auto open WhatsApp if accepted
    if (newStatus === 'accepted' && currentOrder) {
      const link = buildWhatsAppLink(currentOrder);
      setTimeout(() => {
        if (confirm('هل تريد إرسال إشعار واتساب للعميل الآن؟')) {
          window.open(link, '_blank');
        }
      }, 500);
    }

  } catch (err) {
    console.error(err);
    showToast('❌ حدث خطأ أثناء التحديث', 'error');
  }
};

// ============================================================
//  WHATSAPP NOTIFICATION
// ============================================================
function buildWhatsAppLink(order) {
  const shippingDate = order.shippingDate
    ? new Date(order.shippingDate).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'سيتم التحديد قريباً';

  const message = `مرحباً ${order.customer?.name || ''}،

تم قبول طلبك من ${APP_CONFIG.appName} ✅

📦 المنتج: ${order.product?.name || ''}
📍 العنوان: ${order.customer?.address || ''}
📅 يوم الشحن: ${shippingDate}

نشكر ثقتك في التعامل معنا ❤️
للاستفسار: ${APP_CONFIG.adminWhatsapp}`;

  const phone = (order.customer?.phone1 || '').replace(/^0/, '20');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// ============================================================
//  ADMIN PRODUCTS
// ============================================================
async function loadAdminProducts() {
  try {
    if (!db) { renderAdminProducts([]); return; }
    const { collection, getDocs, query, orderBy } = window._fs;
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminProducts(products);
  } catch (err) {
    console.error(err);
    renderAdminProducts([]);
  }
}

function renderAdminProducts(products) {
  const container = document.getElementById('adminProductsList');
  if (!products.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">لا توجد منتجات مضافة بعد</div></div>`;
    return;
  }

  container.innerHTML = products.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--dark-3);border-radius:var(--radius-sm);margin-bottom:10px;gap:12px;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:14px;color:var(--white);margin-bottom:2px;">${p.name}</div>
        <div style="font-size:13px;color:var(--gold);">${p.price ? `${Number(p.price).toLocaleString('ar-EG')} جنيه` : ''} ${p.unit ? `/ ${p.unit}` : ''}</div>
      </div>
      <button onclick="deleteProduct('${p.id}')" style="background:rgba(224,85,85,0.1);border:1px solid var(--red);color:var(--red);padding:6px 12px;border-radius:8px;font-family:var(--font-main);font-size:12px;cursor:pointer;flex-shrink:0;">حذف</button>
    </div>
  `).join('');
}

window.addProduct = async (event) => {
  event.preventDefault();
  const name = document.getElementById('pName').value.trim();
  const desc = document.getElementById('pDesc').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value) || 0;
  const unit = document.getElementById('pUnit').value.trim();
  const imageUrl = document.getElementById('pImage').value.trim();
  const badge = document.getElementById('pBadge').value.trim();

  if (!name) { showToast('⚠️ اسم المنتج مطلوب', 'error'); return; }

  try {
    const productData = {
      name, desc, price, unit, imageUrl, badge, emoji: '🥘',
      createdAt: db ? window._fs.serverTimestamp() : new Date().toISOString()
    };

    if (db) {
      const { collection, addDoc } = window._fs;
      await addDoc(collection(db, 'products'), productData);
    }

    showToast('✅ تم إضافة المنتج بنجاح', 'success');
    document.getElementById('addProductForm').reset();
    loadAdminProducts();
    loadProducts(); // Refresh store
  } catch (err) {
    console.error(err);
    showToast('❌ حدث خطأ أثناء إضافة المنتج', 'error');
  }
};

window.deleteProduct = async (productId) => {
  if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
  try {
    if (db) {
      const { doc, updateDoc } = window._fs;
      // Soft delete via update - or use deleteDoc
      const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await deleteDoc(doc(db, 'products', productId));
    }
    showToast('🗑️ تم حذف المنتج', 'info');
    loadAdminProducts();
    loadProducts();
  } catch (err) {
    console.error(err);
    showToast('❌ حدث خطأ أثناء الحذف', 'error');
  }
};

// ============================================================
//  TABS
// ============================================================
window.switchTab = (tab, btnEl) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btnEl.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
};

// ============================================================
//  TOAST
// ============================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================
//  KEYBOARD / ACCESSIBILITY
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeOrderModal();
    closeDetailModal();
    window.closeSuccessModal?.();
  }
});
