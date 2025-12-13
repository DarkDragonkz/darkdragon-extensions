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

        let src = img.attr('src') || img.attr('data-src')
        
        if (!src || src.includes('logo')) return 'https://paperback.moe/icons/logo-alt.svg'

        src = src.trim()
        if (src.startsWith('//')) src = `https:${src}`
        
        return src
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Basato su "Manga con resttrizione +18 accettata.txt"
        const title = $('h1').first().text().trim() || 'Titolo Sconosciuto'
        
        const imageElement = $('.bookintro img').first()
        const image = this.getImageSrc(imageElement)

        const author = $('a[itemprop="author"]').first().text().trim() || 'Unknown'
        
        let desc = $('p[itemprop="description"]').text().trim()
        // Se itemprop non c'è, proviamo a prendere il testo grezzo del div
        if (!desc) {
            desc = $('.bookintro p').text().trim()
        }
        
        let status = 'Ongoing'
        const statusText = $('.red').text().toLowerCase() // Spesso "Stato: Completato" è in rosso
        if (statusText.includes('completato')) status = 'Completed'

        const arrayTags: Tag[] = []
        $('.bookintro a[href*="/category/"]').each((_: any, el: any) => {
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

        // Basato su "Manga con resttrizione +18 accettata.txt"
        // La lista è in <ul class="chapter_list"> -> <li> -> <a class="chapter_list_a">
        const links = $('ul.chapter_list a.chapter_list_a').toArray()

        for (const link of links) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            // href es: /chapter/Nome_Manga/123456.html
            const parts = href.split('/')
            const filePart = parts.pop() ?? '' 
            const chapterId = filePart.split('?')[0].replace('.html', '')

            if (seenIds.has(chapterId)) continue
            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            
            // PULIZIA TITOLO: Rimuoviamo il nome del manga dal titolo del capitolo
            // Es: "One Piece 1141" -> "1141"
            const cleanMangaName = mangaId.replace(/_/g, ' ').replace(/-/g, ' ')
            // Regex case insensitive che rimuove il nome del manga all'inizio
            titleRaw = titleRaw.replace(new RegExp(`^${cleanMangaName}`, 'i'), '').trim()

            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            // Formato data tipico: "Dec 12, 2025"
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

            // Nomenclatura per Paperback
            let name = titleRaw
            // Rimuovi "Chapter", "Ch.", "Vol."
            name = name.replace(/^(chapter|ch|vol)\.?\s*\d+/i, '').trim()
            
            // Se rimane solo il numero, svuotiamo name così Paperback mette "Ch. X"
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

    /**
     * Logica PARALLELA per scaricare tutte le pagine
     */
    async parseChapterDetails(
        $: any, 
        mangaId: string, 
        chapterId: string, 
        source: any 
    ): Promise<ChapterDetails> {
        // Basato su "Reader.txt": C'è un <select id="page">
        const pageUrls: string[] = []
        
        $('select#page option').each((_: any, obj: any) => {
            let val = $(obj).attr('value') ?? ''
            // I value sono tipo: "/chapter/Manga/ID-2.html"
            if (val) {
                 if (val.startsWith('/')) val = source.baseUrl + val
                 pageUrls.push(val)
            }
        })

        // Se non troviamo il select, forse è una pagina singola o errore
        if (pageUrls.length === 0) {
             // Proviamo a prendere l'immagine corrente
             const singleImg = this.extractImage($)
             if (singleImg) {
                 return App.createChapterDetails({ id: chapterId, mangaId, pages: [singleImg] })
             }
             // Fallback: proviamo a generare url incrementali (rischioso ma meglio di nulla)
             // Ma col file Reader.txt confermato, il select DOVREBBE esserci.
             throw new Error("Impossibile trovare la lista pagine (select#page assente).")
        }

        // Parallelismo limitato dal RequestManager
        const promises = pageUrls.map(url => this.fetchImageFromPage(url, source))
        const results = await Promise.all(promises)
        const pages = results.filter(u => u !== null) as string[]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)] // Rimuovi duplicati
        })
    }

    private extractImage($: any): string | null {
        // Basato su "Reader.txt": <img class="manga_pic">
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
                    'Referer': source.baseUrl, // NineManga controlla il referer
                    'User-Agent': source.userAgent
                }
            })
            const response = await source.requestManager.schedule(request, 1)
            const $ = source.cheerio.load(response.data)
            return this.extractImage($)
        } catch (e) {
            console.error(`Errore caricamento pagina ${url}: ${e}`)
            return null
        }
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        // Basato su "Ricerca.txt": <ul class="book-list"> -> <li>
        $('.book-list li').each((_: any, item: any) => {
            const $item = $(item)
            const link = $item.find('a.bookname').first()
            const href = link.attr('href')
            
            if (!href) return

            const id = href.split('/manga/')[1]?.replace('.html', '')
            if (!id) return

            const image = this.getImageSrc($item)
            const title = link.text().trim()

            // Info extra (es. "Completato")
            const info = $item.find('.gray').text().trim()
            let subtitle = undefined
            if (info.includes('Completato')) subtitle = 'Completato'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: subtitle
            }))
        })
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti 🆙', containsMoreItems: true, type: HomeSectionType.continuous })
        const newSection = App.createHomeSection({ id: 'new', title: 'Nuovi Arrivi 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []

        // Helper per parsare le liste dei TAB della home
        const parseList = (selector: string, target: PartialSourceManga[]) => {
            $(selector).find('li').each((_: any, el: any) => {
                const $el = $(el)
                // Selettore basato su "Sezione Popolare in Homepage.txt"
                const link = $el.find('a.bookname').first()
                const href = link.attr('href')
                
                if (!href) return

                // FIX CRITICO: La home linka a /chapter/Manga/123.html
                // Dobbiamo estrarre il NOME DEL MANGA da lì.
                let id = ''
                if (href.includes('/manga/')) {
                    id = href.split('/manga/')[1].replace('.html', '')
                } else if (href.includes('/chapter/')) {
                    // /chapter/Nome_Manga/123.html -> Nome_Manga
                    const parts = href.split('/chapter/')
                    if (parts.length > 1) {
                        id = parts[1].split('/')[0]
                    }
                }
                
                if (!id) return

                const image = this.getImageSrc($el)
                let title = link.text().trim()
                
                // PULIZIA TITOLO HOME: "One Piece 1141" -> "One Piece"
                // Rimuove numeri interi alla fine della stringa
                title = title.replace(/\s+\d+$/, '').trim()
                
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