import { seededRandom } from './timeline.js';

// Positions and speeds use the locked photographic coordinate system, not CSS pixels.
export class RainModel {
  constructor({ seed = 42, contains, limit = 150 }) {
    this.random = seededRandom(seed);
    this.contains = contains;
    this.limit = limit;
    this.drops = [];
    this.trails = [];
    this.intensity = 0;
    this.time = 0;
    this.births = 0;
    this.exits = 0;
    this.untilBirth = this.interval(8);
  }

  interval(rate) { return -Math.log(Math.max(.000001, 1 - this.random())) / rate; }

  spawn() {
    if (this.drops.length >= this.limit) return;
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = this.random() * 1340;
      const y = this.random() * 670;
      if (!this.contains(x, y)) continue;
      const r = 1.8 + this.random() * 3.2;
      this.drops.push({
        x, y, r, age: 0, life: 12 + this.random() * 20,
        wait: this.random() < .32 ? .8 + this.random() * 5.5 : Infinity,
        speed: 6 + this.random() * 18, phase: this.random() * Math.PI * 2,
        path: 0, trailX: x, trailY: y, opacity: .58 + this.random() * .36,
      });
      this.births++;
      return;
    }
  }

  step(dt, target) {
    this.time += dt;
    this.intensity += (target - this.intensity) * (1 - Math.exp(-dt / 1.4));
    if (target === 0 && this.intensity < .008) this.intensity = 0;
    const rate = 10 * this.intensity * this.limit / 150;
    if (rate > .05) {
      this.untilBirth -= dt * rate;
      if (this.untilBirth <= 0) {
        this.spawn();
        this.untilBirth += this.interval(1);
      }
    }
    for (let index = this.drops.length - 1; index >= 0; index--) {
      const d = this.drops[index];
      d.age += dt;
      if (target === 0) d.life = Math.min(d.life, d.age + 5.5);
      if (d.age > d.wait) {
        const speed = d.speed * (.7 + .3 * Math.sin(d.age * .8 + d.phase)) * Math.min(1, (d.age - d.wait) / 2);
        d.x += Math.sin(d.age * 1.1 + d.phase) * dt * 2;
        d.y += speed * dt;
        d.path += speed * dt;
        if (d.path > 10) {
          this.trails.push({ x:d.trailX, y:d.trailY, x2:d.x, y2:d.y, age:0, life:2.2 + this.random() * 2, width:d.r * .28 });
          d.trailX = d.x;
          d.trailY = d.y;
          d.path = 0;
        }
      }
      if (d.age >= d.life || !this.contains(d.x, d.y)) {
        this.drops.splice(index, 1);
        this.exits++;
      }
    }
    for (let index = this.trails.length - 1; index >= 0; index--) {
      this.trails[index].age += dt;
      if (this.trails[index].age >= this.trails[index].life) this.trails.splice(index, 1);
    }
    if (this.trails.length > this.limit * 3) this.trails.splice(0, this.trails.length - this.limit * 3);
  }

  snapshot() {
    return { time: this.time, intensity:this.intensity, drops:this.drops.length, sliding:this.drops.filter(d=>d.age>d.wait).length, trails:this.trails.length, births:this.births, exits:this.exits };
  }
}
