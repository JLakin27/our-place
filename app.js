/* Firebase console > Project settings > Your apps > Web app. */
const firebaseConfig = {
  apiKey: "AIzaSyBXzfTak_EcGERwbs1cOlZpGQgtGUF3SLo",
  authDomain: "ourwebsite-19c5b.firebaseapp.com",
  projectId: "ourwebsite-19c5b",
  storageBucket: "ourwebsite-19c5b.firebasestorage.app",
  messagingSenderId: "973934565883",
  appId: "1:973934565883:web:22324a6fe82b35c26ed35e",
  measurementId: "G-19DNFJWZM3"
};
const USER_UIDS = { Joe: 'ahZtOZv0wnboG5LFKU0Nx8BpJpq2', 'Noémie': 'ed9Ufp9pNRRY5qsFMneztfsxoff1' };
const LOGIN_EMAILS = { joe: 'lakin.joe27@gmail.com', captain: 'fakeemail@gmail.com' };
const $ = id => document.getElementById(id);
const STARTERS = [
  {id:'starter-la-rochelle', name:'La Rochelle, France', lat:46.1603, lng:-1.1511, category:'The beachhhhh', status:'approved', notes:'A place for us to explore together.', addedBy:'Joe'},
  {id:'starter-norway', name:'Norway', lat:61, lng:8, category:'Agreed Trip', status:'approved', notes:'fjords 😍😍😍', addedBy:'Noémie'}
];
const isDemo = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE_');
const demoKey = 'our-next-stop-demo'; // reuse old local-preview data
let serverFresh=false, hasPendingWrites=false, syncError=false, writeInProgress=false, everConnected=false;
let map, db, auth, firestore, authApi, unsubscribe, pins=[], currentPage='home', filter='All', currentUser='Joe', pendingLatLng=null, previewMarker=null, selectedId=null, savedMarkers=new Map(), toastTimer, clusterGroup=null, tripListExpanded=false, tripSort='newest', mapExpanded=false;
const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const stateOf = p => p.status || (p.category==='Agreed Trip'?'approved':p.category==='Visited'?'visited':'suggested');
const nameFor = p => ({'Wishlist - Her':'Noémie','Wishlist - Him':'Joe'}[p.category] || p.addedBy);
const showState = p => ({suggested:'Suggested',approved:'Both up for it',visited:'Visited',vetoed:'Not for me'}[stateOf(p)]||'Suggested');
const markerStyle = p => ({suggested:'hers',approved:'together',visited:'done',vetoed:'vetoed'}[stateOf(p)]||'hers');
const otherUser = name => name==='Joe'?'Noémie':'Joe';
const incoming = () => pins.filter(p=>stateOf(p)==='suggested' && nameFor(p)!==currentUser);
/* Profiles and kisses are separate from the map and checklist. */
const STATUS_CHOICES=['🦤','❤️','🥰','🥺','😂','😴','😈','😡'];
const AVATAR_CHOICES=['🦤','🐥','🦊','🐻','🐸','👽','🐈','🐧'];
const AVATAR_COLOURS=['#f7d76b','#e9a88e','#b9dccb','#cdb9e8','#bfd6f1','#f1c7d2','#d1d2ce','#f1ca9e'];
const defaultProfile=name=>({avatarEmoji:name==='Noémie'?'🦤':'🦊',statusEmoji:'',colour:name==='Noémie'?'#f7d76b':'#b9dccb'});
let sharedProfiles={}, kisses=[], unsubscribeProfiles=null, unsubscribeKisses=null, profileDraft=null, profilesReady=false,kissesReady=false,profileSaving=false,kissSending=false;
const nameForUid=uid=>uid===USER_UIDS.Joe?'Joe':uid===USER_UIDS['Noémie']?'Noémie':null;
const otherUid=()=>USER_UIDS[otherUser(currentUser)];
const currentProfile=name=>({...defaultProfile(name),...(sharedProfiles[name]||{})});
const emojiOkay=value=>{const chars=[...value.trim()];return chars.length>0&&chars.length<=8&&!/[\x00-\x1f<>]/.test(value);};
function showProfileStatus(){
  const other=otherUser(currentUser);
  for(const [kind,name] of [['own',currentUser],['other',other]]){
    const p=currentProfile(name), avatar=$(kind+'-avatar'), status=$(kind+'-status');
    avatar.firstChild.textContent=p.avatarEmoji;
    avatar.style.setProperty('--avatar-colour',p.colour);
    status.textContent=p.statusEmoji;
    status.hidden=!p.statusEmoji;
    $(kind+'-profile-name').textContent=name;
    $(kind+'-profile-button').setAttribute('aria-label',kind==='own'?'Edit your profile':`View ${name}'s profile`);
  }
  // Music's current-jam labels use these same live profiles.
  renderMusic();
}
function populateEmojiChoices(container,values,key){
  const root=$(container);root.replaceChildren();
  for(const val of values){
    const b=document.createElement('button');b.type='button';b.className='profile-emoji-option';b.textContent=val;b.setAttribute('aria-label',val);b.setAttribute('aria-pressed',String(profileDraft[key]===val));
    b.onclick=()=>{profileDraft[key]=val; if(key==='avatarEmoji')$('custom-avatar').value='';else $('custom-status').value='';refreshProfileDraft();};root.append(b);
  }
}
function refreshProfileDraft(){
  $('profile-avatar-preview').textContent=profileDraft.avatarEmoji;
  $('profile-avatar-preview').style.background=profileDraft.colour;
  populateEmojiChoices('avatar-choices',AVATAR_CHOICES,'avatarEmoji');
  populateEmojiChoices('status-choices',STATUS_CHOICES,'statusEmoji');
  const root=$('profile-colours');root.replaceChildren();
  for(const colour of AVATAR_COLOURS){const b=document.createElement('button');b.type='button';b.className='profile-colour-option';b.style.background=colour;b.setAttribute('aria-label','Choose '+colour);b.setAttribute('aria-pressed',String(profileDraft.colour===colour));b.textContent=profileDraft.colour===colour?'✓':'';b.onclick=()=>{profileDraft.colour=colour;refreshProfileDraft();};root.append(b);}
}
function openOwnProfile(){
  profileDraft={...currentProfile(currentUser)};
  $('profile-display-name').textContent=currentUser;
  $('profile-heading').textContent=currentUser+'’s profile';
  $('custom-avatar').value='';$('custom-status').value='';$('profile-error').textContent='';
  refreshProfileDraft();$('profile-modal').hidden=false;
}
function openOtherProfile(){
  const name=otherUser(currentUser),p=currentProfile(name);
  $('other-profile-heading').textContent=name;
  $('other-profile-vibe').textContent=p.statusEmoji?'Current vibe: '+p.statusEmoji:'No status selected';
  $('other-profile-large').textContent=p.avatarEmoji;
  $('other-profile-large').style.background=p.colour;
  $('other-profile-modal').hidden=false;
}
function closeProfileDialogs(){$('profile-modal').hidden=true;$('other-profile-modal').hidden=true;}
async function saveProfile(e){
  e.preventDefault();if(profileSaving)return;
  const avatar=$('custom-avatar').value.trim()||profileDraft.avatarEmoji;
  const status=$('custom-status').value.trim()||profileDraft.statusEmoji;
  if(!emojiOkay(avatar)||(status&&!emojiOkay(status))){$('profile-error').textContent='Please choose a short emoji for your avatar and status.';return;}
  const next={avatarEmoji:avatar,statusEmoji:status,colour:profileDraft.colour};
  if(!AVATAR_COLOURS.includes(next.colour)){ $('profile-error').textContent='Please pick one of the colours.';return;}
  if(!isDemo&&!canWrite()){ $('profile-error').textContent='Please wait until Connected appears.';return;}
  profileSaving=true;const btn=$('save-profile');btn.disabled=true;btn.textContent='Saving…';$('profile-error').textContent='';
  try{
    if(isDemo){sharedProfiles[currentUser]=next;localStorage.setItem('our-space-demo-profiles',JSON.stringify(sharedProfiles));}
    else await firestore.setDoc(firestore.doc(db,'profiles',USER_UIDS[currentUser]),{...next,updatedAt:firestore.serverTimestamp()});
    sharedProfiles[currentUser]=next;showProfileStatus();closeProfileDialogs();notify('Profile saved ✓');
  }catch(err){$('profile-error').textContent='Could not save: '+err.message;}
  finally{profileSaving=false;btn.disabled=false;btn.textContent='Save profile ✓';}
}
// One visible inbox kiss per recipient. Old randomly-IDed kiss records are
// folded into that same notification until the recipient opens it.
function pendingKisses(){
  const mine=kisses.filter(k=>k.toUid===USER_UIDS[currentUser]);
  if(!mine.length)return [];
  const time=k=>k.createdAt?.toMillis?.() || (k.createdAt?.seconds||0)*1000 || new Date(k.createdAt||0).getTime() || 0;
  return [mine.slice().sort((a,b)=>time(b)-time(a))[0]];
}
async function sendKiss(){
  if(kissSending)return;
  if(!isDemo&&!canWrite())return notify('Wait until Connected appears to send a kiss.');
  kissSending=true;const btn=$('send-kiss');btn.disabled=true;btn.textContent='Sending…';
  try{
    // The recipient UID is the fixed document ID. Repeated sends overwrite the
    // same private pending notification. Senders have no read access to it.
    if(isDemo){
      const uid=otherUid();kisses=kisses.filter(k=>k.toUid!==uid);
      kisses.push({id:uid,fromUid:USER_UIDS[currentUser],toUid:uid,createdAt:new Date()});
      localStorage.setItem('our-space-demo-kisses',JSON.stringify(kisses));refreshNotificationsWithKisses();
    }else{
      const uid=otherUid();
      await firestore.setDoc(firestore.doc(db,'kisses',uid),{
        fromUid:USER_UIDS[currentUser],toUid:uid,createdAt:firestore.serverTimestamp()
      });
    }
    closeProfileDialogs();notify('Kiss sent 😘');
  }catch(err){notify('Could not send kiss: '+err.message);}
  finally{kissSending=false;btn.disabled=false;btn.textContent='😘 Send a kiss';}
}
let kissOpening=false;
async function dismissKiss(kiss){
  if(kissOpening)return;
  if(!isDemo&&!canWrite())return notify('Please reconnect before opening your kiss.');
  kissOpening=true;
  try{
    // Clear the single current kiss plus any older legacy kiss documents.
    // Only the recipient is allowed to delete these records.
    const mine=kisses.filter(k=>k.toUid===USER_UIDS[currentUser]);
    if(isDemo){
      kisses=kisses.filter(k=>k.toUid!==USER_UIDS[currentUser]);
      localStorage.setItem('our-space-demo-kisses',JSON.stringify(kisses));
      refreshNotificationsWithKisses();
    }else{
      const batch=firestore.writeBatch(db);
      for(const k of mine)batch.delete(firestore.doc(db,'kisses',k.id));
      if(mine.length)await batch.commit();
    }
    $('notifications-modal').hidden=true;
    openKissCelebration(nameForUid(kiss.fromUid)||'Someone special');
  }catch(err){notify('Could not open kiss: '+err.message);}
  finally{kissOpening=false;}
}
function openKissCelebration(sender){
  $('kiss-celebration-from').textContent='A little kiss from '+sender+' ❤️';
  const dialog=$('kiss-celebration');
  dialog.hidden=false;
  // Restart the entrance animation every time a new kiss is opened.
  const scene=$('kiss-celebration-scene');scene.classList.remove('kiss-animate');
  void scene.offsetWidth;scene.classList.add('kiss-animate');
  $('kiss-celebration-close').focus();
}
function closeKissCelebration(){
  $('kiss-celebration').hidden=true;
  $('kiss-celebration-scene').classList.remove('kiss-animate');
}
function refreshNotificationsWithKisses(){
  const count=incoming().length+placesToIncoming().length+pendingKisses().length;
  $('notifications-count').textContent=count;
  $('notifications-btn').classList.toggle('has-new',count>0);
  refreshHome();renderNotifications();
}
function startProfileListeners(uid){
  if(isDemo){try{sharedProfiles=JSON.parse(localStorage.getItem('our-space-demo-profiles')||'{}');kisses=JSON.parse(localStorage.getItem('our-space-demo-kisses')||'[]');}catch{sharedProfiles={};kisses=[];}showProfileStatus();refreshNotificationsWithKisses();return;}
  unsubscribeProfiles=firestore.onSnapshot(firestore.collection(db,'profiles'),snapshot=>{
    sharedProfiles={};for(const item of snapshot.docs){const name=nameForUid(item.id);if(name)sharedProfiles[name]=item.data();}
    profilesReady=!snapshot.metadata.fromCache;showProfileStatus();
  },err=>{notify('Profiles could not load: '+err.message);});
  const qry=firestore.query(firestore.collection(db,'kisses'),firestore.where('toUid','==',uid));
  unsubscribeKisses=firestore.onSnapshot(qry,snapshot=>{
    kisses=snapshot.docs.map(d=>({id:d.id,...d.data()}));kissesReady=!snapshot.metadata.fromCache;refreshNotificationsWithKisses();
  },err=>{notify('Kiss notifications could not load: '+err.message);});
}
function bindProfiles(){
  $('own-profile-button').onclick=openOwnProfile;$('other-profile-button').onclick=openOtherProfile;
  $('close-profile').onclick=()=>$('profile-modal').hidden=true;
  $('close-other-profile').onclick=()=>$('other-profile-modal').hidden=true;
  $('send-kiss').onclick=sendKiss;$('profile-form').onsubmit=saveProfile;
  $('clear-profile-status').onclick=()=>{profileDraft.statusEmoji='';$('custom-status').value='';refreshProfileDraft();};
  document.querySelectorAll('#profile-modal,#other-profile-modal').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.hidden=true;}));
}
function refreshHome(){
  const greeting=$('home-greeting');if(!greeting)return;
  greeting.textContent=currentUser==='Noémie'?'HEY, CAPTAIN 👀':'HEY, JOE 👋';
  const pendingTrips=incoming().length,pendingIdeas=placesToIncoming().length,pendingKisses=pendingKisses().length,total=pendingTrips+pendingIdeas+pendingKisses;
  $('home-attention').textContent=total?`${pendingTrips} trip ${pendingTrips===1?'suggestion':'suggestions'} · ${pendingIdeas} list ${pendingIdeas===1?'idea':'ideas'} · ${pendingKisses} ${pendingKisses===1?'kiss':'kisses'} waiting for you`:'All caught up — nothing new right now.';
  // Firebase listeners already refresh the map and checklist arrays; counts remain live even while collapsed.
  $('kpi-to-visit').textContent=pins.filter(p=>stateOf(p)==='approved').length;
  $('kpi-visited').textContent=pins.filter(p=>stateOf(p)==='visited').length;
  $('kpi-our-list').textContent=placesTo.filter(p=>p.status==='approved').length;
  $('kpi-ticked').textContent=placesTo.filter(p=>p.status==='done').length;
  $('kpi-music-tracks').textContent=musicTracks.length;
}
function bindHomeKpis(){
  const toggle=$('home-kpis-toggle'),content=$('home-kpis-content'),label=$('home-kpis-toggle-label');
  toggle.addEventListener('click',()=>{
    const expanded=toggle.getAttribute('aria-expanded')==='true';
    toggle.setAttribute('aria-expanded',String(!expanded));
    content.hidden=expanded;
    label.textContent=expanded?'Show':'Hide';
  });
  // The panel starts collapsed on every full page load, with no persistent storage.
}
function notify(msg){$('toast').textContent=msg;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3600);}
// Only a non-cached Firestore snapshot confirms that reads are current.
// A successful write promise confirms that Firebase has acknowledged the change.
function canWrite(){return !writeInProgress && (isDemo || (serverFresh && !syncError && navigator.onLine));}
function updateConnectionUI(){
  let label, connected=false;
  if(isDemo){label='Local preview';connected=true;}
  else if(syncError){label='Connection error';}
  else if(writeInProgress || hasPendingWrites){label='Saving…';}
  else if(!navigator.onLine || (everConnected && !serverFresh)){label='Offline — changes paused';}
  else if(serverFresh){label='Connected';connected=true;}
  else label='Connecting…';
  $('sync-status').textContent=label;
  $('status-dot').classList.toggle('off',!connected);
  $('sync-status').parentElement.title=connected?'Latest data confirmed from Firebase':
    (label==='Saving…'?'Waiting for Firebase to confirm your change':
      'Changes are paused until Firebase confirms the connection');
  const ready=canWrite();
  const save=$('save-pin');if(save && !writeInProgress)save.disabled=!ready;
  const visit=$('confirm-visited');if(visit && !writeInProgress)visit.disabled=!ready;
  document.querySelectorAll('[data-write-action]').forEach(btn=>{if(!writeInProgress)btn.disabled=!ready;});
}
function connectionStatus(msg){
  // These messages are used while logging in or if Firebase cannot initialize.
  serverFresh=false;
  syncError=msg==='Permission error'||msg==='Connection error'||msg==='Sync error';
  updateConnectionUI();
  if(msg==='Sign in required')$('sync-status').textContent='Sign in required';
}
function requireConnection(){
  if(writeInProgress){notify('Please finish saving the current change first.');return false;}
  if(!canWrite()){notify('Not connected yet. Nothing has been submitted — try again when Connected appears.');return false;}
  return true;
}
async function confirmedWrite(operation, button=null){
  if(!requireConnection())return false;
  writeInProgress=true;
  const original=button?.textContent;
  if(button){button.disabled=true;button.textContent='Saving…';}
  updateConnectionUI();
  try{await operation();return true;}
  catch(err){notify('Could not save: '+err.message);return false;}
  finally{
    writeInProgress=false;
    if(button){button.textContent=original;}
    updateConnectionUI();
  }
}

