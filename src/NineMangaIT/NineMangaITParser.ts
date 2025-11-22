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
        // 1. Titolo
        let title = $('h1[itemprop="name"]').first().text().trim()
        if (!title) title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        title = title.replace(/ Manga$/, '').trim()
        
        // 2. Immagine
        // FIX: La classe corretta nell'HTML è "bookintro" (senza trattino)
        let image = $('.bookintro img[itemprop="image"]').attr('src') ?? ''
        if (!image) image = $('.book-cover img').attr('src') ?? ''
        if (!image) image = $('div.bookintro img').attr('src') ?? ''

        // 3. Autore e Artista
        const author = $('a[itemprop="author"]').first().text().trim() ?? 'Unknown'
        const artist = author // Spesso coincidono su NineManga

        // 4. Descrizione
        // FIX: Usa itemprop="description" per essere sicuri
        let desc = $('p[itemprop="description"]').text().trim()
        if (!desc) desc = $('.bookintro p').text().trim()
        if (!desc) desc = 'No description available'
        
        // 5. Status
        let status = 'Ongoing'
        const statusText = $('.red').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        // 6. Generi
        const arrayTags: Tag[] = []
        $('li[itemprop="genre"] a').each((_: any, el: any) => {
            const id = $(el).attr('href')?.split('/').pop()?.replace('.html', '') ?? ''
            const label = $(el).text().trim()
            if (id && label) arrayTags.push({ id, label })
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: artist,
                desc: desc,
                tags: tagSections
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()

        // FIX CRITICO: Seleziona SOLO i link principali dei capitoli
        // La classe "chapter_list_a" è quella che contiene il link vero,
        // evitando i link di paginazione (1, 3, 6...) che sono in em.page_choose
        const chapterLinks = $('a.chapter_list_a').toArray()

        for (const link of chapterLinks) {
            const $link = $(link)
            const href = $link.attr('href')
            
            if (!href) continue

            // Estrazione ID (es. /chapter/One%20Piece/982150.html -> 982150)
            const parts = href.split('/')
            const filePart = parts.pop() ?? '' 
            const chapterId = filePart.replace('.html', '').split('?')[0]

            if (seenIds.has(chapterId) || !chapterId) continue
            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            
            // Pulizia titolo (rimuovi nome manga se ripetuto all'inizio)
            // Es: "One Piece 1141" -> "1141" (opzionale, ma spesso più pulito)
            // Per ora lo lasciamo intero o lo puliamo leggermente
            titleRaw = titleRaw.replace(new RegExp(`^${mangaId.replace(/-/g, ' ')}\\s+`, 'i'), '')

            // Data
            // La data è in uno span fratello del link
            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText) {
                time = new Date(dateText)
                if (isNaN(time.getTime())) time = new Date()
            }

            // Parsing Numero
            const chapNumMatch = titleRaw.match(/(?:ch|chapter|episode|c|one piece)\.?\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1] ?? '0')
            } else {
                // Fallback: ultimo numero trovato
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
        
        // Metodo 1: Cerca nello script "p_urls" (Standard Mobile NineManga)
        const scripts = $('script').toArray()
        for (const script of scripts) {
            const content = $(script).html()
            if (content && content.includes('p_urls')) {
                 // Estrae array di immagini dal JS
                 const matches = content.match(/https?:\/\/[^"']+\.(jpg|png|webp|jpeg)/g)
                 if (matches) {
                     pages.push(...matches)
                 }
            }
        }

        // Metodo 2: Immagini dirette (se presenti nel DOM)
        if (pages.length === 0) {
            $('img.manga_pic').each((_: any, img: any) => {
                const src = $(img).attr('src')
                if (src) pages.push(src)
            })
        }

        // Metodo 3: Fallback "Center Image"
        if (pages.length === 0) {
            $('div[align="center"] img').each((_:any, img:any) => {
                const src = $(img).attr('src')
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

        // Helper per pulire i titoli (Rimuove numeri alla fine)
        const cleanTitle = (t: string) => {
            // Rimuove pattern come " 1141", " Vol.1", " Ch.10" alla fine della stringa
            return t.replace(/(\s+(Vol\.|Ch\.|Chapter\.)?\s*\d+(\.\d+)?)+$/i, '').trim()
        }

        // POPOLARI (tab_content_3)
        const popularList = $home('#tab_content_3 li').toArray()
        for (const item of popularList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            
            // Titolo Raw: "One Piece 1141"
            const rawTitle = link.attr('title') || $home('span', item).text().trim()
            // Titolo Pulito: "One Piece"
            const title = cleanTitle(rawTitle)

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
            const rawTitle = link.attr('title') || $home('span', item).text().trim()
            const title = cleanTitle(rawTitle)

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
            
            // Estrae il numero del capitolo per il sottotitolo
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