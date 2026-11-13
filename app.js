/* Shared shell for every signed-in page: login guard, header, bottom nav, toast, animations */
const LOGO="https://lh3.googleusercontent.com/aida/ALJJyrCWIwZYu8WsSg2yh970qxCgY89l0fG4WovWgx3NjH2mjv4uH5ygEd_8WwHk05Kp1XRnqquPv4coh3HrfSUARI0dwaR2yAYzEGO53MVqAm_FjurmWTzNXA52qHO-Xb4SZYHJrf9EahJILCdjMQl6CBwIFV-TDxpUJpI-ffWdIj2CeDT5c63RQG71HaxYjctHdmQ2wGgqvqg-JF1aD7u7pVwaul1z_rqMHcliFJ1F-JMdMQ";
(function(){const s=document.createElement('style');s.textContent=`
html,body{margin:0;min-height:100%}body{min-height:100dvh}::-webkit-scrollbar{display:none}
.pt-safe{padding-top:env(safe-area-inset-top,0)}.pb-safe{padding-bottom:env(safe-area-inset-bottom,0)}
.rise{opacity:0;transform:translateY(16px);animation:rise .55s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(var(--i,0)*70ms)}
@keyframes rise{to{opacity:1;transform:none}}
.shimmer{background:linear-gradient(90deg,#eaedff 25%,#f6f7ff 50%,#eaedff 75%);background-size:200% 100%;animation:sh 1.2s linear infinite}
@keyframes sh{to{background-position:-200% 0}}
.press{transition:transform .15s}.press:active{transform:scale(.96)}
.shake{animation:shake .4s}@keyframes shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.ck-ring{stroke-dasharray:166;stroke-dashoffset:166;animation:draw .7s ease forwards}
.ck-tick{stroke-dasharray:48;stroke-dashoffset:48;animation:draw .4s .55s ease forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.pop{animation:pop .5s cubic-bezier(.3,1.6,.5,1) both}@keyframes pop{from{opacity:0;transform:scale(.5)}}
.pulse-ring{animation:ring 1.8s ease-out infinite}@keyframes ring{0%{box-shadow:0 0 0 0 rgba(0,82,255,.35)}100%{box-shadow:0 0 0 18px rgba(0,82,255,0)}}
.wave{display:inline-block;transform-origin:70% 70%;animation:wave 1.8s ease-in-out .6s 2}
@keyframes wave{0%,60%,100%{transform:none}10%,30%{transform:rotate(16deg)}20%,40%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}
.sheet{animation:sup .32s cubic-bezier(.2,.8,.2,1)}@keyframes sup{from{transform:translateY(100%)}}
.fade{animation:fade .25s ease}@keyframes fade{from{opacity:0}}
.bar{transition:width 1s cubic-bezier(.2,.8,.2,1)}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;animation-delay:0s!important;transition-duration:.01ms!important}}
`;document.head.appendChild(s)})();

