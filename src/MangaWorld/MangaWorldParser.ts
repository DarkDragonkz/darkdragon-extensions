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
        // Fix duplicazione titoli di MangaWorld (es. NarutoNaruto)
        if (title.length > 0 && title.length % 2 === 0) {
            const half = title.substring(0, title.length / 2)
            if (half === title.substring(title.length / 2)) return half
        }
        return title
    }

    private getImageSrc(element: any): string {
        let image = element.attr('src') ?? ''
        // Gestione Lazy Load
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = element.attr('data-src') ?? element.attr('data-original') ?? ''
        }
        if (image && image.startsWith('/')) image = BASE_URL + image
        return image || 'https://paperback.moe/icons/logo-alt.svg'
    }

    // --- PARSER DETTAGLI ---
    // Basato su "Immagine Manga e in formazioni varie.txt" e "Trama.txt"
    parseMangaDetails($: any, mangaId: string): SourceManga {
        const infoBox = $('.comic-info')
        
        // Titolo (h1.name.bigger)
        let rawTitle = $('h1.name', infoBox).text().trim()
        if (!rawTitle) rawTitle = $('.comic-title', infoBox).text().trim()
        const title = this.cleanTitle(rawTitle)
        
        // Immagine
        const image = this.getImageSrc($('.thumb img', infoBox))

        // Descrizione (Trama.txt)
        let desc = $('#noidungm').text().trim()
        if (!desc) desc = $('.comic-description').text().trim()

        let author = 'Unknown'
        let status = 'Ongoing'
        let artist = 'Unknown'

        // Parsing Metadati
        // Cerca dentro le colonne col-6 o col-md-4
        $('.meta-data [class*="col-"]', infoBox).each((_: any, col: any) => {
            const text = $(col).text().trim()
            // Usa includes case-insensitive o check diretto
            if (text.toLowerCase().includes('autore:')) {
                author = $(col).find('a').text().trim()
            }
            if (text.toLowerCase().includes('artista:')) {
                artist = $(col).find('a').text().trim()
            }
            if (text.toLowerCase().includes('stato:')) {
                if (text.toLowerCase().includes('completato') || text.toLowerCase().includes('finito')) {
                    status = 'Completed'
                }
            }
        })

        const arrayTags: Tag[] = []
        $('.tags a, .genre a', infoBox).each((_: any, a: any) => {
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

    // Basato su "Lista capitoli.txt"
    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Selettore principale wrapper
        const wrapper = $('.chapters-wrapper')
        
        // Se esistono i volumi (.volume-element), iteriamo su di loro
        const volumes = wrapper.find('.volume-element')
        
        if (volumes.length > 0) {
            volumes.each((_: any, volEl: any) => {
                const volText = $(volEl).find('.volume-name').text().trim() // Es: "Volume 14"
                const volNumMatch = volText.match(/Volume\s*(\d+)/i)
                const volNum = volNumMatch ? parseInt(volNumMatch[1]) : undefined

                // Itera sui capitoli dentro questo volume
                $(volEl).find('.chapter').each((_: any, item: any) => {
                    this.extractChapterData($, item, chapters, volNum)
                })
            })
        } else {
            // Fallback: lista piatta se non ci sono volumi
            $('.chapter', wrapper).each((_: any, item: any) => {
                this.extractChapterData($, item, chapters, undefined)
            })
        }

        return chapters
    }

    // Helper per estrarre dati capitolo singolo
    private extractChapterData($: any, item: any, chapters: Chapter[], volNum: number | undefined) {
        const link = $(item).find('a.chap')
        const href = link.attr('href')
        if (!href) return

        const chapterId = href.split('/').pop() ?? ''
        
        // Titolo (es: "Capitolo 04")
        const titleText = link.find('span').text().trim()
        const dateText = link.find('.chap-date').text().trim()
        const time = this.parseItalianDate(dateText)

        // Parsing numero capitolo
        const chapMatch = titleText.match(/(\d+(\.\d+)?)/)
        const chapNum = chapMatch ? parseFloat(chapMatch[0]) : 0

        // Nome visualizzato
        let name = `Ch. ${chapNum}`
        if (volNum !== undefined) {
            // Se c'è il volume, Paperback lo gestisce automaticamente, ma possiamo metterlo nel nome se vogliamo
            // name = `Vol. ${volNum} Ch. ${chapNum}` 
            // Meglio lasciare solo Ch. X se passiamo il parametro volume all'oggetto Chapter
        }

        chapters.push(App.createChapter({
            id: chapterId,
            name: name,
            chapNum: chapNum,
            volume: volNum,
            time: time,
            langCode: 'it',
            // Sorting index basato sulla posizione inversa o gestito da Paperback con volume/chapNum
        }))
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // 1. Cerca nel DOM (metodo classico visualizzato in Pagine Manga.txt e Reader)
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["']content-image/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = this.getImageSrc({ attr: () => match![1] })
            pages.push(url)
        }

        // 2. Fallback JSON (se presente nel reader)
        if (pages.length === 0) {
            try {
                const jsonMatch = html.match(/wrapper\s*=\s*(\{.*?\});/s)
                if (jsonMatch && jsonMatch[1]) {
                    // Qui servirebbe logica complessa per ricostruire URL da JSON parziali
                    // Ma solitamente il metodo DOM sopra basta per MangaWorld
                }
            } catch (e) { }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // --- HOME PAGE PARSERS ---

    parseHomeSections($: any, month: HomeSection, latest: HomeSection, trending: HomeSection): void {
        
        // 1. MANGA DEL MESE (Manga del mese.txt)
        const monthItems: PartialSourceManga[] = []
        $('.top-wrapper .entry').each((i: number, item: any) => {
            if (i >= 10) return
            const el = $(item)
            
            const link = el.find('.content .name').parent() // Link nel nome
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            const title = this.cleanTitle(el.find('.content .name').text())
            
            // Immagine HD in .thumb img
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

        // 2. ULTIMI CAPITOLI (Ultimi capitoli aggiunti.txt)
        const latestItems: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            const el = $(item)
            const titleEl = el.find('a.manga-title')
            const title = this.cleanTitle(titleEl.text())
            const href = titleEl.attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            
            const image = this.getImageSrc(el.find('img'))
            
            // Sottotitolo: Capitolo X
            const subtitle = el.find('.xanh').first().text().trim()

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

        // 3. TRENDING (Capitoli di tendenza.txt)
        const trendingItems: PartialSourceManga[] = []
        $('#chapters-slide .entry').each((_: any, item: any) => {
            const el = $(item)
            if (el.hasClass('slick-cloned')) return // Evita duplicati slider

            const titleEl = el.find('a.manga-title')
            const title = this.cleanTitle(titleEl.text())
            const href = titleEl.attr('href')
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
        $('.comics-grid .entry').each((_: any, item: any) => {
            const el = $(item)
            const titleEl = el.find('a.manga-title')
            const title = this.cleanTitle(titleEl.text())
            const href = titleEl.attr('href')
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