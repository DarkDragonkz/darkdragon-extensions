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
     * Estrae l'URL dell'immagine gestendo il lazy loading specifico di NineManga.
     * Trovato in Homepage.txt: <img src="..." original="http://..." />
     */
    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        if (element.is('img')) img = element

        // PRIORITÀ: original -> data-original -> src
        let src = img.attr('original') || img.attr('data-original') || img.attr('src')
        
        if (!src || src.includes('pixel.gif') || src.includes('loading')) {
            // Tentativo di fallback se original è vuoto ma src ha qualcosa
            src = img.attr('src')
        }

        if (!src || src.includes('logo') || src.includes('pixel.gif')) {
            return 'https://paperback.moe/icons/logo-alt.svg'
        }

        src = src.trim()
        if (src.startsWith('//')) src = `https:${src}`
        else if (src.startsWith('/')) src = `https://it.ninemanga.com${src}`
        
        return src
    }

    /**
     * Estrae l'ID del manga anche se il link punta a un capitolo.
     * Esempio trovato: /chapter/Nome_Manga/123.html -> ID: Nome_Manga
     */
    private extractMangaId(url: string | undefined): string | null {
        if (!url) return null
        // Regex che cattura l'ID sia da /manga/ID.html che da /chapter/ID/123.html
        const match = url.match(/\/(?:manga|chapter)\/([^\/]+?)(?:\.html|\/|$)/)
        return match ? match[1] : null
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Basato su "Manga con resttrizione +18 accettata.txt"
        
        // 1. Titolo
        let title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        title = title.replace(/ Manga$/, '').trim()
        
        // 2. Immagine
        let imageElement = $('.bookintro img').first()
        if (imageElement.length === 0) imageElement = $('.manga-cover img').first()
        const image = this.getImageSrc(imageElement)

        // 3. Metadati (Autore, Stato) da ul.message
        let author = 'Unknown'
        let status = 'Ongoing'
        
        $('.message li').each((_: any, el: any) => {
            const text = $(el).text().trim()
            if (text.includes('Autore:')) {
                author = $(el).find('a').text().trim() || text.replace('Autore:', '').trim()
            }
            if (text.includes('Stato:')) {
                const statusText = text.toLowerCase()
                if (statusText.includes('completato')) status = 'Completed'
            }
        })

        // 4. Descrizione
        // Trovato in txt: <p itemprop="description"> oppure testo libero in .bookintro
        let desc = $('p[itemprop="description"]').text().trim()
        if (!desc) {
            const intro = $('.bookintro').clone()
            intro.find('ul.message, h1, div, a.btn, img').remove()
            desc = intro.text().trim()
        }
        desc = desc.replace(/^Sommario:\s*/i, '').trim()

        // 5. Tags
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
                desc: desc || 'Nessuna descrizione.',
                tags: [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()

        // Basato su "Manga con resttrizione +18 accettata.txt": <ul class="chapter_list"> <a class="chapter_list_a">
        const links = $('ul.chapter_list a.chapter_list_a').toArray()

        for (const link of links) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            // ID: /chapter/Manga/123.html -> 123
            const filePart = href.split('/').pop() ?? ''
            const chapterId = filePart.split('?')[0].replace('.html', '')
            
            // Ignora link di paginazione (-10-1.html)
            if (chapterId.includes('-')) continue 
            
            if (seenIds.has(chapterId)) continue
            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            
            // PULIZIA TITOLO:
            // Nel txt vedo: title="One Piece 1118"
            // Dobbiamo rimuovere "One Piece" per lasciare "1118"
            const cleanMangaName = mangaId.replace(/[-_]/g, ' ').replace(/\s+/g, '.*')
            const mangaNameRegex = new RegExp(`^${cleanMangaName}`, 'i')
            
            titleRaw = titleRaw.replace(mangaNameRegex, '').trim()
            titleRaw = titleRaw.replace(new RegExp(mangaId.replace(/[-_]/g, ' '), 'i'), '').trim()

            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText) {
                 // Formato: Dec 12, 2025
                 const parsedDate = new Date(dateText)
                 if (!isNaN(parsedDate.getTime())) time = parsedDate
            }

            const chapNumMatch = titleRaw.match(/(\d+(\.\d+)?)/g)
            let chapNum = 0
            if (chapNumMatch && chapNumMatch.length > 0) {
                chapNum = parseFloat(chapNumMatch[chapNumMatch.length - 1])
            }

            let name = titleRaw
            name = name.replace(/^(chapter|ch|vol|c)\.?\s*\d+/i, '').trim()
            name = name.replace(/^[-–—:]+\s*/, '').trim()
            
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
        // Basato su "Reader.txt": <select id="page"> <option value="/chapter/...">
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
        // Basato su "Reader.txt": <img class="manga_pic">
        const img = $('img.manga_pic').first()
        const src = this.getImageSrc(img) // Riusa la logica che gestisce il lazy load
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
        // Basato su "Ricerca.txt": <ul class="book-list"> <li> <a class="bookname">
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
            // "Homepage.txt" conferma che sono dentro <li>
            $(selector).find('li').each((_: any, el: any) => {
                const $el = $(el)
                const link = $el.find('a.bookname').first()
                const href = link.attr('href')
                
                // CRITICO: Usa extractMangaId per gestire i link /chapter/
                const id = this.extractMangaId(href)
                if (!id) return

                const image = this.getImageSrc($el)
                let title = link.text().trim()
                
                // PULIZIA TITOLO HOME: Rimuove "1141" alla fine
                title = title.replace(/\s+\d+(\.\d+)?$/, '').trim()
                
                target.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            })
        }

        // Selettori presi da "Homepage.txt"
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