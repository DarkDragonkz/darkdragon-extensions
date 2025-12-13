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
     * Parse Common Manga: Basato sul codice originale funzionante.
     * Usa 'data-tip' per il titolo e gestisce i sottotitoli in modo intelligente.
     */
    private parseCommonManga($: any, element: any, extraSubtitle?: string): PartialSourceManga | null {
        const item = $(element)
        
        let link = item.is('a') ? item : item.find('a[href*="/series/"]').first()
        const href = link.attr('href')
        
        const id = href?.split('/series/')[1]?.split('/')[0]
        if (!id) return null

        // Logica Titolo Originale (Funzionante)
        let title = item.attr('data-tip') ?? 
                    item.find('[data-tip]').attr('data-tip') ?? 
                    item.find('.text-white, .font-bold').first().text().trim()

        if (!title) title = 'Unknown Title'

        // UI Improvement: Pulizia Titolo
        title = title.replace(/\s+Cover$/i, '').replace(/\s+Poster$/i, '').replace(/\s+Scan$/i, '').trim()

        let image = item.find('img').first().attr('src') ?? 
                    item.find('img').first().attr('data-src') ?? 
                    ''

        // Gestione Sottotitolo
        let subtitle = extraSubtitle
        if (!subtitle) {
            // Cerca il link del capitolo nel blocco (comune in Hot Updates)
            subtitle = item.find('a[href*="/chapters/"] span').last().text().trim()
            
            // Fallback: Cerca testo generico
            if (!subtitle) {
                const text = item.text()
                const match = text.match(/(?:Ch\.|Chapter|Ep\.|Episode)\s*\d+(\.\d+)?/i)
                if (match) subtitle = match[0]
            }
        }

        // Rimuove date ISO brutte se presenti
        if (subtitle && (subtitle.includes('T') && subtitle.includes(':'))) subtitle = undefined

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim() || 'Unknown'
        
        // Immagine details
        let image = $('img[alt="' + title + '"]').first().attr('src') ?? 
                    $('section img').first().attr('src') ?? ''

        let desc = $('p:contains("Description")').next().text().trim() || 
                   $('div:contains("Description")').next().text().trim() || 
                   $('p.leading-6').text().trim()

        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        $('strong').each((_: any, el: any) => {
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
            
            // Evita link navigazione
            if (href.includes('full-chapter-list')) return

            const chapterId = href.split('/chapters/')[1]
            if (!chapterId) return

            // Titolo
            let titleRaw = $el.find('span.grow, span.font-bold').first().text().trim() || $el.text().trim()
            // Rimuove "Last Read" se presente (bug fixato)
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

        // Ordinamento Decrescente
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
        // Supporta sia 'article' che 'a' per massima compatibilità con i vecchi file
        $('article, a[href*="/series/"]').each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            // Evita duplicati
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
        const hotContainer = $('section:has(h2:contains("Hot Updates"))').first()
        $('article, a[href*="/series/"]', hotContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga && !hotManga.find(h => h.mangaId === manga.mangaId)) hotManga.push(manga)
        })
        
        const recManga: PartialSourceManga[] = []
        const recContainer = $('section:has(h2:contains("Recommendations"))').first()
        $('article, a[href*="/series/"]', recContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga && !recManga.find(h => h.mangaId === manga.mangaId)) recManga.push(manga)
        })

        const latestManga: PartialSourceManga[] = []
        const latestContainer = $('section:has(h2:contains("Latest Updates"))').first()
        $('article, a[href*="/series/"]', latestContainer).each((_: any, item: any) => {
            // Estrae il testo del capitolo specifico per la sezione Latest
            const chapterText = $(item).find('span').last().text().trim()
            const manga = this.parseCommonManga($, item, chapterText)
            if (manga && !latestManga.find(h => h.mangaId === manga.mangaId)) latestManga.push(manga)
        })

        hotSection.items = hotManga
        recSection.items = recManga
        latestSection.items = latestManga

        sectionCallback(hotSection)
        sectionCallback(recSection)
        sectionCallback(latestSection)
    }
}