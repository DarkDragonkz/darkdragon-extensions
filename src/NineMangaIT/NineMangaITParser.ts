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
        let title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        // Pulisci il titolo da suffissi comuni
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

        // 1. Cerca TUTTI i link nella pagina
        const allLinks = $('a').toArray()

        for (const link of allLinks) {
            const $link = $(link)
            const href = $link.attr('href')
            
            // FIX: NineManga usa /chapter/, non /title/
            if (!href || !href.includes('/chapter/')) continue

            // Estrazione ID (es. /chapter/MangaName/12345.html -> 12345)
            const parts = href.split('/')
            const filePart = parts.pop() ?? '' 
            const chapterId = filePart.replace('.html', '')

            // Validazione ID e duplicati
            if (seenIds.has(chapterId) || chapterId.length < 3 || href.includes('javascript:')) continue
            
            // Filtro extra: Assicuriamoci che il link non sia "Torna all'indice" o simili
            // I link dei capitoli di solito finiscono con .html o numeri
            if (!filePart.includes('.html') && !filePart.match(/^\d+$/)) continue

            seenIds.add(chapterId)

            const titleRaw = $link.text().trim()
            if (!titleRaw) continue

            // Data
            const dateText = $link.find('.date').text().trim() || $link.parent().find('.date').text().trim()
            let time = new Date()
            if (dateText) {
                time = new Date(dateText)
                if (isNaN(time.getTime())) time = new Date()
            }

            // Parsing Numero Capitolo
            // Cerca pattern come "Ch.123", "Chapter 123", o numeri alla fine
            const chapNumMatch = titleRaw.match(/(?:ch|chapter|episode|c)(?:\.|apters?|\s)*\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1] ?? '0')
            } else {
                const simpleNums = titleRaw.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1] ?? '0')
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: titleRaw,
                chapNum: chapNum,
                time: time,
                langCode: 'it'
            }))
        }

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string, requestManager: any, baseUrl: string, cheerio: any): ChapterDetails {
        const pages: string[] = []
        
        // Metodo 1: Immagini dirette
        $('img.manga_pic').each((_: any, img: any) => {
            const src = $(img).attr('src')
            if (src) pages.push(src)
        })

        // Metodo 2: Estrazione da script "p_urls" (versione mobile comune)
        if (pages.length === 0) {
            const scripts = $('script').toArray()
            for (const script of scripts) {
                const content = $(script).html()
                if (content && content.includes('p_urls')) {
                     const matches = content.match(/https?:\/\/[^"']+\.(jpg|png|webp|jpeg)/g)
                     if (matches) {
                         pages.push(...matches)
                     }
                }
            }
        }

        // Metodo 3: Fallback generico per immagini grandi al centro
        if (pages.length === 0) {
            $('div[align="center"] img').each((_:any, img:any) => {
                const src = $(img).attr('src')
                // Filtra icone piccole o pubblicità
                if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
                    pages.push(src)
                }
            })
        }
        
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)] // Rimuovi duplicati
        })
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = $('.book-list li, .comic-item, dd.book-list').toArray()

        for (const item of items) {
            const link = $('a', item).first()
            const href = link.attr('href')
            
            let id = ''
            if (href && href.includes('/manga/')) {
                 id = href.split('/manga/')[1].replace('.html', '')
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

        // Helper per pulire i titoli (es. "One Piece 1141" -> "One Piece")
        const cleanTitle = (t: string) => {
            // Rimuove "Vol. 33 Ch. 135..." o numeri alla fine
            return t.replace(/(Vol\.\s*\d+)?\s*(Ch\.\s*\d+)?.*$/, '') 
                    .replace(/\s+\d+(\.\d+)?$/, '')
                    .trim()
        }

        // POPOLARI (tab_content_3)
        const popularList = $home('#tab_content_3 li').toArray()
        for (const item of popularList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            
            // Usa attributo title se presente, è spesso più pulito del testo
            let title = link.attr('title') || $home('span', item).text().trim()
            title = cleanTitle(title)

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

        // NUOVI (tab_content_1)
        const newList = $home('#tab_content_1 li').toArray()
        for (const item of newList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            let title = link.attr('title') || $home('span', item).text().trim()
            title = cleanTitle(title)

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

        // ULTIMI AGGIORNAMENTI (tab_content_2)
        const latestList = $home('#tab_content_2 li').toArray()
        for (const item of latestList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            
            const rawTitle = link.attr('title') || $home('span', item).text().trim()
            const title = cleanTitle(rawTitle)
            
            // Cerchiamo di estrarre il numero del capitolo dal titolo originale sporco
            let subtitle = undefined
            const numMatch = rawTitle.match(/(\d+(\.\d+)?)$/)
            if (numMatch) subtitle = `Ch. ${numMatch[0]}`

            if (id) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        }
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}