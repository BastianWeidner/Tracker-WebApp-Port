const XN=0.95047, ZN=1.08883;
const lin=c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;
const gam=c=>{const v=Math.min(1,Math.max(0,c));return v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055};
const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116, fi=t=>t**3>0.008856?t**3:(t-16/116)/7.787;
function lch(hex){const r=lin(parseInt(hex.slice(1,3),16)/255),g=lin(parseInt(hex.slice(3,5),16)/255),b=lin(parseInt(hex.slice(5,7),16)/255);
const x=(0.4124*r+0.3576*g+0.1805*b)/XN,y=0.2126*r+0.7152*g+0.0722*b,z=(0.0193*r+0.1192*g+0.9505*b)/ZN;
const fx=f(x),fy=f(y),fz=f(z);const a=500*(fx-fy),bb=200*(fy-fz);let h=Math.atan2(bb,a)*180/Math.PI;if(h<0)h+=360;return [116*fy-16,Math.hypot(a,bb),h]}
function rgb(l,c,h){const rad=h*Math.PI/180,a=c*Math.cos(rad),b=c*Math.sin(rad);const fy=(l+16)/116,fx=fy+a/500,fz=fy-b/200;
const x=fi(fx)*XN,y=fi(fy),z=fi(fz)*ZN;const r=3.2406*x-1.5372*y-0.4986*z,g=-0.9689*x+1.8758*y+0.0415*z,bl=0.0557*x-0.2040*y+1.0570*z;
if([r,g,bl].some(v=>v<-1e-4||v>1+1e-4))return null;return '#'+[r,g,bl].map(v=>Math.round(gam(v)*255).toString(16).padStart(2,'0')).join('')}
function aus(l,c,h){if(l<=0)return'#000000';if(l>=100)return'#ffffff';let x=rgb(l,c,h);if(x)return x;let lo=0,hi=c;for(let i=0;i<16;i++){const m=(lo+hi)/2;if(rgb(l,m,h))lo=m;else hi=m}return rgb(l,lo,h)||'#808080'}
const [,c,h]=lch(process.argv[2]||'#E53935');
const L=(s,hh)=>t=>aus(t,s,hh);
const p=L(Math.max(c,24),h),s=L(Math.min(24,Math.max(12,c/3)),h),t=L(Math.min(36,Math.max(16,c/2)),(h+60)%360),n=L(5,h),nv=L(10,h);
const hell={primary:p(40),'on-primary':p(100),'primary-container':p(90),'on-primary-container':p(10),secondary:s(40),'secondary-container':s(90),'on-secondary-container':s(10),tertiary:t(40),'tertiary-container':t(90),'on-tertiary-container':t(10),background:n(98),'on-surface':n(10),'surface-variant':nv(90),'on-surface-variant':nv(30),outline:nv(50),'outline-variant':nv(80),'surface-container-low':n(96),'surface-container':n(94),'surface-container-high':n(92),'surface-container-highest':n(90),error:'#ba1a1a','error-container':'#ffdad6','on-error-container':'#410002'};
const dunkel={primary:p(80),'on-primary':p(20),'primary-container':p(30),'on-primary-container':p(90),secondary:s(80),'secondary-container':s(30),'on-secondary-container':s(90),tertiary:t(80),'tertiary-container':t(30),'on-tertiary-container':t(90),background:n(6),'on-surface':n(90),'surface-variant':nv(30),'on-surface-variant':nv(80),outline:nv(60),'outline-variant':nv(30),'surface-container-low':n(10),'surface-container':n(12),'surface-container-high':n(17),'surface-container-highest':n(22),error:'#ffb4ab','error-container':'#93000a','on-error-container':'#ffdad6'};
const css=o=>Object.entries(o).map(([k,v])=>`  --${k}: ${v};`).join('\n');
console.log(`:root {\n${css(hell)}\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n${css(dunkel).replace(/^/gm,'  ')}\n  }\n}`);
