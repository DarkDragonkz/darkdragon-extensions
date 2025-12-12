import {
    Chapter,
    ChapterDetails,
    HomeSection,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const BASE_URL = 'https://batcave.biz'

export class BatCaveParser {

    private getHighResImage(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        if (url.startsWith('/')) url = BASE_URL + url
        
        // Fix DLE thumbs: .../thumbs/image.jpg -> .../image.jpg
        if (url.includes('/thumbs/')) {
            return url.replace('/thumbs/', '/')
        }
        return url
    }

    parseHomeSections($: any, featured: HomeSection, topRated: HomeSection, justAdded: HomeSection, hotReleases: HomeSection, newest: HomeSection): void {
        
        // 1. Featured (Lo slider in alto)
        featured.items = this.parseGridItems($, '.slider__item, .slider .owl-item')

        // 2. Top-rated (Sidebar)
        // Cerca il blocco sidebar che contiene "Top-rated"
        topRated.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Top-rated")) a.popular')

        // 3. Just Added (Sidebar)
        justAdded.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Just added")) a.popular')

        // 4. Hot New Releases (Sezione specifica .sect--hot)
        hotReleases.items = this.parseGridItems($, '.sect--hot .poster')

        // 5. The Newest (Sezione principale .sect--latest)
        // Passiamo un selettore extra per il sottotitolo (ultimo capitolo)
        newest.items = this.parseGridItems($, '.sect--latest .latest', '.latest__chapter')
    }

    parseGridItems($: any, selector: string, subtitleSelector?: string): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        
        $(selector).each((_: any, item: any) => {
            const el = $(item)
            
            // Gestione layout diversi (Grid vs Sidebar List)
            let link = el.find('a').first()
            if (el.is('a')) link = el

            const href = link.attr('href')
            // L'ID è tutto ciò che viene dopo il dominio
            const id = href?.replace(BASE_URL, '').replace(/^\//, '')

            if (!id) return

            const title = link.attr('title') ?? el.find('.poster__title, .title').text().trim()
            const image = this.getHighResImage(el.find('img').attr('src') ?? el.find('img').attr('data-src'))
            
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

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const info = $('.full-story')
        
        const title = $('h1.title__name', info).text().trim()
        const image = this.getHighResImage($('.poster img', info).attr('src'))
        const desc = $('.full-story__text', info).text().trim()

        let status = 'Ongoing'
        // BatCave spesso non ha status esplicito, default Ongoing

        const tags: Tag[] = []
        // Generi solitamente in .poster__label o .full-story__info
        $('.full-story__info a[href*="/xfsearch/genre/"]').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = label // ID e Label uguali per semplicità
            tags.push(App.createTag({ id, label }))
        })

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                tags: [App.createTagSection({ id: '0', label: 'Genres', tags: tags })],
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // BatCave lista capitoli: .chapters-list li a
        // O a volte dentro .full-story__chapters
        $('.chapters-list li').each((_: any, li: any) => {
            const link = $(li).find('a')
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.replace(BASE_URL, '').replace(/^\//, '')
            const name = link.text().trim()
            
            // Cerca numero nel titolo
            const numMatch = name.match(/#(\d+(\.\d+)?)/) || name.match(/Chapter\s*(\d+)/i) || name.match(/(\d+)$/)
            const chapNum = numMatch ? parseFloat(numMatch[1]) : 0

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: undefined,
                time: new Date(), // Date non presenti in lista
                langCode: 'en',
                sortingIndex: chapters.length
            }))
        })

        // Invertiamo l'ordine se necessario (dal più vecchio al più nuovo di solito su BatCave, ma PB vuole il contrario per l'indice)
        return chapters.reverse()
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Regex per trovare le immagini nel reader script o html
        // BatCave spesso usa <img class="chapter-img"> o script
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["'].*?chapter-img/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            pages.push(this.getHighResImage(match[1]))
        }

        // Fallback: cerca tutte le immagini nel content
        if (pages.length === 0) {
             const genericRegex = /<img[^>]+src=["']([^"']+)["'][^>]+data-src/g // Lazy load pattern
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
        
        // Risultati ricerca DLE standard
        $('.search-result .short, .content .short').each((_: any, item: any) => {
            const link = $(item).find('a.short-title, a.poster__link').first()
            const href = link.attr('href')
            const id = href?.replace(BASE_URL, '').replace(/^\//, '')
            
            if (id) {
                const title = link.text().trim() || $(item).find('.poster__title').text().trim()
                const image = this.getHighResImage($(item).find('img').attr('src') ?? $(item).find('img').attr('data-src'))
                
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title
                }))
            }
        })
        return results
    }
}