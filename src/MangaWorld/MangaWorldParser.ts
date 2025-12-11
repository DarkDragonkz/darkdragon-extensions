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
const CDN_URL = 'https://cdn.mangaworld.mx' // Base URL per le immagini CDN

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
    parseMangaDetails($: any, mangaId: string): SourceManga {
        const infoBox = $('.comic-info')
        
        // Titolo (h1.name.bigger)
        let rawTitle = $('h1.name', infoBox).text().trim()
        if (!rawTitle) rawTitle = $('.comic-title', infoBox).text().trim()
        const title = this.cleanTitle(rawTitle)
        
        // Immagine
        const image = this.getImageSrc($('.thumb img', infoBox))

        // Descrizione
        let desc = $('#noidungm').text().trim()
        if (!desc) desc = $('.comic-description').text().trim()

        let author = 'Unknown'
        let status = 'Ongoing'
        let artist = 'Unknown'

        // Parsing Metadati
        $('.meta-data [class*="col-"]', infoBox).each((_: any, col: any) => {
            const text = $(col).text().trim()
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

    // --- PARSER CAPITOLI ---
    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        const wrapper = $('.chapters-wrapper')
        const volumes = wrapper.find('.volume-element')
        
        if (volumes.length > 0) {
            volumes.each((_: any, volEl: any) => {
                const volText = $(volEl).find('.volume-name').text().trim()
                const volNumMatch = volText.match(/Volume\s*(\d+)/i)
                const volNum = volNumMatch ? parseInt(volNumMatch[1]) : undefined

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
        
        // Rimuove "Capitolo X" dal titolo se c'è altro testo
        const cleanName = titleText.replace(/Capitolo\s*\d+(\.\d+)?\s*-?\s*/i, '').trim()
        if (cleanName.length > 0) {
            name = cleanName
        }

        chapters.push(App.createChapter({
            id: chapterId,
            name: name,
            chapNum: chapNum,
            volume: volNum,
            time: time,
            langCode: '🇮🇹',
            sortingIndex: chapters.length
        }))
    }

    // --- PARSER DETTAGLI CAPITOLO (READER) ---
    // Logica avanzata per gestire il JSON complesso di MangaWorld
    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // 1. Estrazione JSON (Metodo Primario)
        // Cerca lo script che contiene $MC = ... o window.$MC = ...
        // Il pattern nel tuo HTML è: $MC=(window.$MC||[]).concat({"o":...
        // Cerchiamo un blocco JSON grande che contenga "pages":[...]
        
        try {
            // Regex per trovare l'oggetto JSON che contiene "pages":[...]
            // Cerchiamo una stringa che inizia con "pages":[" e finisce con "]"
            const pagesMatch = html.match(/"pages":\[(.*?)\]/)
            
            if (pagesMatch && pagesMatch[1]) {
                // Abbiamo la lista di file: "1.jpg","2.jpg",...
                const fileNames = pagesMatch[1].split(',').map(f => f.trim().replace(/['"]/g, ''))
                
                // Ora dobbiamo trovare la struttura delle cartelle per costruire l'URL completo
                // L'URL è tipicamente: https://cdn.mangaworld.mx/chapters/{manga-slug}-{manga-id}/{volume-slug}-{volume-id}/{chapter-slug}-{chapter-id}/{page-file}
                // O simile. Dobbiamo estrarre questi slug dal JSON o dall'HTML.
                
                // Cerchiamo le info del capitolo e del manga nel JSON
                const mangaIdMatch = html.match(/"manga":"([a-f0-9]{24})"/i) // ID Mongo (es. 5fa0c9e2...)
                const mangaSlugMatch = html.match(/"slug":"([^"]+)"/)
                
                const chapterIdMatch = html.match(/"id":"([a-f0-9]{24})"/i) // Potrebbe essere diverso dall'ID nell'URL
                const chapterSlugFolderMatch = html.match(/"slugFolder":"([^"]+)"/)
                
                const volumeSlugFolderMatch = html.match(/"slugFolder":"(volume-[^"]+)"/)

                // Se non riusciamo a costruire l'URL dai pezzi, proviamo a cercare se c'è un URL base o path nel JSON
                // Nel tuo HTML vedo: https://cdn.mangaworld.mx/chapters/one-piece-5fa0c9e2.../volume-01.../capitolo-00.../1.jpg
                
                // Metodo alternativo: Cerchiamo direttamente un URL completo di immagine nel JSON/HTML per capire il pattern
                // E poi sostituiamo il nome del file.
                const sampleImgMatch = html.match(/https:\/\/cdn\.mangaworld\.mx\/chapters\/[^"]+\/([^"]+\.(jpg|png|jpeg))/i)
                
                if (sampleImgMatch) {
                    const fullUrl = sampleImgMatch[0]
                    const basePath = fullUrl.substring(0, fullUrl.lastIndexOf('/') + 1)
                    
                    for (const fileName of fileNames) {
                        pages.push(basePath + fileName)
                    }
                } 
                else {
                    // Fallback se non troviamo un URL campione: proviamo a costruire se abbiamo i dati
                    // Questo è rischioso se il formato cambia.
                }
            }
        } catch (e) {
            console.error("MangaWorld JSON parsing failed", e)
        }

        // 2. Fallback DOM (Se il metodo JSON fallisce o non trova pagine)
        if (pages.length === 0) {
            const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["']content-image/g
            let match
            while ((match = imgRegex.exec(html)) !== null) {
                const url = this.getImageSrc({ attr: () => match![1] })
                pages.push(url)
            }
        }

        // 3. Fallback Estremo (Cerca qualsiasi immagine che sembri una pagina del capitolo)
        if (pages.length === 0) {
             const genericRegex = /https:\/\/cdn\.mangaworld\.mx\/chapters\/[^"]+\.(jpg|png|jpeg)/g
             let match
             while ((match = genericRegex.exec(html)) !== null) {
                 pages.push(match[0])
             }
        }

        // Rimuovi duplicati
        const uniquePages = [...new Set(pages)]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: uniquePages
        })
    }

    // --- HOME PAGE PARSERS ---

    parseHomeSections($: any, month: HomeSection, latest: HomeSection, trending: HomeSection): void {
        
        // 1. MANGA DEL MESE
        const monthItems: PartialSourceManga[] = []
        $('.top-wrapper .entry').each((i: number, item: any) => {
            if (i >= 10) return
            const el = $(item)
            
            const link = el.find('.content .name').parent() 
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            const title = this.cleanTitle(el.find('.content .name').text())
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

        // 2. ULTIMI CAPITOLI
        const latestItems: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            const el = $(item)
            const titleEl = el.find('a.manga-title')
            const title = this.cleanTitle(titleEl.text())
            const href = titleEl.attr('href') || el.find('a.thumb').attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            const image = this.getImageSrc(el.find('img'))
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

        // 3. TRENDING
        const trendingItems: PartialSourceManga[] = []
        $('#chapters-slide .entry').each((_: any, item: any) => {
            const el = $(item)
            if (el.hasClass('slick-cloned')) return

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
            const href = titleEl.attr('href') || el.find('a.thumb').attr('href')
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