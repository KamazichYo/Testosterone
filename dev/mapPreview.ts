import { bakeGround } from '../src/art/ground';
import { PixelCanvas } from '../src/art/PixelCanvas';
import { drawPlayerSheet } from '../src/art/playerArt';
import { drawDogFrame } from '../src/art/dogArt';
import { drawVan } from '../src/art/props';
import { drawProp } from '../src/art/propFactory';
import { garagesDistrict } from '../src/data/garages';
import { generateDistrictDogs } from '../src/dogs/generator';

export function composeMap(): PixelCanvas {
  const d = garagesDistrict();
  const pc = bakeGround(d.ground, d.decals, 1);
  const items: { y: number; draw: () => void }[] = [];
  for (const p of d.props) {
    const art = drawProp(p);
    items.push({ y: p.y, draw: () => pc.blit(art, Math.round(p.x - art.w / 2), p.y - art.h) });
  }
  const van = drawVan();
  items.push({ y: d.van.y, draw: () => pc.blit(van, d.van.x - 28, d.van.y - 36) });
  const player = drawPlayerSheet();
  const pf = new PixelCanvas(16, 24);
  pf.blit(player, 0, 0);
  items.push({ y: d.playerStart.y, draw: () => pc.blit(pf, d.playerStart.x - 8, d.playerStart.y - 24) });
  for (const dog of generateDistrictDogs(d.dogs, 1)) {
    const f = drawDogFrame(dog.look, 0, { dirt: 0.8, angry: dog.stats.aggression > 55, hungry: true, tagged: false });
    items.push({ y: dog.home.y, draw: () => pc.blit(f, dog.home.x - 16, dog.home.y - 22) });
  }
  items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
  return pc;
}
