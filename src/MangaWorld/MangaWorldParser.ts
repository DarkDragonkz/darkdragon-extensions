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
     * Pulisce i titoli duplicati (es. "NarutoNaruto" -> "Naruto")
     */
    private cleanTitle(title: string): string {
        if (!title) return 'Unknown'
        title = title.trim()
        if (title.length > 0 && title.length % 2 === 0) {
            const half = title.substring(0, title.length / 2)
            if (half === title.substring(title.length / 2)) {
                return half
            }
        }
        return title
    }

    /**
     * Helper centralizzato per estrarre l'URL dell'immagine gestendo lazy loading e path relativi.
     */
    private getImageSrc(element: any): string {
        let image = element.attr('src') ?? ''
        
        // Gestione Lazy Load: MangaWorld usa spesso data-original o data-src
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = element.attr('data-src') ?? element.attr('data-original') ?? ''
        }
        
        // Fix path relativi
        if (image && image.startsWith('/')) {
            image = BASE_URL + image
        }

        return image || 'https://paperback.moe/icons/logo-alt.svg'
    }

    /**
     * Helper centralizzato per parsare un elemento della lista (Home, Search, ViewMore).
     */
    private parseCommonManga($: any, element: any, extraSubtitleSelector?: string): PartialSourceManga {
        const href = $('a', element).attr('href') ?? ''
        const id = href.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0] ?? ''

        // Titolo
        let title = $('a', element).attr('title') 
        if (!title) title = $('.name', element).text().trim()
        if (!title) title = $('.manga-title', element).text().trim()
        title = this.cleanTitle(title ?? 'Unknown')

        // Immagine
        const imgElement = $('a img', element)
        const image = this.getImageSrc(imgElement)

        // Sottotitolo (opzionale)
        let subtitle: string | undefined = undefined
        if (extraSubtitleSelector) {
            subtitle = $(extraSubtitleSelector, element).first().attr('title') ?? $(extraSubtitleSelector, element).first().text().trim()
        }

        return App.createPartialSourceManga({
            image,
            title,
            mangaId: id,
            subtitle
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('.name.bigger').text().trim() ?? ''
        title = this.cleanTitle(title)
        
        const image = this.getImageSrc($('.thumb.mb-3.text-center img'))
        const desc = $('#noidungm').text().trim() ?? ''
        
        let hentai = false
        let author = 'Unknown'
        let artist = 'Unknown'
        
        // Parsing robusto dei metadati (non basato su indici fissi)
        $('.meta-data.row.px-1 .col-12').each((_: any, obj: any) => {
            const text = $(obj).text().trim()
            if (text.toLowerCase().includes('autore:')) {
                author = text.replace(/autore:\s*/i, '').trim()
            } else if (text.toLowerCase().includes('artista:')) {
                artist = text.replace(/artista:\s*/i, '').trim()
            }
        })

        // Generi
        const arrayTags: Tag[] = []
        $('.meta-data.row.px-1 .col-12 a[href*="genre="]').each((_: any, e: any) => {
            const label = $(e).text().trim()
            const id = $(e).attr('href')?.split('genre=')[1] ?? label
            
            if (['ADULTI', 'SMUT', 'MATURO', 'HENTAI'].includes(id.toUpperCase())) hentai = true
            if (id && label) arrayTags.push({ id, label })
        })

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags.map(x => App.createTag(x)) })]
        
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status: 'Ongoing', // MangaWorld non espone chiaramente lo status completato nei meta rapidi
                artist,
                author,
                tags: tagSections,
                desc,
                hentai,
            }),
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        // .toArray().reverse() è corretto se il sito li lista dal più recente al più vecchio e vogliamo l'ordine inverso,
        // ma Paperback gestisce l'ordinamento. Solitamente meglio passarli come arrivano e lasciare sortingIndex.
        const arrChapters = $('.chapter').toArray()

        for (const item of arrChapters) {
            const link = $('a', item)
            const id = link.attr('href')?.replace(`${BASE_URL}/manga/${mangaId}/read/`, '') ?? ''
            const name = link.attr('title') ?? ''
            
            // Estrazione numero capitolo più sicura
            const chapText = $('.d-inline-block', item).text().trim() // Es: "Capitolo 123"
            const chapNumMatch = chapText.match(/(\d+(\.\d+)?)/)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

            chapters.push(
                App.createChapter({
                    id,
                    name,
                    chapNum,
                    time: new Date(), // MangaWorld non ha date precise facili da parsare nel formato lista standard
                    langCode: 'it',
                })
            )
        }
        return chapters
    }

    parseChapterDetails($: any, mangaId: string, id: string): ChapterDetails {
        const pages: string[] = []
        
        // Selettore per le immagini del reader
        $('.col-12.text-center.position-relative img').each((_: any, item: any) => {
            const url = this.getImageSrc($(item))
            if (url && !url.includes('logo-alt.svg')) { // Evita il fallback image
                pages.push(url.trim())
            }
        })

        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        })
    }

    parseTags($: any, baseUrl: string): TagSection[] {
        const genres: Tag[] = []
        // Evita duplicati usando un Set o controllando
        const seen = new Set<string>()

        $('.dropdown-menu.dropdown-multicol .dropdown-item').each((_: any, item: any) => {
            const id = $(item).attr('href')?.split('genre=')[1]
            const label = $(item).text().trim()
            
            if (id && label && !seen.has(id)) {
                seen.add(id)
                genres.push(App.createTag({ label, id }))
            }
        })
        return [App.createTagSection({ id: '0', label: 'Generi', tags: genres })]
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            results.push(this.parseCommonManga($, item))
        })
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. Manga del Mese -> SINGLE ROW LARGE (Vetrina)
        const sectionMonth = App.createHomeSection({
            id: '2', // Manteniamo gli ID originali per compatibilità getViewMoreItems
            title: 'Manga del Mese 🌟',
            containsMoreItems: true,
            type: HomeSectionType.singleRowLarge 
        })

        // 2. Ultimi Capitoli -> CONTINUOUS (Scroll Infinito verticale)
        const sectionLatest = App.createHomeSection({
            id: '1',
            title: 'Ultimi Capitoli 🔥',
            containsMoreItems: true,
            type: HomeSectionType.continuous 
        })

        // 3. In Tendenza -> SINGLE ROW NORMAL (Carosello orizzontale)
        const sectionTrending = App.createHomeSection({
            id: '3',
            title: 'In Tendenza 📈',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal,
        })

        // Popolamento MONTH (Hot)
        const monthItems: PartialSourceManga[] = []
        $('.col-12 .top-wrapper .entry').each((i: number, item: any) => {
            if (i < 10) monthItems.push(this.parseCommonManga($, item))
        })
        sectionMonth.items = monthItems
        sectionCallback(sectionMonth)

        // Popolamento LATEST (Colonna centrale)
        const latestItems: PartialSourceManga[] = []
        $('.col-sm-12.col-md-8.col-xl-9 .comics-grid .entry').each((_: any, item: any) => {
            // Qui passiamo il selettore per il capitolo recente come sottotitolo
            latestItems.push(this.parseCommonManga($, item, '.d-flex.flex-wrap.flex-row a'))
        })
        sectionLatest.items = latestItems
        sectionCallback(sectionLatest)

        // Popolamento TRENDING (Sidebar)
        const trendingItems: PartialSourceManga[] = []
        $('.entry.vertical').each((_: any, item: any) => {
            trendingItems.push(this.parseCommonManga($, item))
        })
        sectionTrending.items = trendingItems
        sectionCallback(sectionTrending)
    }

    parseViewMore($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            results.push(this.parseCommonManga($, item, '.d-flex.flex-wrap.flex-row a'))
        })
        return results
    }
}