/* game-page.js: what the game start pages do beyond a plain form.

   The page works without this file: the form is a GET to game.html and Play
   starts the game on its defaults. This adds the Multiple Choice switch, the
   read-aloud button, settings carried in the page's own address
   (wordlink.au/clock?q=20 opens with 20 questions), Copy link, and the
   game itself, run in this page so that one tap on Play is enough. */
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

  /* ── The game, in this page ──
     Safari plays no sound on a page until that page has been tapped, and a tap
     on one page does not carry to the next. So Play cannot simply go to
     game.html: the first question would be silent, and the app has to show its
     own start screen to get a tap of its own, which is Play a second time on
     what looks like the same page reloading.
     Instead the app is brought into this page while the learner reads it:
     game.html is fetched, its screens are put in a hidden holder and its
     scripts are run, and nothing else happens until Play. Then Play starts the
     game right here, inside the tap. If the app is not ready yet (a slow
     connection, an old browser), Play is the plain form it always was and
     goes to game.html. */
  var app=null, appStyle=null, holder=null;
  function runScript(old){
    return new Promise(function(done){
      var el=document.createElement('script');
      var src=old.getAttribute('src');
      if(src){ el.src=src; el.onload=done; el.onerror=done; }
      else el.textContent=old.textContent;
      document.body.appendChild(el);
      if(!src) done();
    });
  }
  function loadApp(){
    if(app||!window.fetch||!window.DOMParser||!window.Promise) return;
    app=fetch('game.html',{credentials:'same-origin'}).then(function(r){
      if(!r.ok) throw new Error('game.html '+r.status);
      return r.text();
    }).then(function(text){
      var doc=new DOMParser().parseFromString(text,'text/html');
      appStyle=document.createElement('style');
      appStyle.textContent=[].map.call(doc.querySelectorAll('head style'),function(st){ return st.textContent; }).join('\n');
      holder=document.createElement('div');
      holder.id='gp-app'; holder.hidden=true;
      var scripts=[], firebase=[];
      [].slice.call(doc.body.childNodes).forEach(function(n){
        if(n.nodeName!=='SCRIPT') holder.appendChild(document.importNode(n,true));
        else if(/firebasejs/.test(n.getAttribute('src')||'')) firebase.push(n);
        else scripts.push(n);
      });
      // No screen is showing until Play. The app starts music for whichever
      // screen is up on the first tap anywhere, and that tap may be on this page.
      [].forEach.call(holder.querySelectorAll('.screen.active'),function(sc){ sc.classList.remove('active'); });
      document.body.appendChild(holder);
      window.WORDLINK_EMBEDDED=true;
      return scripts.reduce(function(p,sc){ return p.then(function(){ return runScript(sc); }); },Promise.resolve())
        .then(function(){
          if(typeof window.bootApp!=='function') throw new Error('app did not start');
          // Only class games need these, so they come last and nothing waits.
          firebase.reduce(function(p,sc){ return p.then(function(){ return runScript(sc); }); },Promise.resolve());
          return true;
        });
    }).catch(function(){ return false; });
    app.then(function(ok){ app.ready=ok; });
  }
  if(document.readyState==='complete') setTimeout(loadApp,300);
  else window.addEventListener('load',function(){ setTimeout(loadApp,300); });

  function playHere(){
    var p=new URLSearchParams();
    [].forEach.call(form.elements,function(el){
      if(!el.name||el.disabled) return;
      if((el===q||el===t)&&!(parseInt(el.value,10)>0)) return;
      p.set(el.name,el.value);
    });
    // The app brings its own look; this page's would only get in its way.
    [].forEach.call(document.querySelectorAll('link[href="game-page.css"]'),function(l){ l.disabled=true; });
    document.head.appendChild(appStyle);
    [].forEach.call(document.querySelectorAll('body > .gp-bar, body > main, body > .gp-foot'),function(el){ el.hidden=true; });
    holder.hidden=false;
    window.scrollTo(0,0);
    // Back from the game comes back to this card rather than leaving the site.
    try{ history.pushState({gp:'game'},''); }catch(e){}
    window.addEventListener('popstate',function(){ location.reload(); });
    window.bootApp(p,{tapped:true});
  }

  form.addEventListener('submit',function(e){
    if(lang) store('translateLang',lang.value);
    if(app&&app.ready&&!form.dataset.noembed){
      e.preventDefault();
      try{ playHere(); return; }
      catch(err){
        // Whatever went wrong, the learner still gets their game.
        form.dataset.noembed='1';
        location.href='game.html?'+new URLSearchParams(new FormData(form)).toString();
        return;
      }
    }
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
