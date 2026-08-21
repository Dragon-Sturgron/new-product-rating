
(function () {
  function normalizeImageUrl(url) {
    if (!url) return '';
    let value = String(url).trim();
    if (value.startsWith('http://xianglu.dragon-sturgeon.cn')) {
      value = value.replace(/^http:\/\//i, 'https://');
    }
    return value;
  }

  function openPreview(src) {
    src = normalizeImageUrl(src);
    if (!src) return;

    let mask = document.querySelector('.image-preview-mask');
    if (!mask) {
      mask = document.createElement('div');
      mask.className = 'image-preview-mask';
      mask.innerHTML = '<img class="image-preview-content" alt="图片预览">';
      document.body.appendChild(mask);

      mask.addEventListener('click', function () {
        mask.classList.remove('active');
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          mask.classList.remove('active');
        }
      });
    }

    const img = mask.querySelector('.image-preview-content');
    img.src = src;
    mask.classList.add('active');

    img.onclick = function (e) {
      e.stopPropagation();
      img.classList.toggle('zoom');
    };
  }

  window.openImagePreview = openPreview;

  document.addEventListener('click', function (e) {
    const target = e.target.closest('[data-preview-image]');
    if (!target) return;
    openPreview(target.dataset.previewImage || target.src);
  });
})();
