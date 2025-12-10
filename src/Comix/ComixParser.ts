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
        let jsonManga = null
        const scripts = $('script').toArray()
        
        // Cerca i dati del manga nel JSON di Next.js
        for (const script of scripts) {
            const content = $(script).html() || ''
            if (content.includes('self.__next_f.push')) {
                // Pulizia preventiva per facilitare il match
                const cleanContent = content.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
                const match = cleanContent.match(/"manga":({.*?})/)
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
        // Nota: Qui usiamo una regex che tollera sia versioni escapate che non
        const idMatch = html.match(/"manga_id":\s*(\d+)/) || html.match(/\\"manga_id\\":\s*(\d+)/)
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
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            
            const response = await requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '[]')
            
            if (Array.isArray(data)) {
                for (const chap of data) {
                    // Costruiamo l'URL completo del capitolo come ID
                    // Questo risolve i problemi nel getChapterDetails perché avremo già l'URL pronto
                    const chapSlug = `${chap.id}-chapter-${chap.number}`
                    const fullUrl = `/title/${mangaId}-${chap.slug || 'unknown'}/${chapSlug}`
                    
                    const title = chap.title ? `${chap.number} - ${chap.title}` : `Chapter ${chap.number}`
                    const num = parseFloat(chap.number) || 0
                    const date = new Date(chap.created_at ? chap.created_at * 1000 : Date.now())

                    chapters.push(App.createChapter({
                        id: fullUrl, // Salviamo l'URL relativo come ID
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

        // Estrazione robusta del JSON di Next.js
        const nextDataRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g
        let match

        while ((match = nextDataRegex.exec(html)) !== null) {
            let data = match[1]
            
            // DE-ESCAPE fondamentale: trasforma \" in "
            data = data.replace(/\\"/g, '"').replace(/\\\\/g, '\\')

            // Cerchiamo l'array "images"
            if (data.includes('"images":[')) {
                try {
                    // Estrarre solo la parte delle immagini per evitare errori di parsing sull'intero blocco
                    // Cerchiamo: "images":[{"width":...,"url":"..."},...]
                    const imgMatch = data.match(/"images":(\[\{.*?\}\])/)
                    if (imgMatch) {
                        const images = JSON.parse(imgMatch[1])
                        for (const img of images) {
                            if (img.url) {
                                pages.push(img.url)
                            }
                        }
                        // Se abbiamo trovato immagini, possiamo fermarci
                        if (pages.length > 0) break
                    }
                } catch (e) {
                    console.log("Comix: Error parsing images JSON segment")
                }
            }
        }

        // Fallback: se il metodo sopra fallisce, prova una regex più brutale sull'HTML grezzo
        if (pages.length === 0) {
             const fallbackRegex = /"url":"(https:\/\/[^"]+)"/g
             let m
             while ((m = fallbackRegex.exec(html)) !== null) {
                 // Filtra URL che sembrano immagini di capitoli (spesso contengono /ii/ o .webp)
                 if (m[1] && (m[1].includes('.webp') || m[1].includes('.jpg')) && !m[1].includes('poster') && !m[1].includes('logo')) {
                     pages.push(m[1])
                 }
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
        
        const nextDataRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g
        let match
        
        while ((match = nextDataRegex.exec(html)) !== null) {
            let data = match[1]
            data = data.replace(/\\"/g, '"').replace(/\\\\/g, '\\')

            // Cerca array di items
            if (data.includes('"items":[')) {
                 const itemsMatch = data.match(/"items":(\[\{.*?\}\])/)
                 if (itemsMatch) {
                     try {
                        const items = JSON.parse(itemsMatch[1])
                        if (items.length > 0 && (items[0].manga_id || items[0].hash_id)) {
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
                        }
                     } catch(e) { /* ignore */ }
                 }
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
        
        // 1. Popular
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
        
        // 2. New/Trending
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

        // 3. Latest Updates
        $('.sect--latest .comic .item').each((_: any, item: any) => {
            const titleLink = $('.title', item).attr('href')
            const title = $('.title', item).text().trim()
            const id = titleLink?.split('/title/')[1]
            const img = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            const chapter = $('.metadata span', item).first().text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: img,
                    title: title,
                    subtitle: chapter
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