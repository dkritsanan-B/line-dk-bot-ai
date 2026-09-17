import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const designsDir = path.join(root, 'designs');
const outDir = path.join(root, 'out');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 2500, height: 1686 }, deviceScaleFactor: 1 });
  for (const name of ['a', 'b', 'c']) {
    await page.goto(pathToFileURL(path.join(designsDir, `${name}.html`)).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const areas = JSON.parse(await readFile(path.join(designsDir, `${name}.areas.json`), 'utf8'));
    const boxes = await page.locator('.btn').evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    if (areas.length !== 6 || boxes.length !== 6) throw new Error(`${name}: expected exactly 6 areas and 6 buttons`);
    for (let index = 0; index < 6; index++) {
      const expected = areas[index];
      const actual = boxes[index];
      for (const key of ['x', 'y', 'width', 'height']) {
        if (expected[key] !== actual[key]) throw new Error(`${name}: button ${index + 1} ${key} is ${actual[key]}, expected ${expected[key]}`);
      }
    }
    const areaSum = areas.reduce((sum, area) => sum + area.width * area.height, 0);
    if (areaSum !== 2500 * 1686) throw new Error(`${name}: areas do not cover the full image`);
    for (let left = 0; left < areas.length; left++) {
      for (let right = left + 1; right < areas.length; right++) {
        const a = areas[left], b = areas[right];
        const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        if (overlap) throw new Error(`${name}: areas ${left + 1} and ${right + 1} overlap`);
      }
    }
    const raw = await page.screenshot({ type: 'png' });
    const jpgPath = path.join(outDir, `${name}.jpg`);
    await sharp(raw)
      .jpeg({ quality: 88, chromaSubsampling: '4:2:0', progressive: true, mozjpeg: true })
      .toFile(jpgPath);

    const menu = await readFile(jpgPath);
    const menuData = `data:image/jpeg;base64,${menu.toString('base64')}`;
    const preview = await browser.newPage({ viewport: { width: 400, height: 760 }, deviceScaleFactor: 1 });
    await preview.setContent(`<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
      @font-face{font-family:Lee;src:url("file:///C:/Windows/Fonts/LeelawUI.ttf")}*{box-sizing:border-box}
      html,body{margin:0;width:400px;height:760px;overflow:hidden;font-family:Lee,"Leelawadee UI",sans-serif;background:#dce8e3}
      .top{height:58px;background:#354e45;color:#fff;display:flex;align-items:center;padding:0 18px;font-size:18px;font-weight:700;box-shadow:0 2px 5px #0003}.back{font-size:28px;margin-right:14px}.dot{margin-left:auto}
      .chat{height:432px;padding:28px 18px;background:linear-gradient(#dce8e3,#e7efec)}
      .bubble{max-width:275px;background:#fff;border-radius:8px;padding:12px 15px;margin:0 0 16px 42px;color:#263b34;font-size:14px;box-shadow:0 1px 2px #0002}
      .bubble.me{margin-left:auto;background:#9fe870}.hint{text-align:center;color:#60756d;font-size:12px;margin-top:80px}
      .menu{display:block;width:400px;height:auto;border-top:2px solid #9baaa5}.label{position:absolute;top:467px;width:100%;text-align:center;color:#72847e;font-size:11px}
    </style></head><body><div class="top"><span class="back">‹</span>DK Steel and Tools <span class="dot">•••</span></div><div class="chat"><div class="bubble">สวัสดีครับ ต้องการดูสินค้าอะไรครับ</div><div class="bubble me">ขอเช็คแต้มสมาชิกครับ</div><div class="hint">จำลองการแสดงผลใน LINE ที่ความกว้าง 400px</div></div><div class="label">เมนู</div><img class="menu" src="${menuData}"></body></html>`, { waitUntil: 'load' });
    await preview.evaluate(() => document.fonts.ready);
    await preview.locator('.menu').evaluate(image => image.complete && image.naturalWidth > 0);
    await preview.screenshot({ path: path.join(outDir, `${name}-phone.png`), type: 'png' });
    await preview.close();
  }
} finally {
  await browser.close();
}

console.log('Rendered a, b, c at 2500×1686 plus 400px phone previews.');
