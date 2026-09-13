const root = document.getElementById('modalRoot');

export function openModal(innerHTML, onMount) {
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal">${innerHTML}</div></div>`;
  const overlay = root.querySelector('#modalOverlay');
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', escHandler);
  if (onMount) onMount(root.querySelector('.modal'));
}

function escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  root.innerHTML = '';
  document.removeEventListener('keydown', escHandler);
}
