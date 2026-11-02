import { RainModel } from './rain-model.js';

const width = 1672;
const height = 941;
// Night's approved still is visibly wet; this is a separate authored intensity.
const climate = { rainy:1, overcast:0, sunny:0, golden:0, night:.45 };

export class WindowRain {
  static async create(options) {
    const image = new Image();
    image.src = '/assets/contact/stillflow/window-apertures.svg';
    await image.decode();
    return new WindowRain({ ...options, image });
  }

  constructor({ stage, player, image, seed = 42, enabled = false }) {
    this.stage = stage;
    this.player = player;
    this.image = image;
    this.enabled = enabled;
    this.multiplier = 1;
    this.life = new AbortController();
    this.mobile = matchMedia('(max-width: 840px)');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sf-rain';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.hidden = !enabled;
    this.context = this.canvas.getContext('2d');
    if (!this.context) throw new Error('Canvas 2D unavailable');
    this.mask = document.createElement('canvas');
    this.maskContext = this.mask.getContext('2d');
    const source = document.createElement('canvas');
    source.width = width; source.height = height;
    const sourceContext = source.getContext('2d', { willReadFrequently:true });
    sourceContext.drawImage(image, 0, 0);
    const rgba = sourceContext.getImageData(0, 0, width, height).data;
    this.apertures = new Uint8Array(width * height);
    for (let index=0; index<this.apertures.length; index++) this.apertures[index]=rgba[index*4+3];
    this.sprite = this.makeDrop();
    this.model = new RainModel({ seed, contains:(x,y)=>this.contains(x,y), limit:this.mobile.matches ? 45 : 150 });
    this.frames = 0;
    this.costs = [];
    this.accumulator = 0;
    stage.append(this.canvas);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(stage);
    for (const element of document.querySelectorAll('.contact-intro,.contact-dock')) this.observer.observe(element);
    window.addEventListener('resize', () => this.resize(), { signal:this.life.signal });
    this.intersection = new IntersectionObserver(entries => { this.offscreen = !entries[0].isIntersecting; this.sync(); });
    this.intersection.observe(stage);
    this.resize();
    this.sync();
  }

  makeDrop() {
    const sprite = document.createElement('canvas'); sprite.width=32; sprite.height=42;
    const c = sprite.getContext('2d');
    c.beginPath(); c.moveTo(16,4); c.bezierCurveTo(26,10,29,30,18,37); c.bezierCurveTo(5,39,5,19,16,4);
    const gradient = c.createLinearGradient(7,8,26,35);
    gradient.addColorStop(0,'rgba(179,220,237,.42)'); gradient.addColorStop(.28,'rgba(16,47,64,.12)'); gradient.addColorStop(.72,'rgba(7,17,25,.28)'); gradient.addColorStop(1,'rgba(174,211,226,.26)');
    c.fillStyle=gradient; c.fill();
    c.strokeStyle='rgba(7,23,32,.3)'; c.lineWidth=1.3; c.stroke();
    c.beginPath(); c.moveTo(14,10); c.quadraticCurveTo(9,17,10,23); c.strokeStyle='rgba(218,240,248,.55)'; c.lineWidth=1.5; c.stroke();
    return sprite;
  }

  contains(x,y) {
    if (x<0 || y<0 || x>=width || y>=height) return false;
    if (this.apertures[Math.floor(y)*width+Math.floor(x)] < 230) return false;
    const px=x*this.scale+this.offsetX, py=y*this.scale;
    return !this.exclusions?.some(r=>px>=r.x && px<=r.x+r.width && py>=r.y && py<=r.y+r.height);
  }