function initMap(){map=L.map('map',{zoomControl:false,worldCopyJump:true}).setView([46,2],4);L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, USGS, &copy; OpenStreetMap contributors, and the GIS user community'}).addTo(map);L.control.zoom({position:'bottomright'}).addTo(map);map.on('click',e=>showPinModal(e.latlng));clusterGroup=L.markerClusterGroup?L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,zoomToBoundsOnClick:true,maxClusterRadius:48,iconCreateFunction(group){const count=group.getChildCount();return L.divIcon({html:`<span class="trip-cluster">${count}</span>`,className:'trip-cluster-outer',iconSize:[44,44]});}}):L.layerGroup();map.addLayer(clusterGroup);}
function fitPins(){const visible=pins.filter(p=>tripFilterMatches(p)&&Number.isFinite(p.lat)&&Number.isFinite(p.lng));if(!visible.length){map.setView([46,2],4);return;}map.fitBounds(L.latLngBounds(visible.map(p=>[p.lat,p.lng])).pad(.25),{maxZoom:7});}
function navigate(page){if(page!=='map'&&page!=='home'&&!['places','music','positions','moments'].includes(page))page='home';currentPage=page;const isMap=page==='map';$('home-view').hidden=page!=='home';$('map-view').hidden=!isMap;$('soon-view').hidden=page==='home'||isMap||page==='places'||page==='music';$('places-view').hidden=page!=='places';$('music-view').hidden=page!=='music';if(page==='music')renderMusic();if(page==='places')renderPlacesTo();document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('selected',b.dataset.section===page));$('page-eyebrow').textContent=page==='home'?'OUR SPACE':isMap?'NEXT STOP':page==='music'?'MUSIC':page.toUpperCase();closeSidebar();if(isMap)setTimeout(()=>{map.invalidateSize();fitPins();},70);if(!isMap&&page!=='home'&&page!=='places'&&page!=='music'){const info={places:['😈','Our places to','A checklist for all those places. We can build adding items, marking them done and tracking who suggested them later.'],positions:['🥵','Our positions','A private list with our own checkboxes is coming soon.'],moments:['📸','Our moments','Shared photos, stories and favourites — all in one place.']}[page];$('soon-icon').textContent=info[0];$('soon-title').textContent=info[1];$('soon-text').textContent=info[2];}history.replaceState(null,'',page==='home'?location.pathname+location.search:'#'+page);}
// Reads existing Firestore timestamps, including legacy places without createdAt.
function tripDate(value){
  if(!value)return null;
  const d=value.toDate?.() || (typeof value.seconds==='number'?new Date(value.seconds*1000):new Date(value));
  return Number.isFinite(d.getTime())?d:null;
}
function tripCreated(p){return tripDate(p.createdAt)?.getTime() || 0;}
function tripFilterMatches(p){return filter==='All'?stateOf(p)!=='vetoed':showState(p)===filter;}
function tripSortItems(items){return items.sort((a,b)=>{
  if(tripSort==='alphabetical')return a.name.localeCompare(b.name);
  const delta=tripCreated(b)-tripCreated(a);
  return (tripSort==='oldest'?-delta:delta)||a.name.localeCompare(b.name);
});}
function tripDateLabel(p){const date=tripDate(p.createdAt);return date?date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Date not recorded';}
function tripIcon(p){return stateOf(p)==='visited'?'✓':stateOf(p)==='approved'?'♡':stateOf(p)==='vetoed'?'×':'✦';}
function mapSelectTrip(p){
  navigate('map');
  const marker=savedMarkers.get(p.id);
  if(marker&&typeof clusterGroup.zoomToShowLayer==='function')clusterGroup.zoomToShowLayer(marker,()=>{
    map.panTo(marker.getLatLng());marker.openPopup();openDetails(p.id);
  });
  else {map.setView([p.lat,p.lng],Math.max(7,map.getZoom()));openDetails(p.id);}
}
function renderTripList(){
  const all=tripSortItems(pins.filter(tripFilterMatches));
  const items=tripListExpanded?all:tripSortItems(pins.filter(p=>stateOf(p)!=='vetoed')).slice(0,3);
  const container=$('trip-list-items');container.replaceChildren();
  $('trip-list-caption').textContent=tripListExpanded?`${all.length} ${all.length===1?'place':'places'} · ${filter==='All'?'Showing shared and suggested places':filter==='Visited'?'Done':filter}`:'The three newest places';
  $('trip-list-expanded').hidden=!tripListExpanded;
  $('trip-list-toggle').setAttribute('aria-expanded',String(tripListExpanded));
  $('trip-list-toggle-label').textContent=tripListExpanded?'Show less':'View all';
  document.querySelectorAll('[data-trip-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.tripFilter===filter);b.setAttribute('aria-pressed',String(b.dataset.tripFilter===filter));});
  if(!items.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No places in this category yet.';container.append(empty);return;}
  for(const place of items){
    const button=document.createElement('button');button.type='button';button.className='trip-list-row';
    const icon=document.createElement('span');icon.className=`trip-list-state ${markerStyle(place)}`;icon.textContent=tripIcon(place);
    const body=document.createElement('span');body.className='trip-list-body';
    const name=document.createElement('strong');name.textContent=place.name;
    const sub=document.createElement('small');sub.textContent=`${tripDateLabel(place)} · ${nameFor(place)}`;
    if(stateOf(place)==='visited'&&tripDate(place.visitedAt))sub.textContent+=` · Visited ${tripDate(place.visitedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;
    body.append(name,sub);
    const tag=document.createElement('span');tag.className=`trip-status trip-status-${stateOf(place)}`;tag.textContent=showState(place);
    button.append(icon,body,tag);button.onclick=()=>mapSelectTrip(place);container.append(button);
  }
}
function toggleMapExpanded(){
  mapExpanded=!mapExpanded;const card=$('map-card');card.classList.toggle('map-is-expanded',mapExpanded);
  document.body.classList.toggle('trip-map-fullscreen',mapExpanded);
  $('map-expand').textContent=mapExpanded?'✕ Close map':'⛶ Expand map';
  $('map-expand').setAttribute('aria-pressed',String(mapExpanded));
  setTimeout(()=>map.invalidateSize(),70);
}
function render(){const suggestions=pins.filter(p=>stateOf(p)==='suggested'),approved=pins.filter(p=>stateOf(p)==='approved'),visited=pins.filter(p=>stateOf(p)==='visited');$('wishlist-count').textContent=suggestions.length;$('agreed-count').textContent=approved.length;$('done-count').textContent=visited.length;$('notifications-count').textContent=incoming().length+placesToIncoming().length+pendingKisses().length;$('notifications-btn').classList.toggle('has-new',incoming().length+placesToIncoming().length+pendingKisses().length>0);
  if(clusterGroup){clusterGroup.clearLayers();savedMarkers.clear();}
  for(const place of pins.filter(tripFilterMatches)){
    if(!Number.isFinite(place.lat)||!Number.isFinite(place.lng))continue;
    const icon=L.divIcon({className:'',html:`<div class="pin-dot ${markerStyle(place)}"></div>`,iconSize:[25,25],iconAnchor:[12,24]});
    const marker=L.marker([place.lat,place.lng],{icon});
    const popup=document.createElement('div');popup.innerHTML=`<b>${escapeHtml(place.name)}</b><br>${showState(place)} · ${escapeHtml(nameFor(place))}${place.notes?`<p>${escapeHtml(place.notes)}</p>`:''}`;
    const details=document.createElement('button');details.className='popup-delete';details.textContent='View details ↗';details.onclick=()=>openDetails(place.id);popup.append(details);
    marker.bindPopup(popup);savedMarkers.set(place.id,marker);clusterGroup.addLayer(marker);
  }
  renderTripList();renderNotifications();renderPlacesTo();refreshHome();
}
function openDetails(id){const p=pins.find(x=>x.id===id);if(!p)return;selectedId=id;$('detail-title').textContent=p.name;$('detail-state').textContent=showState(p);$('detail-meta').textContent=`Suggested by ${nameFor(p)} · ${showState(p)}`;$('detail-notes').textContent=p.notes||'No description yet.';$('edit-description-text').value=p.notes||'';$('edit-description-fields').hidden=true;$('detail-memory-wrap').hidden=!p.memoryNotes;$('detail-memory').textContent=p.memoryNotes||'';let url='';try{const u=new URL(p.photoUrl||'');if(u.protocol==='https:')url=u.href;}catch{}$('detail-photo-wrap').hidden=!url;if(url)$('detail-photo').src=url;else $('detail-photo').removeAttribute('src');$('visit-fields').hidden=true;$('memory-notes').value=p.memoryNotes||'';$('photo-url').value=p.photoUrl||'';
  const actions=$('detail-actions');actions.replaceChildren();const button=(label,cb,cls='secondary',isWrite=false)=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.onclick=cb;if(isWrite){b.dataset.writeAction='true';b.disabled=!canWrite();}actions.append(b);};const state=stateOf(p);
  button('✎ Edit description',()=>{$('edit-description-text').value=p.notes||'';$('edit-description-fields').hidden=false;$('edit-description-text').focus();});
  if(state==='suggested'&&nameFor(p)!==currentUser){button('I’m up for it ✓',event=>changeStatus(p,'approved',event.currentTarget),'primary',true);button('Not for me',event=>changeStatus(p,'vetoed',event.currentTarget),'secondary',true);}
  if(state==='suggested'&&nameFor(p)===currentUser)button('Waiting for '+otherUser(currentUser)+'’s response',()=>notify('Only the other person can respond to this suggestion.'),'secondary');
  if(state==='approved')button('We went here ✓',()=>{$('visit-fields').hidden=false;});
  if(state==='visited')button('Edit memories',()=>{$('visit-fields').hidden=false;$('confirm-visited').textContent='Save memories ✓';});
  if(state==='vetoed')button('Not for me',()=>notify('This suggestion wasn’t for them.'));
  button('Share on WhatsApp ↗',()=>sharePlace(p));button('Delete',()=>deletePlace(p),'danger',true);$('detail-modal').hidden=false;updateConnectionUI();}
function closeDetails(){if(writeInProgress)return;$('detail-modal').hidden=true;selectedId=null;$('confirm-visited').textContent='Mark as visited ✓';}
async function saveDescription(){
  const p=pins.find(x=>x.id===selectedId);if(!p)return;
  const text=$('edit-description-text').value.trim();
  if(text.length>2000)return notify('Description must be 2,000 characters or fewer.');
  const saved=await confirmedWrite(()=>writePlace(p,{notes:text}),$('save-description'));
  if(saved){$('detail-notes').textContent=text||'No description yet.';$('edit-description-fields').hidden=true;notify('Description saved ✓');}
}
async function sharePlace(p){const url=new URL(location.href);url.hash='place-'+encodeURIComponent(p.id);const msg=`${nameFor(p)} suggested ${p.name} 🌍 — are you up for it? 👀\n${url.href}`;if(navigator.share){try{await navigator.share({text:msg});return;}catch(e){if(e.name==='AbortError')return;}}try{await navigator.clipboard.writeText(msg);notify('Message copied — paste it into WhatsApp!');}catch{window.prompt('Copy this message for WhatsApp:',msg);}}
function renderNotifications(){
  const list=$('notifications-list');list.replaceChildren();const items=incoming(),extra=placesToIncoming(),mail=pendingKisses();
  if(!items.length&&!extra.length&&!mail.length){list.innerHTML='<p class="empty">All caught up for now.</p>';return;}
  for(const k of mail){const b=document.createElement('button');b.className='notification-row kiss-notification';b.innerHTML=`<strong>😘 A little delivery from ${escapeHtml(nameForUid(k.fromUid)||'someone special')}</strong><span>Tap to open your kiss</span>`;b.onclick=()=>dismissKiss(k);list.append(b);}
  for(const p of extra){const b=document.createElement('button');b.className='notification-row';b.innerHTML=`<strong>😈 ${escapeHtml(p.name)}</strong><span>${escapeHtml(p.addedBy)} suggested a new list idea · Review →</span>`;b.onclick=()=>{$('notifications-modal').hidden=true;placesToTab='suggested';navigate('places');setPlacesTab('suggested');};list.append(b);}
  for(const p of items){const b=document.createElement('button');b.className='notification-row';b.innerHTML=`<strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(nameFor(p))} suggested this trip · Review →</span>`;b.onclick=()=>{$('notifications-modal').hidden=true;navigate('map');openDetails(p.id);};list.append(b);}
}
function showPinModal(latlng=null,suggestedName=''){pendingLatLng=latlng||map.getCenter();$('pin-form').reset();$('pin-name').value=suggestedName;$('pin-coords').textContent=`📍 ${pendingLatLng.lat.toFixed(4)}, ${pendingLatLng.lng.toFixed(4)}`;$('pin-modal').hidden=false;updateConnectionUI();if(previewMarker)previewMarker.remove();previewMarker=L.circleMarker(pendingLatLng,{radius:9,color:'#fff',weight:3,fillColor:'#df8a69',fillOpacity:1}).addTo(map);setTimeout(()=>$('pin-name').focus(),50);}
function closePinModal(){if(writeInProgress)return;$('pin-modal').hidden=true;if(previewMarker)previewMarker.remove();previewMarker=null;}
function openSidebar(){$('sidebar').classList.add('open');$('shade').classList.add('show');}
function closeSidebar(){$('sidebar').classList.remove('open');$('shade').classList.remove('show');}
function persistDemo(){localStorage.setItem(demoKey,JSON.stringify(pins));render();}
async function createPlace(e){
  e.preventDefault();
  const record={name:$('pin-name').value.trim(),category:currentUser==='Joe'?'Wishlist - Joe':'Wishlist - Noémie',status:'suggested',notes:$('pin-notes').value.trim(),addedBy:currentUser,lat:pendingLatLng.lat,lng:pendingLatLng.lng,reviewedBy:'',visitedAt:null,memoryNotes:'',photoUrl:''};
  if(!record.name)return notify('Enter a destination name first.');
  const saved=await confirmedWrite(async()=>{
    if(isDemo){pins.push({id:crypto.randomUUID(),createdAt:new Date().toISOString(),...record});persistDemo();}
    else await firestore.addDoc(firestore.collection(db,'places'),{...record,createdAt:firestore.serverTimestamp()});
  },$('save-pin'));
  if(saved){closePinModal();notify('Saved ✓ Your suggestion has been shared with '+otherUser(currentUser)+'.');}
}
async function writePlace(p,next){
  if(isDemo){pins=pins.map(x=>x.id===p.id?{...x,...next}:x);persistDemo();}
  else await firestore.updateDoc(firestore.doc(db,'places',p.id),next);
}
async function changeStatus(p,next,actionButton=null){
  if(!['approved','vetoed'].includes(next))return;
  if(stateOf(p)!=='suggested'||nameFor(p)===currentUser)return notify('Only the other person can respond to this suggestion.');
  const saved=await confirmedWrite(()=>writePlace(p,{status:next,category:next==='approved'?'Agreed Trip':p.category,reviewedBy:currentUser}),
    actionButton);
  if(saved){closeDetails();notify(next==='approved'?'Saved ✓ Both up for it!':'Saved ✓ Not for me.');}
}
async function saveVisit(){
  const p=pins.find(x=>x.id===selectedId);if(!p)return;
  const url=$('photo-url').value.trim();
  if(url&&!/^https:\/\//i.test(url))return notify('Please use an https:// photo URL.');
  if(!['approved','visited'].includes(stateOf(p)))return notify('Add the place to your shared list first.');
  const saved=await confirmedWrite(()=>writePlace(p,{status:'visited',category:'Visited',visitedAt:p.visitedAt||new Date(),memoryNotes:$('memory-notes').value.trim(),photoUrl:url}),$('confirm-visited'));
  if(saved){closeDetails();notify('Saved ✓ Added to places we’ve been.');}
}
async function deletePlace(p){
  if(!requireConnection())return;
  if(!confirm(`Delete ${p.name} permanently?`))return;
  const saved=await confirmedWrite(async()=>{
    if(isDemo){pins=pins.filter(x=>x.id!==p.id);persistDemo();}
    else await firestore.deleteDoc(firestore.doc(db,'places',p.id));
  },[...document.querySelectorAll('#detail-actions [data-write-action]')].find(b=>b.textContent==='Delete'));
  if(saved){closeDetails();notify('Saved ✓ Place removed.');}
}
async function searchPlaces(e){e.preventDefault();const term=$('place-search').value.trim();if(term.length<2)return notify('Enter at least two characters.');const box=$('search-results');box.hidden=false;box.innerHTML='<div class="search-result">Searching…</div>';try{const res=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=8&language=en&format=json`);if(!res.ok)throw Error('Search is unavailable');const data=await res.json();box.replaceChildren();if(!data.results?.length){box.innerHTML='<div class="search-result">No results. Try clicking the map instead.</div>';return;}for(const p of data.results){const b=document.createElement('button');b.className='search-result';const display=[p.name,p.admin1,p.country].filter((x,i,a)=>x&&a.indexOf(x)===i).join(', ');b.textContent='📍 '+display;b.onclick=()=>{box.hidden=true;map.setView([p.latitude,p.longitude],9);showPinModal(L.latLng(p.latitude,p.longitude),display);};box.append(b);}}catch(err){box.textContent=err.message;}}
async function initialSeed(){const first=await firestore.getDocs(firestore.query(firestore.collection(db,'places'),firestore.limit(1)));if(!first.empty)return;const lock=firestore.doc(db,'meta','starter-seed');await firestore.runTransaction(db,async tx=>{const state=await tx.get(lock);if(state.exists())return;tx.set(lock,{seededAt:firestore.serverTimestamp()});for(const entry of STARTERS){const {id,...p}=entry;tx.set(firestore.doc(db,'places',id),{...p,reviewedBy:'',visitedAt:null,memoryNotes:'',photoUrl:'',createdAt:firestore.serverTimestamp()});}});}
function startListening(){
  if(unsubscribe)unsubscribe();
  unsubscribe=firestore.onSnapshot(firestore.collection(db,'places'),{includeMetadataChanges:true},snapshot=>{
    const previousIds=pins.map(p=>p.id).join('|');
    pins=snapshot.docs.map(d=>({id:d.id,...d.data()})).map(p=>p.id==='starter-norway'&&p.notes==='Northern lights and beautiful views, one day.'?{...p,notes:'fjords 😍😍😍'}:p).sort((a,b)=>a.name.localeCompare(b.name));
    serverFresh=!snapshot.metadata.fromCache;
    hasPendingWrites=snapshot.metadata.hasPendingWrites;
    if(serverFresh)everConnected=true;
    syncError=false;
    render();updateConnectionUI();
    if(previousIds!==pins.map(p=>p.id).join('|'))openDeepLink();
  },err=>{
    serverFresh=false;syncError=true;updateConnectionUI();
    notify('Database connection failed: '+err.message);
  });
}
async function initFirebase(){const [appSdk,authSdk,dbSdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);firestore=dbSdk;authApi=authSdk;const app=appSdk.initializeApp(firebaseConfig);auth=authSdk.getAuth(app);db=dbSdk.getFirestore(app);authSdk.onAuthStateChanged(auth,async user=>{if(unsubscribe){unsubscribe();unsubscribe=null;}if(unsubscribePlacesTo){unsubscribePlacesTo();unsubscribePlacesTo=null;}if(unsubscribeProfiles){unsubscribeProfiles();unsubscribeProfiles=null;}if(unsubscribeKisses){unsubscribeKisses();unsubscribeKisses=null;}if(unsubscribeMusic){unsubscribeMusic();unsubscribeMusic=null;}musicTracks=[];musicReady=false;renderMusic();profilesReady=false;kissesReady=false;sharedProfiles={};kisses=[];placesToFresh=false;if(!user){serverFresh=false;hasPendingWrites=false;everConnected=false;writeInProgress=false;pins=[];placesTo=[];render();renderPlacesTo();$('auth-modal').hidden=false;$('own-profile-button').hidden=true;$('other-profile-button').hidden=true;$('sign-out').hidden=true;$('mobile-sign-out').hidden=true;connectionStatus('Sign in required');return;}serverFresh=false;hasPendingWrites=false;syncError=false;everConnected=false;updateConnectionUI();currentUser=user.uid===USER_UIDS.Joe?'Joe':user.uid===USER_UIDS['Noémie']?'Noémie':null;if(!currentUser){await authSdk.signOut(auth);$('auth-error').textContent='This account is not on the two-person allowlist. Check the configured UIDs.';return;}$('auth-modal').hidden=true;$('own-profile-button').hidden=false;$('other-profile-button').hidden=false;showProfileStatus();$('identity').textContent=`Signed in as ${currentUser}`;$('sign-out').hidden=false;$('mobile-sign-out').hidden=false;refreshHome();connectionStatus('Connecting');try{startListening();startPlacesToListener();startProfileListeners(user.uid);startMusicListener();}catch(err){connectionStatus('Permission error');notify('Database connection failed: '+err.message);}});}
function openDeepLink(){const value=decodeURIComponent(location.hash.slice(1));if(!value.startsWith('place-'))return;const id=value.slice(6);if(pins.some(p=>p.id===id)){navigate('map');openDetails(id);}}
function bindEvents(){bindMusic();bindProfiles();bindHomeKpis();document.querySelectorAll('.nav-link').forEach(b=>b.onclick=()=>navigate(b.dataset.section));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));$('back-home').onclick=()=>navigate('home');$('soon-map').onclick=()=>navigate('map');$('open-sidebar').onclick=openSidebar;$('close-sidebar').onclick=closeSidebar;$('shade').onclick=closeSidebar;$('add-place').onclick=()=>showPinModal();$('close-pin').onclick=closePinModal;$('cancel-pin').onclick=closePinModal;$('pin-form').addEventListener('submit',createPlace);$('search-form').addEventListener('submit',searchPlaces);$('fit-pins').onclick=fitPins;$('trip-list-toggle').onclick=()=>{tripListExpanded=!tripListExpanded;if(!tripListExpanded)filter='All';render();};
  $('trip-sort').onchange=e=>{tripSort=e.target.value;renderTripList();};
  document.querySelectorAll('[data-trip-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.tripFilter;render();});
  $('map-expand').onclick=toggleMapExpanded;$('notifications-btn').onclick=()=>{$('notifications-modal').hidden=false;};$('close-notifications').onclick=()=>{$('notifications-modal').hidden=true;};$('kiss-celebration-close').onclick=closeKissCelebration;$('kiss-celebration-done').onclick=closeKissCelebration;$('kiss-celebration').addEventListener('click',e=>{if(e.target===$('kiss-celebration'))closeKissCelebration();});$('close-detail').onclick=closeDetails;$('save-description').onclick=saveDescription;$('cancel-description').onclick=()=>{$('edit-description-fields').hidden=true;};$('confirm-visited').onclick=saveVisit;document.querySelectorAll('.backdrop').forEach(el=>el.addEventListener('click',e=>{if(e.target!==el)return;if(el.id==='pin-modal')closePinModal();if(el.id==='detail-modal')closeDetails();if(el.id==='notifications-modal')el.hidden=true;}));document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(mapExpanded)toggleMapExpanded();closePinModal();closeDetails();$('notifications-modal').hidden=true;closeKissCelebration();$('search-results').hidden=true;closeSidebar();});$('demo-user').onchange=e=>{currentUser=e.target.value;localStorage.setItem('our-site-demo-user',currentUser);$('identity').textContent=`Preview as ${currentUser}`;showProfileStatus();render();refreshNotificationsWithKisses();};$('auth-form').addEventListener('submit',async e=>{e.preventDefault();$('auth-error').textContent='';const b=$('auth-form').querySelector('button');b.disabled=true;try{const username=$('username').value.trim().toLowerCase();const loginEmail=LOGIN_EMAILS[username];if(!loginEmail){$('auth-error').textContent='Use Joe or Captain as your username.';return;}await authApi.signInWithEmailAndPassword(auth,loginEmail,$('password').value);$('password').value='';}catch(err){$('auth-error').textContent=err.code==='auth/invalid-credential'?'Incorrect username or password.':err.message;}finally{b.disabled=false;}});$('sign-out').onclick=()=>authApi.signOut(auth);$('mobile-sign-out').onclick=()=>{if(confirm('Sign out of Our Space?'))authApi.signOut(auth);};$('home-review').onclick=()=>{$('notifications-modal').hidden=false;};window.addEventListener('offline',()=>{serverFresh=false;updateConnectionUI();});window.addEventListener('online',()=>{serverFresh=false;updateConnectionUI();});window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#place-'))openDeepLink();else if(location.hash==='#map')navigate('map');else if(location.hash==='#home')navigate('home');});}
