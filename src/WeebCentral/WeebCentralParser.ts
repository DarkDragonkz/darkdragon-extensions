import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    PartialSourceManga,
    SourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

export class WeebCentralParser {

    /**
     * Helper centralizzato per estrarre un manga da un elemento HTML.
     * Gestisce Search, Home e Latest updates in un unico punto.
     */
    private parseCommonManga($: any, element: any, extraSubtitle?: string): PartialSourceManga | null {
        // WeebCentral usa <article> o <div> o <a> a seconda del contesto
        let item = $(element)
        
        // Cerca il link principale
        let link = item.is('a') ? item : item.find('a[href*="/series/"]').first()
        const href = link.attr('href')
        
        // Estrazione ID
        const id = href?.split('/series/')[1]?.split('/')[0]
        if (!id) return null

        // Estrazione Titolo: data-tip è spesso il più affidabile su WC
        let title = item.attr('data-tip') ?? 
                    item.find('[data-tip]').attr('data-tip') ?? 
                    item.find('.text-white, .font-bold').first().text().trim()

        if (!title) title = 'Unknown Title'

        // Estrazione Immagine
        let image = item.find('img').first().attr('src') ?? 
                    item.find('img').first().attr('data-src') ?? 
                    ''
        
        // Sottotitolo opzionale (es. Ultimo capitolo)
        let subtitle = extraSubtitle
        if (!subtitle) {
            // Cerca il capitolo se non fornito esplicitamente
            // WC mette il capitolo in span o time a volte
            const possibleChapter = item.find('a[href*="/chapters/"] span').last().text().trim()
            if (possibleChapter) subtitle = possibleChapter
        }

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim()
        if (!title) title = $('section:has(picture)').first().attr('data-tip') ?? 'Unknown'
        
        const image = $('img[alt$=" cover"]').attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        
        const desc = $('.whitespace-pre-wrap').text().trim() || 'No description available'
        
        const author = $('strong:contains("Author(s)")').next().find('a').text().trim() || 'Unknown'

        // Parsing Status
        const statusStr = $('strong:contains("Status")').next('a').text().trim().toLowerCase()
        let status = 'Ongoing'
        if (statusStr.includes('complete')) status = 'Completed'
        else if (statusStr.includes('hiatus')) status = 'Hiatus'
        else if (statusStr.includes('cancel')) status = 'Completed' 

        const arrayTags: Tag[] = []
        $('strong:contains("Tags(s)")').nextAll('span').each((_: any, span: any) => {
            const label = $(span).text().trim()
            if (label) arrayTags.push({ id: label, label: label })
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('a[href*="/chapters/"]').each((_: any, element: any) => {
            const item = $(element)
            const href = item.attr('href')
            const id = href?.split('/chapters/')[1]
            if (!id) return

            // Parsing Titolo
            // Cerca span specifici o usa fallback
            let name = item.find('.grow span, span.font-bold').first().text().trim()
            
            if (!name) {
                const clone = item.clone()
                clone.find('time').remove()
                name = clone.text().trim()
            }

            // Pulizia spazi multipli e newlines
            name = name.replace(/\s+/g, " ").trim()

            // Parsing Numero Capitolo
            const numMatch = name.match(/(\d+(\.\d+)?)/g)
            const chapNum = numMatch ? parseFloat(numMatch[numMatch.length - 1] ?? '0') : 0

            // Parsing Data
            const timeStr = item.find('time').attr('datetime')
            const time = timeStr ? new Date(timeStr) : new Date()

            chapters.push(App.createChapter({
                id: id,
                name: name, 
                chapNum: chapNum,
                langCode: 'en',
                time: time
            }))
        })

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        $('img').each((_: any, img: any) => {
            let src = $(img).attr('src') || $(img).attr('data-src')
            
            if (src && !src.includes('logo') && !src.includes('icon')) {
                pages.push(src.trim())
            }
        })
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Selettore generico per griglia di ricerca
        $('article, a[href*="/series/"]').each((_: any, item: any) => {
            // Filtra elementi troppo piccoli o non pertinenti (es. link tag)
            if ($(item).find('img').length === 0) return

            const manga = this.parseCommonManga($, item)
            if (manga && manga.title !== 'Official') {
                // Evita duplicati
                if (!results.some(r => r.mangaId === manga.mangaId)) {
                    results.push(manga)
                }
            }
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. Hot Updates (Vetrina Large)
        const hotSection = App.createHomeSection({
            id: 'hot_updates',
            title: 'Hot Updates 🔥',
            containsMoreItems: false,
            type: HomeSectionType.singleRowLarge, 
        })
        
        // 2. Recommendations (Normale)
        const recSection = App.createHomeSection({
            id: 'recommendations',
            title: 'Recommendations 💡',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal, 
        })

        // 3. Latest Updates (Scroll Infinito Verticale)
        const latestSection = App.createHomeSection({
            id: 'latest_updates',
            title: 'Latest Updates 🆙',
            containsMoreItems: true,
            type: HomeSectionType.continuous, // UX migliorata
        })

        // --- Hot Updates ---
        const hotManga: PartialSourceManga[] = []
        const hotContainer = $('section:has(h2:contains("Hot Updates"))').first()
        $('article', hotContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga) hotManga.push(manga)
        })
        hotSection.items = hotManga
        sectionCallback(hotSection)

        // --- Recommendations ---
        const recManga: PartialSourceManga[] = []
        const recContainer = $('section:has(h2:contains("Recommendations"))').first()
        $('article', recContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga) recManga.push(manga)
        })
        if (recManga.length > 0) {
            recSection.items = recManga
            sectionCallback(recSection)
        }

        // --- Latest Updates ---
        const latestManga: PartialSourceManga[] = []
        const latestContainer = $('section:has(h2:contains("Latest Updates"))').first()
        $('article', latestContainer).each((_: any, item: any) => {
            // Passiamo un selettore per trovare specificamente l'info del capitolo
            const chapterText = $(item).find('span').last().text().trim()
            const manga = this.parseCommonManga($, item, chapterText)
            if (manga) latestManga.push(manga)
        })
        latestSection.items = latestManga
        sectionCallback(latestSection)
    }

    isLastPage($: any): boolean {
        return $(`span:contains("View More Results...")`).length === 0
    }
}