  resize() {
    if (this.disposed) return;
    const bounds = this.stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.scale=Math.max(bounds.width/width,bounds.height/height);
    this.offsetX=(bounds.width-width*this.scale)/2;
    this.pixelRatio=Math.min(devicePixelRatio||1,this.mobile.matches?1:1.25,Math.sqrt(1400000/(bounds.width*bounds.height)));
    this.canvas.width=this.mask.width=Math.round(bounds.width*this.pixelRatio);
    this.canvas.height=this.mask.height=Math.round(bounds.height*this.pixelRatio);
    const c=this.maskContext;
    c.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);
    c.clearRect(0,0,bounds.width,bounds.height);
    c.drawImage(this.image,this.offsetX,0,width*this.scale,height*this.scale);
    this.exclusions=[...document.querySelectorAll('.contact-intro,.contact-dock')].map(element=>{
      const r=element.getBoundingClientRect();
      return {x:r.left-bounds.left-12,y:r.top-bounds.top-12,width:r.width+24,height:r.height+24};
    });
    for (const r of this.exclusions) c.clearRect(r.x,r.y,r.width,r.height);
    this.model.limit=this.mobile.matches?45:150;
    if(this.model.drops.length>this.model.limit)this.model.drops.length=this.model.limit;
    this.draw();
  }

  weather() {
    const state=this.player.snapshot();
    const a=climate[state.stateId]||0;
    const b=state.phase==='fading' ? climate[state.targetId]||0 : a;
    return (a+(b-a)*state.alpha)*this.multiplier;
  }

  hasWetTransition() {
    const state=this.player.snapshot();
    return state.phase==='fading' && (climate[state.targetId]||0)>0;
  }

  setEnabled(value) { this.enabled=Boolean(value); this.canvas.hidden=!this.enabled; this.sync(); }
  setIntensity(value) { this.multiplier=Math.max(0,Math.min(1.5,Number(value)||0)); this.sync(); }
  setDebug(value) { this.debug=Boolean(value); this.draw(); }

  sync() {
    if(this.disposed)return;
    const paused=this.player.paused || this.player.motion.matches || this.offscreen || !this.enabled;
    if(paused) {
      cancelAnimationFrame(this.request); this.request=undefined; this.last=undefined;
      // Reduced motion remains the photographic still, including during dynamic preference changes.
      if(this.player.motion.matches) this.context.clearRect(0,0,this.canvas.width,this.canvas.height);
      if(this.debug && this.enabled) this.draw();
      return;
    }
    if(this.request===undefined && (this.debug || this.weather()>0 || this.hasWetTransition() || this.model.drops.length || this.model.trails.length)) this.request=requestAnimationFrame(t=>this.tick(t));
  }

  tick(timestamp) {
    this.request=undefined;
    if(this.disposed || this.player.paused || this.player.motion.matches || !this.enabled || this.offscreen) { this.last=undefined; return; }
    const elapsed=this.last===undefined?0:Math.min(.05,(timestamp-this.last)/1000);
    this.last=timestamp;
    this.accumulator+=elapsed;
    const target=this.weather();
    while(this.accumulator>=1/60) { this.model.step(1/60,target); this.accumulator-=1/60; }
    const interval=this.mobile.matches?1000/24:1000/30;
    if(this.lastDraw===undefined || timestamp-this.lastDraw>=interval) {
      const started=performance.now(); this.draw(); this.costs.push(performance.now()-started);
      if(this.costs.length>120)this.costs.shift();
      this.frames++;this.lastDraw=timestamp;
    }
    if(target>0 || this.hasWetTransition() || this.model.intensity>0 || this.model.drops.length || this.model.trails.length) this.request=requestAnimationFrame(t=>this.tick(t));
    else this.last=undefined;
  }

  draw() {
    if(this.disposed || !this.canvas.width)return;
    const c=this.context;
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.canvas.width,this.canvas.height);
    if(this.debug) {
      c.drawImage(this.mask,0,0);c.globalCompositeOperation='source-in';c.fillStyle='#00e6a077';c.fillRect(0,0,this.canvas.width,this.canvas.height);c.globalCompositeOperation='source-over';return;
    }
    if(this.player.motion.matches)return;
    const scale=this.scale*this.pixelRatio;
    c.setTransform(scale,0,0,scale,this.offsetX*this.pixelRatio,0);
    for(const trail of this.model.trails) {
      c.beginPath();c.moveTo(trail.x,trail.y);c.lineTo(trail.x2,trail.y2);
      c.strokeStyle=`rgba(119,170,193,${.065*(1-trail.age/trail.life)**2})`;c.lineWidth=trail.width;c.lineCap='round';c.stroke();
    }
    const light=this.player.stateId==='sunny' || this.player.stateId==='golden' ? .65 : 1;
    for(const d of this.model.drops) {
      c.globalAlpha=Math.min(1,d.age/.7,Math.max(0,(d.life-d.age)/2))*d.opacity*light;
      const sliding=d.age>d.wait?1.25:1;
      c.drawImage(this.sprite,d.x-d.r,d.y-d.r*sliding,d.r*2,d.r*2.6*sliding);
    }
    c.globalAlpha=1;c.setTransform(1,0,0,1,0,0);
    c.globalCompositeOperation='destination-in';c.drawImage(this.mask,0,0);c.globalCompositeOperation='source-over';
  }

  snapshot() {
    const sorted=[...this.costs].sort((a,b)=>a-b);
    return {...this.model.snapshot(),enabled:this.enabled,debug:!!this.debug,scheduled:this.request!==undefined,frames:this.frames,canvas:[this.canvas.width,this.canvas.height],pixelRatio:this.pixelRatio,target:this.weather(),renderP95ms:sorted[Math.floor(sorted.length*.95)]||0,renderMaxMs:sorted.at(-1)||0};
  }

  dispose() {
    if(this.disposed)return;
    this.disposed=true;cancelAnimationFrame(this.request);this.request=undefined;
    this.observer.disconnect();this.intersection.disconnect();this.life.abort();
    this.canvas.remove();this.model.drops.length=0;this.model.trails.length=0;
    this.canvas.width=this.canvas.height=this.mask.width=this.mask.height=0;
  }
}
