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
        const title = $('h1').first().text().trim() || $('.front-link').first().text().trim() || 'Unknown'
        
        let image = $('#post-area img').first().attr('src') ?? ''
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        const desc = 'Read comic online at ReadAllComics'
        const status = 'Completed'

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
        const chapters: Chapter[] = []
        
        const title = $('h1').first().text().trim() || 'Full Issue'
        const timeStr = $('.pinbin-date').text().trim()
        const time = timeStr ? new Date(timeStr) : new Date()

        chapters.push(App.createChapter({
            id: mangaId,
            name: title,
            chapNum: 1,
            time: time,
            langCode: 'en'
        }))

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Ciclo for sicuro per evitare crash di cheerio con .each
        // Aggiunti filtri ispirati alla repo esterna (preloader.gif, logo, ecc)
        const images = $('#post-area img, .entry-content img, .post img').toArray()

        for (const img of images) {
            const $img = $(img)
            let src = $img.attr('src')
            
            if (!src || src.includes('data:image')) {
                src = $img.attr('data-src') || $img.attr('data-lazy-src')
            }
            
            // Pulizia URL e filtri
            if (src) {
                src = src.trim()
                // Logica della repo esterna: scarta immagini "preloader" o di sistema
                if (
                    src.includes('logo') || 
                    src.includes('banner') || 
                    src.includes('button') || 
                    src.includes('preloader.gif') ||
                    src.includes('loader')
                ) {
                    continue
                }

                // Correzione URL relativi
                if (src.startsWith('//')) {
                    src = 'https:' + src
                }

                pages.push(src)
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
        
        const items = $('#post-area .post').toArray()

        for (const item of items) {
            const $item = $(item)
            const titleLink = $item.find('h2 a').first()
            const title = titleLink.text().trim()
            const href = titleLink.attr('href')
            
            const id = href ?? ''

            let image = $item.find('img').first().attr('src') ?? ''
            const date = $item.find('.pinbin-date').text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: date
                }))
            }
        }
        
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