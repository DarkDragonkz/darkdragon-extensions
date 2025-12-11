import {
    Chapter,
    ChapterDetails,
    HomeSection,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const BASE_URL = 'https://www.mangaworld.mx'

export class MangaWorldParser {

    /**
     * Parsing Date Italiane
     */
    private parseItalianDate(dateStr: string): Date {
        const months: { [key: string]: number } = {
            'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
            'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11,
            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
        }

        dateStr = dateStr.toLowerCase().trim()
        if (dateStr.includes('oggi')) return new Date()
        if (dateStr.includes('ieri')) {
            const d = new Date()
            d.setDate(d.getDate() - 1)
            return d
        }

        const parts = dateStr.split(' ')
        if (parts.length >= 3) {
            const day = parseInt(parts[0] ?? '1')
            const monthName = parts[1] ?? ''
            const year = parseInt(parts[2] ?? new Date().getFullYear().toString())
            if (months[monthName] !== undefined) return new Date(year, months[monthName]!, day)
        }
        return new Date()
    }

    private cleanTitle(title: string): string {
        if (!title) return 'Unknown'
        title = title.trim()
        // Fix duplicazione titoli di MangaWorld
        if (title.length > 0 && title.length % 2 === 0) {
            const half = title.substring(0, title.length / 2)
            if (half === title.substring(title.length / 2)) return half
        }
        return title
    }

    private getImageSrc(element: any): string {
        let image = element.attr('src') ?? ''
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = element.attr('data-src') ?? element.attr('data-original') ?? ''
        }
        if (image && image.startsWith('/')) image = BASE_URL + image
        return image || 'https://paperback.moe/icons/logo-alt.svg'
    }

    // --- PARSER DETTAGLI ---
    // Basato su "Pagine Manga.txt"
    parseMangaDetails($: any, mangaId: string): SourceManga {
        const infoBox = $('.comic-info')
        
        // Titolo specifico (h1.name.bigger)
        let rawTitle = $('h1.name', infoBox).text().trim()
        if (!rawTitle) rawTitle = $('.comic-title', infoBox).text().trim()
        
        const title = this.cleanTitle(rawTitle)
        const image = this.getImageSrc($('.comic-thumb img', infoBox))

        let desc = $('#noidungm').text().trim()
        if (!desc) desc = $('.description').text().trim()

        let author = 'Unknown'
        let status = 'Ongoing'
        let artist = 'Unknown'

        // Parsing Metadati Robusto
        // Cerca i tag <strong> dentro .meta-data e prende il nodo di testo successivo
        $('.meta-data .col-12, .meta-data .col-6').each((_: any, col: any) => {
            const label = $(col).find('strong').text().toLowerCase()
            const value = $(col).text().replace($(col).find('strong').text(), '').trim()

            if (label.includes('autore')) author = value
            if (label.includes('artista')) artist = value
            if (label.includes('stato')) {
                if (value.toLowerCase().includes('completato') || value.toLowerCase().includes('finito')) {
                    status = 'Completed'
                }
            }
        })

        const arrayTags: Tag[] = []
        $('.tags a', infoBox).each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('genre=')[1] ?? label
            if (label) arrayTags.push(App.createTag({ id, label }))
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: artist,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Basato sulla struttura standard MangaWorld (.chapters-wrapper o .list-chapters)
        const container = $('.chapters-wrapper').length > 0 ? $('.chapters-wrapper') : $('.list-chapters')
        
        $('.chapter-item', container).each((_: any, item: any) => {
            const link = $(item).find('a').first() // Prende il primo link
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.split('/').pop() ?? ''
            const rawTitle = link.text().trim()
            
            const dateText = $(item).find('.chapter-date, .date').text().trim()
            const time = this.parseItalianDate(dateText)

            // Regex Numeri
            const volMatch = rawTitle.match(/Vol\.?\s*(\d+)/i)
            const chapMatch = rawTitle.match(/(?:Cap|Ch)\.?\s*(\d+(\.\d+)?)/i)
            
            const volNum = volMatch ? parseInt(volMatch[1] ?? '0') : undefined
            const chapNum = chapMatch ? parseFloat(chapMatch[1] ?? '0') : 0

            // Naming
            let name = ''
            if (volNum !== undefined) name += `Vol. ${volNum} `
            name += `Ch. ${chapNum}`
            
            if (rawTitle.includes('-')) {
                const extraTitle = rawTitle.split('-').slice(1).join('-').trim()
                if (extraTitle && !extraTitle.includes(String(chapNum))) {
                    name += ` - ${extraTitle}`
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: time,
                langCode: 'it',
                sortingIndex: chapters.length
            }))
        })

        return chapters
    }

    // Basato su "Reader Capitolo.txt"
    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // 1. JSON Injection (Metodo migliore, visibile nel tuo file txt)
        // Cerca variabili JSON che contengono "pages": [...]
        try {
            const jsonMatch = html.match(/wrapper\s*=\s*(\{.*?\});/s)
            if (jsonMatch && jsonMatch[1]) {
                const data = JSON.parse(jsonMatch[1])
                // MangaWorld a volte ha structure diverse nel JSON, cerchiamo 'pages' o 'chapter.pages'
                const pageList = data.chapter?.pages || data.pages || []
                if (Array.isArray(pageList)) {
                    for (const p of pageList) {
                        // Se è solo nome file, serve il path base, ma di solito è full url o relativo
                        // Nel tuo file txt vedo: "pages":["1.jpg",...]
                        // Bisogna capire il base URL. Spesso è nel JSON come `chapter.slugFolder` o simile.
                        // Se non riusciamo a costruire l'URL dal JSON parziale, usiamo il fallback HTML.
                    }
                }
            }
        } catch (e) { /* Fallback */ }

        // 2. DOM Parsing (Fallback sicuro)
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["']content-image/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = this.getImageSrc({ attr: () => match![1] })
            pages.push(url)
        }

        if (pages.length === 0) {
             // Fallback reader-area (vecchio layout)
             const genericRegex = /<div id="page_\d+">.*?<img[^>]+src=["']([^"']+)["']/gs
             while ((match = genericRegex.exec(html)) !== null) {
                 const url = this.getImageSrc({ attr: () => match![1] })
                 pages.push(url)
             }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // --- HOME PAGE SECTIONS ---

    parseHomeSections($: any, month: HomeSection, latest: HomeSection, trending: HomeSection): void {
        
        // 1. MANGA DEL MESE (.top-wrapper .entry) [File: Manga del mese.txt]
        const monthItems: PartialSourceManga[] = []
        $('.top-wrapper .entry').each((i: number, item: any) => {
            if (i >= 10) return
            const el = $(item)
            
            // Titolo e ID
            const nameEl = el.find('.name').first()
            const title = this.cleanTitle(nameEl.text().trim())
            
            // Link - Cerca nel bottone "Leggi!" o nel titolo
            let href = el.find('a.chap').attr('href')
            if (!href) href = el.find('a').first().attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''

            // Immagine: Nel tuo file txt, l'immagine è in .thumb img
            const image = this.getImageSrc(el.find('.thumb img'))

            if (id && title) {
                monthItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: 'Top Mensile'
                }))
            }
        })
        month.items = monthItems

        // 2. ULTIMI CAPITOLI (.comics-grid .entry) [File: Ultimi capitoli aggiunti.txt]
        const latestItems: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            const el = $(item)
            const link = el.find('a.manga-title')
            const title = this.cleanTitle(link.text().trim())
            const href = link.attr('href') || el.find('a.thumb').attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            
            const image = this.getImageSrc(el.find('img'))
            
            // Capitolo recente
            const subtitle = el.find('.xanh').first().text().trim() || 'Aggiornato'

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        latest.items = latestItems

        // 3. CAPITOLI DI TENDENZA (#chapters-slide .entry) [File: Capitoli di tendenza.txt]
        const trendingItems: PartialSourceManga[] = []
        $('#chapters-slide .entry').each((_: any, item: any) => {
            const el = $(item)
            // Ignora cloni slick
            if (el.hasClass('slick-cloned')) return

            const link = el.find('a.manga-title')
            const title = this.cleanTitle(link.text().trim())
            const href = link.attr('href') || el.find('a.thumb').attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            
            const image = this.getImageSrc(el.find('img'))
            const subtitle = el.find('.chapter').text().trim()

            if (id && title) {
                trendingItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        trending.items = trendingItems
    }

    parseViewMore($: any): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        // Usa lo stesso parser di latest
        $('.comics-grid .entry').each((_: any, item: any) => {
            const el = $(item)
            const link = el.find('a.manga-title')
            const title = this.cleanTitle(link.text().trim())
            const href = link.attr('href') || el.find('a.thumb').attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            const image = this.getImageSrc(el.find('img'))
            
            if (id && title) {
                manga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title
                }))
            }
        })
        return manga
    }
}