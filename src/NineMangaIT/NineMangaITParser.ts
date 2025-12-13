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

export class NineMangaITParser {

    /**
     * Estrae l'URL dell'immagine pulito e sicuro
     */
    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        if (element.is('img')) img = element

        let src = img.attr('src') || img.attr('data-src') || img.attr('original') || img.attr('data-original')
        
        if (!src || src.includes('logo')) return 'https://paperback.moe/icons/logo-alt.svg'

        src = src.trim()
        if (src.startsWith('//')) src = `https:${src}`
        else if (src.startsWith('/')) src = `https://it.ninemanga.com${src}`
        else if (src.startsWith('http:')) src = src.replace('http:', 'https:')
        
        return src
    }

    /**
     * Estrae l'ID del manga da un qualsiasi URL (manga o chapter)
     */
    private extractMangaId(url: string | undefined): string | null {
        if (!url) return null
        
        // Regex che cattura l'ID sia da /manga/ID.html che da /chapter/ID/123.html
        // Gruppo 2 contiene l'ID
        const regex = /\/(?:manga|chapter)\/([^\/]+?)(?:\.html|\/|$)/
        const match = url.match(regex)
        
        return match ? match[1] : null
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1[itemprop="name"]').first().text().trim()
        if (!title) title = $('.book-title').first().text().trim()
        if (!title) title = $('.book-detail .title').first().text().trim()
        
        title = title.replace(/ Manga$/, '').trim()
        
        let imageElement = $('img[itemprop="image"]').first()
        if (imageElement.length === 0) imageElement = $('.bookintro img').first()
        
        const image = this.getImageSrc(imageElement)

        const author = $('a[itemprop="author"]').first().text().trim() || 'Unknown'
        
        let desc = $('p[itemprop="description"]').text().trim()
        if (!desc) {
            // Rimuoviamo elementi non di testo per pulire la descrizione
            const intro = $('.bookintro').clone()
            intro.find('ul, h1, div, a, span').remove() 
            desc = intro.text().trim()
        }
        desc = desc.replace(/^Sommario:\s*/i, '') || 'Nessuna descrizione disponibile.'
        
        let status = 'Ongoing'
        const statusText = $('.red, .blue, a[href*="completed"]').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        const arrayTags: Tag[] = []
        $('li[itemprop="genre"] a, .bookintro a[href*="/category/"]').each((_: any, el: any) => {
            const $el = $(el)
            const href = $el.attr('href')
            // Estrazione ID categoria pulita
            const id = href?.match(/\/category\/([^\/]+)/)?.[1]?.replace('.html', '')
            const label = $el.text().trim()
            if (id && label) arrayTags.push({ id, label })
        })

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: 'Unknown',
                desc: desc,
                tags: [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()

        // Selettori multipli per coprire vari layout
        let links = $('ul.chapter_list a.chapter_list_a').toArray()
        if (links.length === 0) links = $('.sub_vol_ul a').toArray()
        if (links.length === 0) links = $('a[href*="/chapter/"]').toArray()

        for (const link of links) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            // ID del capitolo specifico (es. nome-manga/123.html)
            const chapterIdRaw = href.split('/chapter/')[1]
            if (!chapterIdRaw) continue
            
            // Rimuove query params e .html
            const chapterId = chapterIdRaw.split('?')[0].replace('.html', '')

            // Filtro paginazione interna (-10-1.html)
            if (chapterId.match(/-\d+-\d+$/)) continue 
            
            if (seenIds.has(chapterId)) continue
            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            
            // PULIZIA TITOLO
            // Rimuoviamo il nome del manga (e varianti) dal titolo del capitolo
            const cleanMangaName = mangaId.replace(/_/g, ' ').replace(/-/g, ' ')
            titleRaw = titleRaw.replace(new RegExp(cleanMangaName, 'gi'), '')
            titleRaw = titleRaw.replace(new RegExp(mangaId, 'gi'), '')
            titleRaw = titleRaw.replace(/manga/gi, '').trim()

            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText) {
                 const parsedDate = new Date(dateText)
                 if (!isNaN(parsedDate.getTime())) time = parsedDate
            }

            // Estrazione Numero
            const chapNumMatch = titleRaw.match(/(\d+(\.\d+)?)/)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1])
            }

            // Nomenclatura
            let name = titleRaw
            name = name.replace(/^(chapter|ch|vol|c)\.?\s*\d+/i, '').trim()
            // Rimuove simboli residui
            name = name.replace(/^[-–—:]+/, '').trim()
            
            if (name === String(chapNum) || name === '') name = ''

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: time,
                langCode: 'it'
            }))
        }
        
        return chapters
    }

    async parseChapterDetails(
        $: any, 
        mangaId: string, 
        chapterId: string, 
        source: any 
    ): Promise<ChapterDetails> {
        const pageUrls: string[] = []
        
        $('select#page option').each((_: any, obj: any) => {
            let val = $(obj).attr('value') ?? ''
            if (val) {
                 if (val.startsWith('/')) val = source.baseUrl + val
                 pageUrls.push(val)
            }
        })

        if (pageUrls.length === 0) {
             const singleImg = this.extractImage($)
             if (singleImg) {
                 return App.createChapterDetails({ id: chapterId, mangaId, pages: [singleImg] })
             }
             // Non lanciare errore bloccante, restituisci array vuoto al massimo
             return App.createChapterDetails({ id: chapterId, mangaId, pages: [] })
        }

        const promises = pageUrls.map(url => this.fetchImageFromPage(url, source))
        const results = await Promise.all(promises)
        const pages = results.filter(u => u !== null) as string[]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)]
        })
    }

    private extractImage($: any): string | null {
        const img = $('img.manga_pic').first()
        let src = img.attr('src')
        if (src) {
             if (src.startsWith('//')) src = 'https:' + src
             return src
        }
        return null
    }

    private async fetchImageFromPage(url: string, source: any): Promise<string | null> {
        try {
            const request = App.createRequest({
                url: url,
                method: 'GET',
                headers: {
                    'Referer': source.baseUrl, 
                    'User-Agent': source.userAgent,
                    'Cookie': 'is_warning=1; my_limit=1; waring=1'
                }
            })
            const response = await source.requestManager.schedule(request, 1)
            const $ = source.cheerio.load(response.data)
            return this.extractImage($)
        } catch (e) {
            return null
        }
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        // Cerchiamo sia in liste ul/li che in definizioni dl/dd
        $('.book-list li, dl.book-list dd').each((_: any, item: any) => {
            const $item = $(item)
            // Cerchiamo link preferibilmente con classe bookname, altrimenti il primo
            const link = $item.find('a.bookname').first().length ? $item.find('a.bookname').first() : $item.find('a').first()
            const href = link.attr('href')
            
            const id = this.extractMangaId(href)
            if (!id) return

            const image = this.getImageSrc($item)
            const title = link.text().trim() || 'Titolo Sconosciuto'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        })
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti 🆙', containsMoreItems: true, type: HomeSectionType.continuous })
        const newSection = App.createHomeSection({ id: 'new', title: 'Nuove Uscite 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []

        // Helper generico che accetta selettori multipli
        const parseList = (selector: string, target: PartialSourceManga[]) => {
            // Cerchiamo elementi li, dd o div.comic-item dentro il selettore container
            $(selector).find('li, dd, div.comic-item').each((_: any, el: any) => {
                const $el = $(el)
                
                // Priorità al link con classe bookname (spesso contiene il titolo pulito)
                let link = $el.find('a.bookname').first()
                if (link.length === 0) link = $el.find('a').first()
                
                const href = link.attr('href')
                const id = this.extractMangaId(href)
                
                if (!id) return

                const image = this.getImageSrc($el)
                
                // Pulizia Titolo Home (rimozione numeri finali es: "One Piece 1141")
                let title = link.text().trim()
                // Regex: Rimuove numeri interi alla fine della stringa se preceduti da spazio
                title = title.replace(/\s+\d+$/, '').trim()
                
                // Fallback titolo dall'attributo title se presente
                if (!title) title = link.attr('title') ?? 'Titolo Sconosciuto'

                target.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            })
        }

        // ID dei tab confermati dai file txt
        parseList('#tab_content_3', popularItems) // Popolari
        parseList('#tab_content_2', latestItems)  // Ultimi
        parseList('#tab_content_1', newItems)     // Nuovi

        popularSection.items = popularItems
        latestSection.items = latestItems
        newSection.items = newItems

        sectionCallback(popularSection)
        sectionCallback(latestSection)
        sectionCallback(newSection)
    }
}