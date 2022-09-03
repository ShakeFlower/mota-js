///<reference path='../public/runtime.d.ts'/>

declare let fs: Fs
declare let LZString: LZString

interface Fs {
    deleteFile: (path: string, callback: FsCallback) => void
    mkdir: (path: string, callback: FsCallback) => void
    readdir: (path: string, callback: (err?: string, data?: string[]) => void) => void
    writeMultiFiles: (fileNames: string[], datastrs: string[], callback: FsCallback) => void
    writeFile: (fileName: string, datastr: string, encoding: 'utf-8' | 'base64', callback?: FsCallback) => void
    readFile: (fileName: string, encoding: 'utf-8' | 'base64', callback: FsCallback) => void
}

interface LZString {
    compressToBase64: (data: string) => string
    decompressFromBase64: (data: string) => string
}

interface DrawDataOf<K extends keyof SpriteDrawInfoMap> {
    type: K
    sprite: string
    action: BaseAction<K>
}

interface SpriteDrawInfoMap {
    wait: Wait
    transition: Transition
    create: SpriteCreate
    del: void
    move: SpriteMove
    resize: SpriteResize
    rotate: SpriteRotate
    clear: SpriteClear
    css: SpriteCss
    composite: SpriteComposite
    filter: SpriteFilter
    shadow: SpriteShadow
    textInfo: SpriteTextInfo
    opacity: SpriteOpacity
    save: void
    restore: void
    line: SpriteLine
    arc: SpriteArc
    circle: SpriteCircle
    rect: SpriteRect
    roundRect: SpriteRoundRect
    polygon: SpritePolygon
    ellipse: SpriteEllipse
    arrow: SpriteArrow
    bezierCurve: SpriteBezierCurve
    image: SpriteImage
    icon: SpriteIcon
    winskin: SpriteWinskin
    text: SpriteText
    textContent: SpriteTextContent
}

interface Wait {
    time: number
}

interface Transition {
    style: string
    time: string
    delay: string
    mode: ('linear' | 'ease-in' | 'ease-out' | 'ease-in-out')
}

interface SpriteCreate {
    x: number
    y: number
    w: number
    h: number
    z: number
    name: string
}

interface SpriteMove {
    x: number
    y: number
    isDelta: boolean
}

interface SpriteResize {
    w: number
    h: number
    styleOnly: boolean
}

interface SpriteRotate {
    cx: number
    cy: number
    angle: number
}

interface SpriteClear {
    x?: number
    y?: number
    w?: number
    h?: number
}

interface SpriteCss {
    data: string
}

interface SpriteComposite {
    mode: GlobalCompositeOperation
}

interface SpriteFilter {
    data: string
}

interface SpriteShadow {
    shadowBlur?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
}

interface SpriteTextInfo {
    direction?: CanvasDirection;
    textAlign?: CanvasTextAlign;
    textBaseline?: CanvasTextBaseline;
}

interface SpriteOpacity {
    opacity: number
}

interface BaseShape {
    lineWidth: number
    style: string
}

interface Stroke {
    stroke: boolean
}

interface BaseLocatedShape extends BaseShape {
    x: number
    y: number
}

interface SpriteLine extends BaseShape {
    x1: number
    x2: number
    y1: number
    y2: number
}

interface SpriteArc extends BaseLocatedShape, Stroke {
    r: number
    start: number
    end: number
}

interface SpriteCircle extends BaseLocatedShape, Stroke {
    r: number
}

interface SpriteRect extends BaseLocatedShape, Stroke {
    w: number
    h: number
}

interface SpriteRoundRect extends BaseLocatedShape, Stroke {
    w: number
    h: number
    r: number
}

interface SpritePolygon extends BaseShape, Stroke {
    path: [number, number][]
}

interface SpriteEllipse extends BaseLocatedShape, Stroke {
    a: number
    b: number
    angle: number
}

interface SpriteArrow extends BaseShape {
    x1: number
    x2: number
    y1: number
    y2: number
}

interface SpriteBezierCurve extends BaseShape {
    cp1x: number
    cp2x: number
    cp1y: number
    cp2y: number
    sx: number
    sy: number
    x: number
    y: number
}

interface SpriteImage {
    img: string | CanvasImageSource
    dx: number
    dy: number
    dw?: number
    dh?: number
    sx?: number
    sy?: number
    sw?: number
    sh?: number
}

interface SpriteIcon {
    icon: string
    x: number
    y: number
    w: number
    h: number
    frame: number
}

interface SpriteWinskin {
    img: string
    x: number
    y: number
    w: number
    h: number
}

interface SpriteText {
    x: number
    y: number
    stroke: boolean
    font: string
    fontSize: string
    style: string | CanvasGradient | CanvasPattern
    strokeStyle: string | CanvasGradient | CanvasPattern
    italic: boolean
    fontWeight: number | 'bold' | 'normal' | 'bolder' | 'lighter'
    str: string
    maxWidth: number
}

interface SpriteTextContent {
    content: string
    left: number
    top: number
    maxWidth: number
    color: number
    align: 'left' | 'center' | 'right'
    fontSize: number
    lineHeight: number
    time: number
    font: string
    letterSpacing: number
    bold: boolean
    italic: boolean
}

type SpriteDrawInfo<K extends Key> = SpriteDrawInfoMap[K]

type FsCallback = (err?: string, data?: string) => void

type UiMode = 'edit' | 'uiList'

type Key = keyof SpriteDrawInfoMap