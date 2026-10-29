import { fmtDate } from "@/lib/api";

const toDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Self-contained interactive flip-book (works offline in any browser).
export async function buildFlipbookHtml(pages, blobs, name) {
  const logo = await toDataUrl(await (await fetch("/logo-mark.png")).blob()).catch(() => "");
  const items = [];
  for (const p of pages) if (blobs[p.id]) items.push({ t: p.title || "Player card", s: p.sport || "", d: fmtDate(p.created_at), src: await toDataUrl(blobs[p.id]) });
  const data = JSON.stringify(items).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} · FlexoCards Storybook</title><style>
*{box-sizing:border-box;margin:0}body{background:#060b1a;color:#fff;font-family:system-ui,Segoe UI,Arial,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;overflow:hidden}
h1{font-style:italic;font-weight:900;letter-spacing:-1px;font-size:28px;margin-bottom:16px}h1 b{color:#f5b400}
.stage{perspective:2200px;width:min(900px,100%)}.book{display:flex;height:min(72vh,640px);border-radius:14px;box-shadow:0 30px 60px rgba(0,0,0,.5)}
.pg{flex:1;background:#f7f3ea;color:#0b1a3a;display:flex;flex-direction:column;padding:18px;min-width:0}.pg:first-child{border-radius:14px 0 0 14px;box-shadow:inset -18px 0 24px -18px rgba(0,0,0,.35)}.pg:last-child{border-radius:0 14px 14px 0}
.pg .im{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}.pg img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;filter:drop-shadow(0 12px 20px rgba(0,0,0,.25))}
.cap{border-top:1px solid #cbd5e1;margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;gap:8px}.cap b{text-transform:uppercase;font-size:18px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cap small{color:#64748b;font-size:12px}
.cover{background:#0b1a3a;color:#fff;align-items:center;justify-content:center;text-align:center}.cover img{width:110px;height:110px}.cover p{color:#f5b400;letter-spacing:.35em;font-size:11px;margin-top:14px}.cover h2{font-size:40px;font-weight:900;text-transform:uppercase;margin-top:6px}.cover span{color:#cbd5e1;font-size:14px;margin-top:8px}
.blank{background:linear-gradient(90deg,#0b1a3a,#13265a)}.next{transform-origin:left;animation:n .55s cubic-bezier(.2,.7,.2,1)}.prev{transform-origin:right;animation:p .55s cubic-bezier(.2,.7,.2,1)}
@keyframes n{from{transform:rotateY(-28deg) translateX(4%);opacity:.2}}@keyframes p{from{transform:rotateY(28deg) translateX(-4%);opacity:.2}}
.nav{display:flex;gap:14px;align-items:center;margin-top:18px}button{width:48px;height:48px;border-radius:50%;border:1px solid #334155;background:transparent;color:#fff;font-size:22px;cursor:pointer}button:hover{background:#f5b400;color:#0b1a3a}button:disabled{opacity:.3}
.pos{font-size:12px;color:#94a3b8;min-width:120px;text-align:center}footer{margin-top:14px;font-size:11px;color:#64748b}
@media(max-width:820px){.pg.hide-m{display:none}.pg:last-child,.pg:first-child{border-radius:14px}}
</style></head><body><h1>Flexo<b>Cards</b></h1><div class="stage"><div class="book" id="book"></div></div>
<div class="nav"><button id="pv" aria-label="Previous">&#8249;</button><span class="pos" id="pos"></span><button id="nx" aria-label="Next">&#8250;</button></div>
<footer>${esc(name)} · Made with FlexoCards · Buddy Innovations and Technologies Private Limited</footer>
<script>
const P=${data},LOGO=${JSON.stringify(logo)},NAME=${JSON.stringify(esc(name))};const items=[null,...P];
let wide=innerWidth>820,i=0;const total=()=>wide?1+Math.ceil((items.length-1)/2):items.length;
const page=(idx)=>{if(idx===-1)return '<div class="pg blank"></div>';const it=items[idx];if(it===undefined)return '<div class="pg"></div>';
if(it===null)return '<div class="pg cover">'+(LOGO?'<img src="'+LOGO+'" alt="">':'')+'<p>FLEXOCARDS</p><h2>My Storybook</h2><span>'+NAME+'</span><span>'+P.length+' cards</span></div>';
return '<div class="pg"><div class="im"><img src="'+it.src+'" alt=""></div><div class="cap"><div style="min-width:0"><b></b><small></small></div><small>'+idx+'</small></div></div>';};
function render(dir){const b=document.getElementById('book');const ids=wide?(i===0?[-1,0]:[2*i-1,2*i]):[i];b.innerHTML=ids.map(page).join('');
b.querySelectorAll('.cap').forEach((c,k)=>{const it=items[ids.filter(x=>x>0&&items[x])[k]];if(it){c.querySelector('b').textContent=it.t;c.querySelector('div small').textContent=it.s+' · '+it.d;}});
b.className='book '+(dir||'');void b.offsetWidth;document.getElementById('pos').textContent=i===0?'Cover':'Page '+ids.filter(x=>x>0&&items[x]).join('–')+' of '+P.length;
document.getElementById('pv').disabled=i===0;document.getElementById('nx').disabled=i>=total()-1;}
const go=d=>{const n=Math.min(Math.max(0,i+d),total()-1);if(n!==i){i=n;render(d>0?'next':'prev');}};
document.getElementById('pv').onclick=()=>go(-1);document.getElementById('nx').onclick=()=>go(1);
addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1);});
let sx=null;addEventListener('touchstart',e=>{sx=e.touches[0].clientX});addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>50)go(dx<0?1:-1);});
addEventListener('resize',()=>{const w=innerWidth>820;if(w!==wide){wide=w;i=0;render();}});render();
</script></body></html>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = `flexocards-flipbook-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return items.length;
}