// Music lives in a separate Firestore collection. Existing features are untouched.
let musicTracks=[],musicReady=false,unsubscribeMusic=null,musicTab='current',musicSaving=false,musicPreviewData=null,musicUrlInputSerial=0,musicOpenTrackId=null,musicDeleting=false;
const musicDemoKey='our-space-demo-music';
function musicTrackUrl(input){
  try{const u=new URL(String(input).trim());if(u.protocol!=='https:'||u.hostname!=='open.spotify.com')return null;
    const match=u.pathname.match(/^\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})\/?$/);
    return match?`https://open.spotify.com/track/${match[1]}`:null;
  }catch{return null;}
}
const musicTrackId=url=>url.split('/').pop();
function musicDate(value){const d= value?.toDate?.() || (value?.seconds?new Date(value.seconds*1000):new Date(value||0));return Number.isNaN(d.getTime())?'Just shared':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(d);}
function musicTime(t){return t.createdAt?.toMillis?.()||(t.createdAt?.seconds?t.createdAt.seconds*1000:new Date(t.createdAt||0).getTime())||0;}
function musicSorted(){return [...musicTracks].sort((a,b)=>musicTime(b)-musicTime(a));}
function musicCover(track){const url=track.thumbnailUrl||'';try{const parsed=new URL(url);if(parsed.protocol==='https:'&&(parsed.hostname==='i.scdn.co'||parsed.hostname==='image-cdn-ak.spotifycdn.com'))return `<img src="${escapeHtml(url)}" alt="Album artwork" loading="lazy">`;}catch{}return '<span aria-hidden="true">🎵</span>';}
function musicCard(track,owner){
  const label=owner==='Noémie'?"Noémie's current jam":"Joe's current jam";
  const avatar=escapeHtml(currentProfile(owner).avatarEmoji);
  if(!track)return `<article class="music-current-card empty-music"><div class="music-owner">${avatar} ${escapeHtml(label)}</div><div class="music-empty-art">♫</div><h3>Nothing shared yet</h3><p>There's a space here for ${escapeHtml(owner)}'s next favourite.</p></article>`;
  return `<article class="music-current-card"><div class="music-owner">${avatar} ${escapeHtml(label)}</div><div class="music-track-top"><div class="music-cover">${musicCover(track)}</div><div class="music-track-copy"><h3>${escapeHtml(track.title)}</h3><small>Shared ${escapeHtml(musicDate(track.createdAt))}</small></div></div>${track.note?`<p class="music-note">“${escapeHtml(track.note)}”</p>`:''}<button class="music-listen" data-music-play="${escapeHtml(track.id)}" type="button">▶ Listen on Spotify</button></article>`;
}
function renderMusic(){
  const current=$('music-current-grid');if(!current)return;
  // Keep the homepage total synced to live music snapshots and owner-only deletions.
  const homeTrackCount=$('kpi-music-tracks');if(homeTrackCount)homeTrackCount.textContent=musicTracks.length;
  const sorted=musicSorted(), joe=sorted.find(t=>t.ownerName==='Joe'),noemie=sorted.find(t=>t.ownerName==='Noémie');
  current.innerHTML=musicCard(noemie,'Noémie')+musicCard(joe,'Joe');
  $('music-current-count').textContent=`${Number(Boolean(joe))+Number(Boolean(noemie))} current ${joe&&noemie?'tracks':(joe||noemie)?'track':'tracks'}`;
  $('music-tab-current').classList.toggle('active',musicTab==='current');$('music-tab-collection').classList.toggle('active',musicTab==='collection');
  $('music-tab-current').setAttribute('aria-selected',String(musicTab==='current'));$('music-tab-collection').setAttribute('aria-selected',String(musicTab==='collection'));
  $('music-current-panel').hidden=musicTab!=='current';$('music-collection-panel').hidden=musicTab!=='collection';
  const collection=$('music-collection');
  collection.innerHTML=sorted.length?sorted.map(t=>`<button class="music-history-row" data-music-play="${escapeHtml(t.id)}" type="button"><span class="music-small-cover">${musicCover(t)}</span><span class="music-history-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.ownerName)} · ${escapeHtml(musicDate(t.createdAt))}</small>${t.note?`<em>${escapeHtml(t.note)}</em>`:''}</span><span class="music-history-play">▶</span></button>`).join(''):'<div class="music-collection-empty">No shared tracks yet. Your collection will grow as you share new jams. 🎧</div>';
  document.querySelectorAll('[data-music-play]').forEach(btn=>btn.onclick=()=>openMusicPlayer(btn.dataset.musicPlay));
  $('music-shuffle').disabled=!sorted.length;
}
function openMusicPlayer(id){const t=musicTracks.find(x=>x.id===id);if(!t)return;
  const url=musicTrackUrl(t.spotifyUrl);if(!url)return notify('This track link is unavailable.');
  $('music-player-title').textContent=t.title||'Spotify track';$('music-player-by').textContent=`Shared by ${t.ownerName}${t.note?' · '+t.note:''}`;
  const frame=document.createElement('iframe');frame.src=`https://open.spotify.com/embed/track/${musicTrackId(url)}?utm_source=generator`;
  frame.title='Spotify music player';frame.loading='lazy';frame.width='100%';frame.height='152';frame.style.border='0';frame.style.borderRadius='12px';
  frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';
  $('music-player-embed').replaceChildren(frame);$('music-player-link').href=url;
  musicOpenTrackId=t.id;
  $('music-delete-error').textContent='';
  $('music-delete-track').hidden=t.ownerUid!==USER_UIDS[currentUser];
  $('music-delete-track').disabled=false;
  $('music-player-modal').hidden=false;
}
function closeMusicPlayer(){musicOpenTrackId=null;$('music-player-modal').hidden=true;$('music-player-embed').replaceChildren();}
async function deleteMusicTrack(){
  if(musicDeleting||!musicOpenTrackId)return;
  const t=musicTracks.find(x=>x.id===musicOpenTrackId);
  if(!t||t.ownerUid!==USER_UIDS[currentUser])return notify('You can only delete tracks you shared.');
  if(!isDemo&&(!musicReady||!canWrite()))return notify('Music is not connected yet. Try again once synced.');
  if(!confirm(`Delete “${t.title}” from Our Music? This removes the share for both of you and cannot be undone.`))return;
  musicDeleting=true;
  const btn=$('music-delete-track');btn.disabled=true;btn.textContent='Deleting…';
  $('music-delete-error').textContent='';
  try{
    if(isDemo){musicTracks=musicTracks.filter(x=>x.id!==t.id);localStorage.setItem(musicDemoKey,JSON.stringify(musicTracks));renderMusic();}
    else await firestore.deleteDoc(firestore.doc(db,'musicTracks',t.id));
    closeMusicPlayer();notify('Track removed ✓');
  }catch(err){$('music-delete-error').textContent='Could not delete track: '+err.message;}
  finally{musicDeleting=false;btn.disabled=false;btn.textContent='Delete my share';}
}
async function musicMetadata(url){const response=await fetch('https://open.spotify.com/oembed?url='+encodeURIComponent(url));if(!response.ok)throw Error('Spotify artwork lookup unavailable');const data=await response.json();return {title:String(data.title||'Spotify track').slice(0,200),thumbnailUrl:String(data.thumbnail_url||'').startsWith('https://')?data.thumbnail_url:''};}
async function previewMusicLink(){const serial=++musicUrlInputSerial;musicPreviewData=null;const url=musicTrackUrl($('music-track-url').value);const el=$('music-preview');el.hidden=true;
  if(!url){$('music-form-feedback').textContent=$('music-track-url').value.trim()?'Paste a full Spotify track link (open.spotify.com/track/…).':'';return;}
  $('music-form-feedback').textContent='Finding the song and its artwork…';
  try{const meta=await musicMetadata(url);if(serial!==musicUrlInputSerial)return;musicPreviewData={spotifyUrl:url,...meta};
    el.innerHTML=`<span class="music-preview-cover">${musicCover(meta)}</span><span><strong>${escapeHtml(meta.title)}</strong><small>Spotify track found ✓</small></span>`;el.hidden=false;
    $('music-form-feedback').textContent='Ready to share.';
  }catch(err){if(serial!==musicUrlInputSerial)return;$('music-form-feedback').textContent='Could not load Spotify details. You can still share the link; Spotify will show its artwork in the player.';}
}
async function submitMusic(e){e.preventDefault();if(musicSaving)return;
  const url=musicTrackUrl($('music-track-url').value),note=$('music-track-note').value.trim();
  if(!url)return notify('Please paste a full Spotify track link.');
  if(!isDemo&&(!musicReady||!canWrite()))return notify('Music is not connected yet. Try again once synced.');
  musicSaving=true;$('music-share-save').disabled=true;$('music-share-save').textContent='Sharing…';
  try{
    let meta=(musicPreviewData?.spotifyUrl===url)?musicPreviewData:null;
    if(!meta){try{meta=await musicMetadata(url);}catch{meta={title:'Spotify track',thumbnailUrl:''};}}
    const record={ownerUid:USER_UIDS[currentUser],ownerName:currentUser,spotifyUrl:url,spotifyId:musicTrackId(url),title:meta.title,thumbnailUrl:meta.thumbnailUrl||'',note,createdAt:isDemo?new Date().toISOString():firestore.serverTimestamp()};
    if(isDemo){musicTracks.push({...record,id:crypto.randomUUID()});localStorage.setItem(musicDemoKey,JSON.stringify(musicTracks));renderMusic();}
    else await firestore.addDoc(firestore.collection(db,'musicTracks'),record);
    $('music-share-modal').hidden=true;notify('Shared your current jam 🎧');musicTab='current';renderMusic();
  }catch(err){$('music-form-feedback').textContent='Could not share track: '+err.message;}
  finally{musicSaving=false;$('music-share-save').disabled=false;$('music-share-save').textContent='Share track ↗';}
}
function loadDemoMusic(){try{const data=JSON.parse(localStorage.getItem(musicDemoKey)||'[]');musicTracks=Array.isArray(data)?data:[];}catch{musicTracks=[];}musicReady=true;renderMusic();}
function startMusicListener(){if(unsubscribeMusic)unsubscribeMusic();musicReady=false;
  unsubscribeMusic=firestore.onSnapshot(firestore.collection(db,'musicTracks'),{includeMetadataChanges:true},snap=>{
    musicTracks=snap.docs.map(doc=>({id:doc.id,...doc.data()}));musicReady=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;renderMusic();
  },err=>{musicReady=false;renderMusic();notify('Music could not load: '+err.message);});
}
function bindMusic(){
  $('music-tab-current').onclick=()=>{musicTab='current';renderMusic();};$('music-tab-collection').onclick=()=>{musicTab='collection';renderMusic();};
  $('music-share').onclick=()=>{$('music-share-form').reset();$('music-preview').hidden=true;$('music-form-feedback').textContent='';musicPreviewData=null;$('music-share-modal').hidden=false;};
  const closeShare=()=>{$('music-share-modal').hidden=true;musicUrlInputSerial++;};
  $('music-share-close').onclick=closeShare;$('music-share-cancel').onclick=closeShare;
  $('music-track-url').addEventListener('change',previewMusicLink);
  $('music-track-url').addEventListener('blur',()=>{if($('music-track-url').value.trim()&&!musicPreviewData)previewMusicLink();});
  $('music-share-form').onsubmit=submitMusic;
  $('music-player-close').onclick=closeMusicPlayer;
  $('music-delete-track').onclick=deleteMusicTrack;
  $('music-shuffle').onclick=()=>{if(!musicTracks.length)return;const arr=musicTracks;openMusicPlayer(arr[Math.floor(Math.random()*arr.length)].id);};
  ['music-player-modal','music-share-modal'].forEach(id=>$(id).onclick=e=>{if(e.target!==$(id))return;id==='music-player-modal'?closeMusicPlayer():closeShare();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMusicPlayer();closeShare();}});
}

