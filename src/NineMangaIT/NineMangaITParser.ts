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
     * Estrae l'URL immagine corretto.
     * NineManga usa 'original' per il lazy loading nella lista PC.
     */
    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        if (element.is('img')) img = element

        // Ordine di controllo basato su Homepage.txt: original -> src
        let src = img.attr('original') || img.attr('src')

        if (!src || src.includes('pixel.gif') || src.includes('loading')) {
            src = img.attr('src')
        }

        if (!src || src.includes('pixel.gif')) {
            return 'https://paperback.moe/icons/logo-alt.svg'
        }

        src = src.trim()
        if (src.startsWith('//')) src = `https:${src}`
        else if (src.startsWith('/')) src = `https://it.ninemanga.com${src}`

        return src
    }

    /**
     * Estrae l'ID manga gestendo link che possono puntare ai capitoli
     */
    private extractMangaId(url: string | undefined): string | null {
        if (!url) return null
        const match = url.match(/\/(?:manga|chapter)\/([^\/]+?)(?:\.html|\/|$)/)
        return match ? match[1] : null
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Basato su "Manga con resttrizione +18 accettata.txt"
        
        let title = $('h1').first().text().trim()
        // Rimuove la scritta "Manga" finale se presente
        title = title.replace(/\s*Manga$/i, '').trim()
        
        const imageElement = $('.bookintro img').first()
        const image = this.getImageSrc(imageElement)

        let author = 'Unknown'
        let status = 'Ongoing'

        // Metadati in ul.message
        $('.message li').each((_: any, el: any) => {
            const text = $(el).text().trim()
            if (text.includes('Autore:')) {
                author = $(el).find('a').text().trim() || text.replace('Autore:', '').trim()
            }
            if (text.includes('Stato:')) {
                const lowerText = text.toLowerCase()
                if (lowerText.includes('completato')) status = 'Completed'
            }
        })

        // Descrizione: prende testo da itemprop o fallback pulito
        let desc = $('p[itemprop="description"]').text().trim()
        if (!desc) {
             const intro = $('.bookintro').clone()
             intro.find('ul, h1, div, a, img').remove()
             desc = intro.text().trim()
        }
        desc = desc.replace(/^Sommario:\s*/i, '').trim() || 'Nessuna descrizione.'

        // Tag / Generi
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

        // Basato su "Manga con resttrizione +18 accettata.txt": <ul class="sub_vol_ul">
        const links = $('ul.sub_vol_ul li a.chapter_list_a').toArray()

        for (const link of links) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            // ID: /chapter/MangaName/123.html -> 123
            const filePart = href.split('/').pop() ?? ''
            const chapterId = filePart.split('?')[0].replace('.html', '')
            
            // Ignora paginazione (-10-1.html)
            if (chapterId.includes('-')) continue
            
            if (seenIds.has(chapterId)) continue
            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            
            // Pulizia Titolo: Rimuove "NomeManga" dal titolo del capitolo
            const cleanMangaName = mangaId.replace(/[-_]/g, ' ').replace(/\s+/g, '.*')
            titleRaw = titleRaw.replace(new RegExp(cleanMangaName, 'gi'), '').trim()
            titleRaw = titleRaw.replace(new RegExp(mangaId, 'gi'), '').trim()

            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText) {
                const parsedDate = new Date(dateText)
                if (!isNaN(parsedDate.getTime())) time = parsedDate
            }

            // Estrazione Numero
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
        // Basato su "Reader.txt": <select id="page">
        const pageUrls: string[] = []
        
        $('select#page option').each((_: any, obj: any) => {
            let val = $(obj).attr('value') ?? ''
            if (val && val !== '0') {
                 if (val.startsWith('/')) val = source.baseUrl + val
                 pageUrls.push(val)
            }
        })

        if (pageUrls.length === 0) {
            // Fallback: immagine singola
            const img = $('img.manga_pic').first()
            const src = this.getImageSrc(img)
            if (src && !src.includes('logo')) {
                 return App.createChapterDetails({ id: chapterId, mangaId, pages: [src] })
            }
            return App.createChapterDetails({ id: chapterId, mangaId, pages: [] })
        }

        // Fetch parallelo delle pagine
        const promises = pageUrls.map(url => this.fetchImageFromPage(url, source))
        const results = await Promise.all(promises)
        const pages = results.filter(u => u !== null) as string[]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)]
        })
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
            
            const img = $('img.manga_pic').first()
            const src = this.getImageSrc(img)
            return (src && !src.includes('logo')) ? src : null
        } catch (e) {
            return null
        }
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Basato su "Ricerca.txt": <dl class="book-list">
        $('.book-list dd').each((_: any, item: any) => {
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

        // Helper per parsing:
        // Popolari -> ul.p_list li (Homepage.txt)
        // Aggiornamenti -> dl.book-list dd (Sezione Ultimi...txt)
        
        // 1. POPOLARI
        $('ul.p_list li').each((_: any, el: any) => {
            const $el = $(el)
            const link = $el.find('a.bookname').first()
            const href = link.attr('href')
            const id = this.extractMangaId(href)
            
            if (!id) return
            const image = this.getImageSrc($el)
            let title = link.text().trim()
            title = title.replace(/\s+\d+(\.\d+)?$/, '').trim() // Rimuove numeri finali
            
            popularItems.push(App.createPartialSourceManga({
                mangaId: id, image: image, title: title, subtitle: undefined
            }))
        })

        // 2. ULTIMI AGGIORNAMENTI & NUOVI
        // Usano spesso dl.book-list o ul.book-list a seconda del tab
        $('.book-list dd, .book-list li').each((_: any, el: any) => {
             // Escludiamo quelli che sono dentro p_list per non duplicare
             if ($(el).parents('.p_list').length > 0) return

             const $el = $(el)
             const link = $el.find('a.bookname').first()
             const href = link.attr('href')
             const id = this.extractMangaId(href)

             if (!id) return
             const image = this.getImageSrc($el)
             let title = link.text().trim()
             title = title.replace(/\s+\d+(\.\d+)?$/, '').trim()

             const chapterText = $el.find('a.chapter').first().text().trim()

             latestItems.push(App.createPartialSourceManga({
                 mangaId: id, image: image, title: title, subtitle: chapterText
             }))
        })

        // (Opzionale) Mappa gli item nelle sezioni appropriate
        // Per semplicità popoliamo latest e new con logiche simili se non abbiamo selettori distinti chiari nei txt
        popularSection.items = popularItems
        latestSection.items = latestItems
        // Copiamo latest in new per ora, o usiamo un filtro diverso se presente
        newSection.items = latestItems 

        sectionCallback(popularSection)
        sectionCallback(latestSection)
        sectionCallback(newSection)
    }
}