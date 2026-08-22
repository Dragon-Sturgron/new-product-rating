
(function(){
  function fixUrl(url){
    return String(url || '').replace(
      /^http:\/\/xianglu\.dragon-sturgeon\.cn/i,
      'https://xianglu.dragon-sturgeon.cn'
    );
  }

  function init(){
    if(document.querySelector('.product-image-viewer-mask')) return;

    const mask=document.createElement('div');
    mask.className='product-image-viewer-mask';
    mask.innerHTML='<div class="product-image-viewer-box"><img class="product-image-viewer-img"></div>';
    document.body.appendChild(mask);

    const img=mask.querySelector('.product-image-viewer-img');

    function closeViewer(){
      mask.classList.remove('show');
      img.classList.remove('zoom');
      img.removeAttribute('src');
      document.documentElement.style.overflow='';
      document.body.style.overflow='';
    }

    document.addEventListener('click',function(e){
      const target=e.target.closest('[data-preview-image]');
      if(!target) return;

      e.preventDefault();

      img.src=fixUrl(target.dataset.previewImage || target.src);

      // 打开大图
      mask.classList.add('show');

      // 禁止背景滚动
      document.documentElement.style.overflow='hidden';
      document.body.style.overflow='hidden';
    });

    // 点击黑色背景关闭
    mask.addEventListener('click',function(e){
      if(e.target===mask){
        closeViewer();
      }
    });

    // 点击大图：回到缩略图状态
    img.addEventListener('click',function(e){
      e.stopPropagation();
      closeViewer();
    });

    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'){
        closeViewer();
      }
    });
  }

  init();
})();
