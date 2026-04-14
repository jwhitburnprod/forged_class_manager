// ── FIREBASE CONFIG ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAaq7ww822sBHaEG8J39KxWD-AzkGdj6Og",
  authDomain: "forged-grappling.firebaseapp.com",
  projectId: "forged-grappling",
  storageBucket: "forged-grappling.firebasestorage.app",
  messagingSenderId: "107502360615",
  appId: "1:107502360615:web:d0b78a7d05b74fda709602",
  measurementId: "G-HK68N7YPLH"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const LIBRARY_DOC = db.collection("fg_app").doc("library");

// ── APP ───────────────────────────────────────────────────────────────────────
const THEMES=[{id:"standing",label:"Standing"},{id:"legs",label:"Legs"},{id:"guard",label:"Guard"},{id:"passing",label:"Passing"},{id:"pins",label:"Pins"}];

let state={tab:"plan",theme:null,session:{drills:[],techniques:[],positionals:[]},sessionNotes:"",libFilter:{theme:null,type:null},libSearch:"",library:[],loading:true,user:undefined,showForm:false,editId:null,form:{name:"",note:"",type:"drill",theme:"standing",roles:"symmetric",goal:"",attackerGoal:"",defenderGoal:"",videoUrl:""}};

function signIn(){auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e=>console.error("Sign-in error:",e));}
function signOut(){auth.signOut();}

// Firestore: real-time listener — updates all devices automatically
function init(){
  auth.onAuthStateChanged(user=>{state.user=user;render();});
  LIBRARY_DOC.onSnapshot(
    doc=>{
      state.library=doc.exists?(doc.data().items||[]):[];
      state.loading=false;render();
    },
    err=>{
      console.error("Firestore error:",err);
      state.loading=false;render();
    }
  );
}

// Firestore: save the whole library array as a single document field
function saveLib(){if(!state.user)return;LIBRARY_DOC.set({items:state.library}).catch(e=>console.error("Save error:",e));}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function setTheme(id){const next=state.theme===id?null:id;state.theme=next;state.session=next?{drills:[null,null],techniques:[null,null],positionals:[null,null]}:{drills:[],techniques:[],positionals:[]};state.sessionNotes="";render();}
function setSessionNotes(v){state.sessionNotes=v;const el=document.getElementById('session-notes-print');if(el)el.textContent=v;}
function resetSession(){state.session={drills:[null,null],techniques:[null,null],positionals:[null,null]};state.sessionNotes="";render();}
function setTab(t){state.tab=t;render();}
function setLibFilter(k,v){state.libFilter[k]=state.libFilter[k]===v?null:v;render();}
function showAddForm(overrides={}){
  const defTheme=state.libFilter.theme||"standing";
  state.form={name:"",note:"",type:state.libFilter.type||"drill",theme:defTheme,roles:"symmetric",goal:"",attackerGoal:"",defenderGoal:"",videoUrl:"",...overrides};
  state.editId=null;state.showForm=true;render();setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),50);
}
function editItem(id){
  const item=state.library.find(i=>i.id===id);if(!item)return;
  state.form={name:item.name,note:item.note||"",type:item.type,theme:item.theme,roles:item.roles||"symmetric",goal:item.goal||"",attackerGoal:item.attackerGoal||"",defenderGoal:item.defenderGoal||"",videoUrl:item.videoUrl||""};
  state.editId=id;state.showForm=true;render();setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),50);
}
function deleteItem(id){state.library=state.library.filter(i=>i.id!==id);saveLib();render();}
function cancelForm(){state.showForm=false;state.editId=null;render();}
function setFormField(k,v){state.form[k]=v;if(k!=="name"&&k!=="note"&&k!=="goal"&&k!=="attackerGoal"&&k!=="defenderGoal"&&k!=="videoUrl")render();}
function setLibSearch(v){state.libSearch=v;render();const el=document.getElementById("lib-search");if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}}
function saveForm(){
  if(!state.form.name.trim())return;
  const isDrill=state.form.type==="drill";
  const item={name:state.form.name.trim(),type:state.form.type,theme:state.form.theme,note:isDrill?"":state.form.note.trim(),videoUrl:state.form.videoUrl.trim()};
  if(isDrill){item.roles=state.form.roles;item.goal=state.form.roles==="symmetric"?state.form.goal.trim():"";item.attackerGoal=state.form.roles==="asymmetric"?state.form.attackerGoal.trim():"";item.defenderGoal=state.form.roles==="asymmetric"?state.form.defenderGoal.trim():"";}
  if(state.editId){
    state.library=state.library.map(i=>i.id===state.editId?{...i,...item}:i);
  }else{
    state.library.push({id:uid(),...item});
  }
  saveLib();state.showForm=false;state.editId=null;render();
}

