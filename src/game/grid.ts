/**
 * Uniform spatial hash rebuilt each tick with a counting sort.
 * Items are plain indices into caller-owned flat arrays, so building is
 * allocation-free and queries are cache friendly.
 */
export class Grid {
  readonly cell: number;
  readonly cols: number;
  readonly half: number;
  private starts: Int32Array;
  private cursor: Int32Array;
  private items = new Int32Array(1024);
  private cellOf = new Int32Array(1024);

  constructor(cell: number, half: number) {
    this.cell = cell;
    this.half = half;
    this.cols = Math.ceil((half * 2) / cell);
    const n = this.cols * this.cols;
    this.starts = new Int32Array(n + 1);
    this.cursor = new Int32Array(n);
  }

  private cellIndex(x: number, y: number): number {
    let cx = Math.floor((x + this.half) / this.cell);
    let cy = Math.floor((y + this.half) / this.cell);
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.cols) cy = this.cols - 1;
    return cy * this.cols + cx;
  }

  build(n: number, xs: Float32Array, ys: Float32Array): void {
    if (this.items.length < n) {
      this.items = new Int32Array(n * 2);
      this.cellOf = new Int32Array(n * 2);
    }
    const cur = this.cursor;
    cur.fill(0);
    for (let i = 0; i < n; i++) {
      const c = this.cellIndex(xs[i], ys[i]);
      this.cellOf[i] = c;
      cur[c]++;
    }
    let s = 0;
    for (let c = 0; c < cur.length; c++) {
      this.starts[c] = s;
      s += cur[c];
      cur[c] = this.starts[c];
    }
    this.starts[cur.length] = s;
    for (let i = 0; i < n; i++) this.items[cur[this.cellOf[i]]++] = i;
  }

  /** Visits every item in cells overlapping the square around (x,y). Return true from fn to stop early. */
  query(x: number, y: number, r: number, fn: (i: number) => boolean | void): boolean {
    const c = this.cell;
    const h = this.half;
    const max = this.cols - 1;
    const x0 = Math.max(0, Math.floor((x - r + h) / c));
    const x1 = Math.min(max, Math.floor((x + r + h) / c));
    const y0 = Math.max(0, Math.floor((y - r + h) / c));
    const y1 = Math.min(max, Math.floor((y + r + h) / c));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const ci = cy * this.cols + cx;
        const end = this.starts[ci + 1];
        for (let k = this.starts[ci]; k < end; k++) {
          if (fn(this.items[k]) === true) return true;
        }
      }
    }
    return false;
  }
}
