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

const BASE_URL = 'https://batcave.biz'

export class BatCaveParser {

    private getHighResImage(url: string | undefined): string {
        if (!url) return ''
        if (url.startsWith('/')) {
            url = BASE_URL + url
        }
        if (url.includes('/thumbs/')) {
            return url.replace('/thumbs/', '/')
        }
        return url
    }

    parseGridItems($: any, selector: string, subtitleSelector?: string): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        
        $(selector).each((_: any, item: any) => {
            const el = $(item)
            let link = el.find('a').first()
            if (el.is('a')) link = el

            const href = link.attr('href')
            const id = href?.replace(BASE_URL, '').replace(/^\//, '')

            if (!id) return

            const title = link.attr('title') ?? el.find('.poster__title, .title').text().trim()
            
            const imgEl = el.find('img')
            let image = imgEl.attr('src') ?? imgEl.attr('data-src')
            image = this.getHighResImage(image)

            if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

            let subtitle = undefined
            if (subtitleSelector) {
                subtitle = el.find(subtitleSelector).text().trim()
            }

            manga.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: subtitle
            }))
        })

        return manga
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        const featuredSection = App.createHomeSection({ 
            id: 'featured', 
            title: 'Featured 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        featuredSection.items = this.parseGridItems($, '.slider__item, .slider .owl-item')
        sectionCallback(featuredSection)

        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot New Releases ⚡', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        hotSection.items = this.parseGridItems($, '.sect--hot .poster')
        sectionCallback(hotSection)
        
        const topRatedSection = App.createHomeSection({ 
            id: 'top_rated', 
            title: 'Top Rated ⭐', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        topRatedSection.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Top-rated")) a.popular')
        sectionCallback(topRatedSection)

        const justAddedSection = App.createHomeSection({ 
            id: 'just_added', 
            title: 'Just Added 🆕', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        justAddedSection.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Just added")) a.popular')
        sectionCallback(justAddedSection)

        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        latestSection.items = this.parseGridItems($, '.sect--latest .latest', '.latest__chapter')
        sectionCallback(latestSection)
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const info = $('.full-story')
        
        const title = $('h1.title__name', info).text().trim()
        
        const imgEl = $('.poster img', info)
        let image = imgEl.attr('src') ?? imgEl.attr('data-src')
        image = this.getHighResImage(image)

        const desc = $('.full-story__text', info).text().trim()
        let status = 'Ongoing'

        const tags: Tag[] = []
        $('.full-story__info a[href*="/xfsearch/genre/"]').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = label
            tags.push(App.createTag({ id, label }))
        })

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image || 'https://paperback.moe/icons/logo-alt.svg',
                status: status,
                tags: [App.createTagSection({ id: '0', label: 'Genres', tags: tags })],
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Estrai il titolo del fumetto per rimuoverlo dai nomi dei capitoli
        const mangaTitle = $('h1.title__name').text().trim()

        // Iterazione con indice 'i' per mantenere l'ordine del sito
        $('.chapters-list li').each((i: number, li: any) => {
            const link = $(li).find('a')
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.replace(BASE_URL, '').replace(/^\//, '')
            let name = link.text().trim()
            
            // --- MODIFICA RICHIESTA ---
            
            // 1. Rimuovi titolo del fumetto dal nome capitolo (es. "Batman #5" -> "#5")
            if (mangaTitle) {
                // Escape caratteri speciali per la regex
                const escapedTitle = mangaTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                const regex = new RegExp(escapedTitle, 'i')
                name = name.replace(regex, '').trim()
            }

            // 2. Pulizia extra (rimuove trattini iniziali o spazi)
            name = name.replace(/^(-|\s)+/, '').trim()

            // 3. Parsing numero
            const numMatch = name.match(/#(\d+(\.\d+)?)/) || name.match(/Chapter\s*(\d+)/i) || name.match(/(\d+)$/)
            const chapNum = numMatch ? parseFloat(numMatch[1]) : 0

            // 4. Se il nome è vuoto o solo numero, rendilo più carino
            if (!name || /^\d+$/.test(name)) {
                name = `#${chapNum}`
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: undefined,
                time: new Date(),
                langCode: '🇺🇸', // 5. Bandiera USA invece di EN
                sortingIndex: i // 6. Ordine diretto dal sito (0 = primo in lista)
            }))
        })

        // Restituiamo l'array così com'è, senza reverse().
        // Se il sito mette i più recenti in alto (indice 0), Paperback userà questo ordine.
        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["'].*?chapter-img/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            pages.push(this.getHighResImage(match[1]))
        }

        if (pages.length === 0) {
             const genericRegex = /<img[^>]+src=["']([^"']+)["'][^>]+data-src/g
             while ((match = genericRegex.exec(html)) !== null) {
                 pages.push(this.getHighResImage(match[1]))
             }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('.search-result .short, .content .short').each((_: any, item: any) => {
            const link = $(item).find('a.short-title, a.poster__link').first()
            const href = link.attr('href')
            const id = href?.replace(BASE_URL, '').replace(/^\//, '')
            
            if (id) {
                const title = link.text().trim() || $(item).find('.poster__title').text().trim()
                
                const imgEl = $(item).find('img')
                let image = imgEl.attr('src') ?? imgEl.attr('data-src')
                image = this.getHighResImage(image)

                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image || 'https://paperback.moe/icons/logo-alt.svg',
                    title: title
                }))
            }
        })
        return results
    }
}