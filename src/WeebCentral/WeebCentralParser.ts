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
        // Titolo: Cerca l'h1 (visibile o nascosto)
        // Fallback al data-tip se h1 non è chiaro
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
        
        // Cerca tutti i link che portano a /chapters/
        // WeebCentral mette i capitoli in dei blocchi <a>
        $('a[href*="/chapters/"]').each((_: any, element: any) => {
            const href = $(element).attr('href')
            const id = href?.split('/chapters/')[1]
            
            // Il nome del capitolo è spesso in uno span specifico
            // Cerca uno span che contiene "Chapter" o "Episode"
            let name = $(element).find('span:contains("Chapter"), span:contains("Episode")').first().text().trim()
            
            // Se non lo trova, prova a prendere tutto il testo e pulirlo
            if (!name) {
                 name = $(element).find('.grow span').first().text().trim()
            }
            if (!name) name = $(element).text().trim()

            // Estrazione numero capitolo
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
            // Filtra icone piccole o placeholder se necessario
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
        
        // Cerca sia <article> che <div> che potrebbero contenere i risultati
        $('article, div.bg-base-100').each((_: any, item: any) => {
            const linkElement = $('a[href*="/series/"]', item).first()
            const link = linkElement.attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            
            // --- FIX TITOLO ---
            // 1. Cerca l'attributo data-tip (metodo più sicuro)
            let title = $(item).attr('data-tip')?.trim()

            // 2. Se manca, cerca nel testo ma evita le parole chiave "trappola"
            if (!title) {
                // Cerca specificamente il link del titolo (solitamente sotto l'immagine o a destra)
                // Escludiamo elementi che contengono "Official", "Manga", ecc.
                const potentialTitle = $('.text-lg, .font-semibold', item).not(':contains("Official"), :contains("Manga")').first().text().trim()
                if (potentialTitle) title = potentialTitle
            }

            // 3. Fallback sull'alt dell'immagine
            if (!title) {
                title = $('img', item).attr('alt')?.replace(' cover', '') ?? ''
            }

            const image = $('img', item).attr('src') ?? ''

            if (id && title && title !== 'Official') {
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

        // --- 1. Parsing HOT UPDATES ---
        const hotManga: PartialSourceManga[] = []
        const hotHeader = $('h2').filter((_: any, el: any) => $(el).text().includes('Hot Updates')).first()
        const hotContainer = hotHeader.next('section')
        
        $('article', hotContainer).each((_: any, manga: any) => {
            const link = $('a', manga).attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            
            // Usa data-tip se c'è
            let title = $(manga).attr('data-tip')?.trim()
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

        // --- 2. Parsing LATEST UPDATES ---
        const latestManga: PartialSourceManga[] = []
        const latestHeader = $('h2').filter((_: any, el: any) => $(el).text().includes('Latest Updates')).first()
        const latestContainer = latestHeader.next('section')

        $('article', latestContainer).each((_: any, manga: any) => {
            const linkElement = $('a[href*="/series/"]', manga)
            const link = linkElement.attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            
            let title = $(manga).attr('data-tip')?.trim()
            if (!title) title = $('.font-semibold', manga).text().trim()

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