async function main(){initMap();bindEvents();bindPlacesTo();navigate(location.hash==='#map'?'map':location.hash==='#music'?'music':'home');if(isDemo){$('preview').hidden=false;connectionStatus('Local preview');try{const stored=JSON.parse(localStorage.getItem(demoKey));pins=(Array.isArray(stored)?stored:STARTERS.map(p=>({...p}))).map(p=>p.id==='starter-norway'&&p.notes==='Northern lights and beautiful views, one day.'?{...p,notes:'fjords 😍😍😍'}:p);}catch{pins=STARTERS.map(p=>({...p}));}currentUser=localStorage.getItem('our-site-demo-user')||'Joe';$('demo-user').value=currentUser;$('identity').textContent=`Preview as ${currentUser}`;persistDemo();loadDemoPlacesTo();loadDemoMusic();$('own-profile-button').hidden=false;$('other-profile-button').hidden=false;startProfileListeners(USER_UIDS[currentUser]);refreshHome();openDeepLink();}else{try{await initFirebase();}catch(err){connectionStatus('Connection error');notify('Firebase failed to load: '+err.message);}}}


/* OUR PLACES TO — independent from the travel map, stored in /placesTo. */
let placesTo=[], unsubscribePlacesTo=null, placesToFresh=false, placesToTab='approved', placesToBusy=false;
const placesToIncoming=()=>placesTo.filter(p=>p.status==='suggested'&&p.addedBy!==currentUser);
let undoRecord=null,undoTimer=null;
function showUndo(p){undoRecord={...p};$('undo-label').textContent=`Removed “${p.name}”.`;$('undo-toast').hidden=false;clearTimeout(undoTimer);undoTimer=setTimeout(hideUndo,10000);}
function hideUndo(){undoRecord=null;$('undo-toast').hidden=true;clearTimeout(undoTimer);}
async function undoPlace(){const p=undoRecord;if(!p)return;const saved=await placesToWrite(async()=>{if(isDemo){const item=placesTo.find(x=>x.id===p.id);if(!item||item.status!=='deleted')throw Error('This idea was changed.');Object.assign(item,{status:p.status,joeStars:0,noemieStars:0});delete item.deletedBy;delete item.deletedFrom;saveDemoPlacesTo();}else await firestore.updateDoc(firestore.doc(db,'placesTo',p.id),{status:p.status,deletedBy:firestore.deleteField(),deletedFrom:firestore.deleteField()});});if(saved){hideUndo();notify('Restored ✓');}}
async function removePlace(p){if(!placesReady())return notify('Checklist not connected yet.');if(!confirm(`Remove “${p.name}” from both lists? Neither person is notified. You can undo straight afterwards.`))return;const previous={...p};const ok=await placesToWrite(async()=>{if(isDemo){Object.assign(p,{status:'deleted',deletedBy:currentUser,deletedFrom:p.status,joeStars:0,noemieStars:0});saveDemoPlacesTo();}else await firestore.updateDoc(firestore.doc(db,'placesTo',p.id),{status:'deleted',deletedBy:currentUser,deletedFrom:p.status,joeStars:0,noemieStars:0});});if(ok)showUndo(previous);}

