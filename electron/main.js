// Spindledeep — Electron shell.
// Serves app/ over a privileged app:// scheme (secure context for WebGPU, clean ES modules),
// keeps the window at 16:9-friendly size, and offers a headless smoke mode for checks:
//   electron . --smoke=out.png [--smoke-script=file.js]   (renders, captures, quits)
const { app, BrowserWindow, protocol, net, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const APP_DIR = path.join(__dirname, '..', 'app');
const arg = (k) => { const a = process.argv.find((s) => s.startsWith('--' + k)); return a ? (a.split('=')[1] ?? true) : null; };
const SMOKE = arg('smoke');
const DEV = !!arg('dev');
// test runs keep their own profile (settings, save) so they never touch the player's save
if (SMOKE) app.setPath('userData', path.join(app.getPath('temp'), 'spindledeep-smoke'));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (SMOKE) {
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
}

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
// the run in progress: written by the main process straight to disk (atomically) every time the game saves,
// so it survives a crash or a killed process; localStorage is only a fallback/migration source
const savePath = () => path.join(app.getPath('userData'), 'save.json');
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); } catch { return {}; } }

function createWindow() {
  const s = readSettings();
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.min(1600, wa.width - 80), h = Math.round(w * 9 / 16);
  const win = new BrowserWindow({
    width: w, height: h, minWidth: 960, minHeight: 540,
    backgroundColor: '#07060a', autoHideMenuBar: true, show: false, skipTaskbar: !!SMOKE, focusable: !SMOKE,
    title: 'Spindledeep', icon: path.join(__dirname, '..', 'build', 'icon.png'),
    fullscreen: !SMOKE && s.fullscreen !== false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false, offscreen: false, paintWhenInitiallyHidden: true,
    },
  });
  win.setMenuBarVisibility(false);
  if (SMOKE) win.webContents.setAudioMuted(true);
  // test runs (--smoke) must not be noticeable: the window is fully transparent, shown without activation (a never-shown
  // window pauses requestAnimationFrame, so the game loop would not run), not focusable, off the taskbar, and muted
  if (SMOKE) win.once('ready-to-show', () => { win.setOpacity(0); win.setIgnoreMouseEvents(true); win.showInactive(); });
  else win.once('ready-to-show', () => win.show());
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
    if (DEV && input.key === 'F12') win.webContents.toggleDevTools();
  });
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));
  const q = new URLSearchParams();
  if (SMOKE) q.set('smoke', '1');
  if (DEV) q.set('dev', '1');
  win.loadURL('app://game/index.html' + (q.toString() ? '?' + q : ''));
  win.webContents.on('console-message', (_e, level, msg) => { if (SMOKE || DEV) console.log('[renderer]', msg); });
  if (SMOKE) runSmoke(win);
  return win;
}

async function runSmoke(win) {
  const out = typeof SMOKE === 'string' ? SMOKE : 'smoke.png';
  const script = arg('smoke-script');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  win.webContents.once('did-finish-load', async () => {
    try {
      for (let i = 0; i < 120; i++) {
        const ok = await win.webContents.executeJavaScript('window.__SD && window.__SD.ready === true').catch(() => false);
        if (ok) break;
        await wait(250);
      }
      const shots = arg('shots');
      if (shots && shots !== true) {
        // [{ js, wait, out }]: run, wait, capture — one window, many pictures
        for (const s of JSON.parse(fs.readFileSync(shots, 'utf8'))) {
          if (s.js) await win.webContents.executeJavaScript(s.js).catch((e) => console.log('shot js error', e.message));
          await wait(s.wait ?? 1500);
          if (s.out) { const im = await win.webContents.capturePage(); fs.writeFileSync(s.out, im.toPNG()); }
          if (s.log) console.log('LOG', await win.webContents.executeJavaScript(s.log).catch((e) => e.message));
        }
      } else {
        if (script && script !== true) {
          const code = fs.readFileSync(script, 'utf8');
          await win.webContents.executeJavaScript(code);
        } else await wait(2500);
        const img = await win.webContents.capturePage();
        fs.writeFileSync(out, img.toPNG());
      }
      const err = await win.webContents.executeJavaScript('window.__SD ? window.__SD.errors.join("\\n") : "no __SD"');
      console.log(err ? 'SMOKE ERRORS\n' + err : 'SMOKE OK');
    } catch (e) { console.log('SMOKE FAIL', e); }
    app.quit();
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(APP_DIR, rel));
    if (!file.startsWith(APP_DIR)) return new Response('forbidden', { status: 403 });
    if (!fs.existsSync(file)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:set', (_e, s) => { fs.writeFileSync(settingsPath(), JSON.stringify(s)); return true; });
  ipcMain.handle('app:quit', () => app.quit());
  ipcMain.on('save:read', (e) => { try { e.returnValue = fs.readFileSync(savePath(), 'utf8'); } catch { e.returnValue = null; } });
  ipcMain.on('save:write', (e, txt) => {
    try { fs.mkdirSync(path.dirname(savePath()), { recursive: true }); fs.writeFileSync(savePath() + '.tmp', txt); fs.renameSync(savePath() + '.tmp', savePath()); e.returnValue = true; }
    catch (err) { console.error('save failed', err); e.returnValue = false; }
  });
  ipcMain.on('save:clear', (e) => { try { fs.rmSync(savePath(), { force: true }); } catch { /* ignore */ } e.returnValue = true; });
  ipcMain.handle('app:fullscreen', (e, v) => { const w = BrowserWindow.fromWebContents(e.sender); w.setFullScreen(v); });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
