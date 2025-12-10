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

const MP_DOMAIN = 'https://mangapark.net'

export class MangaParkParser {

    /**
     * Tenta di ottenere l'immagine alla massima risoluzione rimuovendo suffissi di resize.
     */
    private getHighResImage(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        
        // Correzione protocollo
        if (url.startsWith('//')) url = `https:${url}`
        else if (url.startsWith('/')) url = `${MP_DOMAIN}${url}`

        // MangaPark a volte usa suffissi tipo .300x400.jpg o -300x400.jpg
        // Proviamo a rimuovere pattern comuni di resize
        // Esempio: cover.png_res_300x400.jpg -> cover.png
        return url.replace(/_(?:res_)?\d+x\d+(?:\.[a-z]+)?$/i, '')
    }

    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        // Priorità a data-src (lazy load)
        let src = img.attr('data-src') || img.attr('srcset') || img.attr('src')
        return this.getHighResImage(src)
    }

    /**
     * Helper centralizzato per parsare un singolo elemento manga dalla lista/griglia.
     * Riduce drasticamente la duplicazione del codice.
     */
    private parseMangaItem($: any, element: any): PartialSourceManga | null {
        const item = $(element)
        
        // Logica per trovare il link del titolo
        let link = item.is('a') ? item : item.find('a[href*="/title/"]').first()
        const href = link.attr('href')
        
        // Estrazione ID robusta
        // Supporta formati: /title/12345-nome-manga o /title/12345
        const idMatch = href?.match(/\/title\/(\d+)/)
        const id = idMatch ? idMatch[1] : null

        if (!id) return null

        const image = this.getImageSrc(item)

        // Logica Titolo: prova vari selettori in ordine di probabilità
        let title = item.find('h3 a, a.font-bold').first().text().trim()
        if (!title) title = item.find('img').attr('title') || item.find('img').attr('alt') || ''
        if (!title) title = link.text().trim()
        if (!title) title = 'Unknown Title'

        // Logica Sottotitolo (es. "Ch. 123" o "1 hour ago")
        // Cerca il testo nell'angolo o sotto il titolo
        let subtitle = item.find('div.flex.justify-between a, .absolute.bottom-0').first().text().trim()

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h3 a.link-hover').first().text().trim()
        if (!title) title = $('.comic-detail h3').first().text().trim()
        if (!title) title = $('title').text().split('-')[0]?.trim() ?? 'Unknown Title'

        // Selettore immagine dettaglio più specifico
        let image = this.getImageSrc($('.w-24, .w-52, div.relative').first())

        let desc = $('.limit-html-p').text().trim()
        if (!desc) desc = $('.limit-html').text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? 'No description available'

        const authors: string[] = []
        $('a[href*="/search?word="]').each((_: any, el: any) => {
            const parentText = $(el).parent().text()
            if (parentText.includes('Story') || parentText.includes('Art')) {
                authors.push($(el).text().trim())
            }
        })
        let author = authors.length > 0 ? [...new Set(authors)].join(', ') : 'Unknown'

        let status = 'Ongoing'
        const statusText = $('span.font-bold.uppercase').text().trim().toLowerCase()
        if (statusText.includes('completed')) status = 'Completed'
        if (statusText.includes('hiatus')) status = 'Hiatus'

        const arrayTags: Tag[] = []
        $('a[href^="/search?genres="]').each((_: any, el: any) => {
            const tagText = $(el).text().trim()
            if (tagText) arrayTags.push({ id: tagText.toLowerCase(), label: tagText })
        })
        
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: '',
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        // Cerchiamo contenitori di link ai capitoli
        const links = $('div[data-name="chapter-list"] a, .p-2 a.flex').toArray()

        for (const el of links) {
            const link = $(el)
            const href = link.attr('href')
            
            if (!href || !href.includes('/title/')) continue

            // Estrazione ID capitolo dall'URL
            // Url tipico: /title/123456/chapter-123456
            const parts = href.split('/')
            const chapterId = parts.pop() || parts[parts.length - 1]
            
            // Validazione base ID
            if (!chapterId) continue

            const titleRaw = link.text().trim()
            if (!titleRaw) continue

            // Parsing Data: cerca tag <time> nei genitori
            let timeStr = ''
            let parent = link.parent()
            // Risale fino a 3 livelli per trovare il time
            const timeTag = parent.find('time').first() || parent.parent().find('time').first()
            if (timeTag.length > 0) timeStr = timeTag.text().trim()

            // Parsing Numeri più robusto
            // Cerca "Vol. X" e "Ch. Y" o numeri isolati
            const volMatch = titleRaw.match(/Vol\.?\s*(\d+(\.\d+)?)/i)
            const volNum = volMatch ? parseFloat(volMatch[1]) : undefined

            // Regex prioritaria per "Ch. X" o "Chapter X"
            let chapNum = 0
            const chapMatch = titleRaw.match(/(?:ch|chapter|c|episode)\.?\s*(\d+(\.\d+)?)/i)
            if (chapMatch) {
                chapNum = parseFloat(chapMatch[1])
            } else {
                // Fallback: cerca l'ultimo numero nella stringa (spesso è il capitolo)
                const simpleNums = titleRaw.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    // Evita di prendere il volume come capitolo se sono uguali/vicini
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1])
                }
            }

            // Pulizia nome
            let name = titleRaw
            // Rimuovi prefissi ridondanti se necessario, o aggiungi info extra
            const extraInfo = link.next('span').text().trim().replace(/^:\s*/, '')
            if (extraInfo) name += ` - ${extraInfo}`

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: this.convertTime(timeStr),
                langCode: 'en'
            }))
        }

        return chapters
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Combina selettori per Grid e List
        // div.group.relative = elementi griglia
        // div.flex.border-b = elementi lista
        const selector = 'div.group.relative, div.flex.border-b'
        
        $(selector).each((_: any, element: any) => {
            const item = this.parseMangaItem($, element)
            if (item && !seenIds.has(item.mangaId)) {
                seenIds.add(item.mangaId)
                results.push(item)
            }
        })
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. POPULAR -> Vetrina (Large)
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Popular Updates 🔥', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowLarge // <-- Vetrina
        })
        
        // 2. LATEST -> Continuous (Scroll infinito)
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Releases 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous // <-- Lista verticale
        })
        
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // --- POPULAR (Solitamente nella Grid in alto) ---
        // Cerchiamo la sezione "Popular Updates" specificamente
        const popularContainer = $('b:contains("Popular Updates")').closest('div.space-y-5')
        popularContainer.find('div.group.relative').each((_: any, el: any) => {
            const item = this.parseMangaItem($, el)
            if (item && !seenIds.has(item.mangaId)) {
                seenIds.add(item.mangaId)
                popularItems.push(item)
            }
        })
        popularSection.items = popularItems
        sectionCallback(popularSection)

        // --- LATEST (Lista sotto) ---
        // Cerchiamo la sezione "Latest Releases"
        const latestContainer = $('b:contains("Latest Releases")').closest('div.space-y-5')
        latestContainer.find('div.flex.border-b').each((_: any, el: any) => {
            const item = this.parseMangaItem($, el)
            if (item && !seenIds.has(item.mangaId)) {
                seenIds.add(item.mangaId)
                latestItems.push(item)
            }
        })
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }

    private convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }
}