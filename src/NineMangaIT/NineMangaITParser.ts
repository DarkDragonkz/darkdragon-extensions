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
     * Estrae l'URL dell'immagine dando priorità a data-original per evitare loading.gif
     */
    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        if (element.is('img')) img = element

        // PRIORITÀ: data-original / original -> src
        let src = img.attr('data-original') || img.attr('original') || img.attr('data-src')
        
        if (!src || src.includes('loading') || src === '') {
            src = img.attr('src')
        }
        
        if (!src || src.includes('logo') || src.includes('loading')) {
            return 'https://paperback.moe/icons/logo-alt.svg'
        }

        src = src.trim()
        if (src.startsWith('//')) src = `https:${src}`
        else if (src.startsWith('/')) src = `https://it.ninemanga.com${src}`
        else if (src.startsWith('http:')) src = src.replace('http:', 'https:')
        
        return src
    }

    /**
     * Estrae l'ID del manga da URL misti (/manga/ o /chapter/)
     */
    private extractMangaId(url: string | undefined): string | null {
        if (!url) return null
        // Cattura l'ID da: /manga/ID.html o /chapter/ID/123.html
        const match = url.match(/\/(?:manga|chapter)\/([^\/]+?)(?:\.html|\/|$)/)
        return match ? match[1] : null
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Titolo: H1 diretto (senza itemprop che a volte manca su mobile)
        let title = $('h1').first().text().trim()
        if (!title) title = $('.book-title').text().trim() || 'Titolo Sconosciuto'
        title = title.replace(/ Manga$/, '').trim()
        
        // Immagine Copertina
        let imageElement = $('.bookintro img').first()
        if (imageElement.length === 0) imageElement = $('.manga-cover img').first()
        const image = this.getImageSrc(imageElement)

        // Metadati da ul.message (più affidabile di itemprop)
        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        $('.book-detail ul.message li').each((_: any, el: any) => {
            const text = $(el).text().trim()
            const content = $(el).find('a').text().trim() || $(el).text().split(':')[1]?.trim()

            if (text.includes('Autore:')) author = content || author
            if (text.includes('Stato:')) {
                const stat = text.toLowerCase()
                if (stat.includes('completato')) status = 'Completed'
            }
        })

        // Descrizione
        let desc = $('p[itemprop="description"]').text().trim()
        if (!desc) {
            // Fallback: Prende tutto il testo del blocco intro rimuovendo i tag noti
            const intro = $('.bookintro').clone()
            intro.find('ul, h1, div.book-cover, a').remove() 
            desc = intro.text().trim()
        }
        desc = desc.replace(/^Sommario:\s*/i, '').trim() || 'Nessuna descrizione disponibile.'

        // Tags
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
                artist: artist,
                desc: desc,
                tags: [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()

        // Selettore lista capitoli
        const links = $('ul.chapter_list a.chapter_list_a').toArray()

        for (const link of links) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            // Estrazione ID Capitolo
            const filePart = href.split('/').pop() ?? ''
            const chapterId = filePart.split('?')[0].replace('.html', '')
            
            // Ignora link di paginazione interna (es. 123-10-1.html)
            if (chapterId.includes('-')) continue 
            
            if (seenIds.has(chapterId)) continue
            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            
            // PULIZIA TITOLO AGGRESSIVA
            // MangaId: "One-Piece" -> Regex: /One[- ]Piece/gi
            const cleanMangaName = mangaId.replace(/[-_]/g, '[- ]') 
            // Rimuove "NomeManga" dal titolo del capitolo (es: "One Piece 1141" -> "1141")
            titleRaw = titleRaw.replace(new RegExp(cleanMangaName, 'gi'), '').trim()
            titleRaw = titleRaw.replace(new RegExp(mangaId, 'gi'), '').trim()

            // Estrazione Data
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
                // Prende l'ultimo numero trovato come numero capitolo
                chapNum = parseFloat(chapNumMatch[chapNumMatch.length - 1])
            }

            // Nomenclatura Paperback "Ch. X"
            let name = titleRaw
            // Rimuove prefissi "Chapter", "Ch."
            name = name.replace(/^(chapter|ch|vol|c)\.?\s*\d+/i, '').trim()
            // Rimuove simboli residui all'inizio
            name = name.replace(/^[-–—:]+\s*/, '').trim()
            
            // Se dopo la pulizia rimane solo il numero o è vuoto, lasciamo gestire a Paperback
            if (name === String(chapNum) || name === '') name = ''

            chapters.push(App.createChapter({
                id: chapterId,
                name: name, // Se vuoto -> Paperback mostra "Ch. 1141"
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
        // Recupera tutte le pagine dal <select id="page">
        const pageUrls: string[] = []
        
        $('select#page option').each((_: any, obj: any) => {
            let val = $(obj).attr('value') ?? ''
            if (val && val !== '0') {
                 if (val.startsWith('/')) val = source.baseUrl + val
                 pageUrls.push(val)
            }
        })

        if (pageUrls.length === 0) {
             const singleImg = this.extractImage($)
             if (singleImg) {
                 return App.createChapterDetails({ id: chapterId, mangaId, pages: [singleImg] })
             }
             // Evitiamo crash, ritorniamo vuoto se fallisce
             return App.createChapterDetails({ id: chapterId, mangaId, pages: [] })
        }

        // Parallelismo gestito
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
        // Qui usiamo getImageSrc per gestire il data-original anche nel reader
        const src = this.getImageSrc(img)
        return (src && !src.includes('logo-alt')) ? src : null
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
        
        $('.book-list li').each((_: any, item: any) => {
            const $item = $(item)
            const link = $item.find('a.bookname').first()
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

        const parseList = (selector: string, target: PartialSourceManga[]) => {
            $(selector).find('li').each((_: any, el: any) => {
                const $el = $(el)
                const link = $el.find('a.bookname').first()
                const href = link.attr('href')
                
                const id = this.extractMangaId(href)
                if (!id) return

                const image = this.getImageSrc($el)
                let title = link.text().trim()
                
                // Rimuove numeri spuri dal titolo in home (es. "One Piece 1141" -> "One Piece")
                title = title.replace(/\s+\d+(\.\d+)?$/, '').trim()
                
                target.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            })
        }

        parseList('#tab_content_3', popularItems) 
        parseList('#tab_content_2', latestItems)  
        parseList('#tab_content_1', newItems)     

        popularSection.items = popularItems
        latestSection.items = latestItems
        newSection.items = newItems

        sectionCallback(popularSection)
        sectionCallback(latestSection)
        sectionCallback(newSection)
    }
}