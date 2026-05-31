(function(){
  var el = document.getElementById('md'); if(!el) return;
  var parse = (window.marked && marked.parse) ? marked.parse : window.marked;
  var content = document.getElementById('content');
  content.innerHTML = parse(el.textContent);

  content.querySelectorAll('blockquote').forEach(function(bq){
    var h3 = bq.querySelector('h3');
    if(h3 && /DRILL/i.test(h3.textContent)){ bq.className='drill'; return; }
    var txt = bq.textContent.trim();
    if(/\bin the (other )?margin\b/i.test(txt) || /^(BERT|ERNE|CHIP)\b/.test(txt) ||
       /,\s*(from|mid)[- ]?\w*,?\s*(the )?margin/i.test(txt) || /^(BERT|ERNE)[, ]/.test(txt)){
      bq.className='foxnote';
      bq.classList.add(/\bBERT\b/i.test(txt.slice(0,46)) ? 'bert' : 'erne');
      return;
    }
    bq.className='aside';
    if(txt.length < 300 && !bq.querySelector('ul,ol')) bq.classList.add('float');
  });

  content.querySelectorAll('h2').forEach(function(h){
    var m = h.textContent.match(/^(Chapter\s+\d+)\s*[—:-]\s*(.+)$/i);
    if(m){ h.innerHTML = '<span class="ch hand">'+m[1]+'</span>'+m[2]; }
    var n = h.nextElementSibling;
    while(n && n.tagName!=='P'){ if(n.tagName==='H2'){n=null;break;} n=n.nextElementSibling; }
    if(n) n.classList.add('lead');
  });

  Array.prototype.forEach.call(content.querySelectorAll('img'), function(img){
    var fig=document.createElement('figure'); fig.className='comic';
    var cap=document.createElement('figcaption'); cap.textContent=img.getAttribute('alt')||'';
    var host=(img.parentElement && img.parentElement.tagName==='P' &&
              img.parentElement.childNodes.length===1) ? img.parentElement : img;
    host.parentNode.insertBefore(fig, host);
    fig.appendChild(img); fig.appendChild(cap);
    if(host!==img && host.parentNode) host.parentNode.removeChild(host);
    img.onerror=function(){ fig.classList.add('missing'); };
  });
})();
