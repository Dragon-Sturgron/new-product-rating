
(function(){
  function fixUrl(url){
    return String(url||'').replace(/^http:\/\/xianglu\.dragon-sturgeon\.cn/i,'https://xianglu.dragon-sturgeon.cn');
  }

  function init(){
    if(document.querySelector('.product-image-viewer-mask')) return;

    const mask=document.createElement('div');
    mask.className='product-image-viewer-mask';
    mask.innerHTML='<div class="product-image-viewer-box"><img class="product-image-viewer-img"></div>';
    document.body.appendChild(mask);

    const img=mask.querySelector('img');

    document.addEventListener('click',function(e){
      const target=e.target.closest('[data-preview-image]');
      if(!target) return;
      e.preventDefault();

      img.src=fixUrl(target.dataset.previewImage || target.src);
      mask.classList.add('show');
      document.documentElement.style.overflow='hidden';
      document.body.style.overflow='hidden';
      img.classList.remove('zoom');
    });

    mask.addEventListener('click',function(e){
      if(e.target===mask){
        mask.classList.remove('show');
        document.documentElement.style.overflow='';
        document.body.style.overflow='';
      }
    });

    img.addEventListener('click',function(e){
      e.stopPropagation();
      img.classList.toggle('zoom');
    });

    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'){
        mask.classList.remove('show');
        document.documentElement.style.overflow='';
        document.body.style.overflow='';
      }
    });
  }

  init();
})();
