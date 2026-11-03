// 无头 Chrome（SwiftShader 软件 GL）截图 / 录制演示视频
// node scripts/shoot.mjs shots | demo | one "<query>" out.png steps
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';

const PORT = +(process.env.PORT || 4188);
const W = +(process.env.W || 960), Hh = +(process.env.H || 540);
const url = `http://localhost:${PORT}/`;
const server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { server.kill(); } };
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: Hh }, deviceScaleFactor: 1 });
page.setDefaultTimeout(600000);
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const mode = process.argv[2] || 'shots';
fs.mkdirSync('shots', { recursive: true });
const open = async (q = '') => { await page.goto(`${url}?capture&w=${W}&h=${Hh}${q}`); await page.waitForFunction(() => window.__ready, null, { timeout: 120000 }); };
const step = (n, dt = 1 / 30) => page.evaluate(([dt, n]) => window.__step(dt, n), [dt, n]);
try {
  if (mode === 'one') {
    // node scripts/shoot.mjs one "&time=night" out.png "js-before"
    await open(process.argv[3] || '');
    if (process.argv[6]) await page.evaluate(process.argv[6]);
    await step(+(process.argv[5] || 60));
    await page.screenshot({ path: process.argv[4] || 'shots/test.png' });
    console.log(JSON.stringify(await page.evaluate(() => window.__actors && window.__actors())));
  } else if (mode === 'shots') {
    const q = process.env.Q || '';
    const sfx = process.env.SFX || '';
    await open(q);
    await step(45);
    await page.screenshot({ path: `shots/overview${sfx}.png` });
    console.log('overview');
    // 近景 1：营地（煮饭、看书、瞭望、霓虹）
    await page.evaluate(() => { window.__player(10.6, -6.2); window.__follow(true); window.__camSet(11.0, 1.5, -8.5, 17); });
    await step(50);
    await page.screenshot({ path: `shots/closeup1${sfx}.png` });
    console.log('closeup1');
    // 近景 2：水淹广场（钓鱼、公交车）
    await page.evaluate(() => { window.__player(-10.2, 6.0); window.__camSet(-11.0, 0, 10.0, 17); });
    await step(50);
    await page.screenshot({ path: `shots/closeup2${sfx}.png` });
    console.log('closeup2');
    if (process.env.EXTRA) {
      await page.evaluate(() => { window.__player(14.0, 9.0); window.__camSet(13.5, 0.5, 10.5, 20); }); await step(40);
      await page.screenshot({ path: `shots/closeup3${sfx}.png` });
      await page.evaluate(() => { window.__player(-4.6, -9.5); window.__camSet(-9, 3, -15, 24); }); await step(40);
      await page.screenshot({ path: `shots/closeup4${sfx}.png` });
    }
  } else if (mode === 'demo') {
    const FPS = 30, SECS = +(process.env.SECS || 26), N = FPS * SECS, fdir = 'shots/frames';
    fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    await open(process.env.Q || '');
    await page.evaluate(() => { window.__player(1.5, 9.0); });
    await step(10);
    // 脚本：总览 3 秒 → 推近跟随 → 依次走过拾荒者、营地、坍塌塔楼前、栈桥钓鱼人
    const route = [[3.0, 'follow'], [3.3, 'goto', 11.5, 7.6], [7.2, 'goto', 10.4, -3.4], [10.2, 'goto', 10.6, -6.0], [13.0, 'goto', 1.2, -6.2], [16.0, 'goto', -1.5, 4.8], [18.5, 'goto', -11.0, 6.4], [21.4, 'goto', -11.3, 9.3], [24.5, 'view', 30]];
    let ri = 0;
    const t0 = Date.now();
    for (let f = 0; f < N; f++) {
      const t = f / FPS;
      while (ri < route.length && t >= route[ri][0]) {
        const r = route[ri++];
        await page.evaluate((r) => { if (r[1] === 'follow') window.__follow(true); if (r[1] === 'goto') window.__goto(r[2], r[3]); if (r[1] === 'view') window.__view(r[2]); }, r);
      }
      await step(1, 1 / FPS);
      await page.screenshot({ path: `${fdir}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93 });
      if (f % 60 === 0) { const s = await page.evaluate(() => window.__state()); console.log('frame', f, JSON.stringify(s), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
    }
    execSync(`ffmpeg -v error -y -framerate ${FPS} -i ${fdir}/%04d.jpg -c:v libx264 -crf ${process.env.CRF || 25} -preset slow -pix_fmt yuv420p -movflags +faststart shots/demo.mp4`);
    fs.rmSync(fdir, { recursive: true, force: true });
    console.log('demo done');
  }
} finally { await browser.close(); stopServer(); }
