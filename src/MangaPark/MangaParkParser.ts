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

    // Helper per correggere gli URL delle immagini (da relativi ad assoluti)
    private fixImageUrl(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        if (url.startsWith('//')) return `https:${url}`
        if (url.startsWith('/')) return `${MP_DOMAIN}${url}`
        return url
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // 1. Titolo
        let title = $('h3 a.link-hover').first().text().trim()
        if (!title) title = $('title').text().split('-')[0]?.trim() ?? 'Unknown Title'

        // 2. Immagine (Con correzione URL assoluto)
        // Cerchiamo l'immagine nel box laterale
        let image = $('.w-24.md\\:w-52 img').attr('src') 
        if (!image) image = $('.w-24 img').attr('src') // Fallback mobile
        
        const finalImage = this.fixImageUrl(image)

        // 3. Descrizione
        let desc = $('.limit-html-p').text().trim()
        if (!desc) desc = $('.limit-html').text().trim()
        if (!desc) desc = 'No description available'

        // 4. Autore e Artista
        // Cerca i link che portano alla ricerca per autore
        const authors: string[] = []
        $('a[href*="/search?word="]').each((_: any, el: any) => {
            // Filtriamo link generici, cerchiamo quelli nel blocco info
            if ($(el).parent().text().includes('Story') || $(el).parent().text().includes('Art')) {
                authors.push($(el).text().trim())
            }
        })
        
        // Se non ne trova in modo specifico, prendiamo il primo link di ricerca che troviamo nell'header
        let author = authors.length > 0 ? authors.join(', ') : 'Unknown'
        if (author === 'Unknown') {
             const fallbackAuth = $('div.mt-2.text-sm.opacity-80 a').first().text().trim()
             if (fallbackAuth) author = fallbackAuth
        }

        // 5. Status
        let status = 'Ongoing'
        const statusText = $('span.font-bold.uppercase').text().trim().toLowerCase()
        if (statusText.includes('completed')) status = 'Completed'
        if (statusText.includes('hiatus')) status = 'Hiatus'

        // 6. Generi
        const arrayTags: Tag[] = []
        // Cerca il blocco che contiene "Genres:"
        $('div:contains("Genres:")').find('span.whitespace-nowrap').each((_: any, el: any) => {
            const tagText = $(el).text().trim()
            // Evitiamo label come "Genres" o virgole
            if (tagText && tagText !== 'Genres:' && tagText !== ',') {
                 // Pulizia extra
                 const cleanTag = tagText.replace(/,/g, '').trim()
                 if (cleanTag) arrayTags.push({ id: cleanTag.toLowerCase(), label: cleanTag })
            }
        })
        
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: finalImage,
                status: status,
                author: author,
                artist: '', // Mettiamo vuoto per evitare errori di tipo
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Selettore specifico per la lista capitoli di MangaPark
        // Cerca dentro il div con data-name="chapter-list"
        const chapterNodes = $('div[data-name="chapter-list"] .group.flex.flex-col > div').toArray()

        for (const node of chapterNodes) {
            const linkElement = $('a.link-hover.link-primary', node).first()
            const href = linkElement.attr('href')
            
            if (!href) continue

            // Estrazione ID dall'URL (es. .../9939308-vol-0-ch-78 -> "9939308-vol-0-ch-78")
            // È importante prendere l'ultima parte dell'URL come ID univoco
            const chapterId = href.split('/').pop()
            if (!chapterId) continue

            const titleRaw = linkElement.text().trim()
            const timeStr = $('time', node).text().trim()
            
            // Parsing numero
            const chapNumMatch = titleRaw.match(/Ch\.(\d+(\.\d+)?)/i)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0
            
            const volMatch = titleRaw.match(/Vol\.(\d+)/i)
            const volNum = volMatch ? parseFloat(volMatch[1]) : undefined

            let name = titleRaw
            // Aggiungiamo il titolo extra se esiste (es. ": Battle Start")
            const extraInfo = $(node).find('span.opacity-80').text().trim()
            if (extraInfo && extraInfo !== ':' && extraInfo.length > 1) {
                name += ` ${extraInfo}`
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: this.convertTime(timeStr),
                langCode: 'en'
            }))
        }

        return chapters
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // MangaPark usa una griglia per i risultati di ricerca
        // Selettore: .grid .group.relative
        const items = $('div.grid div.group.relative').toArray()

        for (const item of items) {
            const link = $('a', item).first()
            const href = link.attr('href')
            
            // Estraiamo l'ID numerico (es. /title/12345-name)
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null
            
            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            // Immagine: gestiamo URL relativi
            const relativeImg = $('img', item).attr('src')
            const image = this.fixImageUrl(relativeImg)

            // Titolo: Cerca nel link o nell'alt dell'immagine o nel box hover
            let title = $('h3 a', $(item).parent()).text().trim() // Prova a cercare nel contenitore padre
            if (!title) title = $('a.font-bold', $(item).next()).text().trim() // Prova elemento successivo
            if (!title) title = $('img', item).attr('alt') ?? 'Unknown Title'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Updates', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Releases', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Scansioniamo TUTTI i link ai manga nella pagina per riempire le sezioni
        // MangaPark mischia un po' le cose, quindi prendiamo tutto ciò che sembra una card manga
        const mangaCards = $('div.group.relative').toArray()

        for (let i = 0; i < mangaCards.length; i++) {
            const card = mangaCards[i]
            const link = $('a', card).first()
            const href = link.attr('href')
            
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null

            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            const relativeImg = $('img', card).attr('src')
            const image = this.fixImageUrl(relativeImg)

            // Titolo: cerchiamo in vari posti perché il layout cambia
            let title = $('img', card).attr('title') || $('img', card).attr('alt')
            
            // A volte il titolo è in un div fratello
            if (!title) {
                // Risaliamo al parent e cerchiamo un titolo
                const parent = $(card).closest('div.flex') // Container della card
                title = parent.find('h3 a').text().trim()
            }
            
            if (!title) title = 'Unknown'

            const item = App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            })

            // Distribuiamo i risultati
            if (popularItems.length < 10) {
                popularItems.push(item)
            } else {
                latestItems.push(item)
            }
        }

        popularSection.items = popularItems
        latestSection.items = latestItems
        
        sectionCallback(popularSection)
        sectionCallback(latestSection)
    }

    private convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        
        if (isNaN(time.getTime())) return new Date()
        return time
    }
}