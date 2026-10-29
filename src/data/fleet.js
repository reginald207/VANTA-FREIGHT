// Fleet classes. The vehicles are fictional; the specifications are
// measurements taken from the procedural 3D models (src/webgl/truck/), so the
// page and the turntable always agree.

export const FLEET = [
  {
    code: 'VF-01',
    variant: 'semi',
    name: 'Tractor-trailer',
    use: 'Long-haul linehaul, expedited and reefer runs.',
    specs: [
      ['Overall length', '17.0 m'],
      ['Width', '2.55 m'],
      ['Height', '4.1 m'],
      ['Axles', '6'],
      ['Tyres', '22'],
      ['Cargo box', '13.6 m trailer'],
    ],
  },
  {
    code: 'VF-02',
    variant: 'rigid',
    name: 'Rigid box truck',
    use: 'Regional and city runs, and expedited loads that fit one body.',
    specs: [
      ['Overall length', '10.1 m'],
      ['Width', '2.55 m'],
      ['Height', '4.1 m'],
      ['Axles', '3'],
      ['Tyres', '10'],
      ['Cargo box', '7.15 m body'],
    ],
  },
  {
    code: 'VF-03',
    variant: 'tractor',
    name: 'Tractor unit',
    use: 'Trailer swaps, yard moves and drop-and-hook work.',
    specs: [
      ['Overall length', '6.5 m'],
      ['Width', '2.55 m'],
      ['Height', '4.1 m'],
      ['Axles', '3'],
      ['Tyres', '10'],
      ['Cargo box', 'None (pulls a trailer)'],
    ],
  },
];
