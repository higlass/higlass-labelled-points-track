/* eslint-env jest */
const LabelledPointsTrack = require('../src/LabelledPointTrack').default;

// Mock HGC libraries
const mockHGC = {
  libraries: {
    PIXI: {
      Graphics: class {
        addChild() {}
        setParent() {}
        clear() {}
        lineStyle() {}
        drawRect() {}
        beginFill() {}
      },
      Text: class {
        constructor() {
          this.x = 0;
          this.y = 0;
          this.visible = true;
        }
        updateTransform() {}
        getBounds() {
          return { x: 0, y: 0, width: 100, height: 20 };
        }
      },
    },
    slugid: {
      nice: () => 'test-uid',
    },
    d3Color: {
      color: (str) => ({
        rgb: () => {
          const colors = {
            black: { r: 0, g: 0, b: 0 },
            red: { r: 255, g: 0, b: 0 },
            '#1f77b4': { r: 31, g: 119, b: 180 },
            '#ff7f0e': { r: 255, g: 127, b: 14 },
          };
          return colors[str] || { r: 0, g: 0, b: 0 };
        },
      }),
    },
    d3Scale: {
      scaleLinear: () => {
        const scale = (val) => 'white';
        scale.domain = function() { return this; };
        scale.range = function() { return this; };
        return scale;
      },
    },
  },
  tracks: {
    Annotations2dTrack: class {
      constructor() {
        this.pMain = {
          addChild: () => {},
        };
      }
    },
  },
};

describe('LabelledPointsTrack Color Functionality', () => {
  let track;
  const mockContext = {};
  
  beforeEach(() => {
    track = new LabelledPointsTrack(mockHGC, mockContext, {});
  });

  describe('colorToHex', () => {
    test('converts color strings to hex', () => {
      expect(track.colorToHex('black')).toBe(0x000000);
      expect(track.colorToHex('red')).toBe(0xff0000);
      expect(track.colorToHex('#1f77b4')).toBe(0x1f77b4);
    });
  });

  describe('buildColorScale - categorical', () => {
    test('uses provided color map', () => {
      track.options = {
        colorField: 'category',
        colorScale: {
          type: 'categorical',
          map: {
            A: 'red',
            B: 'black',
          },
        },
      };

      const data = [
        { uid: 'uid1', category: 'A' },
        { uid: 'uid2', category: 'B' },
      ];

      track.buildColorScale(data);

      expect(track.colors['uid1']).toBe(0xff0000);
      expect(track.colors['uid2']).toBe(0x000000);
    });

    test('auto-generates color map when not provided', () => {
      track.options = {
        colorField: 'category',
        colorScale: {
          type: 'categorical',
        },
      };

      const data = [
        { uid: 'uid1', category: 'A' },
        { uid: 'uid2', category: 'B' },
        { uid: 'uid3', category: 'A' },
      ];

      track.buildColorScale(data);

      expect(track.colors['uid1']).toBe(0x1f77b4);
      expect(track.colors['uid2']).toBe(0xff7f0e);
      expect(track.colors['uid3']).toBe(0x1f77b4);
    });

    test('handles null values', () => {
      track.options = {
        colorField: 'category',
        colorScale: {
          type: 'categorical',
          map: { A: 'red' },
        },
      };

      const data = [
        { uid: 'uid1', category: null },
        { uid: 'uid2', category: 'unknown' },
      ];

      track.buildColorScale(data);

      expect(track.colors['uid1']).toBe(0x000000);
      expect(track.colors['uid2']).toBe(0x000000);
    });
  });

  describe('buildColorScale - quantitative', () => {
    test('creates quantitative scale', () => {
      track.options = {
        colorField: 'value',
        colorScale: {
          type: 'quantitative',
          colors: ['white', 'black'],
        },
      };

      const data = [
        { uid: 'uid1', value: 0 },
        { uid: 'uid2', value: 50 },
        { uid: 'uid3', value: 100 },
      ];

      track.buildColorScale(data);

      expect(track.colors['uid1']).toBeDefined();
      expect(track.colors['uid2']).toBeDefined();
      expect(track.colors['uid3']).toBeDefined();
    });

    test('handles null values in quantitative scale', () => {
      track.options = {
        colorField: 'value',
        colorScale: {
          type: 'quantitative',
          colors: ['white', 'black'],
        },
      };

      const data = [
        { uid: 'uid1', value: null },
        { uid: 'uid2', value: 50 },
      ];

      track.buildColorScale(data);

      expect(track.colors['uid1']).toBe(0x000000);
    });
  });

  describe('getPointColor', () => {
    test('returns stored color for point', () => {
      track.colors = { 'uid1': 0xff0000 };
      expect(track.getPointColor({ uid: 'uid1' })).toBe(0xff0000);
    });

    test('returns default black for unknown point', () => {
      expect(track.getPointColor({ uid: 'unknown' })).toBe(0x000000);
    });
  });
});
