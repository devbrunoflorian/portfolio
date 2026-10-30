import { BufferAttribute } from "three";

export const ASSEMBLY_DELAY_WINDOWS = Object.freeze({
  base: Object.freeze({ min: 0.00, max: 0.04 }),
  chest: Object.freeze({ min: 0.02, max: 0.06 }),
  neck: Object.freeze({ min: 0.04, max: 0.08 }),
  head: Object.freeze({ min: 0.06, max: 0.10 }),
});

export const ASSEMBLY_DURATION = 0.40;

const REGION_ORDER = Object.keys(ASSEMBLY_DELAY_WINDOWS);

function positionKey(point) {
  return point.map((value) => Math.round(value * 100_000)).join(",");
}

function edgeKey(first, second) {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function squaredDistance(first, second) {
  const x = first[0] - second[0];
  const y = first[1] - second[1];
  const z = first[2] - second[2];
  return x * x + y * y + z * z;
}

function dot(first, second) {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function vectorBetween(first, second) {
  return [second[0] - first[0], second[1] - first[1], second[2] - first[2]];
}

function faceNormal(points) {
  const first = vectorBetween(points[0], points[1]);
  const second = vectorBetween(points[0], points[2]);
  return normalize([
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ]);
}

function readPoint(position, index) {
  return [position.getX(index), position.getY(index), position.getZ(index)];
}

function readRawAttributeComponent(attribute, vertex, component) {
  if (attribute.isInterleavedBufferAttribute) {
    return attribute.data.array[vertex * attribute.data.stride + attribute.offset + component];
  }
  return attribute.array[vertex * attribute.itemSize + component];
}

function getComponents(neighbors) {
  const seen = new Uint8Array(neighbors.length);
  const components = [];
  for (let start = 0; start < neighbors.length; start++) {
    if (seen[start]) continue;
    const component = [];
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const face = queue[cursor];
      component.push(face);
      for (const adjacent of neighbors[face]) {
        if (seen[adjacent]) continue;
        seen[adjacent] = 1;
        queue.push(adjacent);
      }
    }
    components.push(component);
  }
  return components.sort((first, second) => second.length - first.length || first[0] - second[0]);
}

function distributeChunkCounts(components, totalChunks) {
  const counts = components.map((component) => Math.min(1, component.length));
  let remaining = Math.min(totalChunks, components.reduce((sum, component) => sum + component.length, 0)) - counts.length;
  while (remaining > 0) {
    let selected = -1;
    let bestLoad = -Infinity;
    for (let index = 0; index < components.length; index++) {
      if (counts[index] >= components[index].length) continue;
      const load = components[index].length / counts[index];
      if (load > bestLoad) {
        selected = index;
        bestLoad = load;
      }
    }
    if (selected < 0) break;
    counts[selected]++;
    remaining--;
  }
  return counts;
}

function chooseSeeds(component, count, faces, random) {
  const minimumY = Math.min(...component.map((index) => faces[index].modelCenter[1]));
  const first = component.reduce((selected, index) => {
    const face = faces[index];
    const selectedFace = faces[selected];
    const score = Math.abs(face.modelCenter[1] - minimumY) + Math.hypot(face.modelCenter[0], face.modelCenter[2]) * 0.12;
    const selectedScore = Math.abs(selectedFace.modelCenter[1] - minimumY) + Math.hypot(selectedFace.modelCenter[0], selectedFace.modelCenter[2]) * 0.12;
    return score < selectedScore ? index : selected;
  }, component[0]);
  const seeds = [first];
  while (seeds.length < count) {
    let selected = -1;
    let selectedScore = -Infinity;
    for (const index of component) {
      if (seeds.includes(index)) continue;
      const face = faces[index];
      const nearest = Math.min(...seeds.map((seed) => {
        const other = faces[seed];
        const separation = squaredDistance(face.modelCenter, other.modelCenter);
        const normalDifference = 1 - Math.max(-1, dot(face.modelNormal, other.modelNormal));
        return separation + normalDifference * 0.018;
      }));
      const score = nearest + random() * 0.000001;
      if (score > selectedScore) {
        selected = index;
        selectedScore = score;
      }
    }
    if (selected < 0) break;
    seeds.push(selected);
  }
  return seeds;
}

function growChunks(component, seeds, neighbors, faces) {
  const owner = new Int32Array(neighbors.length).fill(-1);
  const sizes = seeds.map(() => 0);
  const target = Math.floor(component.length / seeds.length);
  const remainder = component.length % seeds.length;
  for (let chunk = 0; chunk < seeds.length; chunk++) {
    owner[seeds[chunk]] = chunk;
    sizes[chunk]++;
  }

  let assigned = seeds.length;
  while (assigned < component.length) {
    let selectedFace = -1;
    let selectedChunk = -1;
    let selectedScore = Infinity;
    for (const faceIndex of component) {
      if (owner[faceIndex] !== -1) continue;
      const face = faces[faceIndex];
      for (const adjacent of neighbors[faceIndex]) {
        const chunk = owner[adjacent];
        if (chunk < 0 || sizes[chunk] >= target + (chunk < remainder ? 1 : 0)) continue;
        const seedFace = faces[seeds[chunk]];
        const score = squaredDistance(face.modelCenter, seedFace.modelCenter)
          + (1 - Math.max(-1, dot(face.modelNormal, seedFace.modelNormal))) * 0.025
          + sizes[chunk] * 1e-9
          + faceIndex * 1e-12;
        if (score < selectedScore) {
          selectedFace = faceIndex;
          selectedChunk = chunk;
          selectedScore = score;
        }
      }
    }

    if (selectedFace < 0) {
      for (const faceIndex of component) {
        if (owner[faceIndex] !== -1) continue;
        let closestChunk = -1;
        let closestScore = Infinity;
        for (let chunk = 0; chunk < seeds.length; chunk++) {
          if (sizes[chunk] >= target + (chunk < remainder ? 1 : 0)) continue;
          const seedFace = faces[seeds[chunk]];
          const face = faces[faceIndex];
          const score = squaredDistance(face.modelCenter, seedFace.modelCenter)
            + (1 - Math.max(-1, dot(face.modelNormal, seedFace.modelNormal))) * 0.025;
          if (score < closestScore) {
            closestChunk = chunk;
            closestScore = score;
          }
        }
        if (closestChunk >= 0) {
          owner[faceIndex] = closestChunk;
          sizes[closestChunk]++;
          assigned++;
        }
      }
      break;
    }

    owner[selectedFace] = selectedChunk;
    sizes[selectedChunk]++;
    assigned++;
  }

  for (const faceIndex of component) {
    if (owner[faceIndex] !== -1) continue;
    const neighborsInComponent = neighbors[faceIndex].filter((index) => owner[index] !== -1);
    const candidates = neighborsInComponent.length ? neighborsInComponent : component.filter((index) => owner[index] !== -1);
    let selected = 0;
    let selectedScore = Infinity;
    for (const adjacent of candidates) {
      const chunk = owner[adjacent];
      const face = faces[faceIndex];
      const seedFace = faces[seeds[chunk]];
      const score = squaredDistance(face.modelCenter, seedFace.modelCenter)
        + (1 - Math.max(-1, dot(face.modelNormal, seedFace.modelNormal))) * 0.025
        + sizes[chunk] * 1e-8;
      if (score < selectedScore) {
        selected = chunk;
        selectedScore = score;
      }
    }
    owner[faceIndex] = selected;
    sizes[selected]++;
  }

  return { owner, sizes };
}

function selectRegion(normalizedY) {
  if (normalizedY < 0.23) return "base";
  if (normalizedY < 0.49) return "chest";
  if (normalizedY < 0.76) return "neck";
  return "head";
}

function createChunkMetadata(faces, faceIndices, chunkId, random, bounds) {
  const center = [0, 0, 0];
  const modelCenter = [0, 0, 0];
  const normal = [0, 0, 0];
  for (const index of faceIndices) {
    const face = faces[index];
    for (let axis = 0; axis < 3; axis++) {
      center[axis] += face.center[axis];
      modelCenter[axis] += face.modelCenter[axis];
      normal[axis] += face.modelNormal[axis];
    }
  }
  const divisor = Math.max(1, faceIndices.length);
  for (let axis = 0; axis < 3; axis++) {
    center[axis] /= divisor;
    modelCenter[axis] /= divisor;
  }
  const region = selectRegion((modelCenter[1] - bounds.minY) / Math.max(0.001, bounds.maxY - bounds.minY));
  const window = ASSEMBLY_DELAY_WINDOWS[region];
  const angle = (random() - 0.5) * (region === "head" ? 0.62 : 0.78);
  const axis = normalize([random() * 2 - 1, 0.25 + random() * 0.75, random() * 2 - 1]);
  return {
    id: chunkId,
    center,
    modelCenter,
    axisAngle: [...axis, angle],
    delay: window.min + random() * (window.max - window.min),
    region,
    faceCount: faceIndices.length,
    meanNormal: normalize(normal),
  };
}

function buildFaces(geometry, toModelPoint) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const faces = [];
  const edgeOwners = new Map();
  const neighbors = [];
  const vertexKeys = Array.from({ length: position.count }, (_, vertex) => positionKey(readPoint(position, vertex)));

  for (let offset = 0; offset < (index ? index.count : position.count); offset += 3) {
    const vertices = index
      ? [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)]
      : [offset, offset + 1, offset + 2];
    const points = vertices.map((vertex) => readPoint(position, vertex));
    const center = [0, 0, 0];
    for (const point of points) for (let axis = 0; axis < 3; axis++) center[axis] += point[axis] / 3;
    const modelCenter = toModelPoint ? toModelPoint(center) : center.slice();
    const modelPoints = points.map((point) => toModelPoint ? toModelPoint(point) : point);
    const modelNormal = faceNormal(modelPoints);
    const faceIndex = faces.length;
    faces.push({ vertices, points, center, modelCenter, modelNormal });
    neighbors.push(new Set());
    for (const [first, second] of [[0, 1], [1, 2], [2, 0]]) {
      const key = edgeKey(vertexKeys[vertices[first]], vertexKeys[vertices[second]]);
      if (!edgeOwners.has(key)) edgeOwners.set(key, []);
      edgeOwners.get(key).push(faceIndex);
    }
  }

  for (const adjacentFaces of edgeOwners.values()) {
    for (let first = 0; first < adjacentFaces.length; first++) {
      for (let second = first + 1; second < adjacentFaces.length; second++) {
        const a = adjacentFaces[first];
        const b = adjacentFaces[second];
        neighbors[a].add(b);
        neighbors[b].add(a);
      }
    }
  }
  return { faces, neighbors: neighbors.map((set) => [...set]), edgeOwners };
}