const App={
  user:null,profile:null,
  reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
  esc:s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  money:n=>'₦'+Number(n||0).toLocaleString('en-NG'),
  initials(n){return (n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()},
  toast(msg,ok=true){
    let t=document.getElementById('app-toast');
    if(!t){t=document.createElement('div');t.id='app-toast';t.className='fixed left-1/2 top-20 z-[90] -translate-x-1/2 -translate-y-3 max-w-[90vw] px-5 py-3 rounded-full bg-inverse-surface text-inverse-on-surface shadow-xl font-label-md text-label-md flex items-center gap-2 transition-all duration-300 opacity-0 pointer-events-none';document.body.appendChild(t)}
    t.innerHTML='<span class="material-symbols-outlined text-[20px] '+(ok?'text-secondary-fixed':'text-error-container')+'">'+(ok?'task_alt':'error')+'</span><span>'+this.esc(msg)+'</span>';
    t.classList.remove('opacity-0','-translate-y-3');clearTimeout(t._h);
    t._h=setTimeout(()=>t.classList.add('opacity-0','-translate-y-3'),3200);
  },
  count(el,to,fmt,ms=900){
    fmt=fmt||(v=>Math.round(v));
    if(this.reduced||!to){el.textContent=fmt(to);return}
    let t0=null;const step=t=>{t0=t0||t;const p=Math.min((t-t0)/ms,1);el.textContent=fmt(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step);
  },
  tick(color){return '<svg viewBox="0 0 56 56" class="w-24 h-24 pop" fill="none"><circle class="ck-ring" cx="28" cy="28" r="26" stroke="'+(color||'#006c47')+'" stroke-width="3" stroke-linecap="round"/><path class="ck-tick" d="M16 29l8 8 16-17" stroke="'+(color||'#006c47')+'" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'},
  async init({title,active}){
    const hold=()=>new Promise(()=>{});
    const {data:{session}}=await sb.auth.getSession();
    if(!session){location.replace('login.html');return hold()}
    const u=session.user;this.user=u;this.session=session;
    if(bio.enabledFor(u.id)&&sessionStorage.getItem('frantech_unlocked')!=='1'){location.replace('login.html');return hold()}
    const {data:p}=await sb.from('profiles').select('full_name,phone,email,kyc_status,kyc_type,kyc_last4,kyc_note').eq('id',u.id).maybeSingle();
    const md=u.user_metadata||{};
    this.profile=Object.assign({full_name:md.full_name||'Member',phone:md.phone||'',email:u.email,kyc_status:'none'},p||{});
    const name=this.profile.full_name;
    // header
    const h=document.getElementById('hdr');
    h.className='fixed top-0 w-full z-40 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]';
    h.innerHTML='<div class="h-16 px-margin flex items-center justify-between"><div class="flex items-center gap-space-sm"><img alt="Frantech" class="h-8 w-auto object-contain" src="'+LOGO+'"/><div class="flex flex-col"><span class="font-headline-sm text-headline-sm text-on-surface leading-tight">'+this.esc(title)+'</span><span class="font-label-sm text-label-sm text-on-surface-variant leading-none">Frantech Cooperative</span></div></div><div class="flex items-center gap-space-sm"><button id="bell" aria-label="Notifications" class="w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary press"><span class="material-symbols-outlined text-[24px]">notifications</span></button><a href="profile.html" aria-label="Profile" class="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-lg text-label-lg press">'+this.esc(this.initials(name))+'</a></div></div>';
    document.getElementById('bell').onclick=()=>this.toast('You have no new notifications.');
    // bottom nav
    const verified=this.profile.kyc_status==='verified';
    const it=(k,href,ic,lb)=>'<a href="'+href+'" data-k="'+k+'" class="press flex flex-col items-center justify-center w-12 h-12 rounded-full transition-colors '+(active===k?'text-primary font-label-md':'text-on-surface-variant hover:text-primary')+'"><span class="material-symbols-outlined text-[24px]"'+(active===k?' style="font-variation-settings:\'FILL\' 1"':'')+'>'+ic+'</span><span class="font-label-sm text-label-sm mt-0.5">'+lb+'</span></a>';
    const n=document.getElementById('nav');
    n.className='fixed bottom-0 w-full z-40 pb-safe pointer-events-none';
    n.innerHTML='<div class="max-w-md mx-auto px-margin pb-space-sm pointer-events-auto"><div class="h-16 rounded-full bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_10px_25px_-4px_rgba(0,82,255,0.18)] flex items-center justify-around px-space-sm">'+it('home','dashboard.html','home','Home')+it('groups','groups.html','group','Groups')+'<div class="relative flex items-center justify-center"><a href="'+(verified?'groups.html':'kyc.html')+'" aria-label="'+(verified?'Groups':'Verify identity')+'" class="-top-5 absolute w-14 h-14 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-[0_10px_25px_-4px_rgba(0,82,255,0.4)] hover:bg-primary press '+(verified?'':'pulse-ring')+'"><span class="material-symbols-outlined text-[30px]">'+(verified?'add':'verified_user')+'</span></a></div>'+it('wallet','#','account_balance_wallet','Wallet')+it('profile','profile.html','person','Profile')+'</div></div>';
    n.querySelector('[data-k="wallet"]').onclick=e=>{e.preventDefault();this.toast('Wallet opens once payments are connected.')};
    document.body.classList.remove('invisible');
    return {user:u,profile:this.profile,session};
  }
};
