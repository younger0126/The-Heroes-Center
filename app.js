
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
})();