function writeFragmentAttributes(geometry, faces, faceChunkIds, chunks, idOffset = 0) {
  const position = geometry.getAttribute("position");
  const sourceIndex = geometry.getIndex();
  const sourceIndices = sourceIndex
    ? Array.from({ length: sourceIndex.count }, (_, index) => sourceIndex.getX(index))
    : Array.from({ length: position.count }, (_, index) => index);
  const newIndices = [];
  const remapped = new Map();
  const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, {
    itemSize: attribute.itemSize,
    normalized: attribute.normalized,
    ArrayType: attribute.array.constructor,
    values: [],
  }]));
  const fragmentId = [];
  const fragmentCenter = [];
  const fragmentAxisAngle = [];
  const fragmentDelay = [];

  for (let offset = 0; offset < sourceIndices.length; offset += 3) {
    const faceIndex = Math.floor(offset / 3);
    const localChunkId = faceChunkIds[faceIndex];
    const chunk = chunks[localChunkId];
    for (let corner = 0; corner < 3; corner++) {
      const originalVertex = sourceIndices[offset + corner];
      const key = `${originalVertex}|${localChunkId}`;
      let outputVertex = remapped.get(key);
      if (outputVertex === undefined) {
        outputVertex = remapped.size;
        remapped.set(key, outputVertex);
        for (const [name, target] of Object.entries(attributes)) {
          const source = geometry.getAttribute(name);
          for (let component = 0; component < target.itemSize; component++) {
            target.values.push(readRawAttributeComponent(source, originalVertex, component));
          }
        }
        fragmentId.push(chunk.id + idOffset);
        fragmentCenter.push(...chunk.center);
        fragmentAxisAngle.push(...chunk.axisAngle);
        fragmentDelay.push(chunk.delay);
      }
      newIndices.push(outputVertex);
    }
  }

  const indexArray = remapped.size > 65_535 ? new Uint32Array(newIndices) : new Uint16Array(newIndices);
  const result = geometry.clone();
  result.clearGroups();
  for (const [name, source] of Object.entries(attributes)) {
    result.setAttribute(name, new BufferAttribute(new source.ArrayType(source.values), source.itemSize, source.normalized));
  }
  result.setIndex(new BufferAttribute(indexArray, 1));
  result.setAttribute("aFragmentId", new BufferAttribute(new Float32Array(fragmentId), 1));
  result.setAttribute("aFragCenter", new BufferAttribute(new Float32Array(fragmentCenter), 3));
  result.setAttribute("aFragAxisAngle", new BufferAttribute(new Float32Array(fragmentAxisAngle), 4));
  result.setAttribute("aFragDelay", new BufferAttribute(new Float32Array(fragmentDelay), 1));
  result.computeBoundingBox();
  result.computeBoundingSphere();

  for (const group of geometry.groups) result.addGroup(group.start, group.count, group.materialIndex);
  result.setDrawRange(geometry.drawRange.start, geometry.drawRange.count);
  return { geometry: result, boundaryVertexCount: remapped.size - position.count };
}

