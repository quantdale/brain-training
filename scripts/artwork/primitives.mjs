/** Build-time SVG vocabulary: matte faces, small hard contact shadow, exact geometry.
 * Coordinates are in the single 320×200 design space. Words/numerals are native
 * overlays, never baked into generated raster art. No runtime SVG filters.
 */
export const PIGMENTS = {
  memory: ['#C43C78', '#F5A8CB', '#8C2755'], attention: ['#E87837', '#FFC18C', '#A44C24'],
  speed: ['#E5AE23', '#FFE397', '#A57512'], math: ['#4D8DE4', '#B4D2FF', '#285CAA'],
  language: ['#30A9C5', '#A9E7EF', '#17748D'], logic: ['#28AC99', '#A0E4D7', '#13786E'],
  flexibility: ['#9962D4', '#D7B7F3', '#653D99'], spatial: ['#38A86B', '#AAE5BD', '#217A49'],
};
export const INK = '#17243B';
export const PAPER = '#F8FBFF';
export const MUTE = '#BDD0DF';
export function escape(s) { return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'); }
export function rect(x,y,w,h,fill=PAPER,r=10,extra='') { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`; }
export function line(x1,y1,x2,y2,color=INK,width=3,extra='') { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`; }
export function path(d,fill='none',stroke=INK,width=3,extra='') { return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`; }
export function circle(x,y,r,fill=PAPER,extra='') {return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;}
export function group(body,transform='',extra='') {return `<g transform="${transform}" ${extra}>${body}</g>`;}
export function arrow(x1,y1,x2,y2,color=INK,width=4) {
  const a=Math.atan2(y2-y1,x2-x1),s=10;
  return line(x1,y1,x2,y2,color,width)+path(`M${x2-s*Math.cos(a-.6)} ${y2-s*Math.sin(a-.6)} L${x2} ${y2} L${x2-s*Math.cos(a+.6)} ${y2-s*Math.sin(a+.6)}`,'none',color,width);
}
export function tile(x,y,w,h,fill=PAPER,r=10) {
  return rect(x,y+5,w,h,INK,r,'opacity=".14"')+rect(x,y,w,h,fill,r)+rect(x+2,y+2,w-4,Math.min(6,h/4),'#FFFFFF',r,'opacity=".35"');
}
export function disc(x,y,r,fill) {return circle(x,y+5,r,INK,'opacity=".14"')+circle(x,y,r,fill)+path(`M${x-r*.65} ${y-r*.35} Q${x} ${y-r*.9} ${x+r*.6} ${y-r*.4}`,'none','#FFFFFF',3,'opacity=".4"');}
export function symbol(kind,x,y,s,fill=INK) {
  if(kind==='circle') return circle(x,y,s/2,fill);
  if(kind==='square') return rect(x-s/2,y-s/2,s,s,fill,4);
  if(kind==='triangle') return path(`M${x} ${y-s*.56} L${x+s*.54} ${y+s*.44} L${x-s*.54} ${y+s*.44}Z`,fill,fill,1);
  if(kind==='diamond') return path(`M${x} ${y-s*.6} L${x+s*.5} ${y} L${x} ${y+s*.6} L${x-s*.5} ${y}Z`,fill,fill,1);
  if(kind==='star') {
    const pts=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=s*(i%2?.23:.53);return `${x+Math.cos(a)*r},${y+Math.sin(a)*r}`;});
    return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
  }
  return '';
}
export function grid(x,y,cols,rows,cell,active=[],fill='#C43C78',gap=4) {
  return Array.from({length:cols*rows},(_,i)=>tile(x+(i%cols)*(cell+gap),y+Math.floor(i/cols)*(cell+gap),cell,cell,active.includes(i)?fill:PAPER,4)).join('');
}
export function label(x,y,text,size=24,color=INK,extra={}) { return {x,y,text,size,color,...extra}; }
export function scene(svg,labels=[]) { return {svg,labels}; }
export function svgDocument(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 320 200">${body}</svg>`;
}