// The existing Firestore fields are reused, so prior allocations above zero count as an upvote.
const myVoteKey=()=>currentUser==='Joe'?'joeStars':'noemieStars';
const hasVote=(p,key)=>Number(p[key]||0)>0;
const voteCount=p=>Number(hasVote(p,'joeStars'))+Number(hasVote(p,'noemieStars'));
const submittedAt=p=>{const value=p.createdAt?.toDate?.()|| (p.createdAt?.seconds?new Date(p.createdAt.seconds*1000):new Date(p.createdAt||0));return Number.isNaN(value.getTime())||!p.createdAt?'—':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(value);};
const submittedTime=p=>p.createdAt?.toMillis?.()||(p.createdAt?.seconds? p.createdAt.seconds*1000 : +new Date(p.createdAt||0))||0;
function placesReady(){return isDemo||(!placesToBusy&&placesToFresh&&canWrite());}
function placesToStatus(){const el=$('places-tab-help');if(!el)return;if(!isDemo&&!placesToFresh){el.textContent='Connecting to your private checklist… actions will be available once connected.';return;}el.textContent={approved:'Tap the heart on the ones you really want. Mutual favourites rise to the top.',suggested:'Ideas join our list when the other person is up for them. Being on the list is never a commitment.',done:'The ones we’ve ticked off together ✓'}[placesToTab];}
function setPlacesTab(tab){placesToTab=tab;document.querySelectorAll('.places-tab').forEach(b=>b.classList.toggle('active',b.dataset.listTab===tab));renderPlacesTo();}
function makePlaceButton(text,action,cls='secondary',disabled=false){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.disabled=disabled;b.onclick=action;if(cls==='mini-delete-btn'){b.title='Remove idea';b.setAttribute('aria-label','Remove idea');}return b;}
function renderPlacesTo(){
  if(!$('places-to-list'))return;
  const newest=(a,b)=>submittedTime(b)-submittedTime(a)||a.name.localeCompare(b.name);
  const approved=placesTo.filter(p=>p.status==='approved').sort((a,b)=>voteCount(b)-voteCount(a)||newest(a,b));
  const suggested=placesTo.filter(p=>p.status==='suggested').sort(newest);
  const done=placesTo.filter(p=>p.status==='done').sort(newest);
  $('approved-place-count').textContent=approved.length;
  $('suggested-place-count').textContent=suggested.length;
  $('done-place-count').textContent=done.length;
  $('places-surprise').disabled=!approved.length||dodoSpinning;
  placesToStatus();
  const records={approved,suggested,done}[placesToTab],root=$('places-to-list');
  root.replaceChildren();
  if(!records.length){
    const empty=document.createElement('div');empty.className='places-empty';
    empty.textContent={approved:'Nothing on our list yet — suggest your first idea 👀',suggested:'No suggestions waiting right now.',done:'Nothing ticked off yet. The best bits are still to come.'}[placesToTab];root.append(empty);
  }else{
    const wrap=document.createElement('div');wrap.className='places-table-wrap';
    const table=document.createElement('table');table.className='places-priority-table';
    const thead=document.createElement('thead');const hr=document.createElement('tr');
    const labels=placesToTab==='approved'?['#','Place','Submitted','Joe','Noémie','Most tempting','']:
      placesToTab==='suggested'?['Place','Submitted','Suggested by','Status']:['Place','Submitted','Status'];
    labels.forEach((label,i)=>{const th=document.createElement('th');th.textContent=label;if(placesToTab==='approved'&&i===0)th.className='rank-col';hr.append(th);});
    thead.append(hr);table.append(thead);
    const tbody=document.createElement('tbody');
    const cell=(row,value,cls='')=>{const td=document.createElement('td');td.className=cls;if(value instanceof Node)td.append(value);else td.textContent=value;row.append(td);return td;};
    records.forEach((p,i)=>{
      const tr=document.createElement('tr');tr.className='priority-row';
      if(placesToTab==='approved'){
        if(i===0&&voteCount(p)>0)tr.classList.add('top-priority');
        cell(tr,String(i+1),'rank-col');
        const nameCell=cell(tr,p.name,'priority-name');nameCell.title=p.notes||p.name;
        cell(tr,submittedAt(p),'submitted-date');
        for(const [key,person] of [['joeStars','Joe'],['noemieStars','Noémie']]){
          if(person===currentUser){
            const chosen=hasVote(p,key);const vote=makePlaceButton(chosen?'♥':'♡',()=>togglePlaceVote(p),`vote-btn ${chosen?'voted':''}`,!placesReady());
            vote.title=chosen?'Remove from my top picks':'One of my top picks';vote.setAttribute('aria-label',vote.title);vote.setAttribute('aria-pressed',String(chosen));
            cell(tr,vote,'vote-cell');
          }else{const label=document.createElement('span');label.className=hasVote(p,key)?'other-vote yes':'other-vote';label.textContent=hasVote(p,key)?'♥':'♡';label.title=hasVote(p,key)?person+' marked this as a top pick':person+' has not marked this as a top pick';cell(tr,label,'vote-cell');}
        }
        cell(tr,'😈'.repeat(voteCount(p)) || '—','score-cell');
        const actions=document.createElement('div');actions.className='compact-row-actions';
        actions.append(makePlaceButton('✓ Done',()=>markPlaceDone(p),'mini-done-btn',!placesReady()));
        actions.append(makePlaceButton('🗑️',()=>removePlace(p),'mini-delete-btn',!placesReady()));
        cell(tr,actions,'done-cell');
      }else if(placesToTab==='suggested'){
        const nameCell=cell(tr,p.name,'priority-name');nameCell.title=p.notes||p.name;
        cell(tr,submittedAt(p),'submitted-date');cell(tr,p.addedBy,'suggest-author');
        if(p.addedBy!==currentUser){const actions=document.createElement('div');actions.className='compact-decision';
          actions.append(makePlaceButton('I’m up for it ✓',()=>decidePlace(p,'approved'),'mini-approve-btn',!placesReady()));
          actions.append(makePlaceButton('Not for me',()=>decidePlace(p,'vetoed'),'mini-done-btn',!placesReady()));
          actions.append(makePlaceButton('🗑️',()=>removePlace(p),'mini-delete-btn',!placesReady()));cell(tr,actions,'decision-cell');
        }else{const controls=document.createElement('div');controls.className='compact-row-actions';controls.append(document.createTextNode(`Waiting for ${otherUser(currentUser)} `));controls.append(makePlaceButton('🗑️',()=>removePlace(p),'mini-delete-btn',!placesReady()));cell(tr,controls,'pending-cell');}
      }else{
        cell(tr,p.name,'priority-name');cell(tr,submittedAt(p),'submitted-date');const doneControls=document.createElement('div');doneControls.className='compact-row-actions';doneControls.append(document.createTextNode('✓ Completed '));doneControls.append(makePlaceButton('🗑️',()=>removePlace(p),'mini-delete-btn',!placesReady()));cell(tr,doneControls,'completed-cell');
      }
      tbody.append(tr);
    });
    table.append(tbody);wrap.append(table);root.append(wrap);
  }
  const count=incoming().length+placesToIncoming().length+pendingKisses().length;
  $('notifications-count').textContent=count;
  $('notifications-btn').classList.toggle('has-new',count>0);
  renderNotifications();refreshHome();
}
function loadDemoPlacesTo(){try{const data=JSON.parse(localStorage.getItem('our-places-to-demo'));placesTo=Array.isArray(data)?data:[];}catch{placesTo=[];}placesToFresh=true;renderPlacesTo();}
function saveDemoPlacesTo(){localStorage.setItem('our-places-to-demo',JSON.stringify(placesTo));renderPlacesTo();}
function startPlacesToListener(){if(unsubscribePlacesTo)unsubscribePlacesTo();placesToFresh=false;placesToStatus();unsubscribePlacesTo=firestore.onSnapshot(firestore.collection(db,'placesTo'),{includeMetadataChanges:true},snap=>{placesTo=snap.docs.map(d=>({id:d.id,...d.data()}));placesToFresh=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;renderPlacesTo();},err=>{placesToFresh=false;placesToStatus();notify('Checklist connection failed: '+err.message);});}
async function placesToWrite(operation,button){if(!placesReady()){notify('Checklist not connected. No changes were submitted.');return false;}placesToBusy=true;if(button){button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Saving…';}
  try{await operation();notify('Saved ✓');return true;}catch(err){notify('Could not save checklist: '+err.message);return false;}
  finally{placesToBusy=false;if(button){button.textContent=button.dataset.originalText||button.textContent;}renderPlacesTo();}
}
async function suggestPlaceTo(e){e.preventDefault();const name=$('places-idea-name').value.trim(),notes=$('places-idea-note').value.trim();if(!name)return;const b=$('places-suggest-save');const record={name,notes,addedBy:currentUser,status:'suggested',reviewedBy:'',joeStars:0,noemieStars:0,createdAt:new Date()};
  const ok=await placesToWrite(async()=>{if(isDemo){placesTo.push({...record,id:crypto.randomUUID()});saveDemoPlacesTo();}else await firestore.addDoc(firestore.collection(db,'placesTo'),{...record,createdAt:firestore.serverTimestamp()});},b);
  if(ok){$('places-suggest-modal').hidden=true;$('places-suggest-form').reset();setPlacesTab('suggested');}
}
async function decidePlace(p,status){const ok=await placesToWrite(async()=>{if(p.status!=='suggested'||p.addedBy===currentUser)throw Error('Only the other person can decide.');if(isDemo){Object.assign(p,{status,reviewedBy:currentUser});saveDemoPlacesTo();}else await firestore.updateDoc(firestore.doc(db,'placesTo',p.id),{status,reviewedBy:currentUser});});if(ok)setPlacesTab('approved');}
async function togglePlaceVote(p){
  const key=myVoteKey();const voted=hasVote(p,key);const next=voted?0:1;
  await placesToWrite(async()=>{
    if(isDemo){if(p.status!=='approved')throw Error('Only ideas on our list can be upvoted.');p[key]=next;saveDemoPlacesTo();return;}
    // A transaction avoids accidental overwrites if both people vote together.
    const ref=firestore.doc(db,'placesTo',p.id);
    await firestore.runTransaction(db,async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists()||snap.data().status!=='approved')throw Error('This idea is no longer on our list.');
      const current=Number(snap.data()[key]||0)>0;
      tx.update(ref,{[key]:current?0:1});
    });
  });
}
async function markPlaceDone(p){if(!confirm(`Tick off “${p.name}”? It’ll move to Done.`))return;
  const ok=await placesToWrite(async()=>{if(isDemo){Object.assign(p,{status:'done',joeStars:0,noemieStars:0});saveDemoPlacesTo();}else await firestore.updateDoc(firestore.doc(db,'placesTo',p.id),{status:'done',joeStars:0,noemieStars:0});});if(ok)setPlacesTab('done');
}
// Dodo wheel is purely visual: every approved, unfinished idea has equal odds.
// The label is derived from the wheel's *rendered rotation*, so it slows down
// alongside the wheel instead of cycling independently at a fixed speed.
let dodoSpinning=false,dodoRotation=0,dodoFrame=null,dodoTimeout=null;
function closeDodoResult(){$('dodo-result-modal').hidden=true;}
function chooseDodo(){
  if(dodoSpinning)return;
  const options=placesTo.filter(p=>p.status==='approved');
  if(!options.length)return notify('Add some ideas to our list first 👀');
  dodoSpinning=true;
  const btn=$('places-surprise');btn.disabled=true;btn.textContent='The dodo is thinking…';
  const wheel=$('dodo-wheel'),cycling=$('dodo-cycling'),n=options.length;
  const palette=['#e9b699','#e4dbc3','#b9d3c4','#d8c4db','#f2d9bc','#c7dce7'];
  wheel.style.background=`conic-gradient(${options.map((_,i)=>`${palette[i%palette.length]} ${i*100/n}% ${(i+1)*100/n}%`).join(',')})`;
  const selection=Math.floor(Math.random()*n),chosen=options[selection];
  const motionAllowed=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(dodoFrame!==null){cancelAnimationFrame(dodoFrame);dodoFrame=null;}
  if(dodoTimeout!==null){clearTimeout(dodoTimeout);dodoTimeout=null;}
  // A conic-gradient begins at 12 o'clock and runs clockwise. Read the
  // browser's current transform to determine which slice is under the pointer.
  const showCurrentSlice=()=>{
    const transform=getComputedStyle(wheel).transform;
    if(transform==='none')return;
    const matrix=new DOMMatrixReadOnly(transform);
    const angle=(Math.atan2(matrix.b,matrix.a)*180/Math.PI+360)%360;
    const pointerAngle=(360-angle)%360;
    const index=Math.min(n-1,Math.floor(pointerAngle/(360/n)));
    cycling.textContent=options[index].name;
  };
  cycling.textContent=options[0].name;
  if(motionAllowed){
    const targetAngle=-(selection+.5)*360/n;
    const delta=targetAngle-(dodoRotation%360);
    dodoRotation+=2160+((delta%360)+360)%360;
    wheel.style.transition='transform 3.1s cubic-bezier(.13,.65,.12,1)';
    // Make sure a previous spin's transform is committed before changing it.
    void wheel.offsetWidth;
    wheel.style.transform=`rotate(${dodoRotation}deg)`;
    const trackWheel=()=>{showCurrentSlice();dodoFrame=requestAnimationFrame(trackWheel);};
    dodoFrame=requestAnimationFrame(trackWheel);
  }else{
    wheel.style.transition='none';
    dodoRotation=-(selection+.5)*360/n;
    wheel.style.transform=`rotate(${dodoRotation}deg)`;
    cycling.textContent=chosen.name;
  }
  dodoTimeout=setTimeout(()=>{
    if(dodoFrame!==null){cancelAnimationFrame(dodoFrame);dodoFrame=null;}
    dodoTimeout=null;
    cycling.textContent=chosen.name;
    dodoSpinning=false;btn.textContent='Let the dodo decide ↗';
    btn.disabled=!placesTo.some(p=>p.status==='approved');
    $('dodo-result-name').textContent=chosen.name;
    $('dodo-result-modal').hidden=false;
  },motionAllowed?3250:150);
}
function bindPlacesTo(){$('undo-button').onclick=undoPlace;$('undo-dismiss').onclick=hideUndo;$('places-surprise').onclick=chooseDodo;$('dodo-result-close').onclick=closeDodoResult;$('dodo-result-again').onclick=()=>{closeDodoResult();chooseDodo();};$('dodo-result-modal').addEventListener('click',e=>{if(e.target===$('dodo-result-modal'))closeDodoResult();});document.querySelectorAll('.places-tab').forEach(b=>b.onclick=()=>setPlacesTab(b.dataset.listTab));$('places-suggest').onclick=()=>{if(!placesReady())return notify('Wait until the checklist is connected.');$('places-suggest-modal').hidden=false;};
  $('places-suggest-close').onclick=$('places-suggest-cancel').onclick=()=>$('places-suggest-modal').hidden=true;
  $('places-suggest-modal').addEventListener('click',e=>{if(e.target===$('places-suggest-modal'))e.target.hidden=true;});
  $('places-suggest-form').addEventListener('submit',suggestPlaceTo);
}

main();