export function createFragmentedGeometry(geometry, { chunkCount, random, toModelPoint, modelBounds, idOffset = 0 }) {
  const { faces, neighbors, edgeOwners } = buildFaces(geometry, toModelPoint);
  const components = getComponents(neighbors);
  const faceChunkIds = new Int32Array(faces.length).fill(-1);
  const targetFacesPerChunk = faces.length / Math.max(1, chunkCount);
  const minimumIndependentComponent = Math.max(6, Math.floor(targetFacesPerChunk * 0.35));
  const coreComponents = components
    .filter((component) => component.length >= minimumIndependentComponent)
    .slice(0, chunkCount);
  if (!coreComponents.length && components.length) coreComponents.push(components[0]);
  const coreSet = new Set(coreComponents);
  const satelliteComponents = components.filter((component) => !coreSet.has(component));
  const componentChunkCounts = distributeChunkCounts(coreComponents, chunkCount);
  const faceGroups = [];

  for (let componentIndex = 0; componentIndex < coreComponents.length; componentIndex++) {
    const component = coreComponents[componentIndex];
    const count = componentChunkCounts[componentIndex];
    if (!count) continue;
    const seeds = chooseSeeds(component, count, faces, random);
    const { owner } = growChunks(component, seeds, neighbors, faces);
    const localChunks = seeds.map(() => []);
    for (const faceIndex of component) localChunks[owner[faceIndex]].push(faceIndex);
    faceGroups.push(...localChunks);
  }

  for (const component of satelliteComponents) {
    const componentCenter = component.reduce((center, faceIndex) => {
      const point = faces[faceIndex].modelCenter;
      center[0] += point[0] / component.length;
      center[1] += point[1] / component.length;
      center[2] += point[2] / component.length;
      return center;
    }, [0, 0, 0]);
    let closestChunk = 0;
    let nearestDistance = Infinity;
    for (let chunkIndex = 0; chunkIndex < faceGroups.length; chunkIndex++) {
      const group = faceGroups[chunkIndex];
      const groupCenter = group.reduce((center, faceIndex) => {
        const point = faces[faceIndex].modelCenter;
        center[0] += point[0] / group.length;
        center[1] += point[1] / group.length;
        center[2] += point[2] / group.length;
        return center;
      }, [0, 0, 0]);
      const distance = squaredDistance(componentCenter, groupCenter);
      if (distance < nearestDistance) {
        closestChunk = chunkIndex;
        nearestDistance = distance;
      }
    }
    faceGroups[closestChunk].push(...component);
  }

  const chunks = faceGroups.map((faceIndices, chunkId) => createChunkMetadata(faces, faceIndices, chunkId, random, modelBounds));
  for (let chunkId = 0; chunkId < faceGroups.length; chunkId++) {
    for (const faceIndex of faceGroups[chunkId]) faceChunkIds[faceIndex] = chunkId;
  }

  const edgeChunkOwners = new Map();
  for (const [key, adjacentFaces] of edgeOwners) {
    const owner = Math.min(...adjacentFaces.map((faceIndex) => faceChunkIds[faceIndex]));
    edgeChunkOwners.set(key, owner);
  }
  const expanded = writeFragmentAttributes(geometry, faces, faceChunkIds, chunks, idOffset);
  const regions = Object.fromEntries(REGION_ORDER.map((region) => [region, 0]));
  chunks.forEach((chunk) => { regions[chunk.region]++; });
  return {
    ...expanded,
    chunks,
    edgeChunkOwners,
    faceCount: faces.length,
    faceChunkIds,
    faceCounts: chunks.map((chunk) => chunk.faceCount),
    regionCounts: regions,
  };
}

