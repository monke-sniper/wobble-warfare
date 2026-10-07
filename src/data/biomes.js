// Map biomes: palette, lighting and decorative props. Terrain shape comes from seed + hilliness.
// props: [type, density per 100m², where] where = 'edge' (outside the play area) | 'all'
export const BIOMES = {
  grass: {
    name: 'Green Valley',
    sky: '#8fd3ff', fog: '#b9e3ff', fogNear: 90, fogFar: 260,
    sun: '#fff4d6', sunI: 2.6, hemiSky: '#cfeaff', hemiGround: '#5a7a3a', hemiI: 1.25,
    grass: ['#7cc04b', '#6ab33f', '#8ccc55'], dirt: '#9c7a4b', rock: '#8c8f94', sand: '#e3d29b',
    water: -1.2, waterColor: '#3d9be0',
    props: [['pine', 1.0, 'edge'], ['oak', 0.7, 'edge'], ['rock', 0.25, 'all'], ['oak', 0.05, 'all'], ['bush', 0.4, 'all']],
  },
  autumn: {
    name: 'Autumn Hills',
    sky: '#ffd9a8', fog: '#ffe2bf', fogNear: 80, fogFar: 240,
    sun: '#ffd8a0', sunI: 2.5, hemiSky: '#ffe9cf', hemiGround: '#7a5a2e', hemiI: 1.2,
    grass: ['#b5a443', '#a7963b', '#c2b04d'], dirt: '#8f6a3c', rock: '#8a8178', sand: '#d9c48f',
    water: -1.5, waterColor: '#4f8fb8',
    props: [['autumn', 1.1, 'edge'], ['pine', 0.4, 'edge'], ['rock', 0.25, 'all'], ['autumn', 0.06, 'all'], ['bush', 0.3, 'all']],
  },
  desert: {
    name: 'Dusty Mesa',
    sky: '#ffe0a3', fog: '#f5d9a6', fogNear: 90, fogFar: 280,
    sun: '#fff0cc', sunI: 3.0, hemiSky: '#fff3d9', hemiGround: '#b98a4f', hemiI: 1.2,
    grass: ['#e6c27a', '#ddb66c', '#ecca86'], dirt: '#c98f52', rock: '#b9704a', sand: '#efd59a',
    water: null,
    props: [['cactus', 0.35, 'all'], ['mesa', 0.12, 'edge'], ['rock', 0.3, 'all'], ['deadtree', 0.1, 'all']],
  },
  snow: {
    name: 'Frost Peaks',
    sky: '#cfe6ff', fog: '#e4f0ff', fogNear: 70, fogFar: 220,
    sun: '#ffffff', sunI: 2.4, hemiSky: '#e8f3ff', hemiGround: '#8aa0b8', hemiI: 1.35,
    grass: ['#f2f6fb', '#e6eef7', '#fafcff'], dirt: '#a9b6c6', rock: '#6f7a88', sand: '#dfe7f0',
    water: -1.4, waterColor: '#8fc8ee',
    props: [['snowpine', 1.2, 'edge'], ['rock', 0.3, 'all'], ['snowpine', 0.06, 'all']],
  },
  beach: {
    name: 'Shipwreck Cove',
    sky: '#7fd6ff', fog: '#bdeaff', fogNear: 90, fogFar: 270,
    sun: '#fff6dc', sunI: 2.8, hemiSky: '#d4f2ff', hemiGround: '#c8b07a', hemiI: 1.25,
    grass: ['#86c95a', '#79bd4f', '#93d266'], dirt: '#a88a5a', rock: '#9a9690', sand: '#f1dfa5',
    water: -0.9, waterColor: '#2fb7d6', sandBand: 1.4,
    props: [['palm', 0.6, 'all'], ['rock', 0.2, 'all'], ['bush', 0.3, 'edge']],
  },
  volcano: {
    name: 'Ashlands',
    sky: '#c98b74', fog: '#a8786a', fogNear: 60, fogFar: 200,
    sun: '#ffc39a', sunI: 2.6, hemiSky: '#ffd6c0', hemiGround: '#4a3632', hemiI: 1.35,
    grass: ['#6e5f5b', '#776763', '#655652'], dirt: '#7d5640', rock: '#3d3534', sand: '#6c5a50',
    water: -2.7, waterColor: '#ff5a1f', waterGlow: true, lava: true,
    props: [['deadtree', 0.4, 'all'], ['rock', 0.5, 'all'], ['crystal', 0.12, 'edge']],
  },
  alien: {
    name: 'Neon Moon',
    sky: '#1b1446', fog: '#2a1f5e', fogNear: 60, fogFar: 210,
    sun: '#f4eeff', sunI: 2.4, hemiSky: '#c4bcff', hemiGround: '#3a2d5c', hemiI: 1.5,
    grass: ['#5e4d9e', '#544592', '#6857ab'], dirt: '#3d2f7a', rock: '#2c2550', sand: '#8a74d6',
    water: -1.3, waterColor: '#2cf0c8', waterGlow: true,
    props: [['crystal', 0.5, 'all'], ['mushroom', 0.6, 'edge'], ['rock', 0.3, 'all']],
  },
};

export const BIOME_KEYS = Object.keys(BIOMES);