function formatLastUsed(dateStr){
  if(!dateStr)return"";
  const days=Math.floor((Date.now()-new Date(dateStr).getTime())/(1000*60*60*24));
  if(days===0)return"Last used: today";
  if(days===1)return"Last used: yesterday";
  if(days<7)return`Last used: ${days} days ago`;
  if(days<14)return"Last used: 1 week ago";
  return`Last used: ${Math.floor(days/7)} weeks ago`;
}

function logSession(){
  if(!state.user||!state.theme)return;
  const now=new Date().toISOString();
  const ids=new Set([...state.session.drills,...state.session.techniques,...state.session.positionals].filter(Boolean));
  state.library=state.library.map(i=>ids.has(i.id)?{...i,lastUsed:now}:i);
  saveLib();render();
}

function buildSession(){
  if(!state.theme)return;
  const shuffle=arr=>[...arr].sort(()=>Math.random()-0.5);
  const pick=(type,n)=>{const ids=shuffle(state.library.filter(i=>i.theme===state.theme&&i.type===type)).slice(0,n).map(i=>i.id);while(ids.length<n)ids.push(null);return ids;};
  state.session={drills:pick("drill",2),techniques:pick("technique",2),positionals:pick("positional",2)};
  render();
}

function setSessionItem(type,index,id){state.session[type][index]=id||null;render();}
function addSessionSlot(type){state.session[type].push(null);render();}
function removeSessionSlot(type,index){state.session[type].splice(index,1);render();}