export function annotateFragmentEdges(edgeGeometry, fragmentPlan, idOffset = 0) {
  const position = edgeGeometry.getAttribute("position");
  const endpointChunks = [];
  const centers = [];
  const axes = [];
  const delays = [];
  for (let offset = 0; offset < position.count; offset += 2) {
    const first = readPoint(position, offset);
    const second = readPoint(position, offset + 1);
    const firstKey = positionKey(first);
    const secondKey = positionKey(second);
    let localChunkId = fragmentPlan.edgeChunkOwners.get(edgeKey(firstKey, secondKey));
    if (localChunkId === undefined) {
      let nearest = Infinity;
      localChunkId = 0;
      const midpoint = first.map((value, axis) => (value + second[axis]) / 2);
      for (const chunk of fragmentPlan.chunks) {
        const distance = squaredDistance(midpoint, chunk.center);
        if (distance < nearest) {
          nearest = distance;
          localChunkId = chunk.id;
        }
      }
    }
    const chunk = fragmentPlan.chunks[localChunkId];
    for (let endpoint = 0; endpoint < 2; endpoint++) {
      endpointChunks.push(chunk.id + idOffset);
      centers.push(...chunk.center);
      axes.push(...chunk.axisAngle);
      delays.push(chunk.delay);
    }
  }
  edgeGeometry.setAttribute("aFragmentId", new BufferAttribute(new Float32Array(endpointChunks), 1));
  edgeGeometry.setAttribute("aFragCenter", new BufferAttribute(new Float32Array(centers), 3));
  edgeGeometry.setAttribute("aFragAxisAngle", new BufferAttribute(new Float32Array(axes), 4));
  edgeGeometry.setAttribute("aFragDelay", new BufferAttribute(new Float32Array(delays), 1));
}
