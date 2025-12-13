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

    // Helper fondamentale per determinare se ci sono altre pagine nella ricerca
    isLastPage($: any): boolean {
        // WeebCentral carica 32 elementi per chiamata. Se ne troviamo meno, siamo alla fine.
        return $('a[href*="/series/"]').length < 32
    }

    /**
     * IL CUORE DEL PARSER: Estrae dati da qualsiasi blocco HTML (Home, Ricerca, Liste)
     * Preso dal vecchio file e potenziato per la UI.
     */
    private parseCommonManga($: any, element: any): PartialSourceManga | null {
        const item = $(element)
        
        // Trova il link alla serie. A volte è l'elemento stesso, a volte un figlio.
        let link = item.is('a[href*="/series/"]') ? item : item.find('a[href*="/series/"]').first()
        const href = link.attr('href')
        
        const id = href?.split('/series/')[1]?.split('/')[0]
        if (!id) return null

        // TITOLO: Strategia a cascata per trovarlo ovunque
        let title = item.attr('aria-label') ??
                    item.find('img').first().attr('alt') ?? 
                    item.find('.text-white').first().text().trim() ??
                    item.text().trim()

        if (!title) title = 'Unknown Title'

        // UI FIX: Pulizia Titoli (Rimuove "Cover", "Poster")
        title = title
            .replace(/\s+Cover$/i, '')
            .replace(/\s+Poster$/i, '')
            .replace(/\s+Scan$/i, '')
            .trim()

        // IMMAGINE: Supporto Lazy Loading
        let image = item.find('img').first().attr('src') ?? 
                    item.find('img').first().attr('data-src') ?? 
                    ''
        
        // SOTTOTITOLO: Logica "Smart"
        // 1. Cerca un link esplicito a un capitolo (comune nelle card della Home)
        let subtitle = item.find('a[href*="/chapters/"]').first().text().trim()

        // 2. Se non c'è link, cerca testo che sembra un capitolo ("Chapter X", "Ep. Y") all'interno del blocco
        if (!subtitle) {
            // Cerchiamo in tutti gli span o div
            const textContent = item.text()
            // Regex che cerca "Ch. 123", "Episode 5", "Chapter 10"
            const match = textContent.match(/(?:Ch\.|Chapter|Ep\.|Episode)\s*\d+(\.\d+)?/i)
            if (match) subtitle = match[0]
        }

        // 3. UI FIX: Evita le date lunghe (ISO) che rompono la UI
        // Se il sottotitolo sembra una data (contiene T e : e -), lo scartiamo
        if (subtitle && subtitle.includes('T') && subtitle.includes(':') && subtitle.includes('-')) {
            subtitle = undefined
        }

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim() || 'Unknown'
        
        let image = $('img[alt="' + title + '"]').first().attr('src') ?? 
                    $('section img').first().attr('src') ?? ''

        // Descrizione: Cerca in modo flessibile
        let desc = $('p:contains("Description")').next().text().trim() || 
                   $('div:contains("Description")').next().text().trim() || 
                   $('p.leading-6').text().trim()

        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        $('strong, span.font-bold').each((_: any, el: any) => {
            const label = $(el).text().trim()
            const value = $(el).next().text().trim() || $(el).parent().next().text().trim()
            if (label.includes('Author')) author = value
            if (label.includes('Artist')) artist = value
            if (label.includes('Status')) status = value
        })

        if (artist === 'Unknown') artist = author
        if (status.includes('Complete')) status = 'Completed'

        const arrayTags: Tag[] = []
        $('a[href*="/search/data?tags="]').each((_: any, el: any) => {
            const label = $(el).text().trim()
            if (label) arrayTags.push({ id: label, label: label })
        })

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: artist,
                tags: [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })],
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('a[href*="/chapters/"]').each((_: any, el: any) => {
            const $el = $(el)
            const href = $el.attr('href')
            
            // Ignora link "Full Chapter List" se presenti nella pagina sbagliata
            if (href.includes('full-chapter-list')) return

            const chapterId = href.split('/chapters/')[1]
            if (!chapterId) return

            const titleRaw = $el.find('span.grow, span.font-bold').first().text().trim() || $el.text().trim()
            const timeRaw = $el.find('time').attr('datetime') ?? new Date().toISOString()
            
            const chapNumMatch = titleRaw.match(/(\d+(\.\d+)?)/)
            let chapNum = 0
            if (chapNumMatch) chapNum = parseFloat(chapNumMatch[1])

            let name = titleRaw
                .replace(/^(chapter|ch|episode|ep|no\.|#)\.?\s*\d+/i, '')
                .replace(/^[-–—:]+\s*/, '')
                .trim()

            if (name === String(chapNum) || name === '') name = ''

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: new Date(timeRaw),
                langCode: 'en'
            }))
        })

        // FIX: Ordinamento Decrescente
        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        $('img').each((_: any, el: any) => {
            const src = $(el).attr('src')
            if (src && src.startsWith('http') && !src.includes('logo')) {
                pages.push(src)
            }
        })
        return App.createChapterDetails({ id: chapterId, mangaId, pages })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        // Cerca i blocchi article o i link diretti (compatibile con Search e ViewMore)
        $('article, a[href*="/series/"]').each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            // Evita duplicati e null
            if (manga && !results.find(r => r.mangaId === manga.mangaId)) {
                results.push(manga)
            }
        })
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const hotSection = App.createHomeSection({ id: 'hot', title: 'Hot Updates 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Recent Updates 🆕', containsMoreItems: true, type: HomeSectionType.continuous })

        const hotManga: PartialSourceManga[] = []
        const latestManga: PartialSourceManga[] = []

        // HOT UPDATES
        const hotContainer = $('section:contains("Hot Updates"), section:contains("Popular")').first()
        $('a[href*="/series/"]', hotContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga) hotManga.push(manga)
        })

        // RECENT UPDATES
        // Cerca la sezione Recent o prendi tutto se non la trovi (fallback sicuro)
        let recentContainer = $('section:contains("Recent"), section:contains("Latest")').first()
        if (recentContainer.length === 0) recentContainer = $('body')

        $('a[href*="/series/"]', recentContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            // Aggiungi solo se non è già in Hot e se ha un'immagine valida
            if (manga && manga.image && !hotManga.find(h => h.mangaId === manga.mangaId)) {
                latestManga.push(manga)
            }
        })

        hotSection.items = hotManga
        latestSection.items = latestManga
        sectionCallback(hotSection)
        sectionCallback(latestSection)
    }
}