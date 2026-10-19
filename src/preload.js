const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('ghost',{
  onTabs:fn=>ipcRenderer.on('tabs',(_,state)=>fn(state)),
  newTab:url=>ipcRenderer.invoke('new-tab',url),activate:i=>ipcRenderer.invoke('activate',i),close:i=>ipcRenderer.invoke('close',i),go:url=>ipcRenderer.invoke('go',url),nav:action=>ipcRenderer.invoke('nav',action),
  extensions:()=>ipcRenderer.invoke('extensions'),installId:id=>ipcRenderer.invoke('install-id',id),installFolder:()=>ipcRenderer.invoke('install-folder'),removeExtension:id=>ipcRenderer.invoke('remove-extension',id)
});
