import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
    RequestManager
} from '@paperback/types'

const BASE_URL = 'https://comix.to'

export class ComixParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Tentativo di estrarre i dati dal JSON Next.js per precisione
        let jsonManga = null
        const scripts = $('script').toArray()
        for (const script of scripts) {
            const content = $(script).html() || ''
            if (content.includes('self.__next_f.push')) {
                const match = content.match(/"manga":({.*?})/)
                if (match) {
                    try {
                        jsonManga = JSON.parse(match[1])
                        break
                    } catch (e) { /* ignore */ }
                }
            }
        }

        const title = jsonManga?.title || $('h1.title').text().trim() || 'Unknown'
        
        let image = jsonManga?.poster?.large || jsonManga?.poster?.medium || ''
        if (!image) image = $('img[itemprop="image"]').attr('src') ?? ''
        
        const desc = jsonManga?.synopsis || $('.description .content').text().trim() || 'No description'
        
        let status = 'Ongoing'
        if (jsonManga?.status === 'finished') status = 'Completed'

        const arrayTags: Tag[] = []
        
        if (jsonManga?.genre) {
            for (const g of jsonManga.genre) {
                arrayTags.push(App.createTag({ id: g.slug, label: g.title }))
            }
        } else {
             $('ul#metadata a[href*="genres="]').each((_: any, a: any) => {
                const label = $(a).text().trim()
                const id = $(a).attr('href')?.split('=').pop() ?? label
                arrayTags.push(App.createTag({ id, label }))
            })
        }
        
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]
        
        let author = 'Unknown'
        let artist = 'Unknown'
        
        if (jsonManga?.author && jsonManga.author.length > 0) author = jsonManga.author.map((a:any) => a.title).join(', ')
        if (jsonManga?.artist && jsonManga.artist.length > 0) artist = jsonManga.artist.map((a:any) => a.title).join(', ')

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: artist,
                tags: tagSections,
                desc: desc
            })
        })
    }

    async parseChapters(html: string, requestManager: RequestManager): Promise<Chapter[]> {
        const chapters: Chapter[] = []
        
        // 1. Trova il manga_id numerico nel JSON della pagina
        const idMatch = html.match(/"manga_id":(\d+)/)
        const mangaId = idMatch ? idMatch[1] : null

        if (!mangaId) {
            console.error("Comix: Manga ID not found in HTML")
            return []
        }

        // 2. Chiama l'API dei capitoli
        const apiUrl = `${BASE_URL}/api/manga/${mangaId}/chapters?source=detail`
        
        try {
            const request = App.createRequest({
                url: apiUrl,
                method: 'GET',
                headers: {
                    'Referer': BASE_URL,
                    'X-Requested-With': 'XMLHttpRequest' // Importante per alcune API
                }
            })
            
            const response = await requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '[]')
            
            // Il formato dei dati API solitamente è un array di capitoli
            if (Array.isArray(data)) {
                for (const chap of data) {
                    const id = `${chap.id}-chapter-${chap.number}` // Formato slug capitolo
                    const title = chap.title ? `${chap.number} - ${chap.title}` : `Chapter ${chap.number}`
                    const num = parseFloat(chap.number) || 0
                    const date = new Date(chap.created_at ? chap.created_at * 1000 : Date.now())

                    chapters.push(App.createChapter({
                        id: id,
                        name: title,
                        chapNum: num,
                        time: date,
                        langCode: 'en'
                    }))
                }
            }
        } catch (e) {
            console.error(`Comix: Error fetching chapters API: ${e}`)
        }
        
        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        // Estrai immagini dal JSON "images"
        const imagesRegex = /"images":(\[\{.*?\}\])/
        const match = html.match(imagesRegex)

        if (match) {
            try {
                const imagesJson = JSON.parse(match[1])
                for (const img of imagesJson) {
                    if (img.url) {
                        pages.push(img.url)
                    }
                }
            } catch (e) {
                console.error("Error parsing images JSON", e)
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults(html: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Estrazione risultati dal JSON embedded
        const itemsRegex = /"items":(\[\{.*?\}\])/g
        let match
        
        while ((match = itemsRegex.exec(html)) !== null) {
            try {
                const items = JSON.parse(match[1])
                // Controlla se è un array valido di manga
                if (items.length > 0 && items[0].manga_id) {
                     for (const item of items) {
                        const id = `${item.hash_id}-${item.slug}` 
                        const title = item.title
                        const image = item.poster?.medium || item.poster?.large || ''
                        
                        results.push(App.createPartialSourceManga({
                            mangaId: id,
                            image: image,
                            title: title,
                            subtitle: undefined
                        }))
                     }
                     // Se abbiamo trovato i risultati della ricerca (solitamente la lista più lunga), usciamo
                     if (results.length > 0) break
                }
            } catch (e) {
                // Continue
            }
        }

        return results
    }

    parseHomeSections(cheerio: any, html: string, sectionCallback: (section: HomeSection) => void): void {
        
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Most Popular 🔥', containsMoreItems: false, type: HomeSectionType.singleRowLarge })
        const trendingSection = App.createHomeSection({ id: 'trending', title: 'Trending New 🌟', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆙', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const popularItems: PartialSourceManga[] = []
        const trendingItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        const $ = cheerio.load(html)
        
        // Estrazione JSON per maggiore precisione
        const scripts = $('script').toArray()
        let foundJson = false

        for (const script of scripts) {
            const content = $(script).html() || ''
            // Cerchiamo le liste nel JSON "items"
            const matches = content.matchAll(/"items":(\[\{.*?\}\])/g)
            for (const match of matches) {
                try {
                    const items = JSON.parse(match[1])
                    if (items.length > 0 && items[0].manga_id) {
                        // Logica euristica per capire che lista è
                        // Se ha "rank", probabilmente è Popular o Trending
                        // Se "latest_chapter" è molto recente, è Latest
                        
                        // Assumiamo:
                        // Prima lista grossa -> Popular
                        // Seconda -> Latest
                        // Terza -> Trending (o viceversa in base al layout HTML)
                        
                        // Per semplicità, usiamo i selettori CSS se il JSON è confuso,
                        // ma qui mappiamo tutto a Latest per sicurezza se non distinguiamo.
                    }
                } catch(e) {}
            }
        }

        // Fallback: Parsing HTML Classico (Più sicuro per l'ordine visivo)
        
        // 1. Popular (Carosello)
        $('.popular .swiper-slide').each((_: any, slide: any) => {
            const title = $('.title', slide).text().trim()
            const link = $('.poster', slide).attr('href')
            const id = link?.split('/title/')[1]
            const img = $('img', slide).attr('src') || $('img', slide).attr('data-src') || ''
            
            if (id && title) {
                popularItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: img,
                    title: title,
                    subtitle: $('.metadata', slide).text().trim()
                }))
            }
        })
        
        // 2. Trending (Sidebar Added)
        $('.added-box .item').each((_: any, item: any) => {
            const title = $('.title', item).text().trim()
            const link = $(item).attr('href')
            const id = link?.split('/title/')[1]
            const img = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            
            if (id && title) {
                trendingItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: img,
                    title: title,
                    subtitle: $('.news', item).text().trim()
                }))
            }
        })

        // 3. Latest
        $('.sect--latest .comic .item').each((_: any, item: any) => {
            const titleLink = $('.title', item).attr('href')
            const title = $('.title', item).text().trim()
            const id = titleLink?.split('/title/')[1]
            const img = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            
            const meta = $('.metadata', item).text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: img,
                    title: title,
                    subtitle: meta
                }))
            }
        })

        if (popularItems.length > 0) {
            popularSection.items = popularItems
            sectionCallback(popularSection)
        }
        
        if (trendingItems.length > 0) {
            trendingSection.items = trendingItems
            sectionCallback(trendingSection)
        }

        if (latestItems.length > 0) {
            latestSection.items = latestItems
            sectionCallback(latestSection)
        }
    }
}