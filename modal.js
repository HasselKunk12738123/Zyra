/*
  modal.js
  --------
  Gestión del modal de producto: crea un overlay modal reutilizable en la
  página que muestra los detalles de cualquier elemento con la clase `.producto`.

  Comportamiento principal:
  - Al cargar el DOM crea (una sola vez) un overlay con estructura de modal.
  - `openProductModal(productEl)`: rellena el modal con la info del producto y
     abre el overlay.
  - El modal incluye botón para agregar al carrito que delega a `window.addToCart`.
  - Se usa delegación de eventos en `document.body` para abrir el modal cuando
    el usuario hace click en un elemento con `.producto`.
*/
document.addEventListener('DOMContentLoaded', function() {
    // Si no existe el overlay lo creamos y lo añadimos al body
    if (!document.getElementById('zyraModalOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'zyraModalOverlay';
        overlay.className = 'zyra-modal-overlay';
        // Estructura del modal con elementos accesibles por id
        overlay.innerHTML = `
            <div class="zyra-modal" role="dialog" aria-modal="true" aria-labelledby="zyraModalTitle">
                <button class="zyra-modal-close" aria-label="Cerrar">×</button>
                <div class="modal-image"><img src="" alt="Imagen del producto" id="zyraModalImg"></div>
                <div class="modal-body">
                    <h3 id="zyraModalTitle">Título del producto</h3>
                    <p id="zyraModalDesc">Descripción breve del producto.</p>
                    <span class="modal-price" id="zyraModalPrice">$0.00</span>
                    <div class="modal-actions">
                        <button class="zyra-btn" id="zyraAddCart">Agregar al carrito</button>
                        <button class="zyra-btn ghost" id="zyraCloseBtn">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

    function closeModal() {
            // cierra el modal quitando la clase 'active'
            overlay.classList.remove('active');
        }
        // botones para cerrar
        overlay.querySelector('.zyra-modal-close').addEventListener('click', closeModal);
        overlay.querySelector('#zyraCloseBtn').addEventListener('click', closeModal);
        // clic fuera del modal cierra (overlay mismo)
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeModal();
        });
        // Escape también cierra
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeModal();
        });
    }

    // Rellena y abre el modal con la información del elemento .producto pasado
    function openProductModal(productEl) {
        const overlay = document.getElementById('zyraModalOverlay');
        const img = productEl.querySelector('img');
        const titleEl = productEl.querySelector('h3');
        const descEl = productEl.querySelector('p');
        const priceEl = productEl.querySelector('.precio');

        const modalImg = document.getElementById('zyraModalImg');
        const modalTitle = document.getElementById('zyraModalTitle');
        const modalDesc = document.getElementById('zyraModalDesc');
        const modalPrice = document.getElementById('zyraModalPrice');

        // Copiamos datos del DOM del producto al modal
        if (img && img.src) modalImg.src = img.src;
        modalImg.alt = titleEl ? titleEl.textContent : 'Producto';
        modalTitle.textContent = titleEl ? titleEl.textContent : 'Producto';
        modalDesc.textContent = descEl ? descEl.textContent : '';
        modalPrice.textContent = priceEl ? priceEl.textContent : '';

        overlay.classList.add('active');

        // Botón 'Agregar al carrito' construye un objeto item y lo pasa a window.addToCart
        const addBtn = document.getElementById('zyraAddCart');
        addBtn.onclick = function() {
            const item = {
                id: encodeURIComponent((titleEl ? titleEl.textContent : 'producto') + '|' + (img && img.src ? img.src : '')),
                title: titleEl ? titleEl.textContent : 'Producto',
                price: priceEl ? priceEl.textContent : '',
                img: img && img.src ? img.src : '',
                desc: descEl ? descEl.textContent : '' ,
                qty: 1
            };

            // Delegación a la API pública global addToCart si existe
            if (window.addToCart && typeof window.addToCart === 'function') {
                try {
                    window.addToCart(item);
                } catch (e) {
                    console.error('Error añadiendo al carrito:', e);
                    alert('Añadido al carrito: ' + item.title);
                }
            } else {
                // Fallback si no existe la función global
                alert('Añadido al carrito: ' + (titleEl ? titleEl.textContent : 'Producto'));
            }

            // cerramos el modal después de añadir
            overlay.classList.remove('active');
        };
    }

    // Delegación de eventos: cualquier click dentro del body que encuentre
    // un ancestro con clase .producto abrirá el modal con esa info.
    document.body.addEventListener('click', function(e) {
        const prod = e.target.closest('.producto');
        if (prod) {
            openProductModal(prod);
        }
    });
});
