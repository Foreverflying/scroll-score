
const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

type PlayContext = {
    pageAt: number,
    lineAt: number,
    barAt: number,
    lineIndexInPage: number,
    barIndexInLine: number,
    beatIndexInBar: number,
    lineTotalMilSeconds: number,
    linePassedMilSeconds: number,
    currentBeatMilSeconds: number,
    stop: boolean
}

type playCallBack = (context: PlayContext, bar: BarInfo) => Promise<void>

class BarInfo {
    constructor(lineInfo: LineInfo) {
        this.lineInfo = lineInfo
    }

    readonly lineInfo: LineInfo

    async play(context: PlayContext, cd: playCallBack): Promise<boolean> {
        const milSecondsPerBeat = 60000 / this.beatsPerMinute
        for (let i = 0; i < this.barBeats; i++) {
            context.beatIndexInBar = i
            context.currentBeatMilSeconds = milSecondsPerBeat
            await cd(context, this)
            context.linePassedMilSeconds += milSecondsPerBeat
            if (context.stop) {
                return false
            }
        }
        context.barAt++
        return true
    }

    setLineInfo(barBeats: number, beatsPerMinute: number) {
        if (barBeats) {
            this._barBeats = barBeats
        }
        if (beatsPerMinute) {
            this._beatsPerMinute = beatsPerMinute
        }
    }

    get totalMilSeconds() {
        const milSecondsPerBeat = 60000 / this.beatsPerMinute
        return milSecondsPerBeat * this.barBeats
    }

    get barBeats() {
        return this._barBeats || this.lineInfo.pageInfo.scoreInfo.barBeats
    }

    get beatsPerMinute() {
        return this._beatsPerMinute || this.lineInfo.pageInfo.scoreInfo.beatsPerMinute
    }


    private _barBeats?: number
    private _beatsPerMinute?: number
}

class LineInfo {
    constructor(pageInfo: PageInfo) {
        this.pageInfo = pageInfo
        this._bars = []
        const barsInLine = this.barsInLine
        for (let i = 0; i < barsInLine; i++) {
            this._bars.push(new BarInfo(this))
        }
    }

    readonly pageInfo: PageInfo

    async play(context: PlayContext, cd: playCallBack): Promise<boolean> {
        context.lineTotalMilSeconds = this.totalMilSeconds
        context.linePassedMilSeconds = 0
        context.barIndexInLine = 0
        for (const bar of this._bars) {
            const ret = await bar.play(context, cd)
            if (!ret) {
                return false
            }
            context.barIndexInLine++
        }
        context.lineAt++
        return true
    }

    getBarAt(pos: number) {
        return this._bars[pos - 1]
    }

    setLineInfo(barsInLine: number) {
        const oldVal = this.barsInLine
        if (!barsInLine) {
            delete this._barsInLine
            barsInLine = this.barsInLine
        } else {
            this._barsInLine = barsInLine
        }
        if (barsInLine > oldVal) {
            for (let i = oldVal; i < barsInLine; i++) {
                this._bars.push(new BarInfo(this))
            }
        } else {
            for (let i = barsInLine; i < oldVal; i++) {
                this._bars.pop()
            }
        }
    }

    get barsCount() {
        return this._bars.length
    }

    get barsInLine() {
        return this._barsInLine || this.pageInfo.scoreInfo.barsInLine
    }

    get totalMilSeconds() {
        let ret = 0
        for (const bar of this._bars) {
            ret += bar.totalMilSeconds
        }
        return ret
    }

    private _bars: BarInfo[]
    private _barsInLine?: number
}

class PageInfo {
    constructor(scoreInfo: ScoreInfo, urls: string[]) {
        this.scoreInfo = scoreInfo
        this.urls = urls
        this._lines = []
        const linesInPage = this.linesInPage
        for (let i = 0; i < linesInPage; i++) {
            this._lines.push(new LineInfo(this))
        }
    }

    readonly scoreInfo: ScoreInfo
    readonly urls: string[]

    async play(context: PlayContext, cd: playCallBack): Promise<boolean> {
        context.lineIndexInPage = 0
        for (const line of this._lines) {
            const ret = await line.play(context, cd)
            if (!ret) {
                return false
            }
            context.lineIndexInPage++
        }
        context.pageAt++
        return true
    }

    getLineAt(pos: number) {
        return this._lines[pos - 1]
    }

    setPageInfo(linesInPage: number) {
        const oldVal = this.linesInPage
        if (!linesInPage) {
            delete this._linesInPage
            linesInPage = this.linesInPage
        } else {
            this._linesInPage = linesInPage
        }
        if (linesInPage > oldVal) {
            for (let i = oldVal; i < linesInPage; i++) {
                this._lines.push(new LineInfo(this))
            }
        } else {
            for (let i = linesInPage; i < oldVal; i++) {
                this._lines.pop()
            }
        }
    }

    get linesCount() {
        return this._lines.length
    }

    get linesInPage() {
        return this._linesInPage || this.scoreInfo.linesInPage
    }

    private _lines: LineInfo[]
    private _linesInPage?: number
}

class ScoreInfo {
    constructor(pagesUrls: string[][], linesInPage: number, barsInLine: number, barBeats: number, beatsPerMinute: number) {
        this._linesInPage = linesInPage
        this._barsInLine = barsInLine
        this._barBeats = barBeats
        this._beatsPerMinute = beatsPerMinute
        this._pages = []
        for (let i = 0; i < pagesUrls.length; i++) {
            this._pages.push(new PageInfo(this, pagesUrls[i]))
        }
    }

