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

        // Parsing dei metadati
        $('.barContent p').each((_: any, p: any) => {
            const text = $(p).text().trim()
            
            if (text.includes('Genres:')) {
                $('a', p).each((__: any, a: any) => {
                    const label = $(a).text().trim()
                    const id = $(a).attr('href')?.split('/').pop() ?? label
                    if (label) arrayTags.push(App.createTag({ id, label }))
                })
            } else if (text.includes('Writer:')) {
                author = $('a', p).text().trim()
            } else if (text.includes('Status:')) {
                if (text.includes('Completed')) status = 'Completed'
            } else if (!text.includes('Artist:') && !text.includes('Publication date:')) {
                // Assumiamo che il resto sia descrizione
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
        
        // RCO usa una tabella con classe "listing" per i capitoli
        const rows = $('table.listing tr').toArray()

        // Salta la prima riga (intestazione)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const link = $(row).find('a').first()
            const title = link.text().trim()
            const href = link.attr('href')
            
            if (!href) continue

            // ID Capitolo: l'URL completo relativo
            // es: /Comic/Batman-2016/Issue-1?id=12345
            const chapterId = href

            // Data
            const dateText = $(row).find('td').eq(1).text().trim()
            const time = dateText ? new Date(dateText) : new Date()

            // Numero capitolo (estratto dal titolo se possibile)
            let chapNum = 0
            const numMatch = title.match(/#(\d+(\.\d+)?)/)
            if (numMatch) {
                chapNum = parseFloat(numMatch[1])
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
        
        // RCO carica le immagini tramite uno script "lstImages"
        // Dobbiamo estrarre l'array dal testo dello script
        const scriptMatch = html.match(/var lstImages = new Array\((.*?)\);/)
        
        if (scriptMatch && scriptMatch[1]) {
            // Divide la stringa per virgole e pulisce le virgolette
            const urls = scriptMatch[1].split(',').map((url: string) => {
                return url.trim().replace(/^"|"$/g, '') // Rimuove virgolette inizio/fine
            })
            
            for (const url of urls) {
                if (url.startsWith('http')) {
                    pages.push(url)
                }
            }
        } else {
            // Fallback: se non trova lo script, prova a cercare immagini dirette (raro su RCO)
            const $ = cheerio.load(html)
            $('img').each((_: any, img: any) => {
                const src = $(img).attr('src')
                if (src && src.includes('blogspot')) pages.push(src)
            })
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // La ricerca di RCO è solitamente una lista
        $('.list-comic .item').each((_: any, item: any) => {
            const link = $('a', item).first()
            const title = link.text().trim()
            // Rimuovi /Comic/ dall'inizio per avere l'ID pulito
            const id = link.attr('href')?.replace(/^\/Comic\//, '') ?? ''
            const image = $('img', item).attr('src') ?? ''

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image.startsWith('/') ? BASE_URL + image : image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. Latest Update (Barra scorrevole in alto nell'HTML fornito)
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        const latestItems: PartialSourceManga[] = []
        
        $('.bigBarContainer .items div a').each((_: any, a: any) => {
            const href = $(a).attr('href')
            // Salta i link ai capitoli specifici, prendi solo link ai fumetti se possibile
            // Nell'HTML fornito: <a href="Comic/Titolo" ...> è il fumetto
            if (href && href.startsWith('Comic/')) {
                const id = href.replace('Comic/', '')
                const title = $(a).text().trim().split('Issue')[0].trim() // Pulisce "Issue #7" dal titolo
                let image = $('img', a).attr('src') ?? ''
                if (image.startsWith('/')) image = BASE_URL + image

                // Evita duplicati
                if (!latestItems.some(x => x.mangaId === id)) {
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

        // 2. Newest Comics (Tab)
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

        // 3. Most Popular (Tab)
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