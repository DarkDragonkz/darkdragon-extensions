import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SourceManga,
    PartialSourceManga,
    TagSection,
} from '@paperback/types'

export class ReadAllComicsParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // In questo sito, ogni pagina è un "Issue" singolo.
        // Usiamo il titolo della pagina come titolo del manga.
        const title = $('h1').first().text().trim() || $('.front-link').first().text().trim() || 'Unknown'
        
        // Cerchiamo l'immagine principale
        let image = $('#post-area img').first().attr('src') ?? ''
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        const desc = 'Read comic online at ReadAllComics'
        const status = 'Completed' // Essendo un singolo albo, è sempre "completo"

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                tags: [],
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        // Poiché ogni pagina è un albo unico, creiamo un unico "Capitolo 1"
        // che punta alla stessa pagina dell'ID manga.
        const chapters: Chapter[] = []
        
        const title = $('h1').first().text().trim() || 'Full Issue'
        const timeStr = $('.pinbin-date').text().trim()
        const time = timeStr ? new Date(timeStr) : new Date()

        chapters.push(App.createChapter({
            id: mangaId, // L'ID del capitolo è lo stesso della pagina
            name: title,
            chapNum: 1,
            time: time,
            langCode: 'en'
        }))

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // ReadAllComics di solito mette tutte le immagini nel div principale
        // Cerchiamo tutte le immagini nel contenitore del post
        // Escludiamo logo e icone note
        $('#post-area img, .entry-content img').each((_: any, img: any) => {
            const src = $(img).attr('src')
            if (src && !src.includes('logo') && !src.includes('banner')) {
                // A volte usano immagini molto piccole come spaziatori, filtriamo per sicurezza se possibile,
                // ma per ora prendiamo tutto ciò che sembra una pagina.
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
        
        // Analizza la griglia dei post
        $('#post-area .post').each((_: any, item: any) => {
            const titleLink = $(item).find('h2 a').first()
            const title = titleLink.text().trim()
            const href = titleLink.attr('href')
            
            // L'ID è l'URL completo in questo caso
            const id = href ?? ''

            let image = $(item).find('img').first().attr('src') ?? ''
            const date = $(item).find('span').last().text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: date
                }))
            }
        })
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Releases', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        
        const items = this.parseSearchResults($)
        
        latestSection.items = items
        sectionCallback(latestSection)
    }
}