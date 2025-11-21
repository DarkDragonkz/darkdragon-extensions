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

    // Helper per estrarre il JSON gigante di Qwik
    private getQwikData($: any): any[] {
        try {
            const jsonScript = $('script[type="qwik/json"]').html()
            if (!jsonScript) return []
            const data = JSON.parse(jsonScript)
            // Qwik salva i dati in "objs". Restituiamo quello.
            return data.objs || []
        } catch (e) {
            console.log('Error parsing Qwik JSON: ' + e)
            return []
        }
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const objs = this.getQwikData($)
        
        // Cerchiamo l'oggetto che contiene i dettagli del manga
        // La struttura cambia, quindi cerchiamo un oggetto che ha "name", "authors" e "genres"
        const mangaObj = objs.find((obj: any) => 
            obj && 
            typeof obj === 'object' &&
            obj.name && 
            obj.urlPath && obj.urlPath.includes(mangaId) &&
            (obj.authors || obj.genres)
        )

        if (!mangaObj) throw new Error('Failed to find manga details in Qwik data')

        // Estrai i dati
        const title = mangaObj.name
        const image = mangaObj.urlCover600 || mangaObj.urlCoverOri || 'https://paperback.moe/icons/logo-alt.svg'
        const author = mangaObj.authors ? (Array.isArray(mangaObj.authors) ? mangaObj.authors.join(', ') : mangaObj.authors) : 'Unknown'
        const desc = mangaObj.summary || 'No description'
        let status = 'Ongoing'
        if (mangaObj.originalStatus === 'completed') status = 'Completed'

        // Tags
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

        // Scansioniamo tutti gli oggetti per trovare quelli che sembrano capitoli
        // Un capitolo in MangaPark ha solitamente "dname" (display name) e un "urlPath" che contiene /title/ID/
        for (const obj of objs) {
            if (!obj || typeof obj !== 'object') continue
            
            if (obj.dname && obj.urlPath && obj.urlPath.includes(mangaId) && obj.dateCreate) {
                // È un capitolo!
                // Estraiamo l'ID dall'URL. Es: /title/12195-.../6231766-vol-2-ch-14 -> 6231766
                const urlParts = obj.urlPath.split('/')
                const lastPart = urlParts[urlParts.length - 1]
                const chapterId = lastPart // Questo ci servirà per le immagini

                // Numero capitolo
                const chapNumMatch = obj.dname.match(/ch\.(\d+(\.\d+)?)/i)
                const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

                chapters.push(App.createChapter({
                    id: chapterId, // Salviamo l'ID univoco o l'intero path
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

        // Cerchiamo oggetti che hanno "name", "urlPath" che inizia con /title/ e "urlCover600"
        // Dobbiamo evitare duplicati o oggetti spuri
        const seenIds = new Set<string>()

        for (const obj of objs) {
            if (!obj || typeof obj !== 'object') continue

            if (obj.name && obj.urlPath && obj.urlPath.startsWith('/title/') && obj.urlCover600) {
                // Estraiamo l'ID numerico del manga (es: 12195)
                const idMatch = obj.urlPath.match(/\/title\/(\d+)-/)
                const id = idMatch ? idMatch[1] : null
                
                if (id && !seenIds.has(id)) {
                    seenIds.add(id)
                    results.push(App.createPartialSourceManga({
                        mangaId: id, // Importante: Usiamo solo l'ID numerico
                        image: obj.urlCover600,
                        title: obj.name,
                        subtitle: obj.authors ? String(obj.authors) : undefined
                    }))
                }
            }
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Updates', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Releases', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        const objs = this.getQwikData($)
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Strategia: MangaPark mette i manga in liste. Scansioniamo tutto ciò che sembra un manga.
        // In base all'ordine nel JSON, i primi sono spesso i "Popular Updates" o "Featured".
        
        for (const obj of objs) {
            if (!obj || typeof obj !== 'object') continue

            if (obj.name && obj.urlPath && obj.urlPath.startsWith('/title/') && (obj.urlCover600 || obj.urlCoverOri)) {
                const idMatch = obj.urlPath.match(/\/title\/(\d+)-/)
                const id = idMatch ? idMatch[1] : null
                
                if (id && !seenIds.has(id)) {
                    seenIds.add(id)
                    const item = App.createPartialSourceManga({
                        mangaId: id,
                        image: obj.urlCover600 || obj.urlCoverOri,
                        title: obj.name,
                        subtitle: undefined
                    })

                    // Distribuzione euristica: i primi 10 nei popolari, i successivi nei latest
                    // Nota: Per una precisione perfetta bisognerebbe analizzare la struttura "refs" del JSON Qwik,
                    // ma è molto complessa. Questo approccio "scan" di solito funziona bene per vedere i contenuti.
                    if (popularItems.length < 10) {
                        popularItems.push(item)
                    } else if (latestItems.length < 20) {
                        latestItems.push(item)
                    }
                }
            }
        }

        popularSection.items = popularItems
        latestSection.items = latestItems
        
        sectionCallback(popularSection)
        sectionCallback(latestSection)
    }
}