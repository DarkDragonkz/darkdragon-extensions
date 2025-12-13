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

    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        if (element.is('img')) img = element

        let src = img.attr('src') || img.attr('data-src') || img.attr('original') || img.attr('data-original')
        
        if (!src || src.includes('logo-alt')) return 'https://paperback.moe/icons/logo-alt.svg'

        src = src.trim()
        if (src.startsWith('//')) src = `https:${src}`
        else if (src.startsWith('/')) src = `https://it.ninemanga.com${src}`
        
        return src
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1[itemprop="name"]').first().text().trim()
        if (!title) title = $('.book-title').text().trim()
        title = title.replace(/ Manga$/, '').trim()
        
        let imageElement = $('img[itemprop="image"]').first()
        if (imageElement.length === 0) imageElement = $('.bookintro img').first()
        
        const image = this.getImageSrc(imageElement)

        const author = $('a[itemprop="author"]').first().text().trim() || 'Unknown'
        
        let desc = $('p[itemprop="description"]').text().trim()
        if (!desc) {
            const intro = $('.bookintro').clone()
            intro.find('ul, h1, div, a').remove() 
            desc = intro.text().trim()
        }
        desc = desc.replace(/^Sommario:\s*/i, '') || 'Nessuna descrizione disponibile.'
        
        let status = 'Ongoing'
        const statusText = $('.red, a[href*="completed"]').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        const arrayTags: Tag[] = []
        $('li[itemprop="genre"] a').each((_: any, el: any) => {
            const $el = $(el)
            const id = $el.attr('href')?.split('/').pop()?.replace('.html', '') ?? ''
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

        // Selettore mobile specifico
        let chapterLinks = $('a.chapter_list_a').toArray()
        if (chapterLinks.length === 0) {
            chapterLinks = $('ul.chapter_list a').toArray()
        }

        for (const link of chapterLinks) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            const parts = href.split('/')
            const filePart = parts.pop() ?? '' 
            // ID Pulito: manga-name/123.html -> 123
            const chapterId = filePart.split('?')[0].replace('.html', '')

            // IMPORTANTE: NineManga ha paginazione nei link (es. 123-10-1.html). 
            // Noi vogliamo solo il capitolo base.
            if (chapterId.includes('-')) {
                // Se è un link di paginazione interno, saltiamolo. Vogliamo solo la "main page" del capitolo
                continue 
            }
            
            if (seenIds.has(chapterId)) continue
            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            
            // Pulizia Titolo: Rimuovi nome manga
            // Es: "Naruto 500" -> "500"
            const cleanMangaId = mangaId.replace(/-/g, ' ')
            titleRaw = titleRaw.replace(new RegExp(cleanMangaId, 'gi'), '').trim()

            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText && !dateText.includes('ago')) {
                 const parsedDate = new Date(dateText)
                 if (!isNaN(parsedDate.getTime())) time = parsedDate
            }

            // Estrazione Numero
            const chapNumMatch = titleRaw.match(/(\d+(\.\d+)?)/g)
            let chapNum = 0
            if (chapNumMatch && chapNumMatch.length > 0) {
                chapNum = parseFloat(chapNumMatch[chapNumMatch.length - 1])
            }

            // Nomenclatura Standard "Ch. X"
            let name = titleRaw
            // Rimuovi "Chapter X", "Ch. X"
            name = name.replace(/^(chapter|ch|c)\.?\s*\d+/i, '').trim()
            // Se rimane solo il numero, lascia vuoto (Paperback mette Ch. X)
            if (name === String(chapNum)) name = ''

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

    /**
     * Parsing parallelo delle immagini del capitolo
     */
    async parseChapterDetails(
        $: any, 
        mangaId: string, 
        chapterId: string, 
        source: any 
    ): Promise<ChapterDetails> {
        // Su Mobile, c'è un <select id="page"> o <select class="sl-page"> con tutte le pagine
        const pageUrls: string[] = []
        
        $('select#page option, select.sl-page option').each((_: any, obj: any) => {
            let pageUrl = $(obj).attr('value') ?? ''
            if (pageUrl && pageUrl !== '0') {
                 if (pageUrl.startsWith('/')) pageUrl = source.baseUrl + pageUrl
                 if (!pageUrls.includes(pageUrl)) pageUrls.push(pageUrl)
            }
        })

        // Se non troviamo il select, proviamo a vedere se è un capitolo "scroll" (raro su mobile)
        if (pageUrls.length === 0) {
             const singleImg = this.extractImage($)
             if (singleImg) {
                 return App.createChapterDetails({ id: chapterId, mangaId, pages: [singleImg] })
             }
             throw new Error("Impossibile trovare le pagine del capitolo.")
        }

        // SCARICAMENTO PARALLELO (Con limite source.requestManager)
        // Scarichiamo ogni pagina HTML per estrarre l'immagine
        const promises = pageUrls.map(url => this.fetchImageFromPage(url, source))
        const results = await Promise.all(promises)
        
        // Filtriamo i null e rimuoviamo duplicati
        const pages = results.filter(u => u !== null) as string[]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)]
        })
    }

    private extractImage($: any): string | null {
        // Selettore tipico NineManga Mobile
        const img = $('img.manga_pic, div#full_image img, .pic_box img').first()
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
                    'Referer': source.baseUrl, // Fondamentale per NineManga
                    'User-Agent': source.userAgent
                }
            })
            // Usiamo schedule con priorità per non bloccare tutto
            const response = await source.requestManager.schedule(request, 1)
            const $ = source.cheerio.load(response.data)
            return this.extractImage($)
        } catch (e) {
            console.error(`Errore caricamento pagina ${url}: ${e}`)
            return null
        }
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        // Adattamento ai selettori della lista mobile
        const items = $('.book-list li, dl.book-list dd, .comic-item').toArray()

        for (const item of items) {
            const $item = $(item)
            const link = $item.find('a').first()
            const href = link.attr('href')
            
            if (!href) continue

            const id = href.split('/manga/')[1]?.replace('.html', '')
            if (!id) continue

            const image = this.getImageSrc($item)

            let title = link.text().trim()
            if (!title) title = $item.find('dd.book-list-title, h3').text().trim()
            if (!title) title = 'Unknown'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }
        return results
    }

    parseHomeSections($home: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti 🆙', containsMoreItems: true, type: HomeSectionType.continuous })
        const newSection = App.createHomeSection({ id: 'new', title: 'Nuove Uscite 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []

        // Helper per parsare le liste ID-based della home
        const parseList = (selector: string, target: PartialSourceManga[]) => {
            $home(selector).find('li, dd').each((_: any, el: any) => {
                const $el = $home(el)
                const link = $el.find('a').first()
                const href = link.attr('href')
                const id = href?.split('/manga/')[1]?.replace('.html', '')
                
                if (!id) return

                const image = this.getImageSrc($el)
                const title = link.attr('title') || link.text().trim()
                
                target.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            })
        }

        // I selettori ID sono standard sulla home mobile
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