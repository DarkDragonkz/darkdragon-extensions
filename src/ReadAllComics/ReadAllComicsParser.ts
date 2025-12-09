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
        const title = $('h1').first().text().trim()
        
        let image = $('.description-archive img').first().attr('src') || ''
        if (image.startsWith('/')) image = 'https://2.bp.blogspot.com' + image
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        // Estrazione descrizione pulita
        let description = ''
        const descElements = $('.b strong').toArray()
        const descLines: string[] = []
        
        for (const el of descElements) {
            const text = $(el).parent().text().trim()
            if (!text.startsWith('Vol') && !text.includes('Publisher:') && !text.includes('Genres:')) {
                descLines.push(text)
            }
        }
        description = descLines.join('\n').trim()

        const status = 'Ongoing' // Default per i comics
        
        // Estrazione Generi e Publisher
        const arrayTags: Tag[] = []
        let author = ''

        for (const el of descElements) {
            const parentText = $(el).parent().text().trim()
            
            if (parentText.includes('Genres:')) {
                const genreText = $(el).text()
                const genres = genreText.split(',')
                for (const g of genres) {
                    const label = g.trim()
                    const id = label.toLowerCase().replace(/[^a-z0-9]/g, '')
                    if (label) arrayTags.push({ id, label })
                }
            }
            
            if (parentText.includes('Publisher:')) {
                author = $(el).parent().text().replace('Publisher:', '').trim()
            }
        }

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: description
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Selettore lista capitoli
        const items = $('.list-story li').toArray()

        for (const item of items) {
            const link = $(item).find('a')
            const title = link.text().trim()
            const href = link.attr('href')

            if (!href) continue

            // ID Capitolo: l'ultima parte dell'URL
            // Es: https://readallcomics.com/batman-2016-001/ -> batman-2016-001
            const parts = href.split('/').filter((p: string) => p.length > 0)
            const chapterId = parts[parts.length - 1]

            // Tentativo di estrarre data (spesso è l'anno nel titolo)
            const yearMatch = title.match(/\((\d{4})\)/)
            const time = yearMatch ? new Date(yearMatch[1]) : new Date()

            // Numero capitolo
            // Cerca numeri alla fine o dopo "v"
            let chapNum = 0
            const chapterMatch = title.match(/(?:v\d+\s)?(\d+)/)
            // Se il numero è troppo alto (es. anno 2024), probabilmente non è il numero del capitolo
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

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Cerca immagini nel post. La repo Karrot usa 'img[decoding="async"]'
        // Noi cerchiamo in modo più ampio per sicurezza
        const images = $('img[decoding="async"], .entry-content img, #post-area img').toArray()

        for (const img of images) {
            const $img = $(img)
            let src = $img.attr('src') || $img.attr('data-src')

            if (!src || src.includes('logo') || src.includes('preloader') || src.includes('banner')) {
                continue
            }

            // Fix URL relativi o protocolli mancanti
            if (src.startsWith('//')) src = 'https:' + src
            if (src.startsWith('/')) src = 'https://readallcomics.com' + src

            pages.push(src.trim())
        }
        
        // Rimuovi duplicati
        const uniquePages = [...new Set(pages)]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: uniquePages
        })
    }

    parseSearchResults($: any, isSearchRequest: boolean): PartialSourceManga[] {
        const results: PartialSourceManga[] = []

        if (isSearchRequest) {
            // Layout lista (Risultati ricerca)
            const items = $('.list-story li').toArray()
            for (const item of items) {
                const link = $(item).find('a')
                const title = link.text().trim() || link.attr('title') || 'Unknown'
                const href = link.attr('href')

                if (!href) continue
                
                // Estrai ID (è l'ultima parte dell'url category)
                const parts = href.split('/').filter((p: string) => p.length > 0)
                const id = parts[parts.length - 1]

                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: 'https://paperback.moe/icons/logo-alt.svg', // Ricerca testuale non ha immagini
                    title: title,
                    subtitle: undefined
                }))
            }
        } else {
            // Layout griglia (Homepage / Browse)
            const items = $('#post-area .post').toArray()
            for (const item of items) {
                const $item = $(item)
                const link = $item.find('.pinbin-copy a')
                const title = link.attr('title')?.trim() || link.text().trim()
                
                // L'ID del manga è nella classe CSS 'category-NOME'
                // Es: class="post ... category-ultimate-spider-man ..."
                const classAttr = $item.attr('class') || ''
                const idMatch = classAttr.match(/category-([^\s]+)/)
                const id = idMatch ? idMatch[1] : ''

                let image = $item.find('img').first().attr('src') || ''
                if (image.startsWith('/')) image = 'https://2.bp.blogspot.com' + image

                const date = $item.find('.pinbin-copy span').text().trim()

                if (id && title) {
                    results.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image,
                        title: title,
                        subtitle: date
                    }))
                }
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
        
        // Usa il parser "Browse" (false = non è una ricerca testuale)
        const items = this.parseSearchResults($, false)
        
        latestSection.items = items
        sectionCallback(latestSection)
    }
}