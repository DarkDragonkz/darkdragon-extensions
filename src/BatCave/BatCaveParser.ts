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
        
        // Recuperiamo il titolo principale del fumetto per pulire i nomi dei capitoli
        const mangaTitle = $('h1.title__name').text().trim()

        // Iteriamo sui capitoli
        $('.chapters-list li').each((i: number, li: any) => {
            const link = $(li).find('a')
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.replace(BASE_URL, '').replace(/^\//, '')
            let name = link.text().trim()
            
            // --- PULIZIA NOMENCLATURA ---
            // 1. Rimuove il titolo del fumetto se presente nel nome del capitolo (case insensitive)
            if (mangaTitle) {
                const regexTitle = new RegExp(mangaTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                name = name.replace(regexTitle, '').trim()
            }
            
            // 2. Rimuove trattini o spazi iniziali residui
            name = name.replace(/^(-|\s)+/, '')
            
            // 3. Se è rimasto solo un numero, aggiungi "#" per estetica
            if (/^\d+(\.\d+)?$/.test(name)) {
                name = `#${name}`
            }
            
            // Parsing numero per il tracking
            const numMatch = name.match(/#?(\d+(\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[1]) : 0

            chapters.push(App.createChapter({
                id: chapterId,
                name: name || `Issue #${chapNum}`, // Fallback se il nome diventa vuoto
                chapNum: chapNum,
                volume: undefined,
                time: new Date(),
                langCode: '🇺🇸', // Emoji bandiera USA
                sortingIndex: i // Mantiene l'ordine ESATTO del sito (0, 1, 2...)
            }))
        })

        // NON invertiamo l'array. BatCave li mostra dal più recente (in alto) al più vecchio.
        // Assegnando sortingIndex = i, Paperback li mostrerà nell'ordine in cui li ha letti.
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