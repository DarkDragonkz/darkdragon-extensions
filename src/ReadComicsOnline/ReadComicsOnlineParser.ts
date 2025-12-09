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

const BASE_URL = 'https://readcomiconline.li'

export class ReadComicsOnlineParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Titolo: cerca il link grande nella barra dei contenuti
        const title = $('div.barContent a.bigChar').first().text().trim() || 'Unknown'
        
        // Immagine: cerca la prima immagine nella colonna destra
        let image = $('.rightBox .barContent img').first().attr('src') ?? ''
        if (image.startsWith('/')) image = BASE_URL + image
        
        // Info (Autore, Generi, Stato)
        let author = 'Unknown'
        let status = 'Ongoing'
        let desc = ''
        const arrayTags: Tag[] = []

        // Parsing metadati: itera su tutti i paragrafi che potrebbero contenere info
        $('.barContent p').each((_: any, p: any) => {
            const text = $(p).text().trim()
            const $p = $(p)
            
            if (text.includes('Genres:')) {
                $p.find('a').each((__: any, a: any) => {
                    const label = $(a).text().trim()
                    const id = $(a).attr('href')?.split('/').pop() ?? label
                    if (label) arrayTags.push(App.createTag({ id, label }))
                })
            } else if (text.includes('Writer:')) {
                author = $p.find('a').text().trim() || 'Unknown'
            } else if (text.includes('Status:')) {
                if (text.includes('Completed')) status = 'Completed'
            } else if (!text.includes('Artist:') && !text.includes('Publication date:') && text.length > 5) {
                // Se non è un metadato noto, probabilmente è la descrizione
                desc += text + '\n'
            }
        })

        const tagSections: TagSection[] = [
            App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })
        ]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc.trim() || 'No description available'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Tabella capitoli
        const rows = $('table.listing tr').toArray()

        // Salta intestazione
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const link = $(row).find('a').first()
            const title = link.text().trim()
            const href = link.attr('href')
            
            if (!href) continue

            const chapterId = href
            const dateText = $(row).find('td').eq(1).text().trim()
            const time = dateText ? new Date(dateText) : new Date()

            // Estrai numero capitolo (es. Issue #14 -> 14)
            let chapNum = 0
            const numMatch = title.match(/#(\d+(\.\d+)?)/)
            if (numMatch) {
                chapNum = parseFloat(numMatch[1])
            } else {
                // Fallback: cerca qualsiasi numero
                const looseMatch = title.match(/(\d+)/)
                if (looseMatch) chapNum = parseFloat(looseMatch[1])
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: time,
                langCode: 'en'
            }))
        }

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Tentativo 1: Cerca lstImages (Array standard del Server 2)
        let scriptMatch = html.match(/var lstImages = new Array\((.*?)\);/)
        
        // Tentativo 2: Se fallisce, cerca eventuali altre variabili array
        if (!scriptMatch) {
             scriptMatch = html.match(/new Array\((.*?)\);/)
        }

        if (scriptMatch && scriptMatch[1]) {
            const rawUrls = scriptMatch[1].split(',')
            for (const rawUrl of rawUrls) {
                const url = rawUrl.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '')
                if (url.startsWith('http')) {
                    pages.push(url)
                }
            }
        } 

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Selettore basato sul tuo HTML "Find comic"
        $('.list-comic .item').each((_: any, item: any) => {
            const link = $('a', item).first()
            // Titolo spesso è nello span o direttamente nel testo
            const title = $('span.title', link).text().trim() || link.text().trim()
            
            let id = link.attr('href') ?? ''
            // Pulisci ID
            id = id.replace(/^\/Comic\//, '')
            id = id.replace(/^\//, '')

            let image = $('img', link).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // -- 1. Latest Updates --
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        const latestItems: PartialSourceManga[] = []
        
        // Cerca dentro la barra degli aggiornamenti
        $('.bigBarContainer .items a').each((_: any, a: any) => {
            const href = $(a).attr('href')
            // Filtra: deve essere un link a un fumetto, non a un capitolo specifico (che ha ?id=)
            if (href && href.includes('Comic/') && !href.includes('?id=')) {
                let id = href.replace(/^\/Comic\//, '').replace(/^\//, '')
                
                // Pulisce titolo da "Issue #..."
                let title = $(a).text().trim()
                if (title.includes('Issue')) title = title.split('Issue')[0].trim()

                // Gestione immagine (src o srcTemp per lazy load)
                const img = $('img', a)
                let image = img.attr('src') ?? ''
                if (!image || image.includes('loader') || image.startsWith('data:')) {
                    image = img.attr('srcTemp') ?? ''
                }
                if (image.startsWith('/')) image = BASE_URL + image

                if (id && !latestItems.some(x => x.mangaId === id)) {
                    latestItems.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image,
                        title: title,
                        subtitle: 'Updated'
                    }))
                }
            }
        })
        
        if (latestItems.length > 0) {
            latestSection.items = latestItems
            sectionCallback(latestSection)
        }

        // -- 2. Newest Comics --
        const newSection = App.createHomeSection({ 
            id: 'newest', 
            title: 'New Series', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        const newItems: PartialSourceManga[] = []

        // Selettore generico: prendi tutti i div figli diretti del tab, ignorando lo stile
        $('#tab-newest > div').each((_: any, div: any) => {
            const titleLink = $('a.title', div)
            // Se non c'è classe .title, prova il primo link
            const link = titleLink.length > 0 ? titleLink : $('a', div).first()
            
            const href = link.attr('href')
            if (!href || !href.includes('Comic/')) return

            let id = href.replace(/^\/Comic\//, '').replace(/^\//, '')
            const title = link.text().trim()
            
            // Immagine: cerca un img nel div
            let image = $('img', div).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                newItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        
        if (newItems.length > 0) {
            newSection.items = newItems
            sectionCallback(newSection)
        }

        // -- 3. Most Popular --
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Most Popular', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        const popularItems: PartialSourceManga[] = []

        $('#tab-mostview > div').each((_: any, div: any) => {
            const titleLink = $('a.title', div)
            const link = titleLink.length > 0 ? titleLink : $('a', div).first()

            const href = link.attr('href')
            if (!href || !href.includes('Comic/')) return

            let id = href.replace(/^\/Comic\//, '').replace(/^\//, '')
            const title = link.text().trim()
            
            let image = $('img', div).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                popularItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })

        if (popularItems.length > 0) {
            popularSection.items = popularItems
            sectionCallback(popularSection)
        }
    }
}