import boxIntersect from 'box-intersect';

const POINT_WIDTH = 6;

const LabelledPointsTrack = (HGC, ...args) => {
  if (!new.target) {
    throw new Error(
      'Uncaught TypeError: Class constructor cannot be invoked without "new"',
    );
  }

  // Services
  const { PIXI, slugid, d3Color, d3Scale } = HGC.libraries;

  class LabelledPointsTrackClass extends HGC.tracks.Annotations2dTrack {
    constructor(
      context, options,
    ) {
      super(
        context,
        options,
      );

      this.texts = {};
      this.boxes = {};
      this.colors = {};
      this.pointData = {};
      this.labelPositions = {};
      this.pointPositions = {};
      this.hoverGraphics = new PIXI.Graphics();
      this.pMain.addChild(this.hoverGraphics);
      this.hoverGraphics.setParent(this.pMain);
    }

    /* --------------------------- Getter / Setter ---------------------------- */
    get minY() {
      return this.tilesetInfo && this.tilesetInfo.min_pos
        ? this.tilesetInfo.min_pos[1]
        : 0;
    }

    get maxY() {
      return this.tilesetInfo && this.tilesetInfo.max_pos
        ? this.tilesetInfo.max_pos[1]
        : this.tilesetInfo.max_width || this.tilesetInfo.max_size;
    }

    initTile(tile) {
      try {
        for (const data of tile.tileData) {
            if (!('uid' in data)) {
              data.uid = slugid.nice();
            }
            this.pointData[data.uid] = data;
          }
        } catch (err) {
          console.warn('tile.tileData is not iterable:', tile.tileData);
      }
      
      if (this.options.colorField && this.options.colorScale) {
        this.buildColorScale(tile.tileData);
      }
    }

    buildColorScale(data) {
      if (!this.colors) this.colors = {};

      const colorField = this.options.colorField;
      const colorScale = this.options.colorScale;
      
      if (colorScale.type === 'categorical') {
        let colorMap = colorScale.map;
        
        if (!colorMap) {
          const uniqueValues = [...new Set(data.map(p => p[colorField]).filter(v => v != null))];
          const colorScheme = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
          colorMap = {};
          uniqueValues.forEach((value, i) => {
            colorMap[value] = colorScheme[i % colorScheme.length];
          });
        }

        for (const point of data) {
          const value = point[colorField];
          const colorStr = colorMap[value] || 'black';
          this.colors[point.uid] = this.colorToHex(colorStr);
        }
      } else if (colorScale.type === 'quantitative') {
        const values = data.map(p => p[colorField]).filter(v => v != null);
        const min = colorScale.min !== undefined ? colorScale.min : Math.min(...values);
        const max = colorScale.max !== undefined ? colorScale.max : Math.max(...values);
        
        const colors = colorScale.colors || ['white', 'black'];
        const scale = d3Scale.scaleLinear()
          .domain(colors.map((_, i) => min + (max - min) * i / (colors.length - 1)))
          .range(colors);
        
        for (const point of data) {
          const value = point[colorField];
          if (value == null) {
            this.colors[point.uid] = 0x000000;
            continue;
          }
          this.colors[point.uid] = this.colorToHex(scale(value));
        }
      }
    }

    colorToHex(colorStr) {
      const rgb = d3Color.color(colorStr).rgb();
      return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
    }

    getPointColor(point) {
      return this.colors[point.uid] || 0x000000;
    }

    getPointSize(point) {
      const sizeField = this.options.sizeField;
      const defaultSize = this.options.defaultSize || POINT_WIDTH;
      return sizeField && point[sizeField] != null ? point[sizeField] : defaultSize;
    }

    getMouseOverHtml(trackX, trackY) {
      const uids = this.getMouseOverUids(trackX, trackY);
      if (!uids || !uids[0] || !this.pointData[uids[0]]) return '';
      
      const point = this.pointData[uids[0]];
      const entries = Object.entries(point)
        .filter(([key]) => key !== 'uid')
        .map(([key, value]) => `<tr><td style="padding: 2px 8px 2px 0; font-weight: bold;">${key}:</td><td style="padding: 2px 0;">${value}</td></tr>`)
        .join('');
      
      return `<table style="font-size: 12px;">${entries}</table>`;
    }

  getMouseOverUids(trackX, trackY) {
    if (!this.tilesetInfo) {
      return null;
    }

    let closestUid = null;
    let minDistance = 5;

    for (const uid in this.pointPositions) {
      const [pointX, pointY] = this.pointPositions[uid];
      const distance = Math.sqrt((trackX - pointX) ** 2 + (trackY - pointY) ** 2);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestUid = uid;
      }
    }

    return [closestUid];
  }

  itemsHovered(uids) {
    this.hoverGraphics.clear();
    if (!uids || !uids.length) return;
    
    this.pMain.setChildIndex(this.hoverGraphics, this.pMain.children.length - 1);
    this.hoverGraphics.lineStyle(2, 0xff0000);
    for (const uid of uids) {
      if (uid && this.pointPositions[uid] && this.pointData[uid]) {
        const [pointX, pointY] = this.pointPositions[uid];
        const size = this.getPointSize(this.pointData[uid]);
        if (this.options.pointShape === 'circle') {
          this.hoverGraphics.drawCircle(pointX, pointY, (size / 2) + 2);
        } else {
          this.hoverGraphics.drawRect(pointX - (size / 2) - 2, pointY - (size / 2) - 2, size + 4, size + 4);
        }
      }
    }
    this.animate();
  }

    getLabelOffset(boxWidth, boxHeight, uid) {
      const position = this.options.labelPosition || 'top-right';
      let pos = position;
      
      if (position === 'random') {
        if (!this.labelPositions[uid]) {
          const positions = ['top-right', 'top-left', 'bottom-left', 'bottom-right'];
          this.labelPositions[uid] = positions[Math.floor(Math.random() * 4)];
        }
        pos = this.labelPositions[uid];
      }
      
      const offsets = {
        'top-right': [0, -boxHeight],
        'top-left': [-boxWidth, -boxHeight],
        'bottom-left': [-boxWidth, 0],
        'bottom-right': [0, 0]
      };
      return offsets[pos] || offsets['top-right'];
    }

    getText(tile, point) {
      if (!this.texts) this.texts = {};
      if (!this.boxes) this.boxes = {};
      

      if (!(point.uid in this.texts)) {
        // console.log('point:', point);

        // const text = new PIXI.Text(`${point.data.num}\n${point.data.factors.join(",")}`, {
        const labelField = this.options.labelField || 'data';

        const text = new PIXI.Text(`${point[labelField]}`, {
          fontSize: '13px',
          fontFamily: 'Arial',
          fill: 0x000000,
          stroke: 0xffffff,
          strokeThickness: 3,
        });
        this.texts[point.uid] = { text, importance: point.importance };

        tile.graphics.addChild(text);
        text.updateTransform();

        const b = text.getBounds();
        const box = [b.x, b.y, b.x + b.width, b.y + b.height];
        this.boxes[point.uid] = box;
        // console.log('box:', box);

        this.allTexts = Object.values(this.texts);
        this.allBoxes = Object.values(this.boxes);

        return text;
      } else {
        return this.texts[point.uid].text;
      }
    }

    destroyTile(tile) {
      try {
        for (const point of tile.tileData) {
          if (point.uid in this.texts) {
            // console.log('remove:', tile.tileId, point.uid);
            tile.graphics.removeChild(this.texts[point.uid]);

            delete this.texts[point.uid];
            delete this.boxes[point.uid];
            delete this.colors[point.uid];
            delete this.pointData[point.uid];
            delete this.labelPositions[point.uid];
            delete this.pointPositions[point.uid];
          }
        }
      } catch (err) {

      }
    }

    calculateVisibleTiles() {
      const visibleTiles = super.calculateVisibleTiles();

      return visibleTiles;
    }

    draw() {
      super.draw();

      this.allBoxes = Object.values(this.boxes);
      this.allTexts = Object.values(this.texts);

      this.hideOverlaps(this.allBoxes, this.allTexts);
    }

    drawTile(tile) {
      tile.graphics.clear();

      if (!tile.tileData.length)
        return;

      // console.log('draw:', tile.tileId);
      for (const point of tile.tileData) {
        // console.log('point.pos:', point.pos);
        // add text showing the tile position

        const xField = this.options.xPosField || 'x';
        const yField = this.options.yPosField || 'y';

        const xPos = this._xScale(point[xField]);
        const yPos = this._yScale(point[yField]);

        const color = this.getPointColor(point);
        const size = this.getPointSize(point);
        tile.graphics.beginFill(color);
        if (this.options.pointShape === 'circle') {
          tile.graphics.drawCircle(xPos, yPos, size / 2);
        } else {
          tile.graphics.drawRect(xPos - (size / 2),
            yPos - (size / 2), size, size);
        }
        tile.graphics.endFill();

        const text = this.getText(tile, point);

        const box = this.boxes[point.uid];
        const boxWidth = box[2] - box[0];
        const boxHeight = box[3] - box[1];
        const [offsetX, offsetY] = this.getLabelOffset(boxWidth, boxHeight, point.uid);

        text.x = xPos + offsetX;
        text.y = yPos + offsetY;

        box[0] = xPos + offsetX;
        box[1] = yPos + offsetY;
        box[2] = xPos + offsetX + boxWidth;
        box[3] = yPos + offsetY + boxHeight;
        
        this.pointPositions[point.uid] = [xPos, yPos];
      }
    }

    zoomed(newXScale, newYScale) {
      this.xScale(newXScale);
      this.yScale(newYScale);

      this.refreshTiles();
      this.draw();
    }

    hideOverlaps(allBoxes, allTexts) {
      // store the bounding boxes of the text objects so we can
      // calculate overlaps
      // console.log('allTexts.length', allTexts.length);

      /*
          let allBoxes = allTexts.map(val => {
              let text = val.text;
              text.updateTransform();
              let b = text.getBounds();
              let box = [b.x, b.y, b.x + b.width, b.y + b.height];

              return box;
          });
          */
      if (allBoxes && allTexts && allBoxes.length !== allTexts.length) {
        console.warn('uneven lengths:', allBoxes.length, allTexts.length)
      }

      // turn on all texts so that we can hide the ones that overlap
      if (allTexts) {
        for (let i = 0; i < allTexts.length; i++) {
          allTexts[i].text.visible = true;
        }
      }

      boxIntersect(allBoxes, (i, j) => {
        if (allTexts[i].importance > allTexts[j].importance) {
          // console.log('hiding:', allTexts[j].caption)
          allTexts[j].text.visible = false;
        } else {
          // console.log('hiding:', allTexts[i].caption)
          allTexts[i].text.visible = false;
        }
      });
    }

  /**
   * Capture click events. x and y are relative to the track position
   * @template T
   * @param {number} x - X position of the click event.
   * @param {number} y - Y position of the click event.
   * @param {T} evt - The event.
   * @return {{ type: 'generic', event: T, payload: null }}
   */
  click(x, y, evt) {
    const uids = this.getMouseOverUids(x, y);
    const hoveredUid = uids && uids[0];
    const payload = hoveredUid ? this.pointData[hoveredUid] : null;

    return {
      type: 'labelled-points',
      event: evt,
      payload,
    };
  }

  /** There was a click event outside the track * */
  clickOutside() {}


    exportSVG() {
      let track = null;
      let base = null;

      if (super.exportSVG) {
        [base, track] = super.exportSVG();
      } else {
        base = document.createElement('g');
        track = base;
      }
      const output = document.createElement('g');
      output.setAttribute(
        'transform',
        `translate(${this.position[0]},${this.position[1]})`
      );

      track.appendChild(output);
      const textOutput = document.createElement('g');
      const rectOutput = document.createElement('g');

      output.appendChild(textOutput);
      output.appendChild(rectOutput);

      for (const textObj of this.allTexts) {
        const text = textObj.text;

        if (!text.visible) {
          continue;
        }

        const g = document.createElement('g');
        const t = document.createElement('text');


        textOutput.appendChild(g);
        g.appendChild(t);
        g.setAttribute(
          'transform',
          `translate(${text.x},${text.y})`
        );

        t.setAttribute('text-anchor', 'start');
        t.setAttribute('dy', '16px');
        t.setAttribute('dx', '4px')
        t.setAttribute('font-family', 'Arial');
        t.setAttribute('font-size', 12);

        t.innerHTML = text.text;
      }

      for (const boxId in this.boxes) {
        const box = this.boxes[boxId];
        const color = this.colors[boxId] || 0x000000;
        const size = this.pointData[boxId] ? this.getPointSize(this.pointData[boxId]) : (this.options.defaultSize || POINT_WIDTH);
        
        if (this.options.pointShape === 'circle') {
          const c = document.createElement('circle');
          c.setAttribute('cx', box[0]);
          c.setAttribute('cy', box[1]);
          c.setAttribute('r', size / 2);
          c.setAttribute('fill', `#${color.toString(16).padStart(6, '0')}`);
          rectOutput.appendChild(c);
        } else {
          const r = document.createElement('rect');
          r.setAttribute('x', box[0]);
          r.setAttribute('y', box[1]);
          r.setAttribute('width', size);
          r.setAttribute('height', size);
          r.setAttribute('fill', `#${color.toString(16).padStart(6, '0')}`);
          rectOutput.appendChild(r);
        }
      }

      return [base, base];
    }

  }

  return new LabelledPointsTrackClass(...args);
};

