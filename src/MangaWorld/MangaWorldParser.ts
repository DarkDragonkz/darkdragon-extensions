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

const BASE_URL = 'https://www.mangaworld.mx'

export class MangaWorldParser {

    /**
     * Fix robusto per il bug dei titoli duplicati (es. "NarutoNaruto")
     */
    private cleanTitle(title: string): string {
        if (!title) return 'Unknown'
        title = title.trim()
        
        if (title.length > 0 && title.length % 2 === 0) {
            const halfLength = title.length / 2
            const firstHalf = title.substring(0, halfLength)
            const secondHalf = title.substring(halfLength)
            
            // Tagliamo SOLO se le due metà sono identiche
            if (firstHalf === secondHalf) {
                return firstHalf
            }
        }
        return title
    }

    private parseDate(dateStr: string): Date {
        if (!dateStr) return new Date()
        
        dateStr = dateStr.trim().toLowerCase()
        
        const months: { [key: string]: string } = {
            'gennaio': 'January', 'febbraio': 'February', 'marzo': 'March',
            'aprile': 'April', 'maggio': 'May', 'giugno': 'June',
            'luglio': 'July', 'agosto': 'August', 'settembre': 'September',
            'ottobre': 'October', 'novembre': 'November', 'dicembre': 'December'
        }

        for (const [it, en] of Object.entries(months)) {
            if (dateStr.includes(it)) {
                dateStr = dateStr.replace(it, en)
                break
            }
        }

        const date = new Date(dateStr)
        return isNaN(date.getTime()) ? new Date() : date
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('.name.bigger').first().text().trim() ?? ''
        title = this.cleanTitle(title)
        
        // Immagine: Cerchiamo in data-src per lazy loading
        const imgElement = $('.thumb img').first()
        let image = imgElement.attr('src') ?? ''
        
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = imgElement.attr('data-src') ?? imgElement.attr('data-original') ?? ''
        }
        
        if (image && image.startsWith('/')) {
            image = BASE_URL + image
        }
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        const desc = $('#noidungm').text().trim() ?? ''
        let hentai = false
        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        $('.meta-data.row.px-1 .col-12').each((_: any, col: any) => {
            const text = $(col).text().trim()
            
            if (text.includes('Autore:')) {
                author = text.replace('Autore:', '').trim() || 'Unknown'
            } else if (text.includes('Artista:')) {
                artist = text.replace('Artista:', '').trim() || 'Unknown'
            } else if (text.includes('Stato:')) {
                const statusText = text.replace('Stato:', '').trim().toLowerCase()
                if (statusText.includes('finito') || statusText.includes('completato')) {
                    status = 'Completed'
                } else if (statusText.includes('corso')) {
                    status = 'Ongoing'
                } else if (statusText.includes('pausa')) {
                    status = 'Hiatus'
                }
            }
        })

