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

const BASE_URL = 'https://comix.to'

export class ComixParser {

    // Helper per estrarre i dati JSON di Next.js (_next_f)
    // Questo è fondamentale per siti moderni come Comix.to
    private extractNextData(html: string): any {
        const regex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g
        let match
        let combinedJson = ""
        
        // Raccogliamo tutti i frammenti JSON sparsi nella pagina
        while ((match = regex.exec(html)) !== null) {
            let data = match[1]
            // Pulizia del formato stringa di Next.js
            data = data.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
            
            // Cerchiamo oggetti JSON interessanti
            if (data.includes('manga_id') || data.includes('chapter_id')) {
                // Tentativo euristico di estrarre l'oggetto JSON pulito
                // Cerchiamo l'inizio di un oggetto che assomiglia alla nostra struttura
                const mangaMatch = data.match(/{"manga":{.*?}/)
                if (mangaMatch) return JSON.parse(mangaMatch[0])
                
                const chapterMatch = data.match(/{"chapter":{.*?}/)
                if (chapterMatch) return JSON.parse(chapterMatch[0])

                const itemsMatch = data.match(/{"items":\[{.*?}\]}/)
                if (itemsMatch) return JSON.parse(itemsMatch[0])
            }
        }
        return null
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Tentiamo prima di parsare l'HTML statico per velocità
        const title = $('h1.title').text().trim() || 'Unknown'
        const image = $('img[itemprop="image"]').attr('src') ?? ''
        const desc = $('.description .content').text().trim() ?? 'No description'
        
        let status = 'Ongoing'
        const statusText = $('.status').text().trim().toLowerCase()
        if (statusText.includes('finished') || statusText.includes('completed')) status = 'Completed'

        const arrayTags: Tag[] = []
        // Generi e Temi
        $('ul#metadata a[href*="genres="], ul#metadata a[href*="demographics="]').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('=').pop() ?? label
            arrayTags.push(App.createTag({ id, label }))
        })
        
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]
        
        const author = $('a[href*="authors="]').text().trim() ?? 'Unknown'
        const artist = $('a[href*="artists="]').text().trim() ?? 'Unknown'

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

    parseChapters(html: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Estrazione dati JSON profonda per i capitoli
        // Nota: Su Comix.to i capitoli potrebbero essere caricati dinamicamente.
        // Qui cerchiamo nel payload iniziale.
        const chapterDataRegex = /"chapters":(\[{.*?}\])/
        const match = html.match(chapterDataRegex)
        
        if (match) {
            try {
                const jsonChapters = JSON.parse(match[1])
                for (const chap of jsonChapters) {
                    const id = String(chap.chapter_id ?? chap.id)
                    const title = chap.title || `Chapter ${chap.number}`
                    const num = parseFloat(chap.number) || 0
                    const date = new Date(chap.updated_at ? chap.updated_at * 1000 : Date.now())

                    chapters.push(App.createChapter({
                        id: id,
                        name: title,
                        chapNum: num,
                        time: date,
                        langCode: 'en'
                    }))
                }
            } catch (e) {
                console.error("Error parsing chapters JSON", e)
            }
        } 
        
        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        // Cerchiamo l'oggetto "images" nel payload
        // Pattern: "images":[{"width":...,"height":...,"url":"..."}]
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
        
        // Cerchiamo l'array "items" nel JSON dei risultati di ricerca
        // Pattern: "items":[{"manga_id":...,"title":"..."}]
        // Questo appare spesso dentro il blocco sharedData o similare
        
        // Metodo 1: Regex JSON diretto
        const itemsRegex = /"items":(\[\{.*?\}\])/g
        let match
        
        // Potrebbero esserci più liste (popolari, recenti), noi cerchiamo quella dei risultati
        // Solitamente è la lista più lunga o l'unica se siamo in pagina di ricerca
        while ((match = itemsRegex.exec(html)) !== null) {
            try {
                const items = JSON.parse(match[1])
                // Verifica che sia un array di manga (controlla campi tipici)
                if (items.length > 0 && (items[0].manga_id || items[0].hash_id)) {
                     for (const item of items) {
                        const id = `${item.hash_id}-${item.slug}` // Formato ID usato dal sito
                        const title = item.title
                        const image = item.poster?.medium || item.poster?.large || item.poster?.small || ''
                        
                        results.push(App.createPartialSourceManga({
                            mangaId: id,
                            image: image,
                            title: title,
                            subtitle: undefined
                        }))
                     }
                     // Se abbiamo trovato dei risultati, fermiamoci
                     if (results.length > 0) break
                }
            } catch (e) {
                // Continue searching
            }
        }

        return results
    }

    parseHomeSections(html: string, sectionCallback: (section: HomeSection) => void): void {
        
        // Definiamo le sezioni
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Most Popular 🔥', containsMoreItems: false, type: HomeSectionType.singleRowLarge })
        const trendingSection = App.createHomeSection({ id: 'trending', title: 'Trending New 🌟', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆙', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        // Parsing manuale del JSON embedded per la Home
        // Cerchiamo le liste di "items" associate alle sezioni
        
        const popularItems: PartialSourceManga[] = []
        const trendingItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // Estrattore generico di items dal JSON grezzo
        const extractItems = (rawJson: string, keyword: string): any[] => {
            // Cerca un pattern tipo "keyword":... "items":[...]
            // O semplicemente analizza tutto e filtra
            return []
        }

        // Metodo Cheerio per fallback (più sicuro se il JSON è troppo frammentato)
        const $ = cheerio.load(html)
        
        // 1. Popular (Carosello principale)
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
        
        // 2. New/Trending (Sidebar o altre sezioni)
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

        // 3. Latest Updates (Lista principale)
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

        // Popola sezioni
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