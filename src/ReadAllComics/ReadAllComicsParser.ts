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

export class ReadAllComicsParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1').first().text().trim() || 'Unknown'
        
        let image = $('.description-archive img').first().attr('src') || ''
        if (!image) image = $('#post-area img').first().attr('src') || ''
        if (image.startsWith('/')) image = 'https://2.bp.blogspot.com' + image
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        const descElements = $('.b strong').toArray()
        const descLines: string[] = []
        for (const el of descElements) {
            const text = $(el).parent().text().trim()
            if (!text.startsWith('Vol') && !text.includes('Publisher:') && !text.includes('Genres:')) {
                descLines.push(text)
            }
        }
        const description = descLines.join('\n').trim() || 'Read comic online at ReadAllComics'

        const arrayTags: Tag[] = []
        let author = ''

        for (const el of descElements) {
            const parentText = $(el).parent().text().trim()
            
            if (parentText.includes('Genres:')) {
                const genreText = $(el).parent().text().replace('Genres:', '').trim()
                const genres = genreText.split(',')
                for (const g of genres) {
                    const label = g.trim()
                    const id = label.toLowerCase().replace(/[^a-z0-9]/g, '')
                    if (label) arrayTags.push(App.createTag({ id, label }))
                }
            }
            
            if (parentText.includes('Publisher:')) {
                author = $(el).parent().text().replace('Publisher:', '').trim()
            }
        }

        // FIX: Gestione corretta TagSection
        const tagSections: TagSection[] = []
        if (arrayTags.length > 0) {
            tagSections.push(App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags }))
        }

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: 'Completed',
                author: author,
                tags: tagSections,
                desc: description
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Modalità Serie: Lista di capitoli
        const items = $('.list-story li').toArray()

        if (items.length > 0) {
            for (const item of items) {
                const link = $(item).find('a')
                const title = link.text().trim()
                const href = link.attr('href')

                if (!href) continue

                // Usa l'URL completo come ID per sicurezza
                const chapterId = href

                const yearMatch = title.match(/\((\d{4})\)/)
                const time = yearMatch ? new Date(yearMatch[1]) : new Date()

                let chapNum = 0
                const chapterMatch = title.match(/(?:v\d+\s)?#?(\d+)/i)
                if (chapterMatch && chapterMatch[1]) {
                    const num = parseInt(chapterMatch[1])
                    if (num < 1900) chapNum = num
                }

                chapters.push(App.createChapter({
                    id: chapterId,
                    name: title,
                    chapNum: chapNum,
                    time: time,
                    langCode: 'en'
                }))
            }
        } else {
            // Modalità Albo Singolo: La pagina stessa è il capitolo
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
        }

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // FIX: Cerca immagini ovunque nel post
        const images = $('img').toArray()

        for (const img of images) {
            const $img = $(img)
            let src = $img.attr('src') || $img.attr('data-src')

            // Filtra immagini spazzatura
            if (!src || src.includes('logo') || src.includes('banner') || src.includes('button') || src.includes('preloader')) {
                continue
            }
            
            // Accetta solo immagini che sembrano pagine del fumetto (spesso ospitate su blogspot)
            // O immagini interne con path relativo
            if (src.includes('blogspot') || src.includes('wp-content') || src.startsWith('http')) {
                pages.push(src.trim())
            }
        }
        
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)] // Rimuovi duplicati
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Cerca nella griglia (sia per Home che per Ricerca ora)
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