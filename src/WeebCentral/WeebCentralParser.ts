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

    isLastPage($: any): boolean {
        // Se troviamo meno di 32 risultati validi con immagini, è l'ultima pagina
        return $('a[href*="/series/"]:has(img)').length < 32
    }

    /**
     * Helper centralizzato per estrarre un manga.
     * FIX: Ritorna null se non trova un'immagine valida (evita i link "Visit" o testuali)
     */
    private parseCommonManga($: any, element: any): PartialSourceManga | null {
        const item = $(element)
        
        // Cerca il link della serie
        let link = item.is('a[href*="/series/"]') ? item : item.find('a[href*="/series/"]').first()
        const href = link.attr('href')
        
        const id = href?.split('/series/')[1]?.split('/')[0]
        if (!id) return null

        // TITOLO: Priorità all'attributo alt dell'immagine o aria-label
        // Evita di prendere testo a caso dai bottoni
        let title = item.find('img').first().attr('alt') ?? 
                    link.attr('aria-label') ??
                    item.find('.text-white.font-bold').first().text().trim()

        if (!title || title.toLowerCase().includes('visit')) {
             // Fallback estremo solo se sembra un titolo valido
             const text = item.text().trim()
             if (text.length > 2 && text.length < 100) title = text
             else return null // Scarta se è spazzatura
        }

        // Pulizia Titoli
        title = title
            .replace(/\s+Cover$/i, '')
            .replace(/\s+Poster$/i, '')
            .replace(/\s+Scan$/i, '')
            .trim()

        // IMMAGINE: Fondamentale. Se non c'è, non è un risultato valido.
        let image = item.find('img').first().attr('src') ?? 
                    item.find('img').first().attr('data-src')
        
        if (!image) return null // FIX: Scarta risultati senza cover (link testuali)

        // SOTTOTITOLO
        let subtitle = undefined
        // Cerca un link che sembra un capitolo
        const chapterLink = item.find('a[href*="/chapters/"]').first()
        if (chapterLink.length > 0) {
            subtitle = chapterLink.text().trim()
        } else {
            // Cerca span di testo generico
            const text = item.text()
            const match = text.match(/(?:Ch\.|Chapter|Ep\.|Episode)\s*\d+/i)
            if (match) subtitle = match[0]
        }

        // Rimuovi date lunghe dai sottotitoli
        if (subtitle && (subtitle.length > 20 || subtitle.includes(':'))) subtitle = undefined

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // TITOLO
        let title = $('h1').first().text().trim() || 'Unknown Title'

        // COVER: Selettore più permissivo.
        // Prende la prima immagine che non sia un'icona o un avatar dentro la sezione principale
        let image = $('img[alt="' + title + '"]').first().attr('src')
        if (!image) {
             // Cerca un'immagine grande nella parte alta della pagina
             image = $('section:first-of-type img').filter((i: number, el: any) => {
                 const src = $(el).attr('src') || ''
                 // Evita icone piccole
                 return src.length > 0 && !src.includes('icon') && !src.includes('logo')
             }).first().attr('src')
        }
        if (!image) image = ''

        // DESCRIZIONE
        let desc = $('p:contains("Description")').next().text().trim() || 
                   $('div:contains("Description")').next().text().trim() || 
                   $('p.leading-6').text().trim()

        // METADATI
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

        if (artist === 'Unknown' && artist !== 'Unknown') artist = author
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
            
            if (href.includes('full-chapter-list')) return

            const chapterId = href.split('/chapters/')[1]
            if (!chapterId) return

            // FIX "Last Read": Seleziona SOLO lo span del titolo o il primo nodo di testo
            // Evita di prendere tutto il testo del contenitore
            let titleRaw = $el.find('span.font-bold, span.grow').first().text().trim()
            
            // Fallback: se non trova lo span, prende tutto ma rimuove la frase "Last Read"
            if (!titleRaw) titleRaw = $el.text().replace(/Last Read/gi, '').trim()

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
        // Cerca i blocchi article o i link diretti
        $('article, a[href*="/series/"]').each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            // Strict Check: Deve avere ID, Titolo valido e Immagine
            if (manga && manga.mangaId && manga.image) {
                 if (!results.find(r => r.mangaId === manga.mangaId)) {
                     results.push(manga)
                 }
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
        let recentContainer = $('section:contains("Recent"), section:contains("Latest")').first()
        if (recentContainer.length === 0) recentContainer = $('body')

        $('a[href*="/series/"]', recentContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga && !hotManga.find(h => h.mangaId === manga.mangaId)) {
                latestManga.push(manga)
            }
        })

        hotSection.items = hotManga
        latestSection.items = latestManga
        sectionCallback(hotSection)
        sectionCallback(latestSection)
    }
}