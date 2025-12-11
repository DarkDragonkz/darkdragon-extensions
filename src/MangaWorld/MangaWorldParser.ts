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
     * Pulisce i titoli duplicati (es. "NarutoNaruto" -> "Naruto")
     */
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
        
        if (image && image.startsWith('/')) {
            image = BASE_URL + image
        }

        return image || 'https://paperback.moe/icons/logo-alt.svg'
    }

    // --- PARSERS ---

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

        // Metadati Standard
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
        
        // Selettori Stabili 3.4.0
        $('.chapter-list .chapter-item').each((_: any, item: any) => {
            const link = $(item).find('a')
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.split('/').pop() ?? ''
            
            const rawTitle = link.text().trim()
            const time = new Date() // Nessun parsing complesso, data corrente

            const volMatch = rawTitle.match(/Vol\.?\s*(\d+)/i)
            const chapMatch = rawTitle.match(/(?:Cap|Ch)\.?\s*(\d+(\.\d+)?)/i)
            
            const volNum = volMatch ? parseInt(volMatch[1] ?? '0') : undefined
            const chapNum = chapMatch ? parseFloat(chapMatch[1] ?? '0') : 0

            // --- NUOVO NAMING PULITO ---
            let name = ''
            if (volNum !== undefined) name += `Vol. ${volNum} `
            name += `Ch. ${chapNum}`
            
            // Aggiungi titolo extra se presente (dopo il trattino) ed evita ripetizioni
            // Es: "Vol. 1 Cap. 10 - Titolo" -> "Vol. 1 Ch. 10 - Titolo"
            // Es: "Capitolo 10" -> "Ch. 10"
            if (rawTitle.includes('-')) {
                const extraTitle = rawTitle.split('-').slice(1).join('-').trim()
                // Se l'extra title è solo il numero ripetuto, ignoralo
                if (extraTitle && !extraTitle.toLowerCase().includes(`capitolo ${chapNum}`) && extraTitle !== String(chapNum)) {
                    name += ` - ${extraTitle}`
                }
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
        
        // Regex DOM (Metodo Stabile 3.4.0)
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["']content-image/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = this.getImageSrc({ attr: () => match![1] })
            pages.push(url)
        }

        // Fallback per layout alternativi (Reader Area)
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

        // Selettori Stabili 3.4.0
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
        
        // 1. TOP MONTH (Vetrina Grande)
        const monthItems: PartialSourceManga[] = []
        $('.col-12 .top-wrapper .entry').each((i: number, item: any) => {
            if (i < 10) monthItems.push(this.parseCommonManga($, item))
        })
        month.items = monthItems

        // 2. LATEST UPDATES (Griglia Centrale)
        const latestItems: PartialSourceManga[] = []
        $('.col-sm-12.col-md-8.col-xl-9 .comics-grid .entry').each((_: any, item: any) => {
            latestItems.push(this.parseCommonManga($, item, '.d-flex.flex-wrap.flex-row a'))
        })
        latest.items = latestItems

        // 3. TRENDING (Sidebar)
        const trendingItems: PartialSourceManga[] = []
        $('.entry.vertical').each((_: any, item: any) => {
            trendingItems.push(this.parseCommonManga($, item))
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