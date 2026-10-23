/* game-page.js: what the game start pages do beyond a plain form.

   The page works without this file: the form is a GET to game.html and Play
   starts the game on its defaults. This adds the Multiple Choice switch, the
   read-aloud button, settings carried in the page's own address
   (wordlink.au/clock?q=20 opens with 20 questions), and Copy link. */
(function(){
  var form=document.getElementById('gp-form');
  if(!form) return;
  var q=document.getElementById('gp-q'), t=document.getElementById('gp-t');
  var mcBtn=document.getElementById('gp-mc'), mcVal=document.getElementById('gp-mc-val');
  var lang=document.getElementById('gp-lang');

  function store(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function read(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }

  function setMc(on){
    if(!mcBtn) return;
    mcBtn.classList.toggle('on',on);
    mcBtn.setAttribute('aria-pressed',on?'true':'false');
    mcVal.value=on?'1':'0';
  }
  if(mcBtn) mcBtn.addEventListener('click',function(){ setMc(mcVal.value!=='1'); });

  // A link can carry the settings, the same ones a link out of the app does.
  var p=new URLSearchParams(location.search);
  var pq=parseInt(p.get('q'),10), pt=parseInt(p.get('t'),10);
  if(q&&pq>=1&&pq<=50) q.value=pq;
  if(t&&pt>=10&&pt<=120) t.value=pt;
  if(mcBtn&&(p.get('mc')==='1'||p.get('mc')==='0')) setMc(p.get('mc')==='1');
  if(lang){
    var have=read('translateLang');
    if(have&&lang.querySelector('option[value="'+have+'"]')) lang.value=have;
    else lang.value='vi';
    lang.addEventListener('change',function(){ store('translateLang',lang.value); });
  }

  /* Only what differs from the defaults goes in an address, so the everyday
     link stays the short one. */
  function changed(){
    var out=new URLSearchParams();
    if(q&&String(parseInt(q.value,10))!==q.dataset.default) out.set('q',q.value);
    if(t&&String(parseInt(t.value,10))!==t.dataset.default) out.set('t',t.value);
    if(mcBtn&&mcVal.value!==mcVal.dataset.default) out.set('mc',mcVal.value);
    return out.toString();
  }

  form.addEventListener('submit',function(e){
    if(lang) store('translateLang',lang.value);
    // Leave out the boxes a learner left empty or cleared, rather than sending
    // q= and letting the game read nothing as a number.
    [q,t].forEach(function(el){ if(el&&!(parseInt(el.value,10)>0)) el.disabled=true; });
    if(mcBtn&&mcVal.value===mcVal.dataset.default) mcVal.disabled=true;
    setTimeout(function(){ [q,t,mcVal].forEach(function(el){ if(el) el.disabled=false; }); },0);
  });

  // Read the learner's line aloud, for a learner who cannot read it yet.
  var say=document.querySelector('.gp-say');
  if(say){
    if(!('speechSynthesis' in window)) say.hidden=true;
    say.addEventListener('click',function(){
      try{
        speechSynthesis.cancel();
        var u=new SpeechSynthesisUtterance(say.dataset.say);
        u.lang='en-AU'; u.rate=.9;
        speechSynthesis.speak(u);
      }catch(e){}
    });
  }

  var copy=document.getElementById('gp-copy');
  if(copy&&(navigator.clipboard||document.queryCommandSupported)){
    copy.hidden=false;
    copy.addEventListener('click',function(){
      var s=changed();
      var url=location.origin+location.pathname.replace(/\.html$/,'')+(s?'?'+s:'');
      function done(){ copy.textContent='✅ Link copied'; setTimeout(function(){ copy.textContent='🔗 Copy link'; },2000); }
      if(navigator.clipboard&&window.isSecureContext){
        navigator.clipboard.writeText(url).then(done,function(){ fallback(url); done(); });
      } else { fallback(url); done(); }
    });
  }
  function fallback(text){
    var ta=document.createElement('textarea');
    ta.value=text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); }catch(e){}
    document.body.removeChild(ta);
  }
})();
