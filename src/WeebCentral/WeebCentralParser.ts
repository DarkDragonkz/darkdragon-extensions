import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    PartialSourceManga,
    SourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

export class WeebCentralParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim()
        if (!title) title = $('section:has(picture)').first().attr('data-tip') ?? ''
        
        const image = $('img[alt$=" cover"]').attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        const desc = $('strong:contains("Description")').next('p').text().trim()
        const author = $('strong:contains("Author(s)")').next().find('a').text().trim()

        const statusStr = $('strong:contains("Status")').next('a').text().trim()
        let status = 'Unknown'
        if (statusStr.toLowerCase().includes('ongoing')) status = 'Ongoing'
        else if (statusStr.toLowerCase().includes('complete')) status = 'Completed'

        const arrayTags: Tag[] = []
        $('strong:contains("Tags(s)")').nextAll('span').each((_: any, span: any) => {
            const a = $('a', span)
            const id = a.text().trim()
            const label = a.text().trim()
            if (id) arrayTags.push({ id, label })
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags.map((x) => App.createTag(x)) })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc || 'No description available'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('a[href*="/chapters/"]').each((_: any, element: any) => {
            const href = $(element).attr('href')
            const id = href?.split('/chapters/')[1]
            
            let name = $(element).find('span:contains("Chapter"), span:contains("Episode")').first().text().trim()
            if (!name) name = $(element).find('.grow span').first().text().trim()
            if (!name) name = $(element).text().trim()

            const numMatch = name.match(/(\d+(\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[0]) : 0
            const timeStr = $(element).find('time').attr('datetime')
            const time = timeStr ? new Date(timeStr) : new Date()

            if (id) {
                chapters.push(App.createChapter({
                    id: id,
                    name: name,
                    chapNum: chapNum,
                    langCode: 'en',
                    time: time
                }))
            }
        })

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        $('img').each((_: any, img: any) => {
            const src = $(img).attr('src')
            if (src && !src.includes('logo') && !src.includes('icon')) {
                pages.push(src)
            }
        })
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Cerca tutti gli articoli e i div che contengono link alle serie
        $('article, div.bg-base-100, a[href*="/series/"]').each((_: any, item: any) => {
            // Trova il link della serie
            let linkElement = $(item)
            if (!linkElement.is('a')) {
                linkElement = $('a[href*="/series/"]', item).first()
            }
            
            const href = linkElement.attr('href')
            if (!href) return // Salta se non c'è link
            
            // --- FIX TITOLO INFALLIBILE ---
            // Estrae ID e Slug (Titolo) direttamente dall'URL
            // URL tipico: https://weebcentral.com/series/01J76XY7VSG3R5ANYPDWTXDVP6/One-Piece
            const parts = href.split('/series/')[1]?.split('/')
            const id = parts?.[0]
            const slug = parts?.[1] 

            // Prova a cercare l'immagine
            let image = $('img', item).attr('src') 
            // Se l'elemento corrente è un link nudo (senza immagine dentro), cerca nel genitore
            if (!image) image = linkElement.find('img').attr('src')

            // Logica di recupero titolo
            let title = ''

            // 1. Priorità assoluta: Attributo data-tip (usato nei tooltip del sito)
            title = $(item).attr('data-tip')?.trim() ?? ''

            // 2. Seconda scelta: Slug dall'URL (pulito dai trattini)
            // Trasforma "One-Piece" in "One Piece"
            if ((!title || title === 'Official') && slug) {
                title = slug.replace(/-/g, ' ')
            }
            
            // 3. Terza scelta: Testo dentro il link (ma ignoriamo "Official")
            if (!title || title === 'Official') {
                 // Prendi il testo più grande o in grassetto
                 const text = linkElement.find('.font-semibold, .text-lg').first().text().trim()
                 if (text && text !== 'Official' && !text.includes('Chapter')) {
                     title = text
                 }
            }

            // Filtro finale per evitare risultati spazzatura
            if (id && title && title !== 'Official' && !title.includes('Chapter')) {
                // Evita duplicati controllando se l'ID è già stato aggiunto
                const exists = results.some(m => m.mangaId === id)
                if (!exists) {
                    results.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image ?? '',
                        title: title,
                        subtitle: undefined
                    }))
                }
            }
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const hotSection = App.createHomeSection({
            id: 'hot_updates',
            title: 'Hot Updates',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal,
        })
        
        const latestSection = App.createHomeSection({
            id: 'latest_updates',
            title: 'Latest Updates',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal,
        })

        // Parsing Hot Updates
        const hotManga: PartialSourceManga[] = []
        const hotHeader = $('h2').filter((_: any, el: any) => $(el).text().includes('Hot Updates')).first()
        const hotContainer = hotHeader.next('section')
        
        $('article', hotContainer).each((_: any, manga: any) => {
            const link = $('a', manga).attr('href')
            const parts = link?.split('/series/')[1]?.split('/')
            const id = parts?.[0]
            const slug = parts?.[1]
            
            let title = $(manga).attr('data-tip')?.trim()
            // Fallback titolo dallo slug se manca data-tip
            if (!title && slug) title = slug.replace(/-/g, ' ')
            if (!title) title = $('.text-white', manga).first().text().trim()
            
            const image = $('img', manga).attr('src') ?? ''
            
            if (id && title) {
                hotManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        hotSection.items = hotManga
        sectionCallback(hotSection)

        // Parsing Latest Updates
        const latestManga: PartialSourceManga[] = []
        const latestHeader = $('h2').filter((_: any, el: any) => $(el).text().includes('Latest Updates')).first()
        const latestContainer = latestHeader.next('section')

        $('article', latestContainer).each((_: any, manga: any) => {
            const linkElement = $('a[href*="/series/"]', manga)
            const link = linkElement.attr('href')
            const parts = link?.split('/series/')[1]?.split('/')
            const id = parts?.[0]
            const slug = parts?.[1]
            
            let title = $(manga).attr('data-tip')?.trim()
            if ((!title || title === 'Official') && slug) title = slug.replace(/-/g, ' ')
            if (!title) title = $('.font-semibold.text-lg', manga).text().trim()

            const image = $('img', manga).attr('src') ?? ''
            const chapter = $('span', manga).last().text().trim()

            if (id && title) {
                latestManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        latestSection.items = latestManga
        sectionCallback(latestSection)
    }
}