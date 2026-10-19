const { app, BrowserWindow, BrowserView, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');

let win, tabs = [], active = -1;
const TOP = 90;
const store = () => path.join(app.getPath('userData'), 'extensions');
const stateFile = () => path.join(app.getPath('userData'), 'state.json');
function readState() { try { return JSON.parse(fs.readFileSync(stateFile(),'utf8')); } catch { return {}; } }
function saveState(data) { fs.writeFileSync(stateFile(), JSON.stringify({...readState(),...data},null,2)); }
function send() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('tabs', {active, tabs:tabs.map((t,i)=>({id:i,title:t.title,url:t.url,loading:t.loading}))});
}
function layout() { if (!win) return; const [w,h]=win.getContentSize(); for (const [i,t] of tabs.entries()) t.view.setBounds(i===active?{x:0,y:TOP,width:w,height:Math.max(100,h-TOP)}:{x:0,y:TOP,width:0,height:0}); }
function normalize(input) {
  input = String(input||'').trim();
  if (!input) return 'https://www.google.com/';
  if (/^https?:\/\//i.test(input)) return input;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(input)) return 'http://'+input;
  if (/^[^\s]+\.[a-z]{2,}([/:?].*)?$/i.test(input)) return 'https://'+input;
  return 'https://www.google.com/search?q='+encodeURIComponent(input);
}
function newTab(url='https://www.google.com/') {
  const view = new BrowserView({webPreferences:{partition:'persist:ghost',contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const tab={view,title:'New Tab',url,loading:false};
  tabs.push(tab); const idx=tabs.length-1;
  const wc=view.webContents;
  wc.setWindowOpenHandler(({url})=>{newTab(url);return {action:'deny'};});
  wc.on('page-title-updated',(_,title)=>{tab.title=title;send();});
  wc.on('did-start-loading',()=>{tab.loading=true;send();});
  wc.on('did-stop-loading',()=>{tab.loading=false;send();});
  wc.on('did-navigate',(_,url)=>{tab.url=url;send();});
  wc.on('did-navigate-in-page',(_,url)=>{tab.url=url;send();});
  wc.on('render-process-gone',()=>{tab.title='Tab crashed';send();});
  wc.loadURL(normalize(url)).catch(()=>{});
  activate(idx);
}
function activate(i) { if(i<0||i>=tabs.length)return; if(active>=0)win.removeBrowserView(tabs[active].view); active=i;win.addBrowserView(tabs[i].view);layout();send(); }
function closeTab(i) {if(i<0||i>=tabs.length)return;const t=tabs[i];win.removeBrowserView(t.view);tabs.splice(i,1);t.view.webContents.close();if(!tabs.length){active=-1;newTab();return;}if(active===i){active=-1;activate(Math.min(i,tabs.length-1));}else{if(i<active)active--;layout();send();}}
function download(url,limit=60*1024*1024,redirects=4) {return new Promise((resolve,reject)=>{
  if(redirects<0)return reject(Error('Too many redirects'));
  https.get(url,{headers:{'User-Agent':'Mozilla/5.0'}},res=>{
    if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();return download(new URL(res.headers.location,url).toString(),limit,redirects-1).then(resolve,reject);}
    if(res.statusCode!==200){res.resume();return reject(Error('Download returned HTTP '+res.statusCode));}
    const chunks=[];let size=0;res.on('data',c=>{size+=c.length;if(size>limit){res.destroy(Error('Extension exceeds size limit'));return;}chunks.push(c);});res.on('end',()=>resolve(Buffer.concat(chunks)));res.on('error',reject);
  }).on('error',reject);
});}
function unzipCrx(buffer,destination){
  if(buffer.toString('ascii',0,4)!=='Cr24')throw Error('Not a CRX file');
  const version=buffer.readUInt32LE(4);let offset;
  if(version===3)offset=12+buffer.readUInt32LE(8);
  else if(version===2)offset=16+buffer.readUInt32LE(8)+buffer.readUInt32LE(12);
  else throw Error('Unsupported CRX version');
  const zip=new AdmZip(buffer.subarray(offset));
  for(const entry of zip.getEntries()){
    const target=path.resolve(destination,entry.entryName);
    if(!target.startsWith(path.resolve(destination)+path.sep)&&target!==path.resolve(destination))throw Error('Unsafe ZIP path');
  }
  zip.extractAllTo(destination,true);
}
async function loadSavedExtensions(){
  fs.mkdirSync(store(),{recursive:true});
  for(const dir of fs.readdirSync(store())){
    const full=path.join(store(),dir);
    if(fs.existsSync(path.join(full,'manifest.json'))){try{await session.fromPartition('persist:ghost').loadExtension(full,{allowFileAccess:false});}catch(e){console.warn('Extension failed:',dir,e.message);}}
  }
}
async function installWebStore(id){
  if(!/^[a-p]{32}$/.test(id))throw Error('Enter a valid 32-character Chrome extension ID');
  const url='https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0.0.0&acceptformat=crx3&x='+encodeURIComponent('id='+id+'&installsource=ondemand&uc');
  const bytes=await download(url);
  const dest=path.join(store(),id);const tmp=dest+'-tmp';
  fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp,{recursive:true});
  try{unzipCrx(bytes,tmp);if(!fs.existsSync(path.join(tmp,'manifest.json')))throw Error('No extension manifest found');
    fs.rmSync(dest,{recursive:true,force:true});fs.renameSync(tmp,dest);
    const ext=await session.fromPartition('persist:ghost').loadExtension(dest);
    return {name:ext.name,id:ext.id};
  }catch(e){fs.rmSync(tmp,{recursive:true,force:true});throw e;}
}
app.whenReady().then(async()=>{
  const ses=session.fromPartition('persist:ghost');
  ses.setPermissionRequestHandler((wc,permission,callback)=>callback(['clipboard-sanitized-write','fullscreen'].includes(permission)));
  await loadSavedExtensions();
  win=new BrowserWindow({width:1250,height:820,minWidth:700,minHeight:450,title:'Ghost Browser',backgroundColor:'#111318',titleBarStyle:'hiddenInset',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await win.loadFile(path.join(__dirname,'ui.html'));
  win.on('resize',layout);
  newTab(readState().home||'https://www.google.com/');
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)app.whenReady().then(()=>newTab());});
ipcMain.handle('new-tab',(_,url)=>newTab(url));
ipcMain.handle('activate',(_,i)=>activate(i));
ipcMain.handle('close',(_,i)=>closeTab(i));
ipcMain.handle('go',(_,url)=>tabs[active]?.view.webContents.loadURL(normalize(url)));
ipcMain.handle('nav',(_,action)=>{const wc=tabs[active]?.view.webContents;if(!wc)return;if(action==='back'&&wc.canGoBack())wc.goBack();if(action==='forward'&&wc.canGoForward())wc.goForward();if(action==='reload')wc.reload();});
ipcMain.handle('extensions',()=>session.fromPartition('persist:ghost').getAllExtensions().map(e=>({id:e.id,name:e.name,version:e.version})));
ipcMain.handle('install-id',async(_,id)=>installWebStore(String(id).trim()));
ipcMain.handle('install-folder',async()=>{const result=await dialog.showOpenDialog(win,{properties:['openDirectory']});if(result.canceled)return null;return session.fromPartition('persist:ghost').loadExtension(result.filePaths[0]);});
ipcMain.handle('remove-extension',(_,id)=>{session.fromPartition('persist:ghost').removeExtension(id);return true;});
