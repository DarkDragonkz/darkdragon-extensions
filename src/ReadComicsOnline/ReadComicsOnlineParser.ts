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
        const title = $('div.barContent a.bigChar').first().text().trim() || 'Unknown'
        
        let image = $('.rightBox .barContent img').first().attr('src') ?? ''
        if (image.startsWith('/')) image = BASE_URL + image
        
        let author = 'Unknown'
        let status = 'Ongoing'
        let desc = ''
        const arrayTags: Tag[] = []

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
            } else if (!text.includes('Artist:') && !text.includes('Publication date:')) {
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
        const rows = $('table.listing tr').toArray()

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const link = $(row).find('a').first()
            const title = link.text().trim()
            const href = link.attr('href')
            
            if (!href) continue

            const chapterId = href
            const dateText = $(row).find('td').eq(1).text().trim()
            const time = dateText ? new Date(dateText) : new Date()

            let chapNum = 0
            // Cerca numeri nel titolo tipo "Issue #15" o "15"
            const numMatch = title.match(/#(\d+(\.\d+)?)/) ?? title.match(/(\d+(\.\d+)?)/)
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
        
        // Estrazione URL immagini da variabile Javascript (metodo più affidabile per questo sito)
        let scriptMatch = html.match(/var lstImages = new Array\((.*?)\);/)
        if (!scriptMatch) scriptMatch = html.match(/new Array\((.*?)\);/)

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
        
        $('.list-comic .item').each((_: any, item: any) => {
            const link = $('a', item).first()
            const title = $('span.title', link).text().trim() || link.text().trim()
            
            let id = link.attr('href') ?? ''
            // Pulisce l'ID rimuovendo percorsi extra
            id = id.replace(/^\/Comic\//, '').replace(/^\//, '')

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
        
        // --- 1. Latest Updates ---
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        const latestItems: PartialSourceManga[] = []
        
        // Selettore specifico per la struttura a "items" che mi hai mostrato
        $('.bigBarContainer .items a').each((_: any, a: any) => {
            const href = $(a).attr('href')
            // Ignora i link ai capitoli specifici (che contengono ?id=)
            if (href && href.includes('Comic/') && !href.includes('?id=')) {
                
                let id = href.replace(/^\/Comic\//, '').replace(/^Comic\//, '').replace(/^\//, '')
                
                // Il testo contiene spesso "Title Issue #1", puliamo
                let title = $(a).text().trim()
                if (title.includes('Issue')) title = title.split('Issue')[0].trim()
                if (title.includes('\n')) title = title.split('\n')[0].trim()
                
                if (!title) return

                const img = $('img', a)
                // LOGICA CRITICA: Cerca srcTemp se src è vuoto o placeholder
                let image = img.attr('src') ?? ''
                if (!image || image.includes('blank') || image.includes('loader')) {
                    image = img.attr('srcTemp') ?? ''
                }
                if (image && image.startsWith('/')) image = BASE_URL + image

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

        // --- 2. Newest & Popular (Tabbed content) ---
        const parseTab = (tabId: string, sectionId: string, titleSection: string) => {
            const section = App.createHomeSection({ 
                id: sectionId, 
                title: titleSection, 
                containsMoreItems: false, 
                type: HomeSectionType.singleRowNormal 
            })
            const items: PartialSourceManga[] = []

            $(`#${tabId} > div`).each((_: any, div: any) => {
                const link = $('a', div).first() // Prende il primo link (spesso l'immagine)
                const href = link.attr('href')
                if (!href) return

                let id = href.replace(/^\/Comic\//, '').replace(/^Comic\//, '').replace(/^\//, '')
                
                // Cerca il titolo in vari punti
                let title = $(div).find('a.title').text().trim()
                if (!title) title = link.next('a').text().trim() // A volte il titolo è il link dopo l'immagine
                if (!title) title = link.text().trim()

                let image = $('img', div).attr('src') ?? ''
                if (!image || image.includes('blank')) image = $('img', div).attr('srcTemp') ?? ''
                if (image.startsWith('/')) image = BASE_URL + image

                if (id && title) {
                    items.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image,
                        title: title,
                        subtitle: undefined
                    }))
                }
            })
            
            if (items.length > 0) {
                section.items = items
                sectionCallback(section)
            }
        }

        parseTab('tab-newest', 'newest', 'New Series')
        parseTab('tab-mostview', 'popular', 'Most Popular')
        parseTab('tab-top-day', 'topday', 'Top Day')
    }
}