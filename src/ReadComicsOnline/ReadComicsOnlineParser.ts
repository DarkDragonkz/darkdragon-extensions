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

const BASE_URL = 'https://readcomicsonline.ru'

export class ReadComicsOnlineParser {

    /**
     * Tenta di ottenere l'immagine alla massima risoluzione.
     * Rimuove suffissi tipo '_250x350' se presenti.
     */
    private getHighResImage(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        
        // Fix URL relativi
        if (url.startsWith('//')) url = `https:${url}`
        else if (url.startsWith('/')) url = `${BASE_URL}${url}`

        // Rimuove suffissi di ridimensionamento comuni (es. cover_250x350.jpg -> cover.jpg)
        // La regex cerca _\d+x\d+ prima dell'estensione
        return url.replace(/_\d+x\d+(?=\.[a-z]+$)/i, '')
    }

    /**
     * Helper centralizzato per estrarre l'immagine da un elemento.
     * Prova vari attributi di lazy loading e fallback.
     */
    private getImageSrc(element: any, id?: string): string {
        // Cerca attributi comuni
        let src = element.attr('data-src') ?? 
                  element.attr('src') ?? 
                  element.attr('original') ?? 
                  element.attr('data-original') ?? 
                  ''
        
        // Se non trova nulla o è un placeholder, prova a costruire l'URL
        if ((!src || src.includes('no-image') || src.includes('placeholder')) && id) {
             // Fallback euristico: spesso l'immagine è qui
             return `${BASE_URL}/uploads/manga/${id}/cover/cover_250x350.jpg`
        }

        return this.getHighResImage(src)
    }

    /**
     * Helper per parsare un singolo elemento lista/griglia
     */
    private parseMangaItem($: any, element: any): PartialSourceManga | null {
        const link = $('a', element).first() || $(element).find('h5 a').first()
        const href = link.attr('href')
        const id = href?.split('/').pop()
        
        if (!id) return null

        const title = link.text().trim() || $(element).find('h5').text().trim() || 'Unknown'
        
        const imgEl = $('img', element).first()
        const image = this.getImageSrc(imgEl, id)

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h2.listmanga-header').first().text().trim() || 'Unknown'
        
        const image = this.getImageSrc($('img', 'div.boxed').first(), mangaId)
        
        const author = $('dd', 'dt:contains("Type")').parent().text().replace('Type', '').trim() || 'Unknown'
        
        const statusText = $('span.label').text().trim().toLowerCase()
        const status = statusText.includes('completed') ? 'Completed' : 'Ongoing'

        let desc = $('div.manga.well p').text().trim()
        desc = desc.replace(/^Summary:\s*/i, '')

        const arrayTags: Tag[] = []
        $('a', 'dd.tag-links').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').pop() ?? label
            if (label) arrayTags.push(App.createTag({ id, label }))
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: author,
                tags: tagSections,
                desc: desc || 'No description available'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('ul.chapters li').each((_: any, li: any) => {
            const title = $('h5.chapter-title-rtl', li).text().trim()
            const link = $('a', li).attr('href')
            
            let chapterId = link?.split('/').pop() ?? ''
            // Pulizia ID da query params
            if (chapterId.includes('?')) chapterId = chapterId.split('?')[0]
            if (chapterId.includes('#')) chapterId = chapterId.split('#')[0]

            if (!chapterId) return

            const dateText = $('div.date-chapter-title-rtl', li).last().text().trim()
            const time = new Date(dateText)

            const numMatch = chapterId.match(/(\d+(\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[0]) : 0

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: isNaN(time.getTime()) ? new Date() : time,
                langCode: 'en'
            }))
        })

        return chapters
    }

    parseChapterDetails(cheerio: any, html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        const $ = cheerio.load(html)
        
        $('img', 'div#all').each((_: any, img: any) => {
            let url = $(img).attr('data-src')?.trim() ?? $(img).attr('src')?.trim()
            if (url) {
                url = url.trim();
                // Assicuriamoci che l'URL sia assoluto e corretto
                if (url.startsWith('/')) url = BASE_URL + url
                if (!url.startsWith('http')) {
                    url = url.startsWith('/')
                        ? BASE_URL + url
                        : `${BASE_URL}/${url.replace(/^\/+/, '')}`
                }
                
                // Evitiamo duplicati
                if (!pages.includes(url)) {
                    pages.push(url)
                }
            }
        })

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchJson(json: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        if (json.suggestions) {
            for (const item of json.suggestions) {
                const title = item.value
                const id = item.data
                // Costruiamo l'immagine direttamente
                const image = `${BASE_URL}/uploads/manga/${id}/cover/cover_250x350.jpg`

                if (id && title) {
                    results.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image,
                        title: title,
                        subtitle: undefined
                    }))
                }
            }
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. Hot Comics (Vetrina Large)
        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot Comics 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        const hotItems: PartialSourceManga[] = []
        
        $('li.schedule-item', 'div.carousel').each((_: any, item: any) => {
            const id = $('div.schedule-name a', item).attr('href')?.split('/').pop()
            const title = $('div.schedule-name', item).text().trim()
            
            const imgEl = $('div.schedule-avatar img', item)
            const image = this.getImageSrc(imgEl, id)

            if (id && title) {
                hotItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: 'Hot'
                }))
            }
        })
        hotSection.items = hotItems
        sectionCallback(hotSection)

        // 2. Latest Comics (Scroll Infinito)
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Comics 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous // UI MIGLIORATA
        })
        
        // Riutilizziamo parseGridItems logic
        const latestItems = this.parseGridItems($)
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }

    // Usato sia per Home Latest che per View More
    parseGridItems($: any): PartialSourceManga[] {
        const items: PartialSourceManga[] = []
        
        $('div.media', 'div.list-container > div.row').each((_: any, item: any) => {
            const link = $('h5.media-heading a', item)
            const id = link.attr('href')?.split('/').pop()
            const title = link.text().trim()
            
            const imgEl = $('div.media-left img', item)
            const image = this.getImageSrc(imgEl, id)
            
            // Estrai info extra se presenti (es. capitolo o data)
            const subtitle = undefined

            if (id && title) {
                items.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        
        return items
    }
}
