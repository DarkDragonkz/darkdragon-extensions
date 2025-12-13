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
        // Se troviamo meno di 32 risultati validi (con immagine), è l'ultima pagina
        return $('a[href*="/series/"]:has(img)').length < 32
    }

    /**
     * Parsing Universale Intelligente
     * @param $ Cheerio root
     * @param element L'elemento (spesso il link <a>)
     * @param contextContainer (Opzionale) Il contenitore padre per cercare i sottotitoli se non sono nel link
     */
    private parseCommonManga($: any, element: any, contextContainer?: any): PartialSourceManga | null {
        const item = $(element)
        
        // 1. Trova il link della serie
        let link = item.is('a[href*="/series/"]') ? item : item.find('a[href*="/series/"]').first()
        const href = link.attr('href')
        const id = href?.split('/series/')[1]?.split('/')[0]
        
        if (!id) return null

        // 2. Trova l'immagine (CRITICO: Se non c'è, scartiamo il risultato per evitare link spazzatura)
        let image = item.find('img').first().attr('src') ?? 
                    item.find('img').first().attr('data-src')
        
        if (!image) return null 

        // 3. Titolo: Priorità a data-tip (tooltip) o alt dell'immagine
        let title = item.attr('data-tip') ?? 
                    item.find('[data-tip]').attr('data-tip') ?? 
                    item.find('img').first().attr('alt') ??
                    item.text().trim()

        if (!title) title = 'Unknown Title'

        // 4. Pulizia Titolo (Cover, Poster, Scan)
        title = title.replace(/(\s+|-)?(Cover|Poster|Scan)$/i, '').trim()

        // 5. Sottotitolo (Capitoli)
        // Cerca prima nel link stesso
        let subtitle = item.find('a[href*="/chapters/"]').first().text().trim()

        // Se non trova, cerca nel contenitore padre (per layout a card dove il testo è sotto l'immagine)
        if (!subtitle && contextContainer) {
            const container = $(contextContainer)
            // Cerca un link capitolo fratello o figlio
            subtitle = container.find('a[href*="/chapters/"]').first().text().trim()
            
            // Se ancora nulla, cerca testo generico che assomiglia a un capitolo/episodio
            if (!subtitle) {
                const text = container.text()
                // Regex per "31 Chapters", "Chapter 10", "Ep. 5"
                const match = text.match(/(\d+\s+Chapters?)|((?:Ch\.|Chapter|Ep\.|Episode)\s*\d+(\.\d+)?)/i)
                if (match) subtitle = match[0]
            }
        }

        // 6. Pulizia Sottotitolo (Rimuove date ISO brutte)
        if (subtitle && (subtitle.length > 25 || subtitle.includes('T') && subtitle.includes(':'))) {
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
        
        // Cerca immagine specifica per il titolo o fallback alla prima della sezione
        let image = $('img[alt="' + title + '"]').first().attr('src') ?? 
                    $('section img').first().attr('src') ?? ''

        // Descrizione: Cerca il blocco dopo "Description"
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
        
        // I capitoli sono link <a> dentro la risposta di /full-chapter-list
        $('a[href*="/chapters/"]').each((_: any, el: any) => {
            const $el = $(el)
            const href = $el.attr('href')
            
            // Ignora link navigazione
            if (href.includes('full-chapter-list')) return

            const chapterId = href.split('/chapters/')[1]
            if (!chapterId) return

            // Titolo: Cerca span specifici o prendi testo diretto
            let titleRaw = $el.find('span.grow, span.font-bold').first().text().trim() || $el.text().trim()
            // Rimuovi "Last Read" se appare
            titleRaw = titleRaw.replace(/Last Read/gi, '').trim()

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
        
        // SELETTORE CRITICO: Cerca solo link SERIES che CONTENGONO un'IMMAGINE.
        // Questo elimina i link "Visit Discord", "Random", "Text Only" che rompevano la ricerca.
        $('a[href*="/series/"]:has(img)').each((_: any, item: any) => {
            // Passiamo 'item' come container di se stesso
            const manga = this.parseCommonManga($, item, item)
            
            if (manga && !results.find(r => r.mangaId === manga.mangaId)) {
                results.push(manga)
            }
        })
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const hotSection = App.createHomeSection({ id: 'hot', title: 'Hot Updates 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const recSection = App.createHomeSection({ id: 'recommendations', title: 'Recommendations 💡', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest_updates', title: 'Latest Updates 🆕', containsMoreItems: true, type: HomeSectionType.continuous })

        const hotManga: PartialSourceManga[] = []
        // Hot Updates
        const hotContainer = $('section:has(h2:contains("Hot Updates"))').first()
        $('a[href*="/series/"]:has(img)', hotContainer).each((_: any, item: any) => {
            // Hot updates: il link è dentro un div, passiamo il parent per trovare il sottotitolo
            const manga = this.parseCommonManga($, item, $(item).parent())
            if (manga) hotManga.push(manga)
        })
        
        const recManga: PartialSourceManga[] = []
        // Recommendations
        const recContainer = $('section:has(h2:contains("Recommendations"))').first()
        $('a[href*="/series/"]:has(img)', recContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item, $(item).parent())
            if (manga) recManga.push(manga)
        })

        const latestManga: PartialSourceManga[] = []
        // Latest Updates
        const latestContainer = $('section:has(h2:contains("Latest Updates"))').first()
        $('a[href*="/series/"]:has(img)', latestContainer).each((_: any, item: any) => {
            // In Latest, il contenitore è spesso un div che contiene link + span
            const container = $(item).closest('div, tr, article')
            const manga = this.parseCommonManga($, item, container)
            if (manga) latestManga.push(manga)
        })

        hotSection.items = hotManga
        recSection.items = recManga
        latestSection.items = latestManga

        sectionCallback(hotSection)
        sectionCallback(recSection)
        sectionCallback(latestSection)
    }
}