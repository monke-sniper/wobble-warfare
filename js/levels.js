'use strict';
// Campaign levels. Enemy entries are [unitType, worldX] inside the red zone (1140..1950).
(function (G) {
  G.LEVELS = [
    {
      id: 'l1', name: 'Boot Camp', seed: 3, hilly: 0.35, budget: 600,
      tip: 'Riflemen trade shots evenly. Bring a few more than they have.',
      enemy: [['rifleman', 1260], ['rifleman', 1320], ['rifleman', 1390], ['rifleman', 1460]],
    },
    {
      id: 'l2', name: 'Close Quarters', seed: 21, hilly: 0.6, budget: 700,
      tip: 'Breachers wreck anything up close. Keep your distance.',
      enemy: [['shotgunner', 1200], ['shotgunner', 1240], ['shotgunner', 1290], ['shotgunner', 1330], ['medic', 1450]],
    },
    {
      id: 'l3', name: 'Overwatch', seed: 77, hilly: 0.9, budget: 1150,
      tip: 'Railgunners sit far back and love expensive targets. Rush them.',
      enemy: [['shield', 1180], ['rifleman', 1300], ['rifleman', 1340], ['rifleman', 1380], ['sniper', 1820], ['sniper', 1900]],
    },
    {
      id: 'l4', name: 'Neon Rush', seed: 105, hilly: 0.5, budget: 850,
      tip: 'Ninjas close the gap fast. Shields and shotguns hold the line.',
      enemy: [['ninja', 1400], ['ninja', 1440], ['ninja', 1480], ['ninja', 1520], ['ninja', 1560], ['ninja', 1600], ['ninja', 1640], ['ninja', 1680]],
    },
    {
      id: 'l5', name: 'Shell Shock', seed: 202, hilly: 1.0, budget: 1600,
      tip: 'Grenades arc over shields. Spread out!',
      enemy: [['shield', 1180], ['shield', 1230], ['shield', 1280], ['medic', 1420], ['grenadier', 1540], ['grenadier', 1600], ['grenadier', 1660]],
    },
    {
      id: 'l6', name: 'Steel Wall', seed: 314, hilly: 0.7, budget: 1700,
      tip: 'Bullets bounce off the shield wall. Explosives do not care.',
      enemy: [['shield', 1170], ['shield', 1200], ['shield', 1230], ['shield', 1260], ['shield', 1290], ['shield', 1320], ['rocket', 1700], ['rocket', 1780]],
    },
    {
      id: 'l7', name: 'Heavy Metal', seed: 444, hilly: 0.8, budget: 2200,
      tip: 'A Combat Mech shrugs off rifles. Rockets and railguns bite.',
      enemy: [['rifleman', 1200], ['rifleman', 1240], ['rifleman', 1280], ['rifleman', 1320], ['mech', 1500], ['medic', 1640], ['medic', 1700]],
    },
    {
      id: 'l8', name: 'Final Assault', seed: 909, hilly: 1.15, budget: 6500,
      tip: 'Everything they have. Good luck, commander.',
      enemy: [
        ['shield', 1170], ['shield', 1210], ['shield', 1250], ['shield', 1290],
        ['ninja', 1330], ['ninja', 1370],
        ['mech', 1450], ['medic', 1520], ['medic', 1560],
        ['grenadier', 1600], ['grenadier', 1640], ['grenadier', 1680],
        ['rocket', 1720], ['rocket', 1770], ['mech', 1800],
        ['sniper', 1880], ['sniper', 1920],
      ],
    },
  ];

  // Stars for a win: spend less of the budget for more stars.
  G.starsFor = (spent, budget) => (spent <= budget * 0.6 ? 3 : spent <= budget * 0.85 ? 2 : 1);
})(window.WW);
