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

export class MangaParkParser {

    private getQwikData($: any): any[] {
        try {
            const jsonScript = $('script[type="qwik/json"]').html()
            if (!jsonScript) return []
            const data = JSON.parse(jsonScript)
            return data.objs || []
        } catch (e) {
            console.log('Error parsing Qwik JSON: ' + e)
            return []
        }
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const objs = this.getQwikData($)
        
        // Cerchiamo l'oggetto con nome e urlPath
        const mangaObj = objs.find((obj: any) => 
            obj && 
            typeof obj === 'object' &&
            obj.name && 
            obj.urlPath && obj.urlPath.includes(mangaId) &&
            (obj.authors || obj.genres)
        )

        if (!mangaObj) {
             // Fallback: proviamo a parsare l'HTML se il JSON fallisce
             const title = $('h3 a.link').first().text().trim()
             const image = $('img[alt="' + title + '"]').attr('src') ?? ''
             return App.createSourceManga({
                id: mangaId,
                mangaInfo: App.createMangaInfo({
                    titles: [title || 'Unknown'],
                    image: image,
                    status: 'Unknown'
                })
             })
        }

        const title = mangaObj.name
        const image = mangaObj.urlCover600 || mangaObj.urlCoverOri || 'https://paperback.moe/icons/logo-alt.svg'
        const author = mangaObj.authors ? (Array.isArray(mangaObj.authors) ? mangaObj.authors.join(', ') : mangaObj.authors) : 'Unknown'
        const desc = mangaObj.summary || 'No description'
        let status = 'Ongoing'
        if (mangaObj.originalStatus === 'completed') status = 'Completed'

        const tags: Tag[] = []
        if (mangaObj.genres && Array.isArray(mangaObj.genres)) {
            for (const tag of mangaObj.genres) {
                tags.push({ id: tag, label: tag })
            }
        }

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status,
                author,
                desc,
                tags: [App.createTagSection({ id: '0', label: 'Genres', tags })]
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const objs = this.getQwikData($)
        const chapters: Chapter[] = []

        for (const obj of objs) {
            if (!obj || typeof obj !== 'object') continue
            
            if (obj.dname && obj.urlPath && obj.urlPath.includes(mangaId) && obj.dateCreate) {
                const urlParts = obj.urlPath.split('/')
                const lastPart = urlParts[urlParts.length - 1]
                const chapterId = lastPart 

                const chapNumMatch = obj.dname.match(/ch\.(\d+(\.\d+)?)/i)
                const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

                chapters.push(App.createChapter({
                    id: chapterId,
                    name: obj.dname + (obj.title ? ` - ${obj.title}` : ''),
                    chapNum: chapNum,
                    time: new Date(obj.dateCreate),
                    langCode: 'en'
                }))
            }
        }
        return chapters
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const objs = this.getQwikData($)
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        for (const obj of objs) {
            if (!obj || typeof obj !== 'object') continue

            if (obj.name && obj.urlPath && obj.urlPath.startsWith('/title/') && obj.urlCover600) {
                const idMatch = obj.urlPath.match(/\/title\/(\d+)-/)
                const id = idMatch ? idMatch[1] : null
                
                if (id && !seenIds.has(id)) {
                    seenIds.add(id)
                    results.push(App.createPartialSourceManga({
                        mangaId: id, 
                        image: obj.urlCover600,
                        title: obj.name,
                        subtitle: obj.authors ? String(obj.authors) : undefined
                    }))
                }
            }
        }
        return results
    }

    // FIX: Parsing HTML invece di JSON per la Home Page
    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Updates', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Releases', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Selettore generico per trovare le card dei manga nella home
        // Cerca i div che contengono link che iniziano con /title/
        const mangaLinks = $('div.grid a[href^="/title/"]').toArray()

        for (const element of mangaLinks) {
            const href = $(element).attr('href')
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null

            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            // Trova l'immagine e il titolo
            // L'immagine è spesso in un tag img dentro l'anchor
            let image = $(element).find('img').attr('src')
            if (!image) continue // Se non c'è immagine, probabilmente non è una card valida

            // Il titolo è spesso in un attributo title dell'img o in un div fratello
            let title = $(element).find('img').attr('title') || $(element).find('img').attr('alt')
            // Se non lo troviamo nell'img, cerchiamo nel testo successivo
            if (!title) {
                 // Cerca un link fratello che potrebbe contenere il titolo
                 const parent = $(element).parent().parent() // Risale al contenitore della card
                 title = parent.find('a.font-bold').text().trim()
            }

            if (!title) title = 'Unknown Title'

            const item = App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            })

            // Logica semplice: i primi vanno in Popular, il resto in Latest
            if (popularItems.length < 12) {
                popularItems.push(item)
            } else if (latestItems.length < 20) {
                latestItems.push(item)
            }
        }

        popularSection.items = popularItems
        latestSection.items = latestItems
        
        sectionCallback(popularSection)
        sectionCallback(latestSection)
    }
}