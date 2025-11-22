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

export class NineMangaITParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Versione Mobile: Dettagli di solito in .book-detail o .manga-detail
        // Se non troviamo classi specifiche, cerchiamo genericamente
        
        let title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        
        let image = $('.book-cover img').attr('src') ?? ''
        if (!image) image = $('.manga-cover img').attr('src') ?? ''

        const author = $('a[href*="/author/"]').first().text().trim() ?? 'Unknown'
        const artist = $('a[href*="/artist/"]').first().text().trim() ?? 'Unknown'
        const desc = $('.book-intro').text().trim() ?? 'No description'
        
        // Status
        let status = 'Ongoing'
        const statusText = $('.red').text().toLowerCase()
        if (statusText.includes('completato')) status = 'Completed'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: artist,
                desc: desc,
                tags: [] // I tag su mobile sono spesso difficili da parsare puliti
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Mobile: Lista capitoli spesso in .chapter-box o .chapter-list ul li
        const chapterNodes = $('ul.chapter-list li, .chapter-box li').toArray()

        for (const node of chapterNodes) {
            const link = $('a', node)
            const href = link.attr('href')
            if (!href) continue

            // Estrai ID capitolo dall'URL (es: /chapter/MangaName/12345.html -> 12345.html)
            const parts = href.split('/')
            const chapterId = parts.pop() ?? ''
            
            // Se non troviamo l'ID, forse è l'ultimo pezzo non vuoto
            if (!chapterId || chapterId.trim() === '') continue

            const name = link.text().trim()
            const time = $('span.date', node).text().trim() // Data se presente

            // Numero capitolo
            const chapNumMatch = name.match(/(\d+(\.\d+)?)/)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

            chapters.push(App.createChapter({
                id: chapterId.replace('.html', ''), // Rimuovi .html per pulizia
                name: name,
                chapNum: chapNum,
                time: new Date(time), // Potrebbe non essere preciso, ma meglio di nulla
                langCode: 'it'
            }))
        }

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string, requestManager: any, baseUrl: string, cheerio: any): ChapterDetails {
        // Mobile: Spesso c'è un selettore di pagine o le immagini sono in un div .manga_pic
        // NineManga Mobile a volte usa una select per le pagine
        const pages: string[] = []
        
        // Metodo 1: Cerca immagini dirette (se "tutte in una pagina")
        const images = $('img.manga_pic, #manga_pic').toArray()
        for (const img of images) {
            const src = $(img).attr('src')
            if (src) pages.push(src)
        }

        // Metodo 2: Se è paginato (una pagina per volta), dobbiamo generare gli URL delle altre pagine
        // Cerchiamo il numero totale di pagine nella select
        if (pages.length <= 1) {
            const pageSelect = $('select#page').first()
            const options = $('option', pageSelect).toArray()
            
            // Se troviamo la select, significa che dobbiamo ciclare (o dedurre gli URL)
            // Per semplicità, in questa versione base, prendiamo solo l'immagine corrente.
            // Per un supporto completo multipagina su mobile servirebbe un ciclo di richieste async, 
            // che è complesso da fare qui nel parser sincrono.
            // Tenteremo di prendere l'immagine corrente.
        }
        
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Risultati ricerca mobile (spesso in .book-list li o simili)
        // Adattato per la struttura generica mobile di NineManga
        const items = $('.book-list li, .comic-item').toArray()

        for (const item of items) {
            const link = $('a', item).first()
            const href = link.attr('href')
            // Estrai ID manga (/manga/NomeManga.html)
            const id = href?.split('/manga/')[1]?.replace('.html', '')

            if (!id) continue

            const image = $('img', item).attr('src') ?? ''
            const title = link.attr('title') || link.text().trim()

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }
        return results
    }

    parseHomeSections($home: any, $updates: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const new