function renderPlan(){
  const themeLabel=state.theme?THEMES.find(t=>t.id===state.theme).label:null;
  const typeLabel={drills:"drill",techniques:"technique",positionals:"positional"};
  function slotOpts(type){
    if(type==="drills"){
      return state.library.filter(i=>i.type==="drill"&&(i.theme===state.theme||i.theme==="standing"));
    }
    return state.library.filter(i=>i.theme===state.theme&&i.type===typeLabel[type]);
  }
  function itemDetail(type,item){
    if(!item)return"";
    const video=item.videoUrl?`<a href="${item.videoUrl}" target="_blank" rel="noopener" style="font-size:11px;color:#639922;margin-top:3px;display:inline-block">▶ Watch</a>`:"";
    if(type==="drills"){const goal=item.roles==="asymmetric"?`<div style="font-size:11px;margin-top:3px"><span style="color:#639922">Attacker:</span> ${item.attackerGoal||"—"} &nbsp;·&nbsp; <span style="color:#639922">Defender:</span> ${item.defenderGoal||"—"}</div>`:(item.goal?`<div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px">Goal: ${item.goal}</div>`:"");return`<div class="drill custom" style="margin-top:4px">${item.name}${goal}${video}</div>`;}
    if(type==="techniques"){return`<div class="tech-row" style="margin-top:4px"><span>${item.name}${item.note?`<div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px">${item.note}</div>`:""}${item.lastUsed?`<div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px">${formatLastUsed(item.lastUsed)}</div>`:""}${video}</span></div>`;}
    if(type==="positionals"){return`<div class="pos-box custom" style="border-left:2px solid #3B6D11;border-radius:0;margin-top:4px">${item.name?`<div style="font-weight:500;margin-bottom:${item.note?"4px":"0"}">${item.name}</div>`:""}${item.note?`<div style="font-size:12px">${item.note}</div>`:""}${video}</div>`;}
    return"";
  }
  function slot(type,index){
    const id=state.session[type][index];
    const item=id?state.library.find(i=>i.id===id):null;
    const opts=slotOpts(type);
    const label=type==="positionals"?"sparring":typeLabel[type];
    return`<div style="margin-bottom:8px">
      <div style="display:flex;gap:6px;align-items:center" class="no-print">
        <select class="form-select" style="flex:1" onchange="setSessionItem('${type}',${index},this.value)">
          <option value="">— choose ${label} —</option>
          ${opts.map(i=>`<option value="${i.id}"${i.id===id?" selected":""}>${i.name}</option>`).join("")}
        </select>
        <button class="icon-btn" style="flex-shrink:0" onclick="removeSessionSlot('${type}',${index})">×</button>
      </div>
      ${itemDetail(type,item)}
    </div>`;
  }
  return`
    <div style="margin-bottom:1.5rem">
      <p style="font-size:13px;color:var(--color-text-secondary);margin:0 0 8px">Today's theme</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${THEMES.map(t=>`<button class="theme-btn${state.theme===t.id?" on":""}" onclick="setTheme('${t.id}')">${t.label}</button>`).join("")}
      </div>
    </div>
    ${state.theme?`
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <p style="font-size:13px;color:var(--color-text-secondary);margin:0">Session builder</p>
          <div style="display:flex;gap:6px">
            <button class="print-btn no-print" onclick="resetSession()">Reset</button>
            <button class="print-btn no-print" onclick="buildSession()">Auto-build</button>
            ${state.user?`<button class="print-btn no-print" onclick="logSession()">Log session</button>`:""}
            <button class="print-btn" onclick="window.print()">Print</button>
          </div>
        </div>
        <div class="print-header" style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #ccc">
          <div style="font-size:14pt;font-weight:700">Forged Grappling</div>
          <div style="font-size:10pt;color:#555">${new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
        <div style="background:#EAF3DE;border-radius:var(--border-radius-lg);padding:12px 16px;margin-bottom:8px;border:0.5px solid #C0DD97">
          <div style="font-size:16px;font-weight:500;color:#27500A">${themeLabel}</div>
          <div style="font-size:12px;color:#3B6D11;margin-top:2px">60 minutes</div>
        </div>
        <div class="seg">
          <div class="seg-hd"><div style="display:flex;align-items:center"><span class="seg-num">01</span><span class="seg-title">Dynamic drills</span></div><span class="seg-time">15–20 min</span></div>
          ${state.session.drills.map((_,i)=>slot("drills",i)).join("")}
          <button class="add-btn no-print" style="margin-top:4px" onclick="addSessionSlot('drills')">+ Add drill</button>
        </div>
        <div class="seg">
          <div class="seg-hd"><div style="display:flex;align-items:center"><span class="seg-num">02</span><span class="seg-title">Technique</span></div><span class="seg-time">15–20 min</span></div>
          ${state.session.techniques.map((_,i)=>slot("techniques",i)).join("")}
          <button class="add-btn no-print" style="margin-top:4px" onclick="addSessionSlot('techniques')">+ Add technique</button>
        </div>
        <div class="seg">
          <div class="seg-hd"><div style="display:flex;align-items:center"><span class="seg-num">03</span><span class="seg-title">Sparring</span></div><span class="seg-time">15–20 min</span></div>
          ${state.session.positionals.map((_,i)=>slot("positionals",i)).join("")}
          <button class="add-btn no-print" style="margin-top:4px" onclick="addSessionSlot('positionals')">+ Add sparring</button>
        </div>
        <div class="seg">
          <div class="seg-hd"><div style="display:flex;align-items:center"><span class="seg-num">04</span><span class="seg-title">Close-out</span></div><span class="seg-time">5 min</span></div>
          <textarea class="form-textarea no-print" oninput="setSessionNotes(this.value)" placeholder="e.g. Promotions, upcoming events, reminders…">${state.sessionNotes}</textarea>
          <div id="session-notes-print" class="print-only" style="font-size:12pt;white-space:pre-wrap;padding:8px 0">${state.sessionNotes}</div>
        </div>
      </div>
    `:`<div style="text-align:center;padding:40px 20px;color:var(--color-text-secondary);font-size:13px">Select a theme above to build today's session</div>`}
  `;
}

function renderLibrary(){
  const q=state.libSearch.trim().toLowerCase();
  const filtered=state.library.filter(i=>{
    if(state.libFilter.theme&&i.theme!==state.libFilter.theme)return false;
    if(state.libFilter.type&&i.type!==state.libFilter.type)return false;
    if(q&&!i.name.toLowerCase().includes(q)&&!(i.note||"").toLowerCase().includes(q)&&!(i.goal||"").toLowerCase().includes(q)&&!(i.attackerGoal||"").toLowerCase().includes(q)&&!(i.defenderGoal||"").toLowerCase().includes(q))return false;
    return true;
  });
  const positionalWarn=false;
  const formHtml=state.showForm?`
    <div class="form-card">
      <p style="font-size:14px;font-weight:500;color:var(--color-text-primary);margin:0 0 14px">${state.editId?"Edit item":"Add to library"}</p>
      <div class="form-row">
        <label class="form-label">Type</label>
        <div class="type-toggle">
          <button class="type-opt${state.form.type==="drill"?" on":""}" onclick="setFormField('type','drill')">Drill</button>
          <button class="type-opt${state.form.type==="technique"?" on":""}" onclick="setFormField('type','technique')">Technique</button>
          <button class="type-opt${state.form.type==="positional"?" on":""}" onclick="setFormField('type','positional')">Sparring</button>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Theme</label>
        <select class="form-select" onchange="setFormField('theme',this.value)">
          ${THEMES.map(t=>`<option value="${t.id}"${state.form.theme===t.id?" selected":""}>${t.label}</option>`).join("")}
        </select>
      </div>
      ${positionalWarn?`<div class="warn-box">A positional already exists for ${THEMES.find(t=>t.id===state.form.theme)?.label} — saving will replace it.</div>`:""}
      <div class="form-row">
        <label class="form-label">Name</label>
        <input class="form-input" type="text" value="${state.form.name.replace(/"/g,"&quot;")}" oninput="setFormField('name',this.value)" placeholder="${state.form.type==="drill"?"e.g. Single leg finish game":state.form.type==="technique"?"e.g. Penetration step mechanics":"e.g. Closed guard — mount attack"}">
      </div>
      ${state.form.type==="positional"?`
      <div class="form-row">
        <label class="form-label">Setup / winning conditions</label>
        <textarea class="form-textarea" oninput="setFormField('note',this.value)" placeholder="Describe the starting position and winning conditions...">${state.form.note}</textarea>
      </div>`:""}
      ${state.form.type==="drill"?`
      <div class="form-row">
        <label class="form-label">Drill structure</label>
        <div class="type-toggle">
          <button class="type-opt${state.form.roles==="symmetric"?" on":""}" onclick="setFormField('roles','symmetric')">Same for both players</button>
          <button class="type-opt${state.form.roles==="asymmetric"?" on":""}" onclick="setFormField('roles','asymmetric')">Attacker &amp; Defender</button>
        </div>
      </div>
      ${state.form.roles==="symmetric"?`
      <div class="form-row">
        <label class="form-label">Goal / reset condition</label>
        <input class="form-input" type="text" value="${state.form.goal.replace(/"/g,"&quot;")}" oninput="setFormField('goal',this.value)" placeholder="e.g. Win by completing the takedown to the mat">
      </div>`:`
      <div class="form-row">
        <label class="form-label">Attacker goal / reset condition</label>
        <input class="form-input" type="text" value="${state.form.attackerGoal.replace(/"/g,"&quot;")}" oninput="setFormField('attackerGoal',this.value)" placeholder="e.g. Win by completing the takedown">
      </div>
      <div class="form-row">
        <label class="form-label">Defender goal / reset condition</label>
        <input class="form-input" type="text" value="${state.form.defenderGoal.replace(/"/g,"&quot;")}" oninput="setFormField('defenderGoal',this.value)" placeholder="e.g. Win by defending and returning to neutral">
      </div>`}
      `:state.form.type==="technique"?`
      <div class="form-row">
        <label class="form-label">Coaching note (optional)</label>
        <input class="form-input" type="text" value="${state.form.note.replace(/"/g,"&quot;")}" oninput="setFormField('note',this.value)" placeholder="e.g. Focus on hip position throughout">
      </div>`:""}
      <div class="form-row">
        <label class="form-label">Video link (optional)</label>
        <input class="form-input" type="url" value="${(state.form.videoUrl||"").replace(/"/g,"&quot;")}" oninput="setFormField('videoUrl',this.value)" placeholder="e.g. https://www.youtube.com/watch?v=...">
      </div>
      <div class="form-btns">
        <button class="cancel-btn" onclick="cancelForm()">Cancel</button>
        <button class="save-btn" onclick="saveForm()">Save to library</button>
      </div>
    </div>
  `:"";
  return`
    <div style="margin-bottom:1rem">
      <input id="lib-search" class="form-input" type="search" placeholder="Search library…" value="${state.libSearch.replace(/"/g,'&quot;')}" oninput="setLibSearch(this.value)" style="margin-bottom:10px">
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">
        ${THEMES.map(t=>`<button class="filter-btn${state.libFilter.theme===t.id?" on":""}" onclick="setLibFilter('theme','${t.id}')">${t.label}</button>`).join("")}
      </div>
      <div style="display:flex;gap:6px">
        <button class="filter-btn${state.libFilter.type==="drill"?" on":""}" onclick="setLibFilter('type','drill')">Drills</button>
        <button class="filter-btn${state.libFilter.type==="technique"?" on":""}" onclick="setLibFilter('type','technique')">Techniques</button>
        <button class="filter-btn${state.libFilter.type==="positional"?" on":""}" onclick="setLibFilter('type','positional')">Sparring</button>
      </div>
    </div>
    ${!state.showForm&&state.user?`
      <button class="add-btn" onclick="showAddForm()" style="margin-bottom:8px">+ Add drill, technique, or sparring</button>
    `:""}
    ${formHtml}
    ${filtered.length===0&&!state.showForm?`<div style="text-align:center;padding:32px 20px;color:var(--color-text-secondary);font-size:13px;background:var(--color-background-secondary);border-radius:var(--border-radius-lg)">${state.library.length===0?"Library is empty — add your first item above":"No items match this filter"}</div>`:""}
    ${filtered.map(item=>`
      <div class="lib-item">
        <div style="flex:1">
          <div style="margin-bottom:4px">
            <span class="badge badge-${item.type}">${item.type==="positional"?"sparring":item.type}</span>
            <span style="font-size:11px;color:var(--color-text-secondary)">${THEMES.find(t=>t.id===item.theme)?.label}</span>
            ${item.videoUrl?`<a href="${item.videoUrl}" target="_blank" rel="noopener" style="font-size:11px;color:#639922;margin-left:6px;text-decoration:none">▶ Watch</a>`:""}
          </div>
          <div class="lib-item-name">${item.name}</div>
          ${item.type==="drill"?(item.roles==="asymmetric"?`<div class="lib-item-note">Attacker: ${item.attackerGoal||"—"}</div><div class="lib-item-note">Defender: ${item.defenderGoal||"—"}</div>`:(item.goal?`<div class="lib-item-note">Goal: ${item.goal}</div>`:"")):item.note?`<div class="lib-item-note">${item.note}</div>`:""}
          ${item.type==="technique"&&item.lastUsed?`<div style="font-size:11px;color:var(--color-text-secondary);margin-top:3px">${formatLastUsed(item.lastUsed)}</div>`:""}
        </div>
        ${state.user?`<div class="lib-actions">
          <button class="icon-btn" onclick="editItem('${item.id}')">Edit</button>
          <button class="icon-btn del" onclick="deleteItem('${item.id}')">Del</button>
        </div>`:""}
      </div>
    `).join("")}
    ${!state.showForm&&!state.user?`<div style="text-align:center;padding:14px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);font-size:13px;color:var(--color-text-secondary);margin-top:6px">Sign in to add or edit library items</div>`:""}
  `;
}

function render(){
  if(state.loading){document.getElementById("app").innerHTML=`<div style="text-align:center;padding:40px;color:var(--color-text-secondary);font-size:13px">Loading...</div>`;return;}
  document.getElementById("app").innerHTML=`
    <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:10px;min-height:24px">
      ${state.user===undefined?""
        :state.user
          ?`<span style="font-size:12px;color:var(--color-text-secondary);margin-right:8px">${state.user.displayName||state.user.email}</span><button class="icon-btn" onclick="signOut()">Sign out</button>`
          :`<button class="icon-btn" onclick="signIn()" style="font-size:13px;padding:6px 12px;color:var(--color-text-primary)">Sign in with Google</button>`
      }
    </div>
    <div class="tab-bar">
      <button class="tab${state.tab==="plan"?" on":""}" onclick="setTab('plan')">Session plan</button>
      <button class="tab${state.tab==="library"?" on":""}" onclick="setTab('library')">Coach library${state.library.length?" ("+state.library.length+")":""}</button>
    </div>
    ${state.tab==="plan"?renderPlan():renderLibrary()}
  `;
}

init();