        const arrayTags: Tag[] = []
        $('.meta-data.row.px-1 a[href*="genre="]').each((_: any, a: any) => {
            const id = $(a).attr('href')?.split('genre=')[1]
            const label = $(a).text().trim()
            if (id && label) {
                if (['ADULTI', 'SMUT', 'MATURO', 'HENTAI', 'ECCHI'].includes(label.toUpperCase())) hentai = true
                arrayTags.push(App.createTag({ id: id, label: label }))
            }
        })

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]
        
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status,
                artist,
                author,
                tags: tagSections,
                desc,
                hentai,
                rating: 0 // Non disponibile affidabilmente
            }),
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // MangaWorld ha due layout possibili: Divisi per Volume o Lista Unica
        const volumes = $('.volume-element').toArray()
        
        if (volumes.length > 0) {
            // --- LAYOUT VOLUMI ---
            for (const vol of volumes) {
                const volName = $(vol).find('.volume-name').text().trim()
                const volNumMatch = volName.match(/Volume\s+(\d+)/i)
                const volNum = volNumMatch ? parseFloat(volNumMatch[1]) : undefined

                const chapterNodes = $(vol).find('.chapter').toArray()
                
                for (const node of chapterNodes) {
                    this.extractChapter($, node, chapters, volNum)
                }
            }
        } else {
            // --- LAYOUT LISTA SEMPLICE ---
            const simpleChapters = $('.chapter').toArray()
            for (const node of simpleChapters) {
                this.extractChapter($, node, chapters, undefined)
            }
        }

        return chapters
    }

    // Helper per estrarre capitolo singolo (evita codice duplicato)
    private extractChapter($: any, node: any, chapters: Chapter[], volNum: number | undefined) {
        const link = $('a.chap', node)
        const href = link.attr('href')
        const chapterId = href?.split('/read/')[1]?.split('/')[0] ?? ''
        
        if (!chapterId) return

        const rawTitle = link.find('span.d-inline-block').first().text().trim() || link.text().trim()
        
        // Estrazione Numero
        const chapNumMatch = rawTitle.match(/(\d+(\.\d+)?)/)
        const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

        // Estrazione Data
        const dateText = link.find('.chap-date').text().trim()
        const time = this.parseDate(dateText)

        // Pulizia Titolo: Paperback gestisce "Vol. X Ch. Y". 
        // Se il titolo è solo "Capitolo 50", passiamo stringa vuota o titolo extra.
        let name = rawTitle
            .replace(/capitolo\s*\d+(\.\d+)?/i, '') // Rimuove "Capitolo 1"
            .replace(/chapter\s*\d+(\.\d+)?/i, '')
            .trim()
        
        // Rimuove trattini iniziali/finali rimasti
        name = name.replace(/^[-–—]\s*/, '').replace(/\s*[-–—]$/, '')

        chapters.push(App.createChapter({
            id: chapterId,
            name: name, 
            chapNum: chapNum,
            volume: volNum,
            time: time,
            langCode: 'it'
        }))
    }

    parseChapterDetails($: any, mangaId: string, id: string): ChapterDetails {
        const pages: string[] = []
        
        // 1. Metodo Standard: DOM Scraping
        $('.col-12.text-center.position-relative img, #page img').each((_: any, item: any) => {
            const el = $(item)
            let imageUrl = el.attr('src')
            
            // Gestione Lazy Load
            if (!imageUrl || imageUrl.includes('loading') || imageUrl.startsWith('data:')) {
                imageUrl = el.attr('data-src') ?? el.attr('data-original')
            }
            
            if (imageUrl && !imageUrl.includes('loader')) {
                if (imageUrl.startsWith('/')) imageUrl = BASE_URL + imageUrl
                pages.push(imageUrl.trim())
            }
        })

        // 2. Metodo Fallback: Script JSON Extraction (Se Cloudflare nasconde il DOM)
        if (pages.length === 0) {
            $('script').each((_: any, script: any) => {
                const content = $(script).html()
                if (!content) return

                // Cerca array di URL immagini dentro lo script
                // MangaWorld spesso usa var pages = [...] o simile
                const matches = content.match(/https?:\/\/[^"'\s\\]+\.(?:jpg|jpeg|png|webp)/gi)
                if (matches) {
                    for (const match of matches) {
                        const cleanUrl = match.replace(/\\/g, '')
                        if (!pages.includes(cleanUrl) && !cleanUrl.includes('logo') && !cleanUrl.includes('banner')) {
                            pages.push(cleanUrl)
                        }
                    }
                }
            })
        }

        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        })
    }

    parseTags($: any, baseUrl: string): TagSection[] {
        const genres: Tag[] = []
        // Parsing migliorato per evitare duplicati o categorie errate
        $('.dropdown-menu.dropdown-multicol .dropdown-item').each((_: any, item: any) => {
            const href = $(item).attr('href')
            if (href && href.includes('genre=')) {
                const id = href.split('genre=')[1]
                const label = $(item).text().trim()
                if (id && label) {
                    genres.push(App.createTag({ label: label, id: id }))
                }
            }
        })
        return [App.createTagSection({ id: '0', label: 'Generi', tags: genres })]
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            const href = $('a', item).attr('href') ?? ''
            const id = href.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]

            if (!id) return

            let title = $('a', item).attr('title') ?? $('.name', item).text()
            title = this.cleanTitle(title)
            
            const imgElement = $('a img', item)
            let image = imgElement.attr('src') ?? ''
            
            if (image.includes('loading') || !image || image.startsWith('data:')) {
                image = imgElement.attr('data-src') ?? imgElement.attr('data-original') ?? ''
            }
            if (image && image.startsWith('/')) {
                image = BASE_URL + image
            }
            
            // Sottotitolo: Ultimo capitolo
            const subtitle = $('.latest-chapter', item).text().trim()

            results.push(
                App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: subtitle || undefined,
                })
            )
        })
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const sectionMangaMese = App.createHomeSection({
            id: 'manga_mese',
            title: 'Manga del Mese 🌟',
            containsMoreItems: true,
            type: HomeSectionType.singleRowLarge
        })

        const sectionTrending = App.createHomeSection({
            id: 'tendenza',
            title: 'Capitoli di Tendenza 📈',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })

        const sectionAdded = App.createHomeSection({
            id: 'ultime_aggiunte',
            title: 'Ultime Aggiunte 🆕',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })

        const sectionLatest = App.createHomeSection({
            id: 'ultimi_capitoli',
            title: 'Ultimi Capitoli 🔥',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        const mangaMese: PartialSourceManga[] = []
        const trendingItems: PartialSourceManga[] = []
        const addedItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // Manga del Mese
        $('.top-wrapper .entry .long').each((_: any, item: any) => {
            const href = $('a.chap', item).first().attr('href')
            const id = href?.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]
            
            const title = $('.name', item).text().trim()
            let image = $('.thumb img', item).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                mangaMese.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: this.cleanTitle(title),
                    subtitle: undefined
                }))
            }
        })
        sectionMangaMese.items = mangaMese
        sectionCallback(sectionMangaMese)

        // Capitoli di Tendenza (Vertical list a lato)
        $('.entry.vertical').each((_: any, item: any) => {
            const link = $('a.thumb', item)
            const href = link.attr('href')
            const id = href?.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]
            
            const title = $('.manga-title', item).text().trim()
            let image = $('img', link).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image
            
            const chapter = $('.chapter', item).text().trim()

            if (id && title) {
                trendingItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: this.cleanTitle(title),
                    subtitle: chapter
                }))
            }
        })
        sectionTrending.items = trendingItems
        sectionCallback(sectionTrending)

        // Ultime Aggiunte
        $('.latest-manga .entry').each((_: any, item: any) => {
            const link = $('a.thumb', item)
            const href = link.attr('href')
            const id = href?.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]
            
            const title = $('.name', item).text().trim()
            let image = $('img', link).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                addedItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: this.cleanTitle(title),
                    subtitle: 'Nuovo'
                }))
            }
        })
        sectionAdded.items = addedItems
        sectionCallback(sectionAdded)

        // Ultimi Capitoli
        // Nota: MangaWorld mischia i blocchi, dobbiamo assicurarci di non prendere quelli già presi
        $('.comics-grid .entry').each((_: any, item: any) => {
            if ($(item).closest('.latest-manga').length > 0) return

            const link = $('a.thumb', item)
            const href = link.attr('href')
            const id = href?.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]
            
            let title = $(item).attr('title') ?? $('.name', item).text().trim()
            let image = $('img', link).attr('src') ?? ''
            if (image.includes('loading') || !image || image.startsWith('data:')) {
                image = $('img', link).attr('data-src') ?? $('img', link).attr('data-original') ?? ''
            }
            if (image && image.startsWith('/')) image = BASE_URL + image

            const latestChap = $('.chapters a', item).first().text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: this.cleanTitle(title),
                    subtitle: latestChap
                }))
            }
        })
        sectionLatest.items = latestItems
        sectionCallback(sectionLatest)
    }

    parseViewMore($: any): PartialSourceManga[] {
        const more: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, obj: any) => {
            const href = $('a', obj).attr('href') ?? ''
            const id = href.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]

            if (!id) return

            let title = $('a', obj).attr('title') ?? $('.name', obj).text()
            title = this.cleanTitle(title)
            
            const imgElement = $('a img', obj)
            let image = imgElement.attr('src') ?? ''
            
            if (image.includes('loading') || !image || image.startsWith('data:')) {
                image = imgElement.attr('data-src') ?? imgElement.attr('data-original') ?? ''
            }
            if (image && image.startsWith('/')) {
                image = BASE_URL + image
            }

            const sub = $('.chapters a', obj).first().text().trim()

            more.push(
                App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: sub,
                })
            )
        })
        return more
    }
}