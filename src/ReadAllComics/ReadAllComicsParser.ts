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
        
        // Gestione Immagine
        let image = $('.description-archive img').first().attr('src') ?? ''
        if (!image) image = $('#post-area img').first().attr('src') ?? ''
        if (image.startsWith('/')) image = 'https://readallcomics.com' + image
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        // Descrizione e Autore
        let description = ''
        let author = 'Unknown'
        const arrayTags: Tag[] = []

        const infoElements = $('.b strong').toArray()
        
        // Estrazione metadati dal blocco disordinato del sito
        for (const element of infoElements) {
            const label = $(element).text().trim()
            const parentText = $(element).parent().text().trim()

            if (parentText.includes('Publisher:')) {
                author = parentText.replace('Publisher:', '').trim()
            } else if (parentText.includes('Genres:')) {
                const genreText = parentText.replace('Genres:', '').trim()
                const genres = genreText.split(',')
                for (const g of genres) {
                    const tagLabel = g.trim()
                    const tagId = tagLabel.toLowerCase().replace(/[^a-z0-9]/g, '')
                    if (tagLabel) arrayTags.push(App.createTag({ id: tagId, label: tagLabel }))
                }
            } else if (!parentText.startsWith('Vol')) {
                // Tutto ciò che non è un metadato è descrizione
                description += parentText + '\n'
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
                status: 'Ongoing',
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
        const items = $('.list-story li').toArray()

        for (const item of items) {
            const link = $(item).find('a')
            const href = link.attr('href')
            const title = link.text().trim()

            if (!href) continue

            // ID Capitolo: ultima parte dell'URL
            const parts = href.split('/').filter((p: string) => p.length > 0)
            const chapterId = parts[parts.length - 1]

            // Data (spesso l'anno è nel titolo)
            const yearMatch = title.match(/\((\d{4})\)/)
            const time = yearMatch ? new Date(yearMatch[1]) : new Date()

            // Numero capitolo
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

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Cerca tutte le immagini nel corpo della pagina
        const images = $('img').toArray()

        for (const img of images) {
            const $img = $(img)
            let src = $img.attr('src') || $img.attr('data-src')

            // Filtra immagini di sistema
            if (!src || src.includes('logo') || src.includes('banner') || src.includes('preloader')) {
                continue
            }
            
            // Correzione URL
            src = src.trim()
            if (src.startsWith('//')) src = 'https:' + src
            if (src.startsWith('/')) src = 'https://readallcomics.com' + src

            // Accetta solo immagini che sembrano pagine (spesso hostate su blogspot o wp-content)
            if (src.includes('blogspot') || src.includes('wp-content')) {
                 pages.push(src)
            }
        }
        
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)] // Rimuovi duplicati
        })
    }

    // Unica funzione per Home e Ricerca
    parseSearchResults($: any, isSearch: boolean): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        if (isSearch) {
            // LISTA (Ricerca testuale) - Di solito senza immagini
            const items = $('.list-story li').toArray()
            for (const item of items) {
                const link = $(item).find('a')
                const title = link.attr('title') || link.text().trim()
                const href = link.attr('href')
                if (!href) continue

                const parts = href.split('/').filter((p: string) => p.length > 0)
                const id = parts[parts.length - 1]

                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: 'https://paperback.moe/icons/logo-alt.svg',
                    title: title,
                    subtitle: 'Comic'
                }))
            }
        } else {
            // GRIGLIA (Home / Browse / Categoria) - Con immagini
            const items = $('#post-area .post').toArray()
            for (const item of items) {
                const $item = $(item)
                const titleLink = $item.find('.pinbin-copy a').first()
                const title = titleLink.text().trim()
                
                // Estrai ID dalla classe category
                const classAttr = $item.attr('class') || ''
                const idMatch = classAttr.match(/category-([^\s]+)/)
                const id = idMatch ? idMatch[1] : ''

                // Estrazione Immagine robusta
                let image = $item.find('img').first().attr('src') ?? ''
                // A volte è in data-src
                if (!image) image = $item.find('img').first().attr('data-src') ?? ''
                
                if (image.startsWith('/')) image = 'https://readallcomics.com' + image
                
                // Fallback se ancora vuota
                if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

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
        
        // false = modalità "Griglia/Browse"
        const items = this.parseSearchResults($, false)
        
        latestSection.items = items
        sectionCallback(latestSection)
    }
}