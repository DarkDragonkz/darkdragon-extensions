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
     * Estrae l'oggetto JSON Next.js dalla stringa HTML.
     * Questo è il cuore dell'ottimizzazione.
     */
    private extractNextData(html: string): any {
        try {
            const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
            if (match && match[1]) {
                return JSON.parse(match[1])
            }
        } catch (e) {
            console.error(`MangaPark: Failed to extract NEXT DATA: ${e}`)
        }
        return null
    }

    parseMangaDetails(html: string, mangaId: string): SourceManga {
        const jsonData = this.extractNextData(html)
        
        // Fallback: se il JSON fallisce, potremmo dover gestire un errore, ma per ora assumiamo funzioni
        // Navigazione sicura dentro l'oggetto JSON di MangaPark (struttura complessa)
        const props = jsonData?.props?.pageProps
        const data = props?.data || props?.dehydratedState?.queries?.[0]?.state?.data?.data || {}
        
        const title = data.name || 'Unknown Title'
        const image = data.urlCover600 || data.urlCover900 || data.urlCoverOriginal || 'https://paperback.moe/icons/logo-alt.svg'
        
        const desc = data.overview || 'No description available.'
        
        const authors = data.authors?.map((a: any) => a) || []
        const artists = data.artists?.map((a: any) => a) || []
        
        let status = 'Ongoing'
        if (data.originalStatus === 'completed') status = 'Completed'
        if (data.originalStatus === 'hiatus') status = 'Hiatus'

        const tags: Tag[] = []
        if (data.genres) {
            for (const genre of data.genres) {
                tags.push(App.createTag({ id: genre, label: genre }))
            }
        }
        
        // Rating
        const rating = data.rate_avg ? parseFloat(data.rate_avg) : undefined

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: authors.join(', '),
                artist: artists.join(', '),
                tags: [App.createTagSection({ id: '0', label: 'Genres', tags: tags })],
                desc: desc,
                rating: rating
            })
        })
    }

    parseChapters(html: string, mangaId: string): Chapter[] {
        const jsonData = this.extractNextData(html)
        const props = jsonData?.props?.pageProps
        
        // MangaPark v5 ha i capitoli nidificati. Dobbiamo trovarli.
        // A volte sono in `data.get_comic_chapterList`
        const data = props?.data || props?.dehydratedState?.queries?.[0]?.state?.data?.data || {}
        
        // Solitamente MangaPark serve i capitoli separati o inclusi nel dettaglio. 
        // Se mancano qui, potrebbero essere in una chiamata API separata, 
        // ma spesso nel __NEXT_DATA__ c'è tutto per la prima pagina.
        // Controlliamo la lista capitoli.
        const rawChapters = data.chapterList || []

        const chapters: Chapter[] = []
        const seenChapters = new Set<string>()

        // 1. Ordiniamo per data (dal più recente) per la deduplicazione
        rawChapters.sort((a: any, b: any) => (b.createAt || 0) - (a.createAt || 0))

        for (const chap of rawChapters) {
            // Saltiamo capitoli bloccati o cancellati
            if (chap.isDeleted) continue

            const chapNum = parseFloat(chap.serial) // 'serial' è solitamente il numero
            const chapNumId = !isNaN(chapNum) ? String(chapNum) : `id:${chap.id}`

            // --- DEDUPLICAZIONE ---
            if (seenChapters.has(chapNumId) && !isNaN(chapNum)) {
                continue
            }
            seenChapters.add(chapNumId)
            // ----------------------

            const id = String(chap.id) // Usiamo l'ID interno
            const volNum = chap.volume ? parseFloat(chap.volume) : undefined
            
            let time = new Date()
            if (chap.createAt) time = new Date(chap.createAt)

            // Pulizia Nome
            let name = chap.title ? String(chap.title).trim() : ''
            // Se il nome è uguale al numero (spesso accade), lo rendiamo vuoto
            if (name == String(chapNum)) name = ''
            
            // Rimuoviamo prefissi
            name = name.replace(/^(chapter|ch\.?)\s*\d+/i, '').trim()

            chapters.push(App.createChapter({
                id: id,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: time,
                langCode: 'en'
            }))
        }

        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const jsonData = this.extractNextData(html)
        const props = jsonData?.props?.pageProps
        
        // Cerchiamo i dati del capitolo specifico
        const data = props?.data || props?.dehydratedState?.queries?.[0]?.state?.data?.data || {}
        
        // MangaPark memorizza le immagini in 'imageFile' o 'images'
        const rawImages = data.imageFile || data.images || []
        const pages: string[] = []

        for (const img of rawImages) {
            // Spesso l'URL è diretto, oppure bisogna costruirlo.
            // MangaPark JSON di solito dà URL completi.
            if (typeof img === 'string') {
                pages.push(img)
            } else if (img.url) {
                pages.push(img.url)
            }
        }

        if (pages.length === 0) {
            // Fallback estremo se il JSON non ha le immagini (raro ma possibile su capitoli protetti)
            return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: ['https://paperback.moe/icons/logo-alt.svg']
            })
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults(html: string): PartialSourceManga[] {
        const jsonData = this.extractNextData(html)
        const props = jsonData?.props?.pageProps
        
        // I risultati di ricerca sono spesso in `results` o `data.items`
        // Controlliamo i vari path possibili del JSON di MangaPark
        let items: any[] = []
        
        if (props?.results) items = props.results
        else if (props?.data?.items) items = props.data.items
        else if (props?.dehydratedState?.queries?.[0]?.state?.data?.data?.items) {
             items = props.dehydratedState.queries[0].state.data.data.items
        }

        const results: PartialSourceManga[] = []
        
        for (const item of items) {
            const id = String(item.id)
            const title = item.name
            // Le immagini sono in urlCover600 solitamente
            const image = item.urlCover600 || item.urlCoverOriginal || 'https://paperback.moe/icons/logo-alt.svg'
            
            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined // Opzionale
                }))
            }
        }
        
        return results
    }

    parseHomeSections(html: string, sectionCallback: (section: HomeSection) => void): void {
        const jsonData = this.extractNextData(html)
        const props = jsonData?.props?.pageProps
        
        // Home page data is complex in MangaPark.
        // Cerca i blocchi come 'popular_comics', 'latest_comics'
        const blocks = props?.dehydratedState?.queries?.[0]?.state?.data?.data || {}

        // 1. Popular
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Popular Updates 🔥', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowLarge 
        })
        const popItems = this.mapJSONToItems(blocks.popular_comics || [])
        popularSection.items = popItems
        sectionCallback(popularSection)

        // 2. Latest
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Releases 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.doubleRow
        })
        const latItems = this.mapJSONToItems(blocks.latest_comics || [])
        latestSection.items = latItems
        sectionCallback(latestSection)
    }

    private mapJSONToItems(items: any[]): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        for (const item of items) {
            // A volte l'item è nidificato in 'data' o 'comic'
            const comic = item.data || item
            if (!comic.id || !comic.name) continue

            results.push(App.createPartialSourceManga({
                mangaId: String(comic.id),
                image: comic.urlCover600 || comic.urlCoverOriginal || 'https://paperback.moe/icons/logo-alt.svg',
                title: comic.name,
                subtitle: undefined
            }))
        }
        return results
    }
}
