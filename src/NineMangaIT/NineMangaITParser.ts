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
        // Tenta di trovare il titolo in vari modi
        let title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        // Pulisce il titolo se contiene "Manga" alla fine (comune in alcune view)
        title = title.replace(/ Manga$/, '').trim()
        
        let image = $('.book-cover img').attr('src') ?? ''
        if (!image) image = $('.manga-cover img').attr('src') ?? ''
        if (!image) image = $('div.book-intro img').attr('src') ?? ''

        const author = $('a[href*="/author/"]').first().text().trim() ?? 'Unknown'
        const artist = $('a[href*="/artist/"]').first().text().trim() ?? 'Unknown'
        const desc = $('.book-intro').text().trim() ?? 'No description'
        
        let status = 'Ongoing'
        const statusText = $('.red').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: artist,
                desc: desc,
                tags: []
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()

        // METODO AGGRESSIVO PER MOBILE:
        // Invece di cercare un container specifico che cambia spesso,
        // cerchiamo TUTTI i link nella pagina che portano a un capitolo.
        const allLinks = $('a[href*="/chapter/"]').toArray()

        for (const link of allLinks) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            // Verifica che il link appartenga a questo manga (controlla se l'ID manga è nell'URL o se sembra un capitolo valido)
            // URL tipico: /chapter/NomeManga/12345.html
            const parts = href.split('/')
            const filePart = parts.pop() ?? '' // 12345.html
            const chapterId = filePart.replace('.html', '')

            // Evita link duplicati o non validi
            if (seenIds.has(chapterId) || chapterId === '' || href.includes('javascript:')) continue
            seenIds.add(chapterId)

            const name = $link.text().trim()
            // Se il nome del link è troppo lungo (es. contiene descrizioni), probabilmente non è quello giusto,
            // ma proviamo a pulirlo.
            
            const dateText = $link.find('.date').text().trim() || $link.parent().find('.date').text().trim()
            let time = new Date()
            if (dateText) {
                time = new Date(dateText)
                if (isNaN(time.getTime())) time = new Date() // Fallback se la data non è valida
            }

            // Parsing numero capitolo
            const chapNumMatch = name.match(/(\d+(\.\d+)?)/)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: time,
                langCode: 'it'
            }))
        }

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string, requestManager: any, baseUrl: string, cheerio: any): ChapterDetails {
        const pages: string[] = []
        
        // Metodo 1: Immagini dirette (se presenti)
        $('img.manga_pic').each((_: any, img: any) => {
            const src = $(img).attr('src')
            if (src) pages.push(src)
        })

        // Metodo 2: Cerca nello script per "p_urls" (variabile comune in NineManga per le immagini)
        // Questo è spesso usato nei layout mobile per caricare tutte le immagini.
        if (pages.length === 0) {
            const scripts = $('script').toArray()
            for (const script of scripts) {
                const content = $(script).html()
                if (content && content.includes('p_urls')) {
                     // Estrazione grezza ma efficace degli URL
                     const matches = content.match(/https?:\/\/[^"']+\.(jpg|png|webp|jpeg)/g)
                     if (matches) {
                         pages.push(...matches)
                     }
                }
            }
        }
        
        // Fallback: se ancora 0, probabilmente serve navigazione pagina per pagina, 
        // ma proviamo a vedere se basta questo per ora.
        
        // Rimuovi duplicati
        const uniquePages = [...new Set(pages)]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: uniquePages
        })
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = $('.book-list li, .comic-item, dd.book-list').toArray()

        for (const item of items) {
            const link = $('a', item).first()
            const href = link.attr('href')
            
            // Supporto per URL completi o relativi
            let id = ''
            if (href) {
                 if (href.includes('/manga/')) {
                     id = href.split('/manga/')[1].replace('.html', '')
                 }
            }

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
        const newSection = App.createHomeSection({ id: 'new', title: 'Nuove Uscite', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const popularItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // POPOLARI
        const popularList = $home('#tab_content_3 li').toArray()
        for (const item of popularList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            
            // FIX: Pulisci il titolo rimuovendo il numero finale
            let title = $home('span', item).text().trim()
            // Regex: Rimuove uno spazio seguito da numeri alla fine della stringa (es "One Piece 1141" -> "One Piece")
            title = title.replace(/\s+\d+(\.\d+)?$/, '')

            if (id) {
                popularItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }
        popularSection.items = popularItems
        sectionCallback(popularSection)

        // NUOVI
        const newList = $home('#tab_content_1 li').toArray()
        for (const item of newList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            let title = $home('span', item).text().trim()
            title = title.replace(/\s+\d+(\.\d+)?$/, '')

            if (id) {
                newItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }
        newSection.items = newItems
        sectionCallback(newSection)

        // ULTIMI AGGIORNAMENTI
        const latestList = $home('#tab_content_2 li').toArray()
        for (const item of latestList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            let title = $home('span', item).text().trim()
            
            // Per gli ultimi aggiornamenti potremmo voler tenere il numero per sapere a che punto siamo,
            // ma per coerenza lo puliamo e mettiamo il numero nel sottotitolo se possibile.
            const originalTitle = title
            title = title.replace(/\s+\d+(\.\d+)?$/, '')
            const chapterNum = originalTitle.replace(title, '').trim()

            if (id) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapterNum ? `Ch. ${chapterNum}` : undefined
                }))
            }
        }
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}