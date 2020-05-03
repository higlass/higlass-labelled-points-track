import boxIntersect from 'box-intersect';
import * as PIXI from 'pixi.js';
import slugid from 'slugid';

const POINT_WIDTH = 6;

const LabelledPointsTrack = (HGC, ...args) => {
  if (!new.target) {
    throw new Error(
      'Uncaught TypeError: Class constructor cannot be invoked without "new"',
    );
  }

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
          }
        } catch (err) {
          console.warn('tile.tileData is not iterable:', tile.tileData);
      }
    }

    getText(tile, point) {
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

        tile.graphics.beginFill(0x000000);
        tile.graphics.drawRect(xPos - (POINT_WIDTH / 2),
          yPos - (POINT_WIDTH / 2), POINT_WIDTH, POINT_WIDTH);

        const text = this.getText(tile, point);

        text.x = xPos;
        text.y = yPos;

        const box = this.boxes[point.uid];

        const boxWidth = box[2] - box[0];
        const boxHeight = box[3] - box[1];

        box[0] = xPos;
        box[1] = yPos;
        box[2] = xPos + boxWidth;
        box[3] = yPos + boxHeight;
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

      const result = boxIntersect(allBoxes, (i, j) => {
        if (allTexts[i].importance > allTexts[j].importance) {
          // console.log('hiding:', allTexts[j].caption)
          allTexts[j].text.visible = false;
        } else {
          // console.log('hiding:', allTexts[i].caption)
          allTexts[i].text.visible = false;
        }
      });
    }


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
        const r = document.createElement('rect');

        r.setAttribute('x', box[0]);
        r.setAttribute('y', box[1]);
        r.setAttribute('width', POINT_WIDTH);
        r.setAttribute('height', POINT_WIDTH);

        r.setAttribute('fill', 'black');

        rectOutput.appendChild(r);
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
  ],
  defaultOptions: {
  },
};

export default LabelledPointsTrack;
