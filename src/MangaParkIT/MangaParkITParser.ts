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

export class MangaParkITParser {

    // Helper per convertire le date (Fallback per testo)
    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('min')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hour') || timeAgo.includes('ore')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('day') || timeAgo.includes('giorn')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('anni')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h3.text-lg.font-bold a').first().text().trim()
        if (!title) title = $('h3.text-2xl.font-bold a').first().text().trim()
        if (!title) title = $('h1').first().text().trim() || 'Unknown'
        
        let image = $('.w-24 img, .w-52 img').first().attr('src') || ''
        if (image.startsWith('/')) image = 'https://mangapark.io' + image
        // Fallback icona se manca immagine
        if (!image || image.includes('loading')) image = 'https://paperback.moe/icons/logo-alt.svg'

        const author = $('a[href*="/search?word="]').first().text().trim() || 'Unknown'
        
        // Descrizione: Cerca nel blocco React o nel meta tag
        let desc = $('.limit-html-p').text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') || ''
        
        const status = 'Ongoing' 

        const arrayTags: Tag[] = []
        const tagElements = $('.opacity-70 span, .genres a').toArray()
        for (const el of tagElements) {
            const label = $(el).text().trim().replace(/,$/, '')
            // Filtra tag troppo corti o spazzatura
            if (label && label.length > 1) arrayTags.push(App.createTag({ id: label, label: label }))
        }
        
        const tagSections: TagSection[] = [
            App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })
        ]
        
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: '',
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()
        
        // Selettore specifico per la lista capitoli di MangaPark v5
        // Cerca dentro il div con data-name="chapter-list"
        const listContainer = $('div[data-name="chapter-list"]')
        const linkElements = listContainer.find('a').toArray()

        for (const link of linkElements) {
            const $link = $(link)
            const href = $link.attr('href')
            
            // Validazione URL: deve essere un link a un titolo e contenere l'ID del manga corrente
            if (!href || !href.startsWith('/title/') || !href.includes(mangaId)) continue

            // Estrazione ID Capitolo
            // Es: /title/386006-it-usemono-yado/8314523-vol-3-ch-18  -->  8314523-vol-3-ch-18
            const parts = href.split('/')
            // Assicuriamoci che ci sia un pezzo dopo l'ID del manga
            if (parts.length < 4) continue
            const chapterId = parts[3] // L'ultimo pezzo è l'ID del capitolo

            if (seenIds.has(chapterId)) continue
            seenIds.add(chapterId)

            const title = $link.text().trim()
            if (!title) continue

            // Estrazione Data
            // La data si trova spesso in un tag <time> fratello o genitore
            const row = $link.closest('div.flex') // Risale alla riga del capitolo
            const timeEl = row.find('time')
            const timeTs = timeEl.attr('data-time') // Timestamp preciso (es. 1703353875915)
            const timeText = timeEl.text().trim()

            let time = new Date()
            if (timeTs) {
                time = new Date(Number(timeTs))
            } else if (timeText) {
                time = this.convertTime(timeText)
            }

            // Parsing Numero Capitolo
            // Cerca pattern come "ch.18", "chapter 18", "c18"
            const chapNumMatch = title.match(/(?:ch|chapter|episode|c)(?:\.|apters?|\s)*\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch && chapNumMatch[1]) {
                chapNum = parseFloat(chapNumMatch[1])
            } else {
                // Fallback: cerca l'ultimo numero nel titolo (es "Vol.3 Ch.18" -> 18)
                const simpleNums = title.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1] ?? '0')
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: time,
                langCode: 'it'
            }))
        }

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        let foundInScript = false
        
        // 1. Metodo Script JSON (MangaPark v5 usa spesso "srcs" o "images" in un blocco script)
        const scripts = $('script').toArray()
        for (const script of scripts) {
            const content = $(script).html()
            if (content && (content.includes('srcs') || content.includes('http'))) {
                // Cerca array di stringhe URL immagine
                const matches = content.match(/\"(https?:\/\/[^\"]+\.(?:jpg|jpeg|png|webp))\"/gi)
                if (matches && matches.length > 0) {
                    for (const m of matches) {
                         // Pulisci le virgolette e escape
                         const url = m.replace(/"/g, '').replace(/\\/g, '')
                         pages.push(url)
                    }
                    if (pages.length > 0) {
                        foundInScript = true
                        break
                    }
                }
            }
        }

        // 2. Fallback DOM (Lazy Loading images)
        if (!foundInScript) {
             const imgs = $('img[loading="lazy"], .main img, #main img').toArray()
             for (const img of imgs) {
                 let src = $(img).attr('src') || $(img).attr('data-src')
                 if (src && src.startsWith('http')) pages.push(src)
             }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)] // Rimuovi duplicati
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Selettore per le righe dei risultati di ricerca
        const items = $('.flex.border-b.border-b-base-200').toArray()
        
        for (const item of items) {
            const $item = $(item)
            const titleLink = $item.find('h3.font-bold a').first()
            const title = titleLink.text().trim()
            
            // ID: /title/386006-it-usemono-yado -> 386006-it-usemono-yado
            const id = titleLink.attr('href')?.split('/').pop()

            let image = $item.find('img').first().attr('src') || ''
            if (image.startsWith('/')) image = 'https://mangapark.io' + image

            // Info aggiuntive come sottotitolo (es. ultimo capitolo)
            const subtitle = $item.find('.flex.justify-between a').first().text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        }
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari in Italia', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Aggiornamenti Recenti (IT)', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const mangas = this.parseSearchResults($)
        
        popularSection.items = mangas
        sectionCallback(popularSection)
        
        latestSection.items = mangas
        sectionCallback(latestSection)
    }
}