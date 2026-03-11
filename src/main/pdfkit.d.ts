declare module 'pdfkit' {
  interface PDFDocumentOptions {
    margin?: number;
    margins?: { top: number; bottom: number; left: number; right: number };
    size?: string | [number, number];
    layout?: 'portrait' | 'landscape';
  }

  interface PDFTextOptions {
    align?: 'left' | 'center' | 'right' | 'justify';
    width?: number;
    height?: number;
    underline?: boolean;
    continued?: boolean;
  }

  interface PDFFontOptions {
    family?: string;
    src?: string;
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    pipe<T extends NodeJS.WritableStream>(destination: T): PDFDocument;
    end(): void;

    // Text methods - PDFKit supports multiple signatures
    text(text: string, x?: number, y?: number, options?: PDFTextOptions): this;
    text(text: string, options?: PDFTextOptions): this;

    // Font
    font(name: string, size?: number): this;
    fontSize(size: number): this;
    registerFont(name: string, path?: string, family?: string): this;

    // Positioning
    moveDown(lines?: number): this;
    moveUp(lines?: number): this;
    moveTo(x: number, y: number): this;

    // State properties
    x: number;
    y: number;

    // Pages
    addPage(options?: PDFDocumentOptions): this;

    // Graphics
    lineWidth(width: number): this;
    lineCap(style: 'butt' | 'round' | 'square'): this;
    lineJoin(style: 'miter' | 'round' | 'bevel'): this;
    rect(x: number, y: number, width: number, height: number): this;
    fill(color?: string | [number, number, number]): this;
    stroke(color?: string | [number, number, number]): this;
    fillAndStroke(fill: string | [number, number, number], stroke?: string | [number, number, number]): this;

    // Paths
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    curveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this;
    closePath(): this;

    // Images
    image(src: string | Buffer, x?: number, y?: number, options?: { width?: number; height?: number; scale?: number }): this;

    // Annotations/Links
    link(x: number, y: number, width: number, height: number, url: string): this;
  }

  export = PDFDocument;
}
