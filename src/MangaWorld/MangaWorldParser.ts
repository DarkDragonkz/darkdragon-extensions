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

    private cleanTitle(title: string): string {
        if (!title) return 'Unknown'
        title = title.trim()
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
        if (image && image.startsWith('/')) image = BASE_URL + image
        return image || 'https://paperback.moe/icons/logo-alt.svg'
    }

    // --- PARSERS (Selettori Stabili 3.4.0) ---

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

        // Selettore Metadati 3.4.0 (Funzionante)
        $('.meta-data .row').each((_: any, row: any) => {
            const label = $(row).find('label').text().toLowerCase()
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
        
        // Selettore Capitoli 3.4.0 (Funzionante)
        $('.chapter-list .chapter-item').each((_: any, item: any) => {
            const link = $(item).find('a')
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.split('/').pop() ?? ''
            
            // Dati grezzi
            const rawTitle = link.text().trim() 
            const time = new Date() // Nessun parsing date, per sicurezza

            // Estrazione Numeri
            const volMatch = rawTitle.match(/Vol\.?\s*(\d+)/i)
            const chapMatch = rawTitle.match(/(?:Cap|Ch)\.?\s*(\d+(\.\d+)?)/i)
            
            const volNum = volMatch ? parseInt(volMatch[1] ?? '0') : undefined
            const chapNum = chapMatch ? parseFloat(chapMatch[1] ?? '0') : 0

            // --- LOGICA NAMING MIGLIORATA ---
            // Obiettivo: Evitare "Vol. 1 Cap. 1 - Capitolo 1"
            let name = ''
            
            // Rimuove la parte "Capitolo X" dal titolo se esiste altro testo
            const cleanName = rawTitle.replace(/Capitolo\s*\d+(\.\d+)?\s*-?\s*/i, '').trim()
            const volClean = cleanName.replace(/Volume\s*\d+\s*-?\s*/i, '').trim()

            // Se rimane qualcosa (es. un titolo vero come "L'inizio"), usalo
            if (volClean.length > 0) {
                name = volClean
            } else {
                // Altrimenti usa formato standard "Ch. X" (Paperback aggiungerà Vol. X automaticamente se c'è il campo volume)
                name = `Ch. ${chapNum}`
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: time,
                langCode: '🇮🇹', // Bandiera
                sortingIndex: chapters.length
            }))
        })

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Logica Reader 3.4.0 (Funzionante, Regex pura)
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["']content-image/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = this.getImageSrc({ attr: () => match![1] })
            pages.push(url)
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

        const title = this.cleanTitle(item.find('.title, h3, .comic-title').text().trim())
        const image = this.getImageSrc(item.find('img').first())
        
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
        $('.col-12 .top-wrapper .entry').each((i: number, item: any) => {
            if (i < 10) monthItems.push(this.parseCommonManga($, item))
        })
        month.items = monthItems

        const latestItems: PartialSourceManga[] = []
        $('.col-sm-12.col-md-8.col-xl-9 .comics-grid .entry').each((_: any, item: any) => {
            latestItems.push(this.parseCommonManga($, item, '.chapter-link'))
        })
        latest.items = latestItems

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