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
        // Titolo
        const title = $('h1').first().text().trim()
        
        // Immagine
        let rawImage = $('.description-archive img').first().attr('src') || ''
        if (rawImage.startsWith('/')) rawImage = `https://2.bp.blogspot.com${rawImage}`
        const image = rawImage || 'https://paperback.moe/icons/logo-alt.svg'

        // Descrizione, Autore, Generi
        // Il sito usa una struttura strana con <strong> dentro <p class="b">
        let description = ''
        let author = 'Unknown'
        const arrayTags: Tag[] = []

        const infoElements = $('.b strong').toArray()
        
        for (const element of infoElements) {
            const label = $(element).text().trim()
            const parentText = $(element).parent().text().trim()

            // Descrizione (tutto ciò che non è un metadato noto)
            if (!parentText.includes('Publisher:') && !parentText.includes('Genres:') && !parentText.startsWith('Vol')) {
                description += parentText + '\n'
            }

            // Publisher come Autore
            if (parentText.includes('Publisher:')) {
                author = parentText.replace('Publisher:', '').trim()
            }

            // Generi
            if (parentText.includes('Genres:')) {
                const genreText = parentText.replace('Genres:', '').trim()
                const genres = genreText.split(',')
                for (const g of genres) {
                    const tagLabel = g.trim()
                    const tagId = tagLabel.toLowerCase().replace(/[^a-z0-9]/g, '')
                    if (tagLabel) arrayTags.push(App.createTag({ id: tagId, label: tagLabel }))
                }
            }
        }

        const tagSections: TagSection[] = [
            App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })
        ]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: 'Ongoing', // Default
                rating: 0,
                author: author,
                tags: tagSections,
                desc: description.trim() || 'No description available',
                hentai: false
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // I capitoli sono in una lista <ul> con classe .list-story
        const items = $('.list-story li').toArray()

        for (const item of items) {
            const link = $(item).find('a')
            const href = link.attr('href')
            const title = link.text().trim()

            if (!href) continue

            // ID del capitolo: ultima parte dell'URL
            const parts = href.split('/').filter((p: string) => p.length > 0)
            const chapterId = parts[parts.length - 1]

            // Parsing anno
            const yearMatch = title.match(/\((\d{4})\)/)
            const time = yearMatch ? new Date(yearMatch[1]) : new Date()

            // Parsing numero capitolo
            let chapNum = 0
            // Cerca "v1", "v2" per il volume
            const volumeMatch = title.match(/v(\d+)/i)
            const volNum = volumeMatch ? parseInt(volumeMatch[1]) : 0

            // Cerca il numero del capitolo. Ignora se sembra un anno (>1900)
            const chapterMatch = title.match(/(?:v\d+\s)?(\d+)/)
            if (chapterMatch && chapterMatch[1]) {
                const potentialNum = parseInt(chapterMatch[1])
                if (potentialNum < 1900) chapNum = potentialNum
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                volume: volNum,
                time: time,
                langCode: 'en'
            }))
        }

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Cerca immagini nel post. 
        const images = $('img').toArray()

        for (const img of images) {
            const $img = $(img)
            const src = $img.attr('src') || $img.attr('data-src')

            if (!src || src.includes('logo') || src.includes('preloader') || src.includes('banner')) {
                continue
            }
            
            // Accetta URL completi o relativi validi
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

    parseSearchResults($: any, isSearch: boolean): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        if (isSearch) {
            // Layout Lista (Ricerca testuale)
            // .list-story li
            const items = $('.list-story li').toArray()
            for (const item of items) {
                const link = $(item).find('a')
                const title = link.attr('title') || link.text().trim()
                const href = link.attr('href')

                if (!href) continue

                // Estrai ID: deve essere una category/
                // Es: https://readallcomics.com/category/batman-2016/
                const parts = href.split('/').filter((p: string) => p.length > 0)
                
                // Se non è una categoria (è un capitolo singolo), cerchiamo di risalire o lo ignoriamo
                // La ricerca testuale di solito restituisce link misti.
                // Accettiamo tutto, l'app gestirà se è un manga o chapter
                const id = parts[parts.length - 1]

                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: 'https://paperback.moe/icons/logo-alt.svg', // Niente immagini nella ricerca lista
                    title: title,
                    subtitle: undefined
                }))
            }
        } else {
            // Layout Griglia (Browse / Home)
            // #post-area .post
            const items = $('#post-area .post').toArray()
            for (const item of items) {
                const $item = $(item)
                const link = $item.find('.pinbin-copy a')
                const title = link.attr('title')?.trim() || link.text().trim()
                
                // ID dalla classe CSS
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
        const catalogueSection = App.createHomeSection({ 
            id: 'catalogue', 
            title: 'Catalogue', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        
        const items = this.parseSearchResults($, false) // false = layout griglia
        
        catalogueSection.items = items
        sectionCallback(catalogueSection)
    }
}