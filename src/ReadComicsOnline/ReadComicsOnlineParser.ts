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
        // Titolo
        const title = $('div.barContent a.bigChar').first().text().trim() || 'Unknown'
        
        // Immagine
        let image = $('.rightBox .barContent img').first().attr('src') ?? ''
        if (image.startsWith('/')) image = BASE_URL + image
        
        // Info (Autore, Generi, Stato)
        let author = 'Unknown'
        let status = 'Ongoing'
        let desc = ''
        const arrayTags: Tag[] = []

        // Parsing dei metadati dai paragrafi <p>
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
                author = $p.find('a').text().trim()
            } else if (text.includes('Status:')) {
                if (text.includes('Completed')) status = 'Completed'
            } else if (!text.includes('Artist:') && !text.includes('Publication date:')) {
                // Descrizione
                if (text.length > 20) desc += text + '\n'
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
        
        // La tabella dei capitoli ha classe .listing
        const rows = $('table.listing tr').toArray()

        // Saltiamo la prima riga (intestazione)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const link = $(row).find('a').first()
            const title = link.text().trim()
            const href = link.attr('href')
            
            if (!href) continue

            // ID Capitolo: es: /Comic/Batman-Year-One/Issue-1?id=49806
            const chapterId = href

            // Data (seconda colonna)
            const dateText = $(row).find('td').eq(1).text().trim()
            const time = dateText ? new Date(dateText) : new Date()

            // Numero capitolo
            let chapNum = 0
            const numMatch = title.match(/#(\d+(\.\d+)?)/)
            if (numMatch) {
                chapNum = parseFloat(numMatch[1])
            } else {
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
        
        // Cerca la variabile lstImages (presente nel Server 2)
        const scriptMatch = html.match(/var lstImages = new Array\((.*?)\);/)
        
        if (scriptMatch && scriptMatch[1]) {
            // Pulisce la stringa: "url1", "url2" -> [url1, url2]
            const rawUrls = scriptMatch[1].split(',')
            for (const rawUrl of rawUrls) {
                const url = rawUrl.trim().replace(/^"|"$/g, '')
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
        
        // Selettore basato sull'HTML "Find comic" che mi hai mandato
        $('.list-comic .item').each((_: any, item: any) => {
            const link = $('a', item).first()
            const title = $('span.title', link).text().trim() || link.text().trim()
            
            // Rimuoviamo /Comic/ dall'inizio
            let id = link.attr('href') ?? ''
            if (id.startsWith('/Comic/')) id = id.replace('/Comic/', '')

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
        
        // 1. Latest Update
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        const latestItems: PartialSourceManga[] = []
        
        // Iteriamo su TUTTI i link dentro .items
        $('.bigBarContainer .items a').each((_: any, a: any) => {
            const href = $(a).attr('href')
            // I link ai fumetti iniziano con Comic/, i capitoli hanno ?id=...
            // Nell'HTML fornito: <a href="Comic/Titolo"> è il fumetto
            if (href && href.startsWith('Comic/') && !href.includes('?id=')) {
                const id = href.replace('Comic/', '')
                let title = $(a).text().trim()
                // A volte il titolo è seguito da <br>, prendiamo solo il testo diretto se possibile o puliamo
                if (title.includes('\n')) title = title.split('\n')[0].trim()

                let image = $('img', a).attr('src') ?? ''
                // Supporto lazy loading (srcTemp)
                if (!image || image.includes('loader') || image === '') {
                     image = $('img', a).attr('srcTemp') ?? ''
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
        latestSection.items = latestItems
        sectionCallback(latestSection)

        // 2. Newest Comics
        const newSection = App.createHomeSection({ 
            id: 'newest', 
            title: 'New Series', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        const newItems: PartialSourceManga[] = []

        $('#tab-newest div[style*="position:relative"]').each((_: any, div: any) => {
            const link = $('a', div).first()
            const href = link.attr('href')
            const id = href?.replace('Comic/', '') ?? ''
            const title = $('a.title', div).text().trim()
            
            let image = $('img', link).attr('src') ?? ''
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
        newSection.items = newItems
        sectionCallback(newSection)

        // 3. Most Popular
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Most Popular', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        const popularItems: PartialSourceManga[] = []

        $('#tab-mostview div[style*="position:relative"]').each((_: any, div: any) => {
            const link = $('a', div).first()
            const href = link.attr('href')
            const id = href?.replace('Comic/', '') ?? ''
            const title = $('a.title', div).text().trim()
            
            let image = $('img', link).attr('src') ?? ''
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
        popularSection.items = popularItems
        sectionCallback(popularSection)
    }
}