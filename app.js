
let __thLiffReady=false;
let __thLoggedIn=false;
async function thInitOptional(){
  try{
    const cfg=window.THE_HEROES_CENTER_CONFIG||{};
    if(!window.liff||!cfg.LIFF_ID)return false;
    await liff.init({liffId:cfg.LIFF_ID});
    __thLiffReady=true;
    __thLoggedIn=liff.isLoggedIn();
    return __thLoggedIn;
  }catch(e){console.warn('LIFF optional init',e);return false}
}
async function thRequireLogin(){
  const cfg=window.THE_HEROES_CENTER_CONFIG||{};
  if(!window.liff)throw new Error('LINE LIFF SDK 尚未載入');
  if(!__thLiffReady){await liff.init({liffId:cfg.LIFF_ID});__thLiffReady=true}
  if(!liff.isLoggedIn()){liff.login({redirectUri:location.href});return false}
  __thLoggedIn=true;return true
}
function thVisitorUI(){
  const b=document.getElementById('visitorModeBanner');
  if(b)b.style.display=__thLoggedIn?'none':'flex';
  const btn=document.getElementById('visitorLoginBtn');
  if(btn)btn.onclick=()=>thRequireLogin().catch(e=>alert(e.message||e));
}
document.addEventListener('DOMContentLoaded',async()=>{await thInitOptional();thVisitorUI()});


(() => {
  const C = window.THE_HEROES_CENTER_CONFIG;
  let idToken = "";
  let profile = null;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const fmt = n => Number(n || 0).toLocaleString("zh-TW");
  const packs = [
    {id:"V1",twd:30,vouchers:1,vipPoints:30,note:"1 張代金券"},
    {id:"V5",twd:150,vouchers:5,vipPoints:150,note:"5 張代金券"},
    {id:"V10",twd:300,vouchers:10,vipPoints:300,note:"10 張代金券"},
    {id:"V20",twd:600,vouchers:20,vipPoints:600,note:"20 張代金券"},
    {id:"V50",twd:1500,vouchers:50,vipPoints:1500,note:"50 張代金券"},
    {id:"V100",twd:3000,vouchers:100,vipPoints:3000,note:"100 張代金券"}
  ];
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(window.__tt);window.__tt=setTimeout(()=>el.classList.remove("show"),2200)}
  async function api(path, options={}){
    const headers={"Content-Type":"application/json",...(options.headers||{})};
    if(idToken) headers.Authorization=`Bearer ${idToken}`;
    const r=await fetch(`${C.API_BASE}${path}`,{...options,headers});
    const d=await r.json().catch(()=>({ok:false,error:"INVALID_JSON"}));
    if(!r.ok||d.ok===false) throw new Error(`${d.message||d.error||`HTTP_${r.status}`} [${path}]`);
    return d;
  }
  async function initLine(){
    if(!C.LIFF_ID||C.LIFF_ID.includes("YOUR_")) throw new Error("尚未設定官方中心 LIFF_ID");
    await liff.init({liffId:C.LIFF_ID});
    if(!liff.isLoggedIn()){liff.login({redirectUri:location.href});return}
    idToken=liff.getIDToken()||"";
    profile=await liff.getProfile();
  }
  function renderPacks(){
    $("#rechargeGrid").innerHTML=packs.map(p=>`<article class="pack"><div class="amount">NT$ ${fmt(p.twd)}</div><div class="diamond">🎟️ ${fmt(p.vouchers)} 張代金券</div><small>${p.note}</small><button data-pack="${p.id}">建立訂單</button></article>`).join("");
    $$("#rechargeGrid [data-pack]").forEach(b=>b.addEventListener("click",()=>createOrder(b.dataset.pack)));
  }
  async function loadProfile(){
    const d=await api("/center/profile"); const p=d.player||{};
    $("#avatar").src=p.pictureUrl||profile?.pictureUrl||"";
    $("#playerName").textContent=p.displayName||profile?.displayName||"勇者";
    $("#vipBadge").textContent=`VIP ${p.vipLevel||0}`;
    $("#titleText").textContent=p.title||p.vipTitle||"勇者";
    $("#uidText").textContent=p.uid||"-"; $("#levelText").textContent=fmt(p.level||1); $("#powerText").textContent=fmt(p.power||0);
    $("#voucherText").textContent=fmt(p.vouchers||0); $("#vipPointsText").textContent=fmt(p.vipPoints||0);
  }

  function openOrderModal(p){
    return new Promise(resolve=>{
      const modal=$("#orderModal");
      const text=$("#orderModalText");
      const ok=$("#orderModalConfirm");
      const cancel=$("#orderModalCancel");
      text.innerHTML=`<div>儲值方案：<b>NT$ ${fmt(p.twd)}</b></div><div>可獲得：<b>🎟️ ${fmt(p.vouchers)} 張代金券</b></div>`;
      modal.classList.add("show");
      modal.setAttribute("aria-hidden","false");
      const close=(result)=>{
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden","true");
        ok.onclick=null;
        cancel.onclick=null;
        resolve(result);
      };
      ok.onclick=()=>close(true);
      cancel.onclick=()=>close(false);
      modal.querySelector(".game-modal-backdrop").onclick=()=>close(false);
    });
  }

  async function createOrder(id){
    if(!(await thRequireLogin())) return;
    const p=packs.find(x=>x.id===id); if(!p)return;
    if(!confirm(`建立 NT$ ${p.twd} / ${p.vouchers} 張代金券訂單？\n目前尚未串接正式金流，訂單會先建立為待付款。`))return;
    try{
      const d=await api("/center/order/create",{method:"POST",body:JSON.stringify({packageId:p.id,amountTwd:p.twd,vouchers:p.vouchers,vipPoints:p.vipPoints})});
      toast(`訂單已建立：${d.orderId||""}`);
      await loadOrders();
      switchTab("orders");
    }catch(e){
      toast(`下單失敗：${e.message}`);
      console.error("order create failed",e);
    }
  }
  async function loadOrders(){
    const el=$("#ordersList"); el.innerHTML='<div class="list-card">讀取中...</div>';
    try{
      const d=await api("/center/orders"); const arr=d.orders||[];
      el.innerHTML=arr.length?arr.map(o=>`<article class="list-card"><div class="row"><div><b>${o.packageId||"鑽石儲值"}</b><div><small>訂單 ${o.orderId||"-"}</small></div><div><small>${o.createdAt||"-"}</small></div></div><div style="text-align:right"><div>NT$ ${fmt(o.amountTwd||0)}</div><div>🎟️ ${fmt(o.vouchers||0)} 張</div><div>👑 +${fmt(o.vipPoints||0)} VIP</div><small>${o.status==="paid"?"已完成":"待付款"}</small></div></div></article>`).join(""):'<div class="list-card">目前沒有儲值紀錄。</div>';
    }catch(e){el.innerHTML=`<div class="list-card">讀取失敗：${e.message}</div>`}
  }
  async function loadNotices(){
    const el=$("#noticeList"); el.innerHTML='<div class="list-card">讀取中...</div>';
    try{
      const d=await api("/center/notices"); const arr=d.notices||[];
      el.innerHTML=arr.length?arr.map(n=>`<article class="list-card"><div class="row"><b>${n.title||"官方公告"}</b><small>${n.date||""}</small></div><p>${n.content||""}</p></article>`).join(""):'<div class="list-card">目前沒有公告。</div>';
    }catch(e){el.innerHTML=`<div class="list-card">讀取失敗：${e.message}</div>`}
  }
  async function redeem(){
    const code=$("#giftInput").value.trim(); if(!code)return toast("請輸入禮包碼");
    try{
      const d=await api("/center/redeem",{method:"POST",body:JSON.stringify({code})});
      $("#giftResult").textContent=d.message||"兌換成功";toast("禮包碼兌換成功");await loadProfile();
    }catch(e){$("#giftResult").textContent=`兌換失敗：${e.message}`}
  }
  function switchTab(name){$$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));$$(".tab-page").forEach(x=>x.classList.toggle("active",x.id===`tab-${name}`));if(name==="orders")loadOrders();if(name==="notice")loadNotices()}
  async function boot(){
    renderPacks(); $$(".tab").forEach(x=>x.addEventListener("click",()=>switchTab(x.dataset.tab))); $("#redeemBtn").addEventListener("click",redeem);
    $("#openGameBtn").addEventListener("click",()=>location.href=C.GAME_URL); $("#supportBtn").addEventListener("click",()=>toast("客服入口可再接 LINE 官方帳號聊天連結"));
    $("#refreshBtn").addEventListener("click",async()=>{try{await loadProfile();toast("資料已更新")}catch(e){toast(e.message)}});
    try{await initLine();await loadProfile()}catch(e){$("#playerName").textContent="登入失敗";toast(e.message)}finally{$("#loading").classList.add("hide")}
  }
  boot();
}
  const legalCopy={terms:{title:"服務條款",body:`<p>一、本官方中心提供遊戲帳號識別、虛擬商品購買、訂單查詢、公告及會員服務。</p><p>二、玩家應以本人合法持有之 LINE 帳號登入並妥善保管帳號。</p><p>三、代金券為遊戲內虛擬點數，不具法定貨幣性質，不可兌換現金、私下轉售或移轉。</p><p>四、付款成功並經系統確認後，虛擬商品將發放至付款時登入之帳號。</p><p>五、交易異常、重複扣款或未入帳請聯絡官方客服處理。</p>`},privacy:{title:"隱私權政策",body:`<p>一、為提供 LINE 登入、帳號識別、訂單處理及客服服務，本服務可能蒐集 LINE 使用者識別碼、顯示名稱、頭像、遊戲 UID、訂單資料及必要系統紀錄。</p><p>二、資料僅用於帳號驗證、遊戲存檔、訂單處理、客服、風險控管及服務改善。</p><p>三、付款資料由合作金流服務商處理；本網站不保存完整信用卡卡號或安全碼。</p><p>四、使用者可透過官方客服詢問個人資料相關事項。</p>`},refund:{title:"退款政策",body:`<p>一、代金券屬遊戲內虛擬商品，付款成功後依訂單內容發放至登入帳號。</p><p>二、如發生重複扣款、付款成功但未入帳或系統錯誤，請提供訂單編號聯絡客服。</p><p>三、已成功發放且已使用之代金券，原則上不接受退換、轉售或折現。</p><p>四、符合退款條件之交易依原支付方式及金流服務商可支援流程辦理；如法令另有強制規定，依法辦理。</p>`}};
  function initReviewStore(){const cfg=window.THE_HEROES_CENTER_CONFIG||{};const email=document.getElementById("reviewSupportEmail");if(email)email.textContent=cfg.SUPPORT_EMAIL||"請於送審前填入客服信箱";document.querySelectorAll("[data-legal]").forEach(btn=>btn.addEventListener("click",()=>{const copy=legalCopy[btn.dataset.legal],modal=document.getElementById("legalModal");if(!copy||!modal)return;document.getElementById("legalTitle").textContent=copy.title;document.getElementById("legalBody").innerHTML=copy.body;modal.classList.add("show");modal.setAttribute("aria-hidden","false")}));const close=()=>{const m=document.getElementById("legalModal");if(m){m.classList.remove("show");m.setAttribute("aria-hidden","true")}};document.getElementById("legalClose")?.addEventListener("click",close);document.querySelector("#legalModal .game-modal-backdrop")?.addEventListener("click",close)}
  document.addEventListener("DOMContentLoaded",initReviewStore);

})();