const icon = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="1.5"><path d="M4 2.1L.5 3.5v12l5-2 5 2 5-2v-12l-5 2-3.17-1.268" fill="none" stroke="currentColor"/><path d="M10.5 3.5v12" fill="none" stroke="currentColor" stroke-opacity=".33" stroke-dasharray="1,2,0,0"/><path d="M5.5 13.5V6" fill="none" stroke="currentColor" stroke-opacity=".33" stroke-width=".9969299999999999" stroke-dasharray="1.71,3.43,0,0"/><path d="M9.03 5l.053.003.054.006.054.008.054.012.052.015.052.017.05.02.05.024 4 2 .048.026.048.03.046.03.044.034.042.037.04.04.037.04.036.042.032.045.03.047.028.048.025.05.022.05.02.053.016.053.014.055.01.055.007.055.005.055v.056l-.002.056-.005.055-.008.055-.01.055-.015.054-.017.054-.02.052-.023.05-.026.05-.028.048-.03.046-.035.044-.035.043-.038.04-4 4-.04.037-.04.036-.044.032-.045.03-.046.03-.048.024-.05.023-.05.02-.052.016-.052.015-.053.012-.054.01-.054.005-.055.003H8.97l-.053-.003-.054-.006-.054-.008-.054-.012-.052-.015-.052-.017-.05-.02-.05-.024-4-2-.048-.026-.048-.03-.046-.03-.044-.034-.042-.037-.04-.04-.037-.04-.036-.042-.032-.045-.03-.047-.028-.048-.025-.05-.022-.05-.02-.053-.016-.053-.014-.055-.01-.055-.007-.055L4 10.05v-.056l.002-.056.005-.055.008-.055.01-.055.015-.054.017-.054.02-.052.023-.05.026-.05.028-.048.03-.046.035-.044.035-.043.038-.04 4-4 .04-.037.04-.036.044-.032.045-.03.046-.03.048-.024.05-.023.05-.02.052-.016.052-.015.053-.012.054-.01.054-.005L8.976 5h.054zM5 10l4 2 4-4-4-2-4 4z" fill="currentColor"/><path d="M7.124 0C7.884 0 8.5.616 8.5 1.376v3.748c0 .76-.616 1.376-1.376 1.376H3.876c-.76 0-1.376-.616-1.376-1.376V1.376C2.5.616 3.116 0 3.876 0h3.248zm.56 5.295L5.965 1H5.05L3.375 5.295h.92l.354-.976h1.716l.375.975h.945zm-1.596-1.7l-.592-1.593-.58 1.594h1.172z" fill="currentColor"/></svg>';