    startPlay(cd: playCallBack): PlayContext {
        const context: PlayContext = {
            pageAt: 0,
            lineAt: 0,
            barAt: 0,
            lineIndexInPage: 0,
            barIndexInLine: 0,
            beatIndexInBar: 0,
            lineTotalMilSeconds: 0,
            linePassedMilSeconds: 0,
            currentBeatMilSeconds: 0,
            stop: false
        }
        const play = async () => {
            for (const page of this._pages) {
                const ret = await page.play(context, cd)
                if (!ret) {
                    return context
                }
            }
        }
        play()
        return context
    }

    getPageAt(pos: number) {
        return this._pages[pos - 1]
    }

    setPageInfo(linesInPage: number, pageFrom: number, pageTo?: number) {
        pageTo = pageTo || pageFrom
        for (let i = pageFrom; i <= pageTo; i++) {
            const pageInfo = this.getPageAt(i)
            pageInfo.setPageInfo(linesInPage)
        }
    }

    setLineInfo(barsInLine: number, lineFrom: number[], lineTo?: number[]) {
        lineTo = lineTo || lineFrom
        let page = lineFrom[0]
        let line = lineFrom[1]
        while (page <= lineTo[0]) {
            const pageInfo = this.getPageAt(page)
            const endLine = page === lineTo[0] ? lineTo[1] : pageInfo.linesCount
            while (line <= endLine) {
                const lineInfo = pageInfo.getLineAt(line)
                lineInfo.setLineInfo(barsInLine)
                line++
            }
            page++
            line = 1
        }
    }

    setBarInfo(barBeats: number, beatsPerMinute: number, barFrom: number[], barTo?: number[]) {
        barTo = barTo || barFrom
        let page = barFrom[0]
        let line = barFrom[1]
        let bar = barFrom[2]
        while (page <= barTo[0]) {
            const pageInfo = this.getPageAt(page)
            const endLine = page === barTo[0] ? barTo[1] : pageInfo.linesCount
            while (line <= endLine) {
                const lineInfo = pageInfo.getLineAt(line)
                const endBar = page === barTo[0] && line === barTo[1] ? barTo[2] : lineInfo.barsInLine
                while (bar <= endBar) {
                    const barInfo = lineInfo.getBarAt(bar)
                    barInfo.setLineInfo(barBeats, beatsPerMinute)
                    bar++
                }
                line++
                bar = 1
            }
            page++
            line = 1
        }
    }

    get pagesCount() {
        return this._pages.length
    }

    get linesInPage() {
        return this._linesInPage
    }

    get barsInLine() {
        return this._barsInLine
    }

    get barBeats() {
        return this._barBeats
    }

    get beatsPerMinute() {
        return this._beatsPerMinute
    }

    private _pages: PageInfo[]
    private _linesInPage: number
    private _barsInLine: number
    private _barBeats: number
    private _beatsPerMinute: number
}

const preventScroll = (e: Event) => e.preventDefault()

class ScorePlayer {
    constructor(container: HTMLElement) {
        this._container = container
    }

    createPage(pageUrls: string[][]) {
        const padding = `${document.body.clientHeight / 2 - 30}px`
        this._container.style.paddingTop = padding
        this._container.style.paddingBottom = padding
        for (let i = 0; i < pageUrls.length; i++) {
            const div = document.createElement('div')
            div.style.display = "flex"
            div.style.flexWrap = "nowrap"
            div.style.justifyContent = "center"
            this._container.appendChild(div)
            for (let j = 0; j < pageUrls[i].length; j++) {
                const image = document.createElement('img')
                image.setAttribute('src', pageUrls[i][j])
                div.appendChild(image)
            }
        }
    }

    togglePlay(score: ScoreInfo): boolean {
        if (!this._container.firstElementChild) {
            return false
        }
        if (this._playContext) {
            this._playContext.stop = true
            delete this._playContext
            window.removeEventListener('wheel', preventScroll)
            return true
        }
        window.addEventListener('wheel', preventScroll, { passive: false })
        const startScrollPos = window.scrollY
        let pos = 0
        const scrollInterval = 50
        this._playContext = score.startPlay(async (context, bar) => {
            const pageHeight = (this._container.children[context.pageAt] as HTMLElement).offsetHeight
            const lineHeight = pageHeight / bar.lineInfo.pageInfo.linesInPage
            if (pos + lineHeight <= startScrollPos) {
                const beatHeight = lineHeight * context.currentBeatMilSeconds / context.lineTotalMilSeconds
                pos += beatHeight
                return
            }
            const start = new Date().getTime()
            let leftMilSeconds = context.currentBeatMilSeconds
            let delta = 0
            do {
                const sleepMilSeconds = leftMilSeconds > scrollInterval ? scrollInterval : leftMilSeconds
                await sleep(sleepMilSeconds)
                if (context.stop) {
                    return
                }
                const now = new Date().getTime()
                const sleepTime = now - start
                delta = lineHeight * sleepTime / context.lineTotalMilSeconds
                window.scroll({
                    top: pos + delta,
                    left: 0,
                    behavior: 'smooth'
                })
                leftMilSeconds = context.currentBeatMilSeconds - sleepTime
            } while (leftMilSeconds >= 0)
            pos += delta
        })
        return true
    }

    isPlaying() {
        return !!this._playContext
    }

    private _container: HTMLElement
    private _playContext?: PlayContext
}
