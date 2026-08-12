(() => {
  const C = window.THE_HEROES_CENTER_CONFIG || {};
  let idToken = "";
  let liffReady = false;
  let loggedIn = false;
  let lineProfile = null;

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

  function toast(msg){
    const el=$("#toast");
    if(!el)return;
    el.textContent=msg;
    el.classList.add("show");
    clearTimeout(window.__tt);
    window.__tt=setTimeout(()=>el.classList.remove("show"),2200);
  }

  function setLoading(on){
    const el=$("#loading");
    if(!el)return;
    el.classList.toggle("hide",!on);
  }

  function setGuestProfile(){
    if($("#playerName")) $("#playerName").textContent="訪客";
    if($("#vipBadge")) $("#vipBadge").textContent="VIP -";
    if($("#titleText")) $("#titleText").textContent="登入後顯示玩家資料";
    if($("#uidText")) $("#uidText").textContent="-";
    if($("#levelText")) $("#levelText").textContent="-";
    if($("#powerText")) $("#powerText").textContent="-";
    if($("#voucherText")) $("#voucherText").textContent="-";
    if($("#vipPointsText")) $("#vipPointsText").textContent="-";
  }

  function updateVisitorUI(){
    const banner=$("#visitorModeBanner");
    if(banner) banner.style.display=loggedIn?"none":"flex";

    const loginBtn=$("#visitorLoginBtn");
    if(loginBtn){
      loginBtn.textContent=loggedIn?"已登入 LINE":"LINE 登入購買";
      loginBtn.onclick=async()=>{
        if(loggedIn)return;
        await requireLogin();
      };
    }
  }

  async function initLiffOptional(){
    try{
      if(!window.liff || !C.LIFF_ID || C.LIFF_ID.includes("YOUR_")) return false;
      await liff.init({liffId:C.LIFF_ID});
      liffReady=true;
      loggedIn=liff.isLoggedIn();

      if(loggedIn){
        idToken=liff.getIDToken()||"";
        try{lineProfile=await liff.getProfile()}catch{}
      }

      updateVisitorUI();
      return loggedIn;
    }catch(e){
      console.warn("LIFF optional init failed",e);
      loggedIn=false;
      updateVisitorUI();
      return false;
    }
  }

  async function requireLogin(){
    if(!window.liff) {
      toast("請從 LINE 開啟或稍後再試");
      return false;
    }
    if(!liffReady){
      await liff.init({liffId:C.LIFF_ID});
      liffReady=true;
    }
    if(!liff.isLoggedIn()){
      liff.login({redirectUri:location.href});
      return false;
    }
    loggedIn=true;
    idToken=liff.getIDToken()||"";
    try{lineProfile=await liff.getProfile()}catch{}
    updateVisitorUI();
    return true;
  }

  async function api(path,options={}){
    const headers={"Content-Type":"application/json",...(options.headers||{})};
    if(idToken) headers.Authorization=`Bearer ${idToken}`;

    const r=await fetch(`${C.API_BASE}${path}`,{...options,headers});
    const d=await r.json().catch(()=>({ok:false,error:"INVALID_JSON"}));
    if(!r.ok||d.ok===false) throw new Error(`${d.message||d.error||`HTTP_${r.status}`} [${path}]`);
    return d;
  }

  function renderPacks(){
    const grid=$("#rechargeGrid");
    if(!grid)return;
    grid.innerHTML=packs.map(p=>`
      <article class="pack">
        <div class="amount">NT$ ${fmt(p.twd)}</div>
        <div class="diamond">🎟️ ${fmt(p.vouchers)} 張代金券</div>
        <small>${p.note} · +${fmt(p.vipPoints)} VIP 點數</small>
        <button data-pack="${p.id}">${loggedIn?"建立訂單":"登入後購買"}</button>
      </article>
    `).join("");

    $$("#rechargeGrid [data-pack]").forEach(b=>{
      b.addEventListener("click",()=>createOrder(b.dataset.pack));
    });
  }

  async function loadProfile(){
    if(!loggedIn || !idToken){
      setGuestProfile();
      return;
    }

    const d=await api("/center/profile");
    const p=d.player||{};

    if($("#avatar")) $("#avatar").src=p.pictureUrl||lineProfile?.pictureUrl||"";
    if($("#playerName")) $("#playerName").textContent=p.displayName||lineProfile?.displayName||"勇者";
    if($("#vipBadge")) $("#vipBadge").textContent=`VIP ${p.vipLevel||0}`;
    if($("#titleText")) $("#titleText").textContent=p.title||p.vipTitle||"勇者";
    if($("#uidText")) $("#uidText").textContent=p.uid||"-";
    if($("#levelText")) $("#levelText").textContent=fmt(p.level||1);
    if($("#powerText")) $("#powerText").textContent=fmt(p.power||0);
    if($("#voucherText")) $("#voucherText").textContent=fmt(p.vouchers||0);
    if($("#vipPointsText")) $("#vipPointsText").textContent=fmt(p.vipPoints||0);
  }

  function openOrderModal(p){
    const modal=$("#orderModal");
    if(!modal) return Promise.resolve(confirm(`建立 NT$ ${p.twd} / ${p.vouchers} 張代金券訂單？`));

    return new Promise(resolve=>{
      const text=$("#orderModalText");
      const ok=$("#orderModalConfirm");
      const cancel=$("#orderModalCancel");
      if(text) text.innerHTML=`<div>儲值方案：<b>NT$ ${fmt(p.twd)}</b></div><div>可獲得：<b>🎟️ ${fmt(p.vouchers)} 張代金券</b></div><div>VIP：<b>+${fmt(p.vipPoints)} 點</b></div>`;
      modal.classList.add("show");
      modal.setAttribute("aria-hidden","false");

      const close=result=>{
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden","true");
        if(ok)ok.onclick=null;
        if(cancel)cancel.onclick=null;
        resolve(result);
      };

      if(ok)ok.onclick=()=>close(true);
      if(cancel)cancel.onclick=()=>close(false);
      modal.querySelector(".game-modal-backdrop")?.addEventListener("click",()=>close(false),{once:true});
    });
  }

  async function createOrder(id){
    if(!(await requireLogin())) return;

    // LINE login redirect 回來後重新抓 token
    idToken=liff.getIDToken()||idToken;
    const p=packs.find(x=>x.id===id);
    if(!p)return;

    if(!(await openOrderModal(p))) return;

    try{
      const d=await api("/center/order/create",{
        method:"POST",
        body:JSON.stringify({
          packageId:p.id,
          amountTwd:p.twd,
          vouchers:p.vouchers,
          vipPoints:p.vipPoints
        })
      });
      toast(`訂單已建立：${d.orderId||""}`);
      await loadOrders();
      switchTab("orders");
    }catch(e){
      toast(`下單失敗：${e.message}`);
      console.error(e);
    }
  }

  async function loadOrders(){
    const el=$("#ordersList");
    if(!el)return;

    if(!(await requireLogin())){
      el.innerHTML='<div class="list-card">請先 LINE 登入後查看訂單。</div>';
      return;
    }

    idToken=liff.getIDToken()||idToken;
    el.innerHTML='<div class="list-card">讀取中...</div>';

    try{
      const d=await api("/center/orders");
      const arr=d.orders||[];
      el.innerHTML=arr.length?arr.map(o=>`
        <article class="list-card">
          <div class="row">
            <div>
              <b>${o.packageId||"代金券儲值"}</b>
              <div><small>訂單 ${o.orderId||"-"}</small></div>
              <div><small>${o.createdAt||"-"}</small></div>
            </div>
            <div style="text-align:right">
              <div>NT$ ${fmt(o.amountTwd||0)}</div>
              <div>🎟️ ${fmt(o.vouchers||0)} 張</div>
              <div>👑 +${fmt(o.vipPoints||0)} VIP</div>
              <small>${["paid","paid_test"].includes(o.status)?"已完成":"待付款"}</small>
            </div>
          </div>
        </article>
      `).join(""):'<div class="list-card">目前沒有儲值紀錄。</div>';
    }catch(e){
      el.innerHTML=`<div class="list-card">讀取失敗：${e.message}</div>`;
    }
  }

  async function loadNotices(){
    const el=$("#noticeList");
    if(!el)return;

    // Worker v2.0 的公告 API 目前需要 LINE token。
    // 訪客模式不強制登入，因此未登入時仍讓整個網站正常開啟。
    if(!loggedIn){
      el.innerHTML='<div class="list-card">登入 LINE 後可查看最新遊戲公告。</div>';
      return;
    }

    try{
      const d=await api("/center/notices");
      const arr=d.notices||[];
      el.innerHTML=arr.length?arr.map(n=>`
        <article class="list-card">
          <div class="row"><b>${n.title||"官方公告"}</b><small>${n.date||""}</small></div>
          <p>${n.content||""}</p>
        </article>
      `).join(""):'<div class="list-card">目前沒有公告。</div>';
    }catch(e){
      el.innerHTML=`<div class="list-card">讀取失敗：${e.message}</div>`;
    }
  }

  async function redeem(){
    if(!(await requireLogin())) return;
    idToken=liff.getIDToken()||idToken;

    const code=$("#giftInput")?.value.trim()||"";
    if(!code)return toast("請輸入禮包碼");

    try{
      const d=await api("/center/redeem",{method:"POST",body:JSON.stringify({code})});
      if($("#giftResult")) $("#giftResult").textContent=d.message||"兌換成功";
      toast("禮包碼兌換成功");
      await loadProfile();
    }catch(e){
      if($("#giftResult")) $("#giftResult").textContent=`兌換失敗：${e.message}`;
    }
  }

  function switchTab(name){
    $$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
    $$(".tab-page").forEach(x=>x.classList.toggle("active",x.id===`tab-${name}`));
    if(name==="orders") loadOrders();
    if(name==="notice") loadNotices();
  }

  const legalCopy={
    terms:{
      title:"服務條款",
      body:`<p>一、本官方中心提供遊戲帳號識別、虛擬商品購買、訂單查詢、公告及會員服務。</p><p>二、玩家應以本人合法持有之 LINE 帳號登入並妥善保管帳號。</p><p>三、代金券為遊戲內虛擬點數，不具法定貨幣性質，不可兌換現金、私下轉售或移轉。</p><p>四、付款成功並經系統確認後，虛擬商品將發放至付款時登入之帳號。</p><p>五、交易異常、重複扣款或未入帳請聯絡官方客服處理。</p>`
    },
    privacy:{
      title:"隱私權政策",
      body:`<p>一、為提供 LINE 登入、帳號識別、訂單處理及客服服務，本服務可能蒐集 LINE 使用者識別碼、顯示名稱、頭像、遊戲 UID、訂單資料及必要系統紀錄。</p><p>二、資料僅用於帳號驗證、遊戲存檔、訂單處理、客服、風險控管及服務改善。</p><p>三、付款資料由合作金流服務商處理；本網站不保存完整信用卡卡號或安全碼。</p><p>四、使用者可透過官方客服詢問個人資料相關事項。</p>`
    },
    refund:{
      title:"退款政策",
      body:`<p>一、代金券屬遊戲內虛擬商品，付款成功後依訂單內容發放至登入帳號。</p><p>二、如發生重複扣款、付款成功但未入帳或系統錯誤，請提供訂單編號聯絡客服。</p><p>三、已成功發放且已使用之代金券，原則上不接受退換、轉售或折現。</p><p>四、符合退款條件之交易依原支付方式及金流服務商可支援流程辦理；如法令另有強制規定，依法辦理。</p>`
    }
  };

  function initLegal(){
    const email=$("#reviewSupportEmail");
    if(email) email.textContent=C.SUPPORT_EMAIL||"請於送審前填入客服信箱";

    $$("[data-legal]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const copy=legalCopy[btn.dataset.legal];
        const modal=$("#legalModal");
        if(!copy||!modal)return;
        $("#legalTitle").textContent=copy.title;
        $("#legalBody").innerHTML=copy.body;
        modal.classList.add("show");
        modal.setAttribute("aria-hidden","false");
      });
    });

    const close=()=>{
      const modal=$("#legalModal");
      if(!modal)return;
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden","true");
    };
    $("#legalClose")?.addEventListener("click",close);
    $("#legalModal .game-modal-backdrop")?.addEventListener("click",close);
  }

  async function boot(){
    setLoading(true);
    renderPacks();
    initLegal();

    $$(".tab").forEach(x=>x.addEventListener("click",()=>switchTab(x.dataset.tab)));
    $("#redeemBtn")?.addEventListener("click",redeem);
    $("#openGameBtn")?.addEventListener("click",()=>location.href=C.GAME_URL);
    $("#supportBtn")?.addEventListener("click",()=>toast("客服入口可再接 LINE 官方帳號聊天連結"));
    $("#refreshBtn")?.addEventListener("click",async()=>{
      try{
        if(!loggedIn){toast("目前為訪客模式");return}
        await loadProfile();
        toast("資料已更新");
      }catch(e){toast(e.message)}
    });

    try{
      await initLiffOptional();

      if(loggedIn){
        await loadProfile();
      }else{
        setGuestProfile();
      }
    }catch(e){
      console.error("boot error",e);
      setGuestProfile();
      toast("已進入訪客模式");
    }finally{
      renderPacks();
      setLoading(false);
    }
  }

  boot();
})();