LabelledPointsTrack.config = {
  type: 'labelled-points-track',
  datatype: ['scatter-point'],
  orientation: '2d',
  name: 'LabelledPointsTrack',
  thumbnail: new DOMParser().parseFromString(icon, 'text/xml').documentElement,
  availableOptions: [
    'labelField',
    'xPosField',
    'yPosField',
    'colorField',
    'colorScale',
    'pointShape',
    'sizeField',
    'defaultSize',
    'labelPosition',
  ],
  defaultOptions: {
    'pointShape': 'circle',
    'sizeField': null,
    'defaultSize': POINT_WIDTH,
    'labelPosition': 'top-right'
  },
  optionsInfo: {
    pointShape: {
      name: 'Point Shape',
      inlineOptions: {
        circle: {
          value: 'circle',
          name: 'Circle',
        },
        square: {
          value: 'square',
          name: 'Square',
        },
      },
    },
    defaultSize: {
      name: 'Default Point Size',
      inlineOptions: {
        1: { value: 1, name: '1' },
        2: { value: 2, name: '2' },
        3: { value: 3, name: '3' },
        5: { value: 5, name: '5' },
        8: { value: 8, name: '8' },
        13: { value: 13, name: '13' },
        21: { value: 21, name: '21' },
      },
    },
    labelPosition: {
      name: 'Label Position',
      inlineOptions: {
        'top-right': { value: 'top-right', name: 'Top Right' },
        'top-left': { value: 'top-left', name: 'Top Left' },
        'bottom-left': { value: 'bottom-left', name: 'Bottom Left' },
        'bottom-right': { value: 'bottom-right', name: 'Bottom Right' },
        'random': { value: 'random', name: 'Random' },
      },
    },
  }
};

export default LabelledPointsTrack;
