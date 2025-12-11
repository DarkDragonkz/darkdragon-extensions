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
     * Parsing Date Italiane (Feature della 3.6.0)
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
        if (title.length > 0 && title.length % 2 === 0) {
            const half = title.substring(0, title.length / 2)
            if (half === title.substring(title.length / 2)) return half
        }
        return title
    }

    private getImageSrc(element: any): string {
        let image = element.attr('src') ?? ''
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = element.attr('data-src') ?? element.attr('data-original') ?? ''
        }
        if (image && image.startsWith('/')) image = BASE_URL + image
        return image || 'https://paperback.moe/icons/logo-alt.svg'
    }

    // --- LOGICA DI PARSING (Basata sulla 3.4.0 FUNZIONANTE) ---

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Selettori "Vecchia Scuola" (Stabili)
        const infoBox = $('.comic-info')
        
        const rawTitle = $('.comic-title', infoBox).text().trim()
        const title = this.cleanTitle(rawTitle)
        
        const image = this.getImageSrc($('.comic-thumb img', infoBox))

        let desc = $('#noidungm').text().trim()
        if (!desc) desc = $('.description').text().trim()

        let author = 'Unknown'
        let status = 'Ongoing'
        let artist = 'Unknown'

        // Parsing Metadati "Safe" (cerca etichette invece di posizioni fisse)
        $('.meta-data .row').each((_: any, row: any) => {
            const label = $(row).text().toLowerCase()
            const value = $(row).find('span, a').text().trim()

            if (label.includes('autore')) author = value
            if (label.includes('artista')) artist = value
            if (label.includes('stato')) {
                if (value.toLowerCase().includes('completato') || value.toLowerCase().includes('finito')) {
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
        
        // Usa il selettore SICURO della 3.4.0
        $('.chapter-list .chapter-item, .list-chapters .chapter-item').each((_: any, item: any) => {
            const link = $(item).find('a')
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.split('/').pop() ?? ''
            
            // Dati grezzi
            const titleText = link.text().trim() // Es: "Vol. 1 Cap. 10"
            const dateText = $(item).find('.chapter-date, .date').text().trim()
            
            // Feature 3.6.0: Parsing Data e Naming Pulito
            const time = this.parseItalianDate(dateText)

            const volMatch = titleText.match(/Vol\.?\s*(\d+)/i)
            const chapMatch = titleText.match(/(?:Cap|Ch)\.?\s*(\d+(\.\d+)?)/i)
            
            const volNum = volMatch ? parseInt(volMatch[1] ?? '0') : undefined
            const chapNum = chapMatch ? parseFloat(chapMatch[1] ?? '0') : 0

            // Pulizia Nome Capitolo (evita duplicati "Ch 1 - Ch 1")
            let name = ''
            const cleanName = titleText.replace(/Capitolo\s*\d+(\.\d+)?\s*-?\s*/i, '').trim()
            
            if (cleanName.length > 0 && cleanName.toLowerCase() !== `capitolo ${chapNum}`) {
                name = cleanName
            } else {
                name = `Capitolo ${chapNum}`
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: time,
                langCode: '🇮🇹', // Emoji bandiera
                sortingIndex: chapters.length
            }))
        })

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // METODO 3.4.0 (Quello che funzionava sempre e non crasha)
        // Regex diretta sul codice HTML, ignora JS e JSON complessi
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["']content-image/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = this.getImageSrc({ attr: () => match![1] })
            pages.push(url)
        }

        // Fallback di sicurezza (Layout vecchio)
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

    // --- HOME PAGE (UI 3.6.0) ---
    // Qui usiamo i selettori che hai confermato funzionare per l'estetica

    parseCommonManga($: any, element: any, subtitleSelector?: string): PartialSourceManga {
        const item = $(element)
        const link = item.find('a').first()
        const href = link.attr('href')
        const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''

        // Selettore robusto per titolo
        let rawTitle = item.find('.manga-title').text().trim()
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
        const monthItems: PartialSourceManga[] = []
        // Selettore Top Month
        $('.top-wrapper .entry, .to-wrapper .entry').each((i: number, item: any) => {
            if (i < 10) monthItems.push(this.parseCommonManga($, item))
        })
        month.items = monthItems

        const latestItems: PartialSourceManga[] = []
        // Selettore Latest
        $('.comics-grid .entry').each((_: any, item: any) => {
            latestItems.push(this.parseCommonManga($, item, '.chapter-link, .chapter a'))
        })
        latest.items = latestItems

        const trendingItems: PartialSourceManga[] = []
        // Selettore Trending
        $('#chapters-slide .entry, .entry.vertical').each((_: any, item: any) => {
            if ($(item).hasClass('slick-cloned')) return
            trendingItems.push(this.parseCommonManga($, item, '.chapter'))
        })
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