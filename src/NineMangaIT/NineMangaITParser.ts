import {
    HomeSection,
    HomeSectionType,
    PartialSourceManga,
} from '@paperback/types'

export class NineMangaITParser {

    /**
     * Estrae l'URL dell'immagine corretto dai file forniti.
     * NineManga mette l'immagine vera in 'original' o 'src' se non c'è lazy load.
     */
    private getImageSrc(element: any): string {
        const img = element.find('img').first()
        
        // In "Sezione Ultimi Aggiornamenti in Homepage.txt", il tag img ha src="..." e original="..."
        let src = img.attr('original') || img.attr('src')

        if (!src || src.includes('pixel.gif') || src.includes('loading')) {
            // Fallback se l'attributo original manca
            src = img.attr('src')
        }

        if (!src || src.includes('logo')) {
            return 'https://paperback.moe/icons/logo-alt.svg'
        }

        src = src.trim()
        if (src.startsWith('//')) src = `https:${src}`
        
        return src
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        // 1. Sezione Popolari (Spesso la prima lista nella home o tab_content)
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Popolari 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })

        // 2. Sezione Ultimi Aggiornamenti (Analizzato da "Sezione Ultimi Aggiornamenti in Homepage.txt")
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Ultimi Aggiornamenti 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })

        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // --- PARSING ULTIMI AGGIORNAMENTI ---
        // Struttura trovata nel file txt: <dl class="book-list"> <dd> ... </dd> </dl>
        $('.book-list dd').each((_: any, element: any) => {
            const el = $(element)
            
            // Titolo: <a class="bookname" href="...">Title</a>
            const titleLink = el.find('a.bookname').first()
            const title = titleLink.text().trim()
            const href = titleLink.attr('href')

            // ID: /manga/Nome-Manga.html -> Nome-Manga
            const id = href?.split('/manga/')[1]?.replace('.html', '')

            if (!id || !title) return

            // Immagine
            const image = this.getImageSrc(el)

            // Sottotitolo: Capitolo (spesso nel tag <a class="chapter"> o simile vicino)
            // Nel txt fornito, le info capitolo sono spesso dopo il titolo o in un div separato.
            // Cerchiamo un link che contenga "chapter"
            let subtitle = el.find('a[href*="/chapter/"]').first().text().trim()
            if (!subtitle) subtitle = 'Aggiornato'

            latestItems.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: subtitle
            }))
        })

        // --- PARSING POPOLARI ---
        // Basandoci su "Homepage.txt", cerchiamo le liste dei tab o le liste in alto
        // Solitamente sono liste <ul><li>
        $('ul#tab_content_1 li, ul.p_list li').each((_: any, element: any) => {
            const el = $(element)
            const titleLink = el.find('a.bookname').first()
            const href = titleLink.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const title = titleLink.text().trim()

            if (!id || !title) return

            const image = this.getImageSrc(el)

            popularItems.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        })

        // Assegnazione Items
        latestSection.items = latestItems
        popularSection.items = popularItems

        // Callback
        sectionCallback(popularSection)
        sectionCallback(latestSection)
    }
}