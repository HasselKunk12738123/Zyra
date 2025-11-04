(function(){
/*
    cart.js
    --------
    Maneja el carrito del cliente: almacenamiento en localStorage, renderizado del panel,
    añadir/quitar artículos, modificación de cantidad y el flujo de pago.

    Claves principales en localStorage/sessionStorage:
    - zyra_cart_v1                   : carrito por defecto (invitado)
    - zyra_cart_<userId>_v1          : carrito asociado a un usuario autenticado
    - zyra_orders_v1                 : órdenes almacenadas
    - zyra_user (SESSION_KEY)       : sesión/usuario actual (en localStorage o sessionStorage)

    Estructura de un item en el carrito:
        { id, title, price, img, desc, qty }

    Nota: Los comentarios en español explican cada bloque y función para facilitar
    la lectura y mantenimiento.
*/
    
    const BASE_GUEST_KEY = 'zyra_cart_v1';
    const SESSION_KEY = 'zyra_user';

    // Pequeños helpers para seleccionar elementos en el DOM
    // qs: querySelector, qsa: querySelectorAll -> array
    function qs(sel, ctx=document){ return ctx.querySelector(sel); }
    function qsa(sel, ctx=document){ return Array.from((ctx||document).querySelectorAll(sel)); }

    // Crea el panel lateral del carrito (si no existe).
    // El panel contiene los items, el total y los botones de acciones (Vaciar, Pagar).
    function createCartPanel(){
        if (document.getElementById('zyraCartPanel')) return;
        const panel = document.createElement('aside');
        panel.id = 'zyraCartPanel';
        panel.className = 'cart-panel';
        panel.innerHTML = `
            <div class="cart-header">
                <h3>Tu carrito <span id="zyraCartCount" class="cart-badge">0</span></h3>
            </div>
            <div class="cart-items" id="zyraCartItems"></div>
            <div class="cart-footer">
                <div class="cart-total"><span>Total</span><span id="zyraCartTotal">$0.00</span></div>
                <div class="cart-actions">
                    <button id="zyraClearCart" class="zyra-btn ghost">Vaciar</button>
                    <button id="zyraCheckout" class="zyra-btn">Pagar</button>
                </div>
            </div>
        `;
        
        if (!document.getElementById('zyraCartOverlay')){
            const overlay = document.createElement('div');
            overlay.id = 'zyraCartOverlay';
            overlay.className = 'zyra-cart-overlay';
            // clicking the overlay closes the cart
            overlay.addEventListener('click', closeCart);
            document.body.appendChild(overlay);
        }

        document.body.appendChild(panel);
    qs('#zyraClearCart', panel).addEventListener('click', function(){ showClearConfirm(); });
        qs('#zyraCheckout', panel).addEventListener('click', function(){
            // abrir formulario de pago en modal
            showCheckoutModal();
        });
    }

    // Obtiene la sesión/usuario actual (si existe). Devuelve null si no hay sesión válida.
    function getSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || 'null'); }catch(e){return null;} }

    // Determina la clave donde se guarda el carrito (depende si hay usuario autenticado).
    function getCartKey(){
        const s = getSession();
        if (s && s.id) return `zyra_cart_${s.id}_v1`;
        return BASE_GUEST_KEY;
    }

    // Carga el carrito desde localStorage usando la clave apropiada.
    // Si no existe devuelve un arreglo vacío.
    function loadCart(){
        try{
            const key = getCartKey();
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            return JSON.parse(raw);
        } catch(e){ console.error('Error leyendo carrito', e); return []; }
    }
    // Guarda el carrito en localStorage en la clave correspondiente.
    function saveCart(items){
        try{ const key = getCartKey(); localStorage.setItem(key, JSON.stringify(items)); } catch(e){ console.error('Error guardando carrito', e); }
    }

    function formatPrice(text){
        
        if (!text) return 0;
        const cleaned = String(text).replace(/[^0-9.,-]/g,'').replace(',','.');
        const n = parseFloat(cleaned);
        return isNaN(n)?0:n;
    }

    // Elimina tildes y diacríticos de una cadena para evitar advertencias
    // al rellenar campos de prueba (normaliza a forma básica ASCII cuando es posible).
    function removeDiacritics(s){
        try{ return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,''); }catch(e){ return String(s||''); }
    }

    // Calcula el total numérico del carrito a partir de cada precio y cantidad.
    function getTotal(items){
        return items.reduce((s,i)=> s + (formatPrice(i.price)||0) * (i.qty||1), 0);
    }
    function getTotalString(){
        const total = getTotal(loadCart());
        return '$' + total.toFixed(2);
    }

    // Renderiza el panel del carrito: lista de items, contador y total.
    // También adjunta los eventos de incremento/decremento y quitar.
    function renderCart(){
        createCartPanel();
        const items = loadCart();
        const container = document.getElementById('zyraCartItems');
        const count = items.reduce((s,i)=> s + (i.qty||1), 0);
        document.getElementById('zyraCartCount').textContent = count;
        document.getElementById('zyraCartTotal').textContent = '$' + getTotal(items).toFixed(2);
        container.innerHTML = '';
        if (!items.length){
            container.innerHTML = '<div style="color:var(--muted);padding:1rem;text-align:center;">El carrito está vacío.</div>';
            return;
        }
        items.forEach(item => {
            const node = document.createElement('div');
            node.className = 'cart-item';
            node.innerHTML = `
                <img src="${item.img||'img/placeholder.png'}" alt="${escapeHtml(item.title)}">
                <div class="meta">
                    <h4>${escapeHtml(item.title)}</h4>
                    <p>${escapeHtml(item.price || '')}</p>
                    <div class="qty">
                        <button class="qty-dec" data-id="${item.id}">-</button>
                        <span class="qty-num" data-id="${item.id}">${item.qty}</span>
                        <button class="qty-inc" data-id="${item.id}">+</button>
                        <button class="zyra-btn ghost" style="margin-left:8px;" data-remove="${item.id}">Quitar</button>
                    </div>
                </div>
            `;
            container.appendChild(node);
        });

        // attach events
        qsa('.qty-inc').forEach(b=> b.addEventListener('click', function(){ changeQty(this.dataset.id, 1); }));
        qsa('.qty-dec').forEach(b=> b.addEventListener('click', function(){ changeQty(this.dataset.id, -1); }));
        qsa('[data-remove]').forEach(b=> b.addEventListener('click', function(){ removeItem(this.getAttribute('data-remove')); }));
    }

    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; }); }

    // Añade un item al carrito; si ya existe incrementa la cantidad.
    // Luego guarda y abre el panel para que el usuario vea el cambio.
    function addItem(newItem){
        const items = loadCart();
        const idx = items.findIndex(i=> i.id === newItem.id);
        if (idx >=0){ items[idx].qty = (items[idx].qty||1) + (newItem.qty||1); }
        else items.push(Object.assign({}, newItem));
        saveCart(items);
        renderCart();
        openCart();
    }

    // Elimina un item por id del carrito y actualiza almacenamiento y render.
    function removeItem(id){
        let items = loadCart();
        items = items.filter(i=> i.id !== id);
        saveCart(items);
        renderCart();
    }

    // Modifica la cantidad de un artículo en el carrito (delta puede ser +1 o -1).
    // Si la cantidad llega a 0 lo elimina.
    function changeQty(id, delta){
        const items = loadCart();
        const idx = items.findIndex(i=> i.id === id);
        if (idx < 0) return;
        items[idx].qty = Math.max(0, (items[idx].qty||1) + delta);
        if (items[idx].qty === 0) items.splice(idx,1);
        saveCart(items);
        renderCart();
    }

    // Vacía completamente el carrito.
    function clearCart(){ saveCart([]); renderCart(); }

    // Muestra un modal de confirmación antes de vaciar el carrito.
    function showClearConfirm(){
        // don't create multiple
        if (document.getElementById('zyraClearConfirmOverlay')) return;
        const overlay = document.createElement('div');
    overlay.id = 'zyraClearConfirmOverlay';
    overlay.className = 'zyra-modal-overlay active confirmation';

        const modal = document.createElement('div');
    modal.className = 'zyra-modal confirmation';
        modal.id = 'zyraClearConfirmModal';
        modal.innerHTML = `
            <div class="modal-body">
                <h3>Vaciar carrito?</h3>
                <p style="color:var(--muted);">¿Estás seguro que deseas vaciar el carrito?</p>
                <div class="modal-actions">
                    <button id="zyraConfirmClear" class="zyra-btn">Aceptar</button>
                    <button id="zyraCancelClear" class="zyra-btn ghost">Cancelar</button>
                </div>
            </div>
        `;

        
        overlay.addEventListener('click', removeConfirm);
        // stop clicks inside modal from closing
        modal.addEventListener('click', function(e){ e.stopPropagation(); });

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        
        const btnConfirm = document.getElementById('zyraConfirmClear');
        const btnCancel = document.getElementById('zyraCancelClear');
        if (btnCancel) btnCancel.focus();

        function removeConfirm(){
            const o = document.getElementById('zyraClearConfirmOverlay');
            const m = document.getElementById('zyraClearConfirmModal');
            if (o) o.parentNode.removeChild(o);
            if (m) m.parentNode.removeChild(m);
        }

        if (btnConfirm) btnConfirm.addEventListener('click', function(){
            clearCart();
            removeConfirm();
        });
        if (btnCancel) btnCancel.addEventListener('click', function(){ removeConfirm(); });

        
        function onKey(e){ if (e.key === 'Escape'){ removeConfirm(); window.removeEventListener('keydown', onKey); } }
        window.addEventListener('keydown', onKey);
    }

    // Muestra el modal de checkout (formulario de pago).
    // Cuando se envía el formulario se valida y se simula el procesamiento del pago,
    // luego se crea una orden y se guarda en localStorage en 'zyra_orders_v1'.
    function showCheckoutModal(){
        if (document.getElementById('zyraCheckoutOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'zyraCheckoutOverlay';
        overlay.className = 'zyra-modal-overlay active confirmation';

        const modal = document.createElement('div');
        modal.className = 'zyra-modal confirmation';
        modal.id = 'zyraCheckoutModal';
        modal.innerHTML = `
            <div class="modal-body">
                <h3>Formulario de pago</h3>
                <form id="zyraCheckoutForm">
                    <label>Nombre completo</label>
                    <input id="chkName" type="text" required style="width:100%;padding:8px;margin:6px 0;border-radius:6px;border:1px solid rgba(0,0,0,0.08);">

                    <label>Email</label>
                    <input id="chkEmail" type="email" required style="width:100%;padding:8px;margin:6px 0;border-radius:6px;border:1px solid rgba(0,0,0,0.08);">

                    <label>Dirección de envío</label>
                    <input id="chkAddress" type="text" required style="width:100%;padding:8px;margin:6px 0;border-radius:6px;border:1px solid rgba(0,0,0,0.08);">

                    <label>Teléfono</label>
                    <input id="chkPhone" type="tel" style="width:100%;padding:8px;margin:6px 0;border-radius:6px;border:1px solid rgba(0,0,0,0.08);">

                    <label>Notas / Instrucciones</label>
                    <textarea id="chkNotes" rows="3" style="width:100%;padding:8px;margin:6px 0;border-radius:6px;border:1px solid rgba(0,0,0,0.08);"></textarea>

                        <div style="margin-top:0.6rem;display:flex;gap:8px;align-items:center;"><button type="button" id="zyraFillRandom" class="zyra-btn ghost">Rellenar datos de prueba</button></div>

                        <label>Número de tarjeta</label>
                        <input id="chkCardNumber" type="text" inputmode="numeric" placeholder="4242 4242 4242 4242" required style="width:100%;padding:8px;margin:6px 0;border-radius:6px;border:1px solid rgba(0,0,0,0.08);">

                        <div style="display:flex;gap:8px;">
                            <div style="flex:1;">
                                <label>Expiración (MM/AA)</label>
                                <input id="chkCardExpiry" type="text" placeholder="12/30" required style="width:100%;padding:8px;margin:6px 0;border-radius:6px;border:1px solid rgba(0,0,0,0.08);">
                            </div>
                            <div style="width:120px;">
                                <label>CVC</label>
                                <input id="chkCardCvc" type="text" inputmode="numeric" placeholder="123" required style="width:100%;padding:8px;margin:6px 0;border-radius:6px;border:1px solid rgba(0,0,0,0.08);">
                            </div>
                        </div>

                        <div style="margin-top:0.8rem;display:flex;gap:8px;align-items:center;">
                            <button type="submit" class="zyra-btn">Pagar</button>
                            <button type="button" id="zyraCancelCheckout" class="zyra-btn ghost">Cancelar</button>
                        </div>
                </form>
                <div id="zyraCheckoutMsg" style="margin-top:10px;color:var(--muted);"></div>
            </div>
        `;

        overlay.addEventListener('click', remove);
        modal.addEventListener('click', function(e){ e.stopPropagation(); });
        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        
        try{
            let skipPrefill = false;
            try{ if (sessionStorage.getItem('zyra_clear_checkout_next')){ sessionStorage.removeItem('zyra_clear_checkout_next'); skipPrefill = true; } }catch(e){}
            if (!skipPrefill){
                const s = getSession();
                if (s){ if (s.name) document.getElementById('chkName').value = s.name; if (s.email) document.getElementById('chkEmail').value = s.email; }
            } else {
                // ensure fields are empty
                try{
                    ['chkName','chkEmail','chkAddress','chkPhone','chkNotes','chkCardNumber','chkCardExpiry','chkCardCvc'].forEach(id=>{ const el=document.getElementById(id); if (el) el.value = ''; });
                }catch(e){}
            }
        }catch(e){ /* ignore */ }

    const form = document.getElementById('zyraCheckoutForm');
    const btnCancel = document.getElementById('zyraCancelCheckout');
    const msg = document.getElementById('zyraCheckoutMsg');

        function remove(){ const o=document.getElementById('zyraCheckoutOverlay'); const m=document.getElementById('zyraCheckoutModal'); if(o) o.remove(); if(m) m.remove(); }

        btnCancel.addEventListener('click', function(){ remove(); });

        
        const btnFill = document.getElementById('zyraFillRandom');
        if (btnFill){
            btnFill.addEventListener('click', function(){
                try{
                    const names = ['Ana López','Carlos Ruiz','María Pérez','Juan García','Lucía Martínez'];
                    const streets = ['Av. Central 123','Calle Nueva 45','Boulevard Sol 89','Calle Las Flores 12','Pasaje Verde 7'];
                    const rndName = names[Math.floor(Math.random()*names.length)];
                    const rndAddress = streets[Math.floor(Math.random()*streets.length)];
                    // eliminar tildes/diacríticos antes de rellenar para evitar advertencias
                    const cleanName = removeDiacritics(rndName);
                    const cleanAddress = removeDiacritics(rndAddress);
                    const rndEmail = cleanName.toLowerCase().replace(/\s+/g,'.') + Math.floor(Math.random()*900+100) + '@ejemplo.com';
                    const rndPhone = '5' + Math.floor(10000000 + Math.random()*89999999);

                    const elName = document.getElementById('chkName');
                    const elEmail = document.getElementById('chkEmail');
                    const elAddress = document.getElementById('chkAddress');
                    const elPhone = document.getElementById('chkPhone');
                    const elCard = document.getElementById('chkCardNumber');
                    const elExp = document.getElementById('chkCardExpiry');
                    const elCvc = document.getElementById('chkCardCvc');

                    if (elName) elName.value = cleanName;
                    if (elEmail) elEmail.value = rndEmail;
                    if (elAddress) elAddress.value = cleanAddress;
                    if (elPhone) elPhone.value = rndPhone;
                    if (elCard) elCard.value = '4242 4242 4242 4242';
                    if (elExp) elExp.value = '12/30';
                    if (elCvc) elCvc.value = '123';
                    if (msg) { msg.textContent = 'Campos rellenados con datos de prueba.'; setTimeout(()=> msg.textContent = '', 1500); }
                }catch(e){ console.error(e); }
            });
        }

        form.addEventListener('submit', function(e){
            e.preventDefault();
            msg.textContent = '';
            const name = document.getElementById('chkName').value.trim();
            const email = document.getElementById('chkEmail').value.trim().toLowerCase();
            const address = document.getElementById('chkAddress').value.trim();
            const phone = document.getElementById('chkPhone').value.trim();
            const notes = document.getElementById('chkNotes').value.trim();

            if (!name){ msg.textContent = 'Ingresa tu nombre.'; return; }
            if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg.textContent = 'Email inválido.'; return; }
            if (!address){ msg.textContent = 'Ingresa la dirección de envío.'; return; }

            const items = loadCart();
            if (!items || items.length === 0){ msg.textContent = 'El carrito está vacío.'; return; }

            // validate card basic
            const cardnum = document.getElementById('chkCardNumber').value.replace(/\s+/g,'');
            const cardexp = document.getElementById('chkCardExpiry').value.trim();
            const cardcvc = document.getElementById('chkCardCvc').value.trim();
            if (!/^[0-9]{12,19}$/.test(cardnum)) { msg.textContent = 'Número de tarjeta inválido.'; return; }
            if (!/^[0-9]{3,4}$/.test(cardcvc)) { msg.textContent = 'CVC inválido.'; return; }
            if (!/^(0[1-9]|1[0-2])\/(\d{2})$/.test(cardexp)) { msg.textContent = 'Expiración inválida (MM/AA).'; return; }

            msg.style.color='lightgreen';
            msg.textContent = 'Procesando pago...';

            // simulate processing delay
            setTimeout(function(){
                // build order with payment info masked
                const last4 = cardnum.slice(-4);
                const order = {
                    id: 'order_' + Date.now(),
                    userId: (getSession() && getSession().id) || null,
                    customer: { name, email, address, phone, notes },
                    payment: { method: 'card', masked: '**** **** **** ' + last4, brand: 'VISA', last4: last4 },
                    items: items,
                    total: getTotal(items),
                    createdAt: new Date().toISOString()
                };

                try{
                    const ordersKey = 'zyra_orders_v1';
                    const existing = JSON.parse(localStorage.getItem(ordersKey) || '[]');
                    existing.push(order);
                    localStorage.setItem(ordersKey, JSON.stringify(existing));
                    // Además de guardar en la lista principal, guardamos una copia
                    // rápida en sessionStorage para cubrir casos donde el navegador
                    // sirve archivos locales (file://) y el alcance de localStorage
                    // puede variar por ruta. La copia en sessionStorage permite que
                    // la página `checkout.html` recupere la orden inmediatamente
                    // después de la redirección en la misma pestaña.
                    try{ sessionStorage.setItem('zyra_last_order', JSON.stringify(order)); }catch(e){}
                    // Guardar también una copia temporal bajo otra clave por si
                    // sessionStorage no está disponible; esto es un último recurso.
                    try{ localStorage.setItem('zyra_orders_last_tmp', JSON.stringify(order)); }catch(e){}
                }catch(err){ console.error('Error guardando orden', err); }

                // vaciar carrito (guardará usando la clave del usuario si está autenticado)
                clearCart();
                // close modal and redirect to checkout page with order id
                remove();
                try{ sessionStorage.setItem('zyra_clear_checkout_next','1'); }catch(e){}
                // When site is opened locally (file://) and user is inside a subfolder
                // like /categorias/, a relative 'checkout.html' will resolve to that
                // subfolder (which doesn't exist). Detect that case and navigate
                // to the parent path when needed so the root checkout.html is used.
                try{
                    const encoded = encodeURIComponent(order.id);
                    // Construir la URL de checkout teniendo en cuenta páginas dentro de 'categorias/'.
                    // Si estamos en una página de categorías, el checkout real está una carpeta arriba
                    // (../checkout.html). En caso contrario usamos checkout.html en la misma carpeta.
                    let href = (window.location && window.location.href) ? window.location.href.split('#')[0].split('?')[0] : '';
                    href = href.replace(/\\/g,'/');
                    const pathname = (window.location && window.location.pathname) ? window.location.pathname.replace(/\\/g,'/') : '';
                    const lowerPath = pathname.toLowerCase();

                    const baseCurrent = href.replace(/\/[^/]*$/, '/');
                    let target;
                    if (lowerPath.indexOf('/categorias/') !== -1){
                        target = baseCurrent + '../checkout.html?order=' + encoded;
                    } else {
                        target = baseCurrent + 'checkout.html?order=' + encoded;
                    }

                    window.location.href = target;
                }catch(e){
                    // last resort
                    window.location.href = 'checkout.html?order=' + encodeURIComponent(order.id);
                }
            }, 900);
        });

        
        function onKey(e){ if (e.key === 'Escape'){ remove(); window.removeEventListener('keydown', onKey); } }
        window.addEventListener('keydown', onKey);
    }

    function openCart(){    
        createCartPanel();
        const panel = document.getElementById('zyraCartPanel');
        panel.classList.add('open');
        const overlay = document.getElementById('zyraCartOverlay');
        if (overlay) overlay.classList.add('active');
    }
    function closeCart(){ 
        const panel = document.getElementById('zyraCartPanel'); 
        if(panel) panel.classList.remove('open'); 
        const overlay = document.getElementById('zyraCartOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    
    window.addToCart = function(item){
        // item: {id, title, price, img, desc, qty}
        if (!item || !item.id) return;
        // Normalize price to string like $12.99 if given as number
        if (typeof item.price === 'number') item.price = '$' + item.price.toFixed(2);
        if (!item.qty) item.qty = 1;
        addItem(item);
    };
    window.openCart = openCart;
    window.closeCart = closeCart;
    window.clearCart = clearCart;
    // Exponer lectura directa del carrito (útil para checkout page)
    window.getZyraCartItems = function(){ return loadCart(); };

    function ensureCartToggle(){
        if (!shouldShowFloatingCart()) return; // don't inject nav/cart on registration pages
        const navUser = document.querySelector('.navbar-user');
        if (!navUser) return;
        // find existing carrito anchor
        const cartLink = Array.from(navUser.querySelectorAll('a')).find(a=> a.textContent && a.textContent.includes('🛒'));
        if (cartLink){
            // convert to button that opens cart
            const span = document.createElement('button');
            span.innerHTML = '🛒';
            span.className = 'zyra-cart-toggle';
            span.style.background='transparent'; span.style.border='none'; span.style.color='var(--white)'; span.style.fontSize='1.2rem'; span.style.cursor='pointer';
            span.addEventListener('click', function(e){ e.preventDefault(); openCart(); });
            cartLink.parentNode.replaceChild(span, cartLink);

            // add badge next to it
            const badge = document.createElement('span'); badge.id = 'zyraNavCartBadge'; badge.className='cart-badge'; badge.style.marginLeft='8px';
            span.insertAdjacentElement('afterend', badge);
        } else {
            // if not found, append a toggle
            const btn = document.createElement('button'); btn.innerHTML='🛒 <span id="zyraNavCartBadge" class="cart-badge">0</span>';
            btn.className='zyra-cart-toggle'; btn.style.background='transparent'; btn.style.border='none'; btn.style.color='var(--white)'; btn.style.cursor='pointer';
            btn.addEventListener('click', function(e){ e.preventDefault(); openCart(); });
            navUser.appendChild(btn);
        }
    }

    function shouldShowFloatingCart(){
        const path = window.location.pathname.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        // don't show on registration pages or anchors
        if (path.includes('registro') || path.includes('register') || hash.includes('registro') || hash.includes('register')) return false;
        return true;
    }

    function createFloatingCartButton(){
        if (!shouldShowFloatingCart()) return;
        if (document.getElementById('zyraFloatingCartBtn')) return;
        const btn = document.createElement('button');
        btn.id = 'zyraFloatingCartBtn';
        btn.className = 'zyra-floating-cart-button';
        btn.innerHTML = `🛒 <span id="zyraFloatCartBadge" class="cart-badge">0</span>`;
        btn.setAttribute('aria-label','Abrir carrito');
        btn.addEventListener('click', function(e){ e.preventDefault(); openCart(); });
        document.body.appendChild(btn);
    }

    function updateFloatingBadge(){
        const el = document.getElementById('zyraFloatCartBadge');
        if (!el) return;
        const items = loadCart();
        const count = items.reduce((s,i)=> s + (i.qty||1), 0);
        el.textContent = count;
    }

    function updateNavBadge(){
        const badge = document.getElementById('zyraNavCartBadge');
        if (!badge) return;
        const items = loadCart();
        const count = items.reduce((s,i)=> s + (i.qty||1), 0);
        badge.textContent = count;
    }

    document.addEventListener('DOMContentLoaded', function(){
        createCartPanel();
        ensureCartToggle();
        createFloatingCartButton();
        renderCart();
        // ensure badges reflect current cart on initial load
        updateNavBadge();
        updateFloatingBadge();
        // expose render to allow manual refresh
        window.renderZyraCart = renderCart;
        // monitor storage changes from other tabs
        window.addEventListener('storage', function(e){
            // If session changed (login/logout), try to migrate guest cart into user cart and re-render
            if (e.key === SESSION_KEY){
                // merge guest cart into account cart if needed
                try{ migrateGuestToUserIfNeeded(); }catch(err){console.error(err);} 
                renderCart();
                return;
            }
            // any cart key update should re-render
            if (e.key && e.key.startsWith('zyra_cart_')){
                renderCart();
            }
        });
        // on page load, if session exists and guest cart has items, migrate them
        try{ migrateGuestToUserIfNeeded(); }catch(err){console.error(err);} 
    });

    // keep nav badge and floating badge in sync after renders
    const origRenderCart = renderCart;
    renderCart = function(){
        // re-run original render logic then update badges
        origRenderCart();
        updateNavBadge();
        updateFloatingBadge();
    };

    // Merge guest cart into the logged-in user's cart (called after login)
    function migrateGuestToUserIfNeeded(){
        const session = getSession();
        if (!session || !session.id) return; // no user logged in
        try{
            const guestRaw = localStorage.getItem(BASE_GUEST_KEY);
            if (!guestRaw) return; // nothing to migrate
            const guestItems = JSON.parse(guestRaw || '[]');
            if (!Array.isArray(guestItems) || guestItems.length === 0) return;

            const userKey = `zyra_cart_${session.id}_v1`;
            const userRaw = localStorage.getItem(userKey);
            const userItems = userRaw ? JSON.parse(userRaw) : [];

            // merge by id, summing quantities
            const map = new Map();
            userItems.concat(guestItems).forEach(it => {
                if (!it || !it.id) return;
                const existing = map.get(it.id) || Object.assign({}, it, {qty:0});
                existing.qty = (existing.qty||0) + (it.qty||1);
                map.set(it.id, existing);
            });
            const merged = Array.from(map.values());
            localStorage.setItem(userKey, JSON.stringify(merged));
            // remove guest cart after migrating
            localStorage.removeItem(BASE_GUEST_KEY);
        }catch(e){ console.error('Error migrando carrito de guest a user', e); }
    }

})();
