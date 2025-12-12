import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const BASE_URL = 'https://www.mangaworld.mx'

export class MangaWorldParser {

    /**
     * Data Parser Robusto (sostituisce quello basato su replace)
     */
    private parseItalianDate(dateStr: string): Date {
        const months: { [key: string]: number } = {
            'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
            'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11,
            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
        }

        dateStr = dateStr.toLowerCase().trim()
        if (dateStr.includes('oggi')) return new Date()
        if (dateStr.includes('ieri')) {
            const d = new Date()
            d.setDate(d.getDate() - 1)
            return d
        }

        const parts = dateStr.split(' ')
        if (parts.length >= 3) {
            const day = parseInt(parts[0] ?? '1')
            const monthName = parts[1] ?? ''
            const year = parseInt(parts[2] ?? new Date().getFullYear().toString())
            if (months[monthName] !== undefined) return new Date(year, months[monthName]!, day)
        }
        return new Date()
    }

    private cleanTitle(title: string): string {
        if (!title) return 'Unknown'
        title = title.trim()
        // Fix duplicazione titoli (NarutoNaruto)
        if (title.length > 0 && title.length % 2 === 0) {
            const half = title.substring(0, title.length / 2)
            if (half === title.substring(title.length / 2)) {
                return half
            }
        }
        return title
    }

    private getImageSrc(element: any): string {
        let image = element.attr('src') ?? ''
        
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = element.attr('data-src') ?? element.attr('data-original') ?? ''
        }
        
        if (image && image.startsWith('/')) {
            image = BASE_URL + image
        }

        return image || 'https://paperback.moe/icons/logo-alt.svg'
    }

    // --- PARSERS ---

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const infoBox = $('.comic-info')
        
        const rawTitle = $('.comic-title', infoBox).text().trim()
        const title = this.cleanTitle(rawTitle)
        
        const image = this.getImageSrc($('.comic-thumb img', infoBox))

        let desc = $('#noidungm').text().trim()
        if (!desc) desc = $('.description').text().trim()

        let author = 'Unknown'
        let status = 'Ongoing'
        let artist = 'Unknown'

        // Metadati: Cerca sia il vecchio layout (.row) sia quello a colonne (.col-)
        // Questo evita che i dettagli spariscano se il layout cambia leggermente
        const metaRows = $('.meta-data .row, .meta-data [class*="col-"]', infoBox)
        
        metaRows.each((_: any, row: any) => {
            const text = $(row).text().toLowerCase()
            // Estrazione sicura basata sul testo
            if (text.includes('autore')) author = $(row).find('a, span').last().text().trim()
            if (text.includes('artista')) artist = $(row).find('a, span').last().text().trim()
            if (text.includes('stato')) {
                const val = $(row).find('a, span').last().text().trim().toLowerCase()
                if (val.includes('completato') || val.includes('finito')) {
                    status = 'Completed'
                }
            }
        })

        const arrayTags: Tag[] = []
        $('.comic-info .tags a').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('genre=')[1] ?? label
            if (label) arrayTags.push(App.createTag({ id, label }))
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: artist,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('.chapter-list .chapter-item').each((_: any, item: any) => {
            const link = $(item).find('a')
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.split('/').pop() ?? ''
            
            const rawTitle = link.text().trim()
            const dateText = $(item).find('.chapter-date').text().trim()
            
            // Parsing Data Corretto
            const time = this.parseItalianDate(dateText)

            const volMatch = rawTitle.match(/Vol\.?\s*(\d+)/i)
            const chapMatch = rawTitle.match(/(?:Cap|Ch)\.?\s*(\d+(\.\d+)?)/i)
            
            const volNum = volMatch ? parseInt(volMatch[1] ?? '0') : undefined
            const chapNum = chapMatch ? parseFloat(chapMatch[1] ?? '0') : 0

            // Naming Pulito: Evita ripetizioni
            let name = ''
            // Rimuove "Capitolo X" dal titolo per vedere se c'è un nome reale
            const cleanTitle = rawTitle.replace(/Capitolo\s*\d+(\.\d+)?/i, '').replace(/Vol\.\s*\d+/i, '').replace(/^-/, '').trim()
            
            if (cleanTitle.length > 0) {
                name = cleanTitle // Es: "L'inizio dell'avventura"
            } else {
                name = `Capitolo ${chapNum}` // Es: "Capitolo 1"
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: time,
                langCode: '🇮🇹', // Bandierina
                sortingIndex: chapters.length
            }))
        })

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // METODO SICURO (REGEX DOM)
        // Manteniamo questo metodo perché il parsing JSON faceva crashare l'app
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["']content-image/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = this.getImageSrc({ attr: () => match![1] })
            pages.push(url)
        }

        // Fallback Reader alternativo (vecchio layout)
        if (pages.length === 0) {
             const genericRegex = /<div id="page_\d+">.*?<img[^>]+src=["']([^"']+)["']/gs
             while ((match = genericRegex.exec(html)) !== null) {
                 const url = this.getImageSrc({ attr: () => match![1] })
                 pages.push(url)
             }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // --- HOME PAGE & SEARCH ---

    parseCommonManga($: any, element: any, subtitleSelector?: string): PartialSourceManga {
        const item = $(element)
        const link = item.find('a').first()
        const href = link.attr('href')
        const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''

        // Selettori Stabili
        let rawTitle = item.find('.comic-title').text().trim()
        if (!rawTitle) rawTitle = item.find('.title, h3').text().trim()
        if (!rawTitle) rawTitle = link.attr('title') ?? 'Unknown'

        const title = this.cleanTitle(rawTitle)
        
        let image = this.getImageSrc(item.find('img').first())
        if (image.includes('logo-alt')) image = this.getImageSrc(item.find('.thumb img'))

        let subtitle = undefined
        if (subtitleSelector) {
            subtitle = item.find(subtitleSelector).text().trim()
        } else {
            subtitle = item.find('.chapter-text, .latest-chapter').first().text().trim()
        }

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseHomeSections($: any, month: HomeSection, latest: HomeSection, trending: HomeSection): void {
        
        // 1. TOP MONTH (Usa selettori 3.4.0)
        const monthItems: PartialSourceManga[] = []
        $('.col-12 .top-wrapper .entry').each((i: number, item: any) => {
            if (i < 10) monthItems.push(this.parseCommonManga($, item))
        })
        month.items = monthItems

        // 2. LATEST
        const latestItems: PartialSourceManga[] = []
        $('.col-sm-12.col-md-8.col-xl-9 .comics-grid .entry').each((_: any, item: any) => {
            latestItems.push(this.parseCommonManga($, item, '.d-flex.flex-wrap.flex-row a'))
        })
        latest.items = latestItems

        // 3. TRENDING
        const trendingItems: PartialSourceManga[] = []
        $('.entry.vertical').each((_: any, item: any) => {
            trendingItems.push(this.parseCommonManga($, item))
        })
        if (trendingItems.length === 0) {
            $('#side-content .entry').each((_: any, item: any) => {
                trendingItems.push(this.parseCommonManga($, item))
            })
        }
        trending.items = trendingItems
    }

    parseViewMore($: any): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            manga.push(this.parseCommonManga($, item))
        })
        return manga
    